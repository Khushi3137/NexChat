const mongoose = require('mongoose');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const GroupInvite = require('../models/GroupInvite');
const { hasRelationshipWithUser, normalizeId, resolvePrivacySettings, sanitizeParticipantForViewer } = require('../utils/privacy');

const resolveChatRequestStatus = (chat) => chat?.requestStatus || 'none';
const resolveChatRequestType = (chat) => chat?.requestType || 'none';
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const serializeContactAliases = (aliases) => {
  if (!aliases) return {};
  if (typeof aliases.toObject === 'function') return aliases.toObject();
  if (aliases instanceof Map) return Object.fromEntries(aliases.entries());
  return aliases;
};
const serializeNotificationPreferences = (preferences) => ({
  messageNotifications: preferences?.messageNotifications !== false,
  messageNotificationMode: ['all', 'direct', 'mentions', 'none'].includes(preferences?.messageNotificationMode)
    ? preferences.messageNotificationMode
    : preferences?.messageNotifications === false
      ? 'none'
      : 'all',
  emailNotifications: preferences?.emailNotifications !== false,
  emailNotificationMode: ['all', 'direct', 'none'].includes(preferences?.emailNotificationMode)
    ? preferences.emailNotificationMode
    : preferences?.emailNotifications === false
      ? 'none'
      : 'all',
  soundAlerts: preferences?.soundAlerts !== false,
  soundTone: ['chime', 'pop', 'bell', 'pulse'].includes(preferences?.soundTone)
    ? preferences.soundTone
    : 'chime',
});
const serializeUserForClient = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profilePicture: user.profilePicture,
  bio: user.bio,
  contactAliases: serializeContactAliases(user.contactAliases),
  contacts: user.contacts || [],
  blockedUsers: user.blockedUsers || [],
  hiddenChats: user.hiddenChats || [],
  mutedChats: user.mutedChats || [],
  friends: user.friends || [],
  notificationPreferences: serializeNotificationPreferences(user.notificationPreferences),
  privacySettings: resolvePrivacySettings(user.privacySettings),
});
const resolveContactAlias = (aliases, targetUserId) => {
  if (!aliases || !targetUserId) return '';

  const value =
    typeof aliases.get === 'function'
      ? aliases.get(targetUserId)
      : aliases?.[targetUserId];

  return typeof value === 'string' ? value.trim() : '';
};
const ANALYTICS_DAY_WINDOW = 7;
const DAILY_CHAT_RESET_TIMEZONE = 'Asia/Kolkata';
const PEAK_HOUR_BUCKETS = [
  { label: '12AM', start: 0, end: 2 },
  { label: '3AM', start: 3, end: 5 },
  { label: '6AM', start: 6, end: 8 },
  { label: '9AM', start: 9, end: 11 },
  { label: '12PM', start: 12, end: 14 },
  { label: '3PM', start: 15, end: 17 },
  { label: '6PM', start: 18, end: 20 },
  { label: '9PM', start: 21, end: 23 },
];
const MESSAGE_TYPE_LABELS = {
  text: 'Text',
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents',
  location: 'Locations',
  poll: 'Polls',
  call: 'Calls',
};
const startOfUtcDay = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const formatDateKeyInTimeZone = (date = new Date(), timeZone = DAILY_CHAT_RESET_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '00';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};
const buildDailyWindow = (days = ANALYTICS_DAY_WINDOW) => {
  const today = startOfUtcDay();

  return Array.from({ length: days }, (_, index) => {
    const offset = days - index - 1;
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);

    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    };
  });
};
const buildEmptyDailyActivity = () =>
  buildDailyWindow().map((entry) => ({
    day: entry.label,
    sent: 0,
    received: 0,
    messages: 0,
  }));
const buildEmptyPeakHours = () =>
  PEAK_HOUR_BUCKETS.map((bucket) => ({
    hour: bucket.label,
    active: 0,
  }));
