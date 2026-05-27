const express = require('express');
const router = express.Router();
const os = require('os');
const mongoose = require('mongoose');

const Project = require('../models/project.model');
const Script = require('../models/script.model');
const Composition = require('../models/composition.model');
const Storyboard = require('../models/storyboard.model');
const Analytics = require('../models/analytics.model');

// ===== 1. 今日概览 =====
router.get('/daily-overview', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    // 今日数据
    const [todayProjects, todayScripts, todayComps, todayFailedScripts, todayFailedComps] = await Promise.all([
      Project.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd }, isDeleted: { $ne: true } }),
      Script.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
      Composition.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
      Script.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd }, status: { $nin: ['draft', 'approved', 'locked'] } }),
      Composition.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd }, status: 'failed' }),
    ]);

    // 昨日数据（用于环比）
    const [yesterdayProjects, yesterdayScripts, yesterdayComps] = await Promise.all([
      Project.countDocuments({ createdAt: { $gte: yesterdayStart, $lt: todayStart }, isDeleted: { $ne: true } }),
      Script.countDocuments({ createdAt: { $gte: yesterdayStart, $lt: todayStart } }),
      Composition.countDocuments({ createdAt: { $gte: yesterdayStart, $lt: todayStart } }),
    ]);

    // 今日新增用户（通过 Analytics 中首次出现的 userId 统计）
    const todayUsers = await Analytics.distinct('userId', { createdAt: { $gte: todayStart, $lt: todayEnd } });
    const yesterdayUsers = await Analytics.distinct('userId', { createdAt: { $gte: yesterdayStart, $lt: todayStart } });

    const todayTotal = todayScripts + todayComps || 1;
    const successRate = Math.round((todayScripts + todayComps - todayFailedScripts - todayFailedComps) / todayTotal * 100);

    function calcChange(today, yesterday) {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round((today - yesterday) / yesterday * 100);
    }

    res.json({
      data: {
        newUsers: { value: todayUsers.length, change: calcChange(todayUsers.length, yesterdayUsers.length) },
        newProjects: { value: todayProjects, change: calcChange(todayProjects, yesterdayProjects) },
        scriptsGenerated: { value: todayScripts, change: calcChange(todayScripts, yesterdayScripts) },
        compositions: { value: todayComps, change: calcChange(todayComps, yesterdayComps) },
        successRate: { value: successRate, change: 0 },
      },
    });
  } catch (e) { next(e); }
});

// ===== 2. 近7天趋势 =====
router.get('/weekly-trend', async (req, res, next) => {
  try {
    const days = [];
    const scriptsData = [];
    const compsData = [];
    const labels = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const [sc, cc] = await Promise.all([
        Script.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
        Composition.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
      ]);

      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      labels.push(weekdays[d.getDay()]);
      scriptsData.push(sc);
      compsData.push(cc);
    }

    res.json({ data: { labels, scripts: scriptsData, compositions: compsData } });
  } catch (e) { next(e); }
});

// ===== 3. 热门题材 Top5 =====
router.get('/top-genres', async (req, res, next) => {
  try {
    // 从项目的 visualStyle / subStyle 聚合统计题材
    const projects = await Project.find({ isDeleted: { $ne: true } }, 'videoConfig.visualStyle videoConfig.subStyle').lean();
    const genreMap = {};

    projects.forEach(p => {
      const style = p.videoConfig?.visualStyle || '';
      const sub = p.videoConfig?.subStyle || '';
      const genre = sub || style || '未分类';
      genreMap[genre] = (genreMap[genre] || 0) + 1;
    });

    const sorted = Object.entries(genreMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const total = sorted.reduce((s, g) => s + g.count, 0) || 1;
    const colors = ['#C9A84C', '#1A1A2E', '#8B7355', '#D4C5C0', '#E8D5C4'];
    const result = sorted.map((g, i) => ({
      ...g,
      pct: Math.round(g.count / total * 100),
      color: colors[i] || '#8B7355',
    }));

    res.json({ data: result });
  } catch (e) { next(e); }
});

// ===== 4. 服务器监控 =====
router.get('/server-monitor', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const uptimeSec = Math.floor(os.uptime());

  // 更精确的 CPU 使用率：通过 loadAvg 相对核心数计算
  const loadAvg = os.loadavg();
  const cpuUsagePct = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100));

  const d = Math.floor(uptimeSec / 86400);
  const h = Math.floor((uptimeSec % 86400) / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);

  res.json({
    data: {
      cpu: {
        model: (cpus[0]?.model || 'Unknown').replace(/\s+CPU\s+|@.*|\(R\)|\(TM\)|processor\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim(),
        cores: cpus.length,
        usagePct: cpuUsagePct,
        loadAvg: loadAvg.map(v => Number(v.toFixed(2))),
      },
      memory: {
        total: Number((totalMem / 1024 / 1024 / 1024).toFixed(1)),
        used: Number((usedMem / 1024 / 1024 / 1024).toFixed(1)),
        free: Number((freeMem / 1024 / 1024 / 1024).toFixed(1)),
        usagePct: Math.round((usedMem / totalMem) * 100),
      },
      uptime: uptimeSec,
      uptimeFormatted: `${d}天 ${h}小时 ${m}分钟`,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      pid: process.pid,
    },
  });
});

