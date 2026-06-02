const cron = require('node-cron');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { notifyOfflineParticipants } = require('./messageNotificationService');
const { emitChatMessage } = require('./aiChatService');

module.exports = (io) => {
  cron.schedule('*/10 * * * * *', async () => {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    try {
      const now = new Date();
      const scheduledMessages = await Message.find({
        scheduledTime: { $lte: now },
        isSent: false,
        isDeletedForEveryone: false,
      }).populate([
        { path: 'senderId', select: 'name profilePicture' },
        { path: 'replyTo', select: 'content senderId mediaUrl messageType isDeletedForEveryone deletedFor location poll call' },
      ]);

      for (const msg of scheduledMessages) {
        const sentAt = new Date();
        const sentMessage = await Message.findByIdAndUpdate(
          msg._id,
          {
            isSent: true,
            createdAt: sentAt,
            updatedAt: sentAt,
          },
          {
            new: true,
            overwriteImmutable: true,
            timestamps: false,
          }
        ).populate([
          { path: 'senderId', select: 'name profilePicture' },
          { path: 'replyTo', select: 'content senderId mediaUrl messageType isDeletedForEveryone deletedFor location poll call' },
        ]);

        const chat = await Chat.findByIdAndUpdate(
          sentMessage.chatId,
          { lastMessage: sentMessage._id },
          { new: true }
        ).select('participants');
        emitChatMessage(io, sentMessage, {
          senderId: sentMessage.senderId,
          participantIds: chat?.participants || [],
        });
        await notifyOfflineParticipants({
          chatId: sentMessage.chatId,
          senderId: sentMessage.senderId,
          message: sentMessage,
        });
        console.log(`Scheduled message sent: ${sentMessage._id}`);
      }
    } catch (err) {
      console.error('Scheduled message job failed:', err.message);
    }
  });
};
