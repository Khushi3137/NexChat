import React, { useEffect } from 'react';

const getFileExtension = (url = '') => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.split('.').pop()?.toLowerCase() || '';
  } catch {
    return url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  }
};

const isPreviewableDocument = (url = '') => ['pdf', 'txt'].includes(getFileExtension(url));

const getViewerTitle = (message) => {
  if (message?.viewerTitle?.trim()) return message.viewerTitle.trim();
  if (message?.content?.trim()) return message.content.trim();
  if (message?.messageType === 'image') return 'Image';
  if (message?.messageType === 'video') return 'Video';
  if (message?.messageType === 'audio') return 'Audio';
  if (message?.messageType === 'document') return 'Document';
  return 'Attachment';
};

const MediaViewerModal = ({ message, onClose }) => {
  useEffect(() => {
    if (!message) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [message, onClose]);

  if (!message?.mediaUrl) return null;

  const mediaType = message.messageType || 'document';
  const viewerTitle = getViewerTitle(message);
  const previewableDocument = mediaType === 'document' && isPreviewableDocument(message.mediaUrl);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close media viewer"
        onClick={onClose}
        className="absolute inset-0 bg-black/78 backdrop-blur-md"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0a12]/96 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-white">{viewerTitle}</div>
            <div className="mt-1 text-sm text-white/42">
              {mediaType === 'image'
                ? 'Image preview'
                : mediaType === 'video'
                  ? 'Video preview'
                  : mediaType === 'audio'
                    ? 'Audio player'
                    : 'Attachment preview'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              Open In New Tab
            </a>
            <a
              href={message.mediaUrl}
              download
              className="rounded-2xl border border-[#7c6aff]/28 bg-[#7c6aff]/12 px-4 py-2 text-sm font-semibold text-[#efe9ff] transition hover:bg-[#7c6aff]/20"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="app-scrollbar flex-1 overflow-auto px-5 py-5">
          {mediaType === 'image' ? (
            <div className="flex min-h-[60vh] items-center justify-center rounded-[26px] border border-white/8 bg-black/30 p-4">
              <img
                src={message.mediaUrl}
                alt={viewerTitle}
                className="max-h-[75vh] w-auto max-w-full rounded-[24px] object-contain"
              />
            </div>
          ) : null}

          {mediaType === 'video' ? (
            <div className="rounded-[26px] border border-white/8 bg-black/35 p-4">
              <video
                src={message.mediaUrl}
                controls
                autoPlay
                className="max-h-[75vh] w-full rounded-[22px] bg-black"
              />
            </div>
          ) : null}

          {mediaType === 'audio' ? (
            <div className="mx-auto max-w-2xl rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(124,106,255,0.12),rgba(255,106,176,0.06))] p-6">
              <div className="rounded-[22px] border border-white/8 bg-[#11111c]/82 px-5 py-5">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/34">
                  Voice / Audio
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Play shared audio</div>
                <audio src={message.mediaUrl} controls autoPlay className="mt-5 w-full" />
              </div>
            </div>
          ) : null}

          {mediaType === 'document' && previewableDocument ? (
            <iframe
              src={message.mediaUrl}
              title={viewerTitle}
              className="h-[75vh] w-full rounded-[24px] border border-white/8 bg-white"
            />
          ) : null}

          {mediaType === 'document' && !previewableDocument ? (
            <div className="mx-auto max-w-2xl rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(124,106,255,0.08))] p-6">
              <div className="rounded-[22px] border border-white/8 bg-[#11111c]/82 px-5 py-5">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/34">
                  Document
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  This file can be opened in a new tab or downloaded
                </div>
                <div className="mt-3 text-sm leading-6 text-white/58">
                  Some document types do not preview directly inside the browser. Use one of the actions above to view the full file.
                </div>
              </div>
            </div>
          ) : null}

          {message.content?.trim() && (
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/72">
              {message.content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaViewerModal;
