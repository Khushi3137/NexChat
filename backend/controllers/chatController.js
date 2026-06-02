const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const { notifyOfflineParticipants } = require('../utils/messageNotificationService');
const { populateChatMessage } = require('../utils/aiChatService');
const {
  hasRelationshipWithUser,
  normalizeId,
  sanitizeParticipantForViewer,
} = require('../utils/privacy');
const { isUserCurrentlyOnline } = require('../utils/presenceService');
const resolveChatRequestStatus = (chat) => chat?.requestStatus || 'none';
const resolveChatRequestType = (chat) => chat?.requestType || 'none';
const resolveContactAlias = (aliases, targetUserId) => {
  if (!aliases || !targetUserId) return '';

  const value =
    typeof aliases.get === 'function'
      ? aliases.get(targetUserId)
      : aliases?.[targetUserId];

  return typeof value === 'string' ? value.trim() : '';
};
const resolveViewerContext = (viewerOrAliases) => {
  if (
    viewerOrAliases
    && typeof viewerOrAliases === 'object'
    && (
      Object.prototype.hasOwnProperty.call(viewerOrAliases, 'contactAliases')
      || Object.prototype.hasOwnProperty.call(viewerOrAliases, 'friends')
      || Object.prototype.hasOwnProperty.call(viewerOrAliases, 'contacts')
    )
  ) {
    return viewerOrAliases;
  }

  return {
    contactAliases: viewerOrAliases,
    friends: [],
    contacts: [],
  };
};
const applyLocalNamesToParticipants = (participants, userId, viewerContext) => {
  if (!Array.isArray(participants)) return participants;

  const normalizedUserId = normalizeId(userId);
  const { contactAliases, friends, contacts } = resolveViewerContext(viewerContext);

  return participants.map((participant) => {
    const participantId = normalizeId(participant);
    if (!participantId || typeof participant !== 'object') {
      return participant;
    }

    const localName = participantId === normalizedUserId ? '' : resolveContactAlias(contactAliases, participantId);
    const isFriend = participantId !== normalizedUserId && hasRelationshipWithUser(friends, participantId);
    const isContact = participantId !== normalizedUserId && (isFriend || hasRelationshipWithUser(contacts, participantId));
    const participantWithLivePresence = {
      ...participant,
      isOnline: isUserCurrentlyOnline(participantId),
    };
    const sanitizedParticipant = sanitizeParticipantForViewer(participantWithLivePresence, userId, viewerContext);

    return {
      ...sanitizedParticipant,
      ...(localName ? { localName } : {}),
      isFriend,
      isContact,
    };
  });
};
const isPendingDirectRequest = (chat) =>
  !chat?.isGroupChat && !chat?.isAIBotChat && resolveChatRequestStatus(chat) === 'pending';
const canUserRespondToRequest = (chat, userId) =>
  isPendingDirectRequest(chat) && normalizeId(chat?.requestedBy) !== normalizeId(userId);
const canChatAcceptMessages = (chat) => !['pending', 'declined'].includes(resolveChatRequestStatus(chat));
const isChatMutedForViewer = (chatId, viewerContext) =>
  Array.isArray(viewerContext?.mutedChats)
  && viewerContext.mutedChats.some((entry) => normalizeId(entry) === normalizeId(chatId));
const loadDirectChat = (chatId) =>
  Chat.findById(chatId)
    .populate('participants', '-password')
    .populate('lastMessage');
const loadChatForUser = (chatId, userId) =>
  Chat.findOne({ _id: chatId, participants: userId })
    .populate('participants', '-password')
    .populate('lastMessage')
    .populate('pinnedMessages');

const isMessageHiddenForUser = (message, userId) =>
  Array.isArray(message?.deletedFor) &&
  message.deletedFor.some((entry) => entry?.toString() === userId.toString());

const getLatestVisibleMessage = async (chatId, userId) =>
  Message.findOne({
    chatId,
    deletedFor: { $ne: userId },
    isSent: true,
  }).sort({ createdAt: -1 });

const getLatestScheduledPreview = async (chatId, userId) =>
  Message.findOne({
    chatId,
    senderId: userId,
    deletedFor: { $ne: userId },
    isDeletedForEveryone: false,
    isSent: false,
    scheduledTime: { $ne: null },
  }).sort({ scheduledTime: -1, createdAt: -1 });

