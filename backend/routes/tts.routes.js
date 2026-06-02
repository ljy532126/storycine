const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const TtsAudio = require('../models/tts-audio.model');
const Storyboard = require('../models/storyboard.model');
const { authRequired } = require('../middleware/auth.middleware');
const ttsService = require('../services/tts.service');

router.use(authRequired);

// ===== 单镜头配音 =====
router.post('/synthesize', async (req, res, next) => {
  try {
    const { storyboardId, shotNumber, text, characterName, projectId, scriptId, episodeNumber, ...overrides } = req.body;
    if (!text) return res.status(400).json({ message: '缺少台词文本' });

    const result = await ttsService.synthesizeSpeech(req.user._id, {
      projectId, scriptId, storyboardId, shotNumber, episodeNumber,
      text, characterName, ...overrides,
    });

    res.json({ message: '配音完成', data: result });
  } catch (e) { next(e); }
});

// ===== 批量配音 =====
router.post('/batch-synthesize', async (req, res, next) => {
  try {
    const { storyboardId, shotNumbers, ...overrides } = req.body;
    if (!storyboardId) return res.status(400).json({ message: '缺少 storyboardId' });

    const sb = await Storyboard.findById(storyboardId);
    if (!sb) return res.status(404).json({ message: '故事板不存在' });

    const targets = shotNumbers
      ? sb.shots.filter(s => shotNumbers.includes(s.shotNumber))
      : sb.shots.filter(s => (s.dialogue?.text || s.imageDescription || '').trim());

    if (targets.length === 0) return res.status(400).json({ message: '没有可配音的镜头' });

    const shots = targets.map(s => ({
      storyboardId, shotNumber: s.shotNumber,
      text: s.dialogue?.text || s.imageDescription || '',
      characterName: s.dialogue?.characterName || '',
      projectId: sb.projectId, scriptId: sb.scriptId,
      episodeNumber: 1, ...overrides,
    })).filter(s => s.text.trim());

    const results = await ttsService.batchSynthesize(req.user._id, shots);
    const succeeded = results.filter(r => r.success).length;
    res.json({ message: `配音完成: ${succeeded}/${results.length}`, data: { results } });
  } catch (e) { next(e); }
});

// ===== 配音素材库 =====

// 树形列表：片场 → 剧集 → 配音文件
router.get('/library', async (req, res, next) => {
  try {
    const { projectId, scriptId, episodeNumber } = req.query;
    const filter = { userId: req.user._id };
    if (projectId) filter.projectId = projectId;
    if (scriptId) filter.scriptId = scriptId;
    if (episodeNumber) filter.episodeNumber = Number(episodeNumber);

    const list = await TtsAudio.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // 构建树形结构：片场 → 剧集 → 配音
    const projectMap = {};
    list.forEach(item => {
      const pid = item.projectId.toString();
      if (!projectMap[pid]) projectMap[pid] = { projectId: pid, episodes: {} };
      const epKey = item.scriptId ? item.scriptId.toString() : 'unknown';
      if (!projectMap[pid].episodes[epKey]) projectMap[pid].episodes[epKey] = { scriptId: epKey, episodeNumber: item.episodeNumber, audios: [] };
      projectMap[pid].episodes[epKey].audios.push(item);
    });

    const tree = Object.values(projectMap).map(p => ({
      projectId: p.projectId,
      episodes: Object.values(p.episodes).map(ep => ({
        scriptId: ep.scriptId,
        episodeNumber: ep.episodeNumber,
        audios: ep.audios.sort((a, b) => (a.shotNumber || 0) - (b.shotNumber || 0)),
      })).sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)),
    }));

    res.json({ data: { tree, flat: list } });
  } catch (e) { next(e); }
});

router.delete('/library/:id', async (req, res, next) => {
  try {
    const doc = await TtsAudio.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!doc) return res.status(404).json({ message: '配音记录不存在' });
    res.json({ message: '已删除' });
  } catch (e) { next(e); }
});

router.post('/library/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    const r = await TtsAudio.deleteMany({ _id: { $in: ids }, userId: req.user._id });
    res.json({ message: `已删除 ${r.deletedCount} 条` });
  } catch (e) { next(e); }
});

router.get('/library/download/:id', async (req, res, next) => {
  try {
    const doc = await TtsAudio.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) return res.status(404).json({ message: '配音不存在' });
    if (doc.audioUrl.startsWith('/uploads/')) {
      const path = require('path');
      const filePath = path.join(__dirname, '..', doc.audioUrl);
      if (require('fs').existsSync(filePath)) return res.download(filePath);
    }
    res.redirect(doc.audioUrl);
  } catch (e) { next(e); }
});

router.post('/library/batch-download', async (req, res, next) => {
  try {
    const { ids } = req.body;
    const docs = await TtsAudio.find({ _id: { $in: ids }, userId: req.user._id }).lean();
    if (docs.length === 0) return res.status(404).json({ message: '未找到配音记录' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="tts-batch-${Date.now()}.zip"`);
    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    for (const doc of docs) {
      const folder = `shot-${String(doc.shotNumber || 'x').padStart(2, '0')}`;
      if (doc.audioUrl.startsWith('/uploads/')) {
        const filePath = require('path').join(__dirname, '..', doc.audioUrl);
        if (require('fs').existsSync(filePath)) {
          const ext = require('path').extname(doc.audioUrl);
          archive.file(filePath, { name: `${folder}/${doc.characterName || 'voice'}${ext}` });
        }
      }
    }
    await archive.finalize();
  } catch (e) { next(e); }
});

module.exports = router;
