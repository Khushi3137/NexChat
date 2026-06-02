const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const notificationPreferencesSchema = new mongoose.Schema({
  messageNotifications: { type: Boolean, default: true },
  messageNotificationMode: {
    type: String,
    enum: ['all', 'direct', 'mentions', 'none'],
    default: 'all',
  },
  emailNotifications: { type: Boolean, default: true },
  emailNotificationMode: {
    type: String,
    enum: ['all', 'direct', 'none'],
    default: 'all',
  },
  soundAlerts: { type: Boolean, default: true },
  soundTone: {
    type: String,
    enum: ['chime', 'pop', 'bell', 'pulse'],
    default: 'chime',
  },
}, { _id: false });

const privacySettingsSchema = new mongoose.Schema({
  lastSeenVisibility: {
    type: String,
    enum: ['everyone', 'contacts', 'nobody'],
    default: 'everyone',
  },
  profilePhotoVisibility: {
    type: String,
    enum: ['everyone', 'contacts', 'nobody'],
    default: 'everyone',
  },
  readReceipts: { type: Boolean, default: true },
  groupInvitePermission: {
    type: String,
    enum: ['ask_first', 'contacts_only', 'nobody'],
    default: 'ask_first',
  },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  profilePicture: { type: String, default: '' },
  bio: { type: String, default: 'Hey there! I am using Nexus Chat.' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  contactAliases: { type: Map, of: String, default: {} },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  hiddenChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
  notificationPreferences: {
    type: notificationPreferencesSchema,
    default: () => ({
      messageNotifications: true,
      messageNotificationMode: 'all',
      emailNotifications: true,
      emailNotificationMode: 'all',
      soundAlerts: true,
      soundTone: 'chime',
    }),
  },
  privacySettings: {
    type: privacySettingsSchema,
    default: () => ({
      lastSeenVisibility: 'everyone',
      profilePhotoVisibility: 'everyone',
      readReceipts: true,
      groupInvitePermission: 'ask_first',
    }),
  },
  socketIds: [{ type: String }],
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
