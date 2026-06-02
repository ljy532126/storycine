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
  ttsConfig: {
    apiKey: { type: String, default: '' },
    resourceId: { type: String, default: 'seed-tts-2.0' },
    defaultSpeaker: { type: String, default: 'zh_female_vv_uranus_bigtts' },
    customVoiceId: { type: String, default: '' },
    format: { type: String, default: 'mp3' },
    sampleRate: { type: Number, default: 24000 },
    speechRate: { type: Number, default: 0 },
    loudnessRate: { type: Number, default: 0 },
    enableSubtitle: { type: Boolean, default: true },
    disableMarkdownFilter: { type: Boolean, default: true },
    useCache: { type: Boolean, default: true },
    explicitLanguage: { type: String, default: 'zh-cn' },
    configured: { type: Boolean, default: false },
  },
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

settingsSchema.statics.getSettings = async function (userId) {
  let doc = await this.findOne({ userId });
  if (!doc) {
    try { doc = await this.create({ userId }); } catch (e) { doc = await this.findOne({ userId }); }
  }
  return doc;
};

settingsSchema.statics.updateSettings = async function (userId, updates) {
  await this.updateOne({ userId }, { $set: updates });
};

module.exports = mongoose.model('Settings', settingsSchema);