const getUnreadCount = async (chatId, userId) =>
  Message.countDocuments({
    chatId,
    $or: [{ senderId: { $ne: userId } }, { messageType: 'ai' }],
    seenBy: { $ne: userId },
    deletedFor: { $ne: userId },
    isDeletedForEveryone: false,
    isSent: true,
  });

const getHasAIActivity = async (chatId, userId) =>
  Boolean(
    await Message.exists({
      chatId,
      deletedFor: { $ne: userId },
      isDeletedForEveryone: false,
      isSent: true,
      $or: [
        { messageType: 'ai' },
        { content: { $regex: /^@ai/i } },
      ],
    })
  );

const hydrateChatForUser = async (chat, userId, viewerContext = null) => {
  const hydratedChat = chat.toObject();
  const requestStatus = resolveChatRequestStatus(chat);
  const requestType = resolveChatRequestType(chat);
  const isCurrentUserRequester = normalizeId(chat?.requestedBy) === normalizeId(userId);

  hydratedChat.participants = applyLocalNamesToParticipants(hydratedChat.participants, userId, viewerContext);

  if (Array.isArray(hydratedChat.pinnedMessages)) {
    hydratedChat.pinnedMessages = hydratedChat.pinnedMessages.filter(
      (message) => message?.isSent !== false && !isMessageHiddenForUser(message, userId)
    );
  }

  if (isMessageHiddenForUser(hydratedChat.lastMessage, userId) || hydratedChat.lastMessage?.isSent === false) {
    hydratedChat.lastMessage = await getLatestVisibleMessage(hydratedChat._id, userId);
  }

  hydratedChat.unreadCount = await getUnreadCount(hydratedChat._id, userId);
  hydratedChat.scheduledPreview = await getLatestScheduledPreview(hydratedChat._id, userId);
  hydratedChat.hasAIActivity =
    hydratedChat.isAIBotChat || (await getHasAIActivity(hydratedChat._id, userId));
  hydratedChat.requestStatus = requestStatus;
  hydratedChat.requestType = requestType;
  hydratedChat.isRequestPending = isPendingDirectRequest(chat);
  hydratedChat.isCurrentUserRequester = isCurrentUserRequester;
  hydratedChat.canCurrentUserRespondToRequest = canUserRespondToRequest(chat, userId);
  hydratedChat.canCurrentUserSendMessages = canChatAcceptMessages(chat);
  hydratedChat.isMuted = isChatMutedForViewer(hydratedChat._id, viewerContext);

  return hydratedChat;
};

exports.hydrateChatForUser = hydrateChatForUser;

const emitHydratedChatToParticipants = async (io, chatId) => {
  if (!io) return;

  const chat = await loadDirectChat(chatId);
  if (!chat) return;

  await Promise.all(
    (chat.participants || []).map(async (participant) => {
      const participantId = normalizeId(participant);
      if (!participantId) return;
      const hydratedChat = await hydrateChatForUser(chat, participantId, participant);
      io.to(participantId).emit('chatUpserted', hydratedChat);
    })
  );
};

exports.emitHydratedChatToParticipants = emitHydratedChatToParticipants;

