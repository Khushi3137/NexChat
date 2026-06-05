import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { formatCallDuration, getCallDirectionLabel, getCallStatusText, getCallTypeLabel, isCallInitiatedByUser, isGroupCall } from '../../utils/callUtils';
import { formatMessageTime, formatScheduledTime } from '../../utils/dateUtils';
import Avatar from '../shared/Avatar';

const STATUS_LABELS = {
  sent: 'Sent',
  delivered: 'Delivered',
  seen: 'Seen',
};

const reactionOptions = [
  { label: 'Like', emoji: '\u{1F44D}' },
  { label: 'Love', emoji: '\u2764\uFE0F' },
  { label: 'Fire', emoji: '\u{1F525}' },
  { label: 'Idea', emoji: '\u{1F4A1}' },
  { label: 'Wow', emoji: '\u{1F62E}' },
];

const defaultMenuPlacement = {
  top: '50%',
  bottom: 'auto',
  transform: 'translateY(-50%)',
  maxHeight: undefined,
};

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
const MENTION_BOUNDARY_REGEX = /[\s.,!?;:()[\]{}'"`~<>/\\-]/;
const getGroupReadReceiptSummary = (chat, currentUserId, seenBy) => {
  const recipientIds = new Set(
    (Array.isArray(chat?.participants) ? chat.participants : [])
      .map((participant) => normalizeId(participant))
      .filter((participantId) => participantId && participantId !== normalizeId(currentUserId))
  );

  const seenCount = [...new Set((seenBy || []).map((entry) => normalizeId(entry)).filter(Boolean))].filter((entry) =>
    recipientIds.has(entry)
  ).length;

  return {
    seenCount,
    totalRecipients: recipientIds.size,
  };
};

const getScrollContainer = (element) => {
  let current = element?.parentElement;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);

    if (/(auto|scroll|overlay)/.test(overflowY)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
};

const getMentionParts = (content, participants) => {
  if (!content || !Array.isArray(participants) || !participants.length || !content.includes('@')) {
    return [{ text: content, isMention: false }];
  }

  const mentionLabels = participants
    .map((participant) => String(participant?.localName || participant?.name || '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  if (!mentionLabels.length) {
    return [{ text: content, isMention: false }];
  }

  const lowerContent = content.toLowerCase();
  const parts = [];
  let index = 0;

  while (index < content.length) {
    let matchedLabel = '';

    if (content[index] === '@') {
      matchedLabel = mentionLabels.find((label) => {
        const mentionText = `@${label}`;
        const normalizedMentionText = mentionText.toLowerCase();
        if (lowerContent.slice(index, index + normalizedMentionText.length) !== normalizedMentionText) {
          return false;
        }

        const nextChar = content[index + mentionText.length] || '';
        return !nextChar || MENTION_BOUNDARY_REGEX.test(nextChar);
      }) || '';
    }

    if (matchedLabel) {
      const mentionText = `@${matchedLabel}`;
      parts.push({ text: mentionText, isMention: true });
      index += mentionText.length;
      continue;
    }

    const nextAtIndex = content.indexOf('@', index + 1);
    const sliceEnd = nextAtIndex === -1 ? content.length : nextAtIndex;
    parts.push({ text: content.slice(index, sliceEnd), isMention: false });
    index = sliceEnd;
  }

  return parts.filter((part) => part.text);
};

const getLinkParts = (content) => {
  if (!content) {
    return [{ text: content, isLink: false }];
  }

  const linkRegex = /(?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;
  const trailingPunctuationRegex = /[),.!?;:]+$/;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const rawUrl = match[0];
    const trailingPunctuation = rawUrl.match(trailingPunctuationRegex)?.[0] || '';
    const url = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation.length) : rawUrl;

    if (!url) {
      continue;
    }

    if (match.index > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index), isLink: false });
    }

    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push({ text: url, isLink: true, href });

    if (trailingPunctuation) {
      parts.push({ text: trailingPunctuation, isLink: false });
    }

    lastIndex = match.index + rawUrl.length;
  }

  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), isLink: false });
  }

  return parts;
};

const getMessageContentParts = (content, participants) => {
  return getMentionParts(content, participants).flatMap((part) =>
    part.isMention ? [part] : getLinkParts(part.text)
  );
};

