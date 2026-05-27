const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const JWT_SECRET = process.env.JWT_SECRET || 'autodrama_jwt_secret_2026';
const JWT_EXPIRES = '7d';

/** 生成 JWT Token */
function generateToken(user) {
  return jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/** 验证 Token 中间件 */
async function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return res.status(401).json({ message: '请先登录' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: '用户不存在' });
    if (user.status !== 'active') return res.status(403).json({ message: '账号已被禁用或封禁' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

/** 管理员权限校验 */
async function adminRequired(req, res, next) {
  await authRequired(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: '需要管理员权限' });
    next();
  });
}

module.exports = { generateToken, authRequired, adminRequired, JWT_SECRET };
