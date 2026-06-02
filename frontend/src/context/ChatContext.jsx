import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useNotification } from '../hooks/useNotification';
import { getCallStatusText } from '../utils/callUtils';
import { getChatName } from '../utils/helpers';
import { resolveNotificationPreferences } from '../utils/notificationPreferences';

const ChatContext = createContext();

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const isOwnMessageForUser = (message, userId) =>
  normalizeId(message?.senderId) === userId && message?.messageType !== 'ai';
const isChatMuted = (chat) => Boolean(chat?.isMuted);
const getChatActivityTime = (chat) => chat?.lastMessage?.createdAt || chat?.updatedAt || '';
const sortMessagesByCreatedAt = (items) =>
  [...items].sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
const applyEditedMessageToState = (items, editedMessage) =>
  items.map((item) => {
    if (normalizeId(item._id) === normalizeId(editedMessage?._id)) {
      return {
        ...item,
        ...editedMessage,
      };
    }

    if (normalizeId(item.replyTo?._id) === normalizeId(editedMessage?._id)) {
      return {
        ...item,
        replyTo: {
          ...item.replyTo,
          ...editedMessage,
        },
      };
    }

    return item;
  });
const buildNotificationBody = (message) => {
  const forwardedPrefix = message?.isForwarded ? 'Forwarded: ' : '';
  if (message?.isDeletedForEveryone) return 'A message was deleted';
  if (message?.messageType === 'image') return `${forwardedPrefix}Shared an image`;
  if (message?.messageType === 'video') return `${forwardedPrefix}Shared a video`;
  if (message?.messageType === 'audio') return `${forwardedPrefix}Sent a voice note`;
  if (message?.messageType === 'document') return `${forwardedPrefix}Shared a document`;
  if (message?.messageType === 'location') return `${forwardedPrefix}Shared a location`;
  if (message?.messageType === 'poll') return `${forwardedPrefix}Poll: ${message?.poll?.question || 'New poll'}`;
  if (message?.messageType === 'call') return `${forwardedPrefix}${getCallStatusText(message?.call, normalizeId(message?.senderId))}`;
  if (message?.messageType === 'ai') return `${forwardedPrefix}AI response received`;
  return `${forwardedPrefix}${message?.content?.trim() || 'New message received'}`;
};
const buildEditedNotificationBody = (message) => {
  const forwardedPrefix = message?.isForwarded ? 'Forwarded: ' : '';
  if (message?.messageType === 'image') return `${forwardedPrefix}Updated an image message`;
  if (message?.messageType === 'video') return `${forwardedPrefix}Updated a video message`;
  if (message?.messageType === 'audio') return `${forwardedPrefix}Updated a voice note`;
  if (message?.messageType === 'document') return `${forwardedPrefix}Updated a document message`;
  if (message?.messageType === 'location') return `${forwardedPrefix}Updated a shared location`;
  if (message?.messageType === 'poll') {
    return `${forwardedPrefix}Edited poll: ${message?.poll?.question || 'Poll updated'}`;
  }
  if (message?.messageType === 'call') return `${forwardedPrefix}Updated call summary`;
  return `${forwardedPrefix}Edited: ${message?.content?.trim() || 'Updated a message'}`;
};
const hasAIActivityFromMessage = (message) =>
  message?.messageType === 'ai' || /^@ai/i.test(message?.content?.trim?.() || '');