// POST /api/chats - create or get 1:1 chat
exports.createOrGetChat = async (req, res) => {
  const io = req.app.get('io');
  const { userId } = req.body;
  const requestMode = ['message', 'friend'].includes(req.body.requestMode) ? req.body.requestMode : 'none';
  const initialMessage = req.body.initialMessage?.trim() || '';
  const needsApprovalRequest = requestMode !== 'none';

  if (!userId) {
    return res.status(400).json({ message: 'User is required' });
  }

  if (normalizeId(userId) === normalizeId(req.user.id)) {
    return res.status(400).json({ message: 'You cannot start a chat with yourself' });
  }

  if (needsApprovalRequest && !initialMessage) {
    return res.status(400).json({ message: 'Add a message before sending a request' });
  }

  const otherUser = await User.findById(userId).select('_id blockedUsers');
  if (!otherUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (
    hasRelationshipWithUser(req.user.blockedUsers, userId)
    || hasRelationshipWithUser(otherUser.blockedUsers, req.user.id)
  ) {
    return res.status(403).json({ message: 'This conversation is unavailable because one of you has blocked the other.' });
  }

  let chat = await Chat.findOne({
    isGroupChat: false,
    isAIBotChat: false,
    participants: { $all: [req.user.id, userId] },
  }).populate('participants', '-password').populate('lastMessage');

  if (chat) {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { hiddenChats: chat._id },
    });

    if (needsApprovalRequest && resolveChatRequestStatus(chat) === 'declined') {
      await User.updateMany(
        { _id: { $in: [req.user.id, userId] } },
        { $pull: { hiddenChats: chat._id } }
      );

      chat.requestType = requestMode;
      chat.requestStatus = 'pending';
      chat.requestedBy = req.user.id;
      chat.requestRespondedBy = null;
      chat.requestRespondedAt = null;
      await chat.save();

      const requestMessage = await Message.create({
        senderId: req.user.id,
        chatId: chat._id,
        content: initialMessage,
        messageType: 'text',
      });

      chat.lastMessage = requestMessage._id;
      await chat.save();

      const populatedRequestMessage = await populateChatMessage(requestMessage);
      await notifyOfflineParticipants({
        chatId: chat._id,
        senderId: req.user.id,
        message: populatedRequestMessage,
        notificationType: requestMode === 'friend' ? 'friend_request' : 'message_request',
      });
      await emitHydratedChatToParticipants(io, chat._id);

      const reopenedChat = await loadDirectChat(chat._id);
      return res.json(await hydrateChatForUser(reopenedChat, req.user.id, req.user));
    }

    return res.json(await hydrateChatForUser(chat, req.user.id, req.user));
  }

  chat = await Chat.create({
    participants: [req.user.id, userId],
    isGroupChat: false,
    isAIBotChat: false,
    requestType: needsApprovalRequest ? requestMode : 'none',
    requestStatus: needsApprovalRequest ? 'pending' : 'none',
    requestedBy: needsApprovalRequest ? req.user.id : null,
  });

  if (needsApprovalRequest) {
    await User.updateMany(
      { _id: { $in: [req.user.id, userId] } },
      { $pull: { hiddenChats: chat._id } }
    );

    const requestMessage = await Message.create({
      senderId: req.user.id,
      chatId: chat._id,
      content: initialMessage,
      messageType: 'text',
    });

    chat.lastMessage = requestMessage._id;
    await chat.save();

    const populatedRequestMessage = await populateChatMessage(requestMessage);
    await notifyOfflineParticipants({
      chatId: chat._id,
      senderId: req.user.id,
      message: populatedRequestMessage,
      notificationType: requestMode === 'friend' ? 'friend_request' : 'message_request',
    });
  }

  chat = await loadDirectChat(chat._id);
  await emitHydratedChatToParticipants(io, chat._id);
  res.status(201).json(await hydrateChatForUser(chat, req.user.id, req.user));
};

// POST /api/chats/ai - create or get dedicated AI chat
exports.createOrGetAIChat = async (req, res) => {
  let chat = await Chat.findOne({
    isAIBotChat: true,
    participants: req.user.id,
  })
    .populate('participants', '-password')
    .populate('lastMessage');

  if (chat) {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { hiddenChats: chat._id },
    });
    return res.json(await hydrateChatForUser(chat, req.user.id, req.user));
  }

  chat = await Chat.create({
    chatName: 'AI Bot',
    participants: [req.user.id],
    isGroupChat: false,
    isAIBotChat: true,
  });

  chat = await chat.populate('participants', '-password');
  res.status(201).json({
    ...chat.toObject(),
    unreadCount: 0,
    scheduledPreview: null,
    hasAIActivity: true,
    isMuted: false,
  });
};

// GET /api/chats - get all chats for a user
exports.getUserChats = async (req, res) => {
  const hiddenChatIds = Array.isArray(req.user.hiddenChats) ? req.user.hiddenChats : [];
  const chats = await Chat.find({
    participants: req.user.id,
    ...(hiddenChatIds.length ? { _id: { $nin: hiddenChatIds } } : {}),
  })
    .populate('participants', '-password')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  const hydratedChats = await Promise.all(
    chats.map((chat) => hydrateChatForUser(chat, req.user.id, req.user))
  );

  res.json(hydratedChats);
};

