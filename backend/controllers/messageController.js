const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { notifyOfflineParticipants } = require('../utils/messageNotificationService');
const { emitHydratedChatToParticipants } = require('./chatController');
const { hasRelationshipWithUser } = require('../utils/privacy');
const {
  createAIResponseMessage,
  emitChatMessage,
  getAIPrompt,
  isAITriggerMessage,
  populateChatMessage,
  shouldTriggerAIResponse,
} = require('../utils/aiChatService');

const MAX_SCHEDULE_WINDOW_MS = 24 * 60 * 60 * 1000;
const resolveChatRequestStatus = (chat) => chat?.requestStatus || 'none';
const buildReplySelect = 'content senderId mediaUrl messageType isDeletedForEveryone deletedFor location poll call';
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const isMessageHiddenForUser = (message, userId) =>
  Array.isArray(message?.deletedFor) &&
  message.deletedFor.some((entry) => entry?.toString() === userId.toString());

const sanitizePollPayload = (poll) => {
  if (!poll || typeof poll !== 'object') return null;

  const question = String(poll.question || '').trim();
  const options = Array.isArray(poll.options)
    ? poll.options
        .map((option) => String(option?.text || option || '').trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (!question || options.length < 2) return null;

  return {
    question,
    options: options.map((text) => ({ text, votes: [] })),
    allowMultiple: Boolean(poll.allowMultiple),
  };
};
const parseOptionalDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const formatCallDuration = (value = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && !minutes) parts.push(`${seconds}s`);

  return parts.join(' ');
};
const buildCallMessageContent = (call) => {
  const callPrefix = call?.scope === 'group' ? 'Group ' : '';
  const callLabel = `${callPrefix}${call?.callType === 'video' ? 'Video call' : 'Voice call'}`;
  const durationSeconds = Math.max(0, Math.round(Number(call?.durationSeconds) || 0));
  const joinedCount = Math.max(0, Math.round(Number(call?.joinedCount) || 0));

  if (call?.status === 'declined') {
    return `${callLabel} - Declined`;
  }

  if (call?.status === 'missed') {
    return call?.scope === 'group' ? `${callLabel} - No one joined` : `${callLabel} - No answer`;
  }

  if (durationSeconds > 0 && call?.scope === 'group' && joinedCount > 0) {
    return `${callLabel} - ${formatCallDuration(durationSeconds)} - ${joinedCount} joined`;
  }

  return durationSeconds > 0 ? `${callLabel} - ${formatCallDuration(durationSeconds)}` : `${callLabel} - Completed`;
};
const getDirectChatPeerId = (chat, currentUserId) =>
  (chat?.participants || []).find((participantId) => normalizeId(participantId) !== normalizeId(currentUserId)) || null;
const sanitizeCallPayload = (call, fallbackInitiatorId, fallbackReceiverId) => {
  if (!call || typeof call !== 'object') return null;

  const callType = call.callType === 'video' ? 'video' : call.callType === 'audio' ? 'audio' : '';
  const scope = call.scope === 'group' ? 'group' : 'direct';
  const status = ['completed', 'missed', 'declined'].includes(call.status) ? call.status : '';

  if (!callType || !status) return null;

  return {
    callType,
    scope,
    status,
    durationSeconds: Math.max(0, Math.round(Number(call.durationSeconds) || 0)),
    startedAt: parseOptionalDate(call.startedAt),
    answeredAt: parseOptionalDate(call.answeredAt),
    endedAt: parseOptionalDate(call.endedAt),
    initiatedBy: call.initiatedBy || fallbackInitiatorId,
    receiverId: scope === 'direct' ? (call.receiverId || fallbackReceiverId) : null,
    participantIds:
      scope === 'group'
        ? (Array.isArray(call.participantIds) ? call.participantIds : []).map((entry) => normalizeId(entry)).filter(Boolean)
        : [],
    joinedCount:
      scope === 'group'
        ? Math.max(0, Math.round(Number(call.joinedCount) || 0))
        : 0,
  };
};

const sanitizeReplyPreview = (replyTo, userId) => {
  if (!replyTo) return null;

  if (replyTo.isDeletedForEveryone || isMessageHiddenForUser(replyTo, userId)) {
    return {
      _id: replyTo._id,
      senderId: replyTo.senderId,
      content: '',
      mediaUrl: '',
      messageType: replyTo.messageType || 'text',
      isDeletedForEveryone: true,
    };
  }

  return replyTo;
};

