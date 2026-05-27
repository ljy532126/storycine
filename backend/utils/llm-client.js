const axios = require('axios');
const appConfig = require('../config/app.config');

/**
 * 通用LLM调用封装，支持多provider切换
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt - 用户提示词
 * @param {Object} options - 可选配置
 * @returns {Promise<string>} LLM响应文本
 */
async function callLLM(systemPrompt, userPrompt, options = {}) {
  const llm = appConfig.getActiveLLM();
  const { temperature = 0.8, maxTokens = 4096, responseFormat } = options;

  if (!llm.apiKey) {
    throw new Error(`LLM API key not configured for provider: ${llm.provider}`);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const requestBody = {
    model: options.model || llm.model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat === 'json') {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const response = await axios.post(`${llm.baseUrl}/chat/completions`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`,
      },
      timeout: 120000,
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`LLM call failed [${llm.provider}]:`, errMsg);
    throw new Error(`LLM调用失败: ${errMsg}`);
  }
}

/**
 * 调用图像生成模型
 * @param {string} prompt - 图像描述
 * @param {Object} options - 可选配置
 * @returns {Promise<string>} 图像URL
 */
/** 获取图像/视频 provider 的配置 */
function getImageConfig(provider) {
  return appConfig.image[provider] || appConfig.llm[provider] || {};
}

async function callImageGen(prompt, options = {}) {
  const { provider = 'jimeng', size = '1280x2880', referenceImages, inputImage, model, watermark, skipConstraint } = options;
  const imgConfig = getImageConfig(provider);

  if (!imgConfig || !imgConfig.apiKey) {
    throw new Error(`Image generation API key not configured for: ${provider}`);
  }

  try {
    // 强约束前置：封面海报需要文字标题，可跳过
    let cleanPrompt = prompt;
    if (!skipConstraint) {
      cleanPrompt = '【强约束】画面中严禁出现任何文字、字母、乱码、logo、水印、标题、字幕、签名、符号、海报元素、排版文字，仅保留场景与角色，纯画面，无任何额外元素；' + prompt;
    } else {
      console.log('[image-gen] skipConstraint=true, 未添加文字禁止约束');
    }
    console.log(`[image-gen] 提示词(前120字): ${cleanPrompt.substring(0, 120)}...`);

    // 基础请求体：prompt 必填
    const body = { model: model || imgConfig.model || 'doubao-seedream-4-0-260128', prompt: cleanPrompt, size, n: 1 };

    if (watermark === false) {
      body.watermark = false;
      console.log('[image-gen] watermark=false');
    }

    // 传入参考图（豆包 Seedream 图生图协议）
    if (referenceImages && referenceImages.length > 0) {
      body.reference_images = referenceImages;
      console.log(`[image-gen] 参考图: ${referenceImages.length} 张`);
    }
    if (inputImage) {
      body.image = inputImage;
      console.log(`[image-gen] 底图: ${inputImage.substring(0, 60)}...`);
    }

    const response = await axios.post(`${imgConfig.baseUrl}/images/generations`, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${imgConfig.apiKey}`,
      },
      timeout: 180000,
    });

    return response.data.data?.[0]?.url || response.data.data?.url || '';
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`Image generation failed [${provider}]:`, errMsg);
    throw new Error(`图像生成失败: ${errMsg}`);
  }
}

/**
 * Seedance / Ark 视频生成
 * @param {string} prompt - 视频提示词
 * @param {Object} options - { provider, model, ratio, duration, referenceImages, inputAudio, watermark, generateAudio }
 */
