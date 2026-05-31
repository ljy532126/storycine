const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  llmProviders: {
    deepseek: {
      apiKey: { type: String, default: '' },
      baseUrl: { type: String, default: 'https://api.deepseek.com/v1' },
      model: { type: String, default: 'deepseek-v4-pro' },
    },
    doubao: {
      apiKey: { type: String, default: '' },
      baseUrl: { type: String, default: '' },
      model: { type: String, default: '' },
      imageModel: { type: String, default: '' },
    },
    tongyi: {
      apiKey: { type: String, default: '' },
      baseUrl: { type: String, default: '' },
      model: { type: String, default: '' },
    },
    openai: {
      apiKey: { type: String, default: '' },
      baseUrl: { type: String, default: 'https://api.openai.com/v1' },
      model: { type: String, default: 'gpt-4o' },
      imageModel: { type: String, default: 'gpt-image-2' },
    },
  },
  activeProvider: { type: String, default: '' },
  aiConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  storageConfig: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, default: 'minio', enum: ['aliyun_oss', 'tencent_cos', 'minio'] },
    endpoint: { type: String, default: '' },
    accessKeyId: { type: String, default: '' },
    accessKeySecret: { type: String, default: '' },
    bucket: { type: String, default: '' },
    prefix: { type: String, default: '/autodrama/uploads/' },
  },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// 按 userId 串行化创建，彻底消除竞态
const _creating = new Map();

settingsSchema.statics.getSettings = async function (userId) {
  if (!userId) throw new Error('getSettings 缺少 userId 参数');

  let doc = await this.findOne({ userId });
  if (doc) { doc.isNew = false; return doc; }

  const key = userId.toString();

  // 只有一个请求负责 create，其他排队拿结果
  if (_creating.has(key)) {
    await _creating.get(key);
    doc = await this.findOne({ userId });
    if (doc) { doc.isNew = false; return doc; }
  }

  let resolve;
  _creating.set(key, new Promise(r => { resolve = r; }));

  try {
    doc = await this.findOne({ userId });
    if (doc) { doc.isNew = false; return doc; }

    try {
      doc = await this.create({ userId });
    } catch (e) {
      if (e.code !== 11000) throw e;
      doc = await this.findOne({ userId });
    }

    if (!doc) throw new Error('无法创建用户 settings');
    doc.isNew = false;
    return doc;
  } finally {
    resolve();
    _creating.delete(key);
  }
};

/** 原子更新 settings */
settingsSchema.statics.updateSettings = async function (userId, updates) {
  await this.updateOne({ userId }, { $set: updates });
};

module.exports = mongoose.model('Settings', settingsSchema);
