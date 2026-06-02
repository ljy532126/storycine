/**
 * 火山引擎 openspeech V3 单向 SSE TTS 服务
 * POST https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse
 */
const axios = require('axios');
const crypto = require('crypto');
const Settings = require('../models/settings.model');
const TtsAudio = require('../models/tts-audio.model');
const Storyboard = require('../models/storyboard.model');
const storageService = require('./storage.service');

const VOLCANO_TTS_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse';
const TTS_TIMEOUT = 30000;

// AES 加密/解密
const ENC_KEY = (() => {
  const raw = process.env.TTS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'storycine-tts-default-key32b';
  return crypto.createHash('sha256').update(raw).digest().slice(0, 32);
})();
const IV_LEN = 16;

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 2) return ciphertext;
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return ciphertext; }
}

async function getTTSConfig(userId) {
  const settings = await Settings.getSettings(userId);
  const cfg = settings.ttsConfig || {};
  return { ...cfg, apiKey: cfg.apiKey ? decrypt(cfg.apiKey) : '', _raw: cfg };
}

/** 通过 SSE HTTP POST 合成单句语音 */
function synthesizeViaSSE(apiKey, resourceId, body) {
  return new Promise((resolve, reject) => {
    let audioBuffer = Buffer.alloc(0);
    let subtitles = [];
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; reject(new Error('TTS 合成超时')); }
    }, TTS_TIMEOUT);

    axios.post(VOLCANO_TTS_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': resourceId,
      },
      responseType: 'stream',
      timeout: TTS_TIMEOUT,
      validateStatus: s => s < 500,
    }).then(resp => {
      if (resp.status === 401 || resp.status === 403) {
        clearTimeout(timer);
        if (!resolved) { resolved = true; reject(new Error(`火山鉴权失败 (HTTP ${resp.status})，请检查 API Key 和 Resource ID`)); }
        return;
      }
      if (resp.status >= 400) {
        clearTimeout(timer);
        let body = '';
        resp.data.on('data', c => body += c.toString());
        resp.data.on('end', () => {
          if (!resolved) { resolved = true; reject(new Error(`火山返回错误 (HTTP ${resp.status}): ${body.substring(0, 200)}`)); }
        });
        return;
      }

      let buffer = '';
      resp.data.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.substring(5).trim();
          if (!payload) continue;
          try {
            const json = JSON.parse(payload);
            // event 352 (TTSResponse): 音频数据在 json.data 里，base64 编码
            if (json.data && typeof json.data === 'string' && json.data.length > 100) {
              try { audioBuffer = Buffer.concat([audioBuffer, Buffer.from(json.data, 'base64')]); } catch {}
            }
            // event 351 (TTSSentenceEnd): 可能含字幕
            if (json.sentence?.words) subtitles.push(...json.sentence.words);
            // event 153 (SessionFailed): 错误
            if (json.code === 55000000 || json.code === 45000000) {
              console.warn('[tts] SSE 服务端错误:', json.code, json.message);
            }
          } catch {
            // 非 JSON 的 data 行（例如纯 base64），直接追加
            try { audioBuffer = Buffer.concat([audioBuffer, Buffer.from(payload, 'base64')]); } catch {}
          }
        }
      });

      resp.data.on('end', () => {
        clearTimeout(timer);
        if (buffer.trim().startsWith('data:')) {
          const payload = buffer.trim().substring(5).trim();
          if (payload) {
            try {
              const json = JSON.parse(payload);
              if (json.data && typeof json.data === 'string') {
                try { audioBuffer = Buffer.concat([audioBuffer, Buffer.from(json.data, 'base64')]); } catch {}
              }
            } catch { try { audioBuffer = Buffer.concat([audioBuffer, Buffer.from(payload, 'base64')]); } catch {} }
          }
        }
        if (!resolved) {
          resolved = true;
          if (audioBuffer.length > 0) {
            resolve({ audio: audioBuffer, subtitles });
          } else {
            reject(new Error('TTS 未返回音频数据'));
          }
        }
      });

      resp.data.on('error', (err) => {
        clearTimeout(timer);
        if (!resolved) { resolved = true; reject(err); }
      });
    }).catch(err => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        if (err.response?.status === 401 || err.response?.status === 403) {
          reject(new Error('火山鉴权失败，请检查 API Key 和 Resource ID'));
        } else {
          reject(new Error(`TTS 请求失败: ${err.message}`));
        }
      }
    });
  });
}

