/**
 * 数据库备份/恢复路由（仅管理员）
 *
 * 备份格式：单个 JSON 文件，包含所有集合的完整数据
 * 适用场景：Docker 部署和传统部署通用，通过 API 导出/导入
 *
 * Docker 部署注意：确保 backend/backups/ 目录挂载为卷，否则容器销毁后备份丢失
 *   docker run -v /host/backups:/app/backups ...
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const router = express.Router();
const { authRequired } = require('../middleware/auth.middleware');

router.use(authRequired);

/** 管理员校验 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ code: 403, message: '仅管理员可操作' });
  next();
}

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const AUTO_CFG_FILE = path.join(BACKUP_DIR, '.auto-config.json');
const BACKUP_VERSION = 2;

// 初始化目录
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ===== 需要备份的集合列表 =====
const COLLECTIONS = [
  'users', 'projects', 'scripts', 'compositions', 'storyboards',
  'characters', 'props', 'scenes', 'sceneassets', 'ttsaudios',
  'settings', 'analytics', 'loginlogs', 'errorlogs', 'announcements',
];

// 生成本地时间戳字符串（中国时区）
function localTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds())}`;
}

// ===== 自动备份 =====
let autoBackupTimer = null;

function loadAutoCfg() {
  try { return JSON.parse(fs.readFileSync(AUTO_CFG_FILE, 'utf-8')); }
  catch { return { enabled: false, intervalHours: 24, maxBackups: 7 }; }
}

function saveAutoCfg(cfg) {
  fs.writeFileSync(AUTO_CFG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

async function runAutoBackup() {
  try {
    const cfg = loadAutoCfg();
    if (!cfg.enabled) return;

    const data = {};
    for (const col of COLLECTIONS) {
      try {
        const docs = await mongoose.connection.db.collection(col).find({}).toArray();
        data[col] = docs;
      } catch { data[col] = []; }
    }

    const payload = JSON.stringify({ version: BACKUP_VERSION, createdAt: new Date().toISOString(), collections: data });
    const compressed = zlib.gzipSync(payload);
    const filename = `backup-${localTimestamp()}.json.gz`;
    fs.writeFileSync(path.join(BACKUP_DIR, filename), compressed);

    // 清理旧备份
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json.gz')).sort();
    while (files.length > cfg.maxBackups) {
      fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    }

    console.log(`[auto-backup] 完成: ${filename} (${files.length} 个保留)`);
  } catch (e) { console.error('[auto-backup] 失败:', e.message); }
}

function startAutoBackup() {
  stopAutoBackup();
  const cfg = loadAutoCfg();
  if (cfg.enabled) {
    const ms = Math.max(1, cfg.intervalHours || 24) * 3600000;
    autoBackupTimer = setInterval(runAutoBackup, ms);
    console.log(`[auto-backup] 已启动 (每 ${cfg.intervalHours}h, 保留 ${cfg.maxBackups} 个)`);
    // 启动后延迟 30 秒执行首次
    setTimeout(runAutoBackup, 30000);
  }
}

function stopAutoBackup() {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
}

// 服务启动时自动开启
startAutoBackup();

// ===== 导出备份 =====
router.post('/export', requireAdmin, async (req, res) => {
  try {
    const data = {};
    for (const col of COLLECTIONS) {
      try {
        const docs = await mongoose.connection.db.collection(col).find({}).toArray();
        data[col] = docs;
      } catch { data[col] = []; }
    }

    const totalDocs = Object.values(data).reduce((s, arr) => s + arr.length, 0);
    const payload = JSON.stringify({ version: BACKUP_VERSION, createdAt: new Date().toISOString(), collections: data });
    const compressed = zlib.gzipSync(payload);

    const filename = `backup-${localTimestamp()}.json.gz`;
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(compressed);

    console.log(`[backup] 导出: ${filename} (${(compressed.length / 1024).toFixed(1)} KB, ${totalDocs} docs)`);
  } catch (e) {
    res.status(500).json({ code: 500, message: '导出失败: ' + e.message });
  }
});

// ===== 导入备份（multipart，导入前自动备份当前数据防止误操作） =====
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }).single('file');

    upload(req, res, async (err) => {
      if (err) return res.status(400).json({ code: 400, message: '文件上传失败: ' + err.message });
      if (!req.file) return res.status(400).json({ code: 400, message: '请选择备份文件' });

      try {
        let raw;
        try {
          raw = zlib.gunzipSync(req.file.buffer);
        } catch {
          // 可能未压缩（浏览器下载时自动解压）
          raw = req.file.buffer;
        }

        const backup = JSON.parse(raw.toString('utf-8'));
        if (!backup.collections || !backup.version) {
          return res.status(400).json({ code: 400, message: '无效的备份文件格式，请检查文件是否完整' });
        }

        // ── 安全措施：导入前先备份当前数据 ──
        const rollbackName = `backup-BEFORE-RESTORE-${localTimestamp()}.json.gz`;
        const rollbackPath = path.join(BACKUP_DIR, rollbackName);
        try {
          const beforeData = {};
          for (const col of COLLECTIONS) {
            try { beforeData[col] = await mongoose.connection.db.collection(col).find({}).toArray(); }
            catch { beforeData[col] = []; }
          }
          const rollbackPayload = JSON.stringify({ version: BACKUP_VERSION, createdAt: new Date().toISOString(), collections: beforeData });
          fs.writeFileSync(rollbackPath, zlib.gzipSync(rollbackPayload));
          console.log(`[backup] 导入前快照已保存: ${rollbackName}`);
        } catch (e) {
          console.warn('[backup] 导入前快照失败:', e.message);
        }

        // ── 清空现有数据 ──
        const stats = { cleared: 0, inserted: 0, skipped: 0, errors: 0 };
        for (const col of COLLECTIONS) {
          try {
            const result = await mongoose.connection.db.collection(col).deleteMany({});
            stats.cleared += result.deletedCount;
          } catch { /* collection doesn't exist yet */ }
        }

        // ── 插入备份数据（修复 _id 类型：JSON 序列化会丢失 ObjectId）──
        const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
        const ID_FIELDS = ['_id', 'userId', 'projectId', 'linkId', 'ownerId', 'scriptId', 'compositionId', 'storyboardId'];
        function fixObjectIds(doc) {
          for (const key of ID_FIELDS) {
            if (typeof doc[key] === 'string' && OBJECT_ID_RE.test(doc[key])) {
              doc[key] = new mongoose.Types.ObjectId(doc[key]);
            }
          }
          return doc;
        }

        let totalInserted = 0, totalErrors = 0;
        const COLLECTION_ORDER = ['users', 'settings'];
        const restCols = COLLECTIONS.filter(c => !COLLECTION_ORDER.includes(c));
        const orderedCols = [...COLLECTION_ORDER, ...restCols];

        for (const col of orderedCols) {
          const docs = backup.collections[col];
          if (!Array.isArray(docs) || docs.length === 0) { stats.skipped++; continue; }
          try {
            const fixed = docs.map(fixObjectIds);
            await mongoose.connection.db.collection(col).insertMany(fixed, { ordered: false });
            totalInserted += fixed.length;
          } catch (e) {
            if (e.insertedDocs) totalInserted += e.insertedDocs.length;
            if (e.writeErrors) totalErrors += e.writeErrors.length;
            console.warn(`[backup] 集合 ${col} 部分插入失败:`, e.message?.substring(0, 100));
          }
        }

        res.json({
          code: 0,
          message: `数据恢复完成`,
          data: { cleared: stats.cleared, inserted: totalInserted, errors: totalErrors, skipped: stats.skipped, rollbackFile: rollbackName },
        });
        console.log(`[backup] 导入: ${stats.cleared}清 + ${totalInserted}导 (回滚: ${rollbackName})`);
      } catch (e) {
        res.status(400).json({ code: 400, message: '解析失败: ' + e.message });
      }
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '导入失败: ' + e.message });
  }
});

