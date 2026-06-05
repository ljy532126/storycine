const express = require('express');
const router = express.Router();
const ErrorLog = require('../models/error-log.model');
const { authRequired, adminRequired } = require('../middleware/auth.middleware');
router.use(authRequired);

// 获取错误列表（分页 + 筛选）
router.get('/', adminRequired, async (req, res, next) => {
  try {
    const { page = 1, limit = 30, statusCode, path, resolved, keyword } = req.query;
    const filter = {};
    if (statusCode) filter.statusCode = Number(statusCode);
    if (path) filter.path = { $regex: path, $options: 'i' };
    if (resolved !== undefined && resolved !== '') filter.resolved = resolved === 'true';
    if (keyword) {
      filter.$or = [
        { message: { $regex: keyword, $options: 'i' } },
        { url: { $regex: keyword, $options: 'i' } },
        { username: { $regex: keyword, $options: 'i' } },
      ];
    }

    const total = await ErrorLog.countDocuments(filter);
    const logs = await ErrorLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-stack -body -headers')
      .lean();

    res.json({ data: logs, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
  } catch (e) { next(e); }
});

// 获取单个错误详情
router.get('/:id', adminRequired, async (req, res, next) => {
  try {
    const log = await ErrorLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ message: '记录不存在' });
    res.json({ data: log });
  } catch (e) { next(e); }
});

// 标记已处理
router.put('/:id/resolve', adminRequired, async (req, res, next) => {
  try {
    const log = await ErrorLog.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date(), resolveNote: req.body.note || '' },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: '记录不存在' });
    res.json({ message: '已标记为已处理', data: log });
  } catch (e) { next(e); }
});

// 批量标记已处理
router.post('/batch-resolve', adminRequired, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '缺少 ids 数组' });
    }
    await ErrorLog.updateMany(
      { _id: { $in: ids } },
      { resolved: true, resolvedAt: new Date() }
    );
    res.json({ message: `已标记 ${ids.length} 条为已处理` });
  } catch (e) { next(e); }
});

// 删除错误日志
router.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    await ErrorLog.findByIdAndDelete(req.params.id);
    res.json({ message: '已删除' });
  } catch (e) { next(e); }
});

// 获取统计摘要
router.get('/stats/summary', adminRequired, async (req, res, next) => {
  try {
    const [total, unresolved, todayCount, topPaths] = await Promise.all([
      ErrorLog.countDocuments(),
      ErrorLog.countDocuments({ resolved: false }),
      ErrorLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
      ErrorLog.aggregate([
        { $group: { _id: '$path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    res.json({ data: { total, unresolved, todayCount, topPaths } });
  } catch (e) { next(e); }
});

module.exports = router;
