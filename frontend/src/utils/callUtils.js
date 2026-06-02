const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

export const formatCallDuration = (value = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && !minutes) parts.push(`${seconds}s`);

  return parts.join(' ');
};

export const getCallTypeLabel = (callType = 'audio') =>
  callType === 'video' ? 'Video call' : 'Voice call';

export const isCallInitiatedByUser = (call, userId) =>
  normalizeId(call?.initiatedBy) === normalizeId(userId);

export const isGroupCall = (call) => call?.scope === 'group';

export const getCallStatusText = (call, userId) => {
  const callLabel = `${isGroupCall(call) ? 'Group ' : ''}${getCallTypeLabel(call?.callType)}`;
  const initiatedByUser = isCallInitiatedByUser(call, userId);
  const hasViewerContext = Boolean(normalizeId(userId));
  const durationSeconds = Math.max(0, Math.round(Number(call?.durationSeconds) || 0));
  const joinedCount = Math.max(0, Math.round(Number(call?.joinedCount) || 0));

  if (call?.status === 'declined') {
    if (!hasViewerContext) return `${callLabel} declined`;
    return initiatedByUser ? `${callLabel} declined` : `You declined the ${callLabel.toLowerCase()}`;
  }

  if (call?.status === 'missed') {
    if (isGroupCall(call)) return `${callLabel} had no participants`;
    if (!hasViewerContext) return `${callLabel} not answered`;
    return initiatedByUser ? `${callLabel} not answered` : `Missed ${callLabel.toLowerCase()}`;
  }

  if (isGroupCall(call) && durationSeconds > 0 && joinedCount > 0) {
    return `${callLabel} - ${formatCallDuration(durationSeconds)} - ${joinedCount} joined`;
  }

  return durationSeconds > 0 ? `${callLabel} - ${formatCallDuration(durationSeconds)}` : `${callLabel} completed`;
};

export const getCallDirectionLabel = (call, userId) =>
  isGroupCall(call) ? 'Group' : isCallInitiatedByUser(call, userId) ? 'Outgoing' : 'Incoming';
