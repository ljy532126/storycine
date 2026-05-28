const express = require('express');
const router = express.Router();
const Script = require('../models/script.model');
const Project = require('../models/project.model');
const Character = require('../models/character.model');
const { buildScriptGenerationGraph, buildScriptContinueGraph } = require('../services/ai/langgraph.engine');
const { parseScriptToStructure, getProjectScriptHistory } = require('../services/script.service');
const { batchCreateCharacters } = require('../services/asset.service');
const { authRequired } = require('../middleware/auth.middleware');
const appConfig = require('../config/app.config');
router.use(authRequired);

const VALID_TIMES = ['白天', '夜晚', '黄昏', '傍晚', '清晨', '黎明', '正午', '深夜', '雨天', '雪天', '不限'];

/** 清洗AI生成的剧本数据，确保字段值在Schema枚举范围内 */
function sanitizeScriptData(scriptData) {
  if (!scriptData || !scriptData.scenes) return scriptData;
  const VALID_SHOT_TYPES = ['远景', '中景', '近景', '特写', '大特写', '全景', '中近景'];
  const VALID_CAM_MOVES = ['推', '拉', '摇', '移', '跟', '静止', '升', '降', '晃动'];
  scriptData.scenes = scriptData.scenes.map(scene => {
    // 智能估算时长（对话数量 + 字数 + 动作复杂度）
    const existingDuration = Number(scene.duration);
    let estDuration = (existingDuration > 0 && existingDuration !== 3) ? existingDuration : 0;
    if (!estDuration || estDuration === 3) {
      const dialogs = scene.dialogues || [];
      const totalChars = dialogs.reduce((a, d) => a + (d.text || '').length, 0);
      const hasAction = /(跑|追|打|冲|逃|摔|跳|飞|转|站|坐|走)/.test(scene.sceneDescription || '');
      const hasEmotion = /(哭|怒|吻|拥抱|转身|回头|惊讶|愤怒|悲伤)/.test(scene.sceneDescription || '');
      if (dialogs.length === 0) { estDuration = totalChars > 20 ? 4 : 2; }
      else if (dialogs.length === 1) { estDuration = Math.max(3, Math.min(8, Math.round(totalChars / 4) + 2)); }
      else if (dialogs.length <= 3) { estDuration = Math.max(5, Math.min(12, Math.round(totalChars / 3) + 3)); }
      else { estDuration = Math.max(6, Math.min(15, Math.round(totalChars / 2) + 4)); }
      if (hasAction && estDuration > 6) estDuration = Math.min(estDuration, 6);
      if (hasEmotion && estDuration < 5) estDuration = 5;
    }
    return {
    sceneNumber: scene.sceneNumber || 1,
    timeOfDay: VALID_TIMES.includes(scene.timeOfDay) ? scene.timeOfDay : '白天',
    location: (scene.location || '未知地点').substring(0, 200),
    shotType: VALID_SHOT_TYPES.includes(scene.shotType) ? scene.shotType : '中景',
    composition: (scene.composition || '').substring(0, 200),
    cameraMovement: VALID_CAM_MOVES.includes(scene.cameraMovement) ? scene.cameraMovement : '静止',
    lighting: (scene.lighting || '').substring(0, 200),
    soundEffect: (scene.soundEffect || '').substring(0, 200),
    duration: estDuration || 3,
    characters: (scene.characters || []).map(c => String(c).substring(0, 50)),
    atmosphere: (scene.atmosphere || '').substring(0, 200),
    sceneDescription: (scene.sceneDescription || '').substring(0, 2000),
    dialogues: (scene.dialogues || []).map(d => ({
      characterName: String(d.characterName || '未知').substring(0, 50),
      text: String(d.text || '').substring(0, 2000),
      actionHint: (d.actionHint || '').substring(0, 500),
      innerThought: (d.innerThought || '').substring(0, 1000),
      cameraHint: (d.cameraHint || '').substring(0, 200),
    })),
    notes: (scene.notes || '').substring(0, 1000),
  }; // end of return object
  }); // end of map
  return scriptData;
}

