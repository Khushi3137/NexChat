const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  lastSeenVisibility: 'everyone',
  profilePhotoVisibility: 'everyone',
  readReceipts: true,
  groupInvitePermission: 'ask_first',
});

const VISIBILITY_OPTIONS = new Set(['everyone', 'contacts', 'nobody']);
const GROUP_INVITE_OPTIONS = new Set(['ask_first', 'contacts_only', 'nobody']);

const hasRelationshipWithUser = (items, targetUserId) =>
  Array.isArray(items) && items.some((entry) => normalizeId(entry) === normalizeId(targetUserId));

const resolvePrivacySettings = (settings = {}) => ({
  lastSeenVisibility: VISIBILITY_OPTIONS.has(settings?.lastSeenVisibility)
    ? settings.lastSeenVisibility
    : DEFAULT_PRIVACY_SETTINGS.lastSeenVisibility,
  profilePhotoVisibility: VISIBILITY_OPTIONS.has(settings?.profilePhotoVisibility)
    ? settings.profilePhotoVisibility
    : DEFAULT_PRIVACY_SETTINGS.profilePhotoVisibility,
  readReceipts: settings?.readReceipts !== false,
  groupInvitePermission: GROUP_INVITE_OPTIONS.has(settings?.groupInvitePermission)
    ? settings.groupInvitePermission
    : DEFAULT_PRIVACY_SETTINGS.groupInvitePermission,
});

const canViewerAccessField = (visibility, participant, viewerId, viewerContext = {}) => {
  const participantId = normalizeId(participant);
  const normalizedViewerId = normalizeId(viewerId);

  if (!participantId) return false;
  if (participantId === normalizedViewerId) return true;
  if (visibility === 'everyone') return true;
  if (visibility === 'nobody') return false;

  return (
    hasRelationshipWithUser(participant?.friends, normalizedViewerId)
    || hasRelationshipWithUser(participant?.contacts, normalizedViewerId)
  );
};

const sanitizeParticipantForViewer = (participant, viewerId, viewerContext = {}) => {
  if (!participant || typeof participant !== 'object') return participant;

  const {
    privacySettings: _ignoredPrivacySettings,
    password: _ignoredPassword,
    passwordResetToken: _ignoredPasswordResetToken,
    passwordResetExpires: _ignoredPasswordResetExpires,
    contactAliases: _ignoredContactAliases,
    contacts: _ignoredContacts,
    friends: _ignoredFriends,
    blockedUsers: _ignoredBlockedUsers,
    hiddenChats: _ignoredHiddenChats,
    mutedChats: _ignoredMutedChats,
    notificationPreferences: _ignoredNotificationPreferences,
    socketIds: _ignoredSocketIds,
    __v: _ignoredVersion,
    ...safeParticipant
  } = participant;
  const privacySettings = resolvePrivacySettings(participant.privacySettings);
  const canViewLastSeen = canViewerAccessField(
    privacySettings.lastSeenVisibility,
    participant,
    viewerId,
    viewerContext
  );
  const canViewProfilePhoto = canViewerAccessField(
    privacySettings.profilePhotoVisibility,
    participant,
    viewerId,
    viewerContext
  );

  return {
    ...safeParticipant,
    profilePicture: canViewProfilePhoto ? safeParticipant.profilePicture || '' : '',
    isOnline: canViewLastSeen ? Boolean(safeParticipant.isOnline) : false,
    lastSeen: canViewLastSeen ? safeParticipant.lastSeen || null : null,
    canViewLastSeen,
    canViewProfilePhoto,
  };
};

module.exports = {
  DEFAULT_PRIVACY_SETTINGS,
  hasRelationshipWithUser,
  normalizeId,
  resolvePrivacySettings,
  sanitizeParticipantForViewer,
};
