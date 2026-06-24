require('dotenv').config();
const express = require('express');
const http = require('http');
const { spawn } = require('child_process');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/database');
const errorHandler = require('./middleware/error-handler');

// 启动时检查 ffmpeg 是否可用
function checkFfmpeg() {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version'], { stdio: 'pipe' });
    let stdout = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.on('close', code => {
      if (code === 0) {
        console.log('[startup] ffmpeg 已就绪 — ' + stdout.split('\n')[0].trim());
      } else {
        console.error('[startup] ⚠️  ffmpeg 未安装或不可用，视频合成将失败！请在 Dockerfile 中添加: RUN apk add --no-cache ffmpeg');
      }
      resolve();
    });
    proc.on('error', () => {
      console.error('[startup] ⚠️  ffmpeg 未安装或不可用，视频合成将失败！请在 Dockerfile 中添加: RUN apk add --no-cache ffmpeg');
      resolve();
    });
  });
}

const projectRoutes = require('./routes/project.routes');
const scriptRoutes = require('./routes/script.routes');
const assetRoutes = require('./routes/asset.routes');
const storyboardRoutes = require('./routes/storyboard.routes');
const compositionRoutes = require('./routes/composition.routes');
const configRoutes = require('./routes/config.routes');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3012', methods: ['GET', 'POST'] }
});

app.set('io', io);
require('./utils/socket-registry').setIO(io);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'", "https:"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || process.env.PUBLIC_URL || 'http://localhost:3012',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
app.use('/uploads', express.static('uploads'));
// 开发环境：日志双输出（控制台 + backend.log）
const DEV_LOG = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
if (DEV_LOG) {
  const fs = require('fs');
  const pathLog = require('path');
  // 清空旧日志，避免文件越来越大
  const logPath = pathLog.join(__dirname, 'backend.log');
  fs.writeFileSync(logPath, `=== StoryCine Backend Log (${new Date().toISOString()}) ===\n`, 'utf8');

  const origLog = console.log, origWarn = console.warn, origError = console.error;
  const writeLog = (...args) => {
    const line = args.map(a => {
      if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
      return String(a);
    }).join(' ');
    fs.appendFileSync(logPath, new Date().toISOString().substring(11, 19) + ' ' + line + '\n', 'utf8');
  };
  console.log = (...args) => { writeLog(...args); origLog.apply(console, args); };
  console.warn = (...args) => { writeLog('⚠️', ...args); origWarn.apply(console, args); };
  console.error = (...args) => { writeLog('❌', ...args); origError.apply(console, args); };
  console.log('开发模式：日志同时写入 backend.log');

  // morgan 只输出到控制台（console.log 会自动写文件）
  app.use(morgan('dev'));
}

// 移除 Express 指纹头
app.disable('x-powered-by');

// 生产环境：单端口部署，后端直接托管前端静态文件
const path = require('path');
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log('[static] Frontend dist served from:', frontendDist);
}

// API 监控中间件（内存聚合 + MongoDB 持久化）
const ApiCallStats = require('./models/api-call-stats.model');

function initStats() {
  return { total: 0, routes: {}, recent: [], ai: { image: { total: 0, success: 0, fail: 0 }, video: { total: 0, success: 0, fail: 0 }, llm: { total: 0, success: 0, fail: 0 } } };
}

// 启动时从 MongoDB 恢复统计
let apiStatsLoaded = false;
async function loadStatsFromDB() {
  try {
    const [all, img, vid, llm] = await Promise.all([
      ApiCallStats.countDocuments(),
      ApiCallStats.countDocuments({ category: 'image' }),
      ApiCallStats.countDocuments({ category: 'video' }),
      ApiCallStats.countDocuments({ category: 'llm' }),
    ]);
    const [imgOk, vidOk, llmOk] = await Promise.all([
      ApiCallStats.countDocuments({ category: 'image', statusCode: { $lt: 400 } }),
      ApiCallStats.countDocuments({ category: 'video', statusCode: { $lt: 400 } }),
      ApiCallStats.countDocuments({ category: 'llm', statusCode: { $lt: 400 } }),
    ]);
    apiStats.total = all;
    apiStats.ai.image = { total: img, success: imgOk, fail: img - imgOk };
    apiStats.ai.video = { total: vid, success: vidOk, fail: vid - vidOk };
    apiStats.ai.llm = { total: llm, success: llmOk, fail: llm - llmOk };
    apiStatsLoaded = true;
    console.log(`[stats] 从数据库恢复: 总${all}次, 生图${img}, 生视频${vid}, LLM${llm}`);
  } catch (e) { console.warn('[stats] 数据库恢复失败，使用空统计:', e.message); }
}

