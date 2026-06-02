import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { resolveNotificationPreferences } from '../utils/notificationPreferences';

const tonePatterns = {
  chime: [
    { frequency: 880, endFrequency: 660, start: 0, duration: 0.24, type: 'sine' },
  ],
  pop: [
    { frequency: 520, endFrequency: 760, start: 0, duration: 0.12, type: 'triangle' },
  ],
  bell: [
    { frequency: 1046, endFrequency: 1046, start: 0, duration: 0.18, type: 'sine' },
    { frequency: 1318, endFrequency: 1318, start: 0.16, duration: 0.22, type: 'sine' },
  ],
  pulse: [
    { frequency: 740, endFrequency: 740, start: 0, duration: 0.12, type: 'square' },
    { frequency: 740, endFrequency: 740, start: 0.22, duration: 0.12, type: 'square' },
  ],
};

const createMessageTone = (audioContext, tone = 'chime') => {
  const startAt = audioContext.currentTime;
  const pattern = tonePatterns[tone] || tonePatterns.chime;

  pattern.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const noteStart = startAt + note.start;
    const noteEnd = noteStart + note.duration;

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, noteEnd);

    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });
};

export const useNotification = () => {
  const { user } = useAuth();
  const audioContextRef = useRef(null);
  const preferences = resolveNotificationPreferences(user?.notificationPreferences);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;

    const unlockAudio = async () => {
      if (audioContext.state === 'running') return;

      try {
        await audioContext.resume();
      } catch {
        // Ignore failed resume attempts; the next user gesture can try again.
      }
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);

      if (audioContextRef.current === audioContext) {
        audioContextRef.current = null;
      }

      audioContext.close().catch(() => {});
    };
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission !== 'default') {
      return Notification.permission;
    }

    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }, []);

  const notify = useCallback((title, body, icon = '/logo192.png') => {
    if (!preferences.messageNotifications) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon });
    }
  }, [preferences.messageNotifications]);

  const playNotificationSound = useCallback(async (toneOverride = '') => {
    if (!preferences.soundAlerts) return;

    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {
        return;
      }
    }

    if (audioContext.state !== 'running') return;

    createMessageTone(audioContext, toneOverride || preferences.soundTone);
  }, [preferences.soundAlerts, preferences.soundTone]);

  return {
    notify,
    playNotificationSound,
    requestNotificationPermission,
  };
};