const messageMentionsUser = (message, user) => {
  const content = String(message?.content || '').toLowerCase();
  const name = String(user?.name || '').trim().toLowerCase();
  const emailName = String(user?.email || '').split('@')[0].trim().toLowerCase();

  return Boolean(
    (name && content.includes(`@${name}`)) ||
    (emailName && content.includes(`@${emailName}`))
  );
};
const shouldNotifyForMessage = ({ chat, message, user }) => {
  const preferences = resolveNotificationPreferences(user?.notificationPreferences);
  const mode = preferences.messageNotificationMode;

  if (!preferences.messageNotifications || mode === 'none') return false;
  if (mode === 'all') return true;
  if (mode === 'direct') return !chat?.isGroupChat;
  if (mode === 'mentions') return messageMentionsUser(message, user);

  return true;
};
const syncParticipantPresence = (participants, targetUserId, isOnline) => {
  if (!Array.isArray(participants)) return participants;

  let didChange = false;
  const nextParticipants = participants.map((participant) => {
    if (normalizeId(participant) !== normalizeId(targetUserId)) {
      return participant;
    }

    if (participant?.canViewLastSeen === false) {
      return participant;
    }

    didChange = true;
    return {
      ...participant,
      isOnline,
    };
  });

  return didChange ? nextParticipants : participants;
};
const updateChatParticipantPresence = (chat, targetUserId, isOnline) => {
  if (!chat) return chat;

  const nextParticipants = syncParticipantPresence(chat.participants, targetUserId, isOnline);
  return nextParticipants === chat.participants ? chat : { ...chat, participants: nextParticipants };
};

const sortChatsByLatestActivity = (items) =>
  [...items].sort(
    (a, b) => new Date(getChatActivityTime(b)).getTime() - new Date(getChatActivityTime(a)).getTime()
  );
