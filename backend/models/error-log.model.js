const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  // 错误基本信息
  message: { type: String, required: true },
  stack: { type: String, default: '' },
  statusCode: { type: Number, default: 500 },

  // 请求上下文
  method: { type: String, default: '' },
  url: { type: String, default: '' },
  path: { type: String, default: '' },
  body: { type: mongoose.Schema.Types.Mixed, default: {} },
  query: { type: mongoose.Schema.Types.Mixed, default: {} },
  headers: { type: mongoose.Schema.Types.Mixed, default: {} },

  // 用户信息
  userId: { type: String, default: '' },
  username: { type: String, default: '' },
  userRole: { type: String, default: '' },

  // 服务端信息
  nodeEnv: { type: String, default: '' },
  hostname: { type: String, default: '' },

  // 处理状态
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date, default: null },
  resolveNote: { type: String, default: '' },
}, { timestamps: true });

// 自动清理 30 天前的日志
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
// 方便按路径/状态码查询
errorLogSchema.index({ path: 1, statusCode: 1 });
errorLogSchema.index({ userId: 1 });
errorLogSchema.index({ resolved: 1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
