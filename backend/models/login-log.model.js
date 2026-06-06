const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, required: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  success: { type: Boolean, default: false },
  message: { type: String, default: '' },
  geoInfo: {
    country: { type: String, default: '' },
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    isp: { type: String, default: '' },
    asn: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
  },
}, { timestamps: true });

loginLogSchema.index({ userId: 1, createdAt: -1 });
loginLogSchema.index({ username: 1 });
loginLogSchema.index({ ip: 1 });

module.exports = mongoose.model('LoginLog', loginLogSchema);
