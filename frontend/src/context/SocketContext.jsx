import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();
const getPageVisibility = () => (typeof document === 'undefined' ? true : !document.hidden);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isPageVisible, setIsPageVisible] = useState(getPageVisibility);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineUsers([]);
      setIsPageVisible(getPageVisibility());
      return undefined;
    }

    const nextSocket = io(process.env.REACT_APP_SOCKET_URL, {
      query: { userId: user._id, isVisible: String(getPageVisibility()) },
      withCredentials: true,
    });
    socketRef.current = nextSocket;
    setSocket(nextSocket);

    const syncVisibility = () => {
      const nextIsVisible = getPageVisibility();
      setIsPageVisible(nextIsVisible);
      nextSocket.emit('setVisibility', { isVisible: nextIsVisible });
    };

    nextSocket.on('presenceSnapshot', ({ onlineUserIds = [] }) => {
      setOnlineUsers(onlineUserIds);
    });

    nextSocket.on('userOnline', ({ userId }) => {
      setOnlineUsers(prev => [...new Set([...prev, userId])]);
    });

    nextSocket.on('userOffline', ({ userId }) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId));
    });
    nextSocket.on('connect_error', (error) => {
      console.error('Socket connection failed:', error.message);
    });

    nextSocket.on('connect', syncVisibility);
    document.addEventListener('visibilitychange', syncVisibility);

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      nextSocket.off('presenceSnapshot');
      nextSocket.off('userOnline');
      nextSocket.off('userOffline');
      nextSocket.off('connect_error');
      nextSocket.off('connect', syncVisibility);
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineUsers([]);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, isPageVisible }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
