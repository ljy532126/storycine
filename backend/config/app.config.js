require('dotenv').config();

/** 内存中的运行时配置（当前活跃用户的 LLM Key，启动时为空，用户访问时按需加载） */
const runtimeConfig = {
  deepseek: { apiKey: '', baseUrl: '', model: '' },
  doubao: { apiKey: '', baseUrl: '', model: '', imageModel: '' },
  tongyi: { apiKey: '', baseUrl: '', model: '' },
  openai: { apiKey: '', baseUrl: '', model: '', imageModel: '' },
  jimeng: { apiKey: '', baseUrl: '' },
  wan27: { apiKey: '', baseUrl: '' },
};

let _settingsModel = null;
let _loadedUserId = null;  // 当前已加载到 runtimeConfig 的用户 ID

function getSettingsModel() {
  if (!_settingsModel) {
    try { _settingsModel = require('../models/settings.model'); } catch (e) { /* model not ready yet */ }
  }
  return _settingsModel;
}

/** 将用户的 MongoDB 配置加载到运行时内存（后续 getActiveLLM / llm.* 都从该用户配置读取） */
async function loadUserConfig(userId) {
  if (!userId) return;
  const Settings = getSettingsModel();
  if (!Settings) return;
  try {
    const settings = await Settings.getSettings(userId);
    const providers = ['deepseek', 'doubao', 'tongyi', 'openai'];
    const envKeys = { deepseek: 'DEEPSEEK_API_KEY', doubao: 'DOUBAO_API_KEY', tongyi: 'TONGYI_API_KEY', openai: 'OPENAI_API_KEY' };
    let loadedCount = 0;
    providers.forEach(p => {
      const dbCfg = settings.llmProviders?.[p] || {};
      // 用用户保存的值；未保存则清空，不回退到上一个用户的缓存
      runtimeConfig[p].apiKey = dbCfg.apiKey || process.env[envKeys[p]] || '';
      runtimeConfig[p].baseUrl = dbCfg.baseUrl || runtimeConfig[p].baseUrl || '';
      runtimeConfig[p].model = dbCfg.model || runtimeConfig[p].model || '';
      runtimeConfig[p].imageModel = dbCfg.imageModel || '';
      if (dbCfg.apiKey) loadedCount++;
    });
    _loadedUserId = userId;
    if (loadedCount > 0) console.log(`[config] 已为用户 ${userId} 加载 ${loadedCount} 个 LLM provider`);
  } catch (e) {
    console.error('[config] 加载用户 LLM 配置失败:', e.message);
  }
}

/**
 * 应用配置 - 运行时从当前活跃用户加载
 */
