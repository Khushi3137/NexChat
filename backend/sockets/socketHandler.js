const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { notifyOfflineParticipants } = require('../utils/messageNotificationService');
const { emitHydratedChatToParticipants } = require('../controllers/chatController');
const { resolvePrivacySettings } = require('../utils/privacy');
const {
  addUserSocket,
  getOnlineUserIds,
  removeUserSocket,
  updateUserSocketVisibility,
} = require('../utils/presenceService');
const {
  createAIResponseMessage,
  emitChatMessage,
  getAIPrompt,
  populateChatMessage,
  shouldTriggerAIResponse,
} = require('../utils/aiChatService');

const pruneEmptyReactions = (message) => {
  message.reactions = message.reactions.filter((reaction) => reaction.users.length > 0);
};

const parseVisibility = (value) => value !== false && value !== 'false';
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const getGroupCallRoom = (chatId) => `group-call:${normalizeId(chatId)}`;
const activeGroupCalls = new Map();

const removeUserFromGroupCalls = (io, userId, socketId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return;

  [...activeGroupCalls.entries()].forEach(([chatId, callRecord]) => {
    if (!callRecord.participants.has(normalizedUserId)) return;

    if (normalizeId(callRecord.initiatorId) === normalizedUserId) {
      io.to(getGroupCallRoom(chatId)).emit('groupCallEnded', { chatId, from: normalizedUserId });
      activeGroupCalls.delete(chatId);
      return;
    }

    callRecord.participants.delete(normalizedUserId);
    io.to(getGroupCallRoom(chatId)).emit('groupCallUserLeft', {
      chatId,
      participantId: normalizedUserId,
      socketId,
    });

    if (!callRecord.participants.size) {
      activeGroupCalls.delete(chatId);
    }
  });
};

