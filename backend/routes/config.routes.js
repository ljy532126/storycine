const express = require('express');
const router = express.Router();
const axios = require('axios');
const appConfig = require('../config/app.config');
const Settings = require('../models/settings.model');
const storageService = require('../services/storage.service');
const { authRequired } = require('../middleware/auth.middleware');

// 所有路由需要登录
router.use(authRequired);

// 获取当前LLM配置摘要（密钥脱敏，仅当前用户）
router.get('/llm', async (req, res) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: appConfig.getLLMConfigSummary(settings) });
  } catch (e) { next(e); }
});

// 运行时更新LLM配置（持久化到用户自己的MongoDB文档）
router.put('/llm', async (req, res, next) => {
  try {
    const { provider, apiKey, baseUrl, model, imageModel } = req.body;
    if (!provider) {
      return res.status(400).json({ message: '缺少provider参数 (deepseek|doubao|tongyi|openai)' });
    }

    const settings = await Settings.getSettings(req.user._id);
    appConfig.setLLMConfig(settings, provider, { apiKey, baseUrl, model, imageModel });
    await appConfig.persistLLMConfig(settings);

    const masked = appConfig.getLLMConfigSummary(settings)[provider];
    res.json({
      message: `${provider} 配置已更新（已保存到数据库，重启不丢失）`,
      data: { provider, hasApiKey: !!(apiKey || settings.llmProviders?.[provider]?.apiKey), summary: masked },
    });
  } catch (error) { next(error); }
});

// 测试 API Key 连通性
router.post('/llm/test', async (req, res) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) return res.status(400).json({ message: '缺少 provider 或 apiKey' });

    const testUrls = {
      deepseek: { url: `${baseUrl || 'https://api.deepseek.com/v1'}/models`, key: apiKey },
      openai: { url: req.body.model?.includes('image') || req.body.model?.includes('gpt-image') ? `${baseUrl || 'https://api.openai.com/v1'}/images/generations` : `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`, key: apiKey, method: 'POST', body: req.body.model?.includes('image') || req.body.model?.includes('gpt-image') ? { model: req.body.model, prompt: 'test', n: 1, size: '256x256' } : { model: req.body.model || 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 } },
      tongyi: { url: `${baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/models`, key: apiKey },
      doubao: { url: `${baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'}/contents/generations/tasks`, key: apiKey, method: 'POST', body: { model: 'ep-20250501000000-xxxxx', content: [{ type: 'text', text: 'test' }] } },
    };

    const cfg = testUrls[provider];
    if (!cfg) return res.status(400).json({ message: '未知 provider' });

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
    } else if (cfg.method === 'POST') {
      const resp = await axios.post(cfg.url, cfg.body || {}, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` },
        timeout: 15000, validateStatus: () => true,
      });
      if (resp.status === 401) return res.json({ message: 'API Key 验证失败：密钥无效或已过期', data: { ok: false } });
      if (resp.status === 403) return res.json({ message: '密钥有效但无访问权限 (403)', data: { ok: false } });
      if (resp.status === 429) return res.json({ message: '请求过于频繁 (429)', data: { ok: false } });
      if (resp.status === 200 || resp.status === 400) return res.json({ message: '连接成功，API Key 有效', data: { ok: true } });
      return res.json({ message: `未知状态 ${resp.status}`, data: { ok: false } });
    } else {
      await axios.get(cfg.url, { headers: { 'Authorization': `Bearer ${cfg.key}` }, timeout: 10000 });
      res.json({ message: '连接成功', data: { ok: true } });
    }
  } catch (error) {
    const status = error.response?.status || 0;
    const msg = error.response?.data?.error?.message || error.message;
    if (status === 401) res.json({ message: 'Unauthorized: API Key 无效或已过期', data: { ok: false } });
    else if (status === 403) res.json({ message: 'Forbidden: 无权限访问该资源', data: { ok: false } });
    else if (status === 0 || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ECONNABORTED')) res.json({ message: `无法连接到 ${req.body.baseUrl}，请检查 Base URL 格式和网络连接`, data: { ok: false } });
    else if (status === 502 || status === 525) res.json({ message: `服务器代理错误 (${status})，请检查 Base URL 是否正确`, data: { ok: false } });
    else res.json({ message: `连接失败 (${status}): ${msg}`, data: { ok: false } });
  }
});

// 检查当前用户是否配置了可用LLM
router.get('/llm/status', async (req, res) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const configured = appConfig.hasLLMConfigured(settings);
    const active = appConfig.getActiveLLM(settings);
    res.json({ data: { configured, activeProvider: configured ? active.provider : null, model: configured ? active.model : null } });
  } catch (e) { next(e); }
});

// ===== AI 生成全局配置 =====

router.get('/ai', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: settings.aiConfig || null });
  } catch (e) { next(e); }
});

router.put('/ai', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    settings.aiConfig = req.body;
    await settings.save();
    res.json({ message: '已保存', data: settings.aiConfig });
  } catch (e) { next(e); }
});

// ===== 全部配置 =====

router.get('/all', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: { aiConfig: settings.aiConfig || {}, storageConfig: settings.storageConfig || {} } });
  } catch (e) { next(e); }
});

// ===== 对象存储配置 =====

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
    const { enabled, provider, endpoint, accessKeyId, accessKeySecret, bucket, prefix } = req.body;
    const cfg = settings.storageConfig || {};
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    if (provider) cfg.provider = provider;
    if (endpoint !== undefined) cfg.endpoint = endpoint;
    if (accessKeyId !== undefined) cfg.accessKeyId = accessKeyId;
    if (accessKeySecret && accessKeySecret !== maskSecret(cfg.accessKeySecret)) {
      cfg.accessKeySecret = accessKeySecret;
    }
    if (bucket !== undefined) cfg.bucket = bucket;
    if (prefix !== undefined) cfg.prefix = prefix;
    settings.storageConfig = cfg;
    await settings.save();
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
