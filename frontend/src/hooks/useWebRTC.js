import { useCallback, useEffect, useRef, useState } from 'react';

const getIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  if (process.env.REACT_APP_TURN_URL) {
    servers.push({
      urls: process.env.REACT_APP_TURN_URL,
      username: process.env.REACT_APP_TURN_USERNAME,
      credential: process.env.REACT_APP_TURN_CREDENTIAL,
    });
  }

  return { iceServers: servers };
};

const getMediaConstraints = (callType = 'video') => ({
  video: callType === 'video',
  audio: true,
});
const getMediaStream = async (callType) => {
  if (!window.isSecureContext) {
    throw new Error('Camera and microphone need HTTPS, or open the app on localhost.');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not available in this browser.');
  }

  return navigator.mediaDevices.getUserMedia(getMediaConstraints(callType));
};

export const useWebRTC = (socket, userId) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [caller, setCaller] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const syncLocalPreview = useCallback((stream) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const syncLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
    syncLocalPreview(screenStreamRef.current || stream);
  }, [syncLocalPreview]);

  const syncRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const markCallConnected = useCallback(() => {
    setCallStatus((previous) =>
      previous === 'idle' || previous === 'ended' ? previous : 'in-call'
    );
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.oniceconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    pendingCandidatesRef.current = [];
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

  const createPeerConnection = useCallback((targetUserId) => {
    cleanupPeerConnection();

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
        markCallConnected();
        return;
      }

      if (state === 'connecting') {
        setCallStatus((previous) =>
          previous === 'idle' || previous === 'ended' ? previous : 'connecting'
        );
        return;
      }

      if (['failed', 'disconnected', 'closed'].includes(state)) {
        setCallStatus((previous) => (previous === 'idle' ? previous : 'ended'));
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log('ICE connection state:', state, 'for', targetUserId);

      if (state === 'connected' || state === 'completed') {
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

      const peerConnection = createPeerConnection(callerId);
      peerConnection.__chatId = metadata.chatId;
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
      throw new Error('Screen sharing is not available in this browser.');
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
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    declineCall,
    endCall,
    startScreenShare,
    stopScreenShare,
    resetCallState,
    setCallStatus,
    setCaller,
  };
};