const upsertChatInList = (items, nextChat) => {
  const existingIndex = items.findIndex((chat) => normalizeId(chat._id) === normalizeId(nextChat?._id));

  if (existingIndex === -1) {
    return sortChatsByLatestActivity([nextChat, ...items]);
  }

  const nextItems = [...items];
  nextItems[existingIndex] = {
    ...nextItems[existingIndex],
    ...nextChat,
  };

  return sortChatsByLatestActivity(nextItems);
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, isPageVisible } = useSocket();
  const { notify, playNotificationSound } = useNotification();
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const currentUserId = normalizeId(user?._id);

  const resetChatState = useCallback(() => {
    setSelectedChat(null);
    setActiveChatId(null);
    setChats([]);
    setMessages([]);
    setTypingUsers({});
  }, []);

  const addMessage = useCallback((message) => {
    setMessages((previous) => {
      const next = previous.some((item) => normalizeId(item._id) === normalizeId(message._id))
        ? previous.map((item) => (normalizeId(item._id) === normalizeId(message._id) ? { ...item, ...message } : item))
        : [...previous, message];

      return sortMessagesByCreatedAt(next);
    });
  }, []);

  const updateMessageStatus = useCallback((messageId, status) => {
    setMessages(prev =>
      prev.map(m => m._id === messageId ? { ...m, status } : m)
    );
  }, []);

  const setTyping = useCallback((chatId, userId, userName, isTyping) => {
    setTypingUsers(prev => {
      const chatTypers = { ...(prev[chatId] || {}) };
      if (isTyping) {
        chatTypers[userId] = userName;
      } else {
        delete chatTypers[userId];
      }
      return { ...prev, [chatId]: chatTypers };
    });
  }, []);

  const markChatAsRead = useCallback((chatId) => {
    const normalizedChatId = normalizeId(chatId);
    if (!normalizedChatId) return;

    setChats((prev) =>
      prev.map((chat) => {
        if (normalizeId(chat._id) !== normalizedChatId || !chat.unreadCount) return chat;
        return { ...chat, unreadCount: 0 };
      })
    );

    setSelectedChat((prev) =>
      normalizeId(prev?._id) === normalizedChatId && prev?.unreadCount
        ? { ...prev, unreadCount: 0 }
        : prev
    );
  }, []);

  const removeChatFromState = useCallback((chatId) => {
    const normalizedChatId = normalizeId(chatId);
    if (!normalizedChatId) return;

    setChats((previous) => previous.filter((chat) => normalizeId(chat._id) !== normalizedChatId));
    setSelectedChat((previous) =>
      normalizeId(previous?._id) === normalizedChatId ? null : previous
    );
    setActiveChatId((previous) =>
      normalizeId(previous) === normalizedChatId ? null : previous
    );
    setMessages((previous) =>
      normalizeId(selectedChat?._id) === normalizedChatId || normalizeId(activeChatId) === normalizedChatId
        ? []
        : previous
    );
    setTypingUsers((previous) => {
      if (!previous[normalizedChatId]) return previous;

      const next = { ...previous };
      delete next[normalizedChatId];
      return next;
    });
  }, [activeChatId, selectedChat]);

  useEffect(() => {
    resetChatState();
  }, [resetChatState, user?._id]);

  useEffect(() => {
    if (!socket) return undefined;

    const syncChatFromMessage = (message) => {
      const chatId = normalizeId(message?.chatId);
      if (!chatId) return;

      const matchingChat =
        normalizeId(selectedChat?._id) === chatId
          ? selectedChat
          : chats.find((chat) => normalizeId(chat._id) === chatId);
      const isOwnMessage = isOwnMessageForUser(message, currentUserId);
      const isMutedChat = isChatMuted(matchingChat);
      const shouldNotifyUser = shouldNotifyForMessage({ chat: matchingChat, message, user });
      const isVisibleActiveChat = isPageVisible && normalizeId(activeChatId) === chatId;

      if (!isOwnMessage && !isMutedChat && shouldNotifyUser) {
        playNotificationSound();
      }

      if (!isOwnMessage && !isPageVisible && !isMutedChat && shouldNotifyUser) {
        const title = matchingChat
          ? getChatName(matchingChat, currentUserId)
          : message?.senderId?.name || 'New message';
        notify(title, buildNotificationBody(message));
      }

      setChats((previous) => {
        let found = false;
        const next = previous.map((chat) => {
          if (normalizeId(chat._id) !== chatId) return chat;
          found = true;

          let unreadCount = chat.unreadCount || 0;
          if (!isOwnMessage) {
            unreadCount = isVisibleActiveChat ? 0 : unreadCount + 1;
          }

          return {
            ...chat,
            lastMessage: message,
            scheduledPreview:
              normalizeId(chat.scheduledPreview?._id) === normalizeId(message._id)
                ? null
                : chat.scheduledPreview || null,
            hasAIActivity: chat.hasAIActivity || hasAIActivityFromMessage(message),
            updatedAt: message.createdAt || chat.updatedAt,
            unreadCount,
          };
        });

        return found ? sortChatsByLatestActivity(next) : previous;
      });

      setSelectedChat((previous) =>
        normalizeId(previous?._id) === chatId
          ? {
              ...previous,
              lastMessage: message,
              scheduledPreview:
                normalizeId(previous?.scheduledPreview?._id) === normalizeId(message._id)
                  ? null
                  : previous?.scheduledPreview || null,
              hasAIActivity: previous?.hasAIActivity || hasAIActivityFromMessage(message),
              unreadCount: isOwnMessage
                ? previous?.unreadCount || 0
                : isVisibleActiveChat
                  ? 0
                  : (previous?.unreadCount || 0) + 1,
            }
          : previous
      );
    };

    const syncDeletedMessage = ({ message }) => {
      const chatId = normalizeId(message?.chatId);
      if (!chatId) return;

      setChats((previous) => {
        const next = previous.map((chat) => {
          if (
            normalizeId(chat._id) !== chatId ||
            normalizeId(chat.lastMessage?._id) !== normalizeId(message._id)
          ) {
            return chat;
          }

          return {
            ...chat,
            lastMessage: message,
          };
        });

        return sortChatsByLatestActivity(next);
      });

      setSelectedChat((previous) =>
        normalizeId(previous?._id) === chatId &&
        normalizeId(previous?.lastMessage?._id) === normalizeId(message._id)
          ? { ...previous, lastMessage: message }
          : previous
      );
    };

    const syncEditedMessage = ({ message }) => {
      const chatId = normalizeId(message?.chatId);
      if (!chatId) return;

      const matchingChat =
        normalizeId(selectedChat?._id) === chatId
          ? selectedChat
          : chats.find((chat) => normalizeId(chat._id) === chatId);
      const isOwnMessage = isOwnMessageForUser(message, currentUserId);
      const isMutedChat = isChatMuted(matchingChat);
      const shouldNotifyUser = shouldNotifyForMessage({ chat: matchingChat, message, user });

      if (!isOwnMessage && !isPageVisible && !isMutedChat && shouldNotifyUser) {
        const title = matchingChat
          ? getChatName(matchingChat, currentUserId)
          : message?.senderId?.name || 'Edited message';
        notify(title, buildEditedNotificationBody(message));
      }

      setMessages((previous) => applyEditedMessageToState(previous, message));

      setChats((previous) =>
        previous.map((chat) => {
          if (normalizeId(chat._id) !== chatId) return chat;

          const nextPinnedMessages = Array.isArray(chat.pinnedMessages)
            ? chat.pinnedMessages.map((entry) =>
                normalizeId(entry) === normalizeId(message._id)
                  ? { ...entry, ...message }
                  : entry
              )
            : chat.pinnedMessages;

          return {
            ...chat,
            lastMessage:
              normalizeId(chat.lastMessage?._id) === normalizeId(message._id)
                ? { ...chat.lastMessage, ...message }
                : chat.lastMessage,
            pinnedMessages: nextPinnedMessages,
          };
        })
      );

      setSelectedChat((previous) => {
        if (normalizeId(previous?._id) !== chatId) return previous;

        const nextPinnedMessages = Array.isArray(previous?.pinnedMessages)
          ? previous.pinnedMessages.map((entry) =>
              normalizeId(entry) === normalizeId(message._id)
                ? { ...entry, ...message }
                : entry
            )
          : previous?.pinnedMessages;

        return {
          ...previous,
          lastMessage:
            normalizeId(previous?.lastMessage?._id) === normalizeId(message._id)
              ? { ...previous.lastMessage, ...message }
              : previous?.lastMessage,
          pinnedMessages: nextPinnedMessages,
        };
      });
    };

    const handleUserOnline = ({ userId: targetUserId }) => {
      setChats((previous) =>
        previous.map((chat) => updateChatParticipantPresence(chat, targetUserId, true))
      );
      setSelectedChat((previous) => updateChatParticipantPresence(previous, targetUserId, true));
    };

    const handleUserOffline = ({ userId: targetUserId }) => {
      setChats((previous) =>
        previous.map((chat) => updateChatParticipantPresence(chat, targetUserId, false))
      );
      setSelectedChat((previous) =>
        updateChatParticipantPresence(previous, targetUserId, false)
      );
    };

    const handleChatUpserted = (incomingChat) => {
      if (!incomingChat?._id) return;

      setChats((previous) => upsertChatInList(previous, incomingChat));
      setSelectedChat((previous) =>
        normalizeId(previous?._id) === normalizeId(incomingChat._id)
          ? { ...previous, ...incomingChat }
          : previous
      );
    };

    const handleChatRemoved = ({ chatId }) => {
      removeChatFromState(chatId);
    };

    socket.on('receiveMessage', syncChatFromMessage);
    socket.on('messageEdited', syncEditedMessage);
    socket.on('messageDeletedForEveryone', syncDeletedMessage);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);
    socket.on('chatUpserted', handleChatUpserted);
    socket.on('chatRemoved', handleChatRemoved);

    return () => {
      socket.off('receiveMessage', syncChatFromMessage);
      socket.off('messageEdited', syncEditedMessage);
      socket.off('messageDeletedForEveryone', syncDeletedMessage);
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
      socket.off('chatUpserted', handleChatUpserted);
      socket.off('chatRemoved', handleChatRemoved);
    };
  }, [activeChatId, chats, currentUserId, isPageVisible, notify, playNotificationSound, removeChatFromState, selectedChat, socket, user]);

  return (
    <ChatContext.Provider value={{
      selectedChat, setSelectedChat,
      activeChatId, setActiveChatId,
      chats, setChats,
      messages, setMessages,
      addMessage, updateMessageStatus,
      resetChatState,
      removeChatFromState,
      markChatAsRead,
      typingUsers, setTyping,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