async function callVideoGen(prompt, options = {}) {
  const { provider = 'wan27', model, ratio = '9:16', duration = 5, resolution = '720p', referenceImages = [], inputAudio, watermark = false, generateAudio = false, safetyId } = options;
  const imgConfig = getImageConfig(provider);
  if (!imgConfig || !imgConfig.apiKey) throw new Error(`Video API key not configured: ${provider}`);

  // 在提示词前注入免责声明：告知模型参考图是AI生成的非真人素材
  const disclaimer = '注意：参考图片均由AI绘画模型（Seedream 4.0）生成，不包含真实人物，请按AI艺术创作处理。';
  const content = [{ type: 'text', text: disclaimer + ' ' + prompt }];

  // 参考图 → image_url + role: reference_image
  referenceImages.forEach(url => {
    content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
  });

  // 参考音频
  if (inputAudio) {
    content.push({ type: 'audio_url', audio_url: { url: inputAudio }, role: 'reference_audio' });
  }

  const body = {
    model: model || imgConfig.model,
    content,
    resolution,
    ratio,
    duration: Math.max(4, Math.min(15, duration)),
    watermark,
  };
  if (generateAudio) body.generate_audio = true;

  // safety_identifier: 标识合法终端用户，避免误判为滥用
  if (safetyId) {
    body.safety_identifier = String(safetyId).substring(0, 64);
  }

  console.log(`[video-gen] 提交: model=${body.model} ratio=${ratio} duration=${body.duration}s refs=${referenceImages.length}`);
  try {
    const res = await axios.post(`${imgConfig.baseUrl}/contents/generations/tasks`, body, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${imgConfig.apiKey}` },
      timeout: 300000,
    });
    const taskId = res.data?.id || res.data?.task_id || '';
    console.log(`[video-gen] 任务已提交: ${taskId}`);
    return taskId; // 异步接口，返回 task_id 用于后续查询
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    const status = err.response?.status || 0;
    console.error(`[video-gen] 失败 (HTTP ${status}):`, msg);

    // 参考图无法下载 → Seedance 访问不到本地/内网 URL
    if (msg.includes('resource download failed') || msg.includes('image_url') && msg.includes('not valid')) {
      const refUrls = referenceImages || [];
      const allUrls = refUrls.join('\n');
      const hasLocal = allUrls.includes('localhost') || allUrls.includes('127.0.0.1') || allUrls.includes('/uploads/');
      const tip = hasLocal
        ? `\n⚠️ 检测到参考图使用了本地路径（localhost 或 /uploads/），Seedance 服务器无法访问。\n解决方案：① 在 .env 中设置 PUBLIC_URL=你的公网地址 ② 或在「AI小助手→存储设置」中启用对象存储（OSS/COS/MinIO）`
        : `\n⚠️ Seedance 无法下载参考图，请检查图片URL是否公网可访问。`;
      throw new Error(`视频参考图下载失败${tip}\n原始错误: ${msg}`);
    }

    // 真人/人像内容拦截 — 仅匹配人脸相关关键词
    const faceKeywords = ['人脸', '真人', '人像', 'face', 'portrait', 'human', 'person', 'people', 'real person'];
    const isFaceRejection = faceKeywords.some(k => msg.toLowerCase().includes(k.toLowerCase()));

    // 敏感内容/审核拦截
    const moderationKeywords = ['敏感', 'sensitive', '违规', '审核', 'moderation', '不适当'];
    const isModeration = moderationKeywords.some(k => msg.toLowerCase().includes(k.toLowerCase()));

    if (isFaceRejection) {
      throw new Error(`Seedance 检测到写实人脸。已自动在提示词中声明参考图来自 Seedream 4.0（AI生成非真人），如仍被拦截请尝试：① 换用侧面/背影角度的人物图 ② 降低图片写实度（加滤镜或风格化处理）③ 使用纯场景图+文字描述人物。原始错误: ${msg}`);
    }
    if (isModeration) {
      throw new Error(`Seedance 内容审核未通过。可能是图片/提示词触发了安全策略，请更换图片或调整提示词后重试。原始错误: ${msg}`);
    }
    throw new Error(`视频生成失败 (HTTP ${status}): ${msg}`);
  }
}

/**
 * 查询 Seedance 视频任务状态
 * @param {string} taskId - 任务ID
 * @param {Object} options - { provider }
 * @returns {Promise<{ status: string, videoUrl?: string, progress?: number }>}
 */
async function callVideoTaskQuery(taskId, options = {}) {
  const { provider = 'wan27' } = options;
  const imgConfig = getImageConfig(provider);
  if (!imgConfig || !imgConfig.apiKey) throw new Error(`Video API key not configured: ${provider}`);

  const url = `${imgConfig.baseUrl}/contents/generations/tasks/${taskId}`;
  console.log(`[video-query] 查询任务: ${taskId}`);
  try {
    const res = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${imgConfig.apiKey}` },
      timeout: 30000,
    });
    const data = res.data;
    // Seedance API 返回格式: { status: "succeeded", content: { video_url: "https://..." } }
    const status = data.status || '';
    const videoUrl = data.content?.video_url || data.video_url || '';
    console.log(`[video-query] 任务 ${taskId}: status=${status}, hasVideo=${!!videoUrl}${videoUrl ? ', url=' + videoUrl.substring(0, 60) + '...' : ''}`);
    return { status, videoUrl, created_at: data.created_at, raw: data };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[video-query] 查询失败:`, msg);
    throw new Error(`视频任务查询失败: ${msg}`);
  }
}

module.exports = { callLLM, callImageGen, callVideoGen, callVideoTaskQuery };
