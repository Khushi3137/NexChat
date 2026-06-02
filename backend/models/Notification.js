const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['message', 'call', 'group'], required: true },
  content: { type: String },
  isRead: { type: Boolean, default: false },
  relatedChat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
