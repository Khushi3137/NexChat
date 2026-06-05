import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { chatService } from '../../services/chatService';
import api from '../../services/api';
import { applyContactAliasesToChat, applyContactAliasesToChats, getChatName } from '../../utils/helpers';
import Avatar from '../shared/Avatar';
import CreateGroup from '../groups/CreateGroup';
import Modal from '../shared/Modal';
import ConversationList from './ConversationList';

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'nexchat-sidebar-collapsed';
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const getChatActivityTime = (chat) => chat?.lastMessage?.createdAt || chat?.updatedAt || '';
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
const getStatusPresenceBorder = (chat, currentUserId) => {
  if (chat?.isAIBotChat || chat?.isGroupChat) return 'none';

  const other = chat?.participants?.find(
    (participant) => normalizeId(participant) !== normalizeId(currentUserId)
  );

  if (other?.canViewLastSeen === false) return 'none';
  return other?.isOnline ? 'active' : 'inactive';
};
const filters = [
  { id: 'all', label: 'All' },
  { id: 'groups', label: 'Groups' },
  { id: 'ai', label: 'AI Bot' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { chats, setChats, setSelectedChat, resetChatState } = useChat();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showGroup, setShowGroup] = useState(false);
  const [selectedSearchUser, setSelectedSearchUser] = useState(null);
  const [requestDraft, setRequestDraft] = useState('');
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === 'true';
  });
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const isChatRoute = location.pathname.startsWith('/chat/');
  const isSidebarCollapsed = isCollapsed && isDesktopViewport;

  useEffect(() => {
    if (!user?._id) {
      setChats([]);
      return undefined;
    }

    chatService
      .getUserChats()
      .then((data) => setChats(applyContactAliasesToChats(data, user)))
      .catch(() => setChats([]));
    return undefined;
  }, [setChats, user]);

  useEffect(() => {
    setSearch('');
    setSearchResults([]);
    setSelectedSearchUser(null);
    setRequestDraft('');
    setIsCreatingRequest(false);
    setActiveFilter('all');
  }, [user?._id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users?search=${encodeURIComponent(search)}`);
        setSearchResults(data.filter((candidate) => candidate._id !== user?._id));
      } catch {
        setSearchResults([]);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search, user?._id]);

  const syncOpenedChat = (chat) => {
    const chatWithAliases = applyContactAliasesToChat(chat, user);
    setChats((previous) => upsertChatInList(previous, chatWithAliases));
    setSelectedChat(chatWithAliases);
    navigate(`/chat/${chat._id}`);
    setSearch('');
    setSearchResults([]);
    setSelectedSearchUser(null);
    setRequestDraft('');
    setIsCreatingRequest(false);
  };

  const openExistingChat = async (chatId) => {
    try {
      const chat = applyContactAliasesToChat(await chatService.getChatById(chatId), user);
      syncOpenedChat(chat);
    } catch {
      toast.error('Failed to open chat');
    }
  };

  const sendSearchRequest = async (requestMode) => {
    if (!selectedSearchUser?._id) return;

    const intro = requestDraft.trim();
    if (!intro) {
      toast.error('Add a message before sending the request');
      return;
    }

    setIsCreatingRequest(true);
    try {
      const chat = await chatService.createOrGet(selectedSearchUser._id, {
        requestMode,
        initialMessage: intro,
      });
      syncOpenedChat(chat);
      toast.success(requestMode === 'friend' ? 'Friend request sent' : 'Message request sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const openAIChat = async () => {
    try {
      const chat = await chatService.createOrGetAIChat();
      setChats((previous) => {
        const existingIndex = previous.findIndex((item) => item._id === chat._id);
        if (existingIndex === -1) {
          return [chat, ...previous];
        }

        const next = [...previous];
        next[existingIndex] = { ...next[existingIndex], ...chat };
        return next;
      });
      setSelectedChat(chat);
      navigate(`/chat/${chat._id}`);
      setSearch('');
      setSearchResults([]);
    } catch {
      toast.error('Failed to open AI Bot');
    }
  };

  const filteredChats = chats.filter((chat) => {
    if (activeFilter === 'groups' && !chat.isGroupChat) return false;
    if (activeFilter === 'ai' && !chat.isAIBotChat) return false;

    if (!search.trim()) return true;

    const query = search.toLowerCase();
    const name = getChatName(chat, user?._id).toLowerCase();
    const preview = chat.lastMessage?.content?.toLowerCase() || '';
    const otherEmail = !chat.isGroupChat && !chat.isAIBotChat
      ? chat.participants?.find((participant) => normalizeId(participant) !== normalizeId(user?._id))?.email?.toLowerCase() || ''
      : '';
    return name.includes(query) || preview.includes(query) || otherEmail.includes(query);
  });

  const statusChats = chats.filter((chat) => !chat.isAIBotChat).slice(0, 8);
  const selectedSearchStatus = selectedSearchUser?.existingChatRequestStatus || 'none';
  const selectedSearchHasExistingChat = Boolean(selectedSearchUser?.existingChatId);
  const selectedSearchHasPendingChat = selectedSearchStatus === 'pending' && selectedSearchHasExistingChat;
  const selectedSearchHasOpenChat =
    selectedSearchHasExistingChat && !['pending', 'declined'].includes(selectedSearchStatus);
  const selectedSearchIsRequester =
    normalizeId(selectedSearchUser?.existingChatRequestedBy) === normalizeId(user?._id);

  return (
    <>
      <aside
        className={`${isChatRoute ? 'hidden md:flex' : 'flex'} relative h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#0f0f1a]/95 backdrop-blur-[18px] transition-[width,min-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isSidebarCollapsed ? 'w-[108px] min-w-[108px]' : 'w-[340px] min-w-[340px]'
        } max-md:min-w-0 max-md:w-full`}
        style={{
          backgroundImage:
            'radial-gradient(circle at top right, rgba(124,106,255,0.12), transparent 26%), radial-gradient(circle at bottom left, rgba(255,106,176,0.07), transparent 30%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.025)_1px,transparent_0)] bg-[size:28px_28px] opacity-35" />

        <div className="relative z-10 shrink-0 border-b border-white/8 bg-[#0f0f1a]/96 backdrop-blur-2xl">
          <div className={`flex items-center justify-between gap-3 px-5 pb-4 pt-5 ${isSidebarCollapsed ? 'flex-col items-center px-3' : ''}`}>
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'w-full justify-center' : ''}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#7c6aff] to-[#ff6ab0] text-white shadow-[0_4px_20px_rgba(124,106,255,0.35)]">
                <span className="brand-font text-[1rem] font-extrabold">NC</span>
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  isSidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-2' : 'max-w-[140px] opacity-100 translate-x-0'
                }`}
              >
                <div className="logo-wordmark text-[1.15rem] font-extrabold leading-none text-[#f0eeff]">NexChat</div>
                <div className="mt-1 text-[0.72rem] text-white/30">Messages</div>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'w-full flex-col' : ''}`}>
              <button
                type="button"
                id="sidebar-create-group-button"
                onClick={() => setShowGroup(true)}
                title="Create group"
                className={`inline-flex h-[34px] items-center justify-center rounded-[10px] border border-white/8 bg-[#14141f] text-sm text-white/55 transition hover:bg-[#1a1a28] hover:text-white ${
                  isSidebarCollapsed ? 'w-full px-0' : 'px-3'
                }`}
              >
                {isSidebarCollapsed ? '+' : 'Group'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSearchResults([]);
                  setIsCollapsed((previous) => !previous);
                }}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={`hidden md:inline-flex h-[34px] items-center justify-center rounded-[10px] border border-white/8 bg-[#14141f] text-sm text-white/55 transition hover:bg-[#1a1a28] hover:text-white ${
                  isSidebarCollapsed ? 'w-full px-0' : 'px-3'
                }`}
              >
                {isSidebarCollapsed ? '>>' : '<<'}
              </button>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              isSidebarCollapsed ? 'pointer-events-none max-h-0 px-3 pb-0 opacity-0' : 'max-h-28 px-5 pb-3 opacity-100'
            }`}
          >
            <div className="relative">
              <input
                id="sidebar-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search chats, usernames, or emails"
                className="w-full rounded-[12px] border border-white/8 bg-[#14141f] px-4 py-3 text-sm text-[#f0eeff] outline-none transition placeholder:text-white/25 focus:border-[#7c6aff] focus:bg-[#1a1a28] focus:shadow-[0_0_0_3px_rgba(124,106,255,0.15)]"
              />
            </div>
          </div>

          <div className={`px-5 pb-4 ${isSidebarCollapsed ? 'flex flex-col gap-2 px-3' : 'flex gap-2'}`}>
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  id={filter.id === 'ai' ? 'sidebar-ai-filter-button' : undefined}
                  title={filter.label}
                  onClick={() => {
                    setActiveFilter(filter.id);
                    if (filter.id === 'ai') {
                      openAIChat();
                    }
                  }}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    activeFilter === filter.id
                      ? 'bg-[#7c6aff]/15 text-[#7c6aff]'
                      : 'text-white/30 hover:bg-[#14141f] hover:text-white/60'
                  } ${isSidebarCollapsed ? 'w-full px-0 text-[0.72rem]' : 'flex-1'}`}
                >
                  {isSidebarCollapsed
                    ? filter.id === 'groups'
                      ? 'Grp'
                      : filter.id === 'ai'
                        ? 'AI'
                        : filter.label
                    : filter.label}
                </button>
              ))}
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              !isSidebarCollapsed && statusChats.length
                ? 'max-h-[260px] px-5 pb-4 opacity-100'
                : 'pointer-events-none max-h-0 px-3 pb-0 opacity-0'
            }`}
          >
            {statusChats.length ? (
            <>
              <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-[#7c6aff]/55 to-[#ff6ab0]/38" />
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-white/45">Status</div>
                <span className="rounded-full border border-[#7c6aff]/18 bg-[#7c6aff]/10 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-[#d4ccff]">
                  Live
                </span>
              </div>
              <div className="rounded-[18px] border border-white/6 bg-white/[0.02] px-2.5 pb-2 pt-2">
                <div className="app-scrollbar-x flex snap-x gap-3 overflow-x-scroll pb-2 pr-2">
                  {statusChats.map((chat) => {
                    const label = getChatName(chat, user?._id);
                    const presenceBorder = getStatusPresenceBorder(chat, user?._id);
                    const statusRingClass =
                      presenceBorder === 'active'
                        ? 'bg-[linear-gradient(135deg,#4affa0,#20d27d)] shadow-[0_0_14px_rgba(74,255,160,0.26)]'
                        : presenceBorder === 'inactive'
                          ? 'bg-[linear-gradient(135deg,#ff7d88,#ff5264)] shadow-[0_0_14px_rgba(255,107,122,0.22)]'
                          : 'bg-gradient-to-br from-[#7c6aff] to-[#ff6ab0] shadow-[0_0_12px_rgba(124,106,255,0.25)]';
                    return (
                      <button
                        key={chat._id}
                        type="button"
                        onClick={() => {
                          setSelectedChat(chat);
                          navigate(`/chat/${chat._id}`);
                        }}
                        className="flex min-w-[64px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-[16px] border border-transparent px-1 py-1 transition hover:border-white/8 hover:bg-white/[0.03]"
                      >
                        <span className={`flex h-[46px] w-[46px] items-center justify-center rounded-full p-[2px] ${statusRingClass}`}>
                          <span className="rounded-full bg-[#0f0f1a] p-[2px]">
                            <Avatar
                              src={chat.isGroupChat ? chat.groupPicture : undefined}
                              name={label}
                              size={10}
                              presenceBorder={presenceBorder}
                              shape="round"
                            />
                          </span>
                        </span>
                        <span className="max-w-[54px] truncate text-[0.64rem] text-white/42">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <div aria-hidden="true" className="status-scroll-indicator">
                  <span className="status-scroll-indicator__thumb" />
                </div>
              </div>
            </>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="app-scrollbar h-full overflow-y-auto overscroll-contain px-[10px] pb-4 pt-2">

            {searchResults.length ? (
              <section className="mx-[10px] mb-3 rounded-[16px] border border-white/8 bg-[#14141f] p-4">
                <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32">
                  People Search
                </div>
                <div className="space-y-2">
                  {searchResults.map((candidate) => (
                    <button
                      key={candidate._id}
                      type="button"
                      onClick={() => {
                        setSelectedSearchUser(candidate);
                        setRequestDraft(`Hi ${candidate.name.split(' ')[0]}, I'd like to connect with you on NexChat.`);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-3 text-left transition hover:bg-[#1a1a28]"
                    >
                      <Avatar src={candidate.profilePicture} name={candidate.name} size={10} shape="soft" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-[#f0eeff]">{candidate.name}</div>
                          {candidate.isFriend ? (
                            <span className="rounded-full border border-[#7c6aff]/18 bg-[#7c6aff]/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#d9d2ff]">
                              Friend
                            </span>
                          ) : candidate.isContact ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-white/45">
                              Contact
                            </span>
                          ) : candidate.existingChatRequestStatus === 'pending' ? (
                            <span className="rounded-full border border-[#ffb6bf]/18 bg-[#ffb6bf]/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#ffd4dc]">
                              Pending
                            </span>
                          ) : candidate.existingChatId ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-white/45">
                              Open
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-sm text-white/35">{candidate.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div className={`pb-5 ${isSidebarCollapsed ? 'px-0' : 'px-[10px]'}`}>
              <div
                className={`overflow-hidden px-[10px] transition-all duration-300 ease-out ${
                  isSidebarCollapsed ? 'pointer-events-none max-h-0 pb-0 pt-0 opacity-0' : 'max-h-10 pb-2 pt-1 opacity-100'
                }`}
              >
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/28">
                  Recent Conversations
                </div>
              </div>
              <ConversationList chats={filteredChats} collapsed={isSidebarCollapsed} />
            </div>
          </div>
        </div>

        <div className={`shrink-0 border-t border-white/8 bg-[#0a0a12]/85 pb-5 pt-4 backdrop-blur-2xl ${isSidebarCollapsed ? 'px-3' : 'px-5'}`}>
          <div className={`mb-3 flex min-w-0 items-center rounded-[16px] border border-white/8 bg-[#14141f] px-3 py-3 ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <Avatar src={user?.profilePicture} name={user?.name} size={10} online shape="soft" />
            {!isSidebarCollapsed ? (
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-[#f0eeff]">{user?.name || 'Workspace user'}</div>
              <div className="truncate text-[0.78rem] text-white/38">{user?.email || 'Connected to Nexus Chat'}</div>
            </div>
            ) : null}
          </div>

          <div className={`gap-2 ${isSidebarCollapsed ? 'flex flex-col' : 'flex'}`}>
            <button
              type="button"
              title="Settings"
              onClick={() => navigate('/settings')}
              className={`rounded-[12px] border border-white/8 bg-[#14141f] px-3 py-3 text-sm text-white/58 transition hover:bg-[#1a1a28] hover:text-white ${isSidebarCollapsed ? '' : 'flex-1'}`}
            >
              {isSidebarCollapsed ? 'Set' : 'Settings'}
            </button>
            <button
              type="button"
              title="Analytics"
              onClick={() => navigate('/analytics')}
              className={`rounded-[12px] border border-white/8 bg-[#14141f] px-3 py-3 text-sm text-white/58 transition hover:bg-[#1a1a28] hover:text-white ${isSidebarCollapsed ? '' : 'flex-1'}`}
            >
              {isSidebarCollapsed ? 'Ana' : 'Analytics'}
            </button>
            <button
              type="button"
              title="Logout"
              onClick={() => {
                resetChatState();
                logout();
                navigate('/login');
              }}
              className={`rounded-[12px] border border-[#ff6ab0]/20 bg-[#ff6ab0]/10 px-3 py-3 text-sm text-[#ffbad6] transition hover:bg-[#ff6ab0]/16 hover:text-white ${isSidebarCollapsed ? '' : 'flex-1'}`}
            >
              {isSidebarCollapsed ? 'Out' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>

      <Modal isOpen={showGroup} onClose={() => setShowGroup(false)} title="Create Group">
        <CreateGroup
          onClose={() => setShowGroup(false)}
          onCreated={(chat) => {
            setChats((previous) => upsertChatInList(previous, chat));
            setShowGroup(false);
          }}
        />
      </Modal>

      <Modal
        isOpen={Boolean(selectedSearchUser)}
        onClose={() => {
          if (isCreatingRequest) return;
          setSelectedSearchUser(null);
          setRequestDraft('');
        }}
        title={selectedSearchUser ? `Talk to ${selectedSearchUser.name}` : 'Start Conversation'}
      >
        {selectedSearchUser ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">{selectedSearchUser.name}</div>
              <div className="mt-1 text-sm text-white/45">{selectedSearchUser.email}</div>
              <div className="mt-3 text-sm leading-6 text-white/55">
                {selectedSearchHasOpenChat
                  ? 'You already have an active conversation here.'
                  : selectedSearchHasPendingChat
                    ? selectedSearchIsRequester
                      ? 'Your request is already waiting for their approval.'
                      : 'This person already has a pending request with you. Open the chat to allow or remove it.'
                    : selectedSearchStatus === 'declined'
                      ? 'A previous request was removed. You can send a fresh intro below.'
                      : 'First contact now starts with a request. You can send a normal message request or a friend request.'}
              </div>
            </div>

            {selectedSearchHasOpenChat || selectedSearchHasPendingChat ? (
              <button
                type="button"
                onClick={() => openExistingChat(selectedSearchUser.existingChatId)}
                className="w-full rounded-2xl border border-[#7c6aff]/25 bg-[#7c6aff]/14 px-4 py-3 text-sm font-semibold text-[#ece7ff] transition hover:bg-[#7c6aff]/20"
              >
                Open Conversation
              </button>
            ) : (
              <>
                <div>
                  <label htmlFor="search-request-message" className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-white/35">
                    Intro Message
                  </label>
                  <textarea
                    id="search-request-message"
                    rows={4}
                    value={requestDraft}
                    onChange={(event) => setRequestDraft(event.target.value)}
                    placeholder="Write a short message so they know why you want to chat."
                    className="w-full rounded-2xl border border-white/10 bg-[#14141f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
                  />
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => sendSearchRequest('message')}
                    disabled={isCreatingRequest}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send Message Without Friend Request
                  </button>
                  <button
                    type="button"
                    onClick={() => sendSearchRequest('friend')}
                    disabled={isCreatingRequest}
                    className="w-full rounded-2xl border border-[#7c6aff]/25 bg-[#7c6aff]/14 px-4 py-3 text-sm font-semibold text-[#ece7ff] transition hover:bg-[#7c6aff]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send Message With Friend Request
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default Sidebar;