const hydrateMessageForUser = (message, userId) => ({
  ...message,
  replyTo: sanitizeReplyPreview(message.replyTo, userId),
});
const buildVisibleMessagesQuery = (chatId, userId) => ({
  chatId,
  deletedFor: { $ne: userId },
  isSent: true,
});
const buildUnreadMessagesQuery = (chatId, userId) => ({
  ...buildVisibleMessagesQuery(chatId, userId),
  isDeletedForEveryone: false,
  $or: [{ senderId: { $ne: userId } }, { messageType: 'ai' }],
  seenBy: { $ne: userId },
});

// GET /api/messages/:chatId
exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 50, entry = '', contextBefore = 12 } = req.query;
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const normalizedContextBefore = Math.max(0, Math.min(40, Number(contextBefore) || 12));
  const visibleMessagesQuery = buildVisibleMessagesQuery(chatId, req.user.id);

  if (entry === 'first_unread') {
    const firstUnreadMessage = await Message.findOne(buildUnreadMessagesQuery(chatId, req.user.id))
      .select('_id createdAt')
      .sort({ createdAt: 1, _id: 1 });

    if (!firstUnreadMessage) {
      const messages = await Message.find(visibleMessagesQuery)
        .populate('senderId', 'name profilePicture')
        .populate('replyTo', buildReplySelect)
        .sort({ createdAt: -1 })
        .limit(normalizedLimit);

      return res.json({
        messages: messages
          .map((message) => hydrateMessageForUser(message.toObject(), req.user.id))
          .reverse(),
        entryMessageId: null,
      });
    }

    const visibleMessagesBeforeFirstUnread = await Message.countDocuments({
      ...visibleMessagesQuery,
      createdAt: { $lt: firstUnreadMessage.createdAt },
    });
    const sliceStart = Math.max(0, visibleMessagesBeforeFirstUnread - normalizedContextBefore);

    const messages = await Message.find(visibleMessagesQuery)
      .populate('senderId', 'name profilePicture')
      .populate('replyTo', buildReplySelect)
      .sort({ createdAt: 1, _id: 1 })
      .skip(sliceStart)
      .limit(normalizedLimit);

    return res.json({
      messages: messages.map((message) => hydrateMessageForUser(message.toObject(), req.user.id)),
      entryMessageId: firstUnreadMessage._id.toString(),
    });
  }

  const messages = await Message.find(visibleMessagesQuery)
    .populate('senderId', 'name profilePicture')
    .populate('replyTo', buildReplySelect)
    .sort({ createdAt: -1 })
    .skip((page - 1) * normalizedLimit)
    .limit(normalizedLimit);

  res.json(messages.map((message) => hydrateMessageForUser(message.toObject(), req.user.id)).reverse());
};

// GET /api/messages/scheduled/:chatId
exports.getScheduledMessages = async (req, res) => {
  const { chatId } = req.params;

  const messages = await Message.find({
    chatId,
    senderId: req.user.id,
    deletedFor: { $ne: req.user.id },
    isDeletedForEveryone: false,
    isSent: false,
    scheduledTime: { $ne: null },
  })
    .populate('senderId', 'name profilePicture')
    .populate('replyTo', buildReplySelect)
    .sort({ scheduledTime: 1, createdAt: 1 });

  res.json(messages.map((message) => hydrateMessageForUser(message.toObject(), req.user.id)));
};

// DELETE /api/messages/scheduled/:id
exports.cancelScheduledMessage = async (req, res) => {
  const message = await Message.findOneAndDelete({
    _id: req.params.id,
    senderId: req.user.id,
    isSent: false,
    isDeletedForEveryone: false,
    scheduledTime: { $ne: null },
  });

  if (!message) {
    return res.status(404).json({ message: 'Scheduled message not found or already sent' });
  }

  await Chat.findByIdAndUpdate(message.chatId, {
    $pull: { pinnedMessages: message._id },
  });

  res.json({
    message: 'Scheduled message removed',
    canceledScheduledMessageId: message._id.toString(),
  });
};