// ===== 列出备份 =====
router.get('/list', requireAdmin, async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json.gz'))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        const match = f.match(/^backup-(.+)\.json\.gz$/);
        let displayTime = '未知';
        if (match) {
          // 文件名已用本地时间：backup-2026-06-08T22-39-03-456.json.gz
          const raw = match[1];
          const parts = raw.split('T');
          const date = parts[0];
          const time = parts[1] ? parts[1].replace(/-/g, ':').split(':').slice(0, 3).join(':') : '';
          displayTime = date + ' ' + time;
        }
        return {
          filename: f,
          createdAt: displayTime,
          size: stat.size,
          sizeFormatted: stat.size > 1048576 ? (stat.size / 1048576).toFixed(1) + ' MB'
            : stat.size > 1024 ? (stat.size / 1024).toFixed(1) + ' KB'
            : stat.size + ' B',
        };
      });

    const cfg = loadAutoCfg();
    res.json({ code: 0, data: { files, autoBackup: cfg } });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

// ===== 删除备份 =====
router.delete('/:filename', requireAdmin, async (req, res) => {
  try {
    const name = path.basename(req.params.filename);
    if (!name.endsWith('.json.gz')) return res.status(400).json({ code: 400, message: '无效文件名' });
    const filePath = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ code: 404, message: '文件不存在' });
    fs.unlinkSync(filePath);
    res.json({ code: 0, message: '已删除' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

// ===== 下载备份 =====
router.get('/download/:filename', requireAdmin, async (req, res) => {
  try {
    const name = path.basename(req.params.filename);
    if (!name.endsWith('.json.gz')) return res.status(400).json({ code: 400, message: '无效文件名' });
    const filePath = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ code: 404, message: '文件不存在' });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ code: 500, message: '下载失败' });
  }
});

// ===== 自动备份配置 =====
router.put('/auto/config', requireAdmin, async (req, res) => {
  try {
    const { enabled, intervalHours, maxBackups } = req.body;
    const cfg = loadAutoCfg();
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    if (intervalHours > 0) cfg.intervalHours = Math.max(1, Math.min(168, parseInt(intervalHours) || 24));
    if (maxBackups > 0) cfg.maxBackups = Math.max(1, Math.min(100, parseInt(maxBackups) || 7));
    saveAutoCfg(cfg);
    startAutoBackup();
    res.json({ code: 0, message: '配置已保存', data: cfg });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存失败' });
  }
});

module.exports = router;
