export const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  lastSeenVisibility: 'everyone',
  profilePhotoVisibility: 'everyone',
  readReceipts: true,
  groupInvitePermission: 'ask_first',
});

const VISIBILITY_OPTIONS = new Set(['everyone', 'contacts', 'nobody']);
const GROUP_INVITE_OPTIONS = new Set(['ask_first', 'contacts_only', 'nobody']);

export const resolvePrivacySettings = (settings) => ({
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
