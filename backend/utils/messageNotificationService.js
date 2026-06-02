const Chat = require('../models/Chat');
const { sendEmailNotification } = require('./emailService');
const { isUserCurrentlyOnline } = require('./presenceService');

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const resolveEmailNotificationMode = (preferences = {}) => {
  if (preferences?.emailNotifications === false) return 'none';
  return ['all', 'direct', 'none'].includes(preferences?.emailNotificationMode)
    ? preferences.emailNotificationMode
    : 'all';
};

exports.notifyOfflineParticipants = async ({ chatId, senderId, message, notificationType = 'message' }) => {
  const chat = await Chat.findById(chatId).populate(
    'participants',
    'name email isOnline socketIds notificationPreferences mutedChats'
  );

  if (!chat) {
    console.warn(`Offline email skipped: chat ${chatId} was not found.`);
    return;
  }

  for (const participant of chat.participants) {
    if (normalizeId(participant) === normalizeId(senderId)) continue;
    if (!participant.email) {
      console.warn(`Offline email skipped: ${participant.name || participant._id} has no email address.`);
      continue;
    }
    const emailNotificationMode = resolveEmailNotificationMode(participant.notificationPreferences);
    if (emailNotificationMode === 'none') {
      console.log(`Offline email skipped: ${participant.email} disabled email notifications.`);
      continue;
    }
    if (emailNotificationMode === 'direct' && chat.isGroupChat) {
      console.log(`Offline email skipped: ${participant.email} only allows direct chat email notifications.`);
      continue;
    }
    if (Array.isArray(participant.mutedChats) && participant.mutedChats.some((entry) => normalizeId(entry) === normalizeId(chatId))) {
      console.log(`Offline email skipped: ${participant.email} muted chat ${chatId}.`);
      continue;
    }
    if (isUserCurrentlyOnline(participant._id)) {
      console.log(`Offline email skipped: ${participant.email} is currently online.`);
      continue;
    }

    console.log(
      `Offline email attempt: sending ${notificationType} notification to ${participant.email}.`
    );
    await sendEmailNotification(participant, message, { notificationType });
  }
};
