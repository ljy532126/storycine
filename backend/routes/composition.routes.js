const express = require('express');
const router = express.Router();
const Composition = require('../models/composition.model');
const {
  createComposition,
  getCompositionProgress,
  cancelComposition,
  processComposition,
} = require('../services/composition.service');
const { authRequired } = require('../middleware/auth.middleware');
router.use(authRequired);

// 创建合成任务
router.post('/', async (req, res, next) => {
  try {
    const { projectId, storyboardId, options } = req.body;

    if (!projectId || !storyboardId) {
      return res.status(400).json({ message: '缺少参数: projectId, storyboardId' });
    }

    const composition = await createComposition(projectId, storyboardId, options || {});

    // 异步启动真实合成处理（不阻塞HTTP响应）
    processComposition(composition._id).catch(err => {
      console.error(`[composition] async processing error for ${composition._id}:`, err.message);
    });

    res.status(201).json({ message: '合成任务已创建', data: composition });
  } catch (error) { next(error); }
});

// 获取合成任务列表
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const filter = projectId ? { projectId } : {};
    const compositions = await Composition.find(filter).sort({ createdAt: -1 });
    res.json({ data: compositions });
  } catch (error) { next(error); }
});

// 获取单个合成任务详情
router.get('/:id', async (req, res, next) => {
  try {
    const composition = await Composition.findById(req.params.id);
    if (!composition) return res.status(404).json({ message: '合成任务不存在' });
    res.json({ data: composition });
  } catch (error) { next(error); }
});

// 获取合成进度
router.get('/:id/progress', async (req, res, next) => {
  try {
    const progress = await getCompositionProgress(req.params.id);
    res.json({ data: progress });
  } catch (error) { next(error); }
});

// 取消合成任务
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const composition = await cancelComposition(req.params.id);
    res.json({ message: '已取消', data: composition });
  } catch (error) { next(error); }
});

module.exports = router;
