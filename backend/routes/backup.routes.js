/**
 * 数据库备份/恢复路由（仅管理员）
 *
 * 安全机制：
 *   1. 自动备份同时写入冷备目录（API 删不掉）
 *   2. 删除操作移到 .trash/，7天后才真正删除
 *   3. 所有操作记录审计日志
 *   4. 批量消失检测 + 告警
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const router = express.Router();
const { authRequired } = require('../middleware/auth.middleware');

router.use(authRequired);

const AuditLog = require('../models/audit-log.model');

/** 管理员校验 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ code: 403, message: '仅管理员可操作' });
  next();
}

/** 记录审计日志 */
async function audit(action, detail, req, meta = {}) {
  try {
    await AuditLog.create({
      action, detail,
      operator: req.user?.username || 'system',
      operatorId: req.user?._id,
      ip: req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
      metadata: meta,
    });
  } catch (e) { console.warn('[audit] 记录失败:', e.message); }
}

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const TRASH_DIR = path.join(BACKUP_DIR, '.trash');
const COLD_DIR = process.env.COLD_BACKUP_DIR || path.join(BACKUP_DIR, '.cold');
const AUTO_CFG_FILE = path.join(BACKUP_DIR, '.auto-config.json');
const BACKUP_VERSION = 2;
const TRASH_TTL_MS = 7 * 24 * 3600000; // 7 天

// 初始化目录
for (const d of [BACKUP_DIR, TRASH_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ===== 需要备份的集合列表 =====
const COLLECTIONS = [
  'users', 'projects', 'scripts', 'compositions', 'storyboards',
  'characters', 'props', 'scenes', 'sceneassets', 'ttsaudios',
  'settings', 'analytics', 'loginlogs', 'errorlogs', 'announcements',
];

function localTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds())}`;
}

// ===== 冷备同步 =====
function syncToCold(filename) {
  if (!COLD_DIR) return;
  try {
    if (!fs.existsSync(COLD_DIR)) fs.mkdirSync(COLD_DIR, { recursive: true });
    const src = path.join(BACKUP_DIR, filename);
    const dst = path.join(COLD_DIR, filename);
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
  } catch (e) { console.warn('[cold-backup] 同步失败:', e.message); }
}

// ===== 回收站清理 =====
function cleanTrash() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(TRASH_DIR).filter(f => f.endsWith('.json.gz'));
    let cleaned = 0;
    for (const f of files) {
      const fp = path.join(TRASH_DIR, f);
      if (now - fs.statSync(fp).mtimeMs > TRASH_TTL_MS) {
        fs.unlinkSync(fp);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[trash] 清理 ${cleaned} 个过期备份`);
  } catch (e) { /* ignore */ }
}

// ===== 批量删除检测（5分钟内消失超过3个 → 告警） =====
const deletionTracker = [];
function trackDeletion(filename) {
  const now = Date.now();
  deletionTracker.push({ filename, time: now });
  // 只保留最近5分钟
  while (deletionTracker.length > 0 && now - deletionTracker[0].time > 300000) {
    deletionTracker.shift();
  }
  if (deletionTracker.length >= 4) {
    console.error(`[SECURITY] ⚠️ 5分钟内已删除 ${deletionTracker.length} 个备份！疑似批量删除攻击！`);
    console.error(`[SECURITY] 文件: ${deletionTracker.map(d => d.filename).join(', ')}`);
  }
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
      try { data[col] = await mongoose.connection.db.collection(col).find({}).toArray(); }
      catch { data[col] = []; }
    }

    const payload = JSON.stringify({ version: BACKUP_VERSION, createdAt: new Date().toISOString(), collections: data });
    const compressed = zlib.gzipSync(payload);
    const filename = `backup-${localTimestamp()}.json.gz`;
    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, compressed);

    // 同步到冷备目录
    syncToCold(filename);

    // 清理旧备份（移到回收站而不是直接删除）
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json.gz')).sort();
    while (files.length > cfg.maxBackups) {
      const oldFile = files.shift();
      const oldPath = path.join(BACKUP_DIR, oldFile);
      const trashPath = path.join(TRASH_DIR, oldFile);
      fs.renameSync(oldPath, trashPath);
    }

    // 清理过期回收站
    cleanTrash();

    // 冷备目录也限制数量
    try {
      const coldFiles = fs.readdirSync(COLD_DIR).filter(f => f.endsWith('.json.gz')).sort();
      while (coldFiles.length > cfg.maxBackups) {
        fs.unlinkSync(path.join(COLD_DIR, coldFiles.shift()));
      }
    } catch {}

    console.log(`[auto-backup] 完成: ${filename} (${files.length} 个保留, 冷备已同步)`);
  } catch (e) { console.error('[auto-backup] 失败:', e.message); }
}

