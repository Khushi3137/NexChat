export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  messageNotifications: true,
  messageNotificationMode: 'all',
  emailNotifications: true,
  emailNotificationMode: 'all',
  soundAlerts: true,
  soundTone: 'chime',
});

export const resolveNotificationPreferences = (preferences) => ({
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
