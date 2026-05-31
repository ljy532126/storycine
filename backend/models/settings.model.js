const mongoose = require('mongoose');

/**
 * 系统设置 - 每个用户独立的 LLM/存储配置，持久化重启不丢失
 */
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

/** 获取指定用户的设置，不存在则自动创建（带竞态兜底） */
settingsSchema.statics.getSettings = async function (userId) {
  if (!userId) throw new Error('getSettings 缺少 userId 参数');
  try {
    return await this.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  // 极端并发下 upsert 触发了 E11000，等另一个请求创完再拿
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 50 * (i + 1)));
    const doc = await this.findOne({ userId });
    if (doc) return doc;
  }
  // 最终兜底：再试一次 upsert（此时应该没有竞态了）
  return await this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