/** 单次语音合成：鉴权 → SSE → 落盘 → DB */
async function synthesizeSpeech(userId, params) {
  const ttsCfg = await getTTSConfig(userId);
  const apiKey = (params.apiKey || ttsCfg.apiKey || '').trim();
  if (!apiKey) throw Object.assign(new Error('请先在系统设置中配置火山 TTS API Key'), { statusCode: 400 });

  const resourceId = params.resourceId || ttsCfg.resourceId || 'seed-tts-2.0';
  const speaker = params.speaker || ttsCfg.defaultSpeaker || 'zh_female_vv_uranus_bigtts';
  const format = params.format || ttsCfg.format || 'mp3';

  const addObj = {};
  if (params.disableMarkdownFilter !== undefined ? params.disableMarkdownFilter : ttsCfg.disableMarkdownFilter !== false) addObj.disable_markdown_filter = true;
  if (params.useCache !== undefined ? params.useCache : ttsCfg.useCache !== false) addObj.use_cache = true;
  if (params.explicitLanguage || ttsCfg.explicitLanguage) addObj.explicit_language = params.explicitLanguage || ttsCfg.explicitLanguage || 'zh-cn';

  const body = {
    user: { uid: userId?.toString() || 'storycine' },
    req_params: {
      text: params.text,
      speaker,
      audio_params: {
        format,
        sample_rate: params.sampleRate ?? ttsCfg.sampleRate ?? 24000,
        speech_rate: params.speechRate ?? ttsCfg.speechRate ?? 0,
        loudness_rate: params.loudnessRate ?? ttsCfg.loudnessRate ?? 0,
        enable_subtitle: params.enableSubtitle !== undefined ? params.enableSubtitle : ttsCfg.enableSubtitle !== false,
      },
      additions: JSON.stringify(addObj),
    },
  };

  // 可选情绪
  if (params.emotion) body.req_params.audio_params.emotion = params.emotion;
  if (params.emotionScale) body.req_params.audio_params.emotion_scale = params.emotionScale;

  // ICL 复刻音色
  if (resourceId === 'seed-icl-2.0' && (params.customVoiceId || ttsCfg.customVoiceId)) {
    body.req_params.speaker = params.customVoiceId || ttsCfg.customVoiceId;
  }

  console.log(`[tts] 开始合成: "${params.text.substring(0, 50)}..." speaker=${body.req_params.speaker}`);

  const { audio, subtitles } = await synthesizeViaSSE(apiKey, resourceId, body);

  const ext = format === 'ogg_opus' ? 'ogg' : format;
  const filename = `tts-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const userUid = `TTS-${userId.toString().slice(-8)}`;
  const category = `${userUid}/tts`;
  const audioUrl = await storageService.upload(audio, filename, category);

  console.log(`[tts] 合成完成: ${audioUrl} (${(audio.length / 1024).toFixed(1)} KB)`);

  if (!params.projectId) return { audioUrl, subtitles, duration: 0 };

  const doc = await TtsAudio.create({
    userId,
    projectId: params.projectId,
    scriptId: params.scriptId,
    storyboardId: params.storyboardId,
    shotNumber: params.shotNumber,
    episodeNumber: params.episodeNumber,
    characterName: params.characterName || '',
    text: params.text,
    audioUrl,
    format,
    duration: subtitles.length > 0 ? Math.ceil(subtitles[subtitles.length - 1]?.end || 0) : 0,
    subtitles,
    ttsParams: { speaker: body.req_params.speaker, format },
  });

  if (params.storyboardId && params.shotNumber != null) {
    try {
      const sb = await Storyboard.findById(params.storyboardId);
      if (sb) {
        const shot = sb.shots.find(s => s.shotNumber === params.shotNumber);
        if (shot) {
          if (!shot.dialogue) shot.dialogue = {};
          shot.dialogue.audioUrl = audioUrl;
          await sb.save();
        }
      }
    } catch (e) { console.warn('[tts] 更新分镜 audioUrl 失败:', e.message); }
  }

  return { id: doc._id, audioUrl, subtitles, duration: doc.duration };
}

async function batchSynthesize(userId, shots) {
  const results = [];
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    try {
      const r = await synthesizeSpeech(userId, { ...s, userId });
      results.push({ shotNumber: s.shotNumber, success: true, ...r });
    } catch (e) {
      results.push({ shotNumber: s.shotNumber, success: false, error: e.message });
    }
    if (i < shots.length - 1) await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

module.exports = { synthesizeSpeech, batchSynthesize, getTTSConfig, encrypt, decrypt };
