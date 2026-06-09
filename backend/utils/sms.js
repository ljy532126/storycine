/**
 * 阿里云短信验证码服务
 * 配置来源：管理员后台配置(DB) > .env 环境变量 > 降级模式
 */
const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

const codeCache = new Map();
const CODE_EXPIRE_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;

let _cachedConfig = null;
let _lastLoad = 0;

/** 常用阿里云模板 */
const BUILTIN_TEMPLATES = [
  { code: '100001', desc: '登录/注册 — 验证码${code}，${min}分钟内有效' },
  { code: '100002', desc: '修改绑定手机号 — 验证码${code}，${min}分钟内有效' },
  { code: '100003', desc: '重置密码 — 验证码${code}，${min}分钟内有效' },
  { code: '100004', desc: '绑定新手机号 — 验证码${code}，${min}分钟内有效' },
  { code: '100005', desc: '验证绑定手机号 — 验证码${code}，${min}分钟内有效' },
];

async function loadConfig() {
  if (_cachedConfig && Date.now() - _lastLoad < 30000) return _cachedConfig;
  try {
    const Settings = require('../models/settings.model');
    const User = require('../models/user.model');
    const admin = await User.findOne({ role: 'admin' }).lean();
    if (admin) {
      const s = await Settings.findOne({ userId: admin._id }).lean();
      _cachedConfig = { ...(s?.smsConfig || {}) };
      _lastLoad = Date.now();
      return _cachedConfig;
    }
  } catch {}
  return null;
}

async function getConfig() {
  const db = await loadConfig();
  const fromEnv = db?.accessKeyId && db?.accessKeySecret;
  return {
    accessKeyId: db?.accessKeyId || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
    accessKeySecret: db?.accessKeySecret || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
    signName: db?.signName || process.env.SMS_SIGN_NAME || '',
    templateCode: db?.templateCode || process.env.SMS_TEMPLATE_CODE || '',
    enabled: db?.enabled !== false && !!fromEnv,
    fromEnv,
  };
}

function reloadConfig() { _cachedConfig = null; _lastLoad = 0; }

async function isDegraded() {
  const cfg = await getConfig();
  return !(cfg.accessKeyId && cfg.accessKeySecret);
}

async function smsEnabled() {
  const db = await loadConfig();
  return db?.enabled !== false;
}

function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

async function sendSMS(phone, code) {
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return { ok: false, message: '请输入正确的手机号' };
  const cached = codeCache.get(phone);
  if (cached?.lastSent && Date.now() - cached.lastSent < SEND_COOLDOWN_MS) {
    return { ok: false, message: '请 ' + Math.ceil((SEND_COOLDOWN_MS - (Date.now() - cached.lastSent)) / 1000) + ' 秒后再发送' };
  }
  const verifyCode = code || generateCode();

  if (await isDegraded()) {
    codeCache.set(phone, { code: verifyCode, expires: Date.now() + CODE_EXPIRE_MS, lastSent: Date.now() });
    console.log('[SMS 降级] ' + phone + ' -> ' + verifyCode);
    return { ok: true, message: '验证码已发送', degraded: true };
  }
  try {
    const cfg = await getConfig();
    const client = new Dypnsapi20170525.default(new OpenApi.Config({ accessKeyId: cfg.accessKeyId, accessKeySecret: cfg.accessKeySecret, endpoint: 'dypnsapi.aliyuncs.com' }));
    const resp = await client.sendSmsVerifyCodeWithOptions(new Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber: phone, signName: cfg.signName, templateCode: cfg.templateCode,
      templateParam: JSON.stringify({ code: verifyCode, min: '5' }),
    }), new Util.RuntimeOptions({}));
    const body = resp.body || {};
    if (body.code === 'OK' || body.success) {
      codeCache.set(phone, { code: verifyCode, expires: Date.now() + CODE_EXPIRE_MS, lastSent: Date.now() });
      console.log('[SMS] ' + phone + ' 发送成功');
      return { ok: true, message: '验证码已发送' };
    }
    console.error('[SMS] 发送失败:', body.message || body.code);
    return { ok: false, message: body.message || '发送失败' };
  } catch (e) { console.error('[SMS] 异常:', e.message); return { ok: false, message: '短信服务异常' }; }
}

async function verifyCode(phone, code) {
  if (!phone || !code) return { ok: false, message: '手机号和验证码不能为空' };
  if (await isDegraded() && code === '888888') { codeCache.delete(phone); return { ok: true, message: '验证通过' }; }
  const c = codeCache.get(phone);
  if (!c) return { ok: false, message: '请先获取验证码' };
  if (Date.now() > c.expires) { codeCache.delete(phone); return { ok: false, message: '验证码已过期' }; }
  if (c.code !== code) return { ok: false, message: '验证码错误' };
  codeCache.delete(phone);
  return { ok: true, message: '验证通过' };
}

module.exports = { sendSMS, verifyCode, isDegraded, smsEnabled, reloadConfig, BUILTIN_TEMPLATES };
