const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Announcement = require('../models/announcement.model');
const { authRequired, adminRequired } = require('../middleware/auth.middleware');

/** 校验 :id 参数是否为合法 ObjectId，非法则直接 400 */
function validateId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: '无效的ID格式' });
  }
  next();
}

router.use(authRequired);

// ===== 公共接口：获取生效中的公告（所有已登录用户） =====
router.get('/active', async (req, res, next) => {
  try {
    const filter = { isActive: true };
    // 非管理员只看 target=all 的公告
    if (req.user.role !== 'admin') filter.target = 'all';
    const announcements = await Announcement.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(20)
      .select('-createdBy')
      .lean();
    announcements.forEach(a => { if (!a.readBy) a.readBy = []; });
    res.json({ data: announcements, unreadCount: announcements.length });
  } catch (e) { next(e); }
});

// ===== 管理接口：CRUD（仅管理员） =====

router.get('/', adminRequired, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, target } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (target) filter.target = target;
    const total = await Announcement.countDocuments(filter);
    const list = await Announcement.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    // 补全老数据，确保 readBy 字段存在
    list.forEach(a => { if (!a.readBy) a.readBy = []; });
    res.json({ data: list, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (e) { next(e); }
});

router.post('/', adminRequired, async (req, res, next) => {
  try {
    const { title, content, type, target, isPinned, isActive, enableMarkdown } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: '标题不能为空' });
    const ann = await Announcement.create({
      title: title.trim(),
      content: content || '',
      type: type || 'info',
      target: target || 'all',
      isPinned: !!isPinned,
      isActive: isActive !== false,
      enableMarkdown: !!enableMarkdown,
      createdBy: req.user.username || req.user._id,
    });
    // Socket 推送给所有在线用户（前端根据 target 自行过滤）
    const io = req.app.get('io');
    if (io && ann.isActive) {
      io.emit('announcement:new', { _id: ann._id, title: ann.title, type: ann.type, target: ann.target, createdAt: ann.createdAt });
    }
    res.status(201).json({ message: '公告发布成功', data: ann });
  } catch (e) { next(e); }
});

router.put('/:id', adminRequired, validateId, async (req, res, next) => {
  try {
    const allowed = ['title', 'content', 'type', 'target', 'isPinned', 'isActive', 'enableMarkdown'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const ann = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ann) return res.status(404).json({ message: '公告不存在' });
    res.json({ message: '更新成功', data: ann });
  } catch (e) { next(e); }
});

router.delete('/:id', adminRequired, validateId, async (req, res, next) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ message: '公告不存在' });
    res.json({ message: '已删除' });
  } catch (e) { next(e); }
});

// ===== 标记已读 =====
router.post('/:id/read', authRequired, validateId, async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ message: '公告不存在' });
    if (!ann.readBy) ann.readBy = [];
    const alreadyRead = ann.readBy.some(r => String(r.userId) === String(req.user._id));
    if (!alreadyRead) {
      ann.readBy.push({ userId: req.user._id, username: req.user.username, readAt: new Date() });
      await ann.save();
    }
    res.json({ message: 'ok', readCount: ann.readBy.length });
  } catch (e) { next(e); }
});

// ===== 阅读统计（仅管理员） =====
router.get('/:id/stats', adminRequired, validateId, async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id, 'readBy title createdAt').lean();
    if (!ann) return res.status(404).json({ message: '公告不存在' });
    const readers = (ann.readBy || []).map(r => ({ username: r.username, readAt: r.readAt }));
    res.json({
      data: {
        title: ann.title,
        createdAt: ann.createdAt,
        totalReads: readers.length,
        readers,
      },
    });
  } catch (e) { next(e); }
});

module.exports = router;
