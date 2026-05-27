const mongoose = require('mongoose');

/**
 * 系统设置 - 持久化LLM密钥等配置，重启不丢失
 */
const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'llm_config' },
  llmProviders: {
    deepseek: {
      apiKey: { type: String, default: '' },
      baseUrl: { type: String, default: 'https://api.deepseek.com/v1' },
      model: { type: String, default: 'deepseek-chat' },
    },
    doubao: {
      apiKey: { type: String, default: '' },
      baseUrl: { type: String, default: '' },
      model: { type: String, default: '' },
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
    },
  },
  activeProvider: { type: String, default: '' },
  // AI 生成全局配置
  aiConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  // 对象存储配置
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

/** 获取全局设置（单例） */
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'llm_config' });
  if (!settings) {
    settings = await this.create({ key: 'llm_config' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
