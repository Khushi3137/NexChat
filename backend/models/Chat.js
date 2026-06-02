const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  chatName: { type: String, trim: true },
  isGroupChat: { type: Boolean, default: false },
  isAIBotChat: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  groupPicture: { type: String, default: '' },
  groupDescription: { type: String, default: '' },
  requestType: {
    type: String,
    enum: ['none', 'message', 'friend'],
    default: 'none',
  },
  requestStatus: {
    type: String,
    enum: ['none', 'pending', 'accepted', 'declined'],
    default: 'none',
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requestRespondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requestRespondedAt: { type: Date, default: null },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  disappearingTimer: {
    type: String,
    enum: ['off', '10s', '1m', '1h', '24h'],
    default: 'off'
  },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
