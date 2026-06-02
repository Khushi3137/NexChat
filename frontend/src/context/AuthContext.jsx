import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('nexus_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('nexus_token'));
  const [loading, setLoading] = useState(false);

  const updateUser = (nextUser) => {
    setUser((previous) => {
      const resolvedUser =
        typeof nextUser === 'function'
          ? nextUser(previous)
          : previous
            ? { ...previous, ...nextUser }
            : nextUser;

      if (resolvedUser) {
        localStorage.setItem('nexus_user', JSON.stringify(resolvedUser));
      } else {
        localStorage.removeItem('nexus_user');
      }

      return resolvedUser;
    });
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('nexus_user', JSON.stringify(data.user));
      localStorage.setItem('nexus_token', data.token);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    setLoading(true);
    try {
      const data = await authService.signup(name, email, password);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('nexus_user', JSON.stringify(data.user));
      localStorage.setItem('nexus_token', data.token);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
