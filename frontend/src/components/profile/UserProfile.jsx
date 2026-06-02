import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadService } from '../../services/uploadService';
import Avatar from '../shared/Avatar';
import Modal from '../shared/Modal';
import api from '../../services/api';
import toast from 'react-hot-toast';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const avatarInputId = 'profile-avatar-input';

  useEffect(() => {
    setName(user?.name || '');
    setBio(user?.bio || '');
  }, [user?.name, user?.bio]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const isProfileDirty = name !== (user?.name || '') || bio !== (user?.bio || '');
  const displayAvatar = avatarPreviewUrl || user?.profilePicture || '';
  const hasDisplayAvatar = Boolean(displayAvatar);

  const handleReset = () => {
    setName(user?.name || '');
    setBio(user?.bio || '');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put('/users/profile', { name: name.trim(), bio: bio.trim() });
      updateUser(data);
      toast.success('Profile updated!');
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      e.target.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(previewUrl);
    setAvatarBusy(true);
    try {
      const data = await uploadService.uploadAvatar(file);
      updateUser(data);
      setAvatarPreviewUrl('');
      toast.success('Avatar updated!');
    } catch (error) {
      setAvatarPreviewUrl('');
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
    }
    finally {
      setAvatarBusy(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.profilePicture) return;

    setAvatarBusy(true);
    try {
      const data = await uploadService.removeAvatar();
      updateUser(data);
      setAvatarPreviewUrl('');
      toast.success('Avatar removed!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove avatar');
    }
    finally { setAvatarBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <p className="text-sm font-semibold text-white">Profile Photo</p>
        <p className="mt-1 text-xs text-gray-400">Change or remove your profile picture any time.</p>

        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setIsAvatarViewerOpen(true)}
            className="group relative"
          >
            <Avatar src={displayAvatar} name={user?.name} size={20} />
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition group-hover:opacity-100">
              <span className="text-xs font-medium text-white">{hasDisplayAvatar ? 'View' : 'Open'}</span>
            </div>
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsAvatarViewerOpen(true)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white"
            >
              View Photo
            </button>
            <label
              htmlFor={avatarInputId}
              className={`rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 ${
                avatarBusy ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }`}
            >
              {avatarBusy ? 'Working...' : 'Change Photo'}
            </label>
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={avatarBusy || !user?.profilePicture}
              className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove Photo
            </button>
          </div>
          <input
            id={avatarInputId}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleAvatarChange}
          />
        </div>

        <p className="mt-3 text-xs text-gray-400">
          {avatarBusy && avatarPreviewUrl
            ? 'Uploading your new profile photo. You can already open and view the preview.'
            : 'Click the avatar or the View Photo button to open it larger.'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Edit Profile</p>
          <p className="mt-1 text-xs text-gray-400">Update your basic details here.</p>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Email</label>
          <input value={user?.email} readOnly
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-gray-400 text-sm cursor-not-allowed" />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={!isProfileDirty || saving}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 py-2.5 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isProfileDirty}
          className="flex-1 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <Modal
        isOpen={isAvatarViewerOpen}
        onClose={() => setIsAvatarViewerOpen(false)}
        title="Profile Photo"
        maxWidthClass="max-w-2xl"
        panelClassName="border-gray-800 bg-[#101018]"
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#08080f] p-3">
            {hasDisplayAvatar ? (
              <img
                src={displayAvatar}
                alt={`${user?.name || 'User'} profile`}
                className="mx-auto max-h-[70vh] w-full rounded-[18px] object-contain"
              />
            ) : (
              <div className="flex min-h-[320px] items-center justify-center">
                <Avatar src="" name={user?.name} size={28} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={avatarInputId}
              className={`rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 ${
                avatarBusy ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }`}
            >
              {avatarBusy ? 'Uploading...' : hasDisplayAvatar ? 'Change Photo' : 'Upload Photo'}
            </label>
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={avatarBusy || (!user?.profilePicture && !avatarPreviewUrl)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-red-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove Photo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserProfile;
