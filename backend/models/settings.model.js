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

/** 获取用户的 settings 文档（不存在则用原生 upsert 创建，绝不 touch Mongoose .create/.save） */
settingsSchema.statics.getSettings = async function (userId) {
  if (!userId) throw new Error('getSettings 缺少 userId 参数');

  // 直接查，有就返回
  let doc = await this.findOne({ userId }).lean();
  if (doc) return doc;

  // 用 MongoDB 原生 driver 做 upsert，完全绕过 Mongoose 的 isNew/E11000
  const coll = this.collection;
  try {
    await coll.updateOne(
      { userId },
      { $setOnInsert: { userId, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }

  // upsert 完成后一定能查到
  doc = await this.findOne({ userId });
  if (!doc) {
    // 极端情况：等一会儿再查
    await new Promise(r => setTimeout(r, 200));
    doc = await this.findOne({ userId });
  }
  return doc;
};

/** 原子更新 settings，永不使用 .save()，杜绝 isNew INSERT 问题 */
settingsSchema.statics.updateSettings = async function (userId, updates) {
  await this.updateOne({ userId }, { $set: updates });
};

module.exports = mongoose.model('Settings', settingsSchema);
