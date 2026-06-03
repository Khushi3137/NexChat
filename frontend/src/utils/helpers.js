const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

export const getContactAlias = (contactAliases, targetUserId) => {
  const normalizedTargetUserId = normalizeId(targetUserId);
  if (!contactAliases || !normalizedTargetUserId) return '';

  const value =
    typeof contactAliases.get === 'function'
      ? contactAliases.get(normalizedTargetUserId)
      : contactAliases[normalizedTargetUserId];

  return typeof value === 'string' ? value.trim() : '';
};

export const applyContactAliasesToChat = (chat, user) => {
  if (!chat || !Array.isArray(chat.participants)) return chat;

  const currentUserId = normalizeId(user?._id);
  let didChange = false;
  const participants = chat.participants.map((participant) => {
    const participantId = normalizeId(participant);

    if (!participantId || participantId === currentUserId || !participant || typeof participant !== 'object') {
      return participant;
    }

    const localName = getContactAlias(user?.contactAliases, participantId);
    if (!localName || participant.localName === localName) {
      return participant;
    }

    didChange = true;
    return {
      ...participant,
      localName,
    };
  });

  return didChange ? { ...chat, participants } : chat;
};

export const applyContactAliasesToChats = (chats, user) =>
  Array.isArray(chats) ? chats.map((chat) => applyContactAliasesToChat(chat, user)) : [];

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
