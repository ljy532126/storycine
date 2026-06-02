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

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: isDev ? err.message : '服务器内部错误',
  });
}

module.exports = errorHandler;