// GET /api/chats/:id
exports.getChatById = async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, participants: req.user.id })
    .populate('participants', '-password')
    .populate('lastMessage')
    .populate('pinnedMessages');
  if (!chat || req.user.hiddenChats?.some((chatId) => normalizeId(chatId) === normalizeId(req.params.id))) {
    return res.status(404).json({ message: 'Chat not found' });
  }
  res.json(await hydrateChatForUser(chat, req.user.id, req.user));
};

// PUT /api/chats/:id/request
exports.respondToChatRequest = async (req, res) => {
  const io = req.app.get('io');
  const action = req.body.action === 'decline' ? 'decline' : req.body.action === 'accept' ? 'accept' : null;

  if (!action) {
    return res.status(400).json({ message: 'Invalid request action' });
  }

  let chat = await Chat.findOne({
    _id: req.params.id,
    participants: req.user.id,
    isGroupChat: false,
    isAIBotChat: false,
  }).populate('participants', '-password').populate('lastMessage');

  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  if (!canUserRespondToRequest(chat, req.user.id)) {
    return res.status(400).json({ message: 'There is no pending request for you to manage' });
  }

  chat.requestStatus = action === 'accept' ? 'accepted' : 'declined';
  chat.requestRespondedBy = req.user.id;
  chat.requestRespondedAt = new Date();
  await chat.save();

  if (action === 'accept' && resolveChatRequestType(chat) === 'friend') {
    const otherParticipantId = normalizeId(
      chat.participants.find((participant) => normalizeId(participant) !== normalizeId(req.user.id))
    );

    if (otherParticipantId) {
      await Promise.all([
        User.findByIdAndUpdate(req.user.id, {
          $addToSet: { friends: otherParticipantId },
        }),
        User.findByIdAndUpdate(otherParticipantId, {
          $addToSet: { friends: req.user.id },
        }),
      ]);
    }
  }

  await emitHydratedChatToParticipants(io, chat._id);
  chat = await loadDirectChat(chat._id);
  res.json(await hydrateChatForUser(chat, req.user.id, req.user));
};

// PUT /api/chats/:id/mute
exports.muteChat = async (req, res) => {
  const chat = await loadChatForUser(req.params.id, req.user.id);

  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { mutedChats: chat._id },
  });

  const viewer = await User.findById(req.user.id).select('-password -passwordResetToken -passwordResetExpires');

  res.json({
    message: 'Chat muted',
    isMuted: true,
    chat: await hydrateChatForUser(chat, req.user.id, viewer),
  });
};

// DELETE /api/chats/:id/mute
exports.unmuteChat = async (req, res) => {
  const chat = await loadChatForUser(req.params.id, req.user.id);

  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  await User.findByIdAndUpdate(req.user.id, {
    $pull: { mutedChats: chat._id },
  });

  const viewer = await User.findById(req.user.id).select('-password -passwordResetToken -passwordResetExpires');

  res.json({
    message: 'Chat unmuted',
    isMuted: false,
    chat: await hydrateChatForUser(chat, req.user.id, viewer),
  });
};

// DELETE /api/chats/:id
exports.deleteChat = async (req, res) => {
  const io = req.app.get('io');
  const chat = await Chat.findOne({
    _id: req.params.id,
    participants: req.user.id,
    isGroupChat: false,
  }).select('_id isAIBotChat');

  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  await Promise.all([
    Message.updateMany(
      {
        chatId: chat._id,
        deletedFor: { $ne: req.user.id },
      },
      {
        $addToSet: { deletedFor: req.user.id },
      }
    ),
    User.findByIdAndUpdate(req.user.id, {
      $addToSet: { hiddenChats: chat._id },
    }),
  ]);

  io?.to(req.user.id.toString()).emit('chatRemoved', {
    chatId: chat._id.toString(),
  });

  res.json({
    message: chat.isAIBotChat ? 'AI chat deleted' : 'Chat deleted',
    chatId: chat._id.toString(),
  });
};
