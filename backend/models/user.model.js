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
}, { timestamps: true });

// 自动生成唯一短ID：US-XXXXXXXX
userSchema.pre('validate', async function (next) {
  if (this.isNew && !this.uid) {
    let uid;
    let exists;
    do {
      uid = 'US-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      exists = await mongoose.model('User').findOne({ uid });
    } while (exists);
    this.uid = uid;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
