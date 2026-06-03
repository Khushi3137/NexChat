import React, { useCallback, useEffect, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { chatService } from '../../services/chatService';
import api from '../../services/api';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import { useNotification } from '../../hooks/useNotification';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useGroupCall } from '../../hooks/useGroupCall';
import { formatCallDuration, getCallDirectionLabel, getCallStatusText, getCallTypeLabel, isCallInitiatedByUser } from '../../utils/callUtils';
import { formatMessageTime } from '../../utils/dateUtils';
import { getChatAvatar, getChatName } from '../../utils/helpers';
import Avatar from '../shared/Avatar';
import CallModal from '../calls/CallModal';
import GroupCallModal from '../calls/GroupCallModal';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import MediaViewerModal from './MediaViewerModal';
import PinnedMessage from './PinnedMessage';
import TypingIndicator from './TypingIndicator';
import VirtualKeyboard from '../shared/VirtualKeyboard';
import Modal from '../shared/Modal';

const getDateLabel = (value) => {
  const date = new Date(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d');
};
const CALL_RESPONSE_TIMEOUT_MS = 30000;

const extractLinks = (text = '') => text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const matchesChatId = (value, chatId) => normalizeId(value) === chatId;
const isIncomingMessageForUser = (message, userId) =>
  normalizeId(message?.senderId) !== normalizeId(userId) || message?.messageType === 'ai';
const hasSeenMessage = (message, userId) =>
  message.seenBy?.some((entry) => normalizeId(entry) === normalizeId(userId));
const sortScheduledMessagesByTime = (items) =>
  [...items].sort(
    (a, b) => new Date(a?.scheduledTime || 0).getTime() - new Date(b?.scheduledTime || 0).getTime()
  );
const getParticipantDisplayName = (participant) => participant?.localName || participant?.name || 'Unknown member';
const canShowParticipantPresence = (participant) => participant?.canViewLastSeen !== false;
const isParticipantOnline = (participant) =>
  canShowParticipantPresence(participant) && Boolean(participant?.isOnline);
const getParticipantPresenceLabel = (participant, hiddenLabel = 'Activity hidden') => {
  if (!participant) return 'Unavailable';
  if (!canShowParticipantPresence(participant)) return hiddenLabel;
  return participant?.isOnline ? 'Active' : 'Inactive';
};
const getScheduledSendTimeLabel = (scheduledTime) => {
  if (!scheduledTime) return '';

  const date = new Date(scheduledTime);
  return `${isToday(date) ? 'Today' : 'Tomorrow'} at ${format(date, 'hh:mm a')}`;
};
const getScheduledPreviewTitle = (message) => {
  if (message?.messageType === 'image') return 'Image';
  if (message?.messageType === 'video') return 'Video';
  if (message?.messageType === 'audio') return 'Voice note';
  if (message?.messageType === 'document') return 'Document';
  if (message?.messageType === 'location') return 'Location';
  if (message?.messageType === 'poll') return 'Poll';
  if (message?.messageType === 'call') return getCallTypeLabel(message?.call?.callType);
  return 'Message';
};
const getScheduledPreviewBody = (message) => {
  if (message?.content?.trim()) return message.content;
  if (message?.messageType === 'image') return 'An image will be shared at the scheduled time.';
  if (message?.messageType === 'video') return 'A video will be shared at the scheduled time.';
  if (message?.messageType === 'audio') return 'A voice note will be shared at the scheduled time.';
  if (message?.messageType === 'document') return 'A document will be shared at the scheduled time.';
  if (message?.messageType === 'location') return message?.location?.address || 'A location will be shared.';
  if (message?.messageType === 'poll') return message?.poll?.question || 'A poll will be shared.';
  if (message?.messageType === 'call') return getCallStatusText(message?.call);
  return 'This message is waiting to send at the selected time.';
};
const getMessagePreviewText = (message) => {
  if (message?.content?.trim()) return message.content;
  if (message?.messageType === 'image') return 'Image attachment';
  if (message?.messageType === 'video') return 'Video attachment';
  if (message?.messageType === 'audio') return 'Voice note';
  if (message?.messageType === 'document') return 'Document attachment';
  if (message?.messageType === 'location') return message?.location?.address || 'Location';
  if (message?.messageType === 'poll') return message?.poll?.question || 'Poll';
  if (message?.messageType === 'call') return getCallStatusText(message?.call);
  if (message?.messageType === 'ai') return 'AI response';
  return 'Message';
};
const sortMessagesByCreatedAt = (items) =>
  [...items].sort(
    (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
  );
const sanitizeFileNameSegment = (value = 'chat') =>
  String(value || 'chat')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'chat';
const downloadTextFile = (filename, content) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};
const getMessageSenderLabel = (message, currentUserId) => {
  if (normalizeId(message?.senderId) === normalizeId(currentUserId)) return 'You';
  if (typeof message?.senderId === 'object') {
    return message.senderId?.localName || message.senderId?.name || 'Participant';
  }
  return 'Participant';
};
const buildMessageExportBody = (message, currentUserId) => {
  if (message?.isDeletedForEveryone) return '[Deleted message]';

  const details = [];

  if (message?.isForwarded) details.push('[Forwarded]');
  if (message?.isEdited) details.push('[Edited]');

  switch (message?.messageType) {
    case 'image':
      details.push(message?.content?.trim() ? `[Image] ${message.content.trim()}` : '[Image attachment]');
      break;
    case 'video':
      details.push(message?.content?.trim() ? `[Video] ${message.content.trim()}` : '[Video attachment]');
      break;
    case 'audio':
      details.push(message?.content?.trim() ? `[Voice note] ${message.content.trim()}` : '[Voice note]');
      break;
    case 'document':
      details.push(message?.content?.trim() ? `[Document] ${message.content.trim()}` : '[Document attachment]');
      break;
    case 'location': {
      const locationLabel = message?.location?.address
        || [message?.location?.lat, message?.location?.lng].filter((entry) => entry !== undefined && entry !== null).join(', ')
        || 'Shared location';
      details.push(`[Location] ${locationLabel}`);
      break;
    }
    case 'poll': {
      const optionLabels = Array.isArray(message?.poll?.options)
        ? message.poll.options.map((option) => option?.text?.trim()).filter(Boolean).join(' | ')
        : '';
      details.push(`[Poll] ${message?.poll?.question || message?.content?.trim() || 'Poll'}`);
      if (optionLabels) {
        details.push(`Options: ${optionLabels}`);
      }
      break;
    }
    case 'call':
      details.push(`[Call] ${getCallStatusText(message?.call, currentUserId)}`);
      break;
    case 'ai':
      details.push(message?.content?.trim() || 'AI response');
      break;
    default:
      details.push(message?.content?.trim() || 'Message');
      break;
  }

  if (message?.mediaUrl) {
    details.push(`Media: ${message.mediaUrl}`);
  }

  return details.filter(Boolean).join(' ');
};
const getDismissedPinnedStorageKey = (userId) =>
  `nexchat-dismissed-pinned:${normalizeId(userId) || 'guest'}`;
const getDismissedPinnedMap = (userId) => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(getDismissedPinnedStorageKey(userId));
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
};
const setDismissedPinnedMessageId = (userId, chatId, messageId) => {
  if (typeof window === 'undefined') return;

  const nextMap = {
    ...getDismissedPinnedMap(userId),
    [normalizeId(chatId)]: normalizeId(messageId),
  };
  window.localStorage.setItem(getDismissedPinnedStorageKey(userId), JSON.stringify(nextMap));
};
const clearDismissedPinnedMessageId = (userId, chatId) => {
  if (typeof window === 'undefined') return;

  const nextMap = { ...getDismissedPinnedMap(userId) };
  delete nextMap[normalizeId(chatId)];
  window.localStorage.setItem(getDismissedPinnedStorageKey(userId), JSON.stringify(nextMap));
};
const getChatActivityTime = (chat) => chat?.lastMessage?.createdAt || chat?.updatedAt || '';
const sortChatsByLatestActivity = (items) =>
  [...items].sort(
    (a, b) => new Date(getChatActivityTime(b)).getTime() - new Date(getChatActivityTime(a)).getTime()
  );
