import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';
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

export const useGroupCall = (socket, userId) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peersRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());

  const syncRemoteParticipants = useCallback(() => {
    setRemoteParticipants(
      [...remoteStreamsRef.current.entries()].map(([participantId, stream]) => ({
        participantId,
        stream,
      }))
    );
  }, []);

  const syncLocalStream = useCallback((stream) => {
    localStreamRef.current = stream;
    setLocalStream(stream);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream || null;
    }
  }, []);

  const removeRemoteParticipant = useCallback((participantId) => {
    remoteStreamsRef.current.delete(normalizeId(participantId));
    syncRemoteParticipants();
  }, [syncRemoteParticipants]);

  const syncRemoteParticipant = useCallback((participantId, stream) => {
    if (!stream) return;

    remoteStreamsRef.current.set(normalizeId(participantId), stream);
    syncRemoteParticipants();
  }, [syncRemoteParticipants]);

  const closePeerConnection = useCallback((participantId) => {
    const normalizedParticipantId = normalizeId(participantId);
    const peerConnection = peersRef.current.get(normalizedParticipantId);

    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peersRef.current.delete(normalizedParticipantId);
    }

    pendingCandidatesRef.current.delete(normalizedParticipantId);
    removeRemoteParticipant(normalizedParticipantId);
  }, [removeRemoteParticipant]);

  const closeAllPeerConnections = useCallback(() => {
    [...peersRef.current.keys()].forEach((participantId) => {
      closePeerConnection(participantId);
    });
    peersRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setRemoteParticipants([]);
  }, [closePeerConnection]);

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    syncLocalStream(null);
  }, [syncLocalStream]);

  const resetGroupCallState = useCallback(() => {
    closeAllPeerConnections();
    stopLocalTracks();
    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus('idle');
  }, [closeAllPeerConnections, stopLocalTracks]);

  const prepareLocalStream = useCallback(async (callType) => {
    closeAllPeerConnections();
    stopLocalTracks();

    const stream = await getMediaStream(callType);
    syncLocalStream(stream);
    return stream;
  }, [closeAllPeerConnections, stopLocalTracks, syncLocalStream]);

  const flushPendingCandidates = useCallback(async (participantId) => {
    const normalizedParticipantId = normalizeId(participantId);
    const peerConnection = peersRef.current.get(normalizedParticipantId);

    if (!peerConnection?.remoteDescription?.type) return;

    const pendingCandidates = pendingCandidatesRef.current.get(normalizedParticipantId) || [];
    pendingCandidatesRef.current.set(normalizedParticipantId, []);

    await Promise.all(
      pendingCandidates.map((candidate) => peerConnection.addIceCandidate(candidate).catch(() => {}))
    );
  }, []);

  const ensurePeerConnection = useCallback((participantId, chatId) => {
    const normalizedParticipantId = normalizeId(participantId);
    if (!normalizedParticipantId) return null;

    const existingPeer = peersRef.current.get(normalizedParticipantId);
    if (existingPeer) return existingPeer;

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(normalizedParticipantId, peerConnection);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      syncRemoteParticipant(normalizedParticipantId, stream);
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;

      socket.emit('groupCallSignal', {
        chatId,
        to: normalizedParticipantId,
        candidate: event.candidate,
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const { connectionState } = peerConnection;

      if (connectionState === 'connected') {
        setCallStatus('in-call');
        return;
      }

      if (connectionState === 'connecting') {
        setCallStatus((previous) => (previous === 'in-call' ? previous : 'connecting'));
        return;
      }

      if (['failed', 'disconnected', 'closed'].includes(connectionState)) {
        closePeerConnection(normalizedParticipantId);
        setCallStatus((previous) => {
          if (!activeCall) return previous;
          return remoteStreamsRef.current.size ? previous : 'connecting';
        });
      }
    };

    return peerConnection;
  }, [activeCall, closePeerConnection, socket, syncRemoteParticipant]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleGroupCallInvite = ({ chatId, callType, from, initiatorId }) => {
      if (normalizeId(from) === normalizeId(userId)) return;

      setIncomingCall({
        chatId,
        callType,
        from,
        initiatorId: initiatorId || from,
      });
      setCallStatus('incoming');
    };

    const handleGroupCallPeerJoined = async ({ chatId, participantId, shouldCreateOffer, callType }) => {
      if (normalizeId(participantId) === normalizeId(userId)) return;

      setActiveCall((previous) =>
        previous && normalizeId(previous.chatId) === normalizeId(chatId)
          ? previous
          : {
              chatId,
              callType,
              initiatorId: previous?.initiatorId || userId,
            }
      );

      const peerConnection = ensurePeerConnection(participantId, chatId);
      if (!peerConnection || !shouldCreateOffer) return;

      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('groupCallSignal', {
          chatId,
          to: participantId,
          description: offer,
          callType,
        });
        setCallStatus((previous) => (previous === 'in-call' ? previous : 'connecting'));
      } catch (error) {
        console.error('Failed to create group call offer:', error);
      }
    };

    const handleGroupCallSignal = async ({ chatId, from, description, candidate, callType }) => {
      const normalizedFrom = normalizeId(from);
      if (!normalizedFrom || normalizedFrom === normalizeId(userId)) return;

      try {
        const peerConnection = ensurePeerConnection(normalizedFrom, chatId);
        if (!peerConnection) return;

        if (description) {
          if (description.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
            await flushPendingCandidates(normalizedFrom);

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit('groupCallSignal', {
              chatId,
              to: normalizedFrom,
              description: answer,
              callType,
            });
            setCallStatus((previous) => (previous === 'in-call' ? previous : 'connecting'));
            return;
          }

          if (description.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
            await flushPendingCandidates(normalizedFrom);
            setCallStatus((previous) => (previous === 'in-call' ? previous : 'connecting'));
            return;
          }
        }

        if (candidate) {
          const nextCandidate = new RTCIceCandidate(candidate);

          if (peerConnection.remoteDescription?.type) {
            await peerConnection.addIceCandidate(nextCandidate).catch(() => {});
            return;
          }

          const pendingCandidates = pendingCandidatesRef.current.get(normalizedFrom) || [];
          pendingCandidatesRef.current.set(normalizedFrom, [...pendingCandidates, nextCandidate]);
        }
      } catch (error) {
        console.error('Failed to process group call signal:', error);
      }
    };

    const handleGroupCallUserLeft = ({ participantId }) => {
      if (!participantId) return;

      closePeerConnection(participantId);
      if (!remoteStreamsRef.current.size) {
        setCallStatus((previous) => (previous === 'in-call' ? 'connecting' : previous));
      }
    };

    const handleGroupCallEnded = ({ chatId }) => {
      if (activeCall && normalizeId(chatId) !== normalizeId(activeCall.chatId)) return;
      if (!activeCall && incomingCall && normalizeId(chatId) !== normalizeId(incomingCall.chatId)) return;

      setIncomingCall(null);
      setCallStatus('ended');
    };

    const handleGroupCallBusy = ({ chatId }) => {
      if (activeCall && normalizeId(chatId) !== normalizeId(activeCall.chatId)) return;
      setCallStatus('ended');
    };

    socket.on('groupCallInvite', handleGroupCallInvite);
    socket.on('groupCallPeerJoined', handleGroupCallPeerJoined);
    socket.on('groupCallSignal', handleGroupCallSignal);
    socket.on('groupCallUserLeft', handleGroupCallUserLeft);
    socket.on('groupCallEnded', handleGroupCallEnded);
    socket.on('groupCallBusy', handleGroupCallBusy);

    return () => {
      socket.off('groupCallInvite', handleGroupCallInvite);
      socket.off('groupCallPeerJoined', handleGroupCallPeerJoined);
      socket.off('groupCallSignal', handleGroupCallSignal);
      socket.off('groupCallUserLeft', handleGroupCallUserLeft);
      socket.off('groupCallEnded', handleGroupCallEnded);
      socket.off('groupCallBusy', handleGroupCallBusy);
    };
  }, [activeCall, closePeerConnection, ensurePeerConnection, flushPendingCandidates, incomingCall, socket, userId]);

  const startGroupCall = useCallback(async (chatId, participantIds, callType = 'video') => {
    await prepareLocalStream(callType);
    setIncomingCall(null);
    setActiveCall({
      chatId,
      callType,
      initiatorId: userId,
    });
    setCallStatus('calling');

    socket?.emit('startGroupCall', {
      chatId,
      callType,
      participantIds,
    });
  }, [prepareLocalStream, socket, userId]);

  const answerGroupCall = useCallback(async (callInfo) => {
    if (!callInfo?.chatId) return;

    await prepareLocalStream(callInfo.callType);
    setIncomingCall(null);
    setActiveCall({
      chatId: callInfo.chatId,
      callType: callInfo.callType,
      initiatorId: callInfo.initiatorId || callInfo.from,
    });
    setCallStatus('connecting');

    socket?.emit('joinGroupCall', {
      chatId: callInfo.chatId,
    });
  }, [prepareLocalStream, socket]);

  const declineGroupCall = useCallback((callInfo) => {
    if (socket && callInfo?.chatId) {
      socket.emit('declineGroupCall', {
        chatId: callInfo.chatId,
        to: callInfo.from,
      });
    }

    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus('idle');
  }, [socket]);

  const leaveGroupCall = useCallback((chatId) => {
    if (socket && chatId) {
      socket.emit('leaveGroupCall', { chatId });
    }

    resetGroupCallState();
  }, [resetGroupCallState, socket]);

  const endGroupCall = useCallback((chatId) => {
    if (socket && chatId) {
      socket.emit('endGroupCall', { chatId });
    }

    resetGroupCallState();
  }, [resetGroupCallState, socket]);

  return {
    localStream,
    localVideoRef,
    remoteParticipants,
    incomingCall,
    activeCall,
    callStatus,
    startGroupCall,
    answerGroupCall,
    declineGroupCall,
    leaveGroupCall,
    endGroupCall,
    resetGroupCallState,
    setCallStatus,
  };
};