const appConfig = {
  server: {
    port: parseInt(process.env.SERVER_PORT, 10) || 3000,
  },
  mongodb: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/autodrama',
    host: process.env.MONGO_HOST || 'localhost',
    port: parseInt(process.env.MONGO_PORT, 10) || 27017,
    database: process.env.MONGO_DATABASE || 'autodrama',
    user: process.env.MONGO_USER || '',
    password: process.env.MONGO_PASSWORD || '',
    authSource: process.env.MONGO_AUTH_SOURCE || 'admin',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'autodrama',
  },
  llm: {
    get deepseek() {
      return {
        apiKey: runtimeConfig.deepseek.apiKey || process.env.DEEPSEEK_API_KEY || '',
        baseUrl: runtimeConfig.deepseek.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        model: runtimeConfig.deepseek.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
      };
    },
    get doubao() {
      return {
        apiKey: runtimeConfig.doubao.apiKey || process.env.DOUBAO_API_KEY || '',
        baseUrl: runtimeConfig.doubao.baseUrl || process.env.DOUBAO_BASE_URL || '',
        model: runtimeConfig.doubao.model || process.env.DOUBAO_MODEL || '',
        imageModel: runtimeConfig.doubao.imageModel || process.env.DOUBAO_IMAGE_MODEL || 'doubao-seedream-4-5-251128',
      };
    },
    get tongyi() {
      return {
        apiKey: runtimeConfig.tongyi.apiKey || process.env.TONGYI_API_KEY || '',
        baseUrl: runtimeConfig.tongyi.baseUrl || process.env.TONGYI_BASE_URL || '',
        model: runtimeConfig.tongyi.model || process.env.TONGYI_MODEL || '',
      };
    },
    get openai() {
      return {
        apiKey: runtimeConfig.openai.apiKey || process.env.OPENAI_API_KEY || '',
        baseUrl: runtimeConfig.openai.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: runtimeConfig.openai.model || process.env.OPENAI_MODEL || 'gpt-4o',
        imageModel: runtimeConfig.openai.imageModel || process.env.OPENAI_IMAGE_MODEL || '',
      };
    },
  },
  image: {
    get jimeng() {
      return {
        apiKey: runtimeConfig.jimeng.apiKey || process.env.JIMENG_API_KEY || '',
        baseUrl: runtimeConfig.jimeng.baseUrl || process.env.JIMENG_BASE_URL || '',
      };
    },
    get wan27() {
      return {
        apiKey: runtimeConfig.wan27.apiKey || process.env.WAN27_API_KEY || '',
        baseUrl: runtimeConfig.wan27.baseUrl || process.env.WAN27_BASE_URL || '',
      };
    },
    get doubao() {
      const d = appConfig.llm.doubao;
      return { apiKey: d.apiKey || '', baseUrl: d.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3', model: d.imageModel || 'doubao-seedream-4-5-251128' };
    },
    get openai() {
      const o = appConfig.llm.openai;
      return { apiKey: o.apiKey || '', baseUrl: o.baseUrl || 'https://api.openai.com/v1', model: o.imageModel || o.model || 'gpt-image-2' };
    },
  },

  /** 从 settings 对象获取摘要（用于 config routes） */
  getLLMConfigSummary(settings) {
    const mask = (key) => {
      if (!key || key.length < 8) return key ? '***' : '';
      return key.substring(0, 4) + '****' + key.substring(key.length - 4);
    };
    const active = this.getActiveLLM(settings);
    const summary = { activeProvider: active.provider, configured: this.hasLLMConfigured(settings) };
    ['deepseek', 'doubao', 'tongyi', 'openai'].forEach(p => {
      const s = settings?.llmProviders?.[p] || {};
      const fallback = this.llm[p];
      // apiKey 不使用 runtime 缓存 fallback：用户未保存则显示空，避免泄漏其他用户的 Key
      summary[p] = {
        apiKey: mask(s.apiKey || ''),
        baseUrl: s.baseUrl || fallback.baseUrl,
        model: s.model || fallback.model,
        imageModel: s.imageModel || '',
      };
    });
    return summary;
  },

  /** 获取当前活跃的LLM配置 */
  getActiveLLM(settings) {
    const fromSettings = (p) => {
      const s = settings?.llmProviders?.[p];
      if (s?.apiKey) return { provider: p, apiKey: s.apiKey, baseUrl: s.baseUrl, model: s.model, imageModel: s.imageModel };
      return null;
    };
    // 优先从 settings 对象读取
    for (const p of ['deepseek', 'doubao', 'tongyi', 'openai']) {
      const sCfg = fromSettings(p);
      if (sCfg) return sCfg;
    }
    // 有 settings 但不包含任何 apiKey → 用户未配置，不泄露 runtime 缓存
    if (settings) return { provider: null, model: null };
    // 无 settings → 内部调用，使用 runtimeConfig
    const deepseek = this.llm.deepseek;
    const doubao = this.llm.doubao;
    const tongyi = this.llm.tongyi;
    const openai = this.llm.openai;
    if (deepseek.apiKey) return { provider: 'deepseek', ...deepseek };
    if (doubao.apiKey) return { provider: 'doubao', ...doubao };
    if (tongyi.apiKey) return { provider: 'tongyi', ...tongyi };
    return { provider: 'openai', ...openai };
  },

  hasLLMConfigured(settings) {
    const active = this.getActiveLLM(settings);
    return !!active.apiKey;
  },

  /** 运行时更新LLM配置（写入 settings 对象 + runtimeConfig） */
  setLLMConfig(settings, provider, config) {
    if (!runtimeConfig[provider]) {
      throw new Error(`Unknown provider: ${provider}. Valid: deepseek, doubao, tongyi, openai`);
    }
    if (config.apiKey !== undefined) runtimeConfig[provider].apiKey = config.apiKey;
    if (config.baseUrl !== undefined) runtimeConfig[provider].baseUrl = config.baseUrl;
    if (config.model !== undefined) runtimeConfig[provider].model = config.model;
    if (config.imageModel !== undefined) runtimeConfig[provider].imageModel = config.imageModel;

    // 同时更新 settings 对象
    if (settings) {
      if (!settings.llmProviders) settings.llmProviders = {};
      if (!settings.llmProviders[provider]) settings.llmProviders[provider] = {};
      if (config.apiKey !== undefined) settings.llmProviders[provider].apiKey = config.apiKey;
      if (config.baseUrl !== undefined) settings.llmProviders[provider].baseUrl = config.baseUrl;
      if (config.model !== undefined) settings.llmProviders[provider].model = config.model;
      if (config.imageModel !== undefined) settings.llmProviders[provider].imageModel = config.imageModel;
      settings.markModified('llmProviders');
    }
  },

  /** 持久化当前LLM配置到MongoDB */
  async persistLLMConfig(settings) {
    if (!settings) return;
    try {
      const s = await settings.save();
      console.log('[config] LLM settings 已持久化，userId:', s.userId);
    } catch (e) {
      console.error('[config] 持久化 LLM settings 失败:', e.message);
    }
  },

  loadUserConfig,
  _loadedUserId,
  _runtimeConfig: runtimeConfig,
};

module.exports = appConfig;
