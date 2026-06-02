const Message = require('../models/Message');
const User = require('../models/User');
const { resolvePrivacySettings } = require('../utils/privacy');

module.exports = (io, socket, userId) => {
  socket.on('joinRoom', (chatId) => socket.join(chatId));
  socket.on('leaveRoom', (chatId) => socket.leave(chatId));

  socket.on('typing', ({ chatId, userName }) => {
    socket.to(chatId).emit('userTyping', { userId, userName, chatId });
  });

  socket.on('stopTyping', ({ chatId }) => {
    socket.to(chatId).emit('userStopTyping', { userId, chatId });
  });

  socket.on('messageRead', async ({ messageId, chatId }) => {
    const reader = await User.findById(userId).select('privacySettings');
    const showReadReceipts = resolvePrivacySettings(reader?.privacySettings).readReceipts;

    await Message.findByIdAndUpdate(messageId, {
      ...(showReadReceipts
        ? {
            status: 'seen',
            $addToSet: { seenBy: userId },
          }
        : {}),
    });

    if (showReadReceipts) {
      io.to(chatId).emit('messageStatusUpdate', { messageId, status: 'seen', userId });
    }
  });
};
