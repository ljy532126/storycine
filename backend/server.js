require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB } = require('./config/database');
const errorHandler = require('./middleware/error-handler');

const projectRoutes = require('./routes/project.routes');
const scriptRoutes = require('./routes/script.routes');
const assetRoutes = require('./routes/asset.routes');
const storyboardRoutes = require('./routes/storyboard.routes');
const compositionRoutes = require('./routes/composition.routes');
const configRoutes = require('./routes/config.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.set('io', io);
require('./utils/socket-registry').setIO(io);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

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

// API 监控中间件
const apiStats = { total: 0, routes: {}, recent: [], ai: { image: { total: 0, success: 0, fail: 0 }, video: { total: 0, success: 0, fail: 0 }, llm: { total: 0, success: 0, fail: 0 } } };
app.use('/api/v1', (req, res, next) => {
  const key = req.method + ' ' + req.path;
  apiStats.total++;
  if (!apiStats.routes[key]) apiStats.routes[key] = { count: 0, last: '', statuses: {} };
  apiStats.routes[key].count++;
  apiStats.routes[key].last = new Date().toISOString();
  // AI 调用分类统计
  if (req.path.includes('generate-image') && req.body?.assetType === 'video') apiStats.ai.video.total++;
  if (req.path.includes('generate-image') && req.body?.assetType !== 'video') apiStats.ai.image.total++;
  if (req.path.includes('generate-prompt') || req.path.includes('/scripts/generate') || req.path.includes('/scripts/continue')) apiStats.ai.llm.total++;

  const orig = res.json.bind(res);
  res.json = function (body) {
    const s = res.statusCode;
    apiStats.routes[key].statuses[s] = (apiStats.routes[key].statuses[s] || 0) + 1;
    apiStats.recent.unshift({ route: key, status: s, time: new Date().toISOString() });
    if (apiStats.recent.length > 50) apiStats.recent.length = 50;
    // AI 调用成功/失败统计
    if (req.path.includes('generate-image') && req.body?.assetType === 'video') { if (s < 400) apiStats.ai.video.success++; else apiStats.ai.video.fail++; }
    if (req.path.includes('generate-image') && req.body?.assetType !== 'video') { if (s < 400) apiStats.ai.image.success++; else apiStats.ai.image.fail++; }
    if (req.path.includes('generate-prompt') || req.path.includes('/scripts/generate') || req.path.includes('/scripts/continue')) { if (s < 400) apiStats.ai.llm.success++; else apiStats.ai.llm.fail++; }
    return orig(body);
  };
  next();
});
// 接口监控查询
app.get('/api/v1/monitor/endpoints', (req, res) => {
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
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/export', require('./routes/export.routes'));
app.use('/api/v1/statistics', require('./routes/statistics.routes'));
app.use('/api/v1/media-library', require('./routes/media.routes'));
app.use('/api/v1/auth', require('./routes/auth.routes'));

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
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// 初始化默认管理员账号（首次启动生成随机密码）
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
async function initAdmin() {
  try {
    const User = require('./models/user.model');
    const exists = await User.findOne({ username: 'admin' });
    let adminUser = exists;
    if (!adminUser) {
      const randomPassword = crypto.randomBytes(8).toString('hex');
      adminUser = await User.create({ username: 'admin', password: await bcrypt.hash(randomPassword, 12), role: 'admin', status: 'active' });
      console.log('══════════════════════════════════════════');
      console.log('  🔐 默认管理员已创建');
      console.log(`  账号: admin`);
      console.log(`  密码: ${randomPassword}`);
      console.log('  ⚠️  请立即登录并修改密码！');
      console.log('══════════════════════════════════════════');
    }

    // 迁移旧的全局 settings 到管理员名下（旧版本使用 key: 'llm_config' 的单例模式）
    const Settings = require('./models/settings.model');
    const oldSettings = await Settings.findOne({ key: 'llm_config' });
    if (oldSettings && adminUser) {
      const adminSettings = await Settings.findOne({ userId: adminUser._id });
      if (!adminSettings || !adminSettings.llmProviders?.deepseek?.apiKey) {
        // 将旧数据合并到管理员的 settings
        const target = adminSettings || await Settings.create({ userId: adminUser._id });
        target.llmProviders = oldSettings.llmProviders || target.llmProviders;
        target.storageConfig = oldSettings.storageConfig || target.storageConfig;
        target.aiConfig = oldSettings.aiConfig || target.aiConfig;
        await target.save();
        await Settings.deleteOne({ key: 'llm_config' });
        console.log('[init] ✅ 已将旧版全局配置迁移到管理员账号');
      }
    }
  } catch (e) { console.warn('[init] 管理员初始化失败:', e.message); }
}
initAdmin();

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
