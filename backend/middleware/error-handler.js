/**
 * 全局错误处理中间件
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) { console.error('Error:', err.message); console.error('Stack:', err.stack); }
  else { console.error('Error:', err.message); }

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

  // 余额/额度/鉴权相关 — 生产环境也要暴露，否则用户不知道原因是 Key 没钱了
  const isBalanceError = /balance|余额|额度|quota|billing|insufficient|credit|充值|扣费|payment required/i.test(err.message);
  const isAuthError = /api.?key|unauthorized|鉴权|认证|密钥|invalid.*key|token/i.test(err.message);

  const statusCode = err.statusCode || 500;
  const showDetail = isDev || statusCode < 500 || isBalanceError || isAuthError;
  res.status(statusCode).json({
    message: showDetail ? err.message : '服务器内部错误，请稍后重试',
  });
}

module.exports = errorHandler;
