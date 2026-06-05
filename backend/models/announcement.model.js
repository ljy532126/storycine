const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  content: { type: String, default: '' },
  // info=蓝 / warning=橙 / success=绿 / danger=红
  type: { type: String, enum: ['info', 'warning', 'success', 'danger'], default: 'info' },
  // all=所有人 / admin=仅管理员
  target: { type: String, enum: ['all', 'admin'], default: 'all' },
  isPinned: { type: Boolean, default: false },     // 置顶
  isActive: { type: Boolean, default: true },       // 是否发布
  createdBy: { type: String, default: '' },
}, { timestamps: true });

announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ target: 1, isActive: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
