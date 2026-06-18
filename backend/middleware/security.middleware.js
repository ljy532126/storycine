/**
 * 全局安全中间件 — 爬虫拦截 + 全局限流 + 401滥用封禁
 */

// ===== 1. 爬虫 UA 黑名单 =====
const BOT_PATTERNS = [
  /zgrab/i, /masscan/i, /nmap/i, /sqlmap/i, /nikto/i, /acunetix/i,
  /burpsuite/i, /nessus/i, /openvas/i, /goby/i, /fscan/i,
  /go-http-client/i, /python-requests/i, /curl\//i, /wget\//i,
  /scrapy/i, /apachebench/i, /axios\//i, /node-fetch/i,
  /okhttp\//i, /java\//i, /libwww-perl/i, /winhttp/i,
  /fasthttp/i, /l9explore/i, /l9tcpid/i,
  // 常见扫描工具指纹
  /360spider/i, /bytedance/i, /bytespider/i,
  /checker/i, /scanner/i, /scan/i, /crawler/i, /bot/i, /spider/i,
];

function isBot(ua) {
  if (!ua) return false;
  return BOT_PATTERNS.some(p => p.test(ua));
}

// ===== 2. 401/403 滥用检测（内存存储） =====
const abuseMap = new Map();
const ABUSE_MAX = 30;       // 5分钟内最多30次4xx
const ABUSE_WINDOW = 5 * 60 * 1000;
const ABUSE_BLOCK = 15 * 60 * 1000; // 封禁15分钟

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
}

function checkAbuse(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();

  let entry = abuseMap.get(ip);
  if (!entry) {
    entry = { hits: [], blockedUntil: 0 };
    abuseMap.set(ip, entry);
  }

  // 清理过期记录
  entry.hits = entry.hits.filter(t => now - t < ABUSE_WINDOW);

  // 检查封禁
  if (entry.blockedUntil > now) {
    const remaining = Math.ceil((entry.blockedUntil - now) / 1000);
    return { blocked: true, remaining };
  }

  return { blocked: false, entry, ip };
}

function recordAbuse(req, res) {
  // 只对 4xx 响应的未认证请求计数
  if (res.statusCode < 400 || res.statusCode >= 500) return;

  const ip = getClientIp(req);
  const now = Date.now();
  let entry = abuseMap.get(ip);
  if (!entry) {
    entry = { hits: [], blockedUntil: 0 };
    abuseMap.set(ip, entry);
  }

  entry.hits.push(now);
  entry.hits = entry.hits.filter(t => now - t < ABUSE_WINDOW);

  if (entry.hits.length >= ABUSE_MAX) {
    entry.blockedUntil = now + ABUSE_BLOCK;
    console.error(`[SECURITY] 🚫 IP ${ip} 封禁 15 分钟 (${entry.hits.length} 次 4xx)`);
  }
}

// 定期清理内存
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, entry] of abuseMap) {
    entry.hits = entry.hits.filter(t => now - t < ABUSE_WINDOW);
    if (entry.hits.length === 0 && entry.blockedUntil < now) {
      abuseMap.delete(ip);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`[security] 清理 ${cleaned} 个过期 IP 记录`);
}, 60000);

// ===== 3. 全局限流（内存） =====
const rateMap = new Map();
const RATE_MAX = 100;        // 每分钟100次
const RATE_WINDOW = 60 * 1000;

function checkRate(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry) {
    entry = { hits: [] };
    rateMap.set(ip, entry);
  }

  entry.hits = entry.hits.filter(t => now - t < RATE_WINDOW);

  if (entry.hits.length >= RATE_MAX) {
    return false;
  }

  entry.hits.push(now);
  return true;
}

// 过期清理
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    entry.hits = entry.hits.filter(t => now - t < RATE_WINDOW);
    if (entry.hits.length === 0) rateMap.delete(ip);
  }
}, 60000);

// ===== Express 中间件 =====
function securityMiddleware(req, res, next) {
  // 跳过静态文件
  if (req.path.startsWith('/uploads/')) return next();

  // 爬虫 UA 拦截
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // 滥用封禁检查
  const abuse = checkAbuse(req, res);
  if (abuse.blocked) {
    res.setHeader('Retry-After', abuse.remaining);
    return res.status(429).json({ message: `访问过于频繁，请 ${abuse.remaining} 秒后再试` });
  }

  // 全局限流
  if (!checkRate(req)) {
    return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
  }

  // 劫持 res.end / res.json 以检测 4xx
  const origEnd = res.end;
  const origJson = res.json.bind(res);
  res.json = function (body) {
    recordAbuse(req, res);
    return origJson(body);
  };
  const origSend = res.send.bind(res);
  res.send = function (body) {
    recordAbuse(req, res);
    return origSend(body);
  };

  next();
}

module.exports = securityMiddleware;