const buildEmptyDailyCallActivity = () =>
  buildDailyWindow().map((entry) => ({
    day: entry.label,
    total: 0,
    completed: 0,
    missed: 0,
    declined: 0,
    durationSeconds: 0,
  }));
const buildCallBreakdown = (entries = []) =>
  entries.filter((entry) => entry.value > 0);
const formatMessageType = (type) => MESSAGE_TYPE_LABELS[type] || 'Other';

// GET /api/users - search users
exports.searchUsers = async (req, res) => {
  const search = req.query.search?.trim();

  if (!search) {
    return res.json([]);
  }

  const safeSearch = escapeRegex(search);
  const blockedUserIds = Array.isArray(req.user.blockedUsers) ? req.user.blockedUsers : [];

  const users = await User.find({
    _id: { $nin: [req.user.id, ...blockedUserIds] },
    blockedUsers: { $ne: req.user.id },
    $or: [
      { name: { $regex: safeSearch, $options: 'i' } },
      { email: { $regex: safeSearch, $options: 'i' } },
    ],
  }).select('-password -passwordResetToken -passwordResetExpires');

  const candidateIds = users.map((candidate) => candidate._id);
  const directChats = candidateIds.length
    ? await Chat.find({
        isGroupChat: false,
        isAIBotChat: false,
        $and: [
          { participants: req.user.id },
          { participants: { $in: candidateIds } },
        ],
      }).select('participants requestStatus requestType requestedBy')
    : [];

  const chatByOtherUserId = new Map();
  directChats.forEach((chat) => {
    const otherUserId = normalizeId(
      chat.participants.find((participant) => normalizeId(participant) !== normalizeId(req.user.id))
    );
    if (otherUserId) {
      chatByOtherUserId.set(otherUserId, chat);
    }
  });

  res.json(
    users.map((candidate) => {
      const existingChat = chatByOtherUserId.get(normalizeId(candidate));
      const isFriend = hasRelationshipWithUser(req.user.friends, candidate);
      const isContact = isFriend || hasRelationshipWithUser(req.user.contacts, candidate);
      const sanitizedCandidate = sanitizeParticipantForViewer(candidate.toObject(), req.user.id, req.user);

      return {
        ...sanitizedCandidate,
        localName: resolveContactAlias(req.user.contactAliases, normalizeId(candidate)),
        isFriend,
        isContact,
        existingChatId: existingChat?._id || null,
        existingChatRequestStatus: resolveChatRequestStatus(existingChat),
        existingChatRequestType: resolveChatRequestType(existingChat),
        existingChatRequestedBy: existingChat?.requestedBy || null,
      };
    })
  );
};

// GET /api/users/blocked
exports.getBlockedUsers = async (req, res) => {
  const blockedUserIds = (Array.isArray(req.user.blockedUsers) ? req.user.blockedUsers : [])
    .map((entry) => normalizeId(entry))
    .filter(Boolean);

  if (!blockedUserIds.length) {
    return res.json([]);
  }

  const blockedUsers = await User.find({
    _id: { $in: blockedUserIds },
  }).select('-password -passwordResetToken -passwordResetExpires');

  const blockedUserById = new Map(
    blockedUsers.map((candidate) => [normalizeId(candidate), candidate])
  );

  const directChats = await Chat.find({
    isGroupChat: false,
    isAIBotChat: false,
    $and: [
      { participants: req.user.id },
      { participants: { $in: blockedUserIds } },
    ],
  }).select('_id participants updatedAt');

  const chatByOtherUserId = new Map();
  directChats.forEach((chat) => {
    const otherUserId = normalizeId(
      chat.participants.find((participant) => normalizeId(participant) !== normalizeId(req.user.id))
    );

    if (otherUserId) {
      chatByOtherUserId.set(otherUserId, chat);
    }
  });

  const hiddenChatIds = new Set(
    (Array.isArray(req.user.hiddenChats) ? req.user.hiddenChats : [])
      .map((entry) => normalizeId(entry))
      .filter(Boolean)
  );

  res.json(
    blockedUserIds
      .map((blockedUserId) => {
        const blockedUser = blockedUserById.get(blockedUserId);
        if (!blockedUser) return null;

        const directChat = chatByOtherUserId.get(blockedUserId);
        const sanitizedBlockedUser = sanitizeParticipantForViewer(
          blockedUser.toObject(),
          req.user.id,
          req.user
        );

        return {
          ...sanitizedBlockedUser,
          localName: resolveContactAlias(req.user.contactAliases, blockedUserId),
          existingChatId: directChat?._id || null,
          isChatHidden: hiddenChatIds.has(normalizeId(directChat?._id)),
          blockedChatUpdatedAt: directChat?.updatedAt || null,
        };
      })
      .filter(Boolean)
  );
};

