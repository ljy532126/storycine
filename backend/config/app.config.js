require('dotenv').config();

/** 内存中的运行时配置（优先级: 运行时 > MongoDB > env） */
const runtimeConfig = {
  deepseek: { apiKey: '', baseUrl: '', model: '' },
  doubao: { apiKey: '', baseUrl: '', model: '' },
  tongyi: { apiKey: '', baseUrl: '', model: '' },
  openai: { apiKey: '', baseUrl: '', model: '' },
  jimeng: { apiKey: '', baseUrl: '' },
  wan27: { apiKey: '', baseUrl: '' },
};

let _settingsModel = null;
let _dbLoaded = false;

function getSettingsModel() {
  if (!_settingsModel) {
    try { _settingsModel = require('../models/settings.model'); } catch (e) { /* model not ready yet */ }
  }
  return _settingsModel;
}

/**
 * 应用配置 - env → MongoDB → 运行时覆盖（优先级递增）
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
        model: runtimeConfig.deepseek.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
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
      return {
        apiKey: d.apiKey || '',
        baseUrl: d.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
        model: d.imageModel || 'doubao-seedream-4-5-251128',
      };
    },
    get openai() {
      const o = appConfig.llm.openai;
      return {
        apiKey: o.apiKey || '',
        baseUrl: o.baseUrl || 'https://api.openai.com/v1',
        model: o.imageModel || o.model || 'gpt-image-2',
      };
    },
  },

  /** 获取当前活跃的LLM配置 */
  getActiveLLM() {
    const deepseek = this.llm.deepseek;
    const doubao = this.llm.doubao;
    const tongyi = this.llm.tongyi;
    const openai = this.llm.openai;
    if (deepseek.apiKey) return { provider: 'deepseek', ...deepseek };
    if (doubao.apiKey) return { provider: 'doubao', ...doubao };
    if (tongyi.apiKey) return { provider: 'tongyi', ...tongyi };
    return { provider: 'openai', ...openai };
  },

  /** 检查是否已配置任何LLM */
  hasLLMConfigured() {
    const active = this.getActiveLLM();
    return !!active.apiKey;
  },

  /**
   * 运行时更新LLM配置（立即更新内存）
   */
  setLLMConfig(provider, config) {
    if (!runtimeConfig[provider]) {
      throw new Error(`Unknown provider: ${provider}. Valid: deepseek, doubao, tongyi, openai`);
    }
    if (config.apiKey !== undefined) runtimeConfig[provider].apiKey = config.apiKey;
    if (config.baseUrl !== undefined) runtimeConfig[provider].baseUrl = config.baseUrl;
    if (config.model !== undefined) runtimeConfig[provider].model = config.model;
    if (config.imageModel !== undefined) runtimeConfig[provider].imageModel = config.imageModel;
  },

  /**
   * 持久化当前LLM配置到MongoDB
   */
  async persistLLMConfig() {
    const Settings = getSettingsModel();
    if (!Settings) return;
    try {
      const settings = await Settings.getSettings();
      settings.llmProviders = {
        deepseek: { ...runtimeConfig.deepseek },
        doubao: { ...runtimeConfig.doubao },
        tongyi: { ...runtimeConfig.tongyi },
        openai: { ...runtimeConfig.openai },
      };
      settings.activeProvider = this.getActiveLLM().provider;
      await settings.save();
      console.log('[config] LLM settings persisted to MongoDB');
    } catch (e) {
      console.error('[config] Failed to persist LLM settings:', e.message);
    }
  },

  /**
   * 从MongoDB加载LLM配置到内存（启动时调用）
   */
  async loadLLMFromDB() {
    if (_dbLoaded) return;
    const Settings = getSettingsModel();
    if (!Settings) return;
    try {
      const settings = await Settings.getSettings();
      if (settings && settings.llmProviders) {
        const providers = ['deepseek', 'doubao', 'tongyi', 'openai'];
        let loadedCount = 0;
        providers.forEach(p => {
          const dbCfg = settings.llmProviders[p];
          if (dbCfg && dbCfg.apiKey) {
            // DB中的值覆盖运行时默认值（但env仍为fallback）
            if (!runtimeConfig[p].apiKey || runtimeConfig[p].apiKey === dbCfg.apiKey) {
              // DB写入的值优先
            }
            runtimeConfig[p].apiKey = dbCfg.apiKey || runtimeConfig[p].apiKey;
            runtimeConfig[p].baseUrl = dbCfg.baseUrl || runtimeConfig[p].baseUrl;
            runtimeConfig[p].model = dbCfg.model || runtimeConfig[p].model;
            if (dbCfg.imageModel) runtimeConfig[p].imageModel = dbCfg.imageModel;
            if (dbCfg.apiKey) loadedCount++;
          }
        });
        if (loadedCount > 0) {
          console.log(`[config] Loaded ${loadedCount} LLM provider(s) from MongoDB`);
        }
      }
    } catch (e) {
      console.error('[config] Failed to load LLM settings from DB:', e.message);
    }
    _dbLoaded = true;
  },

  /** 获取当前所有LLM配置（隐藏密钥中间部分） */
  getLLMConfigSummary() {
    const mask = (key) => {
      if (!key || key.length < 8) return key ? '***' : '';
      return key.substring(0, 4) + '****' + key.substring(key.length - 4);
    };
    const providers = ['deepseek', 'doubao', 'tongyi', 'openai'];
    const summary = { activeProvider: this.getActiveLLM().provider, configured: this.hasLLMConfigured() };
    providers.forEach(p => {
      summary[p] = { ...this.llm[p], apiKey: mask(this.llm[p].apiKey) };
    });
    return summary;
  },
};

module.exports = appConfig;