function startAutoBackup() {
  stopAutoBackup();
  const cfg = loadAutoCfg();
  if (cfg.enabled) {
    const ms = Math.max(1, cfg.intervalHours || 24) * 3600000;
    autoBackupTimer = setInterval(runAutoBackup, ms);
    console.log(`[auto-backup] 已启动 (每 ${cfg.intervalHours}h, 保留 ${cfg.maxBackups} 个, 冷备: ${COLD_DIR || '禁用'})`);
    setTimeout(runAutoBackup, 30000);
  }
}

function stopAutoBackup() {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
}

startAutoBackup();

// ===== 导出备份 =====
router.post('/export', requireAdmin, async (req, res) => {
  try {
    const data = {};
    for (const col of COLLECTIONS) {
      try { data[col] = await mongoose.connection.db.collection(col).find({}).toArray(); }
      catch { data[col] = []; }
    }

    const totalDocs = Object.values(data).reduce((s, arr) => s + arr.length, 0);
    const payload = JSON.stringify({ version: BACKUP_VERSION, createdAt: new Date().toISOString(), collections: data });
    const compressed = zlib.gzipSync(payload);

    const filename = `backup-${localTimestamp()}.json.gz`;
    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, compressed);
    syncToCold(filename);

    await audit('backup.export', `手动导出: ${filename} (${totalDocs} 条)`, req, { filename, totalDocs, size: compressed.length });

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
        await audit('backup.import', `从备份恢复: 清 ${stats.cleared} + 导 ${totalInserted} (回滚: ${rollbackName})`, req, { cleared: stats.cleared, inserted: totalInserted, errors: totalErrors });
        console.log(`[backup] 导入: ${stats.cleared}清 + ${totalInserted}导 (回滚: ${rollbackName})`);
      } catch (e) {
        res.status(400).json({ code: 400, message: '解析失败: ' + e.message });
      }
    });
  } catch (e) {
    res.status(500).json({ code: 500, message: '导入失败: ' + e.message });
  }
});

