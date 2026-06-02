const express = require('express');
const router = express.Router();
const {
  createOrGetChat,
  createOrGetAIChat,
  getUserChats,
  getChatById,
  deleteChat,
  muteChat,
  unmuteChat,
  respondToChatRequest,
} = require('../controllers/chatController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, createOrGetChat);
router.post('/ai', auth, createOrGetAIChat);
router.get('/', auth, getUserChats);
router.put('/:id/request', auth, respondToChatRequest);
router.get('/:id', auth, getChatById);
router.delete('/:id', auth, deleteChat);
router.put('/:id/mute', auth, muteChat);
router.delete('/:id/mute', auth, unmuteChat);

module.exports = router;