// AI一键生成完整剧本体系（异步，WebSocket推送结果）
router.post('/ai-generate', async (req, res, next) => {
  try {
    await appConfig.loadUserConfig(req.user._id);
    const { projectId, tags } = req.body;
    const io = req.app.get('io');

    if (!projectId || !tags) {
      return res.status(400).json({ message: '缺少必要参数: projectId, tags' });
    }

    // 读取项目的视觉配置
    const project = await Project.findById(projectId);
    const videoConfig = project?.videoConfig || {};
    const directorSettings = project?.directorSettings || {};
    console.log(`[script] 读取项目视觉配置: 比例=${videoConfig.aspectRatio} 风格=${videoConfig.visualStyle}/${videoConfig.subStyle} 导演设定=${directorSettings.qualityKeywords ? '已设置' : '未设置'} 画风=${directorSettings.artStyleCommands ? '已设置' : '未设置'}`);

    const initialState = {
      userTags: tags,
      projectId,
      io,
      videoConfig,
      directorSettings,
      status: 'started',
      retryCount: 0,
      episodeNumber: 1,
      currentStep: 0,
    };

    const graph = buildScriptGenerationGraph();

    // 设置全局引用（Agent 通过 socketRegistry 发送进度）
    global.__io = io;
    global.__projectId = projectId;

    res.status(202).json({ message: '剧本生成任务已提交', projectId });

    // 设置全局 io 引用（LangGraph 状态序列化会丢失 io 对象）
    global.__io = io;
    global.__projectId = projectId;

    graph.invoke(initialState).then(async (finalState) => {
      const sanitized = sanitizeScriptData(finalState.script);
      const script = await Script.create({
        projectId,
        episodeNumber: 1,
        episodeTitle: sanitized.episodeTitle || finalState.script?.episodeTitle || '',
        source: 'ai_generated',
        summary: finalState.outline?.summary || '',
        scenes: sanitized.scenes || [],
      });

      // 批量创建角色
      if (finalState.characters?.length > 0) {
        await batchCreateCharacters(projectId, finalState.characters);
      }

      io.to(`project-${projectId}`).emit('script-generation-complete', {
        status: 'completed',
        data: {
          outline: finalState.outline,
          characters: finalState.characters,
          plotStructure: finalState.plotStructure,
          script,
        },
      });
    }).catch((err) => {
      console.error('Script generation error:', err);
      io.to(`project-${projectId}`).emit('script-generation-error', { error: err.message });
    });
  } catch (error) { next(error); }
});

// 剧本续写
router.post('/continue', async (req, res, next) => {
  try {
    const { projectId, episodeId, continueCount = 1 } = req.body;
    const io = req.app.get('io');

    if (!projectId) {
      return res.status(400).json({ message: '缺少必要参数: projectId' });
    }

    const historyScripts = await getProjectScriptHistory(projectId);
    const lastScript = historyScripts[historyScripts.length - 1];
    const targetEpisode = (lastScript?.episodeNumber || 0) + 1;

    // 读取项目的视觉配置
    const project = await Project.findById(projectId);
    const videoConfig = project?.videoConfig || {};
    const directorSettings = project?.directorSettings || {};
    console.log(`[script] 读取项目视觉配置: 比例=${videoConfig.aspectRatio} 风格=${videoConfig.visualStyle}/${videoConfig.subStyle} 导演设定=${directorSettings.qualityKeywords ? '已设置' : '未设置'} 画风=${directorSettings.artStyleCommands ? '已设置' : '未设置'}`);

    const graph = buildScriptContinueGraph();

    // 设置全局 io 引用（LangGraph 状态序列化会丢失 io 对象）
    global.__io = io;
    global.__projectId = projectId;

    const initialState = {
      projectId,
      io,
      videoConfig,
      directorSettings,
      episodeNumber: targetEpisode,
      targetEpisode,
      continueCount,
      status: 'continuing',
      historyScripts,
      characters: [],
    };

    res.status(202).json({ message: '续写任务已提交', targetEpisode });

    graph.invoke(initialState).then(async (finalState) => {
      const sanitized = sanitizeScriptData(finalState.script);
      const script = await Script.create({
        projectId,
        episodeNumber: targetEpisode,
        episodeTitle: sanitized.episodeTitle || finalState.script?.episodeTitle || '',
        source: 'ai_continue',
        continueFrom: episodeId,
        summary: finalState.script?.summary || '',
        scenes: sanitized.scenes || [],
      });

      io.to(`project-${projectId}`).emit('script-continue-complete', { status: 'completed', data: script });
    }).catch((err) => {
      console.error('Script continue error:', err);
      io.to(`project-${projectId}`).emit('script-continue-error', { error: err.message });
    });
  } catch (error) { next(error); }
});

