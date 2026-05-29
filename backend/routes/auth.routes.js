const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const svgCaptcha = require('svg-captcha');
const rateLimit = require('express-rate-limit');
const User = require('../models/user.model');
const LoginLog = require('../models/login-log.model');
const { generateToken, authRequired, adminRequired } = require('../middleware/auth.middleware');

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

/** 记录登录日志 */
async function logLogin(username, ip, ua, success, message, userId) {
  await LoginLog.create({ userId: userId || null, username, ip, userAgent: ua || '', success, message });
}

// ===== 获取图形验证码 =====
router.get('/captcha', captchaLimiter, (req, res) => {
  const captcha = svgCaptcha.create({ size: 4, noise: 3, ignoreChars: '0o1il', color: true, background: '#FBF7F0' });
  const captchaId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  captchaStore.set(captchaId, { text: captcha.text.toLowerCase(), expires: Date.now() + 300000 });
  for (const [k, v] of captchaStore) { if (v.expires < Date.now()) captchaStore.delete(k); }
  res.json({ data: { captchaId, svg: captcha.data } });
});

// ===== 滑块验证码 =====
router.get('/captcha/slider', captchaLimiter, (req, res) => {
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  captchaStore.set(token, { text: 'verified', expires: Date.now() + 300000 });
  for (const [k, v] of captchaStore) { if (v.expires < Date.now()) captchaStore.delete(k); }
  res.json({ data: { captchaId: token, captchaText: 'verified' } });
});

// ===== 注册 =====
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, captchaId, captchaText } = req.body;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    // 校验
    if (!username || !password) return res.status(400).json({ message: '请填写账号和密码' });
    if (username.length < 3 || username.length > 30) return res.status(400).json({ message: '账号长度3-30个字符' });
    if (password.length < 6) return res.status(400).json({ message: '密码长度至少6位' });

    // 验证码校验
    const cap = captchaStore.get(captchaId);
    if (!cap || cap.expires < Date.now()) return res.status(400).json({ message: '验证码已过期，请刷新' });
    if (cap.text !== (captchaText || '').toLowerCase()) return res.status(400).json({ message: '验证码错误' });
    captchaStore.delete(captchaId);

    // 防重复注册
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: '该账号已被注册' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ username, password: hashed, lastLoginIp: ip });

    await logLogin(username, ip, ua, true, '注册成功', user._id);
    const token = generateToken(user);
    res.status(201).json({ message: '注册成功', data: { token, user: { id: user._id, uid: user.uid, username, role: user.role } } });
  } catch (e) {
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
});

// ===== 登录 =====
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, captchaId, captchaText } = req.body;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    if (!username || !password) return res.status(400).json({ message: '请填写账号和密码' });

    // 验证码（失败超过2次后要求验证码）
    const user = await User.findOne({ username });
    const needCaptcha = user && user.loginAttempts >= 2;
    if (needCaptcha) {
      const cap = captchaStore.get(captchaId);
      if (!cap || cap.expires < Date.now()) return res.status(400).json({ message: '验证码已过期' });
      if (cap.text !== (captchaText || '').toLowerCase()) return res.status(400).json({ message: '验证码错误' });
      captchaStore.delete(captchaId);
    }

    if (!user) {
      await logLogin(username, ip, ua, false, '账号不存在');
      return res.status(400).json({ message: '账号或密码错误' });
    }

    // 账号状态检查
    if (user.status === 'banned') return res.status(403).json({ message: '账号已被封禁' });
    if (user.status === 'disabled') return res.status(403).json({ message: '账号已被禁用' });

    // 锁定检查（密码错误5次锁定30分钟）
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
      await logLogin(username, ip, ua, false, `账号锁定中，剩余${minutes}分钟`, user._id);
      return res.status(429).json({ message: `账号已临时锁定，请${minutes}分钟后再试` });
    }

    // 密码校验
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) user.lockedUntil = new Date(Date.now() + 30 * 60000);
      await user.save();
      await logLogin(username, ip, ua, false, `密码错误 (${user.loginAttempts}/5)`, user._id);
      return res.status(400).json({ message: `账号或密码错误${user.loginAttempts >= 3 ? '，已输错' + user.loginAttempts + '次，再错将锁定' : ''}` });
    }

    // 登录成功
    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIp = ip;
    await user.save();

    await logLogin(username, ip, ua, true, '登录成功', user._id);
    const token = generateToken(user);
    res.json({ message: '登录成功', data: { token, user: { id: user._id, uid: user.uid, username, nickname: user.nickname || username, avatar: user.avatar || '', role: user.role } } });
  } catch (e) {
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
});

// ===== 获取当前用户信息 =====
router.get('/me', authRequired, (req, res) => {
  res.json({ data: { id: req.user._id, uid: req.user.uid, username: req.user.username, nickname: req.user.nickname || req.user.username, avatar: req.user.avatar || '', role: req.user.role, createdAt: req.user.createdAt } });
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
    if (newPassword.length < 6) return res.status(400).json({ message: '新密码至少6位' });
    const valid = await bcrypt.compare(oldPassword, req.user.password);
    if (!valid) return res.status(400).json({ message: '原密码错误' });
    req.user.password = await bcrypt.hash(newPassword, 12);
    await req.user.save();
    res.json({ message: '密码修改成功' });
  } catch (e) { res.status(500).json({ message: '修改失败' }); }
});

// ===== 管理员：用户列表 =====
router.get('/users', adminRequired, async (req, res) => {
  try {
    const { page = 1, size = 20, search, status } = req.query;
    const filter = {};
    if (search) filter.username = { $regex: search, $options: 'i' };
    if (status) filter.status = status;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 })
      .skip((page - 1) * size).limit(Number(size));

    res.json({ data: { users, total, page: Number(page), size: Number(size) } });
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

module.exports = router;
