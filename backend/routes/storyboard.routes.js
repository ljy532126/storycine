const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Storyboard = require('../models/storyboard.model');
const appConfig = require('../config/app.config');
const {
  optimizeShotRhythm,
  autoGenerateStoryboard,
  autoGenerateStoryboardAI,
} = require('../services/storyboard.service');
const { authRequired } = require('../middleware/auth.middleware');
router.use(authRequired);

// 自动分镜拆解 / 同步
router.post('/auto-generate', async (req, res, next) => {
  try {
    const { scriptId, projectId, batchShots, useAI = true, maxDuration = 15, startScene, sceneCount } = req.body;

    // 先为用户加载 LLM 配置
    await appConfig.loadUserConfig(req.user._id);

    // 从分镜管理同步过来的数据
    if (batchShots && Array.isArray(batchShots)) {
      let sb = await Storyboard.findOne({ projectId, scriptId });
      if (sb) { sb.shots = batchShots; } else { sb = await Storyboard.create({ projectId, scriptId: scriptId || projectId, shots: batchShots }); }
      await sb.save();
      return res.status(201).json({ message: `已同步 ${batchShots.length} 个分镜`, data: sb });
    }

    if (!scriptId || !projectId) {
      return res.status(400).json({ message: '缺少参数: scriptId, projectId' });
    }

    // 分批模式：只返回镜头数组，不创建 Storyboard 文档
    const isBatch = startScene !== undefined || sceneCount !== undefined;

    let shots;
    if (useAI) {
      try {
        shots = await autoGenerateStoryboardAI(scriptId, projectId, { maxDuration, startScene: startScene || 0, sceneCount: sceneCount || 99, returnShots: isBatch });
      } catch (aiErr) {
        console.warn('[storyboard] AI分镜失败，回退到规则拆解:', aiErr.message);
        if (isBatch && (!scriptId || !projectId)) throw aiErr;
        shots = (await autoGenerateStoryboard(scriptId, projectId)).shots;
      }
    } else {
      shots = (await autoGenerateStoryboard(scriptId, projectId)).shots;
    }

    if (isBatch) {
      return res.status(201).json({ message: `分镜生成完成`, data: { shots } });
    }

    const storyboard = await Storyboard.create({ projectId, scriptId, shots });
    const mode = shots?.[0]?._videoPrompt ? 'AI' : '规则';
    res.status(201).json({ message: `分镜拆解完成 (${mode})`, data: storyboard });
  } catch (error) {
    console.error('[storyboard] 拆解失败:', error.message, error.stack);
    next(error);
  }
});

// 获取分镜列表
router.get('/', async (req, res, next) => {
  try {
    const { projectId, scriptId } = req.query;
    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (scriptId) filter.scriptId = scriptId;

    const storyboards = await Storyboard.find(filter)
      .populate('projectId', 'name')
      .populate('scriptId', 'episodeTitle episodeNumber')
      .sort({ createdAt: -1 });
    const data = storyboards.map(sb => {
      const obj = sb.toObject ? sb.toObject() : sb;
      return {
        ...obj,
        projectName: sb.projectId?.name || '',
        episodeTitle: sb.scriptId?.episodeTitle || '',
        episodeNumber: sb.scriptId?.episodeNumber || 1,
      };
    });
    res.json({ data });
  } catch (error) { next(error); }
});

// 获取单个分镜表
router.get('/:id', async (req, res, next) => {
  try {
    const storyboard = await Storyboard.findById(req.params.id);
    if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });
    res.json({ data: storyboard });
  } catch (error) { next(error); }
});

// 更新分镜表
router.put('/:id', async (req, res, next) => {
  try {
    const storyboard = await Storyboard.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });
    res.json({ message: '更新成功', data: storyboard });
  } catch (error) { next(error); }
});

