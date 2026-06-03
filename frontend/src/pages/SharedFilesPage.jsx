import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MediaViewerModal from '../components/chat/MediaViewerModal';
import Avatar from '../components/shared/Avatar';
import Modal from '../components/shared/Modal';
import Sidebar from '../components/sidebar/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { chatService } from '../services/chatService';
import { applyContactAliasesToChat, applyContactAliasesToChats, getChatAvatar, getChatName } from '../utils/helpers';

const extractLinks = (text = '') => text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const normalizeLink = (link) => (link.startsWith('http') ? link : `https://${link}`);
const TAB_OPTIONS = ['media', 'docs', 'links'];

const sortNewestFirst = (items) =>
  [...items].sort(
    (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime()
  );

const getMessagePreviewText = (message) => {
  if (message?.content?.trim()) return message.content.trim();
  if (message?.messageType === 'image') return 'Image attachment';
  if (message?.messageType === 'video') return 'Video attachment';
  if (message?.messageType === 'audio') return 'Voice note';
  if (message?.messageType === 'document') return 'Document attachment';
  if (message?.messageType === 'location') return message?.location?.address || 'Location';
  if (message?.messageType === 'poll') return message?.poll?.question || 'Poll';
  return 'Shared item';
};

const getSharedItemHeading = (item, message) => {
  if (!item || !message) return 'Shared item';
  if (item.type === 'link') return item.link.replace(/^https?:\/\//, '');
  return message.content?.trim() || getMessagePreviewText(message);
};

const getSharedItemMeta = (item, message) => {
  if (!item || !message) return '';
  if (item.type === 'link') return item.normalized;
  if (message?.messageType === 'image') return 'Image attachment';
  if (message?.messageType === 'video') return 'Video attachment';
  if (message?.messageType === 'audio') return 'Audio file';
  if (message?.messageType === 'document') return 'Document';
  return message?.messageType || 'Shared item';
};

const getPrimaryActionLabel = (item, message) => {
  if (!item || !message) return 'Open';
  if (item.type === 'link') return 'Open Link';
  if (message?.messageType === 'image') return 'Open Image';
  if (message?.messageType === 'video') return 'Open Video';
  if (message?.messageType === 'audio') return 'Open Audio';
  if (message?.messageType === 'document') return 'Open Document';
  return 'Open';
};

const SharedFilesPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { selectedChat, setSelectedChat, chats, setChats } = useChat();
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [mediaViewerMessage, setMediaViewerMessage] = useState(null);
  const [selectedSharedItem, setSelectedSharedItem] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);

  const activeTab = TAB_OPTIONS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'media';
  const currentUserId = normalizeId(user?._id);
  const chat = selectedChat && normalizeId(selectedChat._id) === normalizeId(chatId) ? selectedChat : null;

  useEffect(() => {
    if (chat) return;

    chatService
      .getChatById(chatId)
      .then((nextChat) => setSelectedChat(applyContactAliasesToChat(nextChat, user)))
      .catch(() => navigate('/app'));
  }, [chat, chatId, navigate, setSelectedChat, user]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingMessages(true);

    chatService
      .getMessages(chatId, 1, 400)
      .then((data) => {
        if (!isMounted) return;
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setMessages([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chatId]);

  const mediaMessages = useMemo(
    () =>
      sortNewestFirst(
        messages.filter((message) => Boolean(message?.mediaUrl) && !message?.isDeletedForEveryone)
      ),
    [messages]
  );

  const mediaGroups = useMemo(
    () => ({
      image: mediaMessages.filter((message) => message?.messageType === 'image'),
      video: mediaMessages.filter((message) => message?.messageType === 'video'),
      audio: mediaMessages.filter((message) => message?.messageType === 'audio'),
    }),
    [mediaMessages]
  );

  const documentMessages = useMemo(
    () => mediaMessages.filter((message) => !['image', 'video', 'audio'].includes(message?.messageType)),
    [mediaMessages]
  );

  const sharedLinks = useMemo(() => {
    const seen = new Set();
    const items = [];

    sortNewestFirst(messages).forEach((message) => {
      if (message?.isDeletedForEveryone) return;

      extractLinks(message.content).forEach((link) => {
        const normalized = normalizeLink(link);
        if (seen.has(normalized)) return;
        seen.add(normalized);
        items.push({
          type: 'link',
          link,
          normalized,
          messageId: message._id,
          createdAt: message.createdAt,
        });
      });
    });

    return items;
  }, [messages]);

  const selectedSharedMessage = useMemo(
    () =>
      selectedSharedItem
        ? messages.find((message) => normalizeId(message._id) === normalizeId(selectedSharedItem.messageId)) || null
        : null,
    [messages, selectedSharedItem]
  );

  const filteredForwardChats = useMemo(
    () =>
      chats.filter((entry) => {
        if (!forwardSearch.trim()) return true;
        return getChatName(entry, user?._id).toLowerCase().includes(forwardSearch.trim().toLowerCase());
      }),
    [chats, forwardSearch, user?._id]
  );

  const chatName = chat ? getChatName(chat, user?._id) : 'Shared Files';
  const chatAvatar = chat ? getChatAvatar(chat, user?._id) : '';
  const canDeleteForEveryone =
    normalizeId(selectedSharedMessage?.senderId) === currentUserId && !selectedSharedMessage?.isDeletedForEveryone;

  useEffect(() => {
    if (!selectedSharedItem) return;
    if (selectedSharedMessage) return;
    setSelectedSharedItem(null);
  }, [selectedSharedItem, selectedSharedMessage]);

  useEffect(() => {
    if (normalizeId(mediaViewerMessage?._id) && !messages.some((message) => normalizeId(message._id) === normalizeId(mediaViewerMessage?._id))) {
      setMediaViewerMessage(null);
    }
  }, [mediaViewerMessage, messages]);

  const changeTab = (tab) => {
    setSearchParams({ tab });
  };

  const openMedia = (message) => {
    if (!message?.mediaUrl) return;
    setMediaViewerMessage(message);
  };

  const openSharedItemActions = (item) => {
    setSelectedSharedItem(item);
  };

  const closeSharedItemActions = () => {
    setSelectedSharedItem(null);
  };

  const openSelectedSharedItem = () => {
    if (!selectedSharedItem || !selectedSharedMessage) return;

    closeSharedItemActions();

    if (selectedSharedItem.type === 'link') {
      window.open(selectedSharedItem.normalized, '_blank', 'noopener,noreferrer');
      return;
    }

    openMedia(selectedSharedMessage);
  };

  const showSelectedItemInChat = () => {
    if (!selectedSharedMessage) return;

    if (chat) {
      setSelectedChat(chat);
    }

    closeSharedItemActions();
    navigate(`/chat/${chatId}?message=${selectedSharedMessage._id}`);
  };

  const handleShareSelectedItem = async () => {
    if (!selectedSharedItem || !selectedSharedMessage) return;

    const shareText =
      selectedSharedItem.type === 'link'
        ? selectedSharedItem.normalized
        : selectedSharedMessage.content?.trim() || getMessagePreviewText(selectedSharedMessage);
    const shareUrl =
      selectedSharedItem.type === 'link' ? selectedSharedItem.normalized : selectedSharedMessage.mediaUrl || '';
    const sharePayload = {
      title: 'Shared from NexChat',
      text: shareText,
      ...(shareUrl ? { url: shareUrl } : {}),
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }

      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }

      await navigator.clipboard.writeText([shareText, shareUrl].filter(Boolean).join('\n'));
      toast.success('Shared item copied to clipboard');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      toast.error('Unable to share this item');
    }
  };

  const handleOpenForwardModal = async (message) => {
    if (!message) return;

    if (!chats.length) {
      try {
        const nextChats = await chatService.getUserChats();
        setChats(applyContactAliasesToChats(nextChats, user));
      } catch {
        toast.error('Failed to load conversations');
      }
    }

    setForwardMessage(message);
    setForwardSearch('');
    setSelectedForwardChatIds([]);
  };

  const openForwardFromActions = async () => {
    if (!selectedSharedMessage) return;

    closeSharedItemActions();
    await handleOpenForwardModal(selectedSharedMessage);
  };

  const toggleForwardTarget = (targetChatId) => {
    setSelectedForwardChatIds((previous) =>
      previous.includes(targetChatId)
        ? previous.filter((id) => id !== targetChatId)
        : [...previous, targetChatId]
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

      toast.success(successCount === 1 ? 'Message forwarded' : `Message forwarded to ${successCount} chats`);
      closeForwardModal(true);
    } catch {
      toast.error('Failed to forward message');
    } finally {
      setIsForwarding(false);
    }
  };

  const removeSharedMessage = (messageId) => {
    setMessages((previous) => previous.filter((item) => normalizeId(item._id) !== normalizeId(messageId)));
  };

  const handleDeleteSelectedItem = async (scope = 'me') => {
    if (!selectedSharedMessage?._id) return;

    const confirmed = window.confirm(
      scope === 'everyone'
        ? 'Delete this shared item for everyone in the chat?'
        : 'Remove this shared item from your chat?'
    );

    if (!confirmed) return;

    try {
      await chatService.deleteMessage(selectedSharedMessage._id, scope);
      removeSharedMessage(selectedSharedMessage._id);
      closeSharedItemActions();
      toast.success(scope === 'everyone' ? 'Message deleted for everyone' : 'Message removed from your chat');
    } catch {
      toast.error('Failed to delete message');
    }
  };

  const renderMediaTab = () => {
    if (!mediaMessages.length) {
      return (
        <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-sm text-white/42">
          No shared media yet.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {[
          { key: 'image', label: 'Images & Photos', items: mediaGroups.image },
          { key: 'video', label: 'Videos', items: mediaGroups.video },
          { key: 'audio', label: 'Audio', items: mediaGroups.audio },
        ]
          .filter((section) => section.items.length)
          .map((section) => (
            <section key={section.key}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[1rem] font-semibold text-white">{section.label}</div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.7rem] font-semibold text-white/55">
                  {section.items.length}
                </div>
              </div>

              {section.key === 'image' ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {section.items.map((message) => (
                    <button
                      key={message._id}
                      type="button"
                      onClick={() => openSharedItemActions({ type: 'image', messageId: message._id })}
                      className="overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.03] transition hover:border-white/12 hover:bg-white/[0.06]"
                    >
                      <img src={message.mediaUrl} alt="Shared media" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}

              {section.key === 'video' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {section.items.map((message) => (
                    <button
                      key={message._id}
                      type="button"
                      onClick={() => openSharedItemActions({ type: 'video', messageId: message._id })}
                      className="overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03] text-left transition hover:border-white/12 hover:bg-white/[0.06]"
                    >
                      <div className="relative">
                        <video
                          src={message.mediaUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full bg-black object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full border border-white/12 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/86">
                            Actions
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-3 text-sm font-semibold text-white/82">
                        {message.content?.trim() || 'Shared video'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {section.key === 'audio' ? (
                <div className="space-y-3">
                  {section.items.map((message) => (
                    <button
                      key={message._id}
                      type="button"
                      onClick={() => openSharedItemActions({ type: 'audio', messageId: message._id })}
                      className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/12 hover:bg-white/[0.06]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">Audio</div>
                        <div className="mt-1 truncate text-[0.8rem] text-white/42">
                          {message.content?.trim() || 'Open shared audio'}
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold text-white/55">
                        Actions
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
      </div>
    );
  };

  const renderDocsTab = () => {
    if (!documentMessages.length) {
      return (
        <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-sm text-white/42">
          No shared docs yet.
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {documentMessages.map((message) => (
          <button
            key={message._id}
            type="button"
            onClick={() => openSharedItemActions({ type: 'document', messageId: message._id })}
            className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/12 hover:bg-white/[0.06]"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                {message.content?.trim() || 'Shared document'}
              </div>
              <div className="mt-1 truncate text-[0.8rem] text-white/42">
                {message.messageType || 'Document'}
              </div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold text-white/55">
              Actions
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderLinksTab = () => {
    if (!sharedLinks.length) {
      return (
        <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.025] px-5 py-10 text-sm text-white/42">
          No shared links yet.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sharedLinks.map((item) => (
          <button
            key={`${item.normalized}-${item.messageId}`}
            type="button"
            onClick={() => openSharedItemActions(item)}
            className="block w-full rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/12 hover:bg-white/[0.06]"
          >
            <div className="font-semibold text-white">{item.link.replace(/^https?:\/\//, '')}</div>
            <div className="mt-1 break-all text-sm text-white/42">{item.normalized}</div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#050508]">
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0a0a12]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/10 bg-[rgba(10,10,18,0.88)] px-4 py-4 backdrop-blur-2xl md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/chat/${chatId}`)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-white/72 transition hover:bg-white/[0.08] hover:text-white"
              >
                Back
              </button>

              <Avatar
                src={chatAvatar}
                name={chatName}
                size={11}
                shape={chat?.isGroupChat ? 'round' : 'soft'}
              />

              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-white">{chatName}</div>
                <div className="mt-1 text-sm text-white/42">Shared Files</div>
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-4 md:px-6">
            <div className="flex items-center gap-2 overflow-x-auto">
              {[
                { id: 'media', label: 'Media' },
                { id: 'docs', label: 'Docs' },
                { id: 'links', label: 'Links' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => changeTab(tab.id)}
                  className={`border-b-2 px-4 py-4 text-lg transition ${
                    activeTab === tab.id
                      ? 'border-[#4affa0] text-white'
                      : 'border-transparent text-white/48 hover:text-white/72'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="app-scrollbar flex-1 overflow-y-auto px-4 py-6 md:px-6">
            {isLoadingMessages ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-white/55">
                <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-white/10 border-t-[#7c6aff]" />
                <p className="text-[0.76rem] uppercase tracking-[0.08em]">Loading shared files...</p>
              </div>
            ) : (
              <>
                {activeTab === 'media' ? renderMediaTab() : null}
                {activeTab === 'docs' ? renderDocsTab() : null}
                {activeTab === 'links' ? renderLinksTab() : null}
              </>
            )}
          </div>
        </div>
      </div>

      <MediaViewerModal
        message={mediaViewerMessage}
        onClose={() => setMediaViewerMessage(null)}
      />

      <Modal
        isOpen={Boolean(selectedSharedItem && selectedSharedMessage)}
        onClose={closeSharedItemActions}
        title="Shared Item"
        maxWidthClass="max-w-lg"
      >
        {selectedSharedItem && selectedSharedMessage ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/38">
                {selectedSharedItem.type === 'link' ? 'Link' : selectedSharedMessage.messageType || 'Shared item'}
              </div>
              <div className="mt-2 break-words text-sm font-semibold leading-6 text-white">
                {getSharedItemHeading(selectedSharedItem, selectedSharedMessage)}
              </div>
              <div className="mt-2 break-all text-sm text-white/46">
                {getSharedItemMeta(selectedSharedItem, selectedSharedMessage)}
              </div>
              <div className="mt-3 text-xs text-white/34">
                Shared {new Date(selectedSharedMessage.createdAt || Date.now()).toLocaleString()}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={openSelectedSharedItem}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08] hover:text-white"
              >
                {getPrimaryActionLabel(selectedSharedItem, selectedSharedMessage)}
              </button>
              <button
                type="button"
                onClick={showSelectedItemInChat}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08] hover:text-white"
              >
                Show in Chat
              </button>
              <button
                type="button"
                onClick={handleShareSelectedItem}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08] hover:text-white"
              >
                Share
              </button>
              <button
                type="button"
                onClick={openForwardFromActions}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08] hover:text-white"
              >
                Forward
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSelectedItem('me')}
                className="rounded-2xl border border-[#ffb7d2]/20 bg-[#ff7aa8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1e1] transition hover:bg-[#ff7aa8]/14"
              >
                Delete for Me
              </button>
              {canDeleteForEveryone ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSelectedItem('everyone')}
                  className="rounded-2xl border border-[#ffb7d2]/20 bg-[#ff7aa8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1e1] transition hover:bg-[#ff7aa8]/14"
                >
                  Delete for Everyone
                </button>
              ) : null}
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
                        src={getChatAvatar(entry, user?._id)}
                        name={getChatName(entry, user?._id)}
                        size={10}
                        online={
                          !entry.isGroupChat &&
                          Boolean(entry.participants?.find((participant) => participant._id !== user?._id)?.isOnline)
                        }
                        shape={entry.isGroupChat ? 'round' : 'soft'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-white">{getChatName(entry, user?._id)}</div>
                        <div className="truncate text-sm text-white/38">
                          {entry.isGroupChat
                            ? `${entry.participants?.length || 0} members`
                            : entry.participants?.find((participant) => participant._id !== user?._id)?.email || 'Direct chat'}
                        </div>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.68rem] ${
                          isSelected
                            ? 'border-[#7c6aff]/35 bg-[#7c6aff] text-white'
                            : 'border-white/14 text-transparent'
                        }`}
                      >
                        +
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
    </div>
  );
};

export default SharedFilesPage;
