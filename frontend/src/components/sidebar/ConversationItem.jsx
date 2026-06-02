import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { formatChatDate } from '../../utils/dateUtils';
import { getCallStatusText } from '../../utils/callUtils';
import { getChatAvatar, getChatName, truncate } from '../../utils/helpers';
import Avatar from '../shared/Avatar';

const getPreviewText = (chat, currentUserId) => {
  if (!chat.lastMessage) {
    if (chat.isAIBotChat) return 'Ask AI anything';
    if (chat.requestStatus === 'pending') {
      return chat.requestType === 'friend' ? 'Friend request waiting for approval' : 'Message request waiting for approval';
    }
    if (chat.requestStatus === 'declined') {
      return 'Request removed';
    }
    return chat.isGroupChat ? 'New group ready for conversation' : 'No messages yet';
  }

  const editedPrefix = chat.lastMessage.isEdited ? 'Edited: ' : '';
  const forwardedPrefix = chat.lastMessage.isForwarded ? 'Forwarded: ' : '';
  if (chat.lastMessage.isDeletedForEveryone) return 'This message was deleted';
  if (chat.lastMessage.messageType === 'image') return `${editedPrefix}${forwardedPrefix}Shared an image`;
  if (chat.lastMessage.messageType === 'video') return `${editedPrefix}${forwardedPrefix}Shared a video`;
  if (chat.lastMessage.messageType === 'audio') return `${editedPrefix}${forwardedPrefix}Sent a voice note`;
  if (chat.lastMessage.messageType === 'document') return `${editedPrefix}${forwardedPrefix}Shared a document`;
  if (chat.lastMessage.messageType === 'location') return `${editedPrefix}${forwardedPrefix}Shared a location`;
  if (chat.lastMessage.messageType === 'poll') {
    return `${editedPrefix}${forwardedPrefix}Poll: ${chat.lastMessage.poll?.question || 'New poll'}`;
  }
  if (chat.lastMessage.messageType === 'call') {
    return `${editedPrefix}${forwardedPrefix}${getCallStatusText(chat.lastMessage.call, currentUserId)}`;
  }
  if (chat.lastMessage.messageType === 'ai') return `${editedPrefix}${forwardedPrefix}AI response received`;

  return `${editedPrefix}${forwardedPrefix}${truncate(chat.lastMessage.content, 42) || 'No messages yet'}`;
};

const MutedChatIcon = ({ className = 'h-3 w-3' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M5 9.5a2.5 2.5 0 0 1 2.5-2.5H9l3.8-3.2a.85.85 0 0 1 1.4.65V11"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M5 9.5v5A2.5 2.5 0 0 0 7.5 17H9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15.5 9.5a4.5 4.5 0 0 1 0 5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ConversationItem = ({ chat, currentUserId, collapsed = false }) => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { setSelectedChat, markChatAsRead } = useChat();

  const name = getChatName(chat, currentUserId);
  const avatar = getChatAvatar(chat, currentUserId);
  const other = chat.participants?.find((participant) => String(participant?._id || '') !== String(currentUserId || ''));
  const isOnline = !chat.isAIBotChat && other?.canViewLastSeen !== false && Boolean(other?.isOnline);
  const isActive = chatId === chat._id;
  const isMutedChat = Boolean(chat.isMuted);
  const preview = getPreviewText(chat, currentUserId);
  const activityDate = chat.lastMessage?.createdAt || null;
  const isPendingRequest = chat.requestStatus === 'pending';
  const isFriendRequest = chat.requestType === 'friend';
  const avatarNode = (
    <div className="relative shrink-0">
      <Avatar
        src={avatar}
        name={name}
        size={11}
        online={isOnline}
        shape={chat.isGroupChat ? 'round' : 'soft'}
      />
      {isMutedChat ? (
        <span
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#ffcf7c]/28 bg-[#171323] text-[#ffcf7c] shadow-[0_0_18px_rgba(255,207,124,0.18)]"
          title="Muted chat"
        >
          <MutedChatIcon />
        </span>
      ) : null}
    </div>
  );

  const handleClick = () => {
    const shouldOpenFromUnread = Boolean(chat.unreadCount);
    markChatAsRead(chat._id);
    setSelectedChat({
      ...chat,
      unreadCount: 0,
      openFromUnread: shouldOpenFromUnread,
    });
    navigate(`/chat/${chat._id}`);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title={isMutedChat ? `${name} (Muted)` : name}
        onClick={handleClick}
        className={`relative flex w-full items-center justify-center rounded-2xl border px-2 py-3 transition ${
          isActive
            ? 'border-white/12 bg-[#1a1a28] shadow-[inset_0_0_20px_rgba(124,106,255,0.15)]'
            : 'border-transparent hover:bg-[#14141f]'
        }`}
      >
        {isActive ? (
          <span className="absolute inset-y-[20%] left-0 w-[3px] rounded-r bg-[#7c6aff] shadow-[0_0_12px_#7c6aff]" />
        ) : null}

        {avatarNode}

        {chat.unreadCount ? (
          <span className="absolute right-2 top-2 min-w-[18px] rounded-full bg-[#7c6aff] px-1.5 py-0.5 text-center text-[0.62rem] font-bold text-white shadow-[0_0_16px_rgba(124,106,255,0.35)]">
            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        isActive
          ? 'border-white/12 bg-[#1a1a28] shadow-[inset_0_0_20px_rgba(124,106,255,0.15)]'
          : 'border-transparent hover:bg-[#14141f]'
      }`}
    >
      {isActive ? (
        <span className="absolute inset-y-[18%] left-0 w-[3px] rounded-r bg-[#7c6aff] shadow-[0_0_12px_#7c6aff]" />
      ) : null}

      {avatarNode}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate pb-0.5 pr-1 text-[0.96rem] font-semibold leading-[1.2] text-[#f0eeff]">
            {name}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {isPendingRequest ? (
              <span className="rounded-full border border-[#ffb6bf]/18 bg-[#ffb6bf]/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#ffd4dc]">
                {isFriendRequest ? 'Friend Request' : 'Pending'}
              </span>
            ) : null}
            {isMutedChat ? (
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#ffcf7c]/24 bg-[#ffcf7c]/10 text-[#ffcf7c]"
                title="Muted chat"
              >
                <MutedChatIcon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <span className={`text-[0.74rem] ${chat.unreadCount ? 'text-[#7c6aff]' : 'text-white/30'}`}>
              {activityDate ? formatChatDate(activityDate) : ''}
            </span>
            {chat.unreadCount ? (
              <span className="min-w-[22px] rounded-full bg-[#7c6aff] px-2 py-0.5 text-center text-[0.68rem] font-bold text-white shadow-[0_0_16px_rgba(124,106,255,0.35)]">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
        <p className={`mt-1 truncate text-[0.82rem] ${chat.unreadCount ? 'text-white/72' : 'text-white/45'}`}>
          {preview}
        </p>
      </div>

      {chat.isGroupChat ? (
        <span className="rounded-full bg-[#7c6aff]/20 px-2 py-1 text-[0.68rem] font-bold text-[#dedaff]">
          Group
        </span>
      ) : null}
    </button>
  );
};

export default ConversationItem;