// GET /api/users/analytics
exports.getUserAnalytics = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const hiddenChatIds = Array.isArray(req.user.hiddenChats) ? req.user.hiddenChats : [];

  const chats = await Chat.find({
    participants: req.user.id,
    ...(hiddenChatIds.length ? { _id: { $nin: hiddenChatIds } } : {}),
  }).select('_id isGroupChat isAIBotChat');

  const chatIds = chats.map((chat) => chat._id);

  if (!chatIds.length) {
    return res.json({
      summary: {
        totalMessages: 0,
        messagesSent: 0,
        messagesReceived: 0,
        activeDays: 0,
        totalChats: 0,
        directChats: 0,
        groupChats: 0,
        aiChats: 0,
      },
      callSummary: {
        totalCalls: 0,
        completedCalls: 0,
        missedCalls: 0,
        declinedCalls: 0,
        directCalls: 0,
        groupCalls: 0,
        voiceCalls: 0,
        videoCalls: 0,
        totalDurationSeconds: 0,
        averageDurationSeconds: 0,
        answeredRate: 0,
      },
      dailyActivity: buildEmptyDailyActivity(),
      dailyCallActivity: buildEmptyDailyCallActivity(),
      peakHours: buildEmptyPeakHours(),
      messageTypes: [],
      callOutcomes: [],
      callTypes: [],
      callScopes: [],
    });
  }

  const baseMatch = {
    chatId: { $in: chatIds },
    deletedFor: { $ne: req.user._id },
    isDeletedForEveryone: false,
    isSent: true,
  };
  const userAuthoredCondition = {
    $and: [
      { $eq: ['$senderId', userId] },
      { $ne: ['$messageType', 'ai'] },
    ],
  };
  const receivedCondition = {
    $or: [
      { $ne: ['$senderId', userId] },
      { $eq: ['$messageType', 'ai'] },
    ],
  };
  const dailyWindow = buildDailyWindow();
  const dailyStart = new Date(`${dailyWindow[0].key}T00:00:00.000Z`);
  const todayChatKey = formatDateKeyInTimeZone(new Date(), DAILY_CHAT_RESET_TIMEZONE);

  const [totalsResult, dailyResult, peakHourResult, messageTypeResult, todayChatResult, callSummaryResult, callDailyResult] = await Promise.all([
    Message.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          messagesSent: {
            $sum: {
              $cond: [userAuthoredCondition, 1, 0],
            },
          },
          messagesReceived: {
            $sum: {
              $cond: [receivedCondition, 1, 0],
            },
          },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          ...baseMatch,
          createdAt: { $gte: dailyStart },
        },
      },
      {
        $project: {
          dayKey: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
          isUserAuthored: userAuthoredCondition,
          isReceived: receivedCondition,
        },
      },
      {
        $group: {
          _id: '$dayKey',
          messages: { $sum: 1 },
          sent: {
            $sum: {
              $cond: ['$isUserAuthored', 1, 0],
            },
          },
          received: {
            $sum: {
              $cond: ['$isReceived', 1, 0],
            },
          },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          ...baseMatch,
          senderId: userId,
          messageType: { $ne: 'ai' },
        },
      },
      {
        $project: {
          hour: {
            $hour: {
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
        },
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          ...baseMatch,
          senderId: userId,
          messageType: { $ne: 'ai' },
        },
      },
      {
        $project: {
          type: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ['$messageType', ['text', 'image', 'video', 'audio', 'document', 'location', 'poll', 'call']],
                  },
                  then: '$messageType',
                },
              ],
              default: 'text',
            },
          },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Message.aggregate([
      { $match: baseMatch },
      {
        $project: {
          chatId: 1,
          dayKey: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: DAILY_CHAT_RESET_TIMEZONE,
            },
          },
        },
      },
      { $match: { dayKey: todayChatKey } },
      {
        $group: {
          _id: '$chatId',
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          ...baseMatch,
          messageType: 'call',
        },
      },
      {
        $project: {
          status: '$call.status',
          scope: { $ifNull: ['$call.scope', 'direct'] },
          callType: { $ifNull: ['$call.callType', 'audio'] },
          durationSeconds: { $ifNull: ['$call.durationSeconds', 0] },
        },
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          completedCalls: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
          missedCalls: {
            $sum: {
              $cond: [{ $eq: ['$status', 'missed'] }, 1, 0],
            },
          },
          declinedCalls: {
            $sum: {
              $cond: [{ $eq: ['$status', 'declined'] }, 1, 0],
            },
          },
          directCalls: {
            $sum: {
              $cond: [{ $eq: ['$scope', 'direct'] }, 1, 0],
            },
          },
          groupCalls: {
            $sum: {
              $cond: [{ $eq: ['$scope', 'group'] }, 1, 0],
            },
          },
          voiceCalls: {
            $sum: {
              $cond: [{ $eq: ['$callType', 'audio'] }, 1, 0],
            },
          },
          videoCalls: {
            $sum: {
              $cond: [{ $eq: ['$callType', 'video'] }, 1, 0],
            },
          },
          totalDurationSeconds: { $sum: '$durationSeconds' },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          ...baseMatch,
          messageType: 'call',
          createdAt: { $gte: dailyStart },
        },
      },
      {
        $project: {
          dayKey: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
          status: '$call.status',
          durationSeconds: { $ifNull: ['$call.durationSeconds', 0] },
        },
      },
      {
        $group: {
          _id: '$dayKey',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
          missed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'missed'] }, 1, 0],
            },
          },
          declined: {
            $sum: {
              $cond: [{ $eq: ['$status', 'declined'] }, 1, 0],
            },
          },
          durationSeconds: { $sum: '$durationSeconds' },
        },
      },
    ]),
  ]);

  const totals = totalsResult[0] || {
    totalMessages: 0,
    messagesSent: 0,
    messagesReceived: 0,
  };
  const dailyByKey = new Map(dailyResult.map((entry) => [entry._id, entry]));
  const dailyActivity = dailyWindow.map((entry) => {
    const stats = dailyByKey.get(entry.key);

    return {
      day: entry.label,
      sent: stats?.sent || 0,
      received: stats?.received || 0,
      messages: stats?.messages || 0,
    };
  });
  const activeDays = dailyActivity.filter((entry) => entry.messages > 0).length;
  const peakHours = PEAK_HOUR_BUCKETS.map((bucket) => ({
    hour: bucket.label,
    active: 0,
  }));
  const callTotals = callSummaryResult[0] || {
    totalCalls: 0,
    completedCalls: 0,
    missedCalls: 0,
    declinedCalls: 0,
    directCalls: 0,
    groupCalls: 0,
    voiceCalls: 0,
    videoCalls: 0,
    totalDurationSeconds: 0,
  };
  const todayActiveChatIds = new Set(todayChatResult.map((entry) => normalizeId(entry._id)));
  const todayActiveChats = chats.filter((chat) => todayActiveChatIds.has(normalizeId(chat._id)));
  const dailyCallByKey = new Map(callDailyResult.map((entry) => [entry._id, entry]));
  const dailyCallActivity = dailyWindow.map((entry) => {
    const stats = dailyCallByKey.get(entry.key);

    return {
      day: entry.label,
      total: stats?.total || 0,
      completed: stats?.completed || 0,
      missed: stats?.missed || 0,
      declined: stats?.declined || 0,
      durationSeconds: stats?.durationSeconds || 0,
    };
  });
  const callSummary = {
    totalCalls: callTotals.totalCalls || 0,
    completedCalls: callTotals.completedCalls || 0,
    missedCalls: callTotals.missedCalls || 0,
    declinedCalls: callTotals.declinedCalls || 0,
    directCalls: callTotals.directCalls || 0,
    groupCalls: callTotals.groupCalls || 0,
    voiceCalls: callTotals.voiceCalls || 0,
    videoCalls: callTotals.videoCalls || 0,
    totalDurationSeconds: callTotals.totalDurationSeconds || 0,
    averageDurationSeconds:
      callTotals.completedCalls > 0
        ? Math.round((callTotals.totalDurationSeconds || 0) / callTotals.completedCalls)
        : 0,
    answeredRate:
      callTotals.totalCalls > 0
        ? Math.round(((callTotals.completedCalls || 0) / callTotals.totalCalls) * 100)
        : 0,
  };

  peakHourResult.forEach((entry) => {
    const bucketIndex = PEAK_HOUR_BUCKETS.findIndex(
      (bucket) => entry._id >= bucket.start && entry._id <= bucket.end
    );

    if (bucketIndex >= 0) {
      peakHours[bucketIndex].active += entry.count;
    }
  });

  res.json({
    summary: {
      totalMessages: totals.totalMessages || 0,
      messagesSent: totals.messagesSent || 0,
      messagesReceived: totals.messagesReceived || 0,
      activeDays,
      totalChats: todayActiveChats.length,
      directChats: todayActiveChats.filter((chat) => !chat.isGroupChat && !chat.isAIBotChat).length,
      groupChats: todayActiveChats.filter((chat) => chat.isGroupChat).length,
      aiChats: todayActiveChats.filter((chat) => chat.isAIBotChat).length,
    },
    callSummary,
    dailyActivity,
    dailyCallActivity,
    peakHours,
    messageTypes: messageTypeResult.map((entry) => ({
      name: formatMessageType(entry._id),
      value: entry.count,
    })),
    callOutcomes: buildCallBreakdown([
      { name: 'Answered', value: callSummary.completedCalls },
      { name: 'Missed', value: callSummary.missedCalls },
      { name: 'Declined', value: callSummary.declinedCalls },
    ]),
    callTypes: buildCallBreakdown([
      { name: 'Voice', value: callSummary.voiceCalls },
      { name: 'Video', value: callSummary.videoCalls },
    ]),
    callScopes: buildCallBreakdown([
      { name: 'Direct', value: callSummary.directCalls },
      { name: 'Group', value: callSummary.groupCalls },
    ]),
  });
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  const { name, bio } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, bio },
    { new: true }
  ).select('-password');
  res.json(serializeUserForClient(user));
};

