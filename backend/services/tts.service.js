/**
 * 火山引擎 openspeech V3 双向 WebSocket TTS 代理服务
 */
const WebSocket = require('ws');
const crypto = require('crypto');
const Settings = require('../models/settings.model');
const TtsAudio = require('../models/tts-audio.model');
const Storyboard = require('../models/storyboard.model');
const storageService = require('./storage.service');

const VOLCANO_WSS = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';
const WS_TIMEOUT = 30000;

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
  if (parts.length !== 2) return ciphertext; // legacy plaintext
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return ciphertext; }
}

/** 读取用户 TTS 配置，apiKey 解密 */
async function getTTSConfig(userId) {
  const settings = await Settings.getSettings(userId);
  const cfg = settings.ttsConfig || {};
  return {
    ...cfg,
    apiKey: cfg.apiKey ? decrypt(cfg.apiKey) : '',
    _raw: cfg,
  };
}

/** 建立火山双向 WebSocket 并完成一次合成 */
function synthesizeViaWS(headers, params) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(VOLCANO_WSS, { headers, handshakeTimeout: 10000 });
    const audioChunks = [];
    const subtitles = [];
    let resolved = false;
    let connectId = '';

    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; ws.close(); reject(new Error('TTS 合成超时')); }
    }, WS_TIMEOUT);

    ws.on('open', () => {
      ws.send(JSON.stringify({ event: 1, version: 'v3' }));
    });

    ws.on('message', (raw) => {
      try {
        if (typeof raw === 'string') {
          const msg = JSON.parse(raw);
          switch (msg.event) {
            case 50: // ConnectionStarted
              connectId = msg.payload?.connect_id || '';
              ws.send(JSON.stringify({
                event: 100, version: 'v3',
                payload: {
                  user: { uid: params.userId?.toString() || 'storycine' },
                  req_params: {
                    speaker: params.speaker,
                    audio_params: {
                      format: params.format || 'mp3',
                      sample_rate: params.sampleRate || 24000,
                      speech_rate: params.speechRate ?? 0,
                      loudness_rate: params.loudnessRate ?? 0,
                      ...(params.emotion ? { emotion: params.emotion } : {}),
                      ...(params.emotionScale ? { emotion_scale: params.emotionScale } : {}),
                      enable_subtitle: params.enableSubtitle !== false,
                    },
                    additions: {
                      disable_markdown_filter: params.disableMarkdownFilter !== false,
                      use_cache: params.useCache !== false,
                      use_tag_parser: params.useTagParser === true,
                      ...(params.explicitLanguage ? { explicit_language: params.explicitLanguage } : {}),
                      silence_duration: params.silenceDuration ?? 0,
                    },
                    model: params.model || 'seed-tts-2.0-standard',
                  },
                },
              }));
              break;
            case 150: // SessionStarted
              ws.send(JSON.stringify({ event: 200, version: 'v3', payload: { text: params.text } }));
              break;
            case 350: // TTSSentenceStart
              break;
            case 351: // TTSSentenceEnd
              if (msg.payload?.subtitles) {
                subtitles.push(...msg.payload.subtitles);
              }
              break;
            case 152: // SessionFinished
              break;
          }
        } else if (raw instanceof Buffer) {
          audioChunks.push(raw);
        }
      } catch {}
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        if (audioChunks.length > 0) {
          resolve({ audio: Buffer.concat(audioChunks), subtitles });
        } else {
          reject(new Error('TTS 未返回音频数据'));
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      if (!resolved) { resolved = true; reject(err); }
    });
  });
}

/** 单次语音合成：鉴权 → WS 代理 → 落盘 → 写入 DB */
async function synthesizeSpeech(userId, params) {
  const ttsCfg = await getTTSConfig(userId);
  const apiKey = params.apiKey || ttsCfg.apiKey;
  if (!apiKey) throw Object.assign(new Error('请先在系统设置中配置火山 TTS API Key'), { statusCode: 400 });

  const resourceId = params.resourceId || ttsCfg.resourceId || 'seed-tts-2.0';
  const headers = { 'X-Api-Key': apiKey, 'X-Api-Resource-Id': resourceId };
  const connectId = crypto.randomUUID();
  headers['X-Api-Connect-Id'] = connectId;

  const synthParams = {
    userId,
    text: params.text,
    speaker: params.speaker || ttsCfg.defaultSpeaker,
    format: params.format || ttsCfg.format || 'mp3',
    sampleRate: params.sampleRate ?? ttsCfg.sampleRate ?? 24000,
    speechRate: params.speechRate ?? ttsCfg.speechRate ?? 0,
    loudnessRate: params.loudnessRate ?? ttsCfg.loudnessRate ?? 0,
    emotion: params.emotion !== undefined ? params.emotion : ttsCfg.emotion || '',
    emotionScale: params.emotionScale ?? ttsCfg.emotionScale ?? 4,
    enableSubtitle: params.enableSubtitle !== undefined ? params.enableSubtitle : ttsCfg.enableSubtitle !== false,
    disableMarkdownFilter: params.disableMarkdownFilter !== undefined ? params.disableMarkdownFilter : ttsCfg.disableMarkdownFilter !== false,
    useCache: params.useCache !== undefined ? params.useCache : ttsCfg.useCache !== false,
    useTagParser: params.useTagParser !== undefined ? params.useTagParser : ttsCfg.useTagParser === true,
    explicitLanguage: params.explicitLanguage || ttsCfg.explicitLanguage || 'zh-cn',
    silenceDuration: params.silenceDuration ?? ttsCfg.silenceDuration ?? 0,
    model: params.model || ttsCfg.model || 'seed-tts-2.0-standard',
  };

  if (resourceId === 'seed-icl-2.0' && (params.customVoiceId || ttsCfg.customVoiceId)) {
    synthParams.speaker = params.customVoiceId || ttsCfg.customVoiceId;
  }

  console.log(`[tts] 开始合成: "${synthParams.text.substring(0, 50)}..." speaker=${synthParams.speaker}`);

  const { audio, subtitles } = await synthesizeViaWS(headers, synthParams);

  const ext = synthParams.format === 'ogg_opus' ? 'ogg' : synthParams.format;
  const filename = `tts-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const userUid = `TTS-${userId.toString().slice(-8)}`;
  const category = `${userUid}/tts`;
  const audioUrl = await storageService.upload(audio, filename, category);

  console.log(`[tts] 合成完成: ${audioUrl} (${(audio.length / 1024).toFixed(1)} KB)`);

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
    format: synthParams.format,
    duration: subtitles.length > 0 ? Math.ceil(subtitles[subtitles.length - 1]?.end || 0) : 0,
    subtitles,
    ttsParams: { speaker: synthParams.speaker, format: synthParams.format },
  });

  // 更新对应分镜的 dialogue.audioUrl
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

/** 批量合成 */
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
    if (i < shots.length - 1) {
      await new Promise(r => setTimeout(r, 500)); // 间隔 500ms 避免火山 QPS 限制
    }
  }
  return results;
}

module.exports = { synthesizeSpeech, batchSynthesize, getTTSConfig, encrypt, decrypt };
