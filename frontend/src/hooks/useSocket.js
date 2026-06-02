import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';

export const useSocketEvents = () => {
  const { socket } = useSocket();
  const { addMessage, updateMessageStatus, setTyping } = useChat();

  useEffect(() => {
    if (!socket) return;

    socket.on('receiveMessage', (message) => {
      addMessage(message);
    });

    socket.on('messageStatusUpdate', ({ messageId, status }) => {
      updateMessageStatus(messageId, status);
    });

    socket.on('userTyping', ({ userId, userName, chatId }) => {
      setTyping(chatId, userId, userName, true);
    });

    socket.on('userStopTyping', ({ userId, chatId }) => {
      setTyping(chatId, userId, null, false);
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('messageStatusUpdate');
      socket.off('userTyping');
      socket.off('userStopTyping');
    };
  }, [socket]);
};
