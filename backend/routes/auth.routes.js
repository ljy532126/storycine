const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const svgCaptcha = require('svg-captcha');
const rateLimit = require('express-rate-limit');
const User = require('../models/user.model');
const LoginLog = require('../models/login-log.model');
const { generateToken, authRequired, adminRequired } = require('../middleware/auth.middleware');
const { sendSMS, verifyCode: verifySmsCode, peekCode } = require('../utils/sms');

// 内存验证码存储（生产环境建议用 Redis）
const captchaStore = new Map();

// ===== 限流配置 =====
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: '登录请求过于频繁，请15分钟后再试' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { message: '注册请求过于频繁，请1小时后再试' } });
const captchaLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30, message: { message: '验证码请求过于频繁' } });

/** 获取客户端 IP */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

/** IP 查询缓存 + API */
const ipGeoCache = new Map();
const axios = require('axios');
const IP_API = 'https://uapis.cn/api/v1/network/ipinfo';

async function lookupIP(ip) {
  if (ipGeoCache.has(ip)) return ipGeoCache.get(ip);
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|localhost)/i.test(ip)) {
    const r = null;
    ipGeoCache.set(ip, r);
    return r;
  }
  try {
    const res = await axios.get(IP_API, { params: { ip, source: 'commercial' }, timeout: 6000 });
    const d = res.data;
    if (d && d.ip) {
      const parts = (d.region || '').split(' ');
      const result = {
        country: parts[0] || '',
        province: parts[1] || '',
        city: parts[2] || '',
        district: parts[3] || '',
        isp: d.isp || d.llc || '',
        asn: d.asn || '',
        latitude: d.latitude || 0,
        longitude: d.longitude || 0,
      };
      ipGeoCache.set(ip, result);
      return result;
    }
  } catch (e) { /* ignore */ }
  ipGeoCache.set(ip, null);
  return null;
}

/** 记录登录日志（含IP地理位置） */
async function logLogin(username, ip, ua, success, message, userId) {
  const geoInfo = await lookupIP(ip);
  await LoginLog.create({
    userId: userId || null, username, ip,
    userAgent: ua || '', success, message,
    geoInfo: geoInfo || {},
  });
}

// ===== 获取图形验证码 =====
router.get('/captcha', captchaLimiter, (req, res) => {
  const captcha = svgCaptcha.create({ size: 4, noise: 3, ignoreChars: '0o1il', color: true, background: '#FBF7F0' });
  const captchaId = require('crypto').randomBytes(12).toString('hex');
  captchaStore.set(captchaId, { text: captcha.text.toLowerCase(), expires: Date.now() + 300000 });
  for (const [k, v] of captchaStore) { if (v.expires < Date.now()) captchaStore.delete(k); }
  res.json({ data: { captchaId, svg: captcha.data } });
});

// 注：滑块验证码已移除（安全性不足），统一使用 SVG 图形验证码

// ===== 注册 =====
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    // 校验用户名密码
    if (username.length < 3 || username.length > 30) return res.status(400).json({ message: '账号长度3-30个字符' });
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,29}$/.test(username)) return res.status(400).json({ message: '账号格式：字母开头，3-30位英文/数字/下划线' });
    if (password.length < 8) return res.status(400).json({ message: '密码长度至少8位' });

    // 防重复注册
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: '该账号已被注册' });

    // 手机号唯一性检查
    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) return res.status(400).json({ message: '该手机号已被绑定' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ username, password: hashed, phone: phone || '', lastLoginIp: ip });

    // 注册时同步创建 settings 文档，避免后续 getSettings 竞态
    const Settings = require('../models/settings.model');
    await Settings.create({ userId: user._id });

    await logLogin(username, ip, ua, true, '注册成功', user._id);
    const token = generateToken(user);
    res.status(201).json({ message: '注册成功', data: { token, user: { id: user._id, uid: user.uid, username, role: user.role } } });
  } catch (e) {
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
});

// ===== 登录（密码） =====
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    if (!username || !password) return res.status(400).json({ message: '请填写账号和密码' });

    const user = await User.findOne({ username });
    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
      await logLogin(username, ip, ua, false, `account locked, ${minutes}min left`, user._id);
      return res.status(429).json({ message: `账号已临时锁定，请${minutes}分钟后再试` });
    }

    // 状态检查
    if (user && user.status === 'banned') return res.status(403).json({ message: '账号已被封禁' });
    if (user && user.status === 'disabled') return res.status(403).json({ message: '账号已被禁用' });

    // 恒定时间密码校验（防用户枚举）
    const dummyHash = '$2a$12$LJ3m4ys3GZfnYMz8kVsKaOSPFmMRYx.LqCGEfSJx0YvMNqJG5qL4G';
    const hashToCheck = user ? user.password : dummyHash;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!user || !valid) {
      if (user) {
        const loginAttempts = (user.loginAttempts || 0) + 1;
        const lockedUntil = loginAttempts >= 5 ? new Date(Date.now() + 30 * 60000) : null;
        await User.updateOne({ _id: user._id }, { $set: { loginAttempts, lockedUntil } });
        await logLogin(username, ip, ua, false, `wrong pw (${loginAttempts}/5)`, user._id);
      } else {
        await logLogin(username, ip, ua, false, 'user not found');
      }
      return res.status(400).json({ message: '账号或密码错误' });
    }

    // 登录成功
    await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip } });

    await logLogin(username, ip, ua, true, '登录成功', user._id);
    const token = generateToken(user);
    res.json({ message: '登录成功', data: { token, user: { id: user._id, uid: user.uid, username, nickname: user.nickname || username, avatar: user.avatar || '', role: user.role, phone: user.phone || '' } } });
  } catch (e) {
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
});

