const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/project.model');
const Script = require('../models/script.model');
const Character = require('../models/character.model');
const SceneAsset = require('../models/scene.model');
const Prop = require('../models/prop.model');
const Storyboard = require('../models/storyboard.model');
const Composition = require('../models/composition.model');
const { authRequired } = require('../middleware/auth.middleware');
router.use(authRequired);

// 创建项目
router.post('/', async (req, res, next) => {
  try {
    const project = await Project.create({
      name: req.body.name,
      description: req.body.description || '',
      scriptSource: req.body.scriptSource || 'none',
      videoConfig: req.body.videoConfig || {},
    });
    res.status(201).json({ message: '项目创建成功', data: project });
  } catch (error) { next(error); }
});

// 获取所有项目
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.json({ data: projects });
  } catch (error) { next(error); }
});

// 获取单个项目
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: '项目不存在' });
    res.json({ data: project });
  } catch (error) { next(error); }
});

// 更新项目
router.put('/:id', async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ message: '项目不存在' });
    res.json({ message: '更新成功', data: project });
  } catch (error) { next(error); }
});

// 删除（级联删除所有关联数据）
router.delete('/:id', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const objId = new mongoose.Types.ObjectId(projectId);
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: '项目不存在' });

    // 级联删除所有关联数据（显式 ObjectId 确保匹配）
    const results = await Promise.all([
      Script.deleteMany({ projectId: objId }),
      Character.deleteMany({ projectId: objId }),
      SceneAsset.deleteMany({ projectId: objId }),
      Prop.deleteMany({ projectId: objId }),
      Storyboard.deleteMany({ projectId: objId }),
      Composition.deleteMany({ projectId: objId }),
      Project.findByIdAndDelete(projectId),
    ]);

    const [scripts, chars, scenes, props, sbs, comps] = results;
    console.log(`[project] 级联删除完成: 项目=${projectId} 剧本=${scripts.deletedCount} 角色=${chars.deletedCount} 场景=${scenes.deletedCount} 道具=${props.deletedCount} 分镜=${sbs.deletedCount} 合成=${comps.deletedCount}`);

    res.json({
      message: '项目及关联数据已全部删除',
      data: {
        scripts: scripts.deletedCount,
        characters: chars.deletedCount,
        scenes: scenes.deletedCount,
        props: props.deletedCount,
        storyboards: sbs.deletedCount,
        compositions: comps.deletedCount,
      },
    });
  } catch (error) { next(error); }
});

// ===== AI 生成项目封面 =====
router.post('/:id/generate-cover', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: '项目不存在' });

    // 读取项目剧本，提取关键信息
    const scripts = await Script.find({ projectId: project._id }).sort({ episodeNumber: 1 }).limit(3);
    const scenes = scripts.flatMap(s => s.scenes || []).slice(0, 5);
    const locations = [...new Set(scenes.map(s => s.location).filter(Boolean))];
    const characters = [...new Set(scenes.flatMap(s => s.characters || []))];
    const summary = scripts[0]?.summary || '';
    const titles = scripts.map(s => s.episodeTitle || `第${s.episodeNumber}集`).join('、');

    const { callLLM, callImageGen } = require('../utils/llm-client');
    const storageService = require('../services/storage.service');

    // Step 0: AI 根据大纲自动取名
    console.log('[cover-gen] 开始生成封面，项目:', project.name);
    let dramaTitle = project.name;
    if (scripts.length > 0) {
      try {
        const nameSys = '你是爆款短剧策划专家。根据剧本大纲，为短剧取一个吸引眼球的爆款名字（8字以内）。要求：有网感、抓眼球、让人想点进去看。只输出名字，不要引号。';
        const nameUser = `剧本概要：${summary || '暂无'}\n剧集：${titles}\n${project.description ? '简介：' + project.description : ''}\n请为这部短剧取一个爆款名字。`;
        const generatedName = await callLLM(nameSys, nameUser, { temperature: 0.9, maxTokens: 50 });
        if (generatedName && generatedName.trim().length > 0 && generatedName.trim().length < 15) {
          dramaTitle = generatedName.trim().replace(/^["《]|["》]$/g, '');
          console.log(`[cover-gen] AI取名: ${dramaTitle}`);
        }
      } catch (e) { console.warn('[cover-gen] AI取名失败，使用项目名'); }
    }

    // Step 1: LLM 生成海报提示词（含标题文字）
    const style = project.videoConfig?.visualStyle || '写实';
    const sub = project.videoConfig?.subStyle || '';
    const ds = project.directorSettings || {};
    const quality = ds.qualityKeywords || '8K, cinematic, film-grade';
    const lighting = ds.atmosphereLighting || 'dramatic cinematic lighting';
    const art = ds.artStyleCommands || style;

    const posterSys = `You are a movie poster designer. Create an English image prompt for a vertical 9:16 movie poster. The poster MUST include the title "${dramaTitle}" displayed prominently in stylized text. Style: ${style}${sub ? '/' + sub : ''}. Quality: ${quality}. Lighting: ${lighting}. Art direction: ${art}. Include visual elements that convey the story's mood. The poster should look like a professional film promotional image with the title clearly visible. Output only the prompt text.`;
    const posterUser = `Title: ${dramaTitle}
${project.description ? 'Synopsis: ' + project.description : ''}
${titles ? 'Episodes: ' + titles : ''}
${summary ? 'Summary: ' + summary : ''}
${locations.length > 0 ? 'Key locations: ' + locations.join(', ') : ''}
${characters.length > 0 ? 'Characters: ' + characters.join(', ') : ''}
Create a compelling movie poster prompt.`;

    const coverPrompt = await callLLM(posterSys, posterUser, { temperature: 0.8, maxTokens: 500 });
    console.log(`[cover-gen] 标题="${dramaTitle}" 海报提示词: ${coverPrompt.substring(0, 120)}...`);

    // Step 2: 生图（跳过文字禁止约束，海报需要标题文字）
    console.log('[cover-gen] 调用Seedream生图（skipConstraint）...');
    const imageUrl = await callImageGen(coverPrompt, {
      provider: 'doubao',
      size: '1280x2880',
      watermark: false,
      skipConstraint: true,
      model: req.body.model || undefined,
    });
    console.log(`[cover-gen] 生图完成: ${imageUrl.substring(0, 60)}...`);

    // Step 3: 存储
    let finalUrl = imageUrl;
    if (imageUrl && !imageUrl.startsWith('/uploads/')) {
      try {
        const filename = `cover-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
        finalUrl = await storageService.uploadFromUrl(imageUrl, filename, 'covers');
        console.log(`[cover-gen] 存储完成: ${finalUrl.substring(0, 60)}...`);
      } catch (e) { console.warn('[cover-gen] 存储失败:', e.message); }
    }

    // Step 4: 保存（含 AI 生成的名字）
    project.coverImage = finalUrl;
    if (dramaTitle && dramaTitle !== project.name && !project.description) {
      project.name = dramaTitle;
    }
    await project.save();
    console.log('[cover-gen] ✅ 封面已保存:', finalUrl.substring(0, 60) + '...');

    res.json({ data: { coverImage: finalUrl, title: dramaTitle, prompt: coverPrompt } });
  } catch (e) { next(e); }
});

module.exports = router;
