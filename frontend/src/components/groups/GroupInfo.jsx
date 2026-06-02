import React, { useState } from 'react';
import Avatar from '../shared/Avatar';
import api from '../../services/api';
import toast from 'react-hot-toast';

const GroupInfo = ({ chat, currentUserId, onClose }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const isAdmin = chat.admins?.includes(currentUserId);

  const searchUsers = async (q) => {
    setSearch(q);
    if (!q.trim()) return setResults([]);
    const { data } = await api.get(`/users?search=${q}`);
    setResults(data);
  };

  const addMember = async (userId) => {
    try {
      await api.put(`/groups/${chat._id}/add`, { userId });
      toast.success('Member added');
      setSearch(''); setResults([]);
    } catch { toast.error('Failed to add member'); }
  };

  const removeMember = async (userId) => {
    try {
      await api.put(`/groups/${chat._id}/remove`, { userId });
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
  };

  const promote = async (userId) => {
    try {
      await api.put(`/groups/${chat._id}/promote`, { userId });
      toast.success('Promoted to admin');
    } catch { toast.error('Failed to promote'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar src={chat.groupPicture} name={chat.chatName} size={12} />
        <div>
          <p className="text-white font-semibold">{chat.chatName}</p>
          <p className="text-gray-400 text-xs">{chat.participants?.length} members</p>
        </div>
      </div>

      {chat.groupDescription && (
        <p className="text-gray-400 text-sm">{chat.groupDescription}</p>
      )}

      <div>
        <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wide">Members</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {chat.participants?.map(p => (
            <div key={p._id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800">
              <div className="flex items-center gap-2">
                <Avatar src={p.profilePicture} name={p.name} size={7} />
                <span className="text-white text-sm">{p.name}</span>
                {chat.admins?.includes(p._id) && <span className="text-xs text-purple-400 bg-purple-900/30 px-1.5 rounded">Admin</span>}
              </div>
              {isAdmin && p._id !== currentUserId && (
                <div className="flex gap-1">
                  <button onClick={() => promote(p._id)} className="text-xs text-yellow-400 hover:underline">Promote</button>
                  <button onClick={() => removeMember(p._id)} className="text-xs text-red-400 hover:underline ml-2">Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div>
          <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wide">Add Member</p>
          <input value={search} onChange={e => searchUsers(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
          {results.map(u => (
            <button key={u._id} onClick={() => addMember(u._id)}
              className="w-full flex items-center gap-2 px-2 py-2 hover:bg-gray-800 rounded-lg mt-1 text-sm text-white">
              <Avatar src={u.profilePicture} name={u.name} size={7} />
              {u.name}
              <span className="ml-auto text-purple-400 text-xs">+ Add</span>
            </button>
          ))}
        </div>
      )}

      <button onClick={onClose} className="w-full py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm transition">Close</button>
    </div>
  );
};

export default GroupInfo;
