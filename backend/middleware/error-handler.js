/**
 * 全局错误处理中间件
 */
const ErrorLog = require('../models/error-log.model');
const os = require('os');

async function logErrorToDB(err, req) {
  try {
    const entry = {
      message: err.message || 'Unknown Error',
      stack: (err.stack || '').substring(0, 2000),
      statusCode: err.statusCode || 500,
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      body: sanitizeBody(req.body),
      query: req.query || {},
      headers: {
        'content-type': req.headers?.['content-type'] || '',
        'user-agent': (req.headers?.['user-agent'] || '').substring(0, 200),
      },
      userId: req.user?._id?.toString() || req.user?.id || '',
      username: req.user?.username || '',
      userRole: req.user?.role || '',
      nodeEnv: process.env.NODE_ENV || 'production',
      hostname: os.hostname(),
    };
    const doc = await ErrorLog.create(entry);

    // Socket.IO 实时推送错误通知
    const io = req.app.get('io');
    if (io) {
      io.emit('error-log:new', {
        _id: doc._id,
        message: doc.message,
        statusCode: doc.statusCode,
        method: doc.method,
        path: doc.path,
        username: doc.username,
        createdAt: doc.createdAt,
      });
    }
  } catch (e) {
    // 记录失败不能影响主流程
    console.error('[error-handler] 记录错误日志失败:', e.message);
  }
}

/** 过滤 body 中的敏感字段 + 精简内容 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const safe = { ...body };
  const sensitiveKeys = ['password', 'token', 'apiKey', 'api_key', 'secret', 'jwt'];
  const maxLen = 500;
  for (const key of Object.keys(safe)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      safe[key] = '***REDACTED***';
    } else if (typeof safe[key] === 'string' && safe[key].length > maxLen) {
      safe[key] = safe[key].substring(0, maxLen) + '...(truncated)';
    } else if (typeof safe[key] === 'object' && safe[key] !== null) {
      safe[key] = '[object]';
    }
  }
  return safe;
}

function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) { console.error('Error:', err.message); console.error('Stack:', err.stack); }
  else { console.error('Error:', err.message); }

  // 忽略的路径类型（静态资源等不需要记录）
  const skipLog = req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.ico') || req.path.endsWith('.map');
  if (!skipLog) {
    logErrorToDB(err, req);
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: isDev
        ? 'Validation: ' + Object.values(err.errors).map(e => e.message).join(', ')
        : '数据验证失败',
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: '无效的ID格式' });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: '数据已存在，违反唯一约束' });
  }

  // 余额/额度/鉴权相关 — 生产环境也要暴露
  const isBalanceError = /balance|余额|额度|quota|billing|insufficient|credit|充值|扣费|payment required/i.test(err.message);
  const isAuthError = /api.?key|unauthorized|鉴权|认证|密钥|invalid.*key|token/i.test(err.message);

  const statusCode = err.statusCode || 500;
  const showDetail = isDev || statusCode < 500 || isBalanceError || isAuthError;
  res.status(statusCode).json({
    message: showDetail ? err.message : '服务器内部错误，请稍后重试',
  });
}

module.exports = errorHandler;
