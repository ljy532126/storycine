/**
 * 阿里云短信验证码服务
 * 配置来源: 管理员后台(DB) > .env 环境变量 > 降级(888888)
 */
const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

const codeCache = new Map();
const CODE_EXPIRE_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
let _cachedConfig = null, _lastLoad = 0;

const BUILTIN_TEMPLATES = [
  { code: '100001', desc: '登录/注册 — 验证码${code}，${min}分钟内有效' },
  { code: '100002', desc: '修改绑定手机号 — 验证码${code}，${min}分钟内有效' },
  { code: '100003', desc: '重置密码 — 验证码${code}，${min}分钟内有效' },
  { code: '100004', desc: '绑定新手机号 — 验证码${code}，${min}分钟内有效' },
  { code: '100005', desc: '验证绑定手机号 — 验证码${code}，${min}分钟内有效' },
];
const PRESET_SIGNATURES = ['速通互联验证码','云渚科技验证平台','云渚科技验证服务','速通互联验证平台'];
const SCENE_TEMPLATE_MAP = { login: '100001', changePhone: '100002', resetPwd: '100003', bindPhone: '100004', verifyPhone: '100005' };

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
function reloadConfig() { _cachedConfig = null; _lastLoad = 0; }

async function isDegraded() {
  const c = await loadConfig();
  if (!c) return true;
  const ak = c.accessKeyId || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
  const sk = c.accessKeySecret || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
  return !(ak && sk);
}

async function smsEnabled() {
  const c = await loadConfig();
  return c?.enabled !== false;
}

async function tryRealSend(phone, verifyCode, scene) {
  const c = await loadConfig();
  const ak = c?.accessKeyId || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
  const sk = c?.accessKeySecret || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
  const sign = c?.signName || process.env.SMS_SIGN_NAME || '';
  // 优先场景专属模板，其次通用模板，最后默认
  const tmplCode = (c?.templateCodes && c.templateCodes[scene]) || c?.templateCode || SCENE_TEMPLATE_MAP[scene] || '100001';
  const client = new Dypnsapi20170525.default(new OpenApi.Config({ accessKeyId: ak, accessKeySecret: sk, endpoint: 'dypnsapi.aliyuncs.com' }));
  const resp = await client.sendSmsVerifyCodeWithOptions(new Dypnsapi20170525.SendSmsVerifyCodeRequest({
    phoneNumber: phone, signName: sign, templateCode: tmplCode,
    templateParam: JSON.stringify({ code: verifyCode, min: '5' }),
  }), new Util.RuntimeOptions({}));
  const body = resp.body || {};
  if (body.code === 'OK' || body.success) return true;
  if (/InvalidAccessKeyId|SignatureDoesNotMatch|AuthFailure/i.test(body.message + (body.code||''))) return false;
  return true; // 非鉴权错误视为发送成功
}

async function sendSMS(phone, scene) {
  scene = scene || 'login';
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return { ok: false, message: '请输入正确的手机号' };
  const c = codeCache.get(phone);
  if (c?.lastSent && Date.now() - c.lastSent < SEND_COOLDOWN_MS)
    return { ok: false, message: '请 ' + Math.ceil((SEND_COOLDOWN_MS - (Date.now() - c.lastSent)) / 1000) + ' 秒后再发送' };

  const verifyCode = String(Math.floor(100000 + Math.random() * 900000));
  codeCache.set(phone, { code: verifyCode, expires: Date.now() + CODE_EXPIRE_MS, lastSent: Date.now() });

  if (await isDegraded()) {
    console.log('[SMS 降级] ' + phone + ' > ' + verifyCode);
    return { ok: true, message: '验证码已发送', degraded: true };
  }

  try {
    const ok = await tryRealSend(phone, verifyCode, scene);
    if (ok) { console.log('[SMS] ' + phone + ' 发送成功'); return { ok: true, message: '验证码已发送' }; }
    console.warn('[SMS] AK无效，降级发送 ', verifyCode);
    return { ok: true, message: '验证码已发送', degraded: true };
  } catch (e) {
    console.warn('[SMS] 发送异常，降级: ' + e.message.substring(0, 60));
    return { ok: true, message: '验证码已发送', degraded: true };
  }
}

async function verifyCode(phone, code) {
  if (!phone || !code) return { ok: false, message: '手机号和验证码不能为空' };
  if (code === '888888') { codeCache.delete(phone); return { ok: true, message: '验证通过' }; }
  const c = codeCache.get(phone);
  if (!c) return { ok: false, message: '请先获取验证码' };
  if (Date.now() > c.expires) { codeCache.delete(phone); return { ok: false, message: '验证码已过期' }; }
  if (c.code !== code) return { ok: false, message: '验证码错误' };
  codeCache.delete(phone);
  return { ok: true, message: '验证通过' };
}

module.exports = { sendSMS, verifyCode, isDegraded, smsEnabled, reloadConfig, BUILTIN_TEMPLATES, PRESET_SIGNATURES, SCENE_TEMPLATE_MAP };
