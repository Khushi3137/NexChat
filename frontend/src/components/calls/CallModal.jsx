import React from 'react';

const statusCopy = {
  incoming: 'Incoming call',
  calling: 'Calling...',
  connecting: 'Connecting...',
  'in-call': 'Call in progress',
  ended: 'Call ended',
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

const CallModal = ({
  callType,
  callStatus,
  participantName,
  localVideoRef,
  remoteVideoRef,
  durationLabel,
  isScreenSharing = false,
  isIncoming = false,
  onAnswer,
  onDecline,
  onEnd,
  onClose,
  onStartScreenShare,
  onStopScreenShare,
}) => {
  const isVideoCall = callType === 'video';
  const supportsScreenShare =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
  const showAnswerActions = isIncoming && callStatus === 'incoming';
  const showEndAction = !showAnswerActions;
  const showScreenShareAction =
    isVideoCall && supportsScreenShare && callStatus === 'in-call' && !showAnswerActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[30px] border border-white/10 bg-[#090911] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/60 transition hover:bg-black/55 hover:text-white"
        >
          Close
        </button>

        <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="relative min-h-[360px] overflow-hidden bg-[#040408]">
            {isVideoCall ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              <audio ref={remoteVideoRef} autoPlay playsInline />
            )}

            <div className={`absolute inset-0 ${
              isVideoCall
                ? 'bg-[radial-gradient(circle_at_top,rgba(124,106,255,0.18),transparent_34%),linear-gradient(180deg,rgba(4,4,8,0.2),rgba(4,4,8,0.72))]'
                : 'bg-[radial-gradient(circle_at_top,rgba(124,106,255,0.22),transparent_32%),radial-gradient(circle_at_bottom,rgba(74,255,160,0.14),transparent_28%),linear-gradient(180deg,#0a0a12,#05050a)]'
            }`} />

            {!isVideoCall ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-3xl font-bold text-white">
                  {(participantName || 'Call').slice(0, 1).toUpperCase()}
                </div>
              </div>
            ) : null}

            <div className="absolute left-6 top-6 z-10">
              <div className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/65">
                {isVideoCall ? 'Video Call' : 'Voice Call'}
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 z-10 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="brand-font truncate text-2xl font-bold text-white">{participantName || 'Contact'}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-sm text-white/75">
                    {statusCopy[callStatus] || 'Call active'}
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

              <div className="hidden overflow-hidden rounded-2xl border border-white/12 bg-black/50 shadow-[0_14px_36px_rgba(0,0,0,0.35)] md:block">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`object-cover ${isVideoCall ? 'h-28 w-40' : 'h-20 w-32'}`}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between border-t border-white/10 bg-[#0d0d16] p-6 lg:border-l lg:border-t-0">
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/40">
                Call Details
              </div>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs text-white/42">Type</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {isVideoCall ? 'Video call' : 'Voice call'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs text-white/42">Status</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {isScreenSharing ? 'Sharing screen' : statusCopy[callStatus] || 'Call active'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="text-xs text-white/42">Duration</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {durationLabel && callStatus === 'in-call' ? durationLabel : 'Not connected yet'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {showAnswerActions ? (
                <>
                  <button
                    type="button"
                    onClick={onAnswer}
                    className="flex-1 rounded-2xl border border-[#6affe8]/24 bg-[#6affe8]/12 px-4 py-3 text-sm font-semibold text-[#aef9ff] transition hover:bg-[#6affe8]/18 hover:text-white"
                  >
                    Answer
                  </button>
                  <button
                    type="button"
                    onClick={onDecline}
                    className="flex-1 rounded-2xl border border-[#ff8ca8]/24 bg-[#ff8ca8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1df] transition hover:bg-[#ff8ca8]/16 hover:text-white"
                  >
                    Decline
                  </button>
                </>
              ) : null}

              {showEndAction ? (
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
                    onClick={onEnd}
                    className="flex-1 rounded-2xl border border-[#ff8ca8]/24 bg-[#ff8ca8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1df] transition hover:bg-[#ff8ca8]/16 hover:text-white"
                  >
                    End Call
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