// PUT /api/users/notifications
exports.updateNotificationPreferences = async (req, res) => {
  const notificationPreferences = serializeNotificationPreferences(req.body.notificationPreferences);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { notificationPreferences },
    { new: true }
  ).select('-password');

  res.json(serializeUserForClient(user));
};

// PUT /api/users/privacy
exports.updatePrivacySettings = async (req, res) => {
  const privacySettings = resolvePrivacySettings(req.body.privacySettings);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { privacySettings },
    { new: true }
  ).select('-password');

  res.json(serializeUserForClient(user));
};

// PUT /api/users/contact-alias/:id
exports.updateContactAlias = async (req, res) => {
  const targetUserId = normalizeId(req.params.id);
  const alias = String(req.body.alias || '').trim();

  if (!targetUserId) {
    return res.status(400).json({ message: 'Contact is required' });
  }

  if (targetUserId === normalizeId(req.user.id)) {
    return res.status(400).json({ message: 'You cannot rename yourself here' });
  }

  if (alias.length > 40) {
    return res.status(400).json({ message: 'Nickname can be up to 40 characters' });
  }

  const targetUser = await User.findById(targetUserId).select('_id');
  if (!targetUser) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  const user = await User.findById(req.user.id).select('contactAliases');
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  if (!user.contactAliases) {
    user.contactAliases = new Map();
  }

  if (alias) {
    user.contactAliases.set(targetUserId, alias);
  } else {
    user.contactAliases.delete(targetUserId);
  }

  await user.save();

  res.json({
    targetUserId,
    alias,
    contactAliases: serializeContactAliases(user.contactAliases),
  });
};

