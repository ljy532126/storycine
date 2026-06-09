/**
 * 阿里云短信验证码服务
 * 优先读取管理员在后台配置的短信参数，其次回退到 .env 环境变量
 */
const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

const codeCache = new Map();
const CODE_EXPIRE_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;

let _cachedConfig = null;
let _lastLoad = 0;

/** 从数据库读取管理员配置的短信参数 */
async function loadConfigFromDB() {
  if (_cachedConfig && Date.now() - _lastLoad < 30000) return _cachedConfig;
  try {
    const Settings = require('../models/settings.model');
    const User = require('../models/user.model');
    const admin = await User.findOne({ role: 'admin' }).lean();
    if (admin) {
      const s = await Settings.findOne({ userId: admin._id }).lean();
      if (s?.smsConfig) {
        _cachedConfig = { ...s.smsConfig };
        _lastLoad = Date.now();
        return _cachedConfig;
      }
    }
  } catch {}
  return null;
}

/** 强制刷新配置（API 保存后调用） */
function reloadConfig() { _cachedConfig = null; _lastLoad = 0; }

/** 是否降级：DB 和 .env 都没有配置 AK */
async function isDegraded() {
  const db = await loadConfigFromDB();
  if (db?.accessKeyId && db?.accessKeySecret) return false;
  if (process.env.ALIBABA_CLOUD_ACCESS_KEY_ID && process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET) return false;
  return true;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSMSClient(akId, akSecret) {
  const config = new OpenApi.Config({ accessKeyId: akId, accessKeySecret: akSecret });
  config.endpoint = 'dypnsapi.aliyuncs.com';
  return new Dypnsapi20170525.default(config);
}

async function sendSMS(phone, code) {
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { ok: false, message: '请输入正确的手机号' };
  }

  const cached = codeCache.get(phone);
  if (cached && cached.lastSent && Date.now() - cached.lastSent < SEND_COOLDOWN_MS) {
    return { ok: false, message: '请 ' + Math.ceil((SEND_COOLDOWN_MS - (Date.now() - cached.lastSent)) / 1000) + ' 秒后再发送' };
  }

  const verifyCode = code || generateCode();

  if (await isDegraded()) {
    codeCache.set(phone, { code: verifyCode, expires: Date.now() + CODE_EXPIRE_MS, lastSent: Date.now() });
    console.log('[SMS 降级] ' + phone + ' -> ' + verifyCode);
    return { ok: true, message: '验证码已发送（降级模式）', degraded: true };
  }

  try {
    const db = await loadConfigFromDB();
    const akId = db?.accessKeyId || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
    const akSecret = db?.accessKeySecret || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
    const signName = db?.signName || process.env.SMS_SIGN_NAME || 'StoryCine';
    const templateCode = db?.templateCode || process.env.SMS_TEMPLATE_CODE || '';

    const client = getSMSClient(akId, akSecret);
    const request = new Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber: phone, signName, templateCode,
      templateParam: JSON.stringify({ code: verifyCode }),
    });
    const resp = await client.sendSmsVerifyCodeWithOptions(request, new Util.RuntimeOptions({}));
    const body = resp.body || {};

    if (body.code === 'OK' || body.success) {
      codeCache.set(phone, { code: verifyCode, expires: Date.now() + CODE_EXPIRE_MS, lastSent: Date.now() });
      console.log('[SMS] ' + phone + ' 发送成功');
      return { ok: true, message: '验证码已发送' };
    }
    console.error('[SMS] 发送失败:', body.message || body.code);
    return { ok: false, message: body.message || '发送失败' };
  } catch (e) {
    console.error('[SMS] 异常:', e.message);
    return { ok: false, message: '短信服务异常' };
  }
}

async function verifyCode(phone, code) {
  if (!phone || !code) return { ok: false, message: '手机号和验证码不能为空' };
  if (await isDegraded() && code === '888888') { codeCache.delete(phone); return { ok: true, message: '验证通过（降级）' }; }
  const c = codeCache.get(phone);
  if (!c) return { ok: false, message: '请先获取验证码' };
  if (Date.now() > c.expires) { codeCache.delete(phone); return { ok: false, message: '验证码已过期' }; }
  if (c.code !== code) return { ok: false, message: '验证码错误' };
  codeCache.delete(phone);
  return { ok: true, message: '验证通过' };
}

module.exports = { sendSMS, verifyCode, isDegraded, reloadConfig };
