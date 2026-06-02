import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import UserProfile from '../components/profile/UserProfile';
import Avatar from '../components/shared/Avatar';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../hooks/useNotification';
import { groupService } from '../services/groupService';
import { userService } from '../services/userService';
import { resolveNotificationPreferences } from '../utils/notificationPreferences';
import { resolvePrivacySettings } from '../utils/privacySettings';

const NOTIFICATION_ITEMS = [
  {
    id: 'messageNotificationMode',
    label: 'Message notifications',
    desc: 'Choose which browser notifications and sounds can interrupt you',
    type: 'mode',
    options: [
      { value: 'all', label: 'All' },
      { value: 'direct', label: 'Direct only' },
      { value: 'mentions', label: 'Mentions' },
      { value: 'none', label: 'Off' },
    ],
  },
  {
    id: 'emailNotificationMode',
    label: 'Email notifications',
    desc: 'Choose which offline emails you receive',
    type: 'mode',
    options: [
      { value: 'all', label: 'All offline' },
      { value: 'direct', label: 'Direct only' },
      { value: 'none', label: 'Off' },
    ],
  },
  {
    id: 'soundAlerts',
    label: 'Sound alerts',
    desc: 'Play sound on new message',
  },
  {
    id: 'soundTone',
    label: 'Alert tone',
    desc: 'Choose the ringtone for messages and incoming calls',
    type: 'mode',
    options: [
      { value: 'chime', label: 'Chime' },
      { value: 'pop', label: 'Pop' },
      { value: 'bell', label: 'Bell' },
      { value: 'pulse', label: 'Pulse' },
    ],
  },
];

const PRIVACY_ITEMS = [
  {
    id: 'lastSeenVisibility',
    label: 'Activity status',
    desc: 'Choose who can see whether you are active or inactive',
    options: [
      { value: 'everyone', label: 'Everyone' },
      { value: 'contacts', label: 'Contacts' },
      { value: 'nobody', label: 'Nobody' },
    ],
  },
  {
    id: 'profilePhotoVisibility',
    label: 'Profile photo',
    desc: 'Choose who can see your profile picture in chats and search',
    options: [
      { value: 'everyone', label: 'Everyone' },
      { value: 'contacts', label: 'Contacts' },
      { value: 'nobody', label: 'Nobody' },
    ],
  },
  {
    id: 'readReceipts',
    label: 'Read receipts',
    desc: 'If turned off, others will not see when you read their messages',
    options: [
      { value: true, label: 'On' },
      { value: false, label: 'Off' },
    ],
  },
  {
    id: 'groupInvitePermission',
    label: 'Group adds',
    desc: 'Control who can send requests to add you into groups',
    options: [
      { value: 'ask_first', label: 'Ask first' },
      { value: 'contacts_only', label: 'Contacts only' },
      { value: 'nobody', label: 'Nobody' },
    ],
  },
];

