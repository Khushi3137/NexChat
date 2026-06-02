import React from 'react';
import { getCallStatusText } from '../../utils/callUtils';

const getPinnedPreview = (message) => {
  if (message?.content?.trim()) return message.content;
  if (message?.messageType === 'image') return 'Pinned image';
  if (message?.messageType === 'video') return 'Pinned video';
  if (message?.messageType === 'audio') return 'Pinned voice note';
  if (message?.messageType === 'document') return 'Pinned document';
  if (message?.messageType === 'location') return message?.location?.address || 'Pinned location';
  if (message?.messageType === 'poll') return message?.poll?.question || 'Pinned poll';
  if (message?.messageType === 'call') return getCallStatusText(message?.call);
  return 'Shared media attachment';
};

const PinnedMessage = ({ message, onClose, onJump }) => {
  if (!message) return null;

  return (
    <div className="mx-6 mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 border-l-[3px] border-l-[#ff6ab0] bg-[#14141f]/90 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        onClick={onJump}
        className="min-w-0 flex-1 text-left"
      >
        <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#ffbad6]">
          Pinned Message
        </div>
        <div className="truncate text-sm text-white/65">{getPinnedPreview(message)}</div>
      </button>

      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.07] hover:text-white"
      >
        Close
      </button>
    </div>
  );
};

export default PinnedMessage;