// ===== 5. 用户活跃 =====
router.get('/user-activity', async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);

    // DAU - 今日独立用户
    const dauIds = await Analytics.distinct('userId', { createdAt: { $gte: todayStart, $lt: todayEnd } });
    const dau = dauIds.length || 1;

    // 人均生成次数 = 今日生成数 / DAU
    const todayGenerations = await Analytics.countDocuments({
      event: { $in: ['generate_script', 'generate_composition', 'generate_image', 'generate_video'] },
      createdAt: { $gte: todayStart, $lt: todayEnd },
    });
    const avgGenerations = dau > 0 ? Number((todayGenerations / dau).toFixed(1)) : 0;

    // 新增活跃用户（7天内首次出现）
    const allHistoricalUsers = await Analytics.distinct('userId', { createdAt: { $lt: sevenDaysAgo } });
    const recentUsers = await Analytics.distinct('userId', { createdAt: { $gte: sevenDaysAgo, $lt: todayEnd } });
    const newActive = recentUsers.filter(u => !allHistoricalUsers.includes(u)).length;

    // 7日留存率 = 注册满7天后仍活跃的比例
    const oldUsers = recentUsers.filter(u => allHistoricalUsers.includes(u));
    const retained = oldUsers.length;
    const retentionRate = allHistoricalUsers.length > 0
      ? Math.round(retained / allHistoricalUsers.length * 100)
      : 0;

    res.json({
      data: {
        dau,
        avgGenerations,
        newActive,
        retentionRate,
      },
    });
  } catch (e) { next(e); }
});

// ===== 6. 用户分布 =====
router.get('/user-distribution', async (req, res, next) => {
  try {
    // 从 Analytics 最近30天数据聚合
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const events = await Analytics.find(
      { createdAt: { $gte: thirtyDaysAgo }, 'metadata.platform': { $ne: '' } },
      'metadata.platform metadata.browser metadata.region'
    ).lean();

    function aggregate(field) {
      const map = {};
      events.forEach(e => {
        const val = e.metadata?.[field] || '未知';
        map[val] = (map[val] || 0) + 1;
      });
      const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
      return Object.entries(map)
        .map(([name, count]) => ({ name, pct: Math.round(count / total * 100) }))
        .sort((a, b) => b.pct - a.pct);
    }

    const regionColors = ['#C9A84C', '#1A1A2E', '#8B7355', '#D4C5C0', '#E8D5C4', '#8B6914', '#A89070'];
    const regions = aggregate('region').slice(0, 7).map((r, i) => ({ ...r, color: regionColors[i] || '#A89070' }));
    const platforms = aggregate('platform').map((p, i) => ({ ...p, color: regionColors[i] || '#A89070' }));
    const browsers = aggregate('browser').map((b, i) => ({ ...b, color: regionColors[i] || '#A89070' }));

    res.json({ data: { regions, platforms, browsers } });
  } catch (e) { next(e); }
});

// 保留旧接口兼容
router.get('/server', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();

  res.json({
    data: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: Math.floor(os.uptime()),
      memory: {
        total: (totalMem / 1024 / 1024 / 1024).toFixed(1),
        used: (usedMem / 1024 / 1024 / 1024).toFixed(1),
        free: (freeMem / 1024 / 1024 / 1024).toFixed(1),
        usagePct: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        loadAvg: os.loadavg().map(v => Number(v.toFixed(2))),
        usagePct: Math.min(100, Math.round((os.loadavg()[0] / cpus.length) * 100)),
      },
      nodeVersion: process.version,
      pid: process.pid,
    },
  });
});

// ===== 7. CSV 导出 =====
router.get('/export-csv', async (req, res, next) => {
  try {
    const type = req.query.type || 'weekly';
    let csv = '';

    if (type === 'weekly') {
      // 导出近7天趋势
      csv = '日期,剧本生成数,成片合成数\n';
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const [sc, cc] = await Promise.all([
          Script.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
          Composition.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
        ]);
        csv += `${d.toISOString().substring(0, 10)},${sc},${cc}\n`;
      }
    } else if (type === 'genres') {
      // 导出题材
      const projects = await Project.find({ isDeleted: { $ne: true } }, 'videoConfig.visualStyle videoConfig.subStyle').lean();
      const map = {};
      projects.forEach(p => {
        const g = p.videoConfig?.subStyle || p.videoConfig?.visualStyle || '未分类';
        map[g] = (map[g] || 0) + 1;
      });
      const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
      csv = '题材名称,生成次数,占比(%)\n';
      Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([name, count]) => {
        csv += `${name},${count},${Math.round(count / total * 100)}\n`;
      });
    } else {
      csv = '类型,值\n(无数据)\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=statistics_${type}_${Date.now()}.csv`);
    // BOM for Excel UTF-8
    res.send('﻿' + csv);
  } catch (e) { next(e); }
});

module.exports = router;
