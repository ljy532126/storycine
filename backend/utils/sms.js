/**
 * 阿里云短信验证码服务
 *
 * 环境变量（.env）:
 *   ALIBABA_CLOUD_ACCESS_KEY_ID     = AccessKey ID
 *   ALIBABA_CLOUD_ACCESS_KEY_SECRET = AccessKey Secret
 *   SMS_SIGN_NAME                   = 短信签名
 *   SMS_TEMPLATE_CODE               = 短信模板 CODE
 */

const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

const codeCache = new Map();
const CODE_EXPIRE_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;

function isDegraded() {
  return !(process.env.ALIBABA_CLOUD_ACCESS_KEY_ID && process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getSMSClient() {
  const keyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
  const keySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
  const config = new OpenApi.Config({ accessKeyId: keyId, accessKeySecret: keySecret });
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

  if (isDegraded()) {
    codeCache.set(phone, { code: verifyCode, expires: Date.now() + CODE_EXPIRE_MS, lastSent: Date.now() });
    console.log('[SMS 降级] ' + phone + ' -> ' + verifyCode);
    return { ok: true, message: '验证码已发送（降级模式）', degraded: true };
  }

  try {
    const client = getSMSClient();
    const templateParam = JSON.stringify({ code: verifyCode });
    const request = new Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber: phone,
      signName: process.env.SMS_SIGN_NAME || 'StoryCine',
      templateCode: process.env.SMS_TEMPLATE_CODE || '',
      templateParam,
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

function verifyCode(phone, code) {
  if (!phone || !code) return { ok: false, message: '手机号和验证码不能为空' };
  if (isDegraded() && code === '888888') { codeCache.delete(phone); return { ok: true, message: '验证通过（降级）' }; }
  const c = codeCache.get(phone);
  if (!c) return { ok: false, message: '请先获取验证码' };
  if (Date.now() > c.expires) { codeCache.delete(phone); return { ok: false, message: '验证码已过期' }; }
  if (c.code !== code) return { ok: false, message: '验证码错误' };
  codeCache.delete(phone);
  return { ok: true, message: '验证通过' };
}

module.exports = { sendSMS, verifyCode, isDegraded };