// DELETE /api/messages/chat/:chatId
exports.clearChatMessages = async (req, res) => {
  const chat = await Chat.findOne({
    _id: req.params.chatId,
    participants: req.user.id,
  });

  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  if (chat.isAIBotChat) {
    const result = await Message.deleteMany({ chatId: req.params.chatId });

    await Chat.findByIdAndUpdate(req.params.chatId, {
      lastMessage: null,
      pinnedMessages: [],
    });

    return res.json({
      message: 'AI chat cleared',
      chatId: req.params.chatId,
      clearedCount: result.deletedCount || 0,
    });
  }

  const result = await Message.updateMany(
    {
      chatId: req.params.chatId,
      deletedFor: { $ne: req.user.id },
    },
    {
      $addToSet: { deletedFor: req.user.id },
    }
  );

  res.json({
    message: 'Chat cleared',
    chatId: req.params.chatId,
    clearedCount: result.modifiedCount || 0,
  });
};

// POST /api/messages
exports.sendMessage = async (req, res) => {
  const io = req.app.get('io');
  const { chatId, content, messageType, replyTo, mediaUrl, scheduledTime, isForwarded, location, poll, call } = req.body;
  const normalizedContent = content || '';
  const scheduleDate = scheduledTime ? new Date(scheduledTime) : null;
  const now = new Date();
  const chat = await Chat.findOne({ _id: chatId, participants: req.user.id }).select(
    'isAIBotChat isGroupChat requestStatus requestedBy participants'
  );
  const sanitizedPoll = messageType === 'poll' ? sanitizePollPayload(poll) : null;
  const directChatPeerId = getDirectChatPeerId(chat, req.user.id);
  const sanitizedCall = messageType === 'call' ? sanitizeCallPayload(call, req.user.id, directChatPeerId) : null;
  const sanitizedLocation =
    messageType === 'location' && location
      ? {
          lat: Number(location.lat),
          lng: Number(location.lng),
          address: String(location.address || '').trim(),
        }
      : null;

  if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
  }

  if (!chat.isGroupChat && !chat.isAIBotChat) {
    const requestStatus = resolveChatRequestStatus(chat);

    if (requestStatus === 'pending') {
      return res.status(403).json({ message: 'Wait for the other person to allow this request first' });
    }

    if (requestStatus === 'declined') {
      return res.status(403).json({ message: 'This request was removed. Send a new request from search to continue' });
    }

    const peerUser = directChatPeerId
      ? await User.findById(directChatPeerId).select('blockedUsers')
      : null;

    if (
      hasRelationshipWithUser(req.user.blockedUsers, directChatPeerId)
      || hasRelationshipWithUser(peerUser?.blockedUsers, req.user.id)
    ) {
      return res.status(403).json({ message: 'This conversation is unavailable because one of you has blocked the other.' });
    }
  }

  if (scheduleDate && Number.isNaN(scheduleDate.getTime())) {
    return res.status(400).json({ message: 'Invalid scheduled time' });
  }

  if (messageType === 'poll' && !sanitizedPoll) {
    return res.status(400).json({ message: 'Polls need a question and at least two options' });
  }

  if (messageType === 'poll' && !chat.isGroupChat) {
    return res.status(400).json({ message: 'Polls are only available in group chats' });
  }

  if (messageType === 'call' && chat.isAIBotChat) {
    return res.status(400).json({ message: 'Call logs are not available in AI chats' });
  }

  if (messageType === 'call' && !sanitizedCall) {
    return res.status(400).json({ message: 'A valid call summary is required' });
  }

  if (messageType === 'call' && chat.isGroupChat && sanitizedCall?.scope !== 'group') {
    return res.status(400).json({ message: 'Group call summaries must use the group call format' });
  }

  if (messageType === 'call' && !chat.isGroupChat && sanitizedCall?.scope === 'group') {
    return res.status(400).json({ message: 'Group call summaries are only available in group chats' });
  }

  if (
    messageType === 'location' &&
    (!sanitizedLocation || Number.isNaN(sanitizedLocation.lat) || Number.isNaN(sanitizedLocation.lng))
  ) {
    return res.status(400).json({ message: 'A valid location is required' });
  }

  if (scheduleDate && scheduleDate <= now) {
    return res.status(400).json({ message: 'Scheduled time must be in the future' });
  }

  if (scheduleDate && scheduleDate.getTime() - now.getTime() > MAX_SCHEDULE_WINDOW_MS) {
    return res.status(400).json({ message: 'You can only schedule messages within the next 24 hours' });
  }

  if (scheduleDate && (chat.isAIBotChat || isAITriggerMessage(normalizedContent))) {
    return res.status(400).json({ message: 'AI messages cannot be scheduled yet' });
  }

  if (scheduleDate && messageType === 'call') {
    return res.status(400).json({ message: 'Call logs cannot be scheduled' });
  }

  const message = await Message.create({
    senderId: req.user.id,
    chatId,
    content:
      messageType === 'poll'
        ? sanitizedPoll.question
        : messageType === 'call'
          ? buildCallMessageContent(sanitizedCall)
          : normalizedContent,
    messageType: messageType || 'text',
    replyTo: replyTo || null,
    mediaUrl: mediaUrl || '',
    isForwarded: Boolean(isForwarded),
    scheduledTime: scheduleDate,
    isSent: !scheduleDate,
    location: sanitizedLocation,
    poll: sanitizedPoll,
    call: sanitizedCall,
  });

  if (!scheduleDate) {
    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });
  }

  const populated = await populateChatMessage(message);

  if (!scheduleDate) {
    emitChatMessage(io, populated, {
      senderId: req.user.id,
      participantIds: chat.participants || [],
    });
    await User.updateMany(
      {
        _id: {
          $in: (chat.participants || []).filter((participantId) => normalizeId(participantId) !== normalizeId(req.user.id)),
        },
      },
      {
        $pull: { hiddenChats: chatId },
      }
    );
    await emitHydratedChatToParticipants(io, chatId);
    if (message.messageType !== 'call') {
      await notifyOfflineParticipants({
        chatId,
        senderId: req.user.id,
        message: populated,
      });
    }
  }

  if (!scheduleDate && shouldTriggerAIResponse(chat, normalizedContent)) {
    const aiMessage = await createAIResponseMessage({
      chatId,
      userId: req.user.id,
      prompt: getAIPrompt(chat, normalizedContent),
      io,
    });

    await notifyOfflineParticipants({
      chatId,
      senderId: req.user.id,
      message: aiMessage,
    });

    return res.status(201).json({ message: populated, aiMessage });
  }

  res.status(201).json({ message: populated });
};

