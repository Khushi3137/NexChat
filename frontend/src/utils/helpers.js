const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

export const getOtherParticipant = (chat, userId) => {
  if (chat?.isAIBotChat) return null;
  return chat?.participants?.find((participant) => normalizeId(participant) !== normalizeId(userId));
};

export const getChatName = (chat, userId) => {
  if (chat?.isAIBotChat) return chat.chatName || 'AI Bot';
  if (chat.isGroupChat) return chat.chatName;
  const other = getOtherParticipant(chat, userId);
  return other?.localName || other?.name || 'Unknown';
};

export const getChatAvatar = (chat, userId) => {
  if (chat?.isAIBotChat) return '';
  if (chat.isGroupChat) return chat.groupPicture;
  const other = getOtherParticipant(chat, userId);
  return other?.profilePicture || '';
};

export const truncate = (str, n = 40) => {
  return str?.length > n ? str.slice(0, n) + '...' : str;
};
