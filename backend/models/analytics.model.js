const mongoose = require('mongoose');

/**
 * 分析事件 - 轻量级埋点，用于数据统计
 * 记录：页面访问、生成操作、用户来源信息
 */
const analyticsSchema = new mongoose.Schema({
  event: { type: String, required: true, index: true }, // page_view, generate_script, generate_composition, generate_image, generate_video
  userId: { type: String, default: 'default_user', index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  metadata: {
    platform: { type: String, default: '' },    // Windows, macOS, Linux, Android, iOS
    browser: { type: String, default: '' },      // Chrome, Edge, Safari, Firefox
    region: { type: String, default: '' },       // IP-derived or navigator-based
    referrer: { type: String, default: '' },
    page: { type: String, default: '' },
    duration: { type: Number, default: 0 },      // 页面停留时间(秒)
    extra: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
}, { timestamps: true });

// 索引优化
analyticsSchema.index({ event: 1, createdAt: 1 });
analyticsSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