// PUT /api/messages/:id (edit)
exports.editMessage = async (req, res) => {
  const io = req.app.get('io');
  const message = await Message.findOne({
    _id: req.params.id,
    senderId: req.user.id,
    isDeletedForEveryone: false,
  });

  if (!message) return res.status(404).json({ message: 'Message not found' });

  if (message.messageType === 'call') {
    return res.status(400).json({ message: 'Call logs cannot be edited' });
  }

  const rawContent = typeof req.body.content === 'string' ? req.body.content : '';
  const trimmedContent = rawContent.trim();
  const allowsEmptyContent = Boolean(message.mediaUrl) || message.messageType === 'location';

  if (message.messageType === 'poll' && !trimmedContent) {
    return res.status(400).json({ message: 'Poll question cannot be empty' });
  }

  if (!trimmedContent && !allowsEmptyContent && message.messageType !== 'poll') {
    return res.status(400).json({ message: 'Message cannot be empty' });
  }

  message.content = allowsEmptyContent ? rawContent : trimmedContent;

  if (message.messageType === 'poll' && message.poll) {
    message.poll.question = trimmedContent;
  }

  const shouldBroadcastEdit = message.isSent || !message.scheduledTime;

  if (shouldBroadcastEdit) {
    message.isEdited = true;
  }

  await message.save();

  const populatedMessage = await populateChatMessage(message);
  const payload = populatedMessage.toObject();

  if (shouldBroadcastEdit) {
    io?.to(message.chatId.toString()).emit('messageEdited', { message: payload });
    io?.to(req.user.id.toString()).emit('messageEdited', { message: payload });
    await notifyOfflineParticipants({
      chatId: message.chatId,
      senderId: req.user.id,
      message: populatedMessage,
      notificationType: 'message_edit',
    });
  }

  res.json(hydrateMessageForUser(payload, req.user.id));
};