// 创建空白剧集（用于新建/复制）
router.post('/create-empty', async (req, res, next) => {
  try {
    const { projectId, episodeNumber, episodeTitle, scenes } = req.body;
    if (!projectId) return res.status(400).json({ message: '缺少 projectId' });
    const script = await Script.create({
      projectId,
      episodeNumber: episodeNumber || 1,
      episodeTitle: episodeTitle || '',
      source: 'manual_import',
      scenes: scenes || [{ sceneNumber: 1, timeOfDay: '白天', location: '未设定', characters: [], atmosphere: '', sceneDescription: '', dialogues: [] }],
    });
    res.status(201).json({ message: '创建成功', data: script });
  } catch (error) {
    console.error('[create-empty] 失败:', error.message, error.errors ? JSON.stringify(error.errors) : '');
    next(error);
  }
});

// 外部剧本导入 + 自动结构化
router.post('/import', async (req, res, next) => {
  try {
    const { projectId, fileContent, fileType = 'txt' } = req.body;

    if (!projectId || !fileContent) {
      return res.status(400).json({ message: '缺少必要参数: projectId, fileContent' });
    }

    const structuredScenes = parseScriptToStructure(fileContent, fileType);

    const script = await Script.create({
      projectId,
      episodeNumber: 1,
      source: 'manual_import',
      scenes: structuredScenes,
    });

    res.json({ message: '导入成功', data: script });
  } catch (error) { next(error); }
});

// 获取剧本列表
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const filter = projectId ? { projectId } : {};
    const scripts = await Script.find(filter).sort({ episodeNumber: 1 });
    res.json({ data: scripts });
  } catch (error) { next(error); }
});

// 获取单个剧本
router.get('/:id', async (req, res, next) => {
  try {
    const script = await Script.findById(req.params.id);
    if (!script) return res.status(404).json({ message: '剧本不存在' });
    res.json({ data: script });
  } catch (error) { next(error); }
});

// 更新剧本（在线编辑）
router.put('/:id', async (req, res, next) => {
  try {
    const script = await Script.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!script) return res.status(404).json({ message: '剧本不存在' });
    res.json({ message: '保存成功', data: script });
  } catch (error) { next(error); }
});

// 删除剧本
router.delete('/:id', async (req, res, next) => {
  try {
    const script = await Script.findByIdAndDelete(req.params.id);
    if (!script) return res.status(404).json({ message: '剧本不存在' });
    res.json({ message: '删除成功', data: script });
  } catch (error) { next(error); }
});

// 批量删除剧本
router.post('/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '缺少ids数组' });
    }
    const result = await Script.deleteMany({ _id: { $in: ids } });
    res.json({ message: `已删除 ${result.deletedCount} 个剧本`, data: { deletedCount: result.deletedCount } });
  } catch (error) { next(error); }
});

module.exports = router;
