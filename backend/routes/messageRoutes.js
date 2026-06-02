const express = require('express');
const router = express.Router();
const {
  getMessages,
  getScheduledMessages,
  cancelScheduledMessage,
  clearChatMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  searchMessages,
  pinMessage,
  unpinMessage,
  votePoll,
} = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');
const { upload, requireCloudinaryConfig } = require('../utils/cloudinary');

router.get('/search', auth, searchMessages);
router.get('/scheduled/:chatId', auth, getScheduledMessages);
router.delete('/scheduled/:id', auth, cancelScheduledMessage);
router.delete('/chat/:chatId', auth, clearChatMessages);
router.get('/:chatId', auth, getMessages);
router.post('/', auth, sendMessage);
router.put('/:id', auth, editMessage);
router.delete('/:id', auth, deleteMessage);
router.put('/:id/pin', auth, pinMessage);router.put('/:id/unpin', auth, unpinMessage);router.put('/:id/poll-vote', auth, votePoll);
router.post('/upload', auth, requireCloudinaryConfig, upload.single('file'), (req, res) => {
  res.json({ url: req.file.path });
});

module.exports = router;
