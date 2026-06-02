import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import { useSocketEvents } from './hooks/useSocket';
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

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <SocketEventListener />
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
            <AppRoutes />
          </Router>
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