// DELETE /api/messages/:id
exports.deleteMessage = async (req, res) => {
  const scope = req.query.scope === 'everyone' ? 'everyone' : 'me';
  const io = req.app.get('io');

  if (scope === 'everyone') {
    const deletedMessage = await Message.findOneAndUpdate(
      { _id: req.params.id, senderId: req.user.id, isDeletedForEveryone: false },
      {
        content: '',
        mediaUrl: '',
        mediaType: '',
        messageType: 'text',
        replyTo: null,
        reactions: [],
        isEdited: false,
        isPinned: false,
        isDeletedForEveryone: true,
        deletedAt: new Date(),
        deletedBy: req.user.id,
      },
      { new: true }
    )
      .populate('senderId', 'name profilePicture')
      .populate('replyTo', buildReplySelect);

    if (!deletedMessage) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await Chat.findByIdAndUpdate(deletedMessage.chatId, {
      $pull: { pinnedMessages: deletedMessage._id },
    });

    const payload = hydrateMessageForUser(deletedMessage.toObject(), req.user.id);
    io?.to(deletedMessage.chatId.toString()).emit('messageDeletedForEveryone', { message: payload });

    return res.json({
      message: 'Deleted for everyone',
      scope,
      deletedMessage: payload,
    });
  }

  const message = await Message.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  if (!isMessageHiddenForUser(message, req.user.id)) {
    message.deletedFor.addToSet(req.user.id);
    await message.save();
  }

  io?.to(req.user.id.toString()).emit('messageDeletedForMe', {
    messageId: message._id.toString(),
    chatId: message.chatId.toString(),
  });

  res.json({
    message: 'Deleted for you',
    scope,
    deletedMessageId: message._id.toString(),
  });
};

// GET /api/messages/search?q=keyword&chatId=xxx
exports.searchMessages = async (req, res) => {
  const { q, chatId } = req.query;
  const messages = await Message.find({
    chatId,
    deletedFor: { $ne: req.user.id },
    isDeletedForEveryone: false,
    isSent: true,
    $text: { $search: q },
  }).populate('senderId', 'name profilePicture');
  res.json(messages);
};

// PUT /api/messages/:id/pin
exports.pinMessage = async (req, res) => {
  const message = await Message.findOneAndUpdate(
    {
      _id: req.params.id,
      deletedFor: { $ne: req.user.id },
      isDeletedForEveryone: false,
      isSent: true,
    },
    { isPinned: true },
    { new: true }
  );
  if (!message) return res.status(404).json({ message: 'Message not found' });
  await Chat.findByIdAndUpdate(message.chatId, {
    $addToSet: { pinnedMessages: message._id }
  });
  res.json(message);
};

exports.unpinMessage = async (req, res) => {
  const message = await Message.findOneAndUpdate(
    {
      _id: req.params.id,
      deletedFor: { $ne: req.user.id },
      isDeletedForEveryone: false,
      isSent: true,
    },
    { isPinned: false },
    { new: true }
  );

  if (!message) return res.status(404).json({ message: 'Message not found' });

  await Chat.findByIdAndUpdate(message.chatId, {
    $pull: { pinnedMessages: message._id },
  });

  res.json(message);
};

// PUT /api/messages/:id/poll-vote
exports.votePoll = async (req, res) => {
  const io = req.app.get('io');
  const { optionId } = req.body;

  const message = await Message.findOne({
    _id: req.params.id,
    messageType: 'poll',
    isDeletedForEveryone: false,
    deletedFor: { $ne: req.user.id },
  })
    .populate('senderId', 'name profilePicture')
    .populate('replyTo', buildReplySelect);

  if (!message) {
    return res.status(404).json({ message: 'Poll not found' });
  }

  const chat = await Chat.findOne({
    _id: message.chatId,
    participants: req.user.id,
  }).select('_id');

  if (!chat) {
    return res.status(403).json({ message: 'You cannot vote in this poll' });
  }

  const targetOption = message.poll?.options?.id(optionId);
  if (!targetOption) {
    return res.status(404).json({ message: 'Poll option not found' });
  }

  message.poll.options.forEach((option) => {
    option.votes = option.votes.filter((entry) => normalizeId(entry) !== normalizeId(req.user.id));
  });
  targetOption.votes.push(req.user.id);

  await message.save();

  const hydratedMessage = hydrateMessageForUser(message.toObject(), req.user.id);
  io?.to(message.chatId.toString()).emit('pollUpdated', { message: hydratedMessage });
  io?.to(req.user.id.toString()).emit('pollUpdated', { message: hydratedMessage });

  res.json(hydratedMessage);
};