const MessageBubble = ({
  message,
  chat,
  isOwn,
  currentUserId,
  onAvatarClick,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRemoveReaction,
  onCopy,
  onForward,
  onShare,
  onPin,
  onVotePoll,
  onOpenMedia,
  onOpenReadReceipts,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState(defaultMenuPlacement);
  const menuRef = useRef(null);
  const bubbleRef = useRef(null);
  const bubbleCardRef = useRef(null);
  const sender = typeof message.senderId === 'object' ? message.senderId : null;
  const senderParticipant = chat?.participants?.find(
    (participant) => normalizeId(participant) === normalizeId(message.senderId)
  );
  const isAIMessage = message.messageType === 'ai';
  const displaySenderName = isAIMessage
    ? chat?.isAIBotChat
      ? 'AI Bot'
      : 'Nexus AI'
    : senderParticipant?.localName || sender?.localName || senderParticipant?.name || sender?.name;
  const displayAvatarSrc = isAIMessage ? '' : sender?.profilePicture;
  const mediaType = message.messageType || 'text';
  const callDetails = mediaType === 'call' ? message.call || null : null;
  const isCallMessage = Boolean(callDetails);
  const isDeletedForEveryone = Boolean(message.isDeletedForEveryone);
  const isScheduledPending = Boolean(message.scheduledTime && message.isSent === false);
  const hasScheduledTime = Boolean(message.scheduledTime);
  const messageTimeLabel = hasScheduledTime
    ? formatScheduledTime(message.scheduledTime)
    : formatMessageTime(message.createdAt);
  const ownReaction = message.reactions?.find((reaction) =>
    reaction.users?.some((entry) => normalizeId(entry) === currentUserId)
  )?.emoji;
  const replyPreviewText = message.replyTo?.isDeletedForEveryone
    ? 'This message was deleted'
    : message.replyTo?.content ||
    (message.replyTo?.messageType === 'call' ? getCallStatusText(message.replyTo?.call, currentUserId) : '') ||
    message.replyTo?.poll?.question ||
    message.replyTo?.location?.address ||
    'Shared media attachment';
  const locationHref =
    mediaType === 'location' && message.location
      ? `https://www.google.com/maps?q=${message.location.lat},${message.location.lng}`
      : '';
  const ownPollVote = message.poll?.options?.find((option) =>
    option.votes?.some((entry) => normalizeId(entry) === currentUserId)
  )?._id;
  const messageContentParts = getMessageContentParts(message.content, chat?.participants);
  const callWasStartedByCurrentUser = isCallInitiatedByUser(callDetails, currentUserId);
  const isGroupCallMessage = isGroupCall(callDetails);
  const callSummary = isCallMessage ? getCallStatusText(callDetails, currentUserId) : '';
  const callDirectionLabel = isCallMessage ? getCallDirectionLabel(callDetails, currentUserId) : '';
  const callDurationLabel =
    isCallMessage && Number(callDetails?.durationSeconds) > 0
      ? formatCallDuration(callDetails?.durationSeconds)
      : '';
  const callStatusBadgeLabel = !isCallMessage
    ? ''
    : callDetails?.status === 'completed'
      ? 'Answered'
      : callDetails?.status === 'declined'
        ? 'Declined'
        : isGroupCallMessage
          ? 'No One Joined'
          : callWasStartedByCurrentUser
            ? 'No Answer'
            : 'Missed';
  const { seenCount, totalRecipients } = getGroupReadReceiptSummary(chat, currentUserId, message.seenBy);
  const canInspectGroupReadReceipts =
    Boolean(onOpenReadReceipts) && chat?.isGroupChat && isOwn && !isDeletedForEveryone && !isScheduledPending && totalRecipients > 0;
  const avatarNode = (
    <Avatar src={displayAvatarSrc} name={displaySenderName || sender?.name} size={8} shape="soft" />
  );
  const openAttachment = () => {
    if (!message.mediaUrl || isDeletedForEveryone || ['location', 'poll'].includes(mediaType)) return;
    onOpenMedia?.(message);
  };

  useEffect(() => {
    if (!showMenu) return undefined;

    const handleOutside = (event) => {
      if (!menuRef.current?.contains(event.target) && !bubbleRef.current?.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showMenu]);

  useLayoutEffect(() => {
    if (!showMenu) return undefined;

    const updateMenuPlacement = () => {
      const bubbleCard = bubbleCardRef.current;
      const menu = menuRef.current;

      if (!bubbleCard || !menu) return;

      const scrollContainer = getScrollContainer(bubbleCard);
      const bubbleRect = bubbleCard.getBoundingClientRect();
      const containerRect = scrollContainer
        ? scrollContainer.getBoundingClientRect()
        : { top: 8, bottom: window.innerHeight - 8 };
      const gap = 12;
      const menuHeight = menu.offsetHeight;
      const bubbleCenter = bubbleRect.top + bubbleRect.height / 2;
      const centeredSpaceAbove = Math.max(0, bubbleCenter - containerRect.top - gap);
      const centeredSpaceBelow = Math.max(0, containerRect.bottom - bubbleCenter - gap);
      const centeredMenuHalf = menuHeight / 2;
      const canCenterMenu = centeredMenuHalf <= centeredSpaceAbove && centeredMenuHalf <= centeredSpaceBelow;

      if (canCenterMenu) {
        setMenuPlacement(defaultMenuPlacement);
        return;
      }

      const topAnchoredSpace = Math.max(0, containerRect.bottom - bubbleRect.top - gap);
      const bottomAnchoredSpace = Math.max(0, bubbleRect.bottom - containerRect.top - gap);
      const canAnchorToTop = menuHeight <= topAnchoredSpace;
      const canAnchorToBottom = menuHeight <= bottomAnchoredSpace;

      if (canAnchorToTop && (!canAnchorToBottom || topAnchoredSpace >= bottomAnchoredSpace)) {
        setMenuPlacement({
          top: 0,
          bottom: 'auto',
          transform: 'none',
          maxHeight: undefined,
        });
        return;
      }

      if (canAnchorToBottom) {
        setMenuPlacement({
          top: 'auto',
          bottom: 0,
          transform: 'none',
          maxHeight: undefined,
        });
        return;
      }

      if (topAnchoredSpace >= bottomAnchoredSpace) {
        setMenuPlacement({
          top: 0,
          bottom: 'auto',
          transform: 'none',
          maxHeight: topAnchoredSpace,
        });
        return;
      }

      setMenuPlacement({
        top: 'auto',
        bottom: 0,
        transform: 'none',
        maxHeight: bottomAnchoredSpace,
      });
    };

    updateMenuPlacement();

    const scrollContainer = getScrollContainer(bubbleCardRef.current);
    window.addEventListener('resize', updateMenuPlacement);
    scrollContainer?.addEventListener('scroll', updateMenuPlacement);

    return () => {
      window.removeEventListener('resize', updateMenuPlacement);
      scrollContainer?.removeEventListener('scroll', updateMenuPlacement);
    };
  }, [showMenu, showReactionPicker]);



  useEffect(() => {
    if (!showMenu) {
      setShowReactionPicker(false);
      setMenuPlacement(defaultMenuPlacement);
    }
  }, [showMenu]);

  return (
    <div ref={bubbleRef} className={`relative group flex items-end gap-3 ${isOwn ? 'justify-end' : ''}`}>
      {!isOwn ? (
        onAvatarClick && displayAvatarSrc ? (
          <button
            type="button"
            onClick={() => onAvatarClick(message)}
            className="shrink-0 rounded-2xl transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#7c6aff]/45"
            aria-label={`View profile photo for ${displaySenderName || sender?.name || 'user'}`}
            title="View profile photo"
          >
            {avatarNode}
          </button>
        ) : (
          avatarNode
        )
      ) : null}

      <div className={`flex max-w-[72%] flex-col gap-1 ${isOwn ? 'items-end' : ''}`}>
        {!isOwn && displaySenderName ? (
          <div className="pl-2 text-[0.72rem] font-semibold text-[#cfc5ff]">
            {displaySenderName}
          </div>
        ) : null}

        <div
          ref={bubbleCardRef}
          className={`relative rounded-[20px] border px-4 py-3 text-sm leading-6 ${isOwn
              ? 'rounded-br-[8px] border-transparent bg-gradient-to-br from-[#6a52ff] to-[#7c6aff] text-white shadow-[0_4px_20px_rgba(124,106,255,0.35)]'
              : 'rounded-bl-[8px] border-white/8 bg-[#1a1a28] text-[#f0eeff]'
            }`}
          onContextMenu={(event) => {
            event.preventDefault();
            setShowMenu((value) => !value);
          }}
        >
          {message.replyTo ? (
            <div
              className={`mb-3 rounded-xl border-l-[3px] px-3 py-2 text-xs ${isOwn
                  ? 'border-l-[#ff6ab0] bg-white/12 text-white/85'
                  : 'border-l-[#ff6ab0] bg-white/8 text-white/72'
                }`}
            >
              <div
                className={`mb-1 font-semibold ${isOwn ? 'text-[#ffd2e6]' : 'text-[#ffbad6]'
                  }`}
              >
                Reply thread
              </div>
              <div>{replyPreviewText}</div>
            </div>
          ) : null}

          {!isDeletedForEveryone && mediaType === 'ai' ? (
            <span className="mb-2 inline-flex rounded-full bg-gradient-to-r from-[#7c6aff] to-[#ff6ab0] px-2 py-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-white">
              AI
            </span>
          ) : null}

          {!isDeletedForEveryone && message.isForwarded ? (
            <span
              className={`mb-2 inline-flex rounded-full border px-2 py-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] ${isOwn
                  ? 'border-white/14 bg-white/[0.08] text-white/82'
                  : 'border-white/10 bg-white/[0.04] text-white/70'
                }`}
            >
              Forwarded
            </span>
          ) : null}

          {isScheduledPending ? (
            <span className="mb-2 inline-flex rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-white/85">
              Scheduled
            </span>
          ) : null}

          {!isDeletedForEveryone && message.mediaUrl && mediaType === 'image' ? (
            <button
              type="button"
              onClick={openAttachment}
              className="mb-3 block overflow-hidden rounded-2xl"
            >
              <img
                src={message.mediaUrl}
                alt="Attachment"
                className="max-w-[260px] rounded-2xl object-cover transition hover:scale-[1.01]"
              />
            </button>
          ) : null}

          {!isDeletedForEveryone && message.mediaUrl && mediaType === 'video' ? (
            <button
              type="button"
              onClick={openAttachment}
              className="mb-3 block overflow-hidden rounded-2xl"
            >
              <div className="relative">
                <video
                  src={message.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full max-w-[320px] rounded-2xl bg-black"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full border border-white/12 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white/86">
                    Open Video
                  </span>
                </div>
              </div>
            </button>
          ) : null}

          {!isDeletedForEveryone && message.mediaUrl && mediaType === 'audio' ? (
            <button
              type="button"
              onClick={openAttachment}
              className="mb-3 w-full max-w-[320px] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.09]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
                Audio
              </div>
              <div className="mt-1 text-sm font-semibold text-white/86">Open audio player</div>
            </button>
          ) : null}

          {!isDeletedForEveryone && mediaType === 'location' && message.location ? (
            <a
              href={locationHref}
              target="_blank"
              rel="noreferrer"
              className="mb-3 block rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
                Shared Location
              </div>
              <div className="mt-1 text-sm text-white/82">
                {message.location.address || `${message.location.lat}, ${message.location.lng}`}
              </div>
              <div className="mt-2 text-xs text-[#9fdcff]">Open in Maps</div>
            </a>
          ) : null}

          {!isDeletedForEveryone && mediaType === 'poll' && message.poll ? (
            <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
                Poll
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {message.poll.question}
              </div>
              <div className="mt-3 space-y-2">
                {message.poll.options.map((option) => {
                  const voteCount = option.votes?.length || 0;
                  const isSelected = normalizeId(option._id) === normalizeId(ownPollVote);
                  return (
                    <button
                      key={option._id}
                      type="button"
                      onClick={() => onVotePoll?.(message._id, option._id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${isSelected
                          ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-white'
                          : 'border-white/10 bg-black/10 text-white/82 hover:bg-white/[0.08]'
                        }`}
                    >
                      <span className="truncate">{option.text}</span>
                      <span className="shrink-0 text-xs text-white/55">{voteCount} vote{voteCount === 1 ? '' : 's'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!isDeletedForEveryone && message.mediaUrl && !['image', 'video', 'audio'].includes(mediaType) ? (
            <button
              type="button"
              onClick={openAttachment}
              className="mb-3 inline-flex rounded-2xl bg-white/10 px-3 py-2 text-[0.8rem] transition hover:bg-white/[0.16]"
            >
              Open Attachment
            </button>
          ) : null}

          {!isDeletedForEveryone && isCallMessage ? (
            <div
              className={`mb-1 rounded-2xl border px-4 py-3 ${isOwn ? 'border-white/14 bg-white/[0.1]' : 'border-white/10 bg-white/[0.04]'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className={`text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${isOwn ? 'text-white/68' : 'text-white/50'
                    }`}>
                    {getCallTypeLabel(callDetails?.callType)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {callDirectionLabel} {getCallTypeLabel(callDetails?.callType)}
                  </div>
                  <div className={`mt-1 text-xs ${isOwn ? 'text-white/78' : 'text-white/60'}`}>
                    {callSummary}
                  </div>
                </div>
                <div className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${callDetails?.status === 'completed'
                    ? 'border-[#6affe8]/20 bg-[#6affe8]/10 text-[#aef9ff]'
                    : callDetails?.status === 'declined'
                      ? 'border-[#ffcf7c]/20 bg-[#ffcf7c]/10 text-[#ffe2a1]'
                      : 'border-[#ff8ca8]/20 bg-[#ff8ca8]/10 text-[#ffd1df]'
                  }`}>
                  {callStatusBadgeLabel}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[0.72rem]">
                {callDurationLabel ? (
                  <span className={`rounded-full px-2.5 py-1 ${isOwn ? 'bg-white/[0.12] text-white/86' : 'bg-white/[0.06] text-white/68'}`}>
                    Duration {callDurationLabel}
                  </span>
                ) : null}
                {callDetails?.startedAt ? (
                  <span className={`rounded-full px-2.5 py-1 ${isOwn ? 'bg-white/[0.12] text-white/72' : 'bg-white/[0.06] text-white/58'}`}>
                    Started {formatMessageTime(callDetails.startedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {isDeletedForEveryone ? (
            <p className={`italic ${isOwn ? 'text-white/78' : 'text-white/52'}`}>
              {isOwn ? 'You deleted this message' : 'This message was deleted'}
            </p>
          ) : null}

          {!isDeletedForEveryone && message.content && mediaType !== 'poll' && mediaType !== 'call' ? (
            <p className="whitespace-pre-wrap break-words">
              {messageContentParts.map((part, index) => {
                if (part.isMention) {
                  return (
                    <span
                      key={`mention-${index}`}
                      className={`rounded px-1 font-semibold ${isOwn ? 'bg-white/16 text-[#fff1b8]' : 'bg-[#7c6aff]/18 text-[#eadfff]'
                        }`}
                    >
                      {part.text}
                    </span>
                  );
                }

                if (part.isLink) {
                  return (
                    <a
                      key={`link-${index}`}
                      href={part.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all text-inherit underline decoration-current/35 underline-offset-2"
                    >
                      {part.text}
                    </a>
                  );
                }

                return <span key={`text-${index}`}>{part.text}</span>;
              })}
            </p>
          ) : null}

          <div
            className={`mt-2 inline-flex items-center gap-2 px-1 text-[0.7rem] ${isOwn ? 'text-white/55' : 'text-white/30'
              }`}
          >
            <span>{messageTimeLabel}</span>
            {message.isEdited ? <span>Edited</span> : null}
            {isOwn && isScheduledPending ? (
              <span className="text-white/72">Pending</span>
            ) : null}
            {isOwn && !isScheduledPending ? (
              <span className={message.status === 'seen' ? 'text-[#6affe8]' : ''}>
                {STATUS_LABELS[message.status] || 'Sent'}
              </span>
            ) : null}
            {canInspectGroupReadReceipts ? (
              <button
                type="button"
                onClick={() => onOpenReadReceipts?.(message)}
                className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold transition ${seenCount
                    ? 'border-[#6affe8]/24 bg-[#6affe8]/10 text-[#aef9ff] hover:bg-[#6affe8]/16 hover:text-white'
                    : 'border-white/12 bg-white/[0.06] text-white/74 hover:bg-white/[0.12] hover:text-white'
                  }`}
                title="View message readers"
              >
                Seen {seenCount}/{totalRecipients}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowMenu((value) => !value)}
              className={`ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${isOwn
                  ? 'border-white/10 bg-white/[0.08] text-white/72 hover:bg-white/[0.14] hover:text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white'
                } opacity-100 md:opacity-0 md:group-hover:opacity-100`}
              aria-label="Message actions"
              title="Message actions"
            >
              ...
            </button>
          </div>

          {showMenu ? (
            <div
              ref={menuRef}
              className={`app-scrollbar absolute z-20 min-w-[220px] overflow-y-auto rounded-[18px] border border-white/10 bg-[#101018]/95 p-2 shadow-[0_28px_72px_rgba(0,0,0,0.55)] transition-opacity duration-150 ease-in-out ${isOwn ? 'right-full mr-2' : 'left-full ml-2'
                }`}
              style={{ ...menuPlacement, whiteSpace: 'nowrap' }}
            >
              {!isDeletedForEveryone && !isScheduledPending ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {reactionOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => {
                        onReact(message, option.emoji);
                        setShowMenu(false);
                      }}
                      className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:border-[#7c6aff]/25 hover:bg-white/[0.08] hover:text-white"
                    >
                      {option.emoji} {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowReactionPicker((value) => !value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${showReactionPicker
                        ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-[#e3deff]'
                        : 'border-white/8 bg-white/[0.04] text-white/70 hover:border-[#7c6aff]/25 hover:bg-white/[0.08] hover:text-white'
                      }`}
                  >
                    + More
                  </button>
                </div>
              ) : null}

              {!isDeletedForEveryone && !isScheduledPending && showReactionPicker ? (
                <div className="mb-2 overflow-hidden rounded-[18px] border border-white/10">
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji) => {
                      onReact(message, emoji.native);
                      setShowReactionPicker(false);
                      setShowMenu(false);
                    }}
                    theme="dark"
                    previewPosition="none"
                  />
                </div>
              ) : null}

              {!isDeletedForEveryone && !isScheduledPending ? (
                <button
                  type="button"
                  onClick={() => {
                    onCopy(message);
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Copy
                </button>
              ) : null}
              {!isDeletedForEveryone && !isScheduledPending ? (
                <button
                  type="button"
                  onClick={() => {
                    onForward(message);
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Forward
                </button>
              ) : null}
              {!isDeletedForEveryone && !isScheduledPending ? (
                <button
                  type="button"
                  onClick={() => {
                    onShare(message);
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Share
                </button>
              ) : null}
              {!isDeletedForEveryone && !isScheduledPending ? (
                <button
                  type="button"
                  onClick={() => {
                    onReply(message);
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Reply
                </button>
              ) : null}
              {canInspectGroupReadReceipts ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenReadReceipts(message);
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Read details
                </button>
              ) : null}
              {!isDeletedForEveryone && !isScheduledPending ? (
                <button
                  type="button"
                  onClick={() => {
                    onPin(message._id, Boolean(message.isPinned));
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {message.isPinned ? 'Unpin' : 'Pin'}
                </button>
              ) : null}
              {!isDeletedForEveryone && !isScheduledPending && ownReaction ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveReaction(message);
                    setShowMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Remove my reaction
                </button>
              ) : null}
              {isOwn && !isDeletedForEveryone ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(message);
                      setShowMenu(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(message._id, 'everyone');
                      setShowMenu(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#ffbad6] transition hover:bg-white/[0.08]"
                  >
                    Delete for everyone
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onDelete(message._id, 'me');
                  setShowMenu(false);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#ffbad6] transition hover:bg-white/[0.08]"
              >
                Delete for me
              </button>
            </div>
          ) : null}
        </div>

        {message.reactions?.length && !isDeletedForEveryone ? (
          <div className="flex flex-wrap gap-1.5">
            {message.reactions.map((reaction, index) => (
              <button
                key={`${reaction.emoji}-${index}`}
                type="button"
                onClick={() => onReact(message, reaction.emoji)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${reaction.users?.some((entry) => normalizeId(entry) === currentUserId)
                    ? 'border-[#7c6aff]/35 bg-[#7c6aff]/18 text-white'
                    : 'border-white/10 bg-white/[0.05] text-white/65 hover:border-[#7c6aff]/25 hover:text-white'
                  }`}
              >
                {reaction.emoji} {reaction.users.length}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessageBubble;
