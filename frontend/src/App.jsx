import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import { useSocketEvents } from './hooks/useSocket';
import { useChat } from './context/ChatContext';
import { useSocket } from './context/SocketContext';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import Home from './pages/Home';
import ChatPage from './pages/ChatPage';
import SharedFilesPage from './pages/SharedFilesPage';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ReferencePreview from './pages/ReferencePreview';
import LandingPage from './pages/LandingPage';
import { useAuth } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/chat/:chatId/shared" element={<PrivateRoute><SharedFilesPage /></PrivateRoute>} />
      <Route path="/chat/:chatId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/design-reference" element={<ReferencePreview />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const SocketEventListener = () => {
  useSocketEvents();
  return null;
};

const GlobalIncomingCallPrompt = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { pendingIncomingCall, setPendingIncomingCall } = useChat();

  if (!pendingIncomingCall) return null;

  const isVideoCall = pendingIncomingCall.callType === 'video';

  const handleAnswer = () => {
    navigate(`/chat/${pendingIncomingCall.chatId}`);
  };

  const handleDecline = () => {
    if (pendingIncomingCall.from) {
      socket?.emit('declineCall', {
        to: pendingIncomingCall.from,
        chatId: pendingIncomingCall.chatId,
        reason: 'declined',
      });
    }

    setPendingIncomingCall(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/88 p-4 text-white backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[28px] border border-white/12 bg-[#10111b] p-6 text-center shadow-[0_34px_90px_rgba(0,0,0,0.62)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#6affe8]/24 bg-[#6affe8]/12 text-2xl">
          {isVideoCall ? 'VC' : 'AC'}
        </div>
        <div className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#6affe8]">
          Incoming {isVideoCall ? 'video' : 'voice'} call
        </div>
        <div className="mt-2 text-2xl font-semibold">NexChat Call</div>
        <p className="mt-3 text-sm leading-6 text-white/58">
          Open the conversation to answer this call.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-2xl border border-[#ff8ca8]/24 bg-[#ff8ca8]/10 px-4 py-3 text-sm font-semibold text-[#ffd1df] transition hover:bg-[#ff8ca8]/16 hover:text-white"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAnswer}
            className="rounded-2xl border border-[#6affe8]/24 bg-[#6affe8]/14 px-4 py-3 text-sm font-semibold text-[#aef9ff] transition hover:bg-[#6affe8]/20 hover:text-white"
          >
            Answer
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <Router>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#14141f',
                  color: '#f5f3ee',
                  border: '1px solid rgba(255, 77, 28, 0.18)',
                },
              }}
            />
            <SocketEventListener />
            <GlobalIncomingCallPrompt />
            <AppRoutes />
          </Router>
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
