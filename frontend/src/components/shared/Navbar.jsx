import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from './Avatar';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <Link to="/app" className="text-xl font-bold text-purple-400">Nexus Chat</Link>
      <div className="flex items-center gap-4">
        <Link to="/analytics" className="text-gray-400 hover:text-white text-sm transition">Analytics</Link>
        <Link to="/settings" className="text-gray-400 hover:text-white text-sm transition">Settings</Link>
        <div className="flex items-center gap-2">
          <Avatar src={user?.profilePicture} name={user?.name} size={8} />
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 text-sm transition">Logout</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
