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

/** 获取用户的 settings 文档（纯查询，不存在则创建后返回） */
settingsSchema.statics.getSettings = async function (userId) {
  let doc = await this.findOne({ userId });
  if (doc) return doc;

  try {
    doc = await this.create({ userId });
    return doc;
  } catch (e) {
    // 并发创建会触发 E11000，另一个请求已创建，直接查
    if (e.code === 11000) {
      doc = await this.findOne({ userId });
      if (doc) return doc;
      // 极端情况：重试 create
      try { return await this.create({ userId }); } catch (_) {
        return await this.findOne({ userId });
      }
    }
    throw e;
  }
};

/** 原子更新 settings，永不使用 .save()，杜绝 isNew INSERT 问题 */
settingsSchema.statics.updateSettings = async function (userId, updates) {
  await this.updateOne({ userId }, { $set: updates });
};

module.exports = mongoose.model('Settings', settingsSchema);