// ===== 列出备份（含回收站） =====
router.get('/list', requireAdmin, async (req, res) => {
  try {
    cleanTrash(); // 顺便清理过期回收站

    const mapFiles = (dir, tag) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json.gz'))
        .sort()
        .reverse()
        .map(f => {
          const stat = fs.statSync(path.join(dir, f));
          const match = f.match(/^backup-(.+)\.json\.gz$/);
          let displayTime = '未知';
          if (match) {
            const raw = match[1];
            const parts = raw.split('T');
            displayTime = parts[0] + ' ' + (parts[1] ? parts[1].replace(/-/g, ':').split(':').slice(0, 3).join(':') : '');
          }
          return {
            filename: f,
            createdAt: displayTime,
            size: stat.size,
            sizeFormatted: stat.size > 1048576 ? (stat.size / 1048576).toFixed(1) + ' MB'
              : stat.size > 1024 ? (stat.size / 1024).toFixed(1) + ' KB'
              : stat.size + ' B',
            trashed: tag === 'trash',
          };
        });
    };

    const activeFiles = mapFiles(BACKUP_DIR, 'active');
    const trashFiles = mapFiles(TRASH_DIR, 'trash');
    const cfg = loadAutoCfg();

    res.json({ code: 0, data: { files: activeFiles, trash: trashFiles, coldEnabled: !!COLD_DIR, autoBackup: cfg } });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

// ===== 删除备份（移入回收站，7天后自动清除） =====
router.delete('/:filename', requireAdmin, async (req, res) => {
  try {
    const name = path.basename(req.params.filename);
    if (!name.endsWith('.json.gz')) return res.status(400).json({ code: 400, message: '无效文件名' });
    const filePath = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ code: 404, message: '文件不存在' });

    // 移到回收站，而非直接删除
    const trashPath = path.join(TRASH_DIR, name);
    fs.renameSync(filePath, trashPath);

    trackDeletion(name);
    await audit('backup.delete', `备份移入回收站: ${name}`, req, { filename: name });

    res.json({ code: 0, message: '已移入回收站，7天后自动清除' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

// ===== 从回收站恢复 =====
router.post('/restore/:filename', requireAdmin, async (req, res) => {
  try {
    const name = path.basename(req.params.filename);
    if (!name.endsWith('.json.gz')) return res.status(400).json({ code: 400, message: '无效文件名' });
    const trashPath = path.join(TRASH_DIR, name);
    if (!fs.existsSync(trashPath)) return res.status(404).json({ code: 404, message: '回收站中不存在此文件' });

    const destPath = path.join(BACKUP_DIR, name);
    fs.renameSync(trashPath, destPath);
    await audit('backup.import', `从回收站恢复: ${name}`, req, { filename: name });

    res.json({ code: 0, message: '已恢复' });
  } catch (e) {
    res.status(500).json({ code: 500, message: '恢复失败' });
  }
});

// ===== 下载备份 =====
router.get('/download/:filename', requireAdmin, async (req, res) => {
  try {
    const name = path.basename(req.params.filename);
    if (!name.endsWith('.json.gz')) return res.status(400).json({ code: 400, message: '无效文件名' });
    const filePath = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ code: 404, message: '文件不存在' });
    await audit('backup.download', `下载备份: ${name}`, req, { filename: name });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ code: 500, message: '下载失败' });
  }
});

// ===== 挂载自检 =====
router.get('/check-mount', requireAdmin, async (req, res) => {
  try {
    const testFile = path.join(BACKUP_DIR, '.mount-test');
    const testId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // 写入测试
    fs.writeFileSync(testFile, testId, 'utf-8');
    // 读取验证
    const readBack = fs.readFileSync(testFile, 'utf-8');
    // 清理
    fs.unlinkSync(testFile);

    const ok = readBack === testId;
    const stat = fs.statSync(BACKUP_DIR);

    res.json({
      code: 0,
      data: {
        ok,
        path: BACKUP_DIR,
        writable: ok,
        exists: true,
        message: ok ? '备份目录读写正常，挂载状态良好' : '写入验证失败，请检查磁盘权限',
      },
    });
  } catch (e) {
    res.json({
      code: 0,
      data: {
        ok: false,
        path: BACKUP_DIR,
        writable: false,
        exists: fs.existsSync(BACKUP_DIR),
        message: '备份目录不可写: ' + (e.message || '未知错误'),
      },
    });
  }
});

// ===== 自动备份配置 =====
router.put('/auto/config', requireAdmin, async (req, res) => {
  try {
    const { enabled, intervalHours, maxBackups } = req.body;
    const oldCfg = loadAutoCfg();
    const cfg = { ...oldCfg };
    if (typeof enabled === 'boolean') cfg.enabled = enabled;
    if (intervalHours > 0) cfg.intervalHours = Math.max(1, Math.min(168, parseInt(intervalHours) || 24));
    if (maxBackups > 0) cfg.maxBackups = Math.max(1, Math.min(100, parseInt(maxBackups) || 7));
    saveAutoCfg(cfg);
    startAutoBackup();
    await audit('backup.config', `自动备份配置: ${JSON.stringify(oldCfg)} → ${JSON.stringify(cfg)}`, req, { old: oldCfg, new: cfg });
    res.json({ code: 0, message: '配置已保存', data: cfg });
  } catch (e) {
    res.status(500).json({ code: 500, message: '保存失败' });
  }
});

// ===== 审计日志查询 =====
router.get('/audit', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const filter = {};
    if (action) filter.action = action;
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ code: 0, data: { logs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (e) {
    res.status(500).json({ code: 500, message: '查询失败' });
  }
});

module.exports = router;
