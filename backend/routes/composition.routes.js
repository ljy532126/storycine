const express = require('express');
const router = express.Router();
const Composition = require('../models/composition.model');
const { createComposition, getCompositionProgress } = require('../services/composition.service');
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

    // 异步启动合成处理
    startCompositionProcessing(composition._id, req.app.get('io'));

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
    const composition = await Composition.findByIdAndUpdate(
      req.params.id,
      { status: 'failed', errorMessage: '用户取消' },
      { new: true }
    );
    if (!composition) return res.status(404).json({ message: '合成任务不存在' });
    res.json({ message: '已取消', data: composition });
  } catch (error) { next(error); }
});

/**
 * 异步启动合成处理（模拟 + WebSocket推送进度）
 * @param {string} compositionId
 * @param {Object} io - Socket.IO实例
 */
async function startCompositionProcessing(compositionId, io) {
  try {
    const composition = await Composition.findById(compositionId);
    if (!composition) return;

    composition.status = 'rendering';
    await composition.save();

    io.to(`project-${composition.projectId}`).emit('composition-progress', {
      compositionId,
      status: 'rendering',
      progress: 0,
    });

    // 模拟合成进度（实际应替换为真实视频合成逻辑）
    for (let progress = 10; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));

      composition.progress = progress;
      await composition.save();

      io.to(`project-${composition.projectId}`).emit('composition-progress', {
        compositionId,
        status: 'rendering',
        progress,
      });
    }

    composition.status = 'completed';
    composition.outputUrl = `/output/${compositionId}.mp4`;
    await composition.save();

    io.to(`project-${composition.projectId}`).emit('composition-complete', {
      compositionId,
      status: 'completed',
      outputUrl: composition.outputUrl,
    });

  } catch (err) {
    console.error('Composition processing error:', err);
    await Composition.findByIdAndUpdate(compositionId, {
      status: 'failed',
      errorMessage: err.message,
    });
    io.to(`project-${(await Composition.findById(compositionId))?.projectId}`)
      .emit('composition-error', { compositionId, error: err.message });
  }
}

module.exports = router;
