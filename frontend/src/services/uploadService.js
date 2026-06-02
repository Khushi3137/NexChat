import api from './api';

export const uploadService = {
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post('/users/upload-avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  removeAvatar: async () => {
    const { data } = await api.delete('/users/avatar');
    return data;
  },
};
