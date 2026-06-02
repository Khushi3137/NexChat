import React, { useEffect, useRef, useState } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import toast from 'react-hot-toast';
import { uploadService } from '../../services/uploadService';
import VirtualKeyboard from '../shared/VirtualKeyboard';
import GifPickerModal from './GifPickerModal';

const MAX_SCHEDULE_WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const PERIOD_OPTIONS = ['AM', 'PM'];
const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.zip';
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

const getActiveMentionState = (value, caretPosition) => {
  if (typeof value !== 'string') return null;

  const normalizedCaret = typeof caretPosition === 'number' ? caretPosition : value.length;
  const beforeCaret = value.slice(0, normalizedCaret);
  const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/);

  if (!match) return null;

  return {
    query: match[2] || '',
    start: normalizedCaret - match[2].length - 1,
    end: normalizedCaret,
  };
};

const formatScheduledPreview = (value) =>
  new Intl.DateTimeFormat([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const createScheduleSelection = (date = new Date(Date.now() + 5 * 60 * 1000)) => {
  const nextDate = new Date(date);
  nextDate.setSeconds(0, 0);

  const hours24 = nextDate.getHours();
  return {
    hour: String(hours24 % 12 || 12).padStart(2, '0'),
    minute: String(nextDate.getMinutes()).padStart(2, '0'),
    period: hours24 >= 12 ? 'PM' : 'AM',
  };
};

const resolveScheduleDate = (selection) => {
  if (!selection) return null;

  const hours = Number(selection.hour);
  const minutes = Number(selection.minute);
  const period = selection.period;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !PERIOD_OPTIONS.includes(period)) {
    return null;
  }

  const now = new Date();
  const scheduledDate = new Date(now);
  const normalizedHours = hours % 12;

  scheduledDate.setHours(period === 'PM' ? normalizedHours + 12 : normalizedHours, minutes, 0, 0);

  if (scheduledDate <= now) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  return scheduledDate;
};

const isScheduleAllowed = (date) => {
  if (!(date instanceof Date)) {
    return false;
  }

  const now = Date.now();
  const scheduleTime = date.getTime();

  return !Number.isNaN(scheduleTime) && scheduleTime > now && scheduleTime - now <= MAX_SCHEDULE_WINDOW_MS;
};

const TimeWheel = ({ label, options, value, onChange }) => {
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [value]);

  return (
    <div className="min-w-0">
      <div className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/35">
        {label}
      </div>
      <div className="h-32 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f1a] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="space-y-1">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              ref={option === value ? selectedRef : null}
              onClick={() => onChange(option)}
              className={`flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm transition ${
                option === value
                  ? 'bg-[#7c6aff]/18 text-[#f4f1ff] shadow-[0_8px_18px_rgba(124,106,255,0.18)]'
                  : 'text-white/55 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const MessageInput = ({
  onSend,
  onTyping,
  onStopTyping,
  replyTo,
  onCancelReply,
  placeholder = 'Message this conversation...',
  allowScheduling = true,
  allowPolls = true,
  disabled = false,
  disabledReason = '',
  mentionCandidates = [],
  currentUserId = '',
}) => {
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locationShareStage, setLocationShareStage] = useState('idle');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [scheduleSelection, setScheduleSelection] = useState(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [mentionState, setMentionState] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const imageFileRef = useRef(null);
  const videoFileRef = useRef(null);
  const documentFileRef = useRef(null);
  const audioFileRef = useRef(null);
  const typingTimer = useRef(null);
  const pickerWrapRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  };

  const mentionableMembers = Array.isArray(mentionCandidates)
    ? mentionCandidates
        .filter((participant) => normalizeId(participant) && normalizeId(participant) !== normalizeId(currentUserId))
        .map((participant) => ({
          ...participant,
          mentionLabel: String(participant?.name || '').trim(),
        }))
        .filter((participant) => participant.mentionLabel)
    : [];

  const mentionSuggestions = mentionState
    ? mentionableMembers
        .filter((participant) => {
          if (!mentionState.query) return true;

          const normalizedQuery = mentionState.query.toLowerCase();
          return (
            participant.mentionLabel.toLowerCase().includes(normalizedQuery)
            || participant.email?.toLowerCase().includes(normalizedQuery)
          );
        })
        .slice(0, 5)
    : [];
  const isSharingLocation = locationShareStage !== 'idle';
  const locationShareStatusText =
    locationShareStage === 'getting'
      ? 'Getting your current location...'
      : locationShareStage === 'sending'
        ? 'Sending location...'
        : '';

  useEffect(() => {
    resizeTextarea();
  }, [content]);

  useEffect(() => {
    if (!showEmoji) return undefined;

    const handleOutside = (event) => {
      if (!pickerWrapRef.current?.contains(event.target)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showEmoji]);

  useEffect(() => {
    if (!showAttachmentMenu) return undefined;

    const handleOutside = (event) => {
      if (!attachmentMenuRef.current?.contains(event.target)) {
        setShowAttachmentMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showAttachmentMenu]);

  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      clearInterval(recordingIntervalRef.current);
      mediaRecorderRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    },
    []
  );

  useEffect(() => {
    if (!allowScheduling && scheduleSelection) {
      setScheduleSelection(null);
    }
  }, [allowScheduling, scheduleSelection]);

  useEffect(() => {
    if (allowPolls) return;

    setShowPollComposer(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  }, [allowPolls]);

  useEffect(() => {
    if (!disabled) return;

    setShowEmoji(false);
    setShowKeyboard(false);
    setShowAttachmentMenu(false);
    setShowGifPicker(false);
    setShowPollComposer(false);
    setMentionState(null);
  }, [disabled]);

  const getScheduledSendTime = () => {
    if (!scheduleSelection) return null;

    const scheduledDate = resolveScheduleDate(scheduleSelection);
    if (!isScheduleAllowed(scheduledDate)) {
      toast.error('Pick a time within the next 24 hours');
      return false;
    }

    return scheduledDate.toISOString();
  };

  const scheduleStopTyping = () => {
    if (disabled) return;
    onTyping();
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(onStopTyping, 1500);
  };

  const updateContentAtSelection = (transform) => {
    const textarea = textareaRef.current;
    const currentValue = content;
    const start = textarea?.selectionStart ?? currentValue.length;
    const end = textarea?.selectionEnd ?? currentValue.length;
    const next = transform(currentValue, start, end);

    setContent(next.value);
    setMentionState(getActiveMentionState(next.value, next.caret));
    setActiveMentionIndex(0);
    scheduleStopTyping();

    requestAnimationFrame(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      nextTextarea.setSelectionRange(next.caret, next.caret);
      resizeTextarea();
    });
  };

  const handleChange = (event) => {
    setContent(event.target.value);
    setMentionState(getActiveMentionState(event.target.value, event.target.selectionStart));
    setActiveMentionIndex(0);
    scheduleStopTyping();
  };

  const insertMention = (participant) => {
    if (!participant?.mentionLabel || !mentionState) return;

    const mentionText = `@${participant.mentionLabel} `;
    const nextValue = `${content.slice(0, mentionState.start)}${mentionText}${content.slice(mentionState.end)}`;
    const nextCaret = mentionState.start + mentionText.length;

    setContent(nextValue);
    setMentionState(null);
    setActiveMentionIndex(0);
    scheduleStopTyping();

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
      resizeTextarea();
    });
  };

  const finalizeSend = () => {
    setContent('');
    setScheduleSelection(null);
    setMentionState(null);
    setActiveMentionIndex(0);
    onStopTyping();
  };

  const handleSend = async () => {
    if (disabled) return;
    const text = content.trim();
    if (!text) return;

    if (scheduleSelection) {
      const scheduledTime = getScheduledSendTime();
      if (!scheduledTime) {
        return;
      }

      const didSend = await onSend({
        content: text,
        messageType: 'text',
        scheduledTime,
      });
      if (didSend !== false) {
        finalizeSend();
      }
      return;
    }

    const didSend = await onSend({ content: text, messageType: 'text' });
    if (didSend !== false) {
      finalizeSend();
    }
  };

  const handleKeyDown = (event) => {
    if (mentionSuggestions.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveMentionIndex((previous) => (previous + 1) % mentionSuggestions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveMentionIndex((previous) => (previous - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(mentionSuggestions[activeMentionIndex] || mentionSuggestions[0]);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionState(null);
        setActiveMentionIndex(0);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji) => {
    updateContentAtSelection((currentValue, start, end) => {
      const nextValue = `${currentValue.slice(0, start)}${emoji.native}${currentValue.slice(end)}`;
      return {
        value: nextValue,
        caret: start + emoji.native.length,
      };
    });
    setShowEmoji(false);
  };

  const handleVirtualKeyboardInput = (key) => {
    updateContentAtSelection((currentValue, start, end) => ({
      value: `${currentValue.slice(0, start)}${key}${currentValue.slice(end)}`,
      caret: start + key.length,
    }));
  };

  const handleVirtualKeyboardSpace = () => {
    handleVirtualKeyboardInput(' ');
  };

  const handleVirtualKeyboardBackspace = () => {
    updateContentAtSelection((currentValue, start, end) => {
      if (start !== end) {
        return {
          value: `${currentValue.slice(0, start)}${currentValue.slice(end)}`,
          caret: start,
        };
      }

      if (start === 0) {
        return {
          value: currentValue,
          caret: 0,
        };
      }

      return {
        value: `${currentValue.slice(0, start - 1)}${currentValue.slice(end)}`,
        caret: start - 1,
      };
    });
  };

  const resolveAttachmentType = (file, explicitType) => {
    if (explicitType) return explicitType;
    if (file.type.startsWith('image')) return 'image';
    if (file.type.startsWith('video')) return 'video';
    if (file.type.startsWith('audio')) return 'audio';
    return 'document';
  };

  const handleChosenFile = async (file, explicitType) => {
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await uploadService.uploadFile(file);
      const type = resolveAttachmentType(file, explicitType);
      const payload = { content: '', mediaUrl: url, messageType: type };

      if (scheduleSelection) {
        const scheduledTime = getScheduledSendTime();
        if (!scheduledTime) {
          return;
        }

        payload.scheduledTime = scheduledTime;
      }

      const didSend = await onSend(payload);
      if (didSend !== false) {
        setScheduleSelection(null);
        setShowAttachmentMenu(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event, explicitType) => {
    const file = event.target.files?.[0];
    await handleChosenFile(file, explicitType);
    event.target.value = '';
  };

  const handleGifSelect = async (payload) => {
    if (!payload?.mediaUrl) return false;

    const nextPayload = { ...payload };
    if (scheduleSelection) {
      const scheduledTime = getScheduledSendTime();
      if (!scheduledTime) {
        return false;
      }

      nextPayload.scheduledTime = scheduledTime;
    }

    const didSend = await onSend(nextPayload);
    if (didSend !== false) {
      setScheduleSelection(null);
      setShowGifPicker(false);
      setShowAttachmentMenu(false);
      return true;
    }

    return false;
  };

  const handleShareLocation = () => {
    if (disabled) return;
    if (!navigator.geolocation) {
      toast.error('Location sharing is not supported on this device');
      return;
    }

    const confirmed = window.confirm('Do you want to send your current location?');
    if (!confirmed) return;

    setLocationShareStage('getting');
    setShowAttachmentMenu(false);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const payload = {
          content: '',
          messageType: 'location',
          location: {
            lat: coords.latitude,
            lng: coords.longitude,
            address: `Lat ${coords.latitude.toFixed(5)}, Lng ${coords.longitude.toFixed(5)}`,
          },
        };

        try {
          setLocationShareStage('sending');
          const didSend = await onSend(payload);
          if (didSend !== false) {
            toast.success('Location shared');
          }
        } catch {
          toast.error('Location sharing failed');
        } finally {
          setLocationShareStage('idle');
        }
      },
      () => {
        setLocationShareStage('idle');
        toast.error('Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resetPollComposer = () => {
    setShowPollComposer(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const handleSendPoll = async () => {
    if (disabled || !allowPolls) return;

    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);

    if (!question) {
      toast.error('Add a poll question');
      return;
    }

    if (options.length < 2) {
      toast.error('Add at least two poll options');
      return;
    }

    const didSend = await onSend({
      content: question,
      messageType: 'poll',
      poll: {
        question,
        options: options.map((text) => ({ text })),
      },
    });

    if (didSend !== false) {
      resetPollComposer();
      toast.success('Poll sent');
    }
  };

  const stopAudioRecording = () => {
    clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = null;
    mediaRecorderRef.current?.stop();
  };

  const startAudioRecording = async () => {
    if (disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice notes are not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const extension = recorder.mimeType?.includes('ogg') ? 'ogg' : 'webm';
        const voiceFile = new File([blob], `voice-note.${extension}`, {
          type: blob.type || 'audio/webm',
        });

        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;
        audioChunksRef.current = [];
        setIsRecordingAudio(false);
        setRecordingSeconds(0);

        const confirmed = window.confirm('Do you want to send this voice note?');
        if (!confirmed) {
          toast('Voice note discarded.');
          return;
        }

        await handleChosenFile(voiceFile, 'audio');
      };

      recorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch {
      toast.error('Could not start recording');
    }
  };

  const toggleAudioRecording = async () => {
    if (isRecordingAudio) {
      stopAudioRecording();
      return;
    }

    await startAudioRecording();
  };

  return (
    <>
      <GifPickerModal
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
      />

      <div className="border-t border-white/10 bg-[#0a0a12]/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl sm:px-6 sm:pb-4">
        {replyTo ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 border-l-[3px] border-l-[#7c6aff] bg-[#14141f]/92 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.3)]">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-semibold text-[#cfc5ff]">
              Replying To
            </div>
            <div className="truncate text-sm text-white/60">
              {replyTo.content?.slice(0, 80) || 'Shared media attachment'}
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.07] hover:text-white"
          >
            Close
          </button>
        </div>
        ) : null}

        {allowScheduling && scheduleSelection ? (
        <div className="mb-3 rounded-2xl border border-white/10 bg-[#14141f]/92 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <div className="text-[0.72rem] font-semibold text-[#cfc5ff]">
                Schedule Message
              </div>
              <div className="mt-1 text-sm text-white/55">
                {resolveScheduleDate(scheduleSelection)
                  ? `Will send on ${formatScheduledPreview(resolveScheduleDate(scheduleSelection))}`
                  : 'Choose a time. If it has already passed today, it will go tomorrow.'}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_116px_auto]">
              <TimeWheel
                label="Hour"
                options={HOUR_OPTIONS}
                value={scheduleSelection.hour}
                onChange={(hour) => setScheduleSelection((previous) => ({ ...previous, hour }))}
              />
              <TimeWheel
                label="Minute"
                options={MINUTE_OPTIONS}
                value={scheduleSelection.minute}
                onChange={(minute) => setScheduleSelection((previous) => ({ ...previous, minute }))}
              />
              <TimeWheel
                label="AM/PM"
                options={PERIOD_OPTIONS}
                value={scheduleSelection.period}
                onChange={(period) => setScheduleSelection((previous) => ({ ...previous, period }))}
              />
              <button
                type="button"
                onClick={() => {
                  setScheduleSelection(null);
                }}
                className="self-start rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.07] hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        ) : null}

        {showPollComposer && allowPolls ? (
        <div className="mb-3 rounded-2xl border border-white/10 bg-[#14141f]/92 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.3)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-semibold text-[#cfc5ff]">Create Poll</div>
              <div className="mt-1 text-sm text-white/55">Ask a question and add at least two options.</div>
            </div>
            <button
              type="button"
              onClick={resetPollComposer}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.07] hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={pollQuestion}
              onChange={(event) => setPollQuestion(event.target.value)}
              placeholder="Poll question"
              className="w-full rounded-2xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
            />

            {pollOptions.map((option, index) => (
              <div key={`poll-option-${index}`} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(event) =>
                    setPollOptions((previous) =>
                      previous.map((value, optionIndex) => (optionIndex === index ? event.target.value : value))
                    )
                  }
                  placeholder={`Option ${index + 1}`}
                  className="w-full rounded-2xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7c6aff]"
                />
                {pollOptions.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => setPollOptions((previous) => previous.filter((_, optionIndex) => optionIndex !== index))}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/55 transition hover:bg-white/[0.07] hover:text-white"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setPollOptions((previous) => (previous.length >= 6 ? previous : [...previous, '']))
                }
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/60 transition hover:bg-white/[0.07] hover:text-white"
              >
                Add Option
              </button>
              <button
                type="button"
                onClick={handleSendPoll}
                className="rounded-xl border border-[#7c6aff]/30 bg-[#7c6aff]/14 px-4 py-2 text-sm font-semibold text-[#ece7ff] transition hover:bg-[#7c6aff]/22"
              >
                Send Poll
              </button>
            </div>
          </div>
        </div>
        ) : null}

        {isRecordingAudio ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#ff6ab0]/18 bg-[#ff6ab0]/8 px-4 py-3 text-sm text-[#ffd2d7] shadow-[0_18px_48px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6ab0] animate-pulse" />
            <span>Recording voice note {recordingSeconds}s</span>
          </div>
          <button
            type="button"
            onClick={stopAudioRecording}
            className="rounded-xl border border-[#ffb6bf]/18 bg-[#ffb6bf]/10 px-3 py-2 text-sm font-semibold text-[#ffd2d7] transition hover:bg-[#ffb6bf]/16 hover:text-white"
          >
            Stop
          </button>
        </div>
        ) : null}

        {isSharingLocation ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#7c6aff]/20 bg-[#7c6aff]/10 px-4 py-3 text-sm text-[#e9e4ff] shadow-[0_18px_48px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#7c6aff]" />
            <span>{locationShareStatusText}</span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-white/62">
            Uploading
          </span>
        </div>
        ) : null}

        {mentionSuggestions.length ? (
        <div className="mb-3 rounded-2xl border border-white/10 bg-[#14141f]/92 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.3)]">
          <div className="mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32">
            Mention Group Member
          </div>
          <div className="space-y-1">
            {mentionSuggestions.map((participant, index) => (
              <button
                key={participant._id}
                type="button"
                onClick={() => insertMention(participant)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${
                  index === activeMentionIndex
                    ? 'bg-[#7c6aff]/12 text-white'
                    : 'text-white/72 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{participant.mentionLabel}</div>
                  <div className="truncate text-[0.74rem] text-white/35">{participant.email || 'Group member'}</div>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.62rem] font-semibold text-white/45">
                  @{participant.mentionLabel}
                </span>
              </button>
            ))}
          </div>
        </div>
        ) : null}

        <div className="relative flex flex-wrap items-end gap-2 sm:flex-nowrap sm:gap-3">
        {showEmoji ? (
          <div ref={pickerWrapRef} className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-30 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl sm:right-auto">
            <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="dark" previewPosition="none" />
          </div>
        ) : null}

        {showKeyboard ? (
          <div className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-20">
            <VirtualKeyboard
              onInput={handleVirtualKeyboardInput}
              onBackspace={handleVirtualKeyboardBackspace}
              onSpace={handleVirtualKeyboardSpace}
              onEnter={handleSend}
              onClose={() => setShowKeyboard(false)}
            />
          </div>
        ) : null}

        {showAttachmentMenu ? (
          <div
            ref={attachmentMenuRef}
            className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-20 rounded-[22px] border border-white/10 bg-[#101018]/96 p-3 shadow-[0_28px_72px_rgba(0,0,0,0.55)] sm:right-auto sm:w-[280px]"
          >
            <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/32">
              Share Something
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => imageFileRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/72 transition hover:bg-white/[0.07] hover:text-white"
              >
                Photos
              </button>
              <button
                type="button"
                onClick={() => videoFileRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/72 transition hover:bg-white/[0.07] hover:text-white"
              >
                Videos
              </button>
              <button
                type="button"
                onClick={() => documentFileRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/72 transition hover:bg-white/[0.07] hover:text-white"
              >
                Documents
              </button>
              <button
                type="button"
                onClick={() => audioFileRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/72 transition hover:bg-white/[0.07] hover:text-white"
              >
                Audio File
              </button>
              <button
                type="button"
                onClick={handleShareLocation}
                disabled={disabled || isSharingLocation}
                className="col-span-2 rounded-2xl border border-[#7c6aff]/20 bg-[#7c6aff]/10 px-3 py-3 text-sm text-[#e6e1ff] transition hover:bg-[#7c6aff]/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locationShareStage === 'getting'
                  ? 'Getting Location...'
                  : locationShareStage === 'sending'
                    ? 'Sending Location...'
                    : 'Share Location'}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setShowKeyboard(false);
            setShowAttachmentMenu(false);
            setShowGifPicker(false);
            setShowEmoji((value) => !value);
          }}
          disabled={disabled}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#14141f] text-sm text-white/60 transition hover:bg-[#1a1a28] hover:text-white sm:h-11 sm:w-11 sm:rounded-2xl"
          title="Emoji"
        >
          :)
        </button>

        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setShowEmoji(false);
            setShowAttachmentMenu(false);
            setShowGifPicker(false);
            setShowKeyboard((value) => !value);
          }}
          disabled={disabled}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[0.68rem] font-semibold transition sm:h-11 sm:w-11 sm:rounded-2xl sm:text-[0.72rem] ${
            showKeyboard
              ? 'border-[#7c6aff]/30 bg-[#7c6aff]/14 text-[#e2dcff]'
              : 'border-white/10 bg-[#14141f] text-white/60 hover:bg-[#1a1a28] hover:text-white'
          }`}
          title="Virtual keyboard"
        >
          KB
        </button>

        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setShowEmoji(false);
            setShowKeyboard(false);
            setShowGifPicker(false);
            setShowAttachmentMenu((value) => !value);
          }}
          disabled={uploading || disabled}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#14141f] text-lg text-white/60 transition hover:bg-[#1a1a28] hover:text-white disabled:opacity-40 sm:h-11 sm:w-11 sm:rounded-2xl"
          title="Attachment options"
        >
          +
        </button>
        <input
          ref={imageFileRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={(event) => handleFileChange(event, 'image')}
        />
        <input
          ref={videoFileRef}
          type="file"
          className="hidden"
          accept="video/*"
          onChange={(event) => handleFileChange(event, 'video')}
        />
        <input
          ref={documentFileRef}
          type="file"
          className="hidden"
          accept={DOCUMENT_ACCEPT}
          onChange={(event) => handleFileChange(event, 'document')}
        />
        <input
          ref={audioFileRef}
          type="file"
          className="hidden"
          accept="audio/*"
          onChange={(event) => handleFileChange(event, 'audio')}
        />

        <button
          type="button"
          onClick={toggleAudioRecording}
          disabled={uploading || disabled}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[0.68rem] font-semibold transition sm:h-11 sm:w-11 sm:rounded-2xl sm:text-[0.72rem] ${
            isRecordingAudio
              ? 'border-[#ff6ab0]/25 bg-[#ff6ab0]/12 text-[#ffd2d7]'
              : 'border-white/10 bg-[#14141f] text-white/60 hover:bg-[#1a1a28] hover:text-white'
          } disabled:opacity-40`}
          title={isRecordingAudio ? 'Stop voice note' : 'Record voice note'}
        >
          Mic
        </button>

        <div className="order-first min-w-0 w-full rounded-[18px] border border-white/10 bg-[#14141f]/92 p-1.5 shadow-[0_22px_50px_rgba(0,0,0,0.35)] sm:order-none sm:flex-1 sm:rounded-[20px]">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={(event) => setMentionState(getActiveMentionState(event.target.value, event.target.selectionStart))}
            onKeyUp={(event) => {
              if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) return;
              setMentionState(getActiveMentionState(event.currentTarget.value, event.currentTarget.selectionStart));
            }}
            rows={1}
            disabled={disabled}
            placeholder={
              uploading
                ? 'Uploading attachment...'
                : disabledReason || placeholder
            }
            className="max-h-[132px] w-full bg-transparent px-3 py-2.5 text-sm leading-6 text-[#f0eeff] outline-none placeholder:text-white/28"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-1 sm:gap-3 sm:px-3">
            <div className="flex min-w-0 flex-wrap gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  if (disabled || uploading) return;
                  setShowEmoji(false);
                  setShowKeyboard(false);
                  setShowAttachmentMenu(false);
                  setShowGifPicker(true);
                }}
                disabled={disabled || uploading}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.66rem] font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-2.5 sm:text-[0.68rem]"
              >
                GIF
              </button>
              <button
                type="button"
                onClick={handleShareLocation}
                disabled={disabled || isSharingLocation}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.66rem] font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-2.5 sm:text-[0.68rem]"
              >
                {isSharingLocation ? 'Sharing...' : 'Location'}
              </button>
              {allowPolls ? (
                <button
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    setShowPollComposer((value) => !value);
                  }}
                  disabled={disabled}
                  className={`rounded-lg border px-2 py-1 text-[0.66rem] font-medium transition sm:px-2.5 sm:text-[0.68rem] ${
                    showPollComposer
                      ? 'border-[#7c6aff]/30 bg-[#7c6aff]/12 text-[#d9d2ff]'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  Poll
                </button>
              ) : null}
              {allowScheduling ? (
                <button
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    setScheduleSelection((previous) => previous || createScheduleSelection());
                  }}
                  disabled={disabled}
                  className={`rounded-lg border px-2 py-1 text-[0.66rem] font-medium transition sm:px-2.5 sm:text-[0.68rem] ${
                    scheduleSelection
                      ? 'border-[#7c6aff]/30 bg-[#7c6aff]/12 text-[#d9d2ff]'
                      : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  Schedule
                </button>
              ) : null}
            </div>
            <div className="hidden shrink-0 text-[0.68rem] text-white/26 sm:block">
              {isSharingLocation
                ? locationShareStatusText
                : uploading
                ? 'Uploading...'
                : disabledReason
                  ? disabledReason
                    : scheduleSelection
                    ? 'Enter to schedule'
                    : 'Enter to send'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !content.trim() || uploading || isSharingLocation}
          className="h-10 min-w-[88px] flex-1 rounded-xl border border-[#7c6aff]/30 bg-gradient-to-br from-[#7c6aff] to-[#5f7dff] px-4 text-sm font-medium text-white shadow-[0_12px_28px_rgba(124,106,255,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[46px] sm:min-w-[82px] sm:flex-none sm:rounded-2xl sm:px-5"
        >
          {scheduleSelection ? 'Schedule' : 'Send'}
        </button>
        </div>
      </div>
    </>
  );
};

export default MessageInput;