// 批量修改镜头
router.put('/:id/shots/batch', async (req, res, next) => {
  try {
    const { shotIds, updates } = req.body;
    if (!shotIds || !updates) {
      return res.status(400).json({ message: '缺少参数: shotIds, updates' });
    }

    const storyboard = await Storyboard.findById(req.params.id);
    if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });

    storyboard.shots.forEach(shot => {
      if (shotIds.includes(shot.shotNumber)) {
        Object.assign(shot, updates);
      }
    });

    await storyboard.save();
    res.json({ message: '批量更新成功', data: storyboard });
  } catch (error) { next(error); }
});

// 单个镜头更新
router.put('/:id/shots/:shotNumber', async (req, res, next) => {
  try {
    const storyboard = await Storyboard.findById(req.params.id);
    if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });

    const shot = storyboard.shots.find(
      s => s.shotNumber === parseInt(req.params.shotNumber)
    );
    if (!shot) return res.status(404).json({ message: '镜头不存在' });

    Object.assign(shot, req.body);
    // 清洗 AI 生成的短_id
    if (shot._id && typeof shot._id === 'string' && shot._id.length < 24) delete shot._id;
    (shot._dialogues || []).forEach(d => { if (d._id && typeof d._id === 'string' && d._id.length < 24) delete d._id; });
    await storyboard.save();
    res.json({ message: '镜头更新成功', data: storyboard });
  } catch (error) { next(error); }
});

// 视频上传
const videosDir = path.join(__dirname, '..', 'uploads', 'storyboard-videos');
const imagesDir = path.join(__dirname, '..', 'uploads', 'storyboard-images');
[videosDir, imagesDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: videosDir,
    filename: (req, file, cb) => {
      const uid = req.user?.uid || 'u';
      cb(null, `${uid}_${Date.now()}_${file.originalname}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
}).single('video');

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: imagesDir,
    filename: (req, file, cb) => {
      const uid = req.user?.uid || 'u';
      cb(null, `${uid}_${Date.now()}_${file.originalname}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('image');

router.post('/:id/shots/:shotNumber/upload-image', (req, res, next) => {
  imageUpload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: '图片大小不能超过50MB' });
      return res.status(400).json({ message: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ message: '未选择图片文件' });
      const storyboard = await Storyboard.findById(req.params.id);
      if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });
      const shot = storyboard.shots.find(s => s.shotNumber === parseInt(req.params.shotNumber));
      if (!shot) return res.status(404).json({ message: '镜头不存在' });

      const url = `/uploads/storyboard-images/${req.file.filename}`;
      shot.renderedImage = url;
      shot.status = 'completed';
      await storyboard.save();
      res.json({ message: '图片上传成功', data: { url } });
    } catch (e) { next(e); }
  });
});

router.post('/:id/shots/:shotNumber/upload-video', (req, res, next) => {
  videoUpload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: '视频大小不能超过500MB' });
      return res.status(400).json({ message: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ message: '未选择视频文件' });
      const storyboard = await Storyboard.findById(req.params.id);
      if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });
      const shot = storyboard.shots.find(s => s.shotNumber === parseInt(req.params.shotNumber));
      if (!shot) return res.status(404).json({ message: '镜头不存在' });

      const url = `/uploads/storyboard-videos/${req.file.filename}`;
      shot.renderedVideo = url;
      shot.status = 'completed';
      await storyboard.save();
      res.json({ message: '视频上传成功', data: { url } });
    } catch (e) { next(e); }
  });
});

// AI优化镜头节奏
router.post('/optimize-rhythm', async (req, res, next) => {
  try {
    const { shots } = req.body;
    if (!shots || !Array.isArray(shots)) {
      return res.status(400).json({ message: '缺少shots数组' });
    }
    const optimizedShots = optimizeShotRhythm(shots);
    res.json({ data: optimizedShots });
  } catch (error) { next(error); }
});

