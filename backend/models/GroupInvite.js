const mongoose = require('mongoose');

const groupInviteSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'canceled'],
    default: 'pending',
  },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

groupInviteSchema.index({ chatId: 1, inviteeId: 1, status: 1 });

module.exports = mongoose.model('GroupInvite', groupInviteSchema);
