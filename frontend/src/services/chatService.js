import api from './api';

export const chatService = {
  createOrGet: async (userId, options = {}) => {
    const { data } = await api.post('/chats', {
      userId,
      ...options,
    });
    return data;
  },
  createOrGetAIChat: async () => {
    const { data } = await api.post('/chats/ai');
    return data;
  },
  getUserChats: async () => {
    const { data } = await api.get('/chats');
    return data;
  },
  getChatById: async (id) => {
    const { data } = await api.get(`/chats/${id}`);
    return data;
  },
  muteChat: async (id) => {
    const { data } = await api.put(`/chats/${id}/mute`);
    return data;
  },
  unmuteChat: async (id) => {
    const { data } = await api.delete(`/chats/${id}/mute`);
    return data;
  },
  respondToRequest: async (chatId, action) => {
    const { data } = await api.put(`/chats/${chatId}/request`, { action });
    return data;
  },
  getMessages: async (chatId, page = 1, limit = 50) => {
    const { data } = await api.get(`/messages/${chatId}?page=${page}&limit=${limit}`);
    return data;
  },
  getMessagesFromFirstUnread: async (chatId, options = {}) => {
    const {
      limit = 50,
      contextBefore = 12,
    } = options;
    const { data } = await api.get(
      `/messages/${chatId}?entry=first_unread&limit=${limit}&contextBefore=${contextBefore}`
    );
    return data;
  },
  getScheduledMessages: async (chatId) => {
    const { data } = await api.get(`/messages/scheduled/${chatId}`);
    return data;
  },
  cancelScheduledMessage: async (id) => {
    const { data } = await api.delete(`/messages/scheduled/${id}`);
    return data;
  },
  clearChat: async (chatId) => {
    const { data } = await api.delete(`/messages/chat/${chatId}`);
    return data;
  },
  deleteChat: async (chatId) => {
    const { data } = await api.delete(`/chats/${chatId}`);
    return data;
  },
  leaveGroup: async (chatId) => {
    const { data } = await api.put(`/groups/${chatId}/leave`);
    return data;
  },
  deleteGroup: async (chatId) => {
    const { data } = await api.delete(`/groups/${chatId}`);
    return data;
  },
  sendMessage: async (payload) => {
    const { data } = await api.post('/messages', payload);
    return data;
  },
  editMessage: async (id, content) => {
    const { data } = await api.put(`/messages/${id}`, { content });
    return data;
  },
  deleteMessage: async (id, scope = 'me') => {
    const { data } = await api.delete(`/messages/${id}?scope=${scope}`);
    return data;
  },
  pinMessage: async (id) => {
    const { data } = await api.put(`/messages/${id}/pin`);
    return data;
  },
  unpinMessage: async (id) => {
    const { data } = await api.put(`/messages/${id}/unpin`);
    return data;
  },
  votePoll: async (id, optionId) => {
    const { data } = await api.put(`/messages/${id}/poll-vote`, { optionId });
    return data;
  },
  searchMessages: async (chatId, q) => {
    const { data } = await api.get(`/messages/search?chatId=${chatId}&q=${q}`);
    return data;
  },
};
