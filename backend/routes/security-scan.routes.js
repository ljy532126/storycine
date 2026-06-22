const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const { authRequired } = require('../middleware/auth.middleware');

router.use(authRequired);

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '需要管理员权限' });
  next();
}

/** 运行 nuclei 扫描（宿主机二进制），SSE 流式返回结果 */
router.get('/run', requireAdmin, async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ message: '缺少扫描目标 URL' });

  // 仅允许扫自己的服务
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

  // 优先用宿主机 nuclei（挂载 /usr/local/bin/nuclei），降级用 docker
  const useDocker = !nucleiAvailable();
  let proc;

  if (useDocker) {
    proc = spawn('docker', [
      'run', '--rm', '--network', 'host',
      'projectdiscovery/nuclei',
      '-u', target, '-severity', severity, '-silent', '-no-interactsh',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
  } else {
    proc = spawn('/usr/local/bin/nuclei', [
      '-u', target, '-severity', severity, '-silent', '-no-interactsh',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
  }

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
    if (buffer.trim()) res.write(`data: ${JSON.stringify({ type: 'raw', text: buffer.trim() })}\n\n`);
    if (code === 0) res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    else res.write(`data: ${JSON.stringify({ type: 'error', message: stderr.slice(-500) || `退出码 ${code}` })}\n\n`);
    res.end();
  });

  proc.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: `nuclei 不可用: ${err.message}。服务器需执行: wget -qO /usr/local/bin/nuclei https://ghproxy.com/https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei-linux-amd64 && chmod +x /usr/local/bin/nuclei && nuclei -ut` })}\n\n`);
    res.end();
  });

  req.on('close', () => { proc.kill('SIGKILL'); });
});

let _nucleiChecked = false;
let _nucleiOk = false;
function nucleiAvailable() {
  if (_nucleiChecked) return _nucleiOk;
  try {
    const { execSync } = require('child_process');
    execSync('/usr/local/bin/nuclei -version', { stdio: 'ignore', timeout: 5000 });
    _nucleiOk = true;
  } catch { _nucleiOk = false; }
  _nucleiChecked = true;
  return _nucleiOk;
}

module.exports = router;