const apiStats = initStats();
// 异步恢复，不阻塞启动
loadStatsFromDB();

// ===== 全局安全中间件（爬虫拦截 + 限流 + 401滥用封禁） =====
app.use(require('./middleware/security.middleware'));

app.use('/api/v1', (req, res, next) => {
  const startTime = Date.now();
  const key = req.method + ' ' + req.path;
  apiStats.total++;
  if (!apiStats.routes[key]) apiStats.routes[key] = { count: 0, last: '', statuses: {} };
  apiStats.routes[key].count++;
  apiStats.routes[key].last = new Date().toISOString();

  // AI 调用分类
  let category = 'other';
  if (req.path.includes('generate-image') && req.body?.assetType === 'video') { category = 'video'; apiStats.ai.video.total++; }
  else if (req.path.includes('generate-image')) { category = 'image'; apiStats.ai.image.total++; }
  else if (req.path.includes('generate-prompt') || req.path.includes('ai-generate') || req.path.includes('auto-generate') || req.path.includes('/continue')) { category = 'llm'; apiStats.ai.llm.total++; }

  const orig = res.json.bind(res);
  res.json = function (body) {
    const s = res.statusCode;
    const success = s < 400;
    apiStats.routes[key].statuses[s] = (apiStats.routes[key].statuses[s] || 0) + 1;
    apiStats.recent.unshift({ route: key, status: s, time: new Date().toISOString() });
    if (apiStats.recent.length > 50) apiStats.recent.length = 50;

    // 内存计数
    if (category === 'video') { if (success) apiStats.ai.video.success++; else apiStats.ai.video.fail++; }
    else if (category === 'image') { if (success) apiStats.ai.image.success++; else apiStats.ai.image.fail++; }
    else if (category === 'llm') { if (success) apiStats.ai.llm.success++; else apiStats.ai.llm.fail++; }

    // 异步写入 MongoDB（不阻塞响应）
    if (category !== 'other' && apiStatsLoaded) {
      ApiCallStats.create({
        route: key, method: req.method, statusCode: s, category,
        projectId: req.body?.projectId || undefined,
        userId: req.user?._id || undefined,
        duration: Date.now() - startTime,
      }).catch(() => {});
    }

    return orig(body);
  };
  next();
});
// 接口监控查询（需登录）
app.get('/api/v1/monitor/endpoints', require('./middleware/auth.middleware').authRequired, (req, res) => {
  const list = Object.entries(apiStats.routes).map(([k, v]) => ({ route: k, ...v }));
  list.sort((a, b) => b.count - a.count);
  const okCount = apiStats.recent.filter(r => r.status < 400).length;
  res.json({ data: { total: apiStats.total, routes: list, recent: apiStats.recent.slice(0, 10), health: apiStats.recent.length > 0 ? Math.round(okCount / apiStats.recent.length * 100) : 100, ai: apiStats.ai } });
});

app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/scripts', scriptRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/storyboards', storyboardRoutes);
app.use('/api/v1/compositions', compositionRoutes);
app.use('/api/v1/promos', require('./routes/promo.routes'));
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/export', require('./routes/export.routes'));
app.use('/api/v1/statistics', require('./routes/statistics.routes'));
app.use('/api/v1/media-library', require('./routes/media.routes'));
app.use('/api/v1/tts', require('./routes/tts.routes'));
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/error-logs', require('./routes/error-log.routes'));
app.use('/api/v1/announcements', require('./routes/announcement.routes'));
app.use('/api/v1/backup', require('./routes/backup.routes'));
app.use('/api/geojson', require('./routes/geojson-proxy'));

app.get('/api/health', (req, res) => {
  const appConfig = require('./config/app.config');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    llmConfigured: appConfig.hasLLMConfigured(),
  });
});

