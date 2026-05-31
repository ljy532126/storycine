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

/** 获取用户 settings（原生 driver 读写，绕过 Mongoose 的 isNew/schema 干扰） */
settingsSchema.statics.getSettings = async function (userId) {
  if (!userId) throw new Error('getSettings 缺少 userId 参数');

  const coll = this.collection;

  // 用原生 driver 查
  let doc = await coll.findOne({ userId });
  if (doc) return doc;

  // 不存在：原生 upsert
  try {
    await coll.updateOne(
      { userId },
      { $setOnInsert: { userId, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }

  // 循环等文档就绪
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 100));
    doc = await coll.findOne({ userId });
    if (doc) return doc;
  }

  throw new Error('无法创建用户 settings 文档');
};

/** 原子更新 settings（原生 driver） */
settingsSchema.statics.updateSettings = async function (userId, updates) {
  await this.collection.updateOne({ userId }, { $set: updates });
};

module.exports = mongoose.model('Settings', settingsSchema);
