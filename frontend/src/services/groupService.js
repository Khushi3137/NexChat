import api from './api';

export const groupService = {
  addMember: async (chatId, userId) => {
    const { data } = await api.put(`/groups/${chatId}/add`, { userId });
    return data;
  },
  getPendingInvites: async () => {
    const { data } = await api.get('/groups/invites');
    return data;
  },
  respondToInvite: async (inviteId, action) => {
    const { data } = await api.put(`/groups/invites/${inviteId}/respond`, { action });
    return data;
  },
};
