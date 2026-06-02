const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { getAIResponse } = require('./aiService');

const AI_TRIGGER_REGEX = /^@ai\b[:,-]?\s*/i;
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const populateChatMessage = async (message) =>
  message.populate([
    { path: 'senderId', select: 'name profilePicture' },
    { path: 'replyTo', select: 'content senderId mediaUrl messageType isDeletedForEveryone deletedFor location poll call' },
  ]);

const emitChatMessage = (io, message, options = {}) => {
  if (!io || !message) return;

  const senderId = normalizeId(options.senderId || options);
  const participantIds = Array.isArray(options.participantIds)
    ? options.participantIds.map(normalizeId).filter(Boolean)
    : [];
  const targetRooms = [
    normalizeId(message.chatId),
    senderId,
    ...participantIds,
  ].filter(Boolean);

  io.to([...new Set(targetRooms)]).emit('receiveMessage', message);
};

const isAITriggerMessage = (content = '') => AI_TRIGGER_REGEX.test(content.trim());

const shouldTriggerAIResponse = (chat, content = '') =>
  Boolean(chat?.isAIBotChat || isAITriggerMessage(content));

const getAIPrompt = (chat, content = '') => {
  const normalizedContent = content.trim();

  if (chat?.isAIBotChat) {
    return normalizedContent || 'Please respond to the latest message in this conversation.';
  }

  return (
    normalizedContent.replace(AI_TRIGGER_REGEX, '').trim() ||
    'Please respond to the latest message in this conversation.'
  );
};

const createAIResponseMessage = async ({ chatId, userId, prompt, io }) => {
  const aiResponse = await getAIResponse(prompt, chatId);
  const aiMessage = await Message.create({
    senderId: userId,
    chatId,
    content: aiResponse,
    messageType: 'ai',
    status: 'sent',
  });

  await Chat.findByIdAndUpdate(chatId, { lastMessage: aiMessage._id });

  const populatedAIMessage = await populateChatMessage(aiMessage);
  const chat = await Chat.findById(chatId).select('participants');
  emitChatMessage(io, populatedAIMessage, {
    senderId: userId,
    participantIds: chat?.participants || [],
  });
  return populatedAIMessage;
};

module.exports = {
  createAIResponseMessage,
  emitChatMessage,
  getAIPrompt,
  isAITriggerMessage,
  populateChatMessage,
  shouldTriggerAIResponse,
};