// ===== 短信验证码登录 =====
router.post('/login-sms', loginLimiter, async (req, res) => {
  try {
    const { smsEnabled } = require('../utils/sms');
    if (!(await smsEnabled())) return res.status(403).json({ message: '短信认证服务未开启' });

    const { phone, code } = req.body;
    if (!phone) return res.status(400).json({ message: '请输入手机号' });
    if (!code) return res.status(400).json({ message: '请输入短信验证码' });

    // 必须验证短信码
    const verify = await verifySmsCode(phone, code);
    if (!verify.ok) return res.status(400).json({ message: verify.message });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: '该手机号未注册' });
    if (user.status === 'banned') return res.status(403).json({ message: '账号已被封禁' });
    if (user.status === 'disabled') return res.status(403).json({ message: '账号已被禁用' });

    await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: getClientIp(req), phone } });
    await logLogin(user.username, getClientIp(req), req.headers['user-agent'] || '', true, '短信登录', user._id);
    const token = generateToken(user);
    res.json({ message: '登录成功', data: { token, user: { id: user._id, uid: user.uid, username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || '', role: user.role } } });
  } catch (e) { res.status(500).json({ message: '服务器错误，请稍后重试' }); }
});

// ===== 获取当前用户信息 =====
router.get('/me', authRequired, (req, res) => {
  res.json({ data: { id: req.user._id, uid: req.user.uid, username: req.user.username, nickname: req.user.nickname || req.user.username, avatar: req.user.avatar || '', role: req.user.role, phone: req.user.phone || '', createdAt: req.user.createdAt } });
});

// 更新个人信息
router.put('/profile', authRequired, async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    if (nickname !== undefined) req.user.nickname = nickname;
    if (avatar !== undefined) req.user.avatar = avatar;
    await req.user.save();
    res.json({ message: '更新成功', data: { nickname: req.user.nickname, avatar: req.user.avatar } });
  } catch (e) { res.status(500).json({ message: '保存失败' }); }
});

// 修改密码
router.put('/password', authRequired, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: '请填写新旧密码' });
    if (newPassword.length < 8) return res.status(400).json({ message: '新密码至少8位' });

    // auth 中间件的 req.user 不含 password，需重新查询
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ message: '原密码错误' });
    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    res.json({ message: '密码修改成功，请重新登录' });
  } catch (e) { console.error('[password] 修改失败:', e.message); res.status(500).json({ message: '修改失败' }); }
});

// ===== 管理员：创建用户 =====
router.post('/users', adminRequired, async (req, res) => {
  try {
    const { username, password, role, nickname } = req.body;
    if (!username || username.length < 3 || username.length > 30) return res.status(400).json({ message: '账号长度3-30个字符' });
    if (!password || password.length < 8) return res.status(400).json({ message: '密码至少8位' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: '该账号已存在' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      password: hashed,
      nickname: nickname || username,
      role: role === 'admin' ? 'admin' : 'user',
    });
    // 同步创建设置文档
    const Settings = require('../models/settings.model');
    await Settings.create({ userId: user._id });
    res.status(201).json({ message: '用户创建成功', data: { id: user._id, uid: user.uid, username, nickname: user.nickname, role: user.role, status: user.status, createdAt: user.createdAt } });
  } catch (e) { res.status(500).json({ message: '创建失败' }); }
});

// ===== 管理员：删除用户 =====
router.delete('/users/:id', adminRequired, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: '不能删除自己' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    // 清理关联数据
    try {
      const Settings = require('../models/settings.model');
      await Settings.deleteOne({ userId: req.params.id });
    } catch {}
    await LoginLog.deleteMany({ username: user.username });
    res.json({ message: '已删除' });
  } catch (e) { res.status(500).json({ message: '删除失败' }); }
});

// ===== 管理员：用户列表（含统计） =====
router.get('/users', adminRequired, async (req, res) => {
  try {
    const { page = 1, size = 20, search, status, role } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } },
        { uid: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;
    if (role) filter.role = role;

    const [users, total, stats] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * size).limit(Number(size)).lean(),
      User.countDocuments(filter),
      User.aggregate([
        { $group: { _id: null, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }, admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } }, today: { $sum: { $cond: [{ $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())] }, 1, 0] } } } },
      ]),
    ]);

    const s = stats[0] || { active: 0, admins: 0, today: 0 };
    res.json({ data: { users, total, page: Number(page), size: Number(size), stats: { active: s.active, todayNew: s.today, admin: s.admins } } });
  } catch (e) { res.status(500).json({ message: '查询失败' }); }
});