// 分析埋点上报
app.post('/api/v1/analytics/event', async (req, res) => {
  try {
    const Analytics = require('./models/analytics.model');
    const { event, metadata } = req.body;
    const doc = await Analytics.create({
      event: event || 'page_view',
      userId: req.body.userId || 'default_user',
      projectId: req.body.projectId || null,
      metadata: {
        platform: metadata?.platform || '',
        browser: metadata?.browser || '',
        region: metadata?.region || '',
        referrer: metadata?.referrer || '',
        page: metadata?.page || '',
        duration: metadata?.duration || 0,
        extra: metadata?.extra || {},
      },
    });
    res.status(201).json({ data: { id: doc._id } });
  } catch (e) { next(e); }
});

// 初始化默认管理员账号（首次启动生成随机密码）
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function initAdmin() {
  try {
    const User = require('./models/user.model');
    const exists = await User.findOne({ username: 'admin' });
    let adminUser = exists;
    const RESET_ADMIN = process.env.RESET_ADMIN_PWD === 'true';
    const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';  // 用户主动设置的已知密码

    if (!adminUser || RESET_ADMIN) {
      // 优先用环境变量 ADMIN_PASSWORD，没设则随机 6 位
      const defaultPassword = ENV_PASSWORD || String(Math.floor(100000 + Math.random() * 900000));
      const hashed = await bcrypt.hash(defaultPassword, 12);

      if (adminUser && RESET_ADMIN) {
        adminUser.password = hashed;
        await adminUser.save();
        console.log('══════════════════════════════════════════');
        console.log('  🔄 Admin password reset');
        console.log('  Username: admin');
        console.log(`  Password: ${defaultPassword}`);
      } else {
        adminUser = await User.create({ username: 'admin', password: hashed, role: 'admin', status: 'active' });
        console.log('══════════════════════════════════════════');
        console.log('  🔐 Default admin created');
        console.log('  Username: admin');
        console.log(`  Password: ${defaultPassword}`);
      }

      if (!ENV_PASSWORD) {
        console.log('  ⚠️  This is a random password. Set ADMIN_PASSWORD in .env to use your own.');
      }
      console.log('  ⚠️  Please change password after login!');
      console.log('══════════════════════════════════════════');
    }

    // 确保 admin 有 settings + 迁移旧全局配置 + 从 .env 种子 API Key
    const Settings = require('./models/settings.model');
    const adminSettings = await Settings.findOne({ userId: adminUser._id });
    if (!adminSettings) {
      await Settings.create({ userId: adminUser._id });
      console.log('[init] ✅ 已为 admin 创建 settings');
    }

    // 如果 admin 的 settings 里还没填过任何 API Key，从 .env 自动种子一份
    const currentProviders = adminSettings?.llmProviders || {};
    const hasAnyKey = ['deepseek','doubao','tongyi','openai'].some(p => currentProviders[p]?.apiKey);
    if (!hasAnyKey) {
      const envMap = {
        deepseek: { apiKey: process.env.DEEPSEEK_API_KEY || '', baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1', model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro' },
        doubao: { apiKey: process.env.DOUBAO_API_KEY || '', baseUrl: process.env.DOUBAO_BASE_URL || '', model: process.env.DOUBAO_MODEL || '' },
        tongyi: { apiKey: process.env.TONGYI_API_KEY || '', baseUrl: process.env.TONGYI_BASE_URL || '', model: process.env.TONGYI_MODEL || '' },
        openai: { apiKey: process.env.OPENAI_API_KEY || '', baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', model: process.env.OPENAI_MODEL || 'gpt-4o' },
      };
      const seed = {};
      Object.entries(envMap).forEach(([p, cfg]) => { if (cfg.apiKey) seed[p] = cfg; });
      if (Object.keys(seed).length > 0) {
        await Settings.updateSettings(adminUser._id, { llmProviders: { ...currentProviders, ...seed } });
        console.log(`[init] ✅ 已从 .env 为 admin 种子 ${Object.keys(seed).length} 个 API Key`);
      }
    }

    const oldSettings = await Settings.findOne({ key: 'llm_config' });
    if (oldSettings && !adminSettings?.llmProviders?.deepseek?.apiKey) {
      await Settings.updateSettings(adminUser._id, {
        llmProviders: oldSettings.llmProviders,
        storageConfig: oldSettings.storageConfig,
        aiConfig: oldSettings.aiConfig,
      });
      await Settings.deleteOne({ key: 'llm_config' });
      console.log('[init] ✅ 已将旧版全局配置迁移到管理员账号');
    }
  } catch (e) { console.warn('[init] 管理员初始化失败:', e.message); }
}


app.use(errorHandler);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`Socket ${socket.id} joined project-${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(`project-${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.SERVER_PORT || 3012;

connectDB().then(async () => {
  // ===== 加密密钥校验 =====
  if (!process.env.ENCRYPTION_KEY) {
    console.error('[init] ❌ ENCRYPTION_KEY 环境变量未设置！API Key 无法加密存储。');
    console.error('[init]    请在 .env 中添加 ENCRYPTION_KEY=<随机32位字符串>');
    process.exit(1);
  }

  // ===== 迁移存量明文 API Key → 加密 =====
  try {
    const Settings = require('./models/settings.model');
    const { encrypt, isEncrypted } = require('./utils/crypto');
    const allSettings = await Settings.find({});
    let migrated = 0;
    for (const doc of allSettings) {
      let dirty = false;
      const llm = doc.llmProviders;
      if (llm) {
        ['deepseek', 'doubao', 'tongyi', 'openai'].forEach(p => {
          if (llm[p]?.apiKey && !isEncrypted(llm[p].apiKey) && llm[p].apiKey.length > 0) {
            llm[p].apiKey = encrypt(llm[p].apiKey);
            dirty = true;
          }
        });
      }
      if (doc.smsConfig?.accessKeySecret && !isEncrypted(doc.smsConfig.accessKeySecret)) {
        doc.smsConfig.accessKeySecret = encrypt(doc.smsConfig.accessKeySecret);
        dirty = true;
      }
      if (doc.storageConfig?.accessKeySecret && !isEncrypted(doc.storageConfig.accessKeySecret)) {
        doc.storageConfig.accessKeySecret = encrypt(doc.storageConfig.accessKeySecret);
        dirty = true;
      }
      if (dirty) {
        await doc.save();  // pre-save hook will encryptSettings, but we already encrypted above — safe: isEncrypted check prevents double
        migrated++;
      }
    }
    if (migrated > 0) console.log(`[init] 🔐 已将 ${migrated} 条 settings 的明文 API Key 加密存储`);
  } catch (e) { console.warn('[init] API Key 加密迁移失败:', e.message); }

  // LLM 配置已改为按用户隔离，在用户访问时按需加载（见 auth middleware + loadUserConfig）

  // 给没有 UID 的老用户补上
  const User = require('./models/user.model');
  const crypto = require('crypto');
  const usersWithoutUid = await User.find({ uid: { $exists: false } });
  for (const u of usersWithoutUid) {
    let uid;
    do { uid = 'US-' + crypto.randomBytes(8).toString('hex').toUpperCase(); }
    while (await User.findOne({ uid }));
    await User.updateOne({ _id: u._id }, { $set: { uid } });
  }
  if (usersWithoutUid.length > 0) console.log(`[init] 已为 ${usersWithoutUid.length} 个老用户生成 UID`);

  // 初始化管理员 + 从 .env 种子 API Key（迁移之后，确保种子数据也被加密）
  await initAdmin();

  // 检查 ffmpeg 可用性（非阻塞，仅日志警告）
  checkFfmpeg();

  server.listen(PORT, () => {
    console.log('');
    console.log('  \\x1b[33m  ____  _                    ____ _            \\x1b[0m');
    console.log('  \\x1b[33m / ___|| |_ ___  _ __ _   _ / ___(_)_ __   ___ \\x1b[0m');
    console.log('  \\x1b[33m \\___ \\| __/ _ \\| \'__| | | | |   | | \'_ \\ / _ \\\\x1b[0m');
    console.log('  \\x1b[33m  ___) | || (_) | |  | |_| | |___| | | | |  __/\\x1b[0m');
    console.log('  \\x1b[33m |____/ \\__\\___/|_|   \\__, |\\____|_|_| |_|\\___|\\x1b[0m');
    console.log('  \\x1b[33m                      |___/                  \\x1b[0m');
    console.log('');
    console.log(`       36m  ➜  http://localhost:${PORT}`);
    console.log('');
  });
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

module.exports = { app, server, io };
