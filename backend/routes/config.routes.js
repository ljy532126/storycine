const express = require('express');
const router = express.Router();
const axios = require('axios');
const appConfig = require('../config/app.config');
const Settings = require('../models/settings.model');
const storageService = require('../services/storage.service');

// 获取当前LLM配置摘要（密钥脱敏）
router.get('/llm', (req, res) => {
  res.json({ data: appConfig.getLLMConfigSummary() });
});

// 运行时更新LLM配置（同时持久化到MongoDB）
router.put('/llm', async (req, res, next) => {
  try {
    const { provider, apiKey, baseUrl, model } = req.body;

    if (!provider) {
      return res.status(400).json({ message: '缺少provider参数 (deepseek|doubao|tongyi|openai)' });
    }

    appConfig.setLLMConfig(provider, { apiKey, baseUrl, model });

    // 异步持久化到 MongoDB，不阻塞响应
    appConfig.persistLLMConfig().catch(e => console.error('Persist error:', e));

    const updated = appConfig.llm[provider];
    const masked = appConfig.getLLMConfigSummary()[provider];

    res.json({
      message: `${provider} 配置已更新（已保存到数据库，重启不丢失）`,
      data: {
        provider,
        hasApiKey: !!updated.apiKey,
        summary: masked,
      },
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
      openai: { url: req.body.model?.includes('image') ? `${baseUrl || 'https://api.openai.com/v1'}/images/generations` : `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`, key: apiKey, method: 'POST', body: req.body.model?.includes('image') ? { model: req.body.model, prompt: 'test', n: 1, size: '256x256' } : { model: req.body.model || 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 } },
      tongyi: { url: `${baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/models`, key: apiKey },
      doubao: { url: `${baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'}/contents/generations/tasks`, key: apiKey, method: 'POST', body: { model: 'ep-20250501000000-xxxxx', content: [{ type: 'text', text: 'test' }] } },
    };

    const cfg = testUrls[provider];
    if (!cfg) return res.status(400).json({ message: '未知 provider' });

    // 轻量连通测试
    if (provider === 'doubao') {
      const arkBase = baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
      const modelId = req.body.model || 'doubao-seedance-2-0-260128';
      // 用视频生成接口最小请求测试连通（不会真正生成视频，只验证 key 和 model 有效性）
      const resp = await axios.post(`${arkBase}/contents/generations/tasks`, {
        model: modelId,
        content: [{ type: 'text', text: 'test' }],
        resolution: '480p',
        ratio: '1:1',
        duration: 4,
      }, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        timeout: 15000, validateStatus: () => true,
      });
      if (resp.status === 401) return res.json({ message: 'API Key 验证失败：密钥无效或已过期', data: { ok: false } });
      if (resp.status === 403) return res.json({ message: '密钥有效但无访问权限 (403)，请确认已开通 Seedance 2.0', data: { ok: false } });
      if (resp.status === 200 || resp.status === 201) return res.json({ message: '连接成功，API Key 和 Model 均有效', data: { ok: true } });
      if (resp.status === 400) return res.json({ message: `请求格式错误 (400): ${resp.data?.error?.message || ''}，请检查 Model 是否正确`, data: { ok: false } });
      return res.json({ message: `未知状态 ${resp.status}，请检查 Base URL 和 Model`, data: { ok: false } });
    } else if (cfg.method === 'POST') {
      const resp = await axios.post(cfg.url, cfg.body || {}, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` },
        timeout: 15000, validateStatus: () => true,
      });
      if (resp.status === 401) return res.json({ message: 'API Key 验证失败：密钥无效或已过期', data: { ok: false } });
      if (resp.status === 403) return res.json({ message: '密钥有效但无访问权限 (403)', data: { ok: false } });
      if (resp.status === 429) return res.json({ message: '请求过于频繁 (429)，请稍后重试', data: { ok: false } });
      // 200/400 都说明 API Key 有效（400=参数错误但Auth通过）
      if (resp.status === 200 || resp.status === 400) return res.json({ message: '连接成功，API Key 有效', data: { ok: true } });
      return res.json({ message: `未知状态 ${resp.status}`, data: { ok: false } });
    } else {
      await axios.get(cfg.url, {
        headers: { 'Authorization': `Bearer ${cfg.key}` },
        timeout: 10000,
      });
      res.json({ message: '连接成功', data: { ok: true } });
    }
  } catch (error) {
    const status = error.response?.status || 0;
    const msg = error.response?.data?.error?.message || error.message;
    if (status === 401) res.json({ message: 'Unauthorized: API Key 无效或已过期', data: { ok: false } });
    else if (status === 403) res.json({ message: 'Forbidden: 无权限访问该资源', data: { ok: false } });
    else if (status === 502 || status === 525 || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) res.json({ message: `无法连接 OpenAI 服务器 (${status})，国内网络需配置代理。请在 .env 中设置 HTTPS_PROXY 或使用 API 中转地址`, data: { ok: false } });
    else res.json({ message: `连接失败 (${status}): ${msg}`, data: { ok: false } });
  }
});

// 检查是否有可用LLM
router.get('/llm/status', (req, res) => {
  const configured = appConfig.hasLLMConfigured();
  const active = appConfig.getActiveLLM();
  res.json({
    data: {
      configured,
      activeProvider: configured ? active.provider : null,
      model: configured ? active.model : null,
    },
  });
});

// ===== AI 生成全局配置 =====

router.get('/ai', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({ data: settings.aiConfig || null });
  } catch (e) { next(e); }
});

router.put('/ai', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    settings.aiConfig = req.body;
    await settings.save();
    console.log('[config] AI generation config saved');
    res.json({ message: '已保存', data: settings.aiConfig });
  } catch (e) { next(e); }
});

// ===== 对象存储配置 =====

// 获取全部配置（含 AI 生成 + 对象存储）
router.get('/all', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      data: {
        aiConfig: settings.aiConfig || {},
        storageConfig: settings.storageConfig || {},
      },
    });
  } catch (e) { next(e); }
});

// 获取对象存储配置（密钥脱敏）
router.get('/storage', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    const cfg = settings.storageConfig || {};
    res.json({
      data: {
        enabled: cfg.enabled || false,
        provider: cfg.provider || 'minio',
        endpoint: cfg.endpoint || '',
        accessKeyId: cfg.accessKeyId || '',
        accessKeySecret: maskSecret(cfg.accessKeySecret),
        bucket: cfg.bucket || '',
        prefix: cfg.prefix || '/autodrama/uploads/',
        _hasSecret: !!cfg.accessKeySecret,
      },
    });
  } catch (e) { next(e); }
});

// 保存对象存储配置
router.put('/storage', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    const { enabled, provider, endpoint, accessKeyId, accessKeySecret, bucket, prefix } = req.body;
    const cfg = settings.storageConfig || {};
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    if (provider) cfg.provider = provider;
    if (endpoint !== undefined) cfg.endpoint = endpoint;
    if (accessKeyId !== undefined) cfg.accessKeyId = accessKeyId;
    // 只有传入非空密钥时才更新（允许分批保存）
    if (accessKeySecret && accessKeySecret !== maskSecret(cfg.accessKeySecret)) {
      cfg.accessKeySecret = accessKeySecret;
    }
    if (bucket !== undefined) cfg.bucket = bucket;
    if (prefix !== undefined) cfg.prefix = prefix;
    settings.storageConfig = cfg;
    await settings.save();
    console.log('[config] Storage config saved, enabled:', cfg.enabled, 'provider:', cfg.provider);
    res.json({ message: '对象存储配置已保存', data: { ...cfg, accessKeySecret: maskSecret(cfg.accessKeySecret) } });
  } catch (e) { next(e); }
});

// 测试对象存储连接
router.post('/storage/test', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    const cfg = req.body || settings.storageConfig || {};
    // 如果前端没传密钥，用数据库中的完整密钥
    if (!cfg.accessKeySecret || cfg.accessKeySecret === maskSecret(settings.storageConfig?.accessKeySecret)) {
      cfg.accessKeySecret = settings.storageConfig?.accessKeySecret || '';
    }
    const result = await storageService.testConnection(cfg);
    res.json(result);
  } catch (e) { next(e); }
});

// 获取对象存储厂商的地域与 Endpoint 映射列表
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