const Settings = () => {
  const navigate = useNavigate();
  const { logout, user, updateUser } = useAuth();
  const { setChats, setSelectedChat } = useChat();
  const { socket } = useSocket();
  const { requestNotificationPermission, playNotificationSound } = useNotification();
  const [tab, setTab] = useState('profile');
  const [savingNotificationId, setSavingNotificationId] = useState('');
  const [savingPrivacyId, setSavingPrivacyId] = useState('');
  const [pendingGroupInvites, setPendingGroupInvites] = useState([]);
  const [loadingGroupInvites, setLoadingGroupInvites] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState('');
  const notificationPreferences = resolveNotificationPreferences(user?.notificationPreferences);
  const privacySettings = resolvePrivacySettings(user?.privacySettings);

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'privacy', label: 'Privacy' },
  ];

  useEffect(() => {
    if (tab !== 'privacy') return;

    let isCurrent = true;
    setLoadingGroupInvites(true);
    setLoadingBlockedUsers(true);

    Promise.allSettled([
      groupService.getPendingInvites(),
      userService.getBlockedUsers(),
    ]).then(([groupInvitesResult, blockedUsersResult]) => {
      if (!isCurrent) return;

      if (groupInvitesResult.status === 'fulfilled') {
        setPendingGroupInvites(Array.isArray(groupInvitesResult.value) ? groupInvitesResult.value : []);
      } else {
        setPendingGroupInvites([]);
        toast.error('Failed to load group requests');
      }

      if (blockedUsersResult.status === 'fulfilled') {
        setBlockedUsers(Array.isArray(blockedUsersResult.value) ? blockedUsersResult.value : []);
      } else {
        setBlockedUsers([]);
        toast.error('Failed to load blocked conversations');
      }

      setLoadingGroupInvites(false);
      setLoadingBlockedUsers(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [tab, user?.blockedUsers]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleGroupInviteReceived = (invite) => {
      if (!invite?._id) return;

      setPendingGroupInvites((previous) => {
        if (previous.some((entry) => entry._id === invite._id)) {
          return previous;
        }

        return [invite, ...previous];
      });

      toast.success(`${invite.inviter?.name || 'Someone'} sent you a group request`);
    };

    socket.on('groupInviteReceived', handleGroupInviteReceived);

    return () => {
      socket.off('groupInviteReceived', handleGroupInviteReceived);
    };
  }, [socket]);

  const saveNotificationPreferences = async (nextPreferences, previousPreferences, preferenceId) => {
    setSavingNotificationId(preferenceId);

    try {
      updateUser({ notificationPreferences: nextPreferences });

      if (preferenceId === 'soundAlerts' && nextPreferences.soundAlerts) {
        playNotificationSound();
      }

      const updatedUser = await userService.updateNotificationPreferences(nextPreferences);
      updateUser(updatedUser);
      toast.success('Notification settings updated');
    } catch (error) {
      updateUser({ notificationPreferences: previousPreferences });
      toast.error(error.response?.data?.message || 'Failed to update notification settings');
    } finally {
      setSavingNotificationId('');
    }
  };

  const handleToggleNotification = async (preferenceId) => {
    const previousPreferences = resolveNotificationPreferences(user?.notificationPreferences);
    const nextPreferences = {
      ...previousPreferences,
      [preferenceId]: !previousPreferences[preferenceId],
    };

    await saveNotificationPreferences(nextPreferences, previousPreferences, preferenceId);
  };

  const handleSelectNotificationMode = async (preferenceId, value) => {
    const previousPreferences = resolveNotificationPreferences(user?.notificationPreferences);
    const nextPreferences = {
      ...previousPreferences,
      [preferenceId]: value,
      ...(preferenceId === 'messageNotificationMode' ? { messageNotifications: value !== 'none' } : {}),
      ...(preferenceId === 'emailNotificationMode' ? { emailNotifications: value !== 'none' } : {}),
    };

    if (preferenceId === 'messageNotificationMode' && value !== 'none') {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        toast.error('This browser does not support notifications.');
        return;
      }

      const permission = await requestNotificationPermission();

      if (permission === 'denied') {
        toast.error('Browser notifications are blocked in your browser settings.');
        return;
      }

      if (permission !== 'granted') {
        toast.error('Notification permission was not granted.');
        return;
      }
    }

    await saveNotificationPreferences(nextPreferences, previousPreferences, preferenceId);

    if (preferenceId === 'soundTone' && nextPreferences.soundAlerts) {
      playNotificationSound(value);
    }
  };

  const handleSelectPrivacyOption = async (privacyId, value) => {
    const previousPrivacySettings = resolvePrivacySettings(user?.privacySettings);
    const nextPrivacySettings = {
      ...previousPrivacySettings,
      [privacyId]: value,
    };

    setSavingPrivacyId(privacyId);
    updateUser({ privacySettings: nextPrivacySettings });

    try {
      const updatedUser = await userService.updatePrivacySettings(nextPrivacySettings);
      updateUser(updatedUser);
      toast.success('Privacy settings updated');
    } catch (error) {
      updateUser({ privacySettings: previousPrivacySettings });
      toast.error(error.response?.data?.message || 'Failed to update privacy settings');
    } finally {
      setSavingPrivacyId('');
    }
  };

  const handleRespondToInvite = async (inviteId, action) => {
    setRespondingInviteId(inviteId);

    try {
      const response = await groupService.respondToInvite(inviteId, action);
      setPendingGroupInvites((previous) => previous.filter((invite) => invite._id !== inviteId));
      if (action === 'accept' && response.chat) {
        setChats((previous) => {
          const filtered = previous.filter((chat) => chat._id !== response.chat._id);
          return [response.chat, ...filtered];
        });
        setSelectedChat(response.chat);
      }
      toast.success(response.message || (action === 'accept' ? 'Group request accepted' : 'Group request declined'));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update group request');
    } finally {
      setRespondingInviteId('');
    }
  };

  const handleUnblockUser = async (blockedUser) => {
    if (!blockedUser?._id) return;

    const displayName = blockedUser.localName || blockedUser.name || 'this person';
    const confirmed = window.confirm(
      `Unblock ${displayName}? Their direct chat will be allowed again and can return to your sidebar.`
    );

    if (!confirmed) return;

    setUnblockingUserId(blockedUser._id);

    try {
      const response = await userService.unblockUser(blockedUser._id);

      if (response?.user) {
        updateUser(response.user);
      } else {
        updateUser((previous) =>
          previous
            ? {
                ...previous,
                blockedUsers: (previous.blockedUsers || []).filter((entry) => entry !== blockedUser._id),
              }
            : previous
        );
      }

      setBlockedUsers((previous) =>
        previous.filter((entry) => entry._id !== blockedUser._id)
      );
      toast.success(response?.message || `${displayName} unblocked`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to unblock user');
    } finally {
      setUnblockingUserId('');
    }
  };

  const getMessageNotificationDescription = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'This browser does not support push notifications';
    }

    if (Notification.permission === 'denied') {
      return 'Browser notifications are blocked. Enable them in your browser settings.';
    }

    return 'Get notified for new messages';
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-gray-950 text-white">
      <div className="flex shrink-0 items-center gap-4 border-b border-gray-800 bg-gray-900 px-6 py-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 transition hover:text-white"
        >
          Back
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="app-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-6">
          <div className="mb-6 flex gap-2 border-b border-gray-800 pb-4">
            {tabs.map((currentTab) => (
              <button
                key={currentTab.id}
                onClick={() => setTab(currentTab.id)}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  tab === currentTab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {currentTab.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && <UserProfile />}

          {tab === 'notifications' && (
            <div className="space-y-4">
              {NOTIFICATION_ITEMS.map((item) => {
                const isSaving = savingNotificationId === item.id;
                const description =
                  item.id === 'messageNotificationMode'
                    ? getMessageNotificationDescription()
                    : item.desc;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4"
                  >
                    <div className="pr-4">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{description}</p>
                    </div>
                    {item.type === 'mode' ? (
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {item.options.map((option) => {
                          const isSelected = notificationPreferences[item.id] === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleSelectNotificationMode(item.id, option.value)}
                              disabled={isSaving}
                              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-600 text-white'
                                  : 'border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-300'
                              } ${isSaving ? 'cursor-wait opacity-70' : ''}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleNotification(item.id)}
                        disabled={isSaving}
                        aria-pressed={Boolean(notificationPreferences[item.id])}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
                          notificationPreferences[item.id]
                            ? 'border-purple-400/40 bg-purple-600'
                            : 'border-white/10 bg-gray-800'
                        } ${isSaving ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            notificationPreferences[item.id] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'privacy' && (
            <div className="space-y-4">
              {PRIVACY_ITEMS.map((item) => {
                const activeValue = privacySettings[item.id];
                const isSaving = savingPrivacyId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-4"
                  >
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-xs text-gray-400">{item.desc}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.options.map((option) => {
                        const isSelected = activeValue === option.value;

                        return (
                          <button
                            key={String(option.value)}
                            type="button"
                            onClick={() => handleSelectPrivacyOption(item.id, option.value)}
                            disabled={isSaving}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                              isSelected
                                ? 'border-purple-600 bg-purple-600 text-white'
                                : 'border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-300'
                            } ${isSaving ? 'cursor-wait opacity-70' : ''}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Blocked conversations</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Review people you blocked from direct messaging. Their chats stay hidden from your sidebar.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold text-white/60">
                    {blockedUsers.length}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {loadingBlockedUsers ? (
                    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/45">
                      Loading blocked conversations...
                    </div>
                  ) : blockedUsers.length ? (
                    blockedUsers.map((blockedUser) => {
                      const displayName = blockedUser.localName || blockedUser.name || 'Blocked user';

                      return (
                        <div
                          key={blockedUser._id}
                          className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-4"
                        >
                          <Avatar
                            src={blockedUser.profilePicture}
                            name={displayName}
                            size={11}
                            shape="soft"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-white">{displayName}</div>
                              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-red-300">
                                Blocked
                              </span>
                              {blockedUser.isChatHidden ? (
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-white/55">
                                  Chat hidden
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              {blockedUser.email}
                            </div>
                            <div className="mt-2 text-xs text-white/55">
                              {blockedUser.isChatHidden
                                ? 'Their direct chat is hidden and new direct messages are blocked.'
                                : 'New direct messages are blocked.'}
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => handleUnblockUser(blockedUser)}
                                disabled={unblockingUserId === blockedUser._id}
                                className="rounded-lg border border-[#4affa0]/25 bg-[#4affa0]/10 px-3 py-2 text-xs font-semibold text-[#bfffe0] transition hover:bg-[#4affa0]/16 hover:text-white disabled:cursor-wait disabled:opacity-60"
                              >
                                {unblockingUserId === blockedUser._id ? 'Unblocking...' : 'Unblock'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/45">
                      No blocked conversations yet. Use the Block action inside a direct chat when you need it.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Pending group requests</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Accept or decline requests before anyone new can add you to a group.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold text-white/60">
                    {pendingGroupInvites.length}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {loadingGroupInvites ? (
                    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/45">
                      Loading group requests...
                    </div>
                  ) : pendingGroupInvites.length ? (
                    pendingGroupInvites.map((invite) => (
                      <div
                        key={invite._id}
                        className="rounded-xl border border-white/8 bg-black/20 px-4 py-4"
                      >
                        <div className="text-sm font-semibold text-white">
                          {invite.inviter?.name || 'Someone'} wants to add you to {invite.chat?.chatName || 'a group'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {invite.chat?.participantCount || 0} members
                          {invite.chat?.groupDescription ? ` • ${invite.chat.groupDescription}` : ''}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleRespondToInvite(invite._id, 'accept')}
                            disabled={respondingInviteId === invite._id}
                            className="rounded-lg border border-purple-500/30 bg-purple-600/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-purple-600/30 disabled:cursor-wait disabled:opacity-60"
                          >
                            {respondingInviteId === invite._id ? 'Saving...' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondToInvite(invite._id, 'decline')}
                            disabled={respondingInviteId === invite._id}
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/72 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-white/45">
                      No pending group requests right now.
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="mt-6 w-full rounded-xl border border-red-600/30 bg-red-600/20 py-3 text-sm text-red-400 transition hover:bg-red-600/30"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
