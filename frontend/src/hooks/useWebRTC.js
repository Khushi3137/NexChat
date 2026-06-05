import { useCallback, useEffect, useRef, useState } from 'react';

const splitEnvList = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const getIceServers = () => {
  const servers = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
  ];
  const turnUrls = [
    ...splitEnvList(process.env.REACT_APP_TURN_URLS),
    ...splitEnvList(process.env.REACT_APP_TURN_URL),
  ];

  if (turnUrls.length) {
    servers.push({
      urls: turnUrls,
      username: process.env.REACT_APP_TURN_USERNAME || undefined,
      credential: process.env.REACT_APP_TURN_CREDENTIAL || undefined,
    });
  }

  return {
    iceServers: servers,
    iceCandidatePoolSize: 10,
  };
};

const getMediaConstraints = (callType = 'video', videoMode = 'ideal') => ({
  video: callType === 'video'
    ? videoMode === 'basic'
      ? true
      : {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
    : false,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
});

const getMediaStream = async (callType) => {
  if (!window.isSecureContext) {
    throw new Error('Camera and microphone need HTTPS on phones. Open the app with HTTPS, or use localhost on the same device.');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not available in this browser.');
  }

  try {
    return await navigator.mediaDevices.getUserMedia(getMediaConstraints(callType));
  } catch (error) {
    console.error('Media stream error:', error.name, error.message);
    
    // If video call fails, try with basic constraints
    if (callType === 'video') {
      try {
        console.log('Retrying with basic video constraints...');
        return await navigator.mediaDevices.getUserMedia(getMediaConstraints(callType, 'basic'));
      } catch (basicError) {
        console.error('Basic video constraints also failed:', basicError.name);
        
        // Last resort: try audio only
        try {
          console.log('Falling back to audio only...');
          return await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (audioError) {
          throw new Error(`Could not start video source: ${error.message}. Make sure camera permissions are granted and camera is not in use by another app.`);
        }
      }
    }

    throw new Error(`Could not access microphone: ${error.message}`);
  }
};

export const useWebRTC = (socket, userId) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [caller, setCaller] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [audioOutputMode, setAudioOutputModeState] = useState('default');
  const [supportsAudioOutputSelection, setSupportsAudioOutputSelection] = useState(false);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const connectionFailureTimeoutRef = useRef(null);

  const syncLocalPreview = useCallback((stream) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const syncLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsAudioEnabled(stream ? stream.getAudioTracks().some((track) => track.enabled) : true);
    setIsVideoEnabled(stream ? stream.getVideoTracks().some((track) => track.enabled) : true);
    syncLocalPreview(screenStreamRef.current || stream);
  }, [syncLocalPreview]);

  const syncRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const setAudioOutputMode = useCallback(async (nextMode) => {
    const element = remoteVideoRef.current;

    if (!element?.setSinkId) {
      throw new Error('Speaker selection is not supported in this browser. Use your phone call/audio controls instead.');
    }

    const devices = navigator.mediaDevices?.enumerateDevices
      ? await navigator.mediaDevices.enumerateDevices().catch(() => [])
      : [];
    const audioOutputs = devices.filter((device) => device.kind === 'audiooutput');
    const speakerDevice = audioOutputs.find((device) =>
      /speaker|default/i.test(`${device.label} ${device.deviceId}`)
    );
    const earpieceDevice = audioOutputs.find((device) =>
      /earpiece|communications/i.test(`${device.label} ${device.deviceId}`)
    );
    const nextSinkId =
      nextMode === 'speaker'
        ? speakerDevice?.deviceId || 'default'
        : earpieceDevice?.deviceId || 'default';

    await element.setSinkId(nextSinkId);
    setAudioOutputModeState(nextMode);
  }, []);

  const toggleLocalAudio = useCallback(() => {
    const audioTracks = localStreamRef.current?.getAudioTracks() || [];
    if (!audioTracks.length) return true;

    const nextEnabled = !audioTracks.some((track) => track.enabled);
    audioTracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsAudioEnabled(nextEnabled);
    return nextEnabled;
  }, []);

  const toggleLocalVideo = useCallback(() => {
    const videoTracks = localStreamRef.current?.getVideoTracks() || [];
    if (!videoTracks.length) return true;

    const nextEnabled = !videoTracks.some((track) => track.enabled);
    videoTracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsVideoEnabled(nextEnabled);
    return nextEnabled;
  }, []);

  const markCallConnected = useCallback(() => {
    setCallStatus((previous) =>
      previous === 'idle' || previous === 'ended' ? previous : 'in-call'
    );
  }, []);

  const cleanupPeerConnection = useCallback(({ clearPendingCandidates = true } = {}) => {
    window.clearTimeout(connectionFailureTimeoutRef.current);
    connectionFailureTimeoutRef.current = null;

    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.oniceconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (clearPendingCandidates) {
      pendingCandidatesRef.current = [];
    }
  }, []);

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    syncLocalStream(null);
  }, [syncLocalStream]);

  const stopScreenTracks = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  }, []);

  const resetCallState = useCallback(() => {
    cleanupPeerConnection();
    stopScreenTracks();
    stopLocalTracks();
    syncRemoteStream(null);
    setCaller(null);
    setCallStatus('idle');
  }, [cleanupPeerConnection, stopLocalTracks, stopScreenTracks, syncRemoteStream]);

  const flushPendingCandidates = useCallback(async () => {
    if (!peerRef.current?.remoteDescription?.type) return;

    const pending = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    await Promise.all(
      pending.map((candidate) =>
        peerRef.current?.addIceCandidate(candidate).catch(() => {})
      )
    );
  }, []);

  const createPeerConnection = useCallback((targetUserId, { preservePendingCandidates = false } = {}) => {
    cleanupPeerConnection({ clearPendingCandidates: !preservePendingCandidates });

    console.log('Creating RTCPeerConnection for', targetUserId);
    const peerConnection = new RTCPeerConnection(getIceServers());
    peerRef.current = peerConnection;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      console.log('Received remote track for', targetUserId);
      syncRemoteStream(stream);
      markCallConnected();
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !socket || !targetUserId) return;

      console.log('Emitting local ICE candidate to', targetUserId, event.candidate);
      socket.emit('iceCandidate', {
        to: targetUserId,
        candidate: event.candidate,
        chatId: peerConnection.__chatId,
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('Peer connection state:', state, 'for', targetUserId);

      if (state === 'connected') {
        window.clearTimeout(connectionFailureTimeoutRef.current);
        connectionFailureTimeoutRef.current = null;
        markCallConnected();
        return;
      }

      if (state === 'connecting') {
        setCallStatus((previous) =>
          previous === 'idle' || previous === 'ended' ? previous : 'connecting'
        );
        return;
      }

      if (state === 'disconnected') {
        window.clearTimeout(connectionFailureTimeoutRef.current);
        connectionFailureTimeoutRef.current = window.setTimeout(() => {
          setCallStatus((previous) => (previous === 'idle' || previous === 'ended' ? previous : 'ended'));
        }, 12000);
        return;
      }

      if (['failed', 'closed'].includes(state)) {
        setCallStatus((previous) => (previous === 'idle' ? previous : 'ended'));
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log('ICE connection state:', state, 'for', targetUserId);

      if (state === 'connected' || state === 'completed') {
        window.clearTimeout(connectionFailureTimeoutRef.current);
        connectionFailureTimeoutRef.current = null;
        markCallConnected();
        return;
      }

      if (state === 'checking') {
        setCallStatus((previous) =>
          previous === 'idle' || previous === 'ended' || previous === 'in-call'
            ? previous
            : 'connecting'
        );
        return;
      }

      if (state === 'disconnected') {
        window.clearTimeout(connectionFailureTimeoutRef.current);
        connectionFailureTimeoutRef.current = window.setTimeout(() => {
          setCallStatus((previous) => (previous === 'idle' || previous === 'ended' ? previous : 'ended'));
        }, 12000);
        return;
      }

      if (['failed', 'closed'].includes(state)) {
        setCallStatus((previous) => (previous === 'idle' ? previous : 'ended'));
      }
    };

    return peerConnection;
  }, [cleanupPeerConnection, markCallConnected, socket, syncRemoteStream]);

  useEffect(() => {
    syncLocalPreview(screenStreamRef.current || localStream);
  }, [localStream, syncLocalPreview]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  useEffect(() => {
    setSupportsAudioOutputSelection(
      typeof HTMLMediaElement !== 'undefined'
        && Boolean(HTMLMediaElement.prototype.setSinkId)
    );
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleCallAccepted = async (payload) => {
      console.log('Received callAccepted payload:', payload);
      const signal = payload?.signal || payload;
      if (!signal || !peerRef.current) return;

      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        console.log('Remote description set after callAccepted');
        await flushPendingCandidates();
        setCallStatus('connecting');
      } catch (error) {
        console.error('Error finishing call setup:', error);
        setCallStatus('ended');
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      console.log('Received remote ICE candidate:', candidate);
      if (!candidate) return;

      const nextCandidate = new RTCIceCandidate(candidate);

      if (!peerRef.current) {
        pendingCandidatesRef.current.push(nextCandidate);
        return;
      }

      if (peerRef.current.remoteDescription?.type) {
        await peerRef.current.addIceCandidate(nextCandidate).catch((err) => {
          console.error('Error adding ICE candidate:', err);
        });
        return;
      }

      pendingCandidatesRef.current.push(nextCandidate);
    };

    socket.on('callAccepted', handleCallAccepted);
    socket.on('iceCandidate', handleIceCandidate);

    return () => {
      socket.off('callAccepted', handleCallAccepted);
      socket.off('iceCandidate', handleIceCandidate);
    };
  }, [flushPendingCandidates, socket]);

  const startCall = useCallback(async (targetUserId, callType = 'video', metadata = {}) => {
    try {
      stopLocalTracks();
      syncRemoteStream(null);
      setCaller(null);

      const stream = await getMediaStream(callType);
      syncLocalStream(stream);

      const peerConnection = createPeerConnection(targetUserId);
      peerConnection.__chatId = metadata.chatId;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket?.emit('callUser', {
        userToCall: targetUserId,
        signalData: offer,
        callType,
        from: userId,
        ...metadata,
      });

      setCallStatus('calling');
    } catch (error) {
      resetCallState();
      throw error;
    }
  }, [createPeerConnection, resetCallState, socket, stopLocalTracks, syncLocalStream, syncRemoteStream, userId]);

  const answerCall = useCallback(async (signal, callerId, callType = 'video', metadata = {}) => {
    try {
      stopLocalTracks();
      syncRemoteStream(null);

      const stream = await getMediaStream(callType);
      syncLocalStream(stream);

      const peerConnection = createPeerConnection(callerId, { preservePendingCandidates: true });
      peerConnection.__chatId = metadata.chatId;
      if (Array.isArray(metadata.initialCandidates)) {
        pendingCandidatesRef.current.push(
          ...metadata.initialCandidates
            .filter(Boolean)
            .map((candidate) => new RTCIceCandidate(candidate))
        );
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      await flushPendingCandidates();

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket?.emit('answerCall', {
        to: callerId,
        signal: answer,
        ...metadata,
      });

      setCallStatus('connecting');
      setCaller(null);
    } catch (error) {
      resetCallState();
      throw error;
    }
  }, [createPeerConnection, flushPendingCandidates, resetCallState, socket, stopLocalTracks, syncLocalStream, syncRemoteStream]);

  const declineCall = useCallback((targetUserId, metadata = {}) => {
    if (socket && targetUserId) {
      socket.emit('declineCall', {
        to: targetUserId,
        ...metadata,
      });
    }

    resetCallState();
  }, [resetCallState, socket]);

  const endCall = useCallback((targetUserId, metadata = {}) => {
    if (socket && targetUserId) {
      socket.emit('endCall', {
        to: targetUserId,
        ...metadata,
      });
    }

    resetCallState();
  }, [resetCallState, socket]);

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return;

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    const sender = peerRef.current?.getSenders().find((entry) => entry.track?.kind === 'video');

    if (sender && cameraTrack) {
      await sender.replaceTrack(cameraTrack);
    }

    stopScreenTracks();
    syncLocalPreview(localStreamRef.current);
  }, [stopScreenTracks, syncLocalPreview]);

  const startScreenShare = useCallback(async () => {
    if (!peerRef.current) {
      throw new Error('Start a video call before sharing your screen.');
    }

    if (!window.isSecureContext) {
      throw new Error('Screen sharing needs HTTPS, or open the app on localhost.');
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing is not available in this browser. Most phone browsers do not allow websites to share the screen.');
    }

    const sender = peerRef.current.getSenders().find((entry) => entry.track?.kind === 'video');
    if (!sender) {
      throw new Error('Screen sharing is available after starting a video call.');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('No screen video track was selected.');
    }

    if (screenStreamRef.current) {
      stopScreenTracks();
    }

    await sender.replaceTrack(videoTrack);
    screenStreamRef.current = stream;
    setIsScreenSharing(true);
    syncLocalPreview(stream);

    videoTrack.onended = () => {
      void stopScreenShare();
    };
  }, [stopScreenShare, stopScreenTracks, syncLocalPreview]);

  return {
    localStream,
    remoteStream,
    callStatus,
    caller,
    isScreenSharing,
    isAudioEnabled,
    isVideoEnabled,
    audioOutputMode,
    supportsAudioOutputSelection,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    declineCall,
    endCall,
    startScreenShare,
    stopScreenShare,
    toggleLocalAudio,
    toggleLocalVideo,
    setAudioOutputMode,
    resetCallState,
    setCallStatus,
    setCaller,
  };
};
