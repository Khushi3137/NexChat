const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: String,
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  options: {
    type: [pollOptionSchema],
    validate: {
      validator: (options) => Array.isArray(options) && options.length >= 2,
      message: 'Polls require at least two options',
    },
  },
  allowMultiple: { type: Boolean, default: false },
});

const callSchema = new mongoose.Schema({
  callType: {
    type: String,
    enum: ['audio', 'video'],
    default: 'audio',
  },
  scope: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct',
  },
  status: {
    type: String,
    enum: ['completed', 'missed', 'declined'],
    default: 'completed',
  },
  durationSeconds: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  answeredAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  joinedCount: { type: Number, default: 0 },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  content: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, default: '' },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'location', 'document', 'poll', 'ai', 'call'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  isPinned: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  isForwarded: { type: Boolean, default: false },
  isDeletedForEveryone: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: [reactionSchema],
  scheduledTime: { type: Date, default: null },
  isSent: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null, index: { expireAfterSeconds: 0 } },
  location: {
    lat: Number,
    lng: Number,
    address: String,
  },
  poll: {
    type: pollSchema,
    default: null,
  },
  call: {
    type: callSchema,
    default: null,
  },
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

messageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', messageSchema);
