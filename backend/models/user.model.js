const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  uid: { type: String, unique: true, index: true },
  username: { type: String, required: true, unique: true, minlength: 3, maxlength: 30, index: true },
  password: { type: String, required: true },
  nickname: { type: String, default: '' },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['active', 'disabled', 'banned'], default: 'active' },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: '' },
  phone: { type: String, default: '', index: true },
  tokenVersion: { type: Number, default: 0 },  // 改密码后 +1，旧 token 失效
}, { timestamps: true });

// 自动生成唯一短ID：US-XXXXXXXX
userSchema.pre('save', async function () {
  if (this.isNew && !this.uid) {
    let uid;
    do {
      uid = 'US-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    } while (await this.constructor.findOne({ uid }));
    this.uid = uid;
  }
});

module.exports = mongoose.model('User', userSchema);
