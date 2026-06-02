import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/sidebar/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import { useChat } from '../context/ChatContext';
import { chatService } from '../services/chatService';

const ChatPage = () => {
  const { chatId } = useParams();
  const { selectedChat, setSelectedChat } = useChat();
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedChat || selectedChat._id !== chatId) {
      chatService
        .getChatById(chatId)
        .then(setSelectedChat)
        .catch(() => navigate('/app'));
    }
  }, [chatId, navigate, selectedChat, setSelectedChat]);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#050508]">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {selectedChat ? (
          <ChatWindow chat={selectedChat} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/55">
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-white/10 border-t-[#7c6aff]" />
            <p className="mono-font text-[0.72rem] uppercase tracking-[0.08em]">Loading conversation...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
