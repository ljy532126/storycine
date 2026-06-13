const express = require('express');
const router = express.Router();
const { generatePromoClips } = require('../services/promo.service');
const { authRequired } = require('../middleware/auth.middleware');

router.use(authRequired);

// 生成引流短片
router.post('/generate', async (req, res, next) => {
  try {
    const { projectId, storyboardId, options } = req.body;
    if (!projectId || !storyboardId) {
      return res.status(400).json({ message: '缺少参数: projectId, storyboardId' });
    }

    res.status(202).json({ message: '引流短片生成任务已提交' });

    // 异步执行，不阻塞 HTTP 响应
    generatePromoClips(projectId, storyboardId, options || {}).catch(err => {
      console.error('[promo] generate error:', err.message);
      const io = require('../utils/socket-registry').getIO();
      if (io) io.to(`project-${projectId}`).emit('promo-error', { error: err.message });
    });
  } catch (error) { next(error); }
});

module.exports = router;
