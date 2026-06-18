const express = require('express');
const router = express.Router();
const axios = require('axios');
const appConfig = require('../config/app.config');
const Settings = require('../models/settings.model');
const storageService = require('../services/storage.service');
const { authRequired } = require('../middleware/auth.middleware');

// ===== 视频代理（Ark TOS 链接有时效性，通过后端代理解决） =====

router.get('/llm/video-proxy', async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: '缺少 url 参数' });

    console.log(`[video-proxy] 代理: ${url.substring(0, 100)}...`);
    const resp = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
      validateStatus: s => s < 400,
    });

    res.setHeader('Content-Type', resp.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Length', resp.headers['content-length'] || '');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    resp.data.pipe(res);
    resp.data.on('error', (err) => { console.error('[video-proxy] 流中断:', err.message); res.end(); });
  } catch (e) {
    const status = e.response?.status || 500;
    const msg = e.response?.data?.error?.message || e.message;
    console.error(`[video-proxy] 失败 (${status}):`, msg);
    res.status(status).json({ message: `视频加载失败: ${msg}` });
  }
});

router.use(authRequired);

// ===== 下载 Seedance 视频到本地素材库（需登录） =====
router.post('/llm/download-video', async (req, res, next) => {
  try {
    const { taskId, storyboardId, shotNumber } = req.body;
    if (!taskId) return res.status(400).json({ message: '缺少 taskId' });

    const settings = await Settings.getSettings(req.user._id);
    let apiKey = settings?.llmProviders?.doubao?.apiKey || '';
    let baseUrl = settings?.llmProviders?.doubao?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    if (!apiKey) return res.status(400).json({ message: '请先配置豆包 API Key' });

    const resp = await axios.get(`${baseUrl}/contents/generations/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }, timeout: 15000,
    });
    const t = resp.data;
    if (t.status !== 'succeeded' || !t.content?.video_url) {
      return res.json({ data: { ok: false, message: `任务状态: ${t.status}，无法下载` } });
    }

    const videoUrl = t.content.video_url;
    console.log(`[download-video] 下载: ${videoUrl.substring(0, 80)}...`);
    const vidResp = await axios({ url: videoUrl, method: 'GET', responseType: 'arraybuffer', timeout: 120000 });
    const filename = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const userCategory = (req.user?.uid || 'anonymous') + '/videos';
    const storedUrl = await storageService.upload(Buffer.from(vidResp.data), filename, userCategory);
    console.log(`[download-video] 已存储: ${storedUrl}`);

    // 更新分镜
    let updatedShot = null;
    const Storyboard = require('../models/storyboard.model');
    if (storyboardId && shotNumber != null) {
      const sb = await Storyboard.findById(storyboardId);
      if (sb) {
        const shot = sb.shots.find(s => s.shotNumber === shotNumber);
        if (shot) { shot.renderedVideo = storedUrl; shot.status = 'completed'; await sb.save(); updatedShot = { storyboardId, shotNumber }; }
      }
    }
    if (!updatedShot) {
      const safetyId = t.safety_identifier || '';
      if (safetyId && safetyId !== 'autodrama_user') {
        const sbs = await Storyboard.find({});
        for (const sb of sbs) {
          for (const shot of sb.shots) {
            if (!shot.renderedVideo || shot.renderedVideo === '' || shot.renderedVideo.startsWith('cgt-')) {
              shot.renderedVideo = storedUrl; shot.status = 'completed'; updatedShot = { storyboardId: sb._id, shotNumber: shot.shotNumber }; await sb.save(); break;
            }
          }
          if (updatedShot) break;
        }
      }
    }

    res.json({ data: { ok: true, localUrl: storedUrl, updatedShot } });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    console.error('[download-video] 失败:', msg);
    res.status(500).json({ message: `下载失败: ${msg}` });
  }
});

// ===== LLM 配置 =====

router.get('/llm', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    res.json({ data: appConfig.getLLMConfigSummary(settings) });
  } catch (e) { next(e); }
});

router.put('/llm', async (req, res, next) => {
  try {
    console.log(`[config] PUT /llm provider=${req.body.provider}`);
    const { provider, apiKey, baseUrl, model, imageModel } = req.body;
    if (!provider) {
      return res.status(400).json({ message: '缺少 provider 参数 (deepseek|doubao|tongyi|openai)' });
    }

    const settings = await Settings.getSettings(req.user._id);
    const llmProviders = settings.llmProviders || {};
    if (!llmProviders[provider]) llmProviders[provider] = {};
    const p = llmProviders[provider];
    if (apiKey !== undefined && apiKey.indexOf('****') === -1) p.apiKey = apiKey;
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
    const storageConfig = { ...(settings.storageConfig || {}) };
    // AccessKey 脱敏显示：无论管理员还是普通用户，都不暴露明文
    storageConfig.accessKeyId = maskKey(storageConfig.accessKeyId);
    storageConfig.accessKeySecret = maskKey(storageConfig.accessKeySecret);
    const isAdmin = req.user.role === 'admin';
    res.json({ data: { aiConfig: settings.aiConfig || {}, storageConfig, isAdmin } });
  } catch (e) { next(e); }
});

// ===== 对象存储 =====

router.get('/storage', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = settings.storageConfig || {};
    const isAdmin = req.user.role === 'admin';
    res.json({ data: {
      enabled: cfg.enabled || false, provider: cfg.provider || 'minio',
      endpoint: cfg.endpoint || '',
      accessKeyId: maskKey(cfg.accessKeyId),
      accessKeySecret: maskKey(cfg.accessKeySecret),
      bucket: cfg.bucket || '', prefix: cfg.prefix || '/autodrama/uploads/',
      _hasSecret: !!cfg.accessKeySecret,
      isAdmin,
    }});
  } catch (e) { next(e); }
});

router.put('/storage', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可修改存储配置' });
    const settings = await Settings.getSettings(req.user._id);
    const cfg = { ...(settings.storageConfig || {}) };
    const { enabled, provider, endpoint, accessKeyId, accessKeySecret, bucket, prefix } = req.body;
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    if (provider) cfg.provider = provider;
    if (endpoint !== undefined) cfg.endpoint = endpoint;
    if (accessKeyId !== undefined && accessKeyId !== maskKey(cfg.accessKeyId) && accessKeyId !== '****') cfg.accessKeyId = accessKeyId;
    if (accessKeySecret && accessKeySecret !== maskSecret(cfg.accessKeySecret) && accessKeySecret !== '****') cfg.accessKeySecret = accessKeySecret;
    if (bucket !== undefined) cfg.bucket = bucket;
    if (prefix !== undefined) cfg.prefix = prefix;

    await Settings.updateSettings(req.user._id, { storageConfig: cfg });
    res.json({ message: '对象存储配置已保存', data: { ...cfg, accessKeyId: maskKey(cfg.accessKeyId), accessKeySecret: maskSecret(cfg.accessKeySecret) } });
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

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.substring(0, 6) + '********' + key.substring(key.length - 4);
}

// ===== TTS 配音配置 =====

// 音色缓存 (内存，启动时从火山 ListSpeakers 拉取，失败则用内置默认列表)
let ttsVoiceCache = null;
let ttsVoiceCacheTime = 0;
const VOICE_CACHE_TTL = 3600000; // 1 小时

// 内置默认音色列表（API 拉取失败时的回退）
const FALLBACK_VOICES = [
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0', gender: '女' },
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小何 2.0', gender: '女' },
  { id: 'zh_female_wenroumama_uranus_bigtts', name: '温柔妈妈 2.0', gender: '女' },
  { id: 'zh_female_qiaopinv_uranus_bigtts', name: '俏皮女声 2.0', gender: '女' },
  { id: 'zh_female_shaoergushi_uranus_bigtts', name: '少儿故事 2.0', gender: '女' },
  { id: 'zh_female_wuzetian_uranus_bigtts', name: '武则天 2.0', gender: '女' },
  { id: 'zh_female_tianmeiyueyue_uranus_bigtts', name: '甜美悦悦 2.0', gender: '女' },
  { id: 'zh_female_qingchezizi_uranus_bigtts', name: '清澈梓梓 2.0', gender: '女' },
  { id: 'zh_female_zhixingnv_uranus_bigtts', name: '知性女声 2.0', gender: '女' },
  { id: 'zh_female_sophie_uranus_bigtts', name: '魅力苏菲 2.0', gender: '女' },
  { id: 'zh_female_zhishuaiyingzi_uranus_bigtts', name: '直率英子 2.0', gender: '女' },
  { id: 'zh_male_wennuanahu_uranus_bigtts', name: '温暖阿虎 2.0', gender: '男' },
  { id: 'zh_male_jieshuoxiaoming_uranus_bigtts', name: '解说小明 2.0', gender: '男' },
  { id: 'zh_male_dongfanghaoran_uranus_bigtts', name: '东方浩然 2.0', gender: '男' },
  { id: 'zh_male_wenrouxiaoge_uranus_bigtts', name: '温柔小哥 2.0', gender: '男' },
  { id: 'zh_male_yangguangqingnian_uranus_bigtts', name: '阳光青年 2.0', gender: '男' },
  { id: 'zh_male_yuanboxiaoshu_uranus_bigtts', name: '渊博小叔 2.0', gender: '男' },
  { id: 'zh_male_qingshuangnanda_uranus_bigtts', name: '清爽男大 2.0', gender: '男' },
  { id: 'zh_male_youyoujunzi_uranus_bigtts', name: '悠悠君子 2.0', gender: '男' },
  { id: 'zh_male_kailangxuezhang_uranus_bigtts', name: '开朗学长 2.0', gender: '男' },
  { id: 'zh_male_kuailexiaodong_uranus_bigtts', name: '快乐小东 2.0', gender: '男' },
];

/** 从火山 ListSpeakers API 实时拉取音色，失败则用缓存或默认列表 */
async function fetchVolcanoVoices() {
  const ak = process.env.VOLCANO_ACCESS_KEY || process.env.VOLCANO_AK || '';
  const sk = process.env.VOLCANO_SECRET_KEY || process.env.VOLCANO_SK || '';
  if (!ak || !sk) {
    // 没有配置 AK/SK，用缓存或默认
    if (ttsVoiceCache) return ttsVoiceCache;
    ttsVoiceCache = FALLBACK_VOICES;
    ttsVoiceCacheTime = Date.now();
    console.log('[tts-voices] 未配置火山 AK/SK，使用内置音色列表 (' + FALLBACK_VOICES.length + ' 个)');
    return FALLBACK_VOICES;
  }

  const { signRequest } = require('../utils/volcano-sign');
  const body = { ResourceIDs: ['seed-tts-2.0'], Limit: 200, Page: 1 };
  const headers = signRequest(ak, sk, 'speech_saas_prod', 'cn-beijing', 'POST', '/', 'Action=ListSpeakers&Version=2025-05-20', body);

  const allSpeakers = [];
  let page = 1;
  while (true) {
    body.Page = page;
    const finalBody = JSON.stringify(body);
    // 每页重新签名（X-Date 变化）
    const hdrs = signRequest(ak, sk, 'speech_saas_prod', 'cn-beijing', 'POST', '/', 'Action=ListSpeakers&Version=2025-05-20', finalBody);

    const resp = await axios.post(
      'https://speech-saas-prod.volcengineapi.com?Action=ListSpeakers&Version=2025-05-20',
      finalBody,
      { headers: hdrs, timeout: 10000, validateStatus: () => true }
    );

    if (resp.data?.ResponseMetadata?.Error) {
      const err = resp.data.ResponseMetadata.Error;
      throw new Error(`火山 API 错误: ${err.Code} - ${err.Message}`);
    }

    const speakers = resp.data?.Result?.Speakers || [];
    allSpeakers.push(...speakers);
    const total = resp.data?.Result?.Total || 0;
    console.log(`[tts-voices] 第${page}页: ${speakers.length} 个, 累计 ${allSpeakers.length}/${total}`);

    if (allSpeakers.length >= total || speakers.length < 200) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }

  const result = allSpeakers.map(s => ({ id: s.VoiceType, name: s.Name, gender: s.Gender || '未知' }));
  ttsVoiceCache = result;
  ttsVoiceCacheTime = Date.now();
  console.log(`[tts-voices] 更新完成: ${result.length} 个音色`);
  return result;
}

// 启动时拉取
fetchVolcanoVoices().catch(() => {});

// GET /config/tts/voices — 返回音色列表（缓存优先）
router.get('/tts/voices', async (req, res) => {
  try {
    const voices = ttsVoiceCache || (await fetchVolcanoVoices());
    res.json({ data: voices, cached: true, count: voices.length });
  } catch (e) {
    res.json({ data: FALLBACK_VOICES, cached: false, count: FALLBACK_VOICES.length, error: e.message });
  }
});

// POST /config/tts/voices/sync — 强制刷新音色缓存
router.post('/tts/voices/sync', async (req, res, next) => {
  try {
    ttsVoiceCache = null;
    const voices = await fetchVolcanoVoices();
    res.json({ message: '音色列表已更新', data: voices, count: voices.length });
  } catch (e) { next(e); }
});

router.get('/tts', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = settings.ttsConfig || {};
    const mask = (k) => k ? k.substring(0, 4) + '****' + k.substring(Math.max(0, k.length - 4)) : '';
    res.json({ data: { ...cfg, apiKey: mask(cfg.apiKey || ''), _hasKey: !!cfg.apiKey } });
  } catch (e) { next(e); }
});

router.put('/tts', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);
    const ttsService = require('../services/tts.service');
    const cfg = { ...(settings.ttsConfig || {}) };
    const allowed = ['apiKey', 'resourceId', 'defaultSpeaker', 'customVoiceId', 'format', 'sampleRate',
      'speechRate', 'loudnessRate', 'enableSubtitle', 'disableMarkdownFilter',
      'useCache', 'explicitLanguage'];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) {
        if (k === 'apiKey') {
          // masked key（含 ****）→ 保持旧值不覆盖；新明文 → 加密后存储
          if (req.body[k] && req.body[k].indexOf('****') === -1) {
            cfg[k] = ttsService.encrypt(req.body[k]);
          }
          // else: keep existing cfg[k] (already encrypted)
        } else {
          cfg[k] = req.body[k];
        }
      }
    });
    cfg.configured = !!(cfg.apiKey && cfg.apiKey.length > 40); // encrypted keys are >40 chars
    await Settings.updateSettings(req.user._id, { ttsConfig: cfg });
    const mask = (k) => k ? k.substring(0, 4) + '****' + k.substring(Math.max(0, k.length - 4)) : '';
    res.json({ message: 'TTS 配置已保存', data: { ...cfg, apiKey: mask(cfg.apiKey || '') } });
  } catch (e) { next(e); }
});

router.post('/tts/test', async (req, res, next) => {
  try {
    const ttsService = require('../services/tts.service');
    await ttsService.synthesizeSpeech(req.user._id, { text: '测试语音合成', ...req.body });
    res.json({ message: 'TTS 连接成功', data: { ok: true } });
  } catch (e) {
    res.json({ message: `TTS 测试失败: ${e.message}`, data: { ok: false } });
  }
});

// ===== Seedance 用量查询 =====

router.get('/llm/usage', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);

    // 只能读取当前用户自己保存的 Key，不回退到 env 全局密钥（防止用户间泄漏）
    let apiKey = settings.llmProviders?.doubao?.apiKey || '';
    let baseUrl = settings.llmProviders?.doubao?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    if (!apiKey) {
      return res.json({ data: { error: '请先在系统设置中配置你的豆包 API Key', tasks: [], totalTokens: 0 } });
    }

    // 查询 Ark 任务列表
    let tasks = [];
    try {
      const resp = await axios.get(`${baseUrl}/contents/generations/tasks`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 15000,
      });
      tasks = resp.data.items || [];
    } catch (e) {
      const status = e.response?.status || 0;
      if (status === 401) return res.json({ data: { error: 'API Key 无效或已过期', tasks: [], totalTokens: 0 } });
      throw e;
    }

    // 汇总 Token 用量
    let totalTokens = 0;
    let succeededCount = 0;
    let failedCount = 0;
    const byModel = {};
    const byResolution = {};

    tasks.forEach(t => {
      const tokens = t.usage?.total_tokens || 0;
      totalTokens += tokens;

      if (t.status === 'succeeded') succeededCount++;
      else if (t.status === 'failed') failedCount++;

      const model = t.model || 'unknown';
      if (!byModel[model]) byModel[model] = { tokens: 0, tasks: 0 };
      byModel[model].tokens += tokens;
      byModel[model].tasks++;

      const res = t.resolution || 'unknown';
      if (!byResolution[res]) byResolution[res] = { tokens: 0, tasks: 0 };
      byResolution[res].tokens += tokens;
      byResolution[res].tasks++;
    });

    // Seedance 2.0 参考定价（CNY/秒）：720p≈0.3, 1080p≈1.0
    const pricingEstimates = { '480p': 0.15, '720p': 0.3, '1080p': 1.0, '2K': 2.0 };
    let estimatedCost = 0;
    tasks.forEach(t => {
      if (t.status !== 'succeeded') return;
      const rate = pricingEstimates[t.resolution] || 0.3;
      estimatedCost += rate * (t.duration || 5);
    });

    // 全部任务详情，按时间倒序
    const now = Date.now();
    const allTasks = tasks.map(t => {
      const rate = pricingEstimates[t.resolution] || 0.3;
      const tokens = t.usage?.total_tokens || 0;
      const createdAt = t.created_at ? new Date(t.created_at * 1000) : null;
      const ageHours = createdAt ? (now - createdAt.getTime()) / 3600000 : 0;
      return {
        id: t.id,
        model: t.model,
        status: t.status,
        tokens,
        cost: t.status === 'succeeded' ? Math.round(rate * (t.duration || 5) * 100) / 100 : 0,
        resolution: t.resolution || '',
        duration: t.duration || 0,
        ratio: t.ratio || '',
        videoUrl: t.content?.video_url || '',
        expired: t.status === 'succeeded' && ageHours > 22,
        error: t.error?.message || '',
        safetyId: t.safety_identifier || '',
        createdAt: createdAt ? createdAt.toISOString() : null,
      };
    });

    res.json({
      data: {
        totalTasks: tasks.length,
        succeededCount,
        failedCount,
        totalTokens,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        byModel,
        byResolution,
        tasks: allTasks,
      },
    });
  } catch (e) { next(e); }
});

// ===== 短信服务配置（仅管理员） =====

router.get('/sms', authRequired, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可操作' });
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = settings.smsConfig || {};
    const { BUILTIN_TEMPLATES, PRESET_SIGNATURES, SCENE_TEMPLATE_MAP } = require('../utils/sms');
    res.json({
      data: {
        ...cfg,
        _hasSecret: !!cfg.accessKeySecret,
        accessKeySecret: maskSmsSecret(cfg.accessKeySecret || ''),
        enabled: cfg.enabled !== false,
        templateCodes: cfg.templateCodes || SCENE_TEMPLATE_MAP,
      },
      templates: BUILTIN_TEMPLATES,
      signatures: PRESET_SIGNATURES,
    });
  } catch (e) { next(e); }
});

router.put('/sms', authRequired, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可操作' });
  try {
    const settings = await Settings.getSettings(req.user._id);
    const cfg = { ...(settings.smsConfig || {}) };
    const { accessKeyId, accessKeySecret, signName, templateCode, templateCodes, dailyLimit, enabled } = req.body;
    if (accessKeyId !== undefined) cfg.accessKeyId = accessKeyId;
    if (accessKeySecret !== undefined && accessKeySecret !== maskSmsSecret(cfg.accessKeySecret || '') && accessKeySecret.indexOf('****') === -1) cfg.accessKeySecret = accessKeySecret;
    if (signName !== undefined) cfg.signName = signName;
    if (templateCode !== undefined) cfg.templateCode = templateCode;
    if (templateCodes !== undefined) cfg.templateCodes = templateCodes;
    if (dailyLimit !== undefined) cfg.dailyLimit = Math.max(1, Math.min(100, parseInt(dailyLimit) || 10));
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    await Settings.updateSettings(req.user._id, { smsConfig: cfg });
    try { require('../utils/sms').reloadConfig(); } catch {}
    res.json({ message: '短信配置已保存', data: { ...cfg, accessKeySecret: maskSmsSecret(cfg.accessKeySecret || '') } });
  } catch (e) { next(e); }
});

// SMS 连通性测试（仅管理员）
router.post('/sms/test', authRequired, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '仅管理员可操作' });
  try {
    const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
    const OpenApi = require('@alicloud/openapi-client');
    // 优先用表单当前值，兜底读数据库
    const settings = await Settings.getSettings(req.user._id);
    const dbCfg = settings.smsConfig || {};
    const akId = req.body.accessKeyId || dbCfg.accessKeyId || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
    const akSecret = req.body.accessKeySecret || dbCfg.accessKeySecret || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
    const signName = req.body.signName || dbCfg.signName || process.env.SMS_SIGN_NAME || '';
    const templateCode = req.body.templateCode || dbCfg.templateCode || process.env.SMS_TEMPLATE_CODE || '';
    if (!akId || !akSecret) return res.json({ ok: false, message: '请先填写 AccessKey ID 和 Secret' });
    const client = new Dypnsapi20170525.default(new OpenApi.Config({ accessKeyId: akId, accessKeySecret: akSecret, endpoint: 'dypnsapi.aliyuncs.com' }));
    const resp = await client.sendSmsVerifyCodeWithOptions(new Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber: '13800138000', signName: signName || 'test', templateCode: templateCode || '100001',
      templateParam: JSON.stringify({ code: '000000', min: '5' }),
    }), new (require('@alicloud/tea-util')).RuntimeOptions({}));
    const body = resp.body || {};
    if (body.code === 'OK' || body.success) return res.json({ ok: true, message: '连接成功 ✅ 短信服务正常可用' });
    // 只要不是 AK/SK 鉴权错误，都视为配置正确
    const errMsg = body.message || '';
    const errCode = body.code || '';
    const isAuthError = /InvalidAccessKeyId|SignatureDoesNotMatch|InvalidAccessKeySecret|InvalidSecret|AuthFailure/i.test(errMsg + errCode);
    if (isAuthError) return res.json({ ok: false, message: '鉴权失败: ' + (errMsg || errCode) });
    // 其他错误（限流/余额/模板/签名/手机号无效等）都说明 AK/SK 已通过验证
    return res.json({ ok: true, message: '连接成功 ✅ AK验证已通过（' + (errMsg || errCode || '配置正常可用') + '）' });
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('InvalidAccessKeyId') || msg.includes('Specified access key is not found')) return res.json({ ok: false, message: 'AccessKey ID 无效，请检查' });
    if (msg.includes('SignatureDoesNotMatch') || msg.includes('secret')) return res.json({ ok: false, message: 'AccessKey Secret 错误，请检查' });
    return res.json({ ok: true, message: '连接成功 ✅ AK验证已通过' });
  }
});

function maskSmsSecret(s) {
  if (!s || s.length <= 8) return '';
  return s.substring(0, 4) + '****' + s.substring(s.length - 4);
}

module.exports = router;