module.exports = (io) => {
  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    const initialIsVisible = parseVisibility(socket.handshake.query.isVisible);
    console.log(`User connected: ${userId} | socket: ${socket.id}`);

    if (userId) {
      const presence = addUserSocket(userId, socket.id, { isVisible: initialIsVisible });
      await User.findByIdAndUpdate(userId, {
        isOnline: presence.visibleCount > 0,
        ...(presence.visibleCount === 0 ? { lastSeen: new Date() } : {}),
        $addToSet: { socketIds: socket.id },
      });
      socket.emit('presenceSnapshot', { onlineUserIds: getOnlineUserIds() });
      if (presence.becameOnline) {
        io.emit('userOnline', { userId });
      }
      socket.join(userId);
    }

    socket.on('joinRoom', (chatId) => {
      socket.join(chatId);
      console.log(`${userId} joined room ${chatId}`);
    });

    socket.on('leaveRoom', (chatId) => {
      socket.leave(chatId);
    });

    socket.on('setVisibility', async ({ isVisible }) => {
      if (!userId) return;

      const presence = updateUserSocketVisibility(userId, socket.id, isVisible);
      if (!presence) return;

      console.log(
        `Presence update: ${userId} is ${presence.visibleCount > 0 ? 'active' : 'inactive'} `
        + `(${presence.visibleCount}/${presence.totalCount} visible sockets)`
      );

      if (presence.becameOnline) {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('userOnline', { userId });
        return;
      }

      if (presence.becameOffline) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        });
        io.emit('userOffline', { userId, lastSeen });
        return;
      }

      await User.findByIdAndUpdate(userId, {
        isOnline: presence.visibleCount > 0,
      });
    });

    socket.on('sendMessage', async (data) => {
      try {
        const { chatId, content, messageType, replyTo, mediaUrl, isForwarded, location, poll } = data;
        const chat = await Chat.findById(chatId).select('isAIBotChat isGroupChat requestStatus participants');

        if (!chat) {
          throw new Error('Chat not found');
        }

        if (!chat.isGroupChat && !chat.isAIBotChat && ['pending', 'declined'].includes(chat.requestStatus || 'none')) {
          throw new Error(
            chat.requestStatus === 'pending'
              ? 'Wait for the other person to allow this request first'
              : 'This request was removed. Start a new request from search to continue'
          );
        }

        const sanitizedPoll =
          messageType === 'poll' && poll
            ? {
                question: String(poll.question || '').trim(),
                options: (Array.isArray(poll.options) ? poll.options : [])
                  .map((option) => ({ text: String(option?.text || option || '').trim(), votes: [] }))
                  .filter((option) => option.text)
                  .slice(0, 10),
                allowMultiple: Boolean(poll.allowMultiple),
              }
            : null;

        if (messageType === 'poll' && (!sanitizedPoll?.question || sanitizedPoll.options.length < 2)) {
          throw new Error('Polls need a question and at least two options');
        }

        if (messageType === 'poll' && !chat.isGroupChat) {
          throw new Error('Polls are only available in group chats');
        }

        const message = await Message.create({
          senderId: userId,
          chatId,
          content: messageType === 'poll' ? sanitizedPoll.question : content,
          messageType: messageType || 'text',
          replyTo: replyTo || null,
          mediaUrl: mediaUrl || '',
          isForwarded: Boolean(isForwarded),
          status: 'sent',
          location:
            messageType === 'location' && location
              ? {
                  lat: Number(location.lat),
                  lng: Number(location.lng),
                  address: String(location.address || '').trim(),
                }
              : null,
          poll: sanitizedPoll,
        });

        await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

        const populatedMsg = await populateChatMessage(message);

        emitChatMessage(io, populatedMsg, {
          senderId: userId,
          participantIds: chat.participants || [],
        });
        await User.updateMany(
          {
            _id: {
              $in: (chat.participants || []).filter((participantId) => participantId.toString() !== userId),
            },
          },
          {
            $pull: { hiddenChats: chatId },
          }
        );
        await emitHydratedChatToParticipants(io, chatId);

        await notifyOfflineParticipants({
          chatId,
          senderId: userId,
          message: populatedMsg,
        });

        if (shouldTriggerAIResponse(chat, content || '')) {
          const aiMessage = await createAIResponseMessage({
            chatId,
            userId,
            prompt: getAIPrompt(chat, content || ''),
            io,
          });

          await notifyOfflineParticipants({
            chatId,
            senderId: userId,
            message: aiMessage,
          });
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('typing', ({ chatId, userName }) => {
      socket.to(chatId).emit('userTyping', { userId, userName, chatId });
    });

    socket.on('stopTyping', ({ chatId }) => {
      socket.to(chatId).emit('userStopTyping', { userId, chatId });
    });

    socket.on('messageRead', async ({ messageId, chatId }) => {
      if (!userId || !messageId || !chatId) return;

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

    socket.on('addReaction', async ({ messageId, chatId, emoji }) => {
      const msg = await Message.findById(messageId);
      if (!msg || msg.isDeletedForEveryone) return;

      let hasSameReaction = false;

      msg.reactions.forEach((reaction) => {
        const reactedWithEmoji = reaction.emoji === emoji;
        const hasUser = reaction.users.some((entry) => entry.toString() === userId);

        if (hasUser && reactedWithEmoji) {
          hasSameReaction = true;
        }

        reaction.users.pull(userId);
      });

      pruneEmptyReactions(msg);

      if (!hasSameReaction) {
        const existing = msg.reactions.find((reaction) => reaction.emoji === emoji);
        if (existing) {
          existing.users.addToSet(userId);
        } else {
          msg.reactions.push({ emoji, users: [userId] });
        }
      }

      await msg.save();
      io.to(chatId).emit('reactionUpdated', { messageId, reactions: msg.reactions });
    });

    socket.on('removeReaction', async ({ messageId, chatId, emoji }) => {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      msg.reactions.forEach((reaction) => {
        if (!emoji || reaction.emoji === emoji) {
          reaction.users.pull(userId);
        }
      });

      pruneEmptyReactions(msg);
      await msg.save();
      io.to(chatId).emit('reactionUpdated', { messageId, reactions: msg.reactions });
    });

    socket.on('callUser', ({ userToCall, signalData, callType, from, chatId }) => {
      console.log(`Call invite: ${from || userId} -> ${userToCall} (${callType || 'video'})`);
      io.to(userToCall).emit('incomingCall', { signal: signalData, from, callType, chatId });
    });

    socket.on('answerCall', ({ to, signal, chatId }) => {
      console.log(`Call answered: ${userId} -> ${to}`);
      io.to(to).emit('callAccepted', { signal, from: userId, chatId });
    });

    socket.on('declineCall', ({ to, chatId, reason = 'declined' }) => {
      console.log(`Call declined: ${userId} -> ${to} (${reason})`);
      io.to(to).emit('callDeclined', { from: userId, chatId, reason });
    });

    socket.on('endCall', ({ to, chatId, reason = 'ended' }) => {
      console.log(`Call ended: ${userId} -> ${to} (${reason})`);
      io.to(to).emit('callEnded', { from: userId, chatId, reason });
    });

    socket.on('iceCandidate', ({ to, candidate, chatId }) => {
      io.to(to).emit('iceCandidate', { candidate, from: userId, chatId });
    });

    socket.on('startGroupCall', async ({ chatId, callType, participantIds = [] }) => {
      try {
        const groupChat = await Chat.findOne({
          _id: chatId,
          participants: userId,
          isGroupChat: true,
        }).select('participants');

        if (!groupChat) {
          throw new Error('Group chat not found');
        }

        const normalizedChatId = normalizeId(chatId);
        if (activeGroupCalls.has(normalizedChatId)) {
          socket.emit('groupCallBusy', { chatId: normalizedChatId });
          return;
        }

        const invitedParticipants = (Array.isArray(participantIds) ? participantIds : groupChat.participants)
          .map((entry) => normalizeId(entry))
          .filter((entry) => entry && entry !== normalizeId(userId));

        activeGroupCalls.set(normalizedChatId, {
          chatId: normalizedChatId,
          callType: callType === 'video' ? 'video' : 'audio',
          initiatorId: normalizeId(userId),
          participants: new Set([normalizeId(userId)]),
        });

        socket.join(getGroupCallRoom(normalizedChatId));

        invitedParticipants.forEach((participantId) => {
          io.to(participantId).emit('groupCallInvite', {
            chatId: normalizedChatId,
            callType: callType === 'video' ? 'video' : 'audio',
            from: normalizeId(userId),
            initiatorId: normalizeId(userId),
          });
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('joinGroupCall', async ({ chatId }) => {
      try {
        const normalizedChatId = normalizeId(chatId);
        const groupChat = await Chat.findOne({
          _id: chatId,
          participants: userId,
          isGroupChat: true,
        }).select('_id');

        if (!groupChat) {
          throw new Error('Group chat not found');
        }

        const callRecord = activeGroupCalls.get(normalizedChatId);
        if (!callRecord) {
          socket.emit('groupCallEnded', { chatId: normalizedChatId });
          return;
        }

        const normalizedUserId = normalizeId(userId);
        if (callRecord.participants.has(normalizedUserId)) {
          socket.join(getGroupCallRoom(normalizedChatId));
          return;
        }

        const existingParticipants = [...callRecord.participants];
        callRecord.participants.add(normalizedUserId);
        socket.join(getGroupCallRoom(normalizedChatId));

        existingParticipants.forEach((participantId) => {
          io.to(participantId).emit('groupCallPeerJoined', {
            chatId: normalizedChatId,
            participantId: normalizedUserId,
            shouldCreateOffer: true,
            callType: callRecord.callType,
          });

          io.to(normalizedUserId).emit('groupCallPeerJoined', {
            chatId: normalizedChatId,
            participantId,
            shouldCreateOffer: false,
            callType: callRecord.callType,
          });
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('groupCallSignal', ({ chatId, to, description, candidate, callType }) => {
      if (!to) return;

      io.to(to).emit('groupCallSignal', {
        chatId: normalizeId(chatId),
        from: normalizeId(userId),
        description,
        candidate,
        callType,
      });
    });

    socket.on('declineGroupCall', ({ chatId, to }) => {
      if (!to) return;

      io.to(to).emit('groupCallDeclined', {
        chatId: normalizeId(chatId),
        from: normalizeId(userId),
      });
    });

    socket.on('leaveGroupCall', ({ chatId }) => {
      const normalizedChatId = normalizeId(chatId);
      const callRecord = activeGroupCalls.get(normalizedChatId);
      if (!callRecord) return;

      const normalizedUserId = normalizeId(userId);
      socket.leave(getGroupCallRoom(normalizedChatId));

      if (normalizeId(callRecord.initiatorId) === normalizedUserId) {
        io.to(getGroupCallRoom(normalizedChatId)).emit('groupCallEnded', {
          chatId: normalizedChatId,
          from: normalizedUserId,
        });
        activeGroupCalls.delete(normalizedChatId);
        return;
      }

      if (!callRecord.participants.has(normalizedUserId)) return;

      callRecord.participants.delete(normalizedUserId);
      io.to(getGroupCallRoom(normalizedChatId)).emit('groupCallUserLeft', {
        chatId: normalizedChatId,
        participantId: normalizedUserId,
      });

      if (!callRecord.participants.size) {
        activeGroupCalls.delete(normalizedChatId);
      }
    });

    socket.on('endGroupCall', ({ chatId }) => {
      const normalizedChatId = normalizeId(chatId);
      const callRecord = activeGroupCalls.get(normalizedChatId);
      if (!callRecord || normalizeId(callRecord.initiatorId) !== normalizeId(userId)) return;

      socket.to(getGroupCallRoom(normalizedChatId)).emit('groupCallEnded', {
        chatId: normalizedChatId,
        from: normalizeId(userId),
      });
      activeGroupCalls.delete(normalizedChatId);
    });

    socket.on('disconnect', async () => {
      if (userId) {
        removeUserFromGroupCalls(io, userId, socket.id);
        const presence = removeUserSocket(userId, socket.id);
        const nextIsOnline = presence.visibleCount > 0;
        const shouldUpdateLastSeen = presence.becameOffline || (!nextIsOnline && presence.totalCount === 0);
        const lastSeen = shouldUpdateLastSeen ? new Date() : null;

        await User.findByIdAndUpdate(userId, {
          isOnline: nextIsOnline,
          ...(lastSeen ? { lastSeen } : {}),
          $pull: { socketIds: socket.id },
        });

        if (presence.becameOffline && lastSeen) {
          io.emit('userOffline', { userId, lastSeen });
        }
      }

      console.log(`Disconnected: ${socket.id}`);
    });
  });
};
