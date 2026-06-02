import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export const formatMessageTime = (date) => {
  return format(new Date(date), 'h:mm a');
};

export const formatChatDate = (date) => {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

export const formatLastSeen = (date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const formatScheduledTime = (date) => {
  const d = new Date(date);
  if (isToday(d)) return `Today ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
};
