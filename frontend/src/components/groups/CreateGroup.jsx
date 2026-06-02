import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const CreateGroup = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setUsers([]);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users?search=${encodeURIComponent(search.trim())}`);
        setUsers(data);
      } catch {
        setUsers([]);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [search]);

  const toggle = (user) => {
    setSelected((previous) =>
      previous.find((entry) => entry._id === user._id)
        ? previous.filter((entry) => entry._id !== user._id)
        : [...previous, user]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Group name required');

    let members = selected;
    const typedMember = search.trim().toLowerCase();

    if (!members.length && typedMember) {
      const exactMatch = users.find((user) => user.email?.toLowerCase() === typedMember);

      if (exactMatch) {
        members = [exactMatch];
        setSelected([exactMatch]);
      } else {
        try {
          const { data } = await api.get(`/users?search=${encodeURIComponent(search.trim())}`);
          const fetchedMatch = data.find((user) => user.email?.toLowerCase() === typedMember);

          if (fetchedMatch) {
            members = [fetchedMatch];
            setSelected([fetchedMatch]);
          }
        } catch {
          members = [];
        }
      }
    }

    if (members.length < 1) return toast.error('Select a user from the list or enter their exact email');

    setLoading(true);

    try {
      const { data } = await api.post('/groups', {
        chatName: name,
        participants: members.map((entry) => entry._id),
        groupDescription: description,
      });

      toast.success(data.message || 'Group created!');
      onCreated(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Group name *"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
      />
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
      />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search users to invite..."
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
      />

      {users.length > 0 ? (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800">
          {users.map((entry) => {
            const isSelected = selected.some((item) => item._id === entry._id);

            return (
              <button
                key={entry._id}
                type="button"
                onClick={() => toggle(entry)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-gray-700 ${
                  isSelected ? 'text-purple-400' : 'text-white'
                }`}
              >
                <span>{isSelected ? 'Selected' : 'Select'}</span>
                <span className="text-left">
                  <span className="block">{entry.name}</span>
                  <span className="block text-xs text-gray-400">{entry.email}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((entry) => (
            <span
              key={entry._id}
              className="flex items-center gap-1 rounded-full bg-purple-700 px-2 py-1 text-xs text-white"
            >
              {entry.name}
              <button type="button" onClick={() => toggle(entry)} className="hover:text-red-300">
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 transition hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="flex-1 rounded-lg bg-purple-600 py-2 text-sm text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </div>
  );
};

export default CreateGroup;
