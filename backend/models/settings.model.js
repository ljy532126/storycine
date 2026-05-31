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

/** 获取用户的 settings 文档（不存在则创建，保证绝不返回 null） */
settingsSchema.statics.getSettings = async function (userId) {
  let doc = await this.findOne({ userId });
  if (doc) return doc;

  try {
    return await this.create({ userId });
  } catch (e) {
    if (e.code !== 11000) throw e;
  }

  // 并发 E11000，循环等到另一个请求创建完毕
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 100));
    doc = await this.findOne({ userId });
    if (doc) return doc;
  }

  // 最终兜底，同样要 catch E11000
  try {
    return await this.create({ userId });
  } catch (e) {
    if (e.code === 11000) {
      doc = await this.findOne({ userId });
      if (doc) return doc;
    }
    throw e;
  }
};

/** 原子更新 settings，永不使用 .save()，杜绝 isNew INSERT 问题 */
settingsSchema.statics.updateSettings = async function (userId, updates) {
  await this.updateOne({ userId }, { $set: updates });
};

module.exports = mongoose.model('Settings', settingsSchema);