// ===== 管理员：按 UID 查询用户 =====
router.get('/users/uid/:uid', adminRequired, async (req, res) => {
  const user = await User.findOne({ uid: req.params.uid }).select('-password');
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ data: user });
});

// ===== 管理员：用户详情 =====
router.get('/users/:id', adminRequired, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ data: user });
});

// ===== 管理员：更新用户状态 =====
router.put('/users/:id/status', adminRequired, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled', 'banned'].includes(status)) return res.status(400).json({ message: '无效状态' });
  if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: '不能修改自己的状态' });
  const user = await User.findByIdAndUpdate(req.params.id, { status, loginAttempts: 0, lockedUntil: null }, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ message: '状态已更新', data: user });
});

// ===== 管理员：用户登录日志 =====
router.get('/users/:id/logs', adminRequired, async (req, res) => {
  const { page = 1, size = 30 } = req.query;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const total = await LoginLog.countDocuments({ username: user.username });
  const logs = await LoginLog.find({ username: user.username }).sort({ createdAt: -1 })
    .skip((page - 1) * size).limit(Number(size));
  res.json({ data: { logs, total, page: Number(page), size: Number(size) } });
});

// ===== 管理员：重置用户密码 =====
router.put('/users/:id/reset-password', adminRequired, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: '密码至少8位' });
  if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: '不能重置自己的密码' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  user.password = await bcrypt.hash(newPassword, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.loginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  res.json({ message: '密码已重置，用户需重新登录' });
});

// ===== 短信验证码 =====

// 发送短信验证码（无需登录，scene 决定使用哪个模板）
router.post('/sms/send', async (req, res) => {
  try {
    const { phone, scene } = req.body;
    if (!phone) return res.status(400).json({ message: '请输入手机号' });

    // 找回密码：手机号必须已注册
    if (scene === 'resetPwd') {
      const existingUser = await User.findOne({ phone });
      if (!existingUser) return res.status(400).json({ message: '该手机号未注册，请先注册账号' });
    }
    // 绑定/修改手机号：手机号不能被其他人已绑定
    if (scene === 'bindPhone' || scene === 'changePhone') {
      const existingUser = await User.findOne({ phone });
      if (existingUser) return res.status(400).json({ message: '该手机号已被其他账号绑定' });
    }
    // 注册场景：手机号不能已被绑定
    if (scene === 'register') {
      const existingUser = await User.findOne({ phone });
      if (existingUser) return res.status(400).json({ message: '该手机号已被其他账号绑定' });
    }

    const result = await sendSMS(phone, scene || 'login');
    if (result.ok) {
      res.json({ message: result.message, degraded: result.degraded || false });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (e) { res.status(500).json({ message: '发送失败' }); }
});

// 验证短信验证码（无需登录，不消耗验证码）
router.post('/sms/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const result = peekCode(phone, code);
    if (result.ok) {
      // 验证通过但不消耗缓存，返回一个一次性 token 供后续修改密码使用
      const smsToken = require('crypto').randomBytes(16).toString('hex');
      const smsTokenStore = req.app.get('smsTokenStore') || new Map();
      smsTokenStore.set(smsToken, { phone, expires: Date.now() + 10 * 60000 });
      if (!req.app.get('smsTokenStore')) req.app.set('smsTokenStore', smsTokenStore);
      res.json({ message: '验证通过', data: { smsToken } });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (e) { res.status(500).json({ message: '验证失败' }); }
});

// 短信验证码找回/重置密码（无需登录）
router.post('/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) return res.status(400).json({ message: '手机号、验证码和新密码不能为空' });
    if (newPassword.length < 8) return res.status(400).json({ message: '新密码至少8位' });

    // 验证短信验证码
    const verify = await verifySmsCode(phone, code);
    if (!verify.ok) return res.status(400).json({ message: verify.message });

    // 查找绑定该手机号的用户
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: '该手机号未绑定任何账号' });

    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    res.json({ message: '密码已重置，请重新登录' });
  } catch (e) { res.status(500).json({ message: '重置失败' }); }
});

// 绑定/修改手机号（需登录）
router.put('/phone', authRequired, async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: '手机号和验证码不能为空' });

    // 检查手机号是否已被其他人绑定
    const existing = await User.findOne({ phone, _id: { $ne: req.user._id } });
    if (existing) return res.status(400).json({ message: '该手机号已被其他账号绑定' });

    const verify = await verifySmsCode(phone, code);
    if (!verify.ok) return res.status(400).json({ message: verify.message });

    req.user.phone = phone;
    await req.user.save();
    res.json({ message: '手机号绑定成功' });
  } catch (e) { res.status(500).json({ message: '绑定失败' }); }
});

// ===== 获取短信服务状态（公开，供前端判断是否显示短信入口） =====
router.get('/sms/status', async (req, res) => {
  try {
    const { smsEnabled } = require('../utils/sms');
    const enabled = await smsEnabled();
    res.json({ data: { enabled } });
  } catch { res.json({ data: { enabled: false } }); }
});

module.exports = router;
