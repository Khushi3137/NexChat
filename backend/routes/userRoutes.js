const express = require('express');
const router = express.Router();
const {
  searchUsers,
  getBlockedUsers,
  getUserAnalytics,
  updateProfile,
  updateNotificationPreferences,
  updatePrivacySettings,
  updateContactAlias,
  addContact,
  uploadAvatar,
  removeAvatar,
  blockUser,
  unblockUser,
} = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const { upload, requireCloudinaryConfig } = require('../utils/cloudinary');

router.get('/', auth, searchUsers);
router.get('/blocked', auth, getBlockedUsers);
router.get('/analytics', auth, getUserAnalytics);
router.put('/profile', auth, updateProfile);
router.put('/notifications', auth, updateNotificationPreferences);
router.put('/privacy', auth, updatePrivacySettings);
router.put('/contact-alias/:id', auth, updateContactAlias);
router.put('/contact/:id', auth, addContact);
router.post('/upload-avatar', auth, requireCloudinaryConfig, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', auth, removeAvatar);
router.put('/block/:id', auth, blockUser);
router.delete('/block/:id', auth, unblockUser);

module.exports = router;
