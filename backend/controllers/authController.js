const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, isEmailConfigured } = require('../utils/emailService');
const { resolvePrivacySettings } = require('../utils/privacy');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRE,
});

const serializeContactAliases = (aliases) => {
  if (!aliases) return {};
  if (typeof aliases.toObject === 'function') return aliases.toObject();
  if (aliases instanceof Map) return Object.fromEntries(aliases.entries());
  return aliases;
};
const serializeNotificationPreferences = (preferences) => ({
  messageNotifications: preferences?.messageNotifications !== false,
  messageNotificationMode: ['all', 'direct', 'mentions', 'none'].includes(preferences?.messageNotificationMode)
    ? preferences.messageNotificationMode
    : preferences?.messageNotifications === false
      ? 'none'
      : 'all',
  emailNotifications: preferences?.emailNotifications !== false,
  emailNotificationMode: ['all', 'direct', 'none'].includes(preferences?.emailNotificationMode)
    ? preferences.emailNotificationMode
    : preferences?.emailNotifications === false
      ? 'none'
      : 'all',
  soundAlerts: preferences?.soundAlerts !== false,
  soundTone: ['chime', 'pop', 'bell', 'pulse'].includes(preferences?.soundTone)
    ? preferences.soundTone
    : 'chime',
});

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profilePicture: user.profilePicture,
  bio: user.bio,
  contactAliases: serializeContactAliases(user.contactAliases),
  contacts: user.contacts || [],
  blockedUsers: user.blockedUsers || [],
  hiddenChats: user.hiddenChats || [],
  mutedChats: user.mutedChats || [],
  friends: user.friends || [],
  notificationPreferences: serializeNotificationPreferences(user.notificationPreferences),
  privacySettings: resolvePrivacySettings(user.privacySettings),
});

// POST /api/auth/signup
exports.signup = async (req, res) => {
  const { name, email, password } = req.body;

  const normalizedEmail = email?.trim().toLowerCase();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const user = await User.create({ name, email: normalizedEmail, password });
  const token = generateToken(user._id);

  res.status(201).json({
    token,
    user: serializeUser(user),
  });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email?.trim().toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = generateToken(user._id);
  res.json({
    token,
    user: serializeUser(user),
  });
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const genericMessage = 'If an account exists for that email, a reset link has been prepared.';
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.json({ message: genericMessage });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  if (isEmailConfigured()) {
    try {
      await sendPasswordResetEmail(user, resetUrl);
      return res.json({ message: 'Password reset link sent to your email.' });
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
      }
    }
  }

  res.json({
    message: 'Password reset link generated for local testing.',
    resetUrl,
  });
};

// POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Reset link is invalid or has expired' });
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({
    message: 'Password reset successful. Sign in with your new password.',
  });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -passwordResetToken -passwordResetExpires');
  res.json(serializeUser(user));
};
