import React, { useEffect, useRef } from 'react';

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const statusCopy = {
  incoming: 'Incoming group call',
  calling: 'Ringing the group...',
  connecting: 'Connecting everyone...',
  'in-call': 'Group call in progress',
  ended: 'Group call ended',
  idle: 'Ready',
};

const ScreenShareIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8" strokeLinecap="round" />
    <path d="M12 17v4" strokeLinecap="round" />
    <path d="M9 10l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 7v7" strokeLinecap="round" />
  </svg>
);

const StreamTile = ({ stream, label, isVideoCall, isLocal = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="relative min-h-[180px] overflow-hidden rounded-[24px] border border-white/10 bg-[#090912]">
      {isVideoCall && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : null}

      {!isVideoCall || !stream ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(124,106,255,0.18),transparent_34%),linear-gradient(180deg,#0d0d18,#06060d)]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-2xl font-bold text-white">
            {(label || 'P').slice(0, 1).toUpperCase()}
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))] px-4 pb-4 pt-12">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{label}</div>
          <div className="mt-1 text-[0.72rem] text-white/55">{isLocal ? 'You' : 'Participant'}</div>
        </div>
      </div>
    </div>
  );
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
}) => {
  const isVideoCall = callType === 'video';
  const showAnswerActions = isIncoming && callStatus === 'incoming';
  const showScreenShareAction = isVideoCall && callStatus === 'in-call' && !showAnswerActions;
  const remoteCount = remoteParticipants.length;
  const allTiles = [
    ...remoteParticipants.map((participant) => ({
      key: normalizeId(participant.participantId),
      label:
        participants.find((entry) => normalizeId(entry) === normalizeId(participant.participantId))?.localName
        || participants.find((entry) => normalizeId(entry) === normalizeId(participant.participantId))?.name
        || 'Participant',
      stream: participant.stream,
      isLocal: false,
    })),
    {
      key: `local-${normalizeId(currentUserId)}`,
      label:
        participants.find((entry) => normalizeId(entry) === normalizeId(currentUserId))?.localName
        || participants.find((entry) => normalizeId(entry) === normalizeId(currentUserId))?.name
        || 'You',
      stream: localStream,
      isLocal: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 backdrop-blur-md">
      <div className="relative flex h-[min(92vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#090911] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:bg-black/55 hover:text-white"
        >
          Close
        </button>

        <div className="border-b border-white/10 px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="brand-font truncate text-2xl font-bold text-white">{chatName || 'Group Call'}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-sm text-white/75">
                  {statusCopy[callStatus] || 'Group call active'}
                </span>
                <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-sm text-white/65">
                  {isVideoCall ? 'Video call' : 'Voice call'}
                </span>
                <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-sm text-white/65">
                  {remoteCount + 1} participant{remoteCount === 0 ? '' : 's'}
                </span>
                {durationLabel && callStatus === 'in-call' ? (
                  <span className="rounded-full border border-[#6affe8]/18 bg-[#6affe8]/10 px-3 py-1 text-sm font-semibold text-[#aef9ff]">
                    {durationLabel}
                  </span>
                ) : null}
                {isScreenSharing ? (
                  <span className="rounded-full border border-[#f9d66a]/20 bg-[#f9d66a]/10 px-3 py-1 text-sm font-semibold text-[#ffe9a6]">
                    Sharing screen
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
              {showAnswerActions
                ? 'Join the room to talk with everyone.'
                : remoteCount
                  ? 'People in the room can join and leave while the call stays open.'
                  : 'Waiting for someone else in the group to join.'}
            </div>
          </div>
        </div>

        <div className="app-scrollbar flex-1 overflow-y-auto px-6 py-6">
          <div className={`grid gap-4 ${allTiles.length <= 2 ? 'md:grid-cols-2' : allTiles.length <= 4 ? 'md:grid-cols-2 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
            {allTiles.map((tile) => (
              tile.isLocal ? (
                <div key={tile.key} className="relative min-h-[180px] overflow-hidden rounded-[24px] border border-white/10 bg-[#090912]">
                  {isVideoCall && localStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  ) : null}

                  {!isVideoCall || !localStream ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(124,106,255,0.18),transparent_34%),linear-gradient(180deg,#0d0d18,#06060d)]">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-2xl font-bold text-white">
                        {(tile.label || 'Y').slice(0, 1).toUpperCase()}
                      </div>
                    </div>
                  ) : null}

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))] px-4 pb-4 pt-12">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{tile.label}</div>
                      <div className="mt-1 text-[0.72rem] text-white/55">You</div>
                    </div>
                  </div>
                </div>
              ) : (
                <StreamTile
                  key={tile.key}
                  stream={tile.stream}
                  label={tile.label}
                  isVideoCall={isVideoCall}
                />
              )
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#0d0d16] px-6 py-5">
          <div className="flex flex-wrap gap-3">
            {showAnswerActions ? (
              <>
                <button
                  type="button"
                  onClick={onAnswer}
                  className="flex-1 rounded-2xl border border-[#6affe8]/24 bg-[#6affe8]/12 px-4 py-3 text-sm font-semibold text-[#aef9ff] transition hover:bg-[#6affe8]/18 hover:text-white"
                >
                  Join Call
                </button>
                <button
                  type="button"
                  onClick={onDecline}
                  className="flex-1 rounded-2xl border border-[#ff8ca8]/24 bg-[#ff8ca8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1df] transition hover:bg-[#ff8ca8]/16 hover:text-white"
                >
                  Decline
                </button>
              </>
            ) : (
              <>
                {showScreenShareAction ? (
                  <button
                    type="button"
                    onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                    aria-pressed={isScreenSharing}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      isScreenSharing
                        ? 'border-[#f9d66a]/28 bg-[#f9d66a]/12 text-[#ffe9a6] hover:bg-[#f9d66a]/18 hover:text-white'
                        : 'border-[#6affe8]/24 bg-[#6affe8]/10 text-[#aef9ff] hover:bg-[#6affe8]/16 hover:text-white'
                    }`}
                  >
                    <ScreenShareIcon />
                    {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={isHost ? onEnd : onLeave}
                  className="flex-1 rounded-2xl border border-[#ff8ca8]/24 bg-[#ff8ca8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1df] transition hover:bg-[#ff8ca8]/16 hover:text-white"
                >
                  {isHost ? 'End Call For Everyone' : 'Leave Call'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupCallModal;
