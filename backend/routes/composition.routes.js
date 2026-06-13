const express = require('express');
const router = express.Router();
const Composition = require('../models/composition.model');
const Storyboard = require('../models/storyboard.model');
const Script = require('../models/script.model');
const Project = require('../models/project.model');
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

// 获取合成任务列表（含分镜表+剧本+片场关联信息）
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const filter = projectId ? { projectId } : {};
    const compositions = await Composition.find(filter)
      .populate({ path: 'storyboardId', populate: { path: 'scriptId', select: 'episodeTitle episodeNumber' } })
      .populate('projectId', 'name')
      .sort({ createdAt: -1 });
    const data = compositions.map(c => {
      const obj = c.toObject ? c.toObject() : c;
      return {
        ...obj,
        projectName: obj.projectId?.name || '',
        episodeTitle: obj.storyboardId?.scriptId?.episodeTitle || '',
        episodeNumber: obj.storyboardId?.scriptId?.episodeNumber || 1,
        storyboardTotalShots: obj.storyboardId?.totalShots || 0,
      };
    });
    res.json({ data });
  } catch (error) { next(error); }
});

// 获取单个合成任务详情
router.get('/:id', async (req, res, next) => {
  try {
    const composition = await Composition.findById(req.params.id)
      .populate({ path: 'storyboardId', populate: { path: 'scriptId', select: 'episodeTitle episodeNumber' } })
      .populate('projectId', 'name');
    if (!composition) return res.status(404).json({ message: '合成任务不存在' });
    const obj = composition.toObject ? composition.toObject() : composition;
    res.json({ data: {
      ...obj,
      projectName: obj.projectId?.name || '',
      episodeTitle: obj.storyboardId?.scriptId?.episodeTitle || '',
      episodeNumber: obj.storyboardId?.scriptId?.episodeNumber || 1,
      storyboardTotalShots: obj.storyboardId?.totalShots || 0,
    } });
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

// 删除合成任务
router.delete('/:id', async (req, res, next) => {
  try {
    const composition = await Composition.findById(req.params.id);
    if (!composition) return res.status(404).json({ message: '合成任务不存在' });
    // 清理输出文件
    if (composition.outputUrl) {
      try {
        const { unlink } = require('fs/promises');
        const { resolvePublicUrl } = require('../services/storage.service');
        const url = composition.outputUrl;
        const filePath = url.startsWith('http') ? require('path').join(__dirname, '../../uploads/compositions', new URL(url).pathname.split('/').pop()) : require('path').join(__dirname, '..', url);
        await unlink(filePath).catch(() => {});
      } catch {}
    }
    await Composition.findByIdAndDelete(req.params.id);
    console.log(`[composition] DELETE /${req.params.id}`);
    res.json({ message: '已删除' });
  } catch (error) { next(error); }
});

module.exports = router;
