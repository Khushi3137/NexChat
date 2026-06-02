import api from './api';

export const authService = {
  signup: async (name, email, password) => {
    const { data } = await api.post('/auth/signup', { name, email, password });
    return data;
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },
  forgotPassword: async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },
  resetPassword: async (token, password) => {
    const { data } = await api.post(`/auth/reset-password/${token}`, { password });
    return data;
  },
};