// ===== 导出分镜为 CSV =====
router.get('/:id/export', async (req, res, next) => {
  try {
    const storyboard = await Storyboard.findById(req.params.id);
    if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });

    const headers = ['镜头号','场景名称','景别','构图','运镜','灯光','时长','图像描述','角色名','台词','音效','备注','状态'];
    const rows = storyboard.shots.map(s => [
      s.shotNumber,
      s.sceneName || '',
      s.shotType,
      s.composition || '',
      s.cameraMovement,
      s.lighting || '',
      s.duration,
      `"${(s.imageDescription || '').replace(/"/g, '""')}"`,
      s.dialogue?.characterName || '',
      `"${(s.dialogue?.text || '').replace(/"/g, '""')}"`,
      s.soundEffect || '',
      `"${(s.notes || '').replace(/"/g, '""')}"`,
      s.status === 'completed' ? '完成' : '待处理',
    ]);

    const csv = '﻿' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=storyboard-${req.params.id}.csv`);
    res.send(csv);
  } catch (error) { next(error); }
});

// ===== 导入分镜（CSV 或 JSON） =====
router.post('/:id/import', async (req, res, next) => {
  try {
    const { data, format } = req.body; // format: 'csv' | 'json'
    const storyboard = await Storyboard.findById(req.params.id);
    if (!storyboard) return res.status(404).json({ message: '分镜表不存在' });

    let shots;
    if (format === 'csv') {
      shots = parseCSVShots(data);
    } else {
      shots = Array.isArray(data) ? data : JSON.parse(data);
    }

    if (!shots || shots.length === 0) {
      return res.status(400).json({ message: '未解析到有效的镜头数据' });
    }

    // 校验并修正数据
    const validShotTypes = ['远景','全景','中景','近景','特写','大特写','微距'];
    const validCameraMoves = ['固定','推镜','拉镜','平移','摇镜','跟镜','升降','希区柯克变焦','变速推近'];
    const validCameraAngles = ['平视','俯拍','仰拍','顶拍','荷兰角'];

    const sanitized = shots.map((s, i) => ({
      shotNumber: s.shotNumber || (i + 1),
      sceneName: s.sceneName || '',
      shotType: validShotTypes.includes(s.shotType) ? s.shotType : '中景',
      cameraAngle: validCameraAngles.includes(s.cameraAngle) ? s.cameraAngle : '平视',
      composition: s.composition || '',
      cameraMovement: validCameraMoves.includes(s.cameraMovement) ? s.cameraMovement : '固定',
      lighting: s.lighting || '',
      characterEmotion: (s.characterEmotion || '').substring(0, 300),
      duration: Number(s.duration) || 3,
      imageDescription: s.imageDescription || '',
      renderedImage: s.renderedImage || '',
      renderedVideo: s.renderedVideo || '',
      dialogue: {
        characterName: s.characterName || s.dialogue?.characterName || '',
        text: s.text || s.dialogue?.text || '',
        audioUrl: s.dialogue?.audioUrl || '',
        actionHint: s.actionHint || s.dialogue?.actionHint || '',
        cameraHint: s.cameraHint || s.dialogue?.cameraHint || '',
        innerThought: s.innerThought || s.dialogue?.innerThought || '',
      },
      soundEffect: s.soundEffect || '',
      notes: s.notes || '',
      status: 'pending',
    }));

    storyboard.shots = sanitized;
    await storyboard.save();

    res.json({ message: `导入成功，共 ${sanitized.length} 个镜头`, data: storyboard });
  } catch (error) { next(error); }
});

/** CSV 文本解析为镜头数组 */
function parseCSVShots(csvText) {
  // 去除 UTF-8 BOM
  const cleanText = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;
  const lines = cleanText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^﻿/, ''));
  const shots = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const shot = {};
    headers.forEach((h, idx) => { shot[h] = (vals[idx] || '').trim(); });
    if (shot['镜头号']) shots.push(shot);
  }
  return shots;
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

// 删除故事板
router.delete('/:id', async (req, res, next) => {
  try {
    console.log(`[storyboard] DELETE /${req.params.id}`);
    const storyboard = await Storyboard.findByIdAndDelete(req.params.id);
    if (!storyboard) return res.status(404).json({ message: '故事板不存在' });
    res.json({ message: '故事板已删除', data: { _id: storyboard._id } });
  } catch (e) { next(e); }
});

module.exports = router;
