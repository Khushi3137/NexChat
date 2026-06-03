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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peersRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());

  const syncLocalPreview = useCallback((stream) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream || null;
    }
  }, []);

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
    syncLocalPreview(screenStreamRef.current || stream);
  }, [syncLocalPreview]);

  const markGroupCallConnected = useCallback(() => {
    setCallStatus((previous) =>
      previous === 'idle' || previous === 'ended' ? previous : 'in-call'
    );
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
      peerConnection.oniceconnectionstatechange = null;
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

  const stopScreenTracks = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  }, []);

  const resetGroupCallState = useCallback(() => {
    closeAllPeerConnections();
    stopScreenTracks();
    stopLocalTracks();
    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus('idle');
  }, [closeAllPeerConnections, stopLocalTracks, stopScreenTracks]);

  const prepareLocalStream = useCallback(async (callType) => {
    closeAllPeerConnections();
    stopScreenTracks();
    stopLocalTracks();

    const stream = await getMediaStream(callType);
    syncLocalStream(stream);
    return stream;
  }, [closeAllPeerConnections, stopLocalTracks, stopScreenTracks, syncLocalStream]);

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

      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
      if (screenTrack) {
        const videoSender = peerConnection.getSenders().find((sender) => sender.track?.kind === 'video');
        videoSender?.replaceTrack(screenTrack).catch(() => {});
      }
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      syncRemoteParticipant(normalizedParticipantId, stream);
      markGroupCallConnected();
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
        markGroupCallConnected();
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

    peerConnection.oniceconnectionstatechange = () => {
      const { iceConnectionState } = peerConnection;

      if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
        markGroupCallConnected();
        return;
      }

      if (iceConnectionState === 'checking') {
        setCallStatus((previous) =>
          previous === 'in-call' || previous === 'idle' || previous === 'ended'
            ? previous
            : 'connecting'
        );
        return;
      }

      if (['failed', 'closed'].includes(iceConnectionState)) {
        closePeerConnection(normalizedParticipantId);
        setCallStatus((previous) => {
          if (!activeCall) return previous;
          return remoteStreamsRef.current.size ? previous : 'connecting';
        });
      }
    };

    return peerConnection;
  }, [activeCall, closePeerConnection, markGroupCallConnected, socket, syncRemoteParticipant]);

  useEffect(() => {
    syncLocalPreview(screenStreamRef.current || localStream);
  }, [localStream, syncLocalPreview]);

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

  const inviteGroupCallMembers = useCallback((chatId, participantIds = []) => {
    if (!socket || !chatId) return;

    socket.emit('inviteGroupCallMembers', {
      chatId,
      participantIds,
    });
  }, [socket]);

  const replaceVideoTrackForPeers = useCallback(async (videoTrack) => {
    const replacements = [...peersRef.current.values()].map((peerConnection) => {
      const sender = peerConnection.getSenders().find((entry) => entry.track?.kind === 'video');
      return sender?.replaceTrack(videoTrack);
    });

    await Promise.all(replacements.filter(Boolean));
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return;

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    if (cameraTrack) {
      await replaceVideoTrackForPeers(cameraTrack);
    }

    stopScreenTracks();
    syncLocalPreview(localStreamRef.current);
  }, [replaceVideoTrackForPeers, stopScreenTracks, syncLocalPreview]);

  const startScreenShare = useCallback(async () => {
    if (!localStreamRef.current?.getVideoTracks().length) {
      throw new Error('Start a video group call before sharing your screen.');
    }

    if (!window.isSecureContext) {
      throw new Error('Screen sharing needs HTTPS, or open the app on localhost.');
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing is not available in this browser.');
    }

    const hasMissingVideoSender = [...peersRef.current.values()].some((peerConnection) =>
      !peerConnection.getSenders().some((entry) => entry.track?.kind === 'video')
    );

    if (hasMissingVideoSender) {
      throw new Error('Screen sharing is available after starting a video group call.');
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

    await replaceVideoTrackForPeers(videoTrack);
    screenStreamRef.current = stream;
    setIsScreenSharing(true);
    syncLocalPreview(stream);

    videoTrack.onended = () => {
      void stopScreenShare();
    };
  }, [replaceVideoTrackForPeers, stopScreenShare, stopScreenTracks, syncLocalPreview]);

  return {
    localStream,
    localVideoRef,
    remoteParticipants,
    incomingCall,
    activeCall,
    callStatus,
    isScreenSharing,
    startGroupCall,
    answerGroupCall,
    declineGroupCall,
    leaveGroupCall,
    endGroupCall,
    inviteGroupCallMembers,
    startScreenShare,
    stopScreenShare,
    resetGroupCallState,
    setCallStatus,
  };
};
