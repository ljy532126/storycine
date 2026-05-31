const express = require('express');
const router = express.Router();
const axios = require('axios');
const appConfig = require('../config/app.config');
const Settings = require('../models/settings.model');
const storageService = require('../services/storage.service');
const { authRequired } = require('../middleware/auth.middleware');

router.use(authRequired);

// ===== LLM 配置 =====

router.get('/llm', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: appConfig.getLLMConfigSummary(settings) });
  } catch (e) { next(e); }
});

router.put('/llm', async (req, res, next) => {
  try {
    const { provider, apiKey, baseUrl, model, imageModel } = req.body;
    if (!provider) {
      return res.status(400).json({ message: '缺少 provider 参数 (deepseek|doubao|tongyi|openai)' });
    }

    const settings = await Settings.getSettings(req.user._id);
    const llmProviders = settings.llmProviders || {};
    if (!llmProviders[provider]) llmProviders[provider] = {};
    const p = llmProviders[provider];
    if (apiKey !== undefined) p.apiKey = apiKey;
    if (baseUrl !== undefined) p.baseUrl = baseUrl;
    if (model !== undefined) p.model = model;
    if (imageModel !== undefined) p.imageModel = imageModel;

    await Settings.updateSettings(req.user._id, { llmProviders });

    // 同步 runtimeConfig
    appConfig.setLLMConfig(settings, provider, { apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model, imageModel: p.imageModel });

    const masked = appConfig.getLLMConfigSummary(settings)[provider];
    res.json({
      message: `${provider} 配置已更新（已保存到数据库，重启不丢失）`,
      data: { provider, hasApiKey: !!(p.apiKey), summary: masked },
    });
  } catch (error) { next(error); }
});

router.post('/llm/test', async (req, res, next) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) return res.status(400).json({ message: '缺少 provider 或 apiKey' });

    if (provider === 'doubao') {
      const arkBase = baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
      const modelId = req.body.model || 'doubao-seedance-2-0-260128';
      const resp = await axios.post(`${arkBase}/contents/generations/tasks`, {
        model: modelId, content: [{ type: 'text', text: 'test' }],
        resolution: '480p', ratio: '1:1', duration: 4,
      }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, timeout: 15000, validateStatus: () => true });
      if (resp.status === 401) return res.json({ message: 'API Key 验证失败：密钥无效或已过期', data: { ok: false } });
      if (resp.status === 403) return res.json({ message: '密钥有效但无访问权限 (403)', data: { ok: false } });
      if (resp.status === 200 || resp.status === 201) return res.json({ message: '连接成功', data: { ok: true } });
      if (resp.status === 400) return res.json({ message: `请求格式错误 (400): ${resp.data?.error?.message || ''}`, data: { ok: false } });
      return res.json({ message: `未知状态 ${resp.status}`, data: { ok: false } });
    }

    const isOpenAI = provider === 'openai';
    const testBase = baseUrl || (isOpenAI ? 'https://api.openai.com/v1' : (provider === 'tongyi' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' : 'https://api.deepseek.com/v1'));
    const modelsUrl = `${testBase}/models`;

    try {
      await axios.get(modelsUrl, { headers: { 'Authorization': `Bearer ${apiKey}` }, timeout: 10000 });
      res.json({ message: '连接成功', data: { ok: true } });
    } catch (err) {
      const status = err.response?.status || 0;
      const msg = err.response?.data?.error?.message || err.message;
      if (status === 401) res.json({ message: 'Unauthorized: API Key 无效或已过期', data: { ok: false } });
      else if (status === 403) res.json({ message: 'Forbidden: 无权限访问该资源', data: { ok: false } });
      else if (status === 0 || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ECONNABORTED'))
        res.json({ message: `无法连接到 ${testBase}，请检查 Base URL 格式和网络连接`, data: { ok: false } });
      else res.json({ message: `连接失败 (${status}): ${msg}`, data: { ok: false } });
    }
  } catch (error) { next(error); }
});

router.get('/llm/status', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const configured = appConfig.hasLLMConfigured(settings);
    const active = appConfig.getActiveLLM(settings);
    res.json({ data: { configured, activeProvider: configured ? active.provider : null, model: configured ? active.model : null } });
  } catch (e) { next(e); }
});

// ===== AI 全局配置 =====

router.get('/ai', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: settings.aiConfig || null });
  } catch (e) { next(e); }
});

router.put('/ai', async (req, res, next) => {
  try {
    await Settings.updateSettings(req.user._id, { aiConfig: req.body });
    res.json({ message: '已保存', data: req.body });
  } catch (e) { next(e); }
});

// ===== 全部配置 =====

router.get('/all', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: { aiConfig: settings.aiConfig || {}, storageConfig: settings.storageConfig || {} } });
  } catch (e) { next(e); }
});

// ===== 对象存储 =====

router.get('/storage', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = settings.storageConfig || {};
    res.json({ data: {
      enabled: cfg.enabled || false, provider: cfg.provider || 'minio',
      endpoint: cfg.endpoint || '', accessKeyId: cfg.accessKeyId || '',
      accessKeySecret: maskSecret(cfg.accessKeySecret),
      bucket: cfg.bucket || '', prefix: cfg.prefix || '/autodrama/uploads/',
      _hasSecret: !!cfg.accessKeySecret,
    }});
  } catch (e) { next(e); }
});

router.put('/storage', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = { ...(settings.storageConfig || {}) };
    const { enabled, provider, endpoint, accessKeyId, accessKeySecret, bucket, prefix } = req.body;
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    if (provider) cfg.provider = provider;
    if (endpoint !== undefined) cfg.endpoint = endpoint;
    if (accessKeyId !== undefined) cfg.accessKeyId = accessKeyId;
    if (accessKeySecret && accessKeySecret !== maskSecret(cfg.accessKeySecret)) cfg.accessKeySecret = accessKeySecret;
    if (bucket !== undefined) cfg.bucket = bucket;
    if (prefix !== undefined) cfg.prefix = prefix;

    await Settings.updateSettings(req.user._id, { storageConfig: cfg });
    res.json({ message: '对象存储配置已保存', data: { ...cfg, accessKeySecret: maskSecret(cfg.accessKeySecret) } });
  } catch (e) { next(e); }
});

router.post('/storage/test', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = req.body || settings.storageConfig || {};
    if (!cfg.accessKeySecret || cfg.accessKeySecret === maskSecret(settings.storageConfig?.accessKeySecret)) {
      cfg.accessKeySecret = settings.storageConfig?.accessKeySecret || '';
    }
    const result = await storageService.testConnection(cfg);
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/storage/regions', (req, res) => {
  const { provider } = req.query;
  const regions = storageService.getRegionsForProvider(provider || 'tencent_cos');
  res.json({ data: regions });
});

function maskSecret(secret) {
  if (!secret) return '';
  if (secret.length <= 8) return '****';
  return secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
}

module.exports = router;
