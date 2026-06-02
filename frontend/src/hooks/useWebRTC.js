import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const syncLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const syncRemoteStream = useCallback((stream) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    pendingCandidatesRef.current = [];
  }, []);

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    syncLocalStream(null);
  }, [syncLocalStream]);

  const resetCallState = useCallback(() => {
    cleanupPeerConnection();
    stopLocalTracks();
    syncRemoteStream(null);
    setCaller(null);
    setCallStatus('idle');
  }, [cleanupPeerConnection, stopLocalTracks, syncRemoteStream]);

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

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peerConnection;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      syncRemoteStream(stream);
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !socket || !targetUserId) return;

      socket.emit('iceCandidate', {
        to: targetUserId,
        candidate: event.candidate,
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === 'connected') {
        setCallStatus('in-call');
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

    return peerConnection;
  }, [cleanupPeerConnection, socket, syncRemoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleCallAccepted = async (payload) => {
      const signal = payload?.signal || payload;
      if (!signal || !peerRef.current) return;

      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        await flushPendingCandidates();
        setCallStatus('connecting');
      } catch (error) {
        console.error('Error finishing call setup:', error);
        setCallStatus('ended');
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate || !peerRef.current) return;

      const nextCandidate = new RTCIceCandidate(candidate);

      if (peerRef.current.remoteDescription?.type) {
        await peerRef.current.addIceCandidate(nextCandidate).catch(() => {});
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

  const startScreenShare = useCallback(async () => {
    if (!peerRef.current) return;

    if (!window.isSecureContext) {
      throw new Error('Screen sharing needs HTTPS, or open the app on localhost.');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const videoTrack = stream.getVideoTracks()[0];
    const sender = peerRef.current.getSenders().find((entry) => entry.track?.kind === 'video');
    sender?.replaceTrack(videoTrack);
    videoTrack.onended = () => {
      stopScreenShare().catch(() => {});
    };
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!peerRef.current || !localStreamRef.current) return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const sender = peerRef.current.getSenders().find((entry) => entry.track?.kind === 'video');
    await sender?.replaceTrack(videoTrack);
  }, []);

  return {
    localStream,
    remoteStream,
    callStatus,
    caller,
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
