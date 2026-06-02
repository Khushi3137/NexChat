const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  forgotPassword,
  resetPassword,
  getMe,
} = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', auth, getMe);

module.exports = router;
