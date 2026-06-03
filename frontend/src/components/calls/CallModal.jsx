import React, { useEffect, useState } from 'react';

const statusCopy = {
  incoming: 'Incoming call',
  calling: 'Calling...',
  connecting: 'Connecting...',
  'in-call': 'Call in progress',
  ended: 'Call ended',
  idle: 'Ready',
};

const InitialAvatar = ({ name, sizeClass = 'h-10 w-10', textClass = 'text-sm' }) => (
  <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-[#7c6aff] ${textClass} font-bold text-white`}>
    {(name || 'N').slice(0, 1).toUpperCase()}
  </div>
);

const IconButton = ({
  title,
  onClick,
  children,
  active = false,
  danger = false,
  disabled = false,
}) => {
  const stateClass = danger
    ? 'border-[#ff4d66]/45 bg-[#ff3b55] text-white hover:bg-[#ff2443]'
    : active
      ? 'border-[#6affe8]/35 bg-[#6affe8]/18 text-[#b6fbff] hover:bg-[#6affe8]/24'
      : 'border-white/12 bg-white/[0.08] text-white/78 hover:bg-white/[0.14] hover:text-white';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_12px_34px_rgba(0,0,0,0.28)] transition ${stateClass} disabled:cursor-not-allowed disabled:opacity-45 sm:h-14 sm:w-14`}
    >
      {children}
    </button>
  );
};

const VideoIcon = ({ off = false }) => (
  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 10l4.5-2.25A1 1 0 0121 8.64v6.72a1 1 0 01-1.5.87L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    {off ? <path strokeLinecap="round" strokeWidth={1.8} d="M4 4l16 16" /> : null}
  </svg>
);

const MicIcon = ({ off = false }) => (
  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 14a3 3 0 003-3V7a3 3 0 00-6 0v4a3 3 0 003 3zM19 11a7 7 0 01-14 0m7 7v3m-3 0h6" />
    {off ? <path strokeLinecap="round" strokeWidth={1.8} d="M4 4l16 16" /> : null}
  </svg>
);

const PhoneIcon = () => (
  <svg className="h-5 w-5 rotate-[135deg] sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.24 1.02l-2.2 2.2z" />
  </svg>
);

const ScreenIcon = () => (
  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 6h16v10H4zM9 20h6m-3-4v4" />
  </svg>
);

const SpeakerIcon = ({ active = false }) => (
  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5 9v6h4l5 4V5L9 9H5z" />
    {active ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 9.5a4 4 0 010 5M19.5 7a7.5 7.5 0 010 10" />
    ) : (
      <path strokeLinecap="round" strokeWidth={1.8} d="M18 9l4 4m0-4l-4 4" />
    )}
  </svg>
);

const MoreIcon = () => (
  <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 12a2 2 0 114 0 2 2 0 01-4 0zm6 0a2 2 0 114 0 2 2 0 01-4 0zm6 0a2 2 0 114 0 2 2 0 01-4 0z" />
  </svg>
);

const CallModal = ({
  callType,
  callStatus,
  participantName,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  durationLabel,
  isScreenSharing = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  audioOutputMode = 'default',
  supportsAudioOutputSelection = false,
  isIncoming = false,
  onAnswer,
  onDecline,
  onEnd,
  onClose,
  onMinimize,
  onStartScreenShare,
  onStopScreenShare,
  onToggleAudio,
  onToggleVideo,
  onToggleSpeaker,
  onAddPeople,
}) => {
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const isVideoCall = callType === 'video';
  const isConnected = callStatus === 'in-call';
  const hasRemoteVideo = isVideoCall && Boolean(remoteStream);
  const supportsScreenShare =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
  const showAnswerActions = isIncoming && callStatus === 'incoming';
  const showScreenShareAction = isVideoCall && supportsScreenShare && isConnected && !showAnswerActions;
  const showSpeakerAction = isConnected && !showAnswerActions && supportsAudioOutputSelection;
  const statusLabel = isScreenSharing ? 'Sharing screen' : statusCopy[callStatus] || 'Call active';
  const callTypeLabel = isVideoCall ? 'Video call' : 'Audio call';
  const headlineLabel = showAnswerActions
    ? `Incoming ${isVideoCall ? 'video' : 'audio'} call`
    : isConnected
      ? `${callTypeLabel} connected`
      : `${callTypeLabel} - ${statusLabel}`;
  const connectionLabel = isConnected
    ? 'Connected'
    : callStatus === 'connecting'
      ? 'Connecting'
      : callStatus === 'calling'
        ? 'Ringing'
        : callStatus === 'incoming'
          ? 'Incoming'
          : statusLabel;
  const durationText = durationLabel && isConnected ? durationLabel : '00:00';

  useEffect(() => {
    const element = localVideoRef?.current;
    if (!element) return;

    element.srcObject = localStream || null;
    if (localStream) {
      element.play?.().catch(() => {});
    }
  }, [localStream, localVideoRef]);

  useEffect(() => {
    const element = remoteVideoRef?.current;
    if (!element) return;

    element.srcObject = remoteStream || null;
    setNeedsAudioUnlock(false);

    if (remoteStream) {
      element.play?.().catch(() => {
        setNeedsAudioUnlock(true);
      });
    }
  }, [remoteStream, remoteVideoRef]);

  const handleEnableSound = async () => {
    const element = remoteVideoRef?.current;
    if (!element) return;

    try {
      await element.play?.();
      setNeedsAudioUnlock(false);
    } catch {
      setNeedsAudioUnlock(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-[#050507] text-white">
      <main className="relative min-w-0 flex-1 overflow-hidden bg-black">
        {isVideoCall ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full object-contain transition-opacity ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <audio ref={remoteVideoRef} autoPlay playsInline />
        )}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(124,106,255,0.2),transparent_34%),linear-gradient(180deg,rgba(5,5,8,0.08),rgba(5,5,8,0.64))]" />

        {!hasRemoteVideo ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#090911]">
            <InitialAvatar name={participantName} sizeClass="h-28 w-28" textClass="text-4xl" />
            <div className="text-center">
              <div className="text-2xl font-semibold">{participantName || 'Nexus Chat'}</div>
              <div className="mt-1 text-sm text-white/55">{statusLabel}</div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          title="Close call"
          aria-label="Close call"
          className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/82 shadow-[0_12px_34px_rgba(0,0,0,0.32)] backdrop-blur transition hover:bg-black/75 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="absolute left-1/2 top-4 z-30 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/12 bg-black/62 px-4 py-3 text-center shadow-[0_16px_44px_rgba(0,0,0,0.42)] backdrop-blur-md">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">{callTypeLabel}</div>
          <div className="mt-1 text-lg font-bold text-white">{headlineLabel}</div>
          <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            isConnected
              ? 'border-[#6affe8]/26 bg-[#6affe8]/12 text-[#aef9ff]'
              : showAnswerActions
                ? 'border-[#f9d66a]/24 bg-[#f9d66a]/12 text-[#ffe9a6]'
                : 'border-white/10 bg-white/[0.06] text-white/66'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-[#6affe8]' : showAnswerActions ? 'bg-[#f9d66a]' : 'bg-white/45'}`} />
            {connectionLabel}
          </div>
        </div>

        {isVideoCall && localStream ? (
          <div className="absolute right-4 top-4 z-20 overflow-hidden rounded-lg border border-white/15 bg-black/50 shadow-[0_14px_38px_rgba(0,0,0,0.42)] lg:right-6 lg:top-6">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-16 w-24 object-cover sm:h-20 sm:w-28" />
            <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.68rem] font-semibold text-white/85">
              You
            </div>
          </div>
        ) : null}

        {needsAudioUnlock ? (
          <div className="absolute inset-x-4 top-20 z-30 flex justify-center">
            <button
              type="button"
              onClick={handleEnableSound}
              className="rounded-full border border-[#6affe8]/24 bg-[#6affe8]/14 px-4 py-2 text-sm font-semibold text-[#aef9ff] shadow-[0_14px_36px_rgba(0,0,0,0.35)] transition hover:bg-[#6affe8]/20 hover:text-white"
            >
              Enable sound
            </button>
          </div>
        ) : null}

        <div className="absolute bottom-24 left-4 z-20 flex max-w-[60%] items-center gap-3 rounded-lg border border-white/10 bg-black/50 px-3 py-2 shadow-[0_14px_38px_rgba(0,0,0,0.35)] backdrop-blur sm:bottom-28">
          <InitialAvatar name={participantName} sizeClass="h-8 w-8" textClass="text-xs" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{participantName || 'Nexus Chat'}</div>
            <div className="text-[0.7rem] text-[#6affe8]">{connectionLabel} - {callTypeLabel}</div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-black/82 via-black/36 to-transparent px-4 pb-5 pt-16 sm:pb-7">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/58 p-3 shadow-[0_16px_46px_rgba(0,0,0,0.42)] backdrop-blur-md sm:gap-4">
            {showAnswerActions ? (
              <>
                <IconButton title="Decline call" onClick={onDecline} danger>
                  <PhoneIcon />
                </IconButton>
                <IconButton title="Answer call" onClick={onAnswer} active>
                  <PhoneIcon />
                </IconButton>
              </>
            ) : (
              <>
                {isVideoCall ? (
                  <IconButton title={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'} onClick={onToggleVideo} active={isVideoEnabled}>
                    <VideoIcon off={!isVideoEnabled} />
                  </IconButton>
                ) : null}
                <IconButton title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'} onClick={onToggleAudio} active={isAudioEnabled}>
                  <MicIcon off={!isAudioEnabled} />
                </IconButton>
                {showScreenShareAction ? (
                  <IconButton
                    title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
                    onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                    active={isScreenSharing}
                  >
                    <ScreenIcon />
                  </IconButton>
                ) : null}
                {showSpeakerAction ? (
                  <IconButton title={audioOutputMode === 'speaker' ? 'Speaker off' : 'Speaker on'} onClick={onToggleSpeaker} active={audioOutputMode === 'speaker'}>
                    <SpeakerIcon active={audioOutputMode === 'speaker'} />
                  </IconButton>
                ) : null}
                <IconButton title="More options" onClick={onMinimize}>
                  <MoreIcon />
                </IconButton>
                <IconButton title="End call" onClick={onEnd} danger>
                  <PhoneIcon />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </main>

      <aside className="hidden w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#111118] lg:flex">
        <div className="flex h-[68px] items-center justify-between border-b border-white/8 px-5">
          <div>
            <div className="text-sm font-semibold">{headlineLabel}</div>
            <div className="mt-0.5 text-xs text-white/42">{connectionLabel}</div>
          </div>
          {!showAnswerActions ? (
            <button
              type="button"
              onClick={onMinimize}
              title="Minimize"
              aria-label="Minimize"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/58 transition hover:bg-white/[0.06] hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-lg border border-white/7 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3">
              <InitialAvatar name={participantName} />
              <div>
                <div className="text-sm font-semibold">{participantName || 'Nexus Chat'}</div>
                <div className="text-xs text-[#6affe8]">{connectionLabel} - {callTypeLabel}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/7 bg-white/[0.035] p-4">
            <div className="text-xs text-white/48">Call type</div>
            <div className="mt-1 text-sm font-semibold">{callTypeLabel}</div>
          </div>

          <div className="mt-3 rounded-lg border border-white/7 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs text-white/48">Duration</div>
                <div className="text-sm font-semibold">{durationText}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm font-semibold">Participants (2)</div>
            <button
              type="button"
              onClick={onAddPeople}
              className="rounded-lg border border-[#7c6aff]/35 px-3 py-1.5 text-xs font-semibold text-[#b8b0ff] transition hover:bg-[#7c6aff]/12 hover:text-white"
            >
              Add people
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-white/7 bg-white/[0.03]">
            <div className="flex items-center gap-3 border-b border-white/6 px-3 py-3">
              <InitialAvatar name={participantName} sizeClass="h-8 w-8" textClass="text-xs" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{participantName || 'Nexus Chat'}</div>
                <div className="text-[0.68rem] text-[#6affe8]">Host</div>
              </div>
              <MicIcon off={false} />
            </div>
            <div className="flex items-center gap-3 px-3 py-3">
              <InitialAvatar name="You" sizeClass="h-8 w-8" textClass="text-xs" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">You</div>
                <div className="text-[0.68rem] text-white/42">{isAudioEnabled ? 'Mic on' : 'Muted'}</div>
              </div>
              <MicIcon off={!isAudioEnabled} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/8 p-4">
          <button type="button" className="rounded-lg border border-white/8 bg-white/[0.035] px-3 py-3 text-sm font-semibold text-white/70">
            Chat
          </button>
          <button type="button" className="rounded-lg border border-white/8 bg-white/[0.06] px-3 py-3 text-sm font-semibold text-white">
            People
          </button>
        </div>
      </aside>
    </div>
  );
};

export const MinimizedCallWidget = ({
  callType,
  callStatus,
  participantName,
  durationLabel,
  onRestore,
  onEnd,
}) => (
  <div className="fixed bottom-5 right-5 z-50 w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#111118]/95 text-white shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur">
    <button type="button" onClick={onRestore} className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]">
      <InitialAvatar name={participantName} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{participantName || 'Nexus Chat'}</div>
        <div className="mt-0.5 text-xs text-white/55">
          {callType === 'video' ? 'Video' : 'Voice'} call · {durationLabel || statusCopy[callStatus] || 'Active'}
        </div>
      </div>
      <div className="h-2.5 w-2.5 rounded-full bg-[#6affe8]" />
    </button>
    <div className="border-t border-white/8 px-4 py-3">
      <button
        type="button"
        onClick={onEnd}
        className="w-full rounded-xl border border-[#ff4d66]/35 bg-[#ff3b55]/14 px-4 py-2 text-sm font-semibold text-[#ffd5dd] transition hover:bg-[#ff3b55]/22 hover:text-white"
      >
        End call
      </button>
    </div>
  </div>
);

export default CallModal;
