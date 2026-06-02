import React from 'react';
import { useAuth } from '../../context/AuthContext';
import ConversationItem from './ConversationItem';

const ConversationList = ({ chats, collapsed = false }) => {
  const { user } = useAuth();

  if (!chats.length) {
    if (collapsed) {
      return (
        <div className="flex min-h-[96px] items-center justify-center rounded-[20px] border border-white/8 bg-[#14141f]/88 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/28">
          Empty
        </div>
      );
    }

    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[20px] border border-white/8 bg-[#14141f]/88 px-5 py-8 text-center text-white/45">
        <div className="brand-font flex h-[56px] w-[56px] items-center justify-center rounded-[18px] bg-gradient-to-br from-[#7c6aff]/22 to-[#ff6ab0]/18 text-[1.1rem] font-bold text-[#ebe7ff] shadow-[0_0_24px_rgba(124,106,255,0.18)]">
          NC
        </div>
        <p className="brand-font text-[1.1rem] text-[#f0eeff]">No conversations yet</p>
        <p className="max-w-[220px] text-sm leading-6 text-white/35">
          Search above to start a new chat.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {chats.map((chat) => (
        <ConversationItem key={chat._id} chat={chat} currentUserId={user?._id} collapsed={collapsed} />
      ))}
    </div>
  );
};

export default ConversationList;
