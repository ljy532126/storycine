/**
 * 统一字段级加密工具 — AES-256-GCM（认证加密）
 * 密文格式: ENC:<iv_hex>:<ciphertext_hex>:<authTag_hex>
 * 明文不带 ENC: 前缀，兼容存量数据自动迁移
 */
const crypto = require('crypto');

const ENC_PREFIX = 'ENC:';
const ALGO = 'aes-256-gcm';
const IV_LEN = 16; // 128-bit IV
const TAG_LEN = 16; // 128-bit auth tag

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY 环境变量未设置！请生成随机密钥并在 .env 中配置');
  return crypto.createHash('sha256').update(raw).digest(); // 32 bytes for AES-256
}

let _key = null;
function key() { if (!_key) _key = getKey(); return _key; }

function isEncrypted(text) {
  return typeof text === 'string' && text.startsWith(ENC_PREFIX);
}

function encrypt(plaintext) {
  if (!plaintext) return '';
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + iv.toString('hex') + ':' + encrypted.toString('hex') + ':' + authTag.toString('hex');
}

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  if (!isEncrypted(ciphertext)) return ciphertext; // 明文（存量数据），迁移时会加密
  const body = ciphertext.slice(ENC_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) return ciphertext; // 异常格式
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return ciphertext; // 解密失败，返回原文（可能是旧格式或损坏数据）
  }
}

/**
 * 加密 settings 对象中的敏感字段（原地修改）
 * 在 save/updateOne 前调用
 * 注意：ttsConfig.apiKey 由 tts.service.js 独立加密，此处跳过
 */
function encryptSettings(doc) {
  const llm = doc.llmProviders;
  if (llm) {
    ['deepseek', 'doubao', 'tongyi', 'openai'].forEach(p => {
      if (llm[p]?.apiKey && !isEncrypted(llm[p].apiKey)) {
        llm[p].apiKey = encrypt(llm[p].apiKey);
      }
    });
  }
  if (doc.smsConfig?.accessKeySecret && !isEncrypted(doc.smsConfig.accessKeySecret)) {
    doc.smsConfig.accessKeySecret = encrypt(doc.smsConfig.accessKeySecret);
  }
  if (doc.storageConfig?.accessKeySecret && !isEncrypted(doc.storageConfig.accessKeySecret)) {
    doc.storageConfig.accessKeySecret = encrypt(doc.storageConfig.accessKeySecret);
  }
}

/**
 * 解密 settings 对象中的敏感字段（原地修改）
 * 在 find/findOne 后调用
 */
function decryptSettings(doc) {
  const llm = doc.llmProviders;
  if (llm) {
    ['deepseek', 'doubao', 'tongyi', 'openai'].forEach(p => {
      if (llm[p]?.apiKey) llm[p].apiKey = decrypt(llm[p].apiKey);
    });
  }
  if (doc.smsConfig?.accessKeySecret) doc.smsConfig.accessKeySecret = decrypt(doc.smsConfig.accessKeySecret);
  if (doc.storageConfig?.accessKeySecret) doc.storageConfig.accessKeySecret = decrypt(doc.storageConfig.accessKeySecret);
}

module.exports = { encrypt, decrypt, isEncrypted, encryptSettings, decryptSettings };
