import React, { useEffect, useMemo, useRef, useState } from 'react';

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const statusCopy = {
  incoming: 'Incoming',
  calling: 'Ringing',
  connecting: 'Connecting',
  'in-call': 'Connected',
  ended: 'Ended',
  idle: 'Ready',
};

const InitialAvatar = ({ name, className = 'h-12 w-12 text-base' }) => (
  <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[#7c6aff] font-bold text-white`}>
    {(name || 'N').slice(0, 1).toUpperCase()}
  </div>
);

const IconButton = ({ title, children, onClick, active = false, danger = false, disabled = false }) => {
  const stateClass = danger
    ? 'border-[#ff4d66]/45 bg-[#ff3b55] text-white hover:bg-[#ff2443]'
    : active
      ? 'border-[#6affe8]/35 bg-[#6affe8]/12 text-[#b6fbff] hover:bg-[#6affe8]/18'
      : 'border-white/14 bg-[#15151d] text-white/82 hover:bg-white/[0.1] hover:text-white';

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border shadow-[0_14px_34px_rgba(0,0,0,0.32)] transition ${stateClass} disabled:cursor-not-allowed disabled:opacity-45 sm:h-16 sm:w-16`}
    >
      {children}
    </button>
  );
};

const VideoIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.5-2.25A1 1 0 0121 8.64v6.72a1 1 0 01-1.5.87L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const MicIcon = ({ muted = false, className = 'h-6 w-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14a3 3 0 003-3V7a3 3 0 00-6 0v4a3 3 0 003 3zM19 11a7 7 0 01-14 0m7 7v3m-3 0h6" />
    {muted ? <path strokeLinecap="round" strokeWidth={2} d="M4 4l16 16" /> : null}
  </svg>
);

const PhoneIcon = () => (
  <svg className="h-6 w-6 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.24 1.02l-2.2 2.2z" />
  </svg>
);

const MoreIcon = () => (
  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 12a2 2 0 114 0 2 2 0 01-4 0zm6 0a2 2 0 114 0 2 2 0 01-4 0zm6 0a2 2 0 114 0 2 2 0 01-4 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ScreenShareIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="13" rx="2" strokeWidth={1.8} />
    <path d="M8 21h8M12 17v4M9 10l3-3 3 3M12 7v7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
  </svg>
);

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
    videoRef.current.play?.().catch(() => {});
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />;
};

const GroupCallModal = ({
  callType,
  callStatus,
  chatName,
  currentUserId,
  localVideoRef,
  localStream,
  remoteParticipants,
  participants,
  durationLabel,
  isIncoming = false,
  isHost = false,
  isScreenSharing = false,
  onAnswer,
  onDecline,
  onLeave,
  onEnd,
  onClose,
  onStartScreenShare,
  onStopScreenShare,
  onInviteMembers,
}) => {
  const [isInvitePanelOpen, setIsInvitePanelOpen] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState([]);
  const isVideoCall = callType === 'video';
  const showAnswerActions = isIncoming && callStatus === 'incoming';
  const isConnected = callStatus === 'in-call';
  const statusLabel = isScreenSharing ? 'Sharing screen' : statusCopy[callStatus] || 'Active';
  const callTypeLabel = isVideoCall ? 'Video call' : 'Audio call';
  const headlineLabel = showAnswerActions
    ? `Incoming group ${callTypeLabel.toLowerCase()}`
    : `${callTypeLabel} - ${statusLabel}${callStatus === 'calling' ? '...' : ''}`;
  const durationText = isConnected && durationLabel ? durationLabel : '00:00';

  const participantById = useMemo(() => {
    const map = new Map();
    participants.forEach((participant) => {
      const id = normalizeId(participant);
      if (id) map.set(id, participant);
    });
    return map;
  }, [participants]);

  const currentUser = participantById.get(normalizeId(currentUserId));
  const activeRemoteIds = remoteParticipants.map((participant) => normalizeId(participant.participantId));
  const activeParticipantIds = useMemo(
    () => new Set([normalizeId(currentUserId), ...activeRemoteIds]),
    [activeRemoteIds, currentUserId]
  );
  const inviteCandidates = participants.filter((participant) => {
    const participantId = normalizeId(participant);
    return participantId && !activeParticipantIds.has(participantId);
  });
  const primaryRemote = remoteParticipants[0];
  const primaryRemoteUser = primaryRemote ? participantById.get(normalizeId(primaryRemote.participantId)) : null;
  const primaryFallbackUser =
    participants.find((participant) => normalizeId(participant) !== normalizeId(currentUserId)) || currentUser;
  const primaryUser = primaryRemoteUser || primaryFallbackUser;
  const primaryName = primaryUser?.localName || primaryUser?.name || chatName || 'Group call';
  const participantRows = useMemo(() => {
    const rowMap = new Map();

    participants.forEach((participant) => {
      const participantId = normalizeId(participant);
      if (!participantId) return;

      rowMap.set(participantId, {
        id: participantId,
        user: participant,
        name: participant.localName || participant.name || 'Group member',
        isActive: activeParticipantIds.has(participantId),
      });
    });

    remoteParticipants.forEach((participant) => {
      const participantId = normalizeId(participant.participantId);
      if (!participantId) return;

      const existingRow = rowMap.get(participantId);
      rowMap.set(participantId, {
        id: participantId,
        user: existingRow?.user || participantById.get(participantId),
        name:
          existingRow?.name
          || participantById.get(participantId)?.localName
          || participantById.get(participantId)?.name
          || 'Participant',
        isActive: true,
      });
    });

    if (currentUserId && !rowMap.has(normalizeId(currentUserId))) {
      rowMap.set(normalizeId(currentUserId), {
        id: normalizeId(currentUserId),
        user: currentUser,
        name: currentUser?.localName || currentUser?.name || 'You',
        isActive: true,
      });
    }

    return [...rowMap.values()].sort((first, second) => {
      const firstIsYou = first.id === normalizeId(currentUserId);
      const secondIsYou = second.id === normalizeId(currentUserId);
      if (firstIsYou !== secondIsYou) return firstIsYou ? 1 : -1;
      if (first.isActive !== second.isActive) return first.isActive ? -1 : 1;
      return first.name.localeCompare(second.name);
    });
  }, [activeParticipantIds, currentUser, currentUserId, participantById, participants, remoteParticipants]);
  const totalPeopleCount = participantRows.length;
  const canInviteMembers = !showAnswerActions && callStatus !== 'ended' && inviteCandidates.length > 0;

  useEffect(() => {
    const element = localVideoRef?.current;
    if (!element) return;
    element.srcObject = localStream || null;
    element.play?.().catch(() => {});
  }, [localStream, localVideoRef]);

  const toggleInviteSelection = (participantId) => {
    setSelectedInviteIds((previous) =>
      previous.includes(participantId)
        ? previous.filter((entry) => entry !== participantId)
        : [...previous, participantId]
    );
  };

  const handleInviteSelected = () => {
    if (!selectedInviteIds.length) return;
    onInviteMembers?.(selectedInviteIds);
    setSelectedInviteIds([]);
    setIsInvitePanelOpen(false);
  };

  const handleLeave = () => {
    if (isHost) {
      onEnd?.();
      return;
    }

    onLeave?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-[#050507] text-white">
      <main className="relative min-w-0 flex-1 overflow-hidden bg-[#06060c]">
        {isVideoCall && primaryRemote?.stream ? <RemoteVideo stream={primaryRemote.stream} /> : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(124,106,255,0.14),transparent_34%),linear-gradient(180deg,rgba(6,6,12,0.18),rgba(6,6,12,0.78))]" />

        {!primaryRemote?.stream || !isVideoCall ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <InitialAvatar name={primaryName} className="h-32 w-32 text-5xl sm:h-36 sm:w-36" />
            <div className="text-center">
              <div className="text-2xl font-bold sm:text-3xl">{primaryName}</div>
              <div className="mt-2 text-sm text-white/58">{statusLabel}{callStatus === 'calling' ? '...' : ''}</div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          title="Close call"
          aria-label="Close call"
          className="absolute left-5 top-5 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/86 shadow-[0_14px_38px_rgba(0,0,0,0.35)] transition hover:bg-black/70 hover:text-white"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="absolute left-1/2 top-5 z-30 w-[min(92vw,526px)] -translate-x-1/2 rounded-[18px] border border-white/70 bg-black/28 px-5 py-4 text-center shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">{callTypeLabel}</div>
          <div className="mt-2 text-xl font-bold text-white">{headlineLabel}</div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-1.5 text-sm font-semibold text-white/82">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-[#6affe8]' : 'bg-white/48'}`} />
            {statusLabel}
          </div>
        </div>

        {isVideoCall && localStream ? (
          <div className="absolute right-5 top-7 z-20 overflow-hidden rounded-lg border border-white/12 bg-black/55 shadow-[0_16px_42px_rgba(0,0,0,0.42)] lg:right-7">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-[102px] w-[142px] object-cover" />
            <div className="absolute right-2 top-2 rounded-full bg-black/62 px-2 py-0.5 text-[0.68rem] font-bold text-white/88">You</div>
          </div>
        ) : null}

        <div className="absolute bottom-36 left-5 z-20 flex max-w-[min(360px,62vw)] items-center gap-3 rounded-lg border border-white/10 bg-black/46 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.36)] backdrop-blur">
          <InitialAvatar name={primaryName} className="h-10 w-10 text-sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{primaryName}</div>
            <div className="truncate text-xs font-semibold text-[#6affe8]">{statusLabel} - {callTypeLabel}</div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center overflow-x-auto bg-gradient-to-t from-black/88 via-black/28 to-transparent px-4 pb-8 pt-20">
          <div className="flex min-w-max items-center gap-5 rounded-[18px] border border-white/10 bg-[#0d0d15]/82 p-4 shadow-[0_18px_52px_rgba(0,0,0,0.48)] backdrop-blur">
            {showAnswerActions ? (
              <>
                <IconButton title="Decline call" onClick={onDecline} danger>
                  <PhoneIcon />
                </IconButton>
                <IconButton title="Join call" onClick={onAnswer} active>
                  <PhoneIcon />
                </IconButton>
              </>
            ) : (
              <>
                {isVideoCall ? (
                  <IconButton title="Camera" active>
                    <VideoIcon />
                  </IconButton>
                ) : null}
                <IconButton title="Microphone" active>
                  <MicIcon />
                </IconButton>
                {isVideoCall && isConnected ? (
                  <IconButton
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                    active={isScreenSharing}
                  >
                    <ScreenShareIcon />
                  </IconButton>
                ) : null}
                <IconButton title="More options" onClick={() => setIsInvitePanelOpen((value) => !value)}>
                  <MoreIcon />
                </IconButton>
                <IconButton title={isHost ? 'End call for everyone' : 'Leave call'} onClick={handleLeave} danger>
                  <PhoneIcon />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </main>

      <aside className="hidden w-[400px] shrink-0 flex-col border-l border-white/16 bg-[#111118] lg:flex">
        <div className="flex min-h-[84px] items-center justify-between border-b border-white/12 px-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{headlineLabel}</div>
            <div className="mt-1 text-sm font-semibold text-white/70">{statusLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close panel"
            aria-label="Close panel"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:bg-white/[0.07] hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="app-scrollbar flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border border-white/70 bg-white/[0.035] p-5">
            <div className="flex items-center gap-4">
              <InitialAvatar name={primaryName} className="h-12 w-12 text-base" />
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{primaryName}</div>
                <div className="mt-1 text-sm font-semibold text-[#6affe8]">{statusLabel} - {callTypeLabel}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/70 bg-white/[0.035] p-5">
            <div className="text-sm font-semibold text-white/82">Call type</div>
            <div className="mt-2 text-lg font-bold">{callTypeLabel}</div>
          </div>

          <div className="mt-4 rounded-lg border border-white/70 bg-white/[0.035] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 text-white/68">
                <ClockIcon />
              </div>
              <div>
                <div className="text-sm font-semibold text-white/82">Duration</div>
                <div className="mt-1 text-lg font-bold">{durationText}</div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <div className="text-lg font-bold">Participants ({totalPeopleCount})</div>
            <button
              type="button"
              onClick={() => setIsInvitePanelOpen((value) => !value)}
              disabled={!canInviteMembers}
              className="rounded-lg border border-[#7c6aff]/42 px-4 py-2 text-sm font-bold text-[#b8b0ff] transition hover:bg-[#7c6aff]/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              Add people
            </button>
          </div>

          {isInvitePanelOpen ? (
            <div className="mt-3 rounded-lg border border-white/12 bg-[#0d0d15] p-3">
              {inviteCandidates.length ? (
                <>
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {inviteCandidates.map((participant) => {
                      const participantId = normalizeId(participant);
                      const isSelected = selectedInviteIds.includes(participantId);
                      const name = participant.localName || participant.name || 'Group member';

                      return (
                        <button
                          type="button"
                          key={participantId}
                          onClick={() => toggleInviteSelection(participantId)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                            isSelected
                              ? 'border-[#6affe8]/32 bg-[#6affe8]/12 text-white'
                              : 'border-white/8 bg-white/[0.03] text-white/72 hover:bg-white/[0.07] hover:text-white'
                          }`}
                        >
                          <span className="truncate text-sm font-semibold">{name}</span>
                          <span className="text-xs text-white/45">{isSelected ? 'Selected' : 'Invite'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleInviteSelected}
                    disabled={!selectedInviteIds.length}
                    className="mt-3 w-full rounded-lg border border-[#6affe8]/26 bg-[#6affe8]/12 px-3 py-2 text-sm font-bold text-[#aef9ff] transition hover:bg-[#6affe8]/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Invite selected
                  </button>
                </>
              ) : (
                <div className="px-2 py-1 text-sm text-white/48">Everyone in this group is already in the call.</div>
              )}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-lg border border-white/70 bg-white/[0.03]">
            {participantRows.map((participant, index) => {
              const isCurrentUser = participant.id === normalizeId(currentUserId);
              const isPrimary = participant.id === normalizeId(primaryUser);
              const roleLabel = isCurrentUser
                ? 'You'
                : isPrimary
                  ? 'Host'
                  : participant.isActive
                    ? 'In call'
                    : showAnswerActions || callStatus === 'calling'
                      ? 'Ringing'
                      : 'Invited';
              const statusClass = participant.isActive || isCurrentUser ? 'text-[#6affe8]' : 'text-white/48';

              return (
                <div
                  key={participant.id}
                  className={`flex items-center gap-4 px-4 py-4 ${index ? 'border-t border-white/12' : ''}`}
                >
                  <InitialAvatar name={participant.name} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold">{isCurrentUser ? 'You' : participant.name}</div>
                    <div className={`text-xs font-semibold ${statusClass}`}>{roleLabel}</div>
                  </div>
                  <MicIcon muted={!participant.isActive && !isCurrentUser} className="h-6 w-6 text-white/82" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-white/16 p-5">
          <button type="button" className="rounded-lg border border-white/70 bg-white/[0.035] px-4 py-4 text-base font-bold text-white/72 transition hover:bg-white/[0.08] hover:text-white">
            Chat
          </button>
          <button type="button" className="rounded-lg border border-white/70 bg-white/[0.06] px-4 py-4 text-base font-bold text-white">
            People
          </button>
        </div>
      </aside>
    </div>
  );
};

export default GroupCallModal;
