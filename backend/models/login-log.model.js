const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, required: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  success: { type: Boolean, default: false },
  message: { type: String, default: '' },
}, { timestamps: true });

loginLogSchema.index({ userId: 1, createdAt: -1 });
loginLogSchema.index({ username: 1 });
loginLogSchema.index({ ip: 1 });

module.exports = mongoose.model('LoginLog', loginLogSchema);