const upsertChatInList = (items, nextChat) => {
  const existingIndex = items.findIndex((entry) => normalizeId(entry?._id) === normalizeId(nextChat?._id));

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
const updateMutedChatIds = (items, chatId, shouldMute) => {
  const normalizedChatId = normalizeId(chatId);
  const existingItems = Array.isArray(items) ? items : [];

  if (!normalizedChatId) return existingItems;

  if (shouldMute) {
    return existingItems.some((entry) => normalizeId(entry) === normalizedChatId)
      ? existingItems
      : [...existingItems, normalizedChatId];
  }

  return existingItems.filter((entry) => normalizeId(entry) !== normalizedChatId);
};
const MutedChatIcon = ({ className = 'h-3.5 w-3.5' }) => (
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

const getOwnReactionEmoji = (message, userId) =>
  message.reactions?.find((reaction) =>
    reaction.users?.some((entry) => normalizeId(entry) === userId)
  )?.emoji || null;

const buildDeletedReplyPreview = (message, existingReplyTo) => ({
  _id: message?._id || existingReplyTo?._id,
  senderId: message?.senderId || existingReplyTo?.senderId || null,
  content: '',
  mediaUrl: '',
  messageType: message?.messageType || existingReplyTo?.messageType || 'text',
  isDeletedForEveryone: true,
});

const removeMessageFromState = (previous, messageId) => {
  const deletedMessage = previous.find((item) => item._id === messageId);

  return previous
    .filter((item) => item._id !== messageId)
    .map((item) =>
      item.replyTo?._id === messageId
        ? { ...item, replyTo: buildDeletedReplyPreview(deletedMessage, item.replyTo) }
        : item
    );
};

const applyDeletedMessageToState = (previous, deletedMessage) =>
  previous.map((item) => {
    if (item._id === deletedMessage._id) {
      return {
        ...item,
        ...deletedMessage,
        replyTo: null,
        reactions: [],
      };
    }

    if (item.replyTo?._id === deletedMessage._id) {
      return {
        ...item,
        replyTo: buildDeletedReplyPreview(deletedMessage, item.replyTo),
      };
    }

    return item;
  });

const applyEditedMessageToState = (previous, editedMessage) =>
  previous.map((item) => {
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

const applyContactAliasToChat = (chatEntry, targetUserId, alias) => {
  if (!chatEntry || !Array.isArray(chatEntry.participants)) return chatEntry;

  let didChange = false;
  const nextParticipants = chatEntry.participants.map((participant) => {
    if (normalizeId(participant) !== normalizeId(targetUserId) || !participant || typeof participant !== 'object') {
      return participant;
    }

    didChange = true;

    if (!alias) {
      const { localName, ...rest } = participant;
      return rest;
    }

    return {
      ...participant,
      localName: alias,
    };
  });

  return didChange
    ? {
        ...chatEntry,
        participants: nextParticipants,
      }
    : chatEntry;
};

const applyContactAliasToMessages = (items, targetUserId, alias) =>
  items.map((message) => {
    const nextMessage = { ...message };

    if (normalizeId(nextMessage.senderId) === normalizeId(targetUserId) && typeof nextMessage.senderId === 'object') {
      nextMessage.senderId = alias
        ? { ...nextMessage.senderId, localName: alias }
        : Object.fromEntries(Object.entries(nextMessage.senderId).filter(([key]) => key !== 'localName'));
    }

    if (normalizeId(nextMessage.replyTo?.senderId) === normalizeId(targetUserId) && typeof nextMessage.replyTo?.senderId === 'object') {
      nextMessage.replyTo = {
        ...nextMessage.replyTo,
        senderId: alias
          ? { ...nextMessage.replyTo.senderId, localName: alias }
          : Object.fromEntries(Object.entries(nextMessage.replyTo.senderId).filter(([key]) => key !== 'localName')),
      };
    }

    return nextMessage;
  });

const applyParticipantStateToChat = (chatEntry, targetUserId, updates) => {
  if (!chatEntry || !Array.isArray(chatEntry.participants)) return chatEntry;

  let didChange = false;
  const nextParticipants = chatEntry.participants.map((participant) => {
    if (normalizeId(participant) !== normalizeId(targetUserId) || !participant || typeof participant !== 'object') {
      return participant;
    }

    didChange = true;
    return {
      ...participant,
      ...updates,
    };
  });

  return didChange
    ? {
        ...chatEntry,
        participants: nextParticipants,
      }
    : chatEntry;
};
const getGroupMessageReadReceiptDetails = (message, participants, currentUserId) => {
  const senderId = normalizeId(message?.senderId) || normalizeId(currentUserId);
  const seenIdSet = new Set((message?.seenBy || []).map((entry) => normalizeId(entry)).filter(Boolean));
  const recipientParticipants = (Array.isArray(participants) ? participants : [])
    .filter((participant) => normalizeId(participant) && normalizeId(participant) !== senderId)
    .map((participant) => ({
      _id: normalizeId(participant),
      name: getParticipantDisplayName(participant),
      profilePicture: participant?.profilePicture || '',
      isOnline: isParticipantOnline(participant),
    }));
  const seenMembers = recipientParticipants.filter((participant) => seenIdSet.has(participant._id));
  const unseenMembers = recipientParticipants.filter((participant) => !seenIdSet.has(participant._id));

  return {
    seenMembers,
    unseenMembers,
    seenCount: seenMembers.length,
    totalRecipients: recipientParticipants.length,
  };
};

const ChatWindow = ({ chat }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const { socket, isPageVisible } = useSocket();
  const { playNotificationSound } = useNotification();
  const {
    chats,
    messages,
    setMessages,
    setChats,
    setSelectedChat,
    addMessage,
    typingUsers,
    setActiveChatId,
    removeChatFromState,
    markChatAsRead,
  } = useChat();
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMsg, setPinnedMsg] = useState(null);
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [editingScheduledId, setEditingScheduledId] = useState('');
  const [scheduledDraft, setScheduledDraft] = useState('');
  const [savingScheduledId, setSavingScheduledId] = useState('');
  const [removingScheduledId, setRemovingScheduledId] = useState('');
  const [showScheduledKeyboard, setShowScheduledKeyboard] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState('video');
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [showGroupCall, setShowGroupCall] = useState(false);
  const [groupCallType, setGroupCallType] = useState('video');
  const [groupCallDurationSeconds, setGroupCallDurationSeconds] = useState(0);
  const [mediaViewerMessage, setMediaViewerMessage] = useState(null);
  const [readReceiptMessageId, setReadReceiptMessageId] = useState('');
  const [dismissedPinnedMessageId, setDismissedPinnedMessageIdState] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState('');
  const [isRespondingToRequest, setIsRespondingToRequest] = useState(false);
  const [contactAliasDraft, setContactAliasDraft] = useState('');
  const [isSavingContactAlias, setIsSavingContactAlias] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [isSavingGroupName, setIsSavingGroupName] = useState(false);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [groupMemberResults, setGroupMemberResults] = useState([]);
  const [isSearchingGroupMembers, setIsSearchingGroupMembers] = useState(false);
  const [addingGroupMemberId, setAddingGroupMemberId] = useState('');
  const [addingGroupContactId, setAddingGroupContactId] = useState('');
  const [isMemberInfoOpen, setIsMemberInfoOpen] = useState(false);
  const [selectedGroupMemberId, setSelectedGroupMemberId] = useState('');
  const [groupMemberAliasDraft, setGroupMemberAliasDraft] = useState('');
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isUpdatingMute, setIsUpdatingMute] = useState(false);
  const [isExportingChat, setIsExportingChat] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState([]);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const messageListRef = useRef(null);
  const scheduledEditRef = useRef(null);
  const messageSearchInputRef = useRef(null);
  const groupMemberSearchRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const highlightTimeoutRef = useRef(null);
  const sharedMessageFetchRef = useRef('');
  const callSessionRef = useRef(null);
  const callTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const groupCallSessionRef = useRef(null);
  const groupCallTimerRef = useRef(null);
  const groupCallTimeoutRef = useRef(null);
  const groupCallSoundKeyRef = useRef('');

  const {
    caller,
    startCall,
    answerCall,
    declineCall,
    endCall,
    resetCallState,
    callStatus,
    localVideoRef,
    remoteVideoRef,
    setCallStatus,
    setCaller,
  } = useWebRTC(socket, user._id);
  const {
    localStream: groupLocalStream,
    localVideoRef: groupLocalVideoRef,
    remoteParticipants: groupRemoteParticipants,
    incomingCall: incomingGroupCall,
    callStatus: groupCallStatus,
    startGroupCall,
    answerGroupCall,
    declineGroupCall,
    leaveGroupCall,
    endGroupCall,
    resetGroupCallState,
  } = useGroupCall(socket, user._id);

  useEffect(() => {
    const soundKey = incomingGroupCall
      ? `${normalizeId(incomingGroupCall.chatId)}:${normalizeId(incomingGroupCall.from)}`
      : '';

    if (!soundKey) {
      groupCallSoundKeyRef.current = '';
      return;
    }

    if (groupCallSoundKeyRef.current === soundKey) return;
    groupCallSoundKeyRef.current = soundKey;
    playNotificationSound();
  }, [incomingGroupCall, playNotificationSound]);

  const isAIBotChat = Boolean(chat.isAIBotChat);
  const canShowInfoPanel = !isAIBotChat;
  const isInfoPanelOpen = canShowInfoPanel && showInfoPanel;
  const chatName = getChatName(chat, user._id);
  const chatAvatar = getChatAvatar(chat, user._id);
  const openProfilePhotoViewer = (imageUrl, viewerTitle) => {
    if (!imageUrl) return;

    setMediaViewerMessage({
      mediaUrl: imageUrl,
      messageType: 'image',
      viewerTitle,
    });
  };
  const handleOpenChatAvatar = () => openProfilePhotoViewer(chatAvatar, chatName);
  const handleOpenMessageAvatar = (message) => {
    const senderDetails = typeof message?.senderId === 'object' ? message.senderId : null;
    const senderParticipant = chat.participants?.find(
      (participant) => normalizeId(participant) === normalizeId(message?.senderId)
    );
    const senderName = senderParticipant?.localName || senderDetails?.localName || senderParticipant?.name || senderDetails?.name || 'Profile photo';
    openProfilePhotoViewer(senderDetails?.profilePicture, senderName);
  };
  const other = chat.participants?.find((participant) => participant._id !== user._id);
  const isOnline = !isAIBotChat && !chat.isGroupChat && isParticipantOnline(other);
  const isMutedChat = Boolean(chat.isMuted);
  const chatTypers = typingUsers[chat._id] || {};
  const requestStatus = chat.requestStatus || 'none';
  const requestType = chat.requestType || 'none';
  const isPendingRequest = requestStatus === 'pending';
  const isDeclinedRequest = requestStatus === 'declined';
  const groupParticipants = Array.isArray(chat.participants) ? chat.participants : [];
  const isGroupAdmin =
    chat.isGroupChat &&
    Array.isArray(chat.admins) &&
    chat.admins.some((adminId) => normalizeId(adminId) === normalizeId(user._id));
  const isRequester = normalizeId(chat.requestedBy) === normalizeId(user._id);
  const canRespondToRequest = Boolean(chat.canCurrentUserRespondToRequest);
  const requestLabel = requestType === 'friend' ? 'Friend request' : 'Message request';
  const composerDisabled = isPendingRequest || isDeclinedRequest;
  const readReceiptMessage = messages.find(
    (message) => normalizeId(message._id) === normalizeId(readReceiptMessageId)
  ) || null;
  const readReceiptDetails = readReceiptMessage
    ? getGroupMessageReadReceiptDetails(readReceiptMessage, chat.participants, user._id)
    : { seenMembers: [], unseenMembers: [], seenCount: 0, totalRecipients: 0 };
  const selectedGroupMember = groupParticipants.find(
    (participant) => normalizeId(participant) === normalizeId(selectedGroupMemberId)
  ) || null;
  const existingContactAlias = other?.localName?.trim() || '';
  const normalizedContactAliasDraft = contactAliasDraft.trim();
  const hasContactAliasChanges = normalizedContactAliasDraft !== existingContactAlias;
  const existingGroupMemberAlias = selectedGroupMember?.localName?.trim() || '';
  const normalizedGroupMemberAliasDraft = groupMemberAliasDraft.trim();
  const hasGroupMemberAliasChanges = normalizedGroupMemberAliasDraft !== existingGroupMemberAlias;
  const isOtherUserBlocked =
    !chat.isGroupChat
    && Array.isArray(user?.blockedUsers)
    && user.blockedUsers.some((entry) => normalizeId(entry) === normalizeId(other?._id));
  const canBlockUser = !chat.isGroupChat && !isAIBotChat && Boolean(other?._id);
  const focusedMessageId = new URLSearchParams(location.search).get('message') || '';
  const composerDisabledReason = isPendingRequest
    ? canRespondToRequest
      ? `Allow this ${requestType === 'friend' ? 'friend request' : 'message request'} to start chatting.`
      : `Waiting for ${other?.name || 'them'} to allow your request.`
    : isDeclinedRequest
      ? 'This request was removed. Search again to send a new request.'
      : '';

  useEffect(() => {
    setDismissedPinnedMessageIdState(
      getDismissedPinnedMap(user._id)[normalizeId(chat._id)] || ''
    );
  }, [chat._id, user._id]);

  const syncChatState = (nextChat) => {
    setChats((previous) => upsertChatInList(previous, nextChat));
    setSelectedChat(nextChat);
  };

  const clearPendingCallTimeout = useCallback(() => {
    window.clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
  }, []);

  const stopCallDurationTimer = useCallback(() => {
    window.clearInterval(callTimerRef.current);
    callTimerRef.current = null;
  }, []);

  const startCallDurationTimer = useCallback((answeredAtValue) => {
    if (!answeredAtValue) return;

    stopCallDurationTimer();

    const answeredAtTime = new Date(answeredAtValue).getTime();
    const updateTimer = () => {
      const nextDuration = Math.max(0, Math.round((Date.now() - answeredAtTime) / 1000));
      setCallDurationSeconds(nextDuration);
    };

    updateTimer();
    callTimerRef.current = window.setInterval(updateTimer, 1000);
  }, [stopCallDurationTimer]);

  const persistCallSummary = useCallback(async (sessionSnapshot, outcome) => {
    if (!sessionSnapshot || normalizeId(sessionSnapshot.initiatorId) !== normalizeId(user._id)) return;

    try {
      await chatService.sendMessage({
        chatId: sessionSnapshot.chatId,
        messageType: 'call',
        call: {
          callType: sessionSnapshot.callType,
          status: outcome,
          durationSeconds:
            outcome === 'completed' && sessionSnapshot.answeredAt
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(sessionSnapshot.endedAt).getTime() - new Date(sessionSnapshot.answeredAt).getTime()) / 1000
                  )
                )
              : 0,
          startedAt: sessionSnapshot.startedAt,
          answeredAt: sessionSnapshot.answeredAt,
          endedAt: sessionSnapshot.endedAt,
          initiatedBy: sessionSnapshot.initiatorId,
          receiverId: sessionSnapshot.receiverId,
        },
      });
    } catch {
      toast.error('Failed to save the call summary');
    }
  }, [user._id]);

  const completeCallSession = useCallback(async (
    outcome,
    {
      emitAction = 'none',
      remoteUserId = '',
      declineReason = 'declined',
      endReason = '',
    } = {}
  ) => {
    const activeSession = callSessionRef.current;
    if (!activeSession) {
      setShowCall(false);
      setCallDurationSeconds(0);
      resetCallState();
      return;
    }

    const sessionSnapshot = {
      ...activeSession,
      endedAt: new Date().toISOString(),
    };

    clearPendingCallTimeout();
    stopCallDurationTimer();
    setCallDurationSeconds(0);
    callSessionRef.current = null;
    setShowCall(false);

    if (emitAction === 'decline' && remoteUserId) {
      declineCall(remoteUserId, {
        chatId: sessionSnapshot.chatId,
        reason: declineReason,
      });
    } else if (emitAction === 'end' && remoteUserId) {
      endCall(remoteUserId, {
        chatId: sessionSnapshot.chatId,
        reason: endReason || (outcome === 'completed' ? 'ended' : 'missed'),
      });
    } else {
      resetCallState();
    }

    await persistCallSummary(sessionSnapshot, outcome);
  }, [clearPendingCallTimeout, declineCall, endCall, persistCallSummary, resetCallState, stopCallDurationTimer]);

  const clearPendingGroupCallTimeout = useCallback(() => {
    window.clearTimeout(groupCallTimeoutRef.current);
    groupCallTimeoutRef.current = null;
  }, []);

  const stopGroupCallDurationTimer = useCallback(() => {
    window.clearInterval(groupCallTimerRef.current);
    groupCallTimerRef.current = null;
  }, []);

  const startGroupCallDurationTimer = useCallback((answeredAtValue) => {
    if (!answeredAtValue) return;

    stopGroupCallDurationTimer();

    const answeredAtTime = new Date(answeredAtValue).getTime();
    const updateTimer = () => {
      const nextDuration = Math.max(0, Math.round((Date.now() - answeredAtTime) / 1000));
      setGroupCallDurationSeconds(nextDuration);
    };

    updateTimer();
    groupCallTimerRef.current = window.setInterval(updateTimer, 1000);
  }, [stopGroupCallDurationTimer]);

  const persistGroupCallSummary = useCallback(async (sessionSnapshot, outcome) => {
    if (!sessionSnapshot || normalizeId(sessionSnapshot.initiatorId) !== normalizeId(user._id)) return;

    try {
      await chatService.sendMessage({
        chatId: sessionSnapshot.chatId,
        messageType: 'call',
        call: {
          callType: sessionSnapshot.callType,
          scope: 'group',
          status: outcome,
          durationSeconds:
            outcome === 'completed' && sessionSnapshot.answeredAt
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(sessionSnapshot.endedAt).getTime() - new Date(sessionSnapshot.answeredAt).getTime()) / 1000
                  )
                )
              : 0,
          startedAt: sessionSnapshot.startedAt,
          answeredAt: sessionSnapshot.answeredAt,
          endedAt: sessionSnapshot.endedAt,
          initiatedBy: sessionSnapshot.initiatorId,
          participantIds: sessionSnapshot.joinedParticipantIds || [],
          joinedCount: Math.max(0, (sessionSnapshot.joinedParticipantIds || []).length),
        },
      });
    } catch {
      toast.error('Failed to save the group call summary');
    }
  }, [user._id]);

  const completeGroupCallSession = useCallback(async (
    outcome,
    { emitAction = 'none' } = {}
  ) => {
    const activeSession = groupCallSessionRef.current;
    if (!activeSession) {
      setShowGroupCall(false);
      setGroupCallDurationSeconds(0);
      resetGroupCallState();
      return;
    }

    const sessionSnapshot = {
      ...activeSession,
      endedAt: new Date().toISOString(),
      joinedParticipantIds: [...new Set(activeSession.joinedParticipantIds || [])],
    };

    clearPendingGroupCallTimeout();
    stopGroupCallDurationTimer();
    setGroupCallDurationSeconds(0);
    groupCallSessionRef.current = null;
    setShowGroupCall(false);

    if (emitAction === 'decline') {
      declineGroupCall({
        chatId: sessionSnapshot.chatId,
        from: sessionSnapshot.initiatorId,
      });
    } else if (emitAction === 'end') {
      endGroupCall(sessionSnapshot.chatId);
    } else if (emitAction === 'leave') {
      leaveGroupCall(sessionSnapshot.chatId);
    } else {
      resetGroupCallState();
    }

    await persistGroupCallSummary(sessionSnapshot, outcome);
  }, [
    clearPendingGroupCallTimeout,
    declineGroupCall,
    endGroupCall,
    leaveGroupCall,
    persistGroupCallSummary,
    resetGroupCallState,
    stopGroupCallDurationTimer,
  ]);

  const closeCurrentChatView = (chatIdToClose = chat._id) => {
    setPinnedMsg(null);
    setScheduledMessages([]);
    setReplyTo(null);
    setMediaViewerMessage(null);
    setShowInfoPanel(false);
    setGroupMemberSearch('');
    setGroupMemberResults([]);
    setAddingGroupMemberId('');
    setAddingGroupContactId('');
    shouldStickToBottomRef.current = true;
    previousMessageCountRef.current = 0;
    removeChatFromState(chatIdToClose);
    navigate('/app');
  };

  const jumpToPinnedMessage = () => {
    if (!pinnedMsg?._id) return;

    const element = document.querySelector(`[data-message-id="${pinnedMsg._id}"]`);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const clearSharedMessageQuery = () => {
    if (!focusedMessageId) return;
    navigate(location.pathname, { replace: true });
  };

  const focusMessageInList = (
    messageId,
    {
      behavior = 'smooth',
      block = 'center',
    } = {}
  ) => {
    const element = messageListRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (!element) return false;

    element.scrollIntoView({ behavior, block });
    setHighlightedMessageId(messageId);
    window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((previous) => (previous === messageId ? '' : previous));
    }, 2200);
    return true;
  };

  const focusSearchResultMessage = useCallback(async (resultMessage) => {
    const messageId = normalizeId(resultMessage?._id);
    if (!messageId) return;

    if (focusMessageInList(messageId)) return;

    shouldStickToBottomRef.current = false;
    setMessages((previous) => {
      const hasMessage = previous.some((item) => normalizeId(item._id) === messageId);
      if (hasMessage) return previous;

      return [...previous, resultMessage].sort(
        (left, right) => new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime()
      );
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        focusMessageInList(messageId);
      });
    });
  }, [setMessages]);

  const updateStickToBottomState = () => {
    const container = messageListRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= 96;
  };

  const scrollMessageListToBottom = (behavior = 'smooth') => {
    const container = messageListRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  useEffect(() => {
    if (isAIBotChat && showInfoPanel) {
      setShowInfoPanel(false);
    }
  }, [isAIBotChat, showInfoPanel]);

  useEffect(() => () => window.clearTimeout(highlightTimeoutRef.current), []);

  useEffect(() => () => {
    clearPendingCallTimeout();
    stopCallDurationTimer();
    resetCallState();
  }, [clearPendingCallTimeout, resetCallState, stopCallDurationTimer]);

  useEffect(() => () => {
    const activeSession = groupCallSessionRef.current;
    if (activeSession?.chatId) {
      if (normalizeId(activeSession.initiatorId) === normalizeId(user._id)) {
        endGroupCall(activeSession.chatId);
      } else {
        leaveGroupCall(activeSession.chatId);
      }
    }

    clearPendingGroupCallTimeout();
    stopGroupCallDurationTimer();
    resetGroupCallState();
  }, [
    clearPendingGroupCallTimeout,
    endGroupCall,
    leaveGroupCall,
    resetGroupCallState,
    stopGroupCallDurationTimer,
    user._id,
  ]);

  useEffect(() => {
    sharedMessageFetchRef.current = '';
  }, [chat._id, focusedMessageId]);

  useEffect(() => {
    setContactAliasDraft(other?.localName || '');
    setIsSavingContactAlias(false);
  }, [other?._id, other?.localName]);

  useEffect(() => {
    setGroupMemberAliasDraft(selectedGroupMember?.localName || '');
    setIsSavingContactAlias(false);
  }, [selectedGroupMember?._id, selectedGroupMember?.localName]);

  useEffect(() => {
    setGroupNameDraft(chat.chatName || '');
    setIsSavingGroupName(false);
  }, [chat._id, chat.chatName]);

  useEffect(() => {
    setMediaViewerMessage(null);
  }, [chat._id]);

  useEffect(() => {
    setReadReceiptMessageId('');
  }, [chat._id]);

  useEffect(() => {
    setIsMessageSearchOpen(false);
    setMessageSearchQuery('');
    setMessageSearchResults([]);
    setActiveSearchResultIndex(0);
    setIsSearchingMessages(false);
  }, [chat._id]);

  useEffect(() => {
    setIsMemberInfoOpen(false);
    setSelectedGroupMemberId('');
  }, [chat._id]);

  useEffect(() => {
    if (!isMessageSearchOpen || !isInfoPanelOpen) return undefined;

    const query = messageSearchQuery.trim();
    if (!query) {
      setMessageSearchResults([]);
      setActiveSearchResultIndex(0);
      setIsSearchingMessages(false);
      return undefined;
    }

    let isCurrent = true;
    setIsSearchingMessages(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await chatService.searchMessages(chat._id, query);
        if (!isCurrent) return;

        const sortedResults = [...(Array.isArray(results) ? results : [])].sort(
          (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime()
        );

        setMessageSearchResults(sortedResults);
        setActiveSearchResultIndex(0);

        if (sortedResults[0]) {
          void focusSearchResultMessage(sortedResults[0]);
        }
      } catch {
        if (!isCurrent) return;
        setMessageSearchResults([]);
        setActiveSearchResultIndex(0);
        toast.error('Search failed');
      } finally {
        if (isCurrent) {
          setIsSearchingMessages(false);
        }
      }
    }, 220);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [chat._id, focusSearchResultMessage, isInfoPanelOpen, isMessageSearchOpen, messageSearchQuery]);

  useEffect(() => {
    const activeSession = callSessionRef.current;
    if (!activeSession) return;

    if (callStatus === 'connecting') {
      clearPendingCallTimeout();
      return;
    }

    if (callStatus === 'in-call' && !activeSession.answeredAt) {
      activeSession.answeredAt = new Date().toISOString();
      clearPendingCallTimeout();
      startCallDurationTimer(activeSession.answeredAt);
      return;
    }

    if (callStatus === 'ended') {
      void completeCallSession(activeSession.answeredAt ? 'completed' : 'missed');
    }
  }, [callStatus, clearPendingCallTimeout, completeCallSession, startCallDurationTimer]);

  useEffect(() => {
    if (!incomingGroupCall || normalizeId(incomingGroupCall.chatId) !== normalizeId(chat._id)) return;

    if (callSessionRef.current || groupCallSessionRef.current) {
      declineGroupCall(incomingGroupCall);
      return;
    }

    groupCallSessionRef.current = {
      chatId: incomingGroupCall.chatId,
      callType: incomingGroupCall.callType,
      initiatorId: incomingGroupCall.initiatorId || incomingGroupCall.from,
      startedAt: new Date().toISOString(),
      answeredAt: null,
      joinedParticipantIds: [normalizeId(incomingGroupCall.initiatorId || incomingGroupCall.from)],
    };
    setGroupCallType(incomingGroupCall.callType);
    setGroupCallDurationSeconds(0);
    setShowGroupCall(true);
    clearPendingGroupCallTimeout();
    groupCallTimeoutRef.current = window.setTimeout(() => {
      void completeGroupCallSession('declined', { emitAction: 'decline' });
    }, CALL_RESPONSE_TIMEOUT_MS);
  }, [chat._id, clearPendingGroupCallTimeout, completeGroupCallSession, declineGroupCall, incomingGroupCall]);

  useEffect(() => {
    const activeSession = groupCallSessionRef.current;
    if (!activeSession) return;

    const joinedParticipantIds = [
      ...(activeSession.joinedParticipantIds || []),
      normalizeId(user._id),
      ...groupRemoteParticipants.map((participant) => normalizeId(participant.participantId)),
    ].filter(Boolean);
    activeSession.joinedParticipantIds = [...new Set(joinedParticipantIds)];

    if (groupRemoteParticipants.length && !activeSession.answeredAt) {
      activeSession.answeredAt = new Date().toISOString();
      clearPendingGroupCallTimeout();
      startGroupCallDurationTimer(activeSession.answeredAt);
    }

    if (groupCallStatus === 'ended') {
      void completeGroupCallSession(activeSession.answeredAt ? 'completed' : 'missed');
    }
  }, [
    clearPendingGroupCallTimeout,
    completeGroupCallSession,
    groupCallStatus,
    groupRemoteParticipants,
    startGroupCallDurationTimer,
    user._id,
  ]);

  useEffect(() => {
    if (!chat.isGroupChat) {
      setIsMemberInfoOpen(false);
      setSelectedGroupMemberId('');
      return;
    }

    const hasSelectedParticipant = groupParticipants.some(
      (participant) => normalizeId(participant) === normalizeId(selectedGroupMemberId)
    );

    if (selectedGroupMemberId && !hasSelectedParticipant) {
      setSelectedGroupMemberId('');
    }
  }, [chat._id, chat.isGroupChat, groupParticipants, selectedGroupMemberId]);

  useEffect(() => {
    if (!chat.isGroupChat || !isInfoPanelOpen || !isGroupAdmin) {
      setGroupMemberSearch('');
      setGroupMemberResults([]);
      setIsSearchingGroupMembers(false);
      return undefined;
    }

    const query = groupMemberSearch.trim();
    if (!query) {
      setGroupMemberResults([]);
      setIsSearchingGroupMembers(false);
      return undefined;
    }

    let isCurrent = true;
    setIsSearchingGroupMembers(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const { data } = await api.get(`/users?search=${encodeURIComponent(query)}`);
        if (!isCurrent) return;

        const existingParticipantIds = new Set(
          (chat.participants || []).map((participant) => normalizeId(participant))
        );

        setGroupMemberResults(
          data.filter((candidate) => !existingParticipantIds.has(normalizeId(candidate)))
        );
      } catch {
        if (!isCurrent) return;
        setGroupMemberResults([]);
      } finally {
        if (isCurrent) {
          setIsSearchingGroupMembers(false);
        }
      }
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [api, chat.isGroupChat, chat.participants, groupMemberSearch, isGroupAdmin, isInfoPanelOpen]);

  useEffect(() => {
    setActiveChatId(chat._id);
    if (isPageVisible) {
      markChatAsRead(chat._id);
    }

    return () => setActiveChatId(null);
  }, [chat._id, isPageVisible, markChatAsRead, setActiveChatId]);

  useEffect(() => {
    if (!chat._id) return undefined;

    let isCurrentChat = true;
    previousMessageCountRef.current = 0;
    shouldStickToBottomRef.current = true;
    socket?.emit('joinRoom', chat._id);
    const shouldOpenFromUnread = Boolean(chat.openFromUnread || chat.unreadCount);
    const messagesRequest = shouldOpenFromUnread
      ? chatService.getMessagesFromFirstUnread(chat._id, {
          limit: 70,
          contextBefore: 10,
        })
      : chatService.getMessages(chat._id);

    Promise.all([messagesRequest, chatService.getScheduledMessages(chat._id)])
      .then(([fetchedMessagesResponse, fetchedScheduledMessages]) => {
        if (!isCurrentChat) return;

        const fetchedMessages = Array.isArray(fetchedMessagesResponse)
          ? fetchedMessagesResponse
          : fetchedMessagesResponse?.messages || [];
        const entryMessageId = Array.isArray(fetchedMessagesResponse)
          ? ''
          : normalizeId(fetchedMessagesResponse?.entryMessageId);

        setMessages(fetchedMessages);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (entryMessageId) {
              focusMessageInList(entryMessageId, {
                behavior: 'auto',
                block: 'start',
              });
              return;
            }

            scrollMessageListToBottom('auto');
          });
        });
        setScheduledMessages(sortScheduledMessagesByTime(fetchedScheduledMessages));
        setEditingScheduledId('');
        setScheduledDraft('');
        setSavingScheduledId('');
        setRemovingScheduledId('');
        setShowScheduledKeyboard(false);
      })
      .catch(console.error);

    if (chat.pinnedMessages?.length) {
      const pinnedMessageIds = chat.pinnedMessages.map((item) => normalizeId(item));
      let nextDismissedPinnedMessageId = dismissedPinnedMessageId;

      if (nextDismissedPinnedMessageId && !pinnedMessageIds.includes(nextDismissedPinnedMessageId)) {
        clearDismissedPinnedMessageId(user._id, chat._id);
        nextDismissedPinnedMessageId = '';
        setDismissedPinnedMessageIdState('');
      }

      const lastPinned = chat.pinnedMessages[chat.pinnedMessages.length - 1];
      if (
        normalizeId(lastPinned?._id) !== normalizeId(nextDismissedPinnedMessageId) &&
        (lastPinned?.content || lastPinned?.mediaUrl || lastPinned?.poll?.question || lastPinned?.location?.address)
      ) {
        setPinnedMsg(lastPinned);
      } else {
        setPinnedMsg(null);
      }
    } else {
      clearDismissedPinnedMessageId(user._id, chat._id);
      setDismissedPinnedMessageIdState('');
      setPinnedMsg(null);
    }

    return () => {
      isCurrentChat = false;
      socket?.emit('leaveRoom', chat._id);
    };
  }, [chat._id, chat.pinnedMessages, dismissedPinnedMessageId, setMessages, socket, user._id]);

  useEffect(() => {
    if (!focusedMessageId || !messages.length) return undefined;

    if (focusMessageInList(focusedMessageId)) {
      clearSharedMessageQuery();
      return undefined;
    }

    if (sharedMessageFetchRef.current === focusedMessageId) return undefined;
    sharedMessageFetchRef.current = focusedMessageId;

    let isMounted = true;

    chatService
      .getMessages(chat._id, 1, 400)
      .then((fetchedMessages) => {
        if (!isMounted) return;

        const nextMessages = Array.isArray(fetchedMessages) ? fetchedMessages : [];
        setMessages(nextMessages);

        if (!nextMessages.some((message) => normalizeId(message._id) === focusedMessageId)) {
          toast.error('Could not find that shared item in this chat');
          clearSharedMessageQuery();
        }
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error('Failed to open that shared item');
        clearSharedMessageQuery();
      });

    return () => {
      isMounted = false;
    };
  }, [chat._id, focusedMessageId, messages, setMessages]);

  useEffect(() => {
    if (!socket || !isPageVisible) return;

    const unreadMessageIds = messages
      .filter((message) => matchesChatId(message.chatId, chat._id))
      .filter((message) => isIncomingMessageForUser(message, user._id))
      .filter((message) => !hasSeenMessage(message, user._id))
      .map((message) => message._id);

    if (!unreadMessageIds.length) return;

    unreadMessageIds.forEach((messageId) => {
      socket.emit('messageRead', { messageId, chatId: chat._id });
    });

    markChatAsRead(chat._id);
    setMessages((previous) =>
      previous.map((message) =>
        unreadMessageIds.includes(message._id)
          ? {
              ...message,
              status: 'seen',
              seenBy: [...new Set([...(message.seenBy || []), user._id])],
            }
          : message
      )
    );
  }, [chat._id, isPageVisible, markChatAsRead, messages, setMessages, socket, user._id]);

  useEffect(() => {
    if (!socket) return undefined;

    const messageHandler = (incomingMessage) => {
      if (matchesChatId(incomingMessage.chatId, chat._id)) {
        addMessage(incomingMessage);
        const incomingId = normalizeId(incomingMessage._id);
        setScheduledMessages((previous) =>
          previous.filter((item) => normalizeId(item._id) !== incomingId)
        );
        if (editingScheduledId === incomingId) {
          setEditingScheduledId('');
          setScheduledDraft('');
          setSavingScheduledId('');
          setShowScheduledKeyboard(false);
        }
      }
    };

    const reactionHandler = ({ messageId, reactions }) => {
      setMessages((previous) =>
        previous.map((item) => (item._id === messageId ? { ...item, reactions } : item))
      );
    };

    const pollUpdatedHandler = ({ message }) => {
      if (!matchesChatId(message?.chatId, chat._id)) return;

      setMessages((previous) =>
        previous.map((item) => (normalizeId(item._id) === normalizeId(message._id) ? { ...item, ...message } : item))
      );
      setPinnedMsg((previous) =>
        normalizeId(previous?._id) === normalizeId(message._id)
          ? { ...previous, ...message }
          : previous
      );
    };

    const messageEditedHandler = ({ message }) => {
      if (!matchesChatId(message?.chatId, chat._id)) return;

      setPinnedMsg((previous) =>
        normalizeId(previous?._id) === normalizeId(message._id)
          ? { ...previous, ...message }
          : previous
      );
    };

    const deleteForEveryoneHandler = ({ message }) => {
      if (!matchesChatId(message.chatId, chat._id)) return;

      setMessages((previous) => applyDeletedMessageToState(previous, message));
      setPinnedMsg((previous) => (previous?._id === message._id ? null : previous));
    };

    const deleteForMeHandler = ({ messageId, chatId }) => {
      if (!matchesChatId(chatId, chat._id)) return;

      setMessages((previous) => removeMessageFromState(previous, messageId));
      setPinnedMsg((previous) => (previous?._id === messageId ? null : previous));
    };

    const messageStatusHandler = ({ messageId, status, userId: readerId }) => {
      const normalizedMessageId = normalizeId(messageId);
      const normalizedReaderId = normalizeId(readerId);

      if (!normalizedMessageId) return;

      setMessages((previous) =>
        previous.map((item) => {
          if (normalizeId(item._id) !== normalizedMessageId) return item;

          const nextSeenBy = normalizedReaderId
            ? [...new Set([...(item.seenBy || []).map((entry) => normalizeId(entry)).filter(Boolean), normalizedReaderId])]
            : item.seenBy;

          return {
            ...item,
            ...(status ? { status } : {}),
            ...(normalizedReaderId ? { seenBy: nextSeenBy } : {}),
          };
        })
      );
    };

    const incomingCallHandler = ({ signal, from, callType: nextCallType, chatId: incomingChatId }) => {
      if (incomingChatId && normalizeId(incomingChatId) !== normalizeId(chat._id)) return;

      if (callSessionRef.current || groupCallSessionRef.current) {
        socket.emit('declineCall', {
          to: from,
          chatId: incomingChatId || chat._id,
          reason: 'busy',
        });
        return;
      }

      callSessionRef.current = {
        chatId: incomingChatId || chat._id,
        callType: nextCallType,
        initiatorId: from,
        receiverId: user._id,
        startedAt: new Date().toISOString(),
        answeredAt: null,
      };
      setCaller({ id: from, signal, callType: nextCallType, chatId: incomingChatId || chat._id });
      setCallType(nextCallType);
      setCallDurationSeconds(0);
      setCallStatus('incoming');
      setShowCall(true);
      playNotificationSound();
      clearPendingCallTimeout();
      callTimeoutRef.current = window.setTimeout(() => {
        void completeCallSession('missed', {
          emitAction: 'decline',
          remoteUserId: from,
          declineReason: 'timeout',
        });
      }, CALL_RESPONSE_TIMEOUT_MS);
    };

    const callDeclinedHandler = ({ chatId: callChatId, reason = 'declined' }) => {
      if (callChatId && normalizeId(callChatId) !== normalizeId(chat._id)) return;
      void completeCallSession(reason === 'declined' ? 'declined' : 'missed');
    };

    const callEndedHandler = ({ chatId: callChatId }) => {
      if (callChatId && normalizeId(callChatId) !== normalizeId(chat._id)) return;

      const activeSession = callSessionRef.current;
      if (!activeSession) {
        setShowCall(false);
        resetCallState();
        return;
      }

      void completeCallSession(activeSession.answeredAt ? 'completed' : 'missed');
    };

    socket.on('receiveMessage', messageHandler);
    socket.on('reactionUpdated', reactionHandler);
    socket.on('pollUpdated', pollUpdatedHandler);
    socket.on('messageEdited', messageEditedHandler);
    socket.on('messageDeletedForEveryone', deleteForEveryoneHandler);
    socket.on('messageDeletedForMe', deleteForMeHandler);
    socket.on('messageStatusUpdate', messageStatusHandler);
    socket.on('incomingCall', incomingCallHandler);
    socket.on('callDeclined', callDeclinedHandler);
    socket.on('callEnded', callEndedHandler);

    return () => {
      socket.off('receiveMessage', messageHandler);
      socket.off('reactionUpdated', reactionHandler);
      socket.off('pollUpdated', pollUpdatedHandler);
      socket.off('messageEdited', messageEditedHandler);
      socket.off('messageDeletedForEveryone', deleteForEveryoneHandler);
      socket.off('messageDeletedForMe', deleteForMeHandler);
      socket.off('messageStatusUpdate', messageStatusHandler);
      socket.off('incomingCall', incomingCallHandler);
      socket.off('callDeclined', callDeclinedHandler);
      socket.off('callEnded', callEndedHandler);
    };
  }, [addMessage, chat._id, clearPendingCallTimeout, completeCallSession, editingScheduledId, playNotificationSound, resetCallState, setCallStatus, setCaller, setMessages, socket, user._id]);

  useEffect(() => {
    const nextCount = messages.length;
    const previousCount = previousMessageCountRef.current;
    const hasNewMessage = nextCount > previousCount;

    if (hasNewMessage && shouldStickToBottomRef.current) {
      requestAnimationFrame(() => {
        scrollMessageListToBottom(previousCount === 0 ? 'auto' : 'smooth');
      });
    }

    previousMessageCountRef.current = nextCount;
  }, [messages.length]);

  const handleSend = async ({ content, messageType, mediaUrl, scheduledTime, location, poll }) => {
    if (scheduledTime) {
      try {
        const response = await chatService.sendMessage({
          chatId: chat._id,
          content,
          messageType,
          mediaUrl,
          location,
          poll,
          replyTo: replyTo?._id || null,
          scheduledTime,
        });
        if (response?.message) {
          setScheduledMessages((previous) =>
            sortScheduledMessagesByTime([
              ...previous.filter((item) => normalizeId(item._id) !== normalizeId(response.message._id)),
              response.message,
            ])
          );
        }
        setReplyTo(null);
        toast.success('Message scheduled');
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to schedule message');
        return false;
      }
    }

    if (!socket?.connected) {
      try {
        const response = await chatService.sendMessage({
          chatId: chat._id,
          content,
          messageType,
          mediaUrl,
          location,
          poll,
          replyTo: replyTo?._id || null,
        });
        if (response?.message) {
          addMessage(response.message);
        }
        if (response?.aiMessage) {
          addMessage(response.aiMessage);
        }
        setReplyTo(null);
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to send message');
        return false;
      }
    }

    socket.emit('sendMessage', {
      chatId: chat._id,
      content,
      messageType,
      mediaUrl,
      location,
      poll,
      replyTo: replyTo?._id || null,
    });

    setReplyTo(null);
    return true;
  };

  const handleReact = (message, emoji) => {
    const ownReaction = getOwnReactionEmoji(message, user._id);

    if (ownReaction === emoji) {
      socket?.emit('removeReaction', { messageId: message._id, chatId: chat._id, emoji });
      return;
    }

    socket?.emit('addReaction', { messageId: message._id, chatId: chat._id, emoji });
  };

  const handleRemoveReaction = (message) => {
    const ownReaction = getOwnReactionEmoji(message, user._id);
    if (!ownReaction) return;

    socket?.emit('removeReaction', { messageId: message._id, chatId: chat._id, emoji: ownReaction });
  };

  const handleOpenReadReceipts = (message) => {
    if (!chat.isGroupChat) return;

    setReadReceiptMessageId(normalizeId(message?._id));
  };

  const handleDismissPinnedMessage = () => {
    if (!pinnedMsg?._id) return;

    const pinnedMessageId = normalizeId(pinnedMsg._id);
    setDismissedPinnedMessageId(user._id, chat._id, pinnedMessageId);
    setDismissedPinnedMessageIdState(pinnedMessageId);
    setPinnedMsg(null);
  };

  const handlePin = async (messageId, isCurrentlyPinned = false) => {
    try {
      const message = isCurrentlyPinned
        ? await chatService.unpinMessage(messageId)
        : await chatService.pinMessage(messageId);

      clearDismissedPinnedMessageId(user._id, chat._id);
      setDismissedPinnedMessageIdState('');
      setPinnedMsg(isCurrentlyPinned ? null : message);
      setMessages((previous) =>
        previous.map((item) =>
          normalizeId(item._id) === normalizeId(messageId) ? { ...item, isPinned: !isCurrentlyPinned } : item
        )
      );

      const updatePinnedList = (entry) => {
        if (normalizeId(entry._id) !== normalizeId(chat._id)) return entry;

        const filtered = (entry.pinnedMessages || []).filter((item) => normalizeId(item) !== normalizeId(messageId));
        return {
          ...entry,
          pinnedMessages: isCurrentlyPinned ? filtered : [...filtered, message],
        };
      };

      setChats((previous) => previous.map(updatePinnedList));
      setSelectedChat((previous) => (normalizeId(previous?._id) === normalizeId(chat._id) ? updatePinnedList(previous) : previous));

      toast.success(isCurrentlyPinned ? 'Message unpinned' : 'Message pinned');
    } catch {
      toast.error(isCurrentlyPinned ? 'Failed to unpin message' : 'Failed to pin message');
    }
  };

  const handlePollVote = async (messageId, optionId) => {
    try {
      const updatedMessage = await chatService.votePoll(messageId, optionId);
      setMessages((previous) =>
        previous.map((item) =>
          normalizeId(item._id) === normalizeId(updatedMessage._id) ? { ...item, ...updatedMessage } : item
        )
      );
      setPinnedMsg((previous) =>
        normalizeId(previous?._id) === normalizeId(updatedMessage._id)
          ? { ...previous, ...updatedMessage }
          : previous
      );
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to vote in poll');
    }
  };

  const handleDelete = async (messageId, scope = 'me') => {
    try {
      const response = await chatService.deleteMessage(messageId, scope);

      if (scope === 'everyone' && response.deletedMessage) {
        setMessages((previous) => applyDeletedMessageToState(previous, response.deletedMessage));
        setPinnedMsg((previous) => (previous?._id === messageId ? null : previous));
        toast.success('Message deleted for everyone');
        return;
      }

      setMessages((previous) => removeMessageFromState(previous, messageId));
      setPinnedMsg((previous) => (previous?._id === messageId ? null : previous));
      toast.success('Message removed from your chat');
    } catch {
      toast.error('Failed to delete message');
    }
  };

  const handleEdit = async (message) => {
    const currentContent = message.content || '';
    const nextDraft = window.prompt('Edit message', currentContent);

    if (nextDraft === null) return;

    const allowsEmptyContent = Boolean(message.mediaUrl) || message.messageType === 'location';
    const nextContent = allowsEmptyContent ? nextDraft : nextDraft.trim();
    const currentValue = allowsEmptyContent ? currentContent : currentContent.trim();

    if (message.messageType === 'poll' && !nextContent.trim()) {
      toast.error('Poll question cannot be empty');
      return;
    }

    if (!nextContent && !allowsEmptyContent && message.messageType !== 'poll') {
      toast.error('Message cannot be empty');
      return;
    }

    if (nextContent === currentValue) {
      return;
    }

    try {
      const updatedMessage = await chatService.editMessage(message._id, nextContent);
      setMessages((previous) => applyEditedMessageToState(previous, updatedMessage));
      setPinnedMsg((previous) =>
        normalizeId(previous?._id) === normalizeId(updatedMessage._id)
          ? { ...previous, ...updatedMessage }
          : previous
      );
      toast.success('Message edited');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to edit message');
    }
  };

  const handleSaveContactAlias = async (
    targetParticipant = other,
    nextAlias = normalizedContactAliasDraft,
    onDraftSaved = setContactAliasDraft
  ) => {
    const targetUserId = normalizeId(targetParticipant?._id);
    const existingAlias = targetParticipant?.localName?.trim() || '';

    if (!targetUserId) return;
    if (nextAlias === existingAlias) return;

    setIsSavingContactAlias(true);

    try {
      const response = await userService.updateContactAlias(targetUserId, nextAlias);
      const savedAlias = response.alias || '';

      updateUser((previous) =>
        previous
          ? {
              ...previous,
              contactAliases: response.contactAliases || previous.contactAliases || {},
            }
          : previous
      );
      setChats((previous) => previous.map((entry) => applyContactAliasToChat(entry, targetUserId, savedAlias)));
      setSelectedChat((previous) => applyContactAliasToChat(previous, targetUserId, savedAlias));
      setMessages((previous) => applyContactAliasToMessages(previous, targetUserId, savedAlias));
      onDraftSaved(savedAlias);
      toast.success(savedAlias ? 'Custom name saved' : 'Custom name removed');
    } catch (error) {
      if (!error.response) {
        toast.error('Could not reach the backend. Make sure the server is running.');
      } else if (error.response.status === 404) {
        toast.error('Custom names need the latest backend. Restart the backend and try again.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to update custom name');
      }
    } finally {
      setIsSavingContactAlias(false);
    }
  };

  const handleAddGroupMember = async (candidate) => {
    if (!chat.isGroupChat || !candidate?._id) return;

    setAddingGroupMemberId(candidate._id);

    try {
      const data = await groupService.addMember(chat._id, candidate._id);
      if (data?.approvalRequired) {
        setGroupMemberSearch('');
        setGroupMemberResults([]);
        toast.success(data.message || `Invite request sent to ${candidate.name}`);
        return;
      }

      syncChatState(data.chat || data);
      setGroupMemberSearch('');
      setGroupMemberResults([]);
      toast.success(data.message || `${candidate.name} added to the group`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingGroupMemberId('');
    }
  };

  const handleAddGroupMemberFromSearch = async () => {
    if (!chat.isGroupChat || !isGroupAdmin) return;

    const query = groupMemberSearch.trim();
    if (!query) {
      toast.error('Enter a name or email to invite');
      return;
    }

    const exactEmailMatch = groupMemberResults.find(
      (candidate) => candidate.email?.toLowerCase() === query.toLowerCase()
    );
    const fallbackCandidate = exactEmailMatch || (groupMemberResults.length === 1 ? groupMemberResults[0] : null);

    if (fallbackCandidate) {
      await handleAddGroupMember(fallbackCandidate);
      return;
    }

    try {
      setIsSearchingGroupMembers(true);
      const { data } = await api.get(`/users?search=${encodeURIComponent(query)}`);
      const existingParticipantIds = new Set(
        (chat.participants || []).map((participant) => normalizeId(participant))
      );
      const candidates = data.filter((candidate) => !existingParticipantIds.has(normalizeId(candidate)));
      const fetchedExactEmailMatch = candidates.find(
        (candidate) => candidate.email?.toLowerCase() === query.toLowerCase()
      );

      setGroupMemberResults(candidates);

      if (!fetchedExactEmailMatch) {
        toast.error('No account found for that email. Ask them to sign up first.');
        return;
      }

      await handleAddGroupMember(fetchedExactEmailMatch);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to find this member');
    } finally {
      setIsSearchingGroupMembers(false);
    }
  };

  const openAddMemberPanel = () => {
    setShowInfoPanel(true);
    window.setTimeout(() => {
      groupMemberSearchRef.current?.focus();
      groupMemberSearchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleAddGroupContact = async (participant) => {
    if (!participant?._id) return;

    setAddingGroupContactId(participant._id);

    try {
      const response = await userService.addContact(participant._id);
      updateUser((previous) =>
        previous
          ? {
              ...previous,
              contacts: response.contacts || previous.contacts || [],
              friends: response.friends || previous.friends || [],
            }
          : previous
      );
      setChats((previous) =>
        previous.map((entry) =>
          applyParticipantStateToChat(entry, participant._id, {
            isContact: true,
          })
        )
      );
      setSelectedChat((previous) =>
        applyParticipantStateToChat(previous, participant._id, {
          isContact: true,
        })
      );
      toast.success(`${participant.name} added to your contacts`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add contact');
    } finally {
      setAddingGroupContactId('');
    }
  };

  const handleSaveGroupName = async () => {
    const nextGroupName = groupNameDraft.trim();

    if (!chat.isGroupChat) return;
    if (!nextGroupName) {
      toast.error('Group name is required');
      return;
    }

    if (nextGroupName === (chat.chatName || '').trim()) {
      return;
    }

    setIsSavingGroupName(true);

    try {
      const { data } = await api.put(`/groups/${chat._id}/name`, { chatName: nextGroupName });
      syncChatState(data);
      setGroupNameDraft(data.chatName || nextGroupName);
      toast.success('Group name updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update group name');
    } finally {
      setIsSavingGroupName(false);
    }
  };

  const handleStartDirectCall = async (nextCallType) => {
    if (!other?._id) return;

    if (callSessionRef.current || groupCallSessionRef.current) {
      toast('A call is already in progress.');
      return;
    }

    callSessionRef.current = {
      chatId: chat._id,
      callType: nextCallType,
      initiatorId: user._id,
      receiverId: other._id,
      startedAt: new Date().toISOString(),
      answeredAt: null,
    };
    setCallType(nextCallType);
    setCallDurationSeconds(0);
    setShowCall(true);

    try {
      await startCall(other._id, nextCallType, { chatId: chat._id });
      clearPendingCallTimeout();
      callTimeoutRef.current = window.setTimeout(() => {
        void completeCallSession('missed', {
          emitAction: 'end',
          remoteUserId: other._id,
          endReason: 'missed',
        });
      }, CALL_RESPONSE_TIMEOUT_MS);
    } catch (error) {
      callSessionRef.current = null;
      setShowCall(false);
      setCallDurationSeconds(0);
      resetCallState();
      toast.error(error?.message || `Could not start the ${nextCallType === 'video' ? 'video' : 'voice'} call`);
    }
  };

  const handleAnswerIncomingCall = async () => {
    if (!caller?.id || !caller?.signal) return;

    try {
      await answerCall(caller.signal, caller.id, callType, { chatId: chat._id });
    } catch (error) {
      void completeCallSession('missed', {
        emitAction: 'decline',
        remoteUserId: caller.id,
        declineReason: 'error',
      });
      toast.error(error?.message || 'Could not answer the call');
    }
  };

  const handleDeclineIncomingCall = () => {
    if (!caller?.id) {
      void completeCallSession('declined');
      return;
    }

    void completeCallSession('declined', {
      emitAction: 'decline',
      remoteUserId: caller.id,
      declineReason: 'declined',
    });
  };

  const handleEndActiveCall = () => {
    const activeSession = callSessionRef.current;
    const remoteUserId = normalizeId(activeSession?.initiatorId) === normalizeId(user._id)
      ? activeSession?.receiverId
      : activeSession?.initiatorId;

    void completeCallSession(activeSession?.answeredAt ? 'completed' : 'missed', {
      emitAction: remoteUserId ? 'end' : 'none',
      remoteUserId,
      endReason: activeSession?.answeredAt ? 'ended' : 'missed',
    });
  };

  const handleCloseCallModal = () => {
    if (callStatus === 'incoming') {
      handleDeclineIncomingCall();
      return;
    }

    handleEndActiveCall();
  };

  const startVideoCall = () => {
    void handleStartDirectCall('video');
  };

  const startVoiceCall = () => {
    void handleStartDirectCall('audio');
  };

  const handleStartGroupCall = async (nextCallType) => {
    const otherParticipantIds = groupParticipants
      .map((participant) => normalizeId(participant))
      .filter((participantId) => participantId && participantId !== normalizeId(user._id));

    if (!otherParticipantIds.length) {
      toast.error('Add more members before starting a group call');
      return;
    }

    if (callSessionRef.current || groupCallSessionRef.current) {
      toast('A call is already in progress.');
      return;
    }

    groupCallSessionRef.current = {
      chatId: chat._id,
      callType: nextCallType,
      initiatorId: user._id,
      startedAt: new Date().toISOString(),
      answeredAt: null,
      joinedParticipantIds: [normalizeId(user._id)],
    };
    setGroupCallType(nextCallType);
    setGroupCallDurationSeconds(0);
    setShowGroupCall(true);

    try {
      await startGroupCall(chat._id, otherParticipantIds, nextCallType);
      clearPendingGroupCallTimeout();
      groupCallTimeoutRef.current = window.setTimeout(() => {
        void completeGroupCallSession('missed', { emitAction: 'end' });
      }, CALL_RESPONSE_TIMEOUT_MS);
    } catch (error) {
      groupCallSessionRef.current = null;
      setShowGroupCall(false);
      setGroupCallDurationSeconds(0);
      resetGroupCallState();
      toast.error(error?.message || `Could not start the ${nextCallType === 'video' ? 'video' : 'voice'} group call`);
    }
  };

  const handleAnswerGroupCall = async () => {
    if (!incomingGroupCall) return;

    try {
      await answerGroupCall(incomingGroupCall);
    } catch (error) {
      void completeGroupCallSession('declined', { emitAction: 'decline' });
      toast.error(error?.message || 'Could not join the group call');
    }
  };

  const handleDeclineGroupCall = () => {
    void completeGroupCallSession('declined', { emitAction: 'decline' });
  };

  const handleLeaveGroupCall = () => {
    const activeSession = groupCallSessionRef.current;
    if (!activeSession) {
      setShowGroupCall(false);
      resetGroupCallState();
      return;
    }

    const isHost = normalizeId(activeSession.initiatorId) === normalizeId(user._id);
    void completeGroupCallSession(activeSession.answeredAt ? 'completed' : 'missed', {
      emitAction: isHost ? 'end' : 'leave',
    });
  };

  const startGroupVideoCall = () => {
    void handleStartGroupCall('video');
  };

  const startGroupVoiceCall = () => {
    void handleStartGroupCall('audio');
  };

  const handleMute = async () => {
    const shouldMute = !isMutedChat;

    setIsUpdatingMute(true);

    try {
      const response = shouldMute
        ? await chatService.muteChat(chat._id)
        : await chatService.unmuteChat(chat._id);
      const nextChat = response?.chat || { ...chat, isMuted: shouldMute };

      syncChatState(nextChat);
      updateUser((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          mutedChats: updateMutedChatIds(previous.mutedChats, chat._id, shouldMute),
        };
      });
      toast.success(response?.message || (shouldMute ? 'Chat muted' : 'Chat unmuted'));
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${shouldMute ? 'mute' : 'unmute'} chat`);
    } finally {
      setIsUpdatingMute(false);
    }
  };

  const handleClearChat = async () => {
    const confirmed = window.confirm(
      isAIBotChat
        ? 'Clear this AI conversation? You can start fresh anytime.'
        : 'Clear this conversation from your view?'
    );

    if (!confirmed) return;

    try {
      await chatService.clearChat(chat._id);
      setMessages([]);
      setPinnedMsg(null);
      setScheduledMessages([]);
      setReplyTo(null);
      shouldStickToBottomRef.current = true;
      previousMessageCountRef.current = 0;

      setChats((previous) =>
        previous.map((entry) =>
          normalizeId(entry._id) === normalizeId(chat._id)
            ? {
                ...entry,
                lastMessage: null,
                unreadCount: 0,
                scheduledPreview: null,
              }
            : entry
        )
      );

      setSelectedChat((previous) =>
        normalizeId(previous?._id) === normalizeId(chat._id)
          ? {
              ...previous,
              lastMessage: null,
              unreadCount: 0,
              scheduledPreview: null,
            }
          : previous
      );

      toast.success(isAIBotChat ? 'AI chat cleared' : 'Chat cleared from your view');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to clear chat');
    }
  };

  const handleDeleteConversation = async () => {
    if (chat.isGroupChat) return;

    const confirmed = window.confirm(
      isAIBotChat
        ? 'Delete this AI chat from your sidebar? A new AI message will create a fresh thread.'
        : 'Delete this chat from your sidebar? New messages from this person can bring it back.'
    );

    if (!confirmed) return;

    setIsDeletingConversation(true);

    try {
      const response = await chatService.deleteChat(chat._id);
      closeCurrentChatView(response?.chatId || chat._id);
      toast.success(response?.message || 'Chat deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete chat');
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!chat.isGroupChat) return;

    const confirmed = window.confirm(
      'Leave this group? You will stop receiving messages until someone adds you again.'
    );
    if (!confirmed) return;

    setIsLeavingGroup(true);

    try {
      const response = await chatService.leaveGroup(chat._id);
      closeCurrentChatView(response?.chatId || chat._id);
      toast.success(response?.message || 'You left the group');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to leave group');
    } finally {
      setIsLeavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!chat.isGroupChat) return;

    const confirmed = window.confirm(
      'Delete this group for everyone? This will remove the group chat and its messages for all members.'
    );
    if (!confirmed) return;

    setIsDeletingGroup(true);

    try {
      const response = await chatService.deleteGroup(chat._id);
      closeCurrentChatView(response?.chatId || chat._id);
      toast.success(response?.message || 'Group deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete group');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleSearch = () => {
    setIsMessageSearchOpen(true);
    requestAnimationFrame(() => {
      messageSearchInputRef.current?.focus();
    });
  };

  const handleExportChat = async () => {
    const confirmed = window.confirm(
      `Export ${chatName}? This will download a text copy of this conversation to your device.`
    );

    if (!confirmed) return;

    setIsExportingChat(true);

    try {
      const pageSize = 200;
      const exportedMessageMap = new Map();
      let page = 1;

      while (page <= 50) {
        const batch = await chatService.getMessages(chat._id, page, pageSize);
        if (!Array.isArray(batch) || !batch.length) {
          break;
        }

        batch.forEach((message) => {
          const messageId = normalizeId(message?._id) || `${page}-${message?.createdAt || exportedMessageMap.size}`;
          exportedMessageMap.set(messageId, message);
        });

        if (batch.length < pageSize) {
          break;
        }

        page += 1;
      }

      const exportedMessages = sortMessagesByCreatedAt(Array.from(exportedMessageMap.values()));
      const participantLabels = (Array.isArray(chat.participants) ? chat.participants : [])
        .map((participant) => getParticipantDisplayName(participant))
        .filter(Boolean)
        .join(', ');
      const transcriptLines = [
        'Nexus Chat Export',
        `Conversation: ${chatName}`,
        `Chat ID: ${chat._id}`,
        `Type: ${chat.isGroupChat ? 'Group chat' : 'Direct chat'}`,
        `Participants: ${participantLabels || chatName}`,
        `Exported: ${format(new Date(), 'yyyy-MM-dd hh:mm a')}`,
        '',
      ];

      if (!exportedMessages.length) {
        transcriptLines.push('No sent messages were available to export.');
      } else {
        exportedMessages.forEach((message) => {
          const timestamp = message?.createdAt
            ? format(new Date(message.createdAt), 'yyyy-MM-dd hh:mm a')
            : 'Unknown time';
          transcriptLines.push(
            `[${timestamp}] ${getMessageSenderLabel(message, user._id)}: ${buildMessageExportBody(message, user._id)}`
          );
        });
      }

      downloadTextFile(
        `${sanitizeFileNameSegment(chatName)}-${format(new Date(), 'yyyyMMdd-HHmm')}.txt`,
        transcriptLines.join('\n')
      );
      toast.success('Chat exported');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to export chat');
    } finally {
      setIsExportingChat(false);
    }
  };

  const handleBlockUser = async () => {
    if (!canBlockUser || isOtherUserBlocked) return;

    const targetLabel = other?.localName || other?.name || 'this user';
    const confirmed = window.confirm(
      `Block ${targetLabel}? This will hide the chat and stop direct messages between you.`
    );

    if (!confirmed) return;

    setIsBlockingUser(true);

    try {
      const response = await userService.blockUser(other._id);

      if (response?.user) {
        updateUser(response.user);
      } else {
        updateUser((previous) =>
          previous
            ? {
                ...previous,
                blockedUsers: [...(previous.blockedUsers || []), other._id],
                hiddenChats: [...(previous.hiddenChats || []), chat._id],
              }
            : previous
        );
      }

      toast.success(response?.message || `${targetLabel} blocked`);
      closeCurrentChatView(chat._id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to block user');
    } finally {
      setIsBlockingUser(false);
    }
  };

  const handleSearchResultNavigation = (direction) => {
    if (!messageSearchResults.length) return;

    setActiveSearchResultIndex((previous) => {
      const nextIndex = direction === 'older'
        ? Math.min(previous + 1, messageSearchResults.length - 1)
        : Math.max(previous - 1, 0);
      const nextResult = messageSearchResults[nextIndex];

      if (nextResult) {
        void focusSearchResultMessage(nextResult);
      }

      return nextIndex;
    });
  };

  const handleRequestResponse = async (action) => {
    setIsRespondingToRequest(true);

    try {
      const nextChat = await chatService.respondToRequest(chat._id, action);
      syncChatState(nextChat);
      toast.success(action === 'accept' ? 'Request allowed' : 'Request removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update request');
    } finally {
      setIsRespondingToRequest(false);
    }
  };

  const handleShareMessage = async (message) => {
    const shareText = message.content?.trim() || getMessagePreviewText(message);
    const sharePayload = {
      title: 'Shared from NexChat',
      text: shareText,
      ...(message.mediaUrl ? { url: message.mediaUrl } : {}),
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }

      const clipboardText = [shareText, message.mediaUrl].filter(Boolean).join('\n');
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(clipboardText);
      toast.success('Message details copied to clipboard');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      toast.error('Unable to share this message');
    }
  };

  const handleOpenMediaViewer = (message) => {
    if (!message?.mediaUrl) return;
    setMediaViewerMessage(message);
  };

  const handleOpenSharedContent = (mode) => {
    if (mode === 'media' && !mediaMessages.length) {
      toast('No shared media yet.');
      return;
    }

    if (mode === 'links' && !sharedLinks.length) {
      toast('No shared links yet.');
      return;
    }
    navigate(`/chat/${chat._id}/shared?tab=${mode}`);
  };

  const handleCopyMessage = async (message) => {
    const copyText = [message.content?.trim(), message.mediaUrl].filter(Boolean).join('\n') || getMessagePreviewText(message);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }

      await navigator.clipboard.writeText(copyText);
      toast.success('Message copied');
    } catch {
      toast.error('Unable to copy this message');
    }
  };

  const handleOpenForwardModal = (message) => {
    setForwardMessage(message);
    setForwardSearch('');
    setSelectedForwardChatIds([]);
  };

  const toggleForwardTarget = (chatId) => {
    setSelectedForwardChatIds((previous) =>
      previous.includes(chatId)
        ? previous.filter((id) => id !== chatId)
        : [...previous, chatId]
    );
  };

  const closeForwardModal = (force = false) => {
    if (isForwarding && !force) return;
    setForwardMessage(null);
    setForwardSearch('');
    setSelectedForwardChatIds([]);
  };

  const handleForwardMessage = async () => {
    if (!forwardMessage) return;
    if (!selectedForwardChatIds.length) {
      toast.error('Select at least one conversation');
      return;
    }

    setIsForwarding(true);

    try {
      const results = await Promise.allSettled(
        selectedForwardChatIds.map((targetChatId) =>
          chatService.sendMessage({
            chatId: targetChatId,
            content: forwardMessage.content || '',
            messageType: forwardMessage.messageType || 'text',
            mediaUrl: forwardMessage.mediaUrl || '',
            location: forwardMessage.location || null,
            poll: forwardMessage.poll || null,
            isForwarded: true,
          })
        )
      );

      const successCount = results.filter((result) => result.status === 'fulfilled').length;

      if (!successCount) {
        toast.error('Failed to forward message');
        return;
      }

      setIsForwarding(false);
      toast.success(
        successCount === 1 ? 'Message forwarded' : `Message forwarded to ${successCount} chats`
      );
      closeForwardModal(true);
    } catch {
      toast.error('Failed to forward message');
    } finally {
      setIsForwarding(false);
    }
  };

  const handleRemoveScheduledMessage = async (messageId) => {
    setRemovingScheduledId(messageId);

    try {
      await chatService.cancelScheduledMessage(messageId);
      setScheduledMessages((previous) =>
        previous.filter((item) => normalizeId(item._id) !== normalizeId(messageId))
      );
      if (editingScheduledId === messageId) {
        setEditingScheduledId('');
        setScheduledDraft('');
        setShowScheduledKeyboard(false);
      }
      toast.success('Scheduled message removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove scheduled message');
    } finally {
      setRemovingScheduledId('');
    }
  };

  const startScheduledEdit = (message) => {
    setEditingScheduledId(message._id);
    setScheduledDraft(message.content || '');
    setShowScheduledKeyboard(false);
  };

  const cancelScheduledEdit = () => {
    setEditingScheduledId('');
    setScheduledDraft('');
    setSavingScheduledId('');
    setShowScheduledKeyboard(false);
  };

  const handleSaveScheduledEdit = async (message) => {
    const nextContent = message.mediaUrl ? scheduledDraft : scheduledDraft.trim();

    if (!nextContent && !message.mediaUrl) {
      toast.error('Message cannot be empty');
      return;
    }

    setSavingScheduledId(message._id);

    try {
      const updatedMessage = await chatService.editMessage(message._id, nextContent);
      setScheduledMessages((previous) =>
        previous.map((item) =>
          normalizeId(item._id) === normalizeId(message._id)
            ? { ...item, ...updatedMessage, content: updatedMessage.content ?? nextContent }
            : item
        )
      );
      setEditingScheduledId('');
      setScheduledDraft('');
      setShowScheduledKeyboard(false);
      toast.success('Scheduled message updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update scheduled message');
    } finally {
      setSavingScheduledId('');
    }
  };

  const updateScheduledDraftAtSelection = (transform) => {
    const textarea = scheduledEditRef.current;
    const currentValue = scheduledDraft;
    const start = textarea?.selectionStart ?? currentValue.length;
    const end = textarea?.selectionEnd ?? currentValue.length;
    const next = transform(currentValue, start, end);

    setScheduledDraft(next.value);

    requestAnimationFrame(() => {
      const nextTextarea = scheduledEditRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      nextTextarea.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleScheduledKeyboardInput = (key) => {
    updateScheduledDraftAtSelection((currentValue, start, end) => ({
      value: `${currentValue.slice(0, start)}${key}${currentValue.slice(end)}`,
      caret: start + key.length,
    }));
  };

  const handleScheduledKeyboardBackspace = () => {
    updateScheduledDraftAtSelection((currentValue, start, end) => {
      if (start !== end) {
        return {
          value: `${currentValue.slice(0, start)}${currentValue.slice(end)}`,
          caret: start,
        };
      }

      if (start === 0) {
        return {
          value: currentValue,
          caret: 0,
        };
      }

      return {
        value: `${currentValue.slice(0, start - 1)}${currentValue.slice(end)}`,
        caret: start - 1,
      };
    });
  };

  const mediaMessages = [...messages]
    .filter((message) => Boolean(message.mediaUrl) && !message.isDeletedForEveryone)
    .sort((left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime());
  const filteredForwardChats = chats.filter((entry) => {
    if (!forwardSearch.trim()) return true;

    return getChatName(entry, user._id).toLowerCase().includes(forwardSearch.trim().toLowerCase());
  });
  const sharedLinks = [];
  messages.forEach((message) => {
    if (message?.isDeletedForEveryone) return;
    extractLinks(message.content).forEach((link) => {
      if (!sharedLinks.includes(link)) sharedLinks.push(link);
    });
  });

  const infoSubtitle = isAIBotChat
    ? 'Your built-in assistant for brainstorming, drafting, summaries, and quick help while you chat.'
    : chat.isGroupChat
      ? chat.groupDescription || `${chat.participants?.length || 0} members collaborating in real time`
      : other?.bio || other?.email || 'Realtime collaborator';

  const statusLabel = isAIBotChat
    ? 'AI Assistant'
    : chat.isGroupChat
      ? `${chat.participants?.length || 0} members`
      : isOnline
        ? 'Active'
        : !canShowParticipantPresence(other)
          ? 'Activity hidden'
          : 'Inactive';
  const statusToneClass = isAIBotChat
    ? 'text-[#d9d2ff]'
    : isOnline
      ? 'text-[#4affa0]'
      : !canShowParticipantPresence(other)
        ? 'text-white/55'
      : 'text-white/42';
  const statusDotClass = isAIBotChat
    ? 'bg-[#7c6aff] shadow-[0_0_14px_rgba(124,106,255,0.45)]'
    : isOnline
      ? 'bg-[#4affa0] shadow-[0_0_14px_rgba(74,255,160,0.4)]'
      : !canShowParticipantPresence(other)
        ? 'bg-white/25'
        : 'bg-[#ff6b7a] shadow-[0_0_14px_rgba(255,107,122,0.26)]';
  const statusAvatarBorder =
    !chat.isGroupChat && !isAIBotChat && canShowParticipantPresence(other)
      ? isOnline
        ? 'active'
        : 'inactive'
      : 'none';
  const callDurationLabel = callStatus === 'in-call' ? formatCallDuration(callDurationSeconds) : '';
  const groupCallDurationLabel =
    groupCallStatus === 'in-call' ? formatCallDuration(groupCallDurationSeconds) : '';
  const isGroupCallHost =
    normalizeId(groupCallSessionRef.current?.initiatorId) === normalizeId(user._id);
  const activeSearchResult = messageSearchResults[activeSearchResultIndex] || null;
  const activeSearchResultSender = activeSearchResult
    ? chat.participants?.find((participant) => normalizeId(participant) === normalizeId(activeSearchResult.senderId))
    : null;
  const activeSearchResultSenderLabel = activeSearchResult
    ? normalizeId(activeSearchResult.senderId) === normalizeId(user._id)
      ? 'You'
      : typeof activeSearchResult.senderId === 'object'
        ? activeSearchResultSender?.localName
          || activeSearchResult.senderId?.localName
          || activeSearchResultSender?.name
          || activeSearchResult.senderId?.name
          || 'Participant'
        : 'Participant'
    : '';

  const renderedMessages = [];
  let previousLabel = '';
  messages.forEach((message) => {
    const label = getDateLabel(message.createdAt);
    if (label !== previousLabel) {
      renderedMessages.push(
        <div key={`divider-${message._id}`} className="my-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/8" />
          <span className="rounded-full border border-white/10 bg-[#1a1a28] px-3 py-1 text-[0.72rem] text-white/35">
            {label}
          </span>
          <span className="h-px flex-1 bg-white/8" />
        </div>
      );
      previousLabel = label;
    }

    renderedMessages.push(
      <div
        key={message._id}
        data-message-id={message._id}
        className={`rounded-[28px] transition-all duration-500 ${
          normalizeId(message._id) === highlightedMessageId
            ? 'bg-[#4affa0]/[0.06] shadow-[0_0_0_1px_rgba(74,255,160,0.24),0_0_36px_rgba(74,255,160,0.1)]'
            : ''
        }`}
      >
        <MessageBubble
          message={message}
          chat={chat}
          isOwn={!isIncomingMessageForUser(message, user._id)}
          currentUserId={user._id}
          onAvatarClick={handleOpenMessageAvatar}
          onReply={setReplyTo}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReact={handleReact}
          onRemoveReaction={handleRemoveReaction}
          onCopy={handleCopyMessage}
          onForward={handleOpenForwardModal}
          onShare={handleShareMessage}
          onPin={handlePin}
          onVotePoll={handlePollVote}
          onOpenMedia={handleOpenMediaViewer}
          onOpenReadReceipts={handleOpenReadReceipts}
        />
      </div>
    );
  });

  const infoPanelContent = (
    <>
      <div className="shrink-0 border-b border-white/10 px-5 pb-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="brand-font text-base font-bold text-white">Contact Info</div>
            <div className="mt-1 text-sm text-white/35">
              {isAIBotChat
                ? 'Context and quick actions for your AI assistant thread.'
                : 'Context, quick actions, and your scheduled sends for this room.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInfoPanel(false)}
            className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/55 transition hover:bg-white/[0.06] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div aria-hidden="true" className="contact-scroll-indicator">
          <span className="contact-scroll-indicator__thumb" />
        </div>
        <div className="app-scrollbar h-full overflow-y-scroll px-5 py-5">
          <div className="rounded-[22px] border border-white/10 bg-[#14141f]/90 px-5 py-6 text-center shadow-[0_28px_72px_rgba(0,0,0,0.55)]">
            <div className="flex justify-center">
              {chatAvatar ? (
                <button
                  type="button"
                  onClick={handleOpenChatAvatar}
                  className="rounded-[28px] transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#7c6aff]/45"
                  aria-label={`View profile photo for ${chatName}`}
                  title="View profile photo"
                >
                  <Avatar
                    src={chatAvatar}
                    name={chatName}
                    size={22}
                    online={!chat.isGroupChat && isOnline}
                    presenceBorder={statusAvatarBorder}
                    shape={chat.isGroupChat ? 'round' : 'soft'}
                  />
                </button>
              ) : (
                <Avatar
                  src={chatAvatar}
                  name={chatName}
                  size={22}
                  online={!chat.isGroupChat && isOnline}
                  presenceBorder={statusAvatarBorder}
                  shape={chat.isGroupChat ? 'round' : 'soft'}
                />
              )}
            </div>
            <div className="brand-font mt-4 text-xl font-extrabold leading-[1.16] text-white [text-rendering:geometricPrecision]">
              {chatName}
            </div>
            <div className="mt-1 break-all text-sm text-white/35">
              {isAIBotChat ? 'Built-in assistant' : chat.isGroupChat ? 'Team room' : other?.email || 'Direct message'}
            </div>
            {!chat.isGroupChat && !isAIBotChat && other?.localName ? (
              <div className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/30">
                Account name: {other?.name}
              </div>
            ) : null}
            <div className="mt-4 text-sm leading-6 text-white/55">{infoSubtitle}</div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleSearch}
                className={`col-span-2 flex items-center justify-between gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
                  isMessageSearchOpen
                    ? 'border-[#7c6aff]/28 bg-[#7c6aff]/12'
                    : 'border-white/8 bg-white/[0.04] hover:bg-white/[0.07]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="brand-font text-[1rem] font-bold text-white">Search</div>
                  <div className="mt-1 truncate text-sm text-white/38">
                    {messageSearchQuery.trim() ? messageSearchQuery.trim() : 'Find messages in this conversation'}
                  </div>
                </div>
                <div className={`shrink-0 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${
                  isMessageSearchOpen
                    ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-[#e7e0ff]'
                    : 'border-white/10 bg-white/[0.04] text-white/52'
                }`}>
                  Open
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSharedContent('media')}
                className="flex min-h-[112px] flex-col justify-between rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.07]"
              >
                <div className="brand-font text-[1.15rem] font-bold text-white">{mediaMessages.length}</div>
                <div className="text-[0.78rem] leading-5 text-white/38">Shared Files</div>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSharedContent('links')}
                className="flex min-h-[112px] flex-col justify-between rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.07]"
              >
                <div className="brand-font text-[1.15rem] font-bold text-white">{sharedLinks.length}</div>
                <div className="text-[0.78rem] leading-5 text-white/38">Links</div>
              </button>
            </div>

            {isMessageSearchOpen ? (
              <div className="mt-3 rounded-[22px] border border-white/8 bg-[#0d0d17]/60 px-4 py-4 text-left">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="brand-font text-[0.96rem] font-bold text-white">Search Messages</div>
                    <div className="mt-1 text-sm text-white/35">
                      Type a word and use the arrows to jump between matching messages.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMessageSearchOpen(false);
                      setMessageSearchQuery('');
                      setMessageSearchResults([]);
                      setActiveSearchResultIndex(0);
                    }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.72rem] font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <input
                  ref={messageSearchInputRef}
                  type="text"
                  value={messageSearchQuery}
                  onChange={(event) => setMessageSearchQuery(event.target.value)}
                  placeholder="Search in this conversation"
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-[#14141f]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
                />

                {isSearchingMessages ? (
                  <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
                    Searching recent matches...
                  </div>
                ) : activeSearchResult ? (
                  <div className="mt-3 rounded-2xl border border-[#7c6aff]/18 bg-[linear-gradient(135deg,rgba(124,106,255,0.14),rgba(255,106,176,0.08))] px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => void focusSearchResultMessage(activeSearchResult)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/38">
                          {activeSearchResultIndex === 0 ? 'Recent Match' : 'Selected Match'}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white/86">
                          {activeSearchResultSenderLabel} · {formatMessageTime(activeSearchResult.createdAt)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-white/68">
                          {getMessagePreviewText(activeSearchResult)}
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSearchResultNavigation('older')}
                          disabled={activeSearchResultIndex >= messageSearchResults.length - 1}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          title="Go to older match"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSearchResultNavigation('newer')}
                          disabled={activeSearchResultIndex <= 0}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          title="Go to newer match"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </div>
                ) : messageSearchQuery.trim() ? (
                  <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
                    No recent match found for "{messageSearchQuery.trim()}".
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
                    Start typing to search this chat and jump through matching messages.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {chat.isGroupChat ? (
            <section className="mt-4 rounded-[20px] border border-white/10 bg-[#14141f]/90 p-4 shadow-[0_28px_72px_rgba(0,0,0,0.55)]">
              <div className="rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="brand-font text-[0.96rem] font-bold text-white">Group Name</div>
                    <div className="mt-1 text-sm text-white/35">
                      {isGroupAdmin
                        ? 'Change the name everyone sees for this group.'
                        : 'Only group admins can change the group name.'}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold text-white/55">
                    {isGroupAdmin ? 'Admin' : 'View only'}
                  </div>
                </div>

                <input
                  type="text"
                  value={groupNameDraft}
                  onChange={(event) => setGroupNameDraft(event.target.value)}
                  disabled={!isGroupAdmin || isSavingGroupName}
                  maxLength={60}
                  placeholder="Group name"
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-[#14141f]/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff] disabled:cursor-not-allowed disabled:opacity-60"
                />

                {isGroupAdmin ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setGroupNameDraft(chat.chatName || '')}
                      disabled={isSavingGroupName || groupNameDraft.trim() === (chat.chatName || '').trim()}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.74rem] font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGroupName}
                      disabled={isSavingGroupName || !groupNameDraft.trim() || groupNameDraft.trim() === (chat.chatName || '').trim()}
                      className="rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/14 px-3 py-2 text-[0.74rem] font-semibold text-[#e3deff] transition hover:bg-[#7c6aff]/22 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isSavingGroupName ? 'Saving...' : 'Save Group Name'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 -mx-1 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(124,106,255,0.08),rgba(255,106,176,0.05))] p-[1px] shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
                <div className="rounded-[27px] bg-[radial-gradient(circle_at_top_right,rgba(124,106,255,0.18),transparent_34%),linear-gradient(180deg,rgba(14,14,24,0.98),rgba(11,11,20,0.95))] px-3 py-3">
                  <div className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.035] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="brand-font text-[1rem] font-bold text-white">Member Info</div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMemberInfoOpen((previous) => !previous);
                        if (isMemberInfoOpen) {
                          setSelectedGroupMemberId('');
                        }
                      }}
                      className={`rounded-2xl border px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] transition ${
                        isMemberInfoOpen
                          ? 'border-[#7c6aff]/35 bg-[linear-gradient(135deg,rgba(124,106,255,0.3),rgba(255,106,176,0.15))] text-[#f3edff] shadow-[0_14px_34px_rgba(124,106,255,0.18)]'
                          : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {isMemberInfoOpen ? 'Hide List' : 'Show List'}
                    </button>
                  </div>

                  {isMemberInfoOpen ? (
                    <div className="app-scrollbar mt-3 max-h-[500px] overflow-y-auto pr-1">
                      <div className="space-y-2">
                        {groupParticipants.map((participant) => {
                          const participantId = normalizeId(participant);
                          const participantName = getParticipantDisplayName(participant);
                          const isExpanded = participantId === normalizeId(selectedGroupMemberId);
                          const isParticipantAdmin = Array.isArray(chat.admins)
                            && chat.admins.some((adminId) => normalizeId(adminId) === participantId);
                          const isCurrentUserParticipant = participantId === normalizeId(user._id);
                          const canAddParticipantAsContact =
                            participantId
                            && !isCurrentUserParticipant
                            && !participant?.isContact;
                          const canRenameParticipant = participantId && !isCurrentUserParticipant;
                          const contactLabel = participantId === normalizeId(user._id)
                            ? 'This is you'
                            : participant?.isFriend
                              ? 'Friend and added'
                              : participant?.isContact
                                ? 'Added to your contacts'
                                : 'Not added to your contacts';

                          return (
                            <div
                              key={participantId}
                              className={`overflow-hidden rounded-[22px] border transition ${
                                isExpanded
                                  ? 'border-[#7c6aff]/28 bg-[linear-gradient(135deg,rgba(124,106,255,0.16),rgba(255,106,176,0.08))] shadow-[0_18px_38px_rgba(124,106,255,0.12)]'
                                  : 'border-white/8 bg-white/[0.025]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedGroupMemberId((previous) => (normalizeId(previous) === participantId ? '' : participantId))}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold text-white">
                                    {participantName}
                                  </div>
                                </div>
                                <span className={`shrink-0 rounded-full border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.08em] ${
                                  isExpanded
                                    ? 'border-[#7c6aff]/28 bg-[#7c6aff]/12 text-[#efe9ff]'
                                    : 'border-white/10 bg-white/[0.04] text-white/45'
                                }`}>
                                  {isExpanded ? 'Close' : 'Open'}
                                </span>
                              </button>

                              {isExpanded ? (
                                <div className="border-t border-white/8 px-4 pb-4 pt-3">
                                  <div className="grid gap-3">
                                    <div className="rounded-[18px] border border-white/8 bg-[#0d0d17]/60 px-3 py-3">
                                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                                        Status
                                      </div>
                                      <div className="mt-2 text-sm font-semibold text-white/80">
                                        {getParticipantPresenceLabel(participant)}
                                      </div>
                                    </div>
                                    <div className="rounded-[18px] border border-white/8 bg-[#0d0d17]/60 px-3 py-3">
                                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                                        In Your Contacts
                                      </div>
                                      <div className="mt-2 text-sm font-semibold text-white/80">
                                        {contactLabel}
                                      </div>
                                    </div>
                                    {participant?.localName && participant.localName !== participant?.name ? (
                                      <div className="rounded-[18px] border border-white/8 bg-[#0d0d17]/60 px-3 py-3">
                                        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                                          Saved As
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-white/80">
                                          {participant.localName}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>

                                  {canRenameParticipant ? (
                                    <div className="mt-3 rounded-[18px] border border-white/8 bg-[#0d0d17]/60 px-3 py-3">
                                      <label
                                        htmlFor={`group-member-alias-${participantId}`}
                                        className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32"
                                      >
                                        Custom Name
                                      </label>
                                      <input
                                        id={`group-member-alias-${participantId}`}
                                        type="text"
                                        value={groupMemberAliasDraft}
                                        onChange={(event) => setGroupMemberAliasDraft(event.target.value)}
                                        maxLength={40}
                                        placeholder={`Save ${String(participant?.name || 'member').split(' ')[0]} as...`}
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0a0a12]/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
                                      />
                                      <div className="mt-3 grid grid-cols-3 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setGroupMemberAliasDraft(existingGroupMemberAlias)}
                                          disabled={isSavingContactAlias || !hasGroupMemberAliasChanges}
                                          className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.7rem] font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                                        >
                                          Reset
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveContactAlias(participant, '', setGroupMemberAliasDraft)}
                                          disabled={isSavingContactAlias || (!existingGroupMemberAlias && !normalizedGroupMemberAliasDraft)}
                                          className="min-w-0 rounded-xl border border-[#ff8ca8]/20 bg-[#ff8ca8]/8 px-3 py-2 text-[0.7rem] font-semibold text-[#ffd5df] transition hover:bg-[#ff8ca8]/15 disabled:cursor-not-allowed disabled:opacity-55"
                                        >
                                          Remove
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveContactAlias(participant, normalizedGroupMemberAliasDraft, setGroupMemberAliasDraft)}
                                          disabled={isSavingContactAlias || !hasGroupMemberAliasChanges}
                                          className="min-w-0 rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/14 px-3 py-2 text-[0.7rem] font-semibold text-[#e3deff] transition hover:bg-[#7c6aff]/22 disabled:cursor-not-allowed disabled:opacity-55"
                                        >
                                          {isSavingContactAlias ? 'Saving...' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}

                                  {canAddParticipantAsContact ? (
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleAddGroupContact(participant)}
                                        disabled={addingGroupContactId === participantId}
                                        className="rounded-2xl border border-[#7c6aff]/22 bg-[linear-gradient(135deg,rgba(124,106,255,0.22),rgba(255,106,176,0.1))] px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#f0eaff] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {addingGroupContactId === participantId ? 'Adding...' : 'Add Contact'}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {isGroupAdmin ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <label htmlFor="group-member-search" className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                    Invite New Members
                  </label>
                  <input
                    ref={groupMemberSearchRef}
                    id="group-member-search"
                    type="text"
                    value={groupMemberSearch}
                    onChange={(event) => setGroupMemberSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleAddGroupMemberFromSearch();
                      }
                    }}
                    placeholder="Search name or type exact email"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0d17]/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs leading-5 text-white/35">
                      Invited users must accept in Settings before they join the group.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddGroupMemberFromSearch}
                      disabled={!groupMemberSearch.trim() || isSearchingGroupMembers || Boolean(addingGroupMemberId)}
                      className="rounded-xl border border-[#7c6aff]/28 bg-[#7c6aff]/14 px-3 py-2 text-[0.72rem] font-semibold text-[#e3deff] transition hover:bg-[#7c6aff]/22 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {addingGroupMemberId ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>

                  {groupMemberSearch.trim() ? (
                    <div className="mt-3 space-y-2">
                      {isSearchingGroupMembers ? (
                        <div className="rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-4 py-3 text-sm text-white/45">
                          Searching members...
                        </div>
                      ) : groupMemberResults.length ? (
                        groupMemberResults.map((candidate) => (
                          <button
                            key={candidate._id}
                            type="button"
                            onClick={() => handleAddGroupMember(candidate)}
                            disabled={addingGroupMemberId === candidate._id}
                            className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-3 py-3 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Avatar src={candidate.profilePicture} name={candidate.name} size={9} shape="soft" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">{candidate.name}</div>
                              <div className="truncate text-[0.78rem] text-white/38">{candidate.email}</div>
                            </div>
                            <span className="shrink-0 rounded-full border border-[#7c6aff]/20 bg-[#7c6aff]/10 px-3 py-1 text-[0.68rem] font-semibold text-[#ddd7ff]">
                              {addingGroupMemberId === candidate._id ? 'Sending...' : 'Invite'}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-4 py-3 text-sm text-white/45">
                          No new people matched this search.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-white/35">
                      Search for a username or email to send a join request for this group.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-4 py-3 text-sm text-white/45">
                  Only group admins can send group invites.
                </div>
              )}
            </section>
          ) : null}

          {!isAIBotChat && !chat.isGroupChat && other ? (
            <section className="mt-4 rounded-[20px] border border-white/10 bg-[#14141f]/90 p-4 shadow-[0_28px_72px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="brand-font text-[0.96rem] font-bold text-white">Custom Name</div>
                  <div className="mt-1 text-sm text-white/35">
                    Rename this contact just for your own chat list and header.
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold text-white/55">
                  Only you
                </div>
              </div>

              <div className="mt-4 min-w-0 rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-4 py-3">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                  Real account name
                </div>
                <div className="mt-1 break-words text-sm font-semibold text-white">{other.name}</div>
                <div className="mt-1 break-all text-sm text-white/38">{other.email || 'Direct contact'}</div>
              </div>

              <label htmlFor="contact-alias-input" className="mt-4 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                Name you want to see
              </label>
              <input
                id="contact-alias-input"
                type="text"
                value={contactAliasDraft}
                onChange={(event) => setContactAliasDraft(event.target.value)}
                maxLength={40}
                placeholder={`Save ${other.name.split(' ')[0]} as...`}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0d0d17]/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContactAliasDraft(existingContactAlias)}
                  disabled={isSavingContactAlias || !hasContactAliasChanges}
                  className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.74rem] font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveContactAlias(other, '', setContactAliasDraft)}
                  disabled={isSavingContactAlias || (!existingContactAlias && !normalizedContactAliasDraft)}
                  className="min-w-0 rounded-xl border border-[#ff8ca8]/20 bg-[#ff8ca8]/8 px-3 py-2 text-[0.74rem] font-semibold text-[#ffd5df] transition hover:bg-[#ff8ca8]/15 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveContactAlias(other, normalizedContactAliasDraft, setContactAliasDraft)}
                  disabled={isSavingContactAlias || !hasContactAliasChanges}
                  className="col-span-2 min-w-0 rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/14 px-3 py-2 text-[0.74rem] font-semibold text-[#e3deff] transition hover:bg-[#7c6aff]/22 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isSavingContactAlias ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </section>
          ) : null}

          {!isAIBotChat ? (
          <section className="mt-4 rounded-[20px] border border-white/10 bg-[#14141f]/90 p-4 shadow-[0_28px_72px_rgba(0,0,0,0.55)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="brand-font text-[0.96rem] font-bold text-white">Scheduled Messages</div>
                <div className="mt-1 text-sm text-white/35">
                  Only you can see these until they are sent, and you can remove them anytime before that.
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.7rem] font-semibold text-white/55">
                {scheduledMessages.length}
              </div>
            </div>

            {scheduledMessages.length ? (
              <div className="mt-4 space-y-3">
                {scheduledMessages.map((message) => (
                  <div
                    key={message._id}
                    className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,106,255,0.1),rgba(255,106,176,0.06))] px-4 py-4"
                  >
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#ddd7ff]">
                          {getScheduledPreviewTitle(message)}
                        </div>
                        <div className="text-[0.74rem] text-white/45">
                          {getScheduledSendTimeLabel(message.scheduledTime)}
                        </div>
                      </div>
                      {editingScheduledId === message._id ? null : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => startScheduledEdit(message)}
                              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.72rem] font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveScheduledMessage(message._id)}
                              disabled={removingScheduledId === message._id}
                              className="min-w-0 rounded-xl border border-[#ff8ca8]/20 bg-[#ff8ca8]/8 px-3 py-1.5 text-[0.72rem] font-semibold text-[#ffd5df] transition hover:bg-[#ff8ca8]/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {removingScheduledId === message._id ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                      )}
                    </div>
                    {editingScheduledId === message._id ? (
                      <div className="mt-3 rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-3 py-3">
                        <textarea
                          ref={scheduledEditRef}
                          value={scheduledDraft}
                          onChange={(event) => setScheduledDraft(event.target.value)}
                          rows={4}
                          placeholder={message.mediaUrl ? 'Add or update a caption...' : 'Edit scheduled message...'}
                          className="w-full resize-none bg-transparent text-sm leading-6 text-white/78 outline-none placeholder:text-white/28"
                        />
                        {showScheduledKeyboard ? (
                          <VirtualKeyboard
                            className="mt-3"
                            onInput={handleScheduledKeyboardInput}
                            onBackspace={handleScheduledKeyboardBackspace}
                            onSpace={() => handleScheduledKeyboardInput(' ')}
                            onEnter={() => handleScheduledKeyboardInput('\n')}
                            onClose={() => setShowScheduledKeyboard(false)}
                          />
                        ) : null}
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => setShowScheduledKeyboard((value) => !value)}
                            className={`min-w-0 rounded-xl border px-3 py-2 text-[0.74rem] font-semibold transition ${
                              showScheduledKeyboard
                                ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-[#e3deff]'
                                : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07] hover:text-white'
                            }`}
                          >
                            Keyboard
                          </button>
                          <button
                            type="button"
                            onClick={cancelScheduledEdit}
                            className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.74rem] font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveScheduledEdit(message)}
                            disabled={savingScheduledId === message._id}
                            className="min-w-0 rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/14 px-3 py-2 text-[0.74rem] font-semibold text-[#e3deff] transition hover:bg-[#7c6aff]/22 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingScheduledId === message._id ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 break-words rounded-2xl border border-white/8 bg-[#0d0d17]/60 px-3 py-3 text-sm leading-6 text-white/72">
                        {getScheduledPreviewBody(message)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/35">No scheduled messages waiting to send.</div>
            )}
          </section>
          ) : null}

          {!isAIBotChat ? (
            <section className="mt-4 rounded-[20px] border border-[#ff8ca8]/12 bg-[#14141f]/90 p-4 shadow-[0_28px_72px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="brand-font text-[0.96rem] font-bold text-white">
                    {chat.isGroupChat ? 'Group Actions' : 'Chat Actions'}
                  </div>
                  <div className="mt-1 text-sm text-white/35">
                    {chat.isGroupChat
                      ? isGroupAdmin
                        ? 'Invite members, leave this group, or delete it for everyone.'
                        : 'Leave this group anytime. Only admins can invite or delete it for everyone.'
                      : 'Remove this conversation from your list. If a new message arrives, it can appear again.'}
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-[#ff8ca8]/16 bg-[#ff8ca8]/8 px-3 py-1 text-[0.68rem] font-semibold text-[#ffd2d7]">
                  Manage
                </div>
              </div>

              <div className={`mt-4 grid gap-2 ${chat.isGroupChat && isGroupAdmin ? 'sm:grid-cols-3' : 'grid-cols-1'}`}>
                {chat.isGroupChat && isGroupAdmin ? (
                  <button
                    type="button"
                    onClick={openAddMemberPanel}
                    className="rounded-2xl border border-[#7c6aff]/24 bg-[#7c6aff]/12 px-4 py-3 text-sm font-semibold text-[#e3deff] transition hover:bg-[#7c6aff]/20 hover:text-white"
                  >
                    Add Member
                  </button>
                ) : null}

                {chat.isGroupChat ? (
                  <button
                    type="button"
                    onClick={handleLeaveGroup}
                    disabled={isLeavingGroup || isDeletingGroup}
                    className="rounded-2xl border border-[#ff8ca8]/18 bg-[#ff8ca8]/8 px-4 py-3 text-sm font-semibold text-[#ffd5df] transition hover:bg-[#ff8ca8]/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLeavingGroup ? 'Leaving...' : 'Leave Group'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeleteConversation}
                    disabled={isDeletingConversation}
                    className="rounded-2xl border border-[#ff8ca8]/18 bg-[#ff8ca8]/8 px-4 py-3 text-sm font-semibold text-[#ffd5df] transition hover:bg-[#ff8ca8]/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingConversation ? 'Deleting...' : 'Delete Chat'}
                  </button>
                )}

                {chat.isGroupChat && isGroupAdmin ? (
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    disabled={isDeletingGroup || isLeavingGroup}
                    className="rounded-2xl border border-[#ff6b94]/18 bg-[#ff6b94]/10 px-4 py-3 text-sm font-semibold text-[#ffd5df] transition hover:bg-[#ff6b94]/16 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className={`mt-4 grid gap-2 ${canBlockUser ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="button"
              onClick={handleExportChat}
              disabled={isExportingChat}
              className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExportingChat ? 'Exporting...' : 'Export'}
            </button>
            {canBlockUser ? (
              <button
                type="button"
                onClick={handleBlockUser}
                disabled={isBlockingUser || isOtherUserBlocked}
                className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-[#ffb6bf] transition hover:bg-white/[0.06] hover:text-[#ffd2d7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOtherUserBlocked ? 'Blocked' : isBlockingUser ? 'Blocking...' : 'Block'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div
        className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${
          isInfoPanelOpen ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_336px]' : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)]'
        }`}
      >
        <section
          className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0a0a12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at top right, rgba(124,106,255,0.08), transparent 28%), radial-gradient(circle at bottom left, rgba(255,106,176,0.05), transparent 26%)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.025)_1px,transparent_0)] bg-[size:28px_28px] opacity-35" />

          <div className="relative flex flex-col gap-3 border-b border-white/10 bg-[rgba(10,10,18,0.8)] px-3 py-3 backdrop-blur-2xl sm:px-6 sm:py-[18px] md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 transition hover:bg-white/[0.07] hover:text-white md:hidden"
              >
                Back
              </button>

              {chatAvatar ? (
                <button
                  type="button"
                  onClick={handleOpenChatAvatar}
                  className="shrink-0 rounded-2xl transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#7c6aff]/45"
                  aria-label={`View profile photo for ${chatName}`}
                  title="View profile photo"
                >
                  <Avatar
                    src={chatAvatar}
                    name={chatName}
                    size={window.innerWidth < 640 ? 9 : 11}
                    online={!chat.isGroupChat && isOnline}
                    presenceBorder={statusAvatarBorder}
                    shape={chat.isGroupChat ? 'round' : 'soft'}
                  />
                </button>
              ) : (
                <Avatar
                  src={chatAvatar}
                  name={chatName}
                  size={window.innerWidth < 640 ? 9 : 11}
                  online={!chat.isGroupChat && isOnline}
                  presenceBorder={statusAvatarBorder}
                  shape={chat.isGroupChat ? 'round' : 'soft'}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate pb-0.5 text-base font-semibold leading-[1.2] text-[#f0eeff] sm:text-[1.08rem]">
                  {chatName}
                </div>
                <div className={`mt-1 flex min-w-0 items-center gap-2 text-xs sm:text-sm ${statusToneClass}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`} />
                  <span className="truncate">{statusLabel}</span>
                  {isMutedChat ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffcf7c]/24 bg-[#ffcf7c]/10 px-2 py-0.5 text-[0.64rem] font-semibold text-[#ffe2a1]">
                      <MutedChatIcon className="h-3 w-3" />
                      <span>Muted</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 md:flex md:items-center">
              {!isAIBotChat && !composerDisabled ? (
                <>
                  <button
                    type="button"
                    onClick={chat.isGroupChat ? startGroupVoiceCall : startVoiceCall}
                    className="inline-flex h-9 min-w-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-2 text-xs text-white/65 transition hover:bg-[#7c6aff]/12 hover:text-[#7c6aff] sm:h-10 sm:px-3 sm:text-sm"
                  >
                    Call
                  </button>
                  <button
                    type="button"
                    onClick={chat.isGroupChat ? startGroupVideoCall : startVideoCall}
                    className="inline-flex h-9 min-w-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-2 text-xs text-white/65 transition hover:bg-[rgba(106,255,232,0.1)] hover:text-[#6affe8] sm:h-10 sm:px-3 sm:text-sm"
                  >
                    Video
                  </button>
                </>
              ) : null}
              {!isAIBotChat ? (
                <button
                  type="button"
                  onClick={handleMute}
                  disabled={isUpdatingMute}
                  className={`inline-flex h-9 min-w-0 items-center justify-center rounded-xl border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:px-3 sm:text-sm ${
                    isMutedChat
                      ? 'border-[#ffcf7c]/24 bg-[#ffcf7c]/10 text-[#ffe2a1] hover:bg-[#ffcf7c]/16 hover:text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  {isUpdatingMute ? '...' : isMutedChat ? 'Unmute' : 'Mute'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex h-9 min-w-0 items-center justify-center rounded-xl border border-[#ffb6bf]/18 bg-[#ffb6bf]/8 px-2 text-xs text-[#ffd2d7] transition hover:bg-[#ffb6bf]/14 hover:text-white sm:h-10 sm:px-3 sm:text-sm"
              >
                Clear
              </button>
              {canShowInfoPanel ? (
                <button
                  type="button"
                  onClick={() => setShowInfoPanel((previous) => !previous)}
                  className={`inline-flex h-9 min-w-0 items-center justify-center rounded-xl border px-2 text-xs transition sm:h-10 sm:px-3 sm:text-sm ${
                    isInfoPanelOpen
                      ? 'border-[#7c6aff]/30 bg-[#7c6aff]/12 text-[#ddd7ff]'
                      : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  Info
                </button>
              ) : null}
            </div>
          </div>

          <PinnedMessage message={pinnedMsg} onClose={handleDismissPinnedMessage} onJump={jumpToPinnedMessage} />

          {isPendingRequest || isDeclinedRequest ? (
            <div className="border-b border-white/10 bg-[rgba(16,16,26,0.92)] px-6 py-4 backdrop-blur-xl">
              <div className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-[#14141f]/92 px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#7c6aff]/18 bg-[#7c6aff]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#ddd7ff]">
                      {requestLabel}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${
                      isPendingRequest
                        ? 'border border-[#ffb6bf]/18 bg-[#ffb6bf]/10 text-[#ffd2d7]'
                        : 'border border-white/10 bg-white/[0.05] text-white/55'
                    }`}>
                      {isPendingRequest ? 'Pending' : 'Removed'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/62">
                    {isPendingRequest
                      ? canRespondToRequest
                        ? `${other?.name || 'This person'} sent you a ${requestType === 'friend' ? 'friend request' : 'message request'}. You can allow it to keep chatting or remove it here.`
                        : `Your ${requestType === 'friend' ? 'friend request' : 'message request'} is waiting for ${other?.name || 'them'} to allow it before the conversation can continue.`
                      : 'This request was removed. You can still review the intro message, but sending is locked until a new request is created from search.'}
                  </div>
                </div>

                {canRespondToRequest && isPendingRequest ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRequestResponse('accept')}
                      disabled={isRespondingToRequest}
                      className="rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/14 px-4 py-2 text-sm font-semibold text-[#ede7ff] transition hover:bg-[#7c6aff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestResponse('decline')}
                      disabled={isRespondingToRequest}
                      className="rounded-xl border border-[#ffb6bf]/18 bg-[#ffb6bf]/10 px-4 py-2 text-sm font-semibold text-[#ffd2d7] transition hover:bg-[#ffb6bf]/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            ref={messageListRef}
            onScroll={updateStickToBottomState}
            className="app-scrollbar relative flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6"
          >
            {renderedMessages}
            <TypingIndicator typingUsers={chatTypers} />
          </div>

          <MessageInput
            onSend={handleSend}
            onTyping={() => socket?.emit('typing', { chatId: chat._id, userName: user.name })}
            onStopTyping={() => socket?.emit('stopTyping', { chatId: chat._id })}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            placeholder={isAIBotChat ? 'Ask AI anything...' : 'Message this conversation...'}
            allowScheduling={!isAIBotChat}
            allowPolls={chat.isGroupChat}
            disabled={composerDisabled}
            disabledReason={composerDisabledReason}
            mentionCandidates={chat.isGroupChat ? chat.participants : []}
            currentUserId={user._id}
          />
        </section>

        {isInfoPanelOpen ? (
          <aside
            className="hidden min-h-0 overflow-hidden border-l border-white/10 bg-[#0f0f1a]/94 backdrop-blur-[22px] lg:flex lg:flex-col"
            style={{
              backgroundImage:
                'radial-gradient(circle at top right, rgba(124,106,255,0.12), transparent 32%), radial-gradient(circle at bottom left, rgba(255,106,176,0.05), transparent 30%)',
            }}
          >
            {infoPanelContent}
          </aside>
        ) : null}
      </div>

        {isInfoPanelOpen ? (
          <div className="fixed inset-0 z-40 bg-black/65 lg:hidden">
            <div className="absolute inset-y-0 right-0 flex w-full max-w-[360px] flex-col overflow-hidden border-l border-white/10 bg-[#0f0f1a] shadow-[-24px_0_80px_rgba(0,0,0,0.55)]">
              {infoPanelContent}
          </div>
        </div>
      ) : null}

      {showCall ? (
        <CallModal
          callType={callType}
          callStatus={callStatus}
          participantName={chatName}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          durationLabel={callDurationLabel}
          isIncoming={callStatus === 'incoming'}
          onAnswer={handleAnswerIncomingCall}
          onDecline={handleDeclineIncomingCall}
          onEnd={handleEndActiveCall}
          onClose={handleCloseCallModal}
        />
      ) : null}

      {showGroupCall ? (
        <GroupCallModal
          callType={groupCallType}
          callStatus={groupCallStatus}
          chatName={chatName}
          currentUserId={user._id}
          localVideoRef={groupLocalVideoRef}
          localStream={groupLocalStream}
          remoteParticipants={groupRemoteParticipants}
          participants={groupParticipants}
          durationLabel={groupCallDurationLabel}
          isIncoming={groupCallStatus === 'incoming'}
          isHost={isGroupCallHost}
          onAnswer={handleAnswerGroupCall}
          onDecline={handleDeclineGroupCall}
          onLeave={handleLeaveGroupCall}
          onEnd={handleLeaveGroupCall}
          onClose={handleLeaveGroupCall}
        />
      ) : null}

      <MediaViewerModal
        message={mediaViewerMessage}
        onClose={() => setMediaViewerMessage(null)}
      />

      <Modal
        isOpen={Boolean(readReceiptMessage)}
        onClose={() => setReadReceiptMessageId('')}
        title="Message Read Details"
        maxWidthClass="max-w-2xl"
        panelClassName="border-white/10 bg-[#101018]/96"
      >
        {readReceiptMessage ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/38">
                    Message Preview
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/80">
                    {getMessagePreviewText(readReceiptMessage)}
                  </div>
                </div>
                <div className="rounded-full border border-[#6affe8]/20 bg-[#6affe8]/10 px-3 py-1 text-[0.72rem] font-semibold text-[#aef9ff]">
                  {readReceiptDetails.seenCount}/{readReceiptDetails.totalRecipients} seen
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="brand-font text-sm font-semibold text-white">Seen By</div>
                  <div className="rounded-full border border-[#6affe8]/18 bg-[#6affe8]/10 px-2.5 py-1 text-[0.68rem] font-semibold text-[#aef9ff]">
                    {readReceiptDetails.seenMembers.length}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {readReceiptDetails.seenMembers.length ? (
                    readReceiptDetails.seenMembers.map((participant) => (
                      <div
                        key={`seen-${participant._id}`}
                        className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"
                      >
                        <Avatar
                          src={participant.profilePicture}
                          name={getParticipantDisplayName(participant)}
                          size={10}
                          online={participant.isOnline}
                          shape="soft"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{getParticipantDisplayName(participant)}</div>
                          <div className="text-xs text-[#aef9ff]">Seen</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center text-sm text-white/40">
                      No one has seen this message yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="brand-font text-sm font-semibold text-white">Not Seen Yet</div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.68rem] font-semibold text-white/60">
                    {readReceiptDetails.unseenMembers.length}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {readReceiptDetails.unseenMembers.length ? (
                    readReceiptDetails.unseenMembers.map((participant) => (
                      <div
                        key={`unseen-${participant._id}`}
                        className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"
                      >
                        <Avatar
                          src={participant.profilePicture}
                          name={getParticipantDisplayName(participant)}
                          size={10}
                          online={participant.isOnline}
                          shape="soft"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{getParticipantDisplayName(participant)}</div>
                          <div className="text-xs text-white/42">Waiting for read receipt</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#6affe8]/18 bg-[#6affe8]/[0.06] px-4 py-5 text-center text-sm text-[#aef9ff]">
                      Everyone has seen this message.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={Boolean(forwardMessage)} onClose={closeForwardModal} title="Forward Message">
        {forwardMessage ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/38">
                Message Preview
              </div>
              <div className="mt-2 text-sm leading-6 text-white/80">{getMessagePreviewText(forwardMessage)}</div>
            </div>

            <input
              value={forwardSearch}
              onChange={(event) => setForwardSearch(event.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#7c6aff]/35"
            />

            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {filteredForwardChats.length ? (
                filteredForwardChats.map((entry) => {
                  const targetId = entry._id;
                  const isSelected = selectedForwardChatIds.includes(targetId);

                  return (
                    <button
                      key={targetId}
                      type="button"
                      onClick={() => toggleForwardTarget(targetId)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#7c6aff]/35 bg-[#7c6aff]/12'
                          : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <Avatar
                        src={getChatAvatar(entry, user._id)}
                        name={getChatName(entry, user._id)}
                        size={10}
                        online={!entry.isGroupChat && isParticipantOnline(entry.participants?.find((participant) => participant._id !== user._id))}
                        shape={entry.isGroupChat ? 'round' : 'soft'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-white">{getChatName(entry, user._id)}</div>
                        <div className="truncate text-sm text-white/38">
                          {entry.isGroupChat
                            ? `${entry.participants?.length || 0} members`
                            : entry.participants?.find((participant) => participant._id !== user._id)?.email || 'Direct chat'}
                        </div>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.68rem] ${
                          isSelected
                            ? 'border-[#7c6aff]/35 bg-[#7c6aff] text-white'
                            : 'border-white/14 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/38">
                  No conversations match this search.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForwardModal}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/62 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForwardMessage}
                disabled={isForwarding}
                className="rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/16 px-4 py-2 text-sm font-semibold text-[#e6e1ff] transition hover:bg-[#7c6aff]/24 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isForwarding ? 'Forwarding...' : 'Forward'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default ChatWindow;