// PUT /api/users/contact/:id
exports.addContact = async (req, res) => {
  const targetUserId = normalizeId(req.params.id);

  if (!targetUserId) {
    return res.status(400).json({ message: 'Contact is required' });
  }

  if (targetUserId === normalizeId(req.user.id)) {
    return res.status(400).json({ message: 'You cannot add yourself as a contact' });
  }

  const targetUser = await User.findById(targetUserId).select('_id');
  if (!targetUser) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    { $addToSet: { contacts: targetUserId } },
    { new: true }
  ).select('contacts friends');

  res.json({
    message: 'Contact added',
    contactId: targetUserId,
    contacts: updatedUser?.contacts || [],
    friends: updatedUser?.friends || [],
  });
};

// POST /api/users/upload-avatar
exports.uploadAvatar = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profilePicture: req.file.path },
    { new: true }
  ).select('-password');
  res.json(serializeUserForClient(user));
};

// DELETE /api/users/avatar
exports.removeAvatar = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profilePicture: '' },
    { new: true }
  ).select('-password');
  res.json(serializeUserForClient(user));
};

// PUT /api/users/block/:id
exports.blockUser = async (req, res) => {
  const targetUserId = normalizeId(req.params.id);

  if (!targetUserId || targetUserId === normalizeId(req.user.id)) {
    return res.status(400).json({ message: 'You cannot block yourself' });
  }

  const targetUser = await User.findById(targetUserId).select('_id');
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  const directChats = await Chat.find({
    isGroupChat: false,
    isAIBotChat: false,
    participants: { $all: [req.user.id, targetUserId] },
  }).select('_id');

  const hiddenChatIds = directChats.map((chat) => chat._id);
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      $addToSet: {
        blockedUsers: targetUserId,
        ...(hiddenChatIds.length ? { hiddenChats: { $each: hiddenChatIds } } : {}),
      },
    },
    { new: true }
  ).select('-password -passwordResetToken -passwordResetExpires');

  res.json({
    message: 'User blocked',
    hiddenChatIds,
    user: serializeUserForClient(updatedUser),
  });
};

// DELETE /api/users/block/:id
exports.unblockUser = async (req, res) => {
  const targetUserId = normalizeId(req.params.id);

  if (!targetUserId || targetUserId === normalizeId(req.user.id)) {
    return res.status(400).json({ message: 'You cannot unblock yourself' });
  }

  const targetUser = await User.findById(targetUserId).select('_id');
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  const directChats = await Chat.find({
    isGroupChat: false,
    isAIBotChat: false,
    participants: { $all: [req.user.id, targetUserId] },
  }).select('_id');

  const restoredChatIds = directChats.map((chat) => chat._id);
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      $pull: {
        blockedUsers: targetUserId,
        ...(restoredChatIds.length ? { hiddenChats: { $in: restoredChatIds } } : {}),
      },
    },
    { new: true }
  ).select('-password -passwordResetToken -passwordResetExpires');

  res.json({
    message: 'User unblocked',
    restoredChatIds,
    user: serializeUserForClient(updatedUser),
  });
};
