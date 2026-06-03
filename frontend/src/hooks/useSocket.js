import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';
import { useNotification } from './useNotification';

const CALL_RESPONSE_TIMEOUT_MS = 60000;
const normalizeId = (value) => (typeof value === 'object' ? value?._id : value)?.toString?.() || '';

export const useSocketEvents = () => {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify, playNotificationSound } = useNotification();
  const { addMessage, updateMessageStatus, setTyping, setPendingIncomingCall } = useChat();

  useEffect(() => {
    if (!socket) return;

    const receiveMessageHandler = (message) => {
      addMessage(message);
    };

    const messageStatusHandler = ({ messageId, status }) => {
      updateMessageStatus(messageId, status);
    };

    const userTypingHandler = ({ userId, userName, chatId }) => {
      setTyping(chatId, userId, userName, true);
    };

    const userStopTypingHandler = ({ userId, chatId }) => {
      setTyping(chatId, userId, null, false);
    };

    const incomingCallHandler = ({ signal, from, callType = 'video', chatId }) => {
      const callChatId = normalizeId(chatId);
      if (!callChatId) return;

      const activeChatId = location.pathname.match(/^\/chat\/([^/]+)/)?.[1] || '';
      if (normalizeId(activeChatId) === callChatId) return;

      const receivedAt = Date.now();
      setPendingIncomingCall({
        signal,
        from,
        callType,
        chatId: callChatId,
        receivedAt,
        candidates: [],
      });
      playNotificationSound();
      notify(
        `Incoming ${callType === 'video' ? 'video' : 'voice'} call`,
        'Open NexChat to answer the call.'
      );

      toast.custom(
        (toastInstance) => (
          <div className="max-w-sm rounded-2xl border border-[#6affe8]/20 bg-[#11111d] px-4 py-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <div className="text-sm font-semibold">
              Incoming {callType === 'video' ? 'video' : 'voice'} call
            </div>
            <div className="mt-1 text-xs text-white/55">
              Open the conversation to answer this call.
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => toast.dismiss(toastInstance.id)}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/8 hover:text-white"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(toastInstance.id);
                  navigate(`/chat/${callChatId}`);
                }}
                className="rounded-xl border border-[#6affe8]/24 bg-[#6affe8]/12 px-3 py-1.5 text-xs font-semibold text-[#aef9ff] transition hover:bg-[#6affe8]/18 hover:text-white"
              >
                Open
              </button>
            </div>
          </div>
        ),
        { duration: CALL_RESPONSE_TIMEOUT_MS }
      );

      window.setTimeout(() => {
        setPendingIncomingCall((previous) =>
          previous?.receivedAt === receivedAt ? null : previous
        );
      }, CALL_RESPONSE_TIMEOUT_MS);
    };

    const iceCandidateHandler = ({ candidate, from, chatId }) => {
      if (!candidate || !from) return;

      setPendingIncomingCall((previous) => {
        if (!previous) return previous;
        if (normalizeId(previous.from) !== normalizeId(from)) return previous;
        if (chatId && normalizeId(previous.chatId) !== normalizeId(chatId)) return previous;

        return {
          ...previous,
          candidates: [...(previous.candidates || []), candidate],
        };
      });
    };

    socket.on('receiveMessage', receiveMessageHandler);
    socket.on('messageStatusUpdate', messageStatusHandler);
    socket.on('userTyping', userTypingHandler);
    socket.on('userStopTyping', userStopTypingHandler);
    socket.on('incomingCall', incomingCallHandler);
    socket.on('iceCandidate', iceCandidateHandler);

    return () => {
      socket.off('receiveMessage', receiveMessageHandler);
      socket.off('messageStatusUpdate', messageStatusHandler);
      socket.off('userTyping', userTypingHandler);
      socket.off('userStopTyping', userStopTypingHandler);
      socket.off('incomingCall', incomingCallHandler);
      socket.off('iceCandidate', iceCandidateHandler);
    };
  }, [addMessage, location.pathname, navigate, notify, playNotificationSound, setPendingIncomingCall, setTyping, socket, updateMessageStatus]);
};
