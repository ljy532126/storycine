const express = require('express');
const router = express.Router();
const Character = require('../models/character.model');
const SceneAsset = require('../models/scene.model');
const Prop = require('../models/prop.model');
const Storyboard = require('../models/storyboard.model');
const Project = require('../models/project.model');

// 聚合项目中所有图片资源
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: '缺少 projectId 参数' });

    const [characters, scenes, props, storyboards, project] = await Promise.all([
      Character.find({ projectId }).lean(),
      SceneAsset.find({ projectId }).lean(),
      Prop.find({ projectId }).lean(),
      Storyboard.find({ projectId }).lean(),
      Project.findById(projectId).select('coverImage name').lean(),
    ]);

    const items = [];

    // 角色图片
    characters.forEach(c => {
      const morph = c.morphs?.[0];
      if (morph?.referenceImage) items.push({ url: morph.referenceImage, name: c.name, type: '角色', subType: '参考图', assetId: c._id, createdAt: c.updatedAt });
      if (morph?.generatedImages?.front) items.push({ url: morph.generatedImages.front, name: c.name, type: '角色', subType: '三视图', assetId: c._id, createdAt: c.updatedAt });
      if (c.referenceImage && c.referenceImage !== morph?.referenceImage) items.push({ url: c.referenceImage, name: c.name, type: '角色', subType: '参考图', assetId: c._id, createdAt: c.updatedAt });
      if (c.generatedImage && c.generatedImage !== morph?.generatedImages?.front) items.push({ url: c.generatedImage, name: c.name, type: '角色', subType: '生成图', assetId: c._id, createdAt: c.updatedAt });
    });

    // 场景图片
    scenes.forEach(s => {
      if (s.referenceImage) items.push({ url: s.referenceImage, name: s.sceneName, type: '场景', subType: '参考图', assetId: s._id, createdAt: s.updatedAt });
      if (s.generatedImage) items.push({ url: s.generatedImage, name: s.sceneName, type: '场景', subType: '生成图', assetId: s._id, createdAt: s.updatedAt });
    });

    // 道具图片
    props.forEach(p => {
      if (p.referenceImage) items.push({ url: p.referenceImage, name: p.propName, type: '道具', subType: '参考图', assetId: p._id, createdAt: p.updatedAt });
      if (p.generatedImage) items.push({ url: p.generatedImage, name: p.propName, type: '道具', subType: '生成图', assetId: p._id, createdAt: p.updatedAt });
    });

    // 故事板分镜图
    storyboards.forEach(sb => {
      (sb.shots || []).forEach(shot => {
        if (shot.renderedImage) items.push({ url: shot.renderedImage, name: `镜头${shot.shotNumber}`, type: '故事板', subType: '分镜图', assetId: sb._id, shotNumber: shot.shotNumber, createdAt: sb.updatedAt });
        if (shot.renderedVideo) items.push({ url: shot.renderedVideo, name: `镜头${shot.shotNumber}`, type: '故事板', subType: '视频', assetId: sb._id, shotNumber: shot.shotNumber, createdAt: sb.updatedAt, isVideo: true });
      });
    });

    // 项目封面
    if (project?.coverImage) {
      items.push({ url: project.coverImage, name: project.name, type: '封面', subType: '海报', assetId: project._id, createdAt: project.updatedAt });
    }

    // 按时间倒序
    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ data: { items, total: items.length } });
  } catch (e) { next(e); }
});

// 删除单个图片（从所属模型中移除）
router.delete('/item', async (req, res, next) => {
  try {
    const { type, assetId, url } = req.body;
    if (!type || !assetId) return res.status(400).json({ message: '缺少参数' });

    switch (type) {
      case '角色': {
        const c = await Character.findById(assetId);
        if (!c) return res.status(404).json({ message: '角色不存在' });
        if (c.referenceImage === url) c.referenceImage = '';
        if (c.generatedImage === url) c.generatedImage = '';
        if (c.morphs?.[0]) {
          if (c.morphs[0].referenceImage === url) c.morphs[0].referenceImage = '';
          if (c.morphs[0].generatedImages?.front === url) c.morphs[0].generatedImages.front = '';
        }
        await c.save();
        break;
      }
      case '场景': {
        const s = await SceneAsset.findById(assetId);
        if (s) {
          if (s.referenceImage === url) s.referenceImage = '';
          if (s.generatedImage === url) s.generatedImage = '';
          await s.save();
        }
        break;
      }
      case '道具': {
        const p = await Prop.findById(assetId);
        if (p) {
          if (p.referenceImage === url) p.referenceImage = '';
          if (p.generatedImage === url) p.generatedImage = '';
          await p.save();
        }
        break;
      }
      case '故事板': {
        const sb = await Storyboard.findById(assetId);
        if (sb) {
          const shot = sb.shots.find(s => s.renderedImage === url || s.renderedVideo === url);
          if (shot) {
            if (shot.renderedImage === url) shot.renderedImage = '';
            if (shot.renderedVideo === url) shot.renderedVideo = '';
          }
          await sb.save();
        }
        break;
      }
      case '封面': {
        await Project.findByIdAndUpdate(assetId, { coverImage: '' });
        break;
      }
    }
    res.json({ message: '已删除' });
  } catch (e) { next(e); }
});

// 批量下载（打包 zip）
router.post('/batch-download', async (req, res) => {
  try {
    const { urls, names } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) return res.status(400).json({ message: '请选择文件' });

    const axios = require('axios');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();

    for (let i = 0; i < urls.length; i++) {
      try {
        const resp = await axios({ url: urls[i], method: 'GET', responseType: 'arraybuffer', timeout: 30000 });
        const safeName = (names[i] || ('file_' + i)).replace(/[\\/:*?"<>|]/g, '_');
        zip.addFile(safeName, Buffer.from(resp.data));
      } catch (e) {
        zip.addFile((names[i] || 'file_' + i).replace(/[\\/:*?"<>|]/g, '_') + '.error.txt', Buffer.from('Download failed: ' + e.message));
      }
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=media_batch.zip');
    res.send(zip.toBuffer());
  } catch (e) { res.status(500).json({ message: '打包失败: ' + e.message }); }
});

module.exports = router;
