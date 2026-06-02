import api from './api';

export const userService = {
  getAnalytics: async () => {
    const { data } = await api.get('/users/analytics');
    return data;
  },
  updateNotificationPreferences: async (notificationPreferences) => {
    const { data } = await api.put('/users/notifications', { notificationPreferences });
    return data;
  },
  updatePrivacySettings: async (privacySettings) => {
    const { data } = await api.put('/users/privacy', { privacySettings });
    return data;
  },
  getBlockedUsers: async () => {
    const { data } = await api.get('/users/blocked');
    return data;
  },
  updateContactAlias: async (userId, alias) => {
    const { data } = await api.put(`/users/contact-alias/${userId}`, { alias });
    return data;
  },
  addContact: async (userId) => {
    const { data } = await api.put(`/users/contact/${userId}`);
    return data;
  },
  blockUser: async (userId) => {
    const { data } = await api.put(`/users/block/${userId}`);
    return data;
  },
  unblockUser: async (userId) => {
    const { data } = await api.delete(`/users/block/${userId}`);
    return data;
  },
};
