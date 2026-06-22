const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const { authRequired } = require('../middleware/auth.middleware');

router.use(authRequired);

// 仅管理员
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '需要管理员权限' });
  next();
}

/** 运行 nuclei 扫描（Docker），SSE 流式返回结果 */
router.get('/run', requireAdmin, async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ message: '缺少扫描目标 URL' });

  // 仅允许扫自己的域名
  const publicUrl = process.env.PUBLIC_URL || '';
  const allowedHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  try { allowedHosts.push(new URL(publicUrl).hostname); } catch {}
  try {
    const targetHost = new URL(target).hostname;
    const isSelf = allowedHosts.some(h => targetHost === h || targetHost.endsWith('.' + h));
    if (!isSelf) return res.status(403).json({ message: '仅允许扫描本服务地址，禁止扫描外部站点' });
  } catch { return res.status(400).json({ message: '无效的目标 URL' }); }

  const severity = req.query.severity || 'medium,high,critical';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'start', target, severity })}\n\n`);

  const args = [
    '-u', target,
    '-severity', severity,
    '-silent',
    '-no-interactsh',
  ];

  const proc = spawn('nuclei', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let buffer = '';

  proc.stdout.on('data', (d) => {
    buffer += d.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          res.write(`data: ${JSON.stringify({ type: 'finding', data: parsed })}\n\n`);
        } catch {
          res.write(`data: ${JSON.stringify({ type: 'raw', text: line })}\n\n`);
        }
      }
    }
  });

  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  proc.on('close', (code) => {
    if (buffer.trim()) {
      res.write(`data: ${JSON.stringify({ type: 'raw', text: buffer.trim() })}\n\n`);
    }
    if (code === 0) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: stderr.slice(-500) || `nuclei 退出码 ${code}` })}\n\n`);
    }
    res.end();
  });

  proc.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: `无法启动 nuclei: ${err.message}` })}\n\n`);
    res.end();
  });

  req.on('close', () => { proc.kill('SIGKILL'); });
});

module.exports = router;
