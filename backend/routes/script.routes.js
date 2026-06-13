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
const { callLLM } = require('../utils/llm-client');
const { checkDocOwnership } = require('../middleware/ownership.middleware');
const { aiGenerateLimiter, aiContinueLimiter } = require('../middleware/rate-limiter.middleware');
router.use(authRequired);

const VALID_TIMES = ['白天', '夜晚', '黄昏', '傍晚', '清晨', '黎明', '正午', '深夜', '雨天', '雪天', '不限'];

/** 校验剧本归属：非 admin 用户只能操作自己项目下的剧本 */
async function verifyScriptAccess(script, userId, role) {
  if (!script) return false;
  if (role === 'admin') return true;
  const project = await Project.findById(script.projectId);
  return project && project.userId === userId.toString();
}

/** 清洗AI生成的剧本数据，确保字段值在Schema枚举范围内 */
function sanitizeScriptData(scriptData) {
  if (!scriptData || !scriptData.scenes) return scriptData;
  const VALID_SHOT_TYPES = ['远景', '中景', '近景', '特写', '大特写', '全景', '中近景'];
  const VALID_CAM_MOVES = ['推', '拉', '摇', '移', '跟', '静止', '升', '降', '晃动', '摇移', '推拉', '跟移'];
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
    // 清洗对话（保留已知字段 + 透传未知字段）
    const cleanDialogues = (scene.dialogues || []).map(d => ({
      ...d,
      characterName: String(d.characterName || '未知').substring(0, 50),
      text: String(d.text || '').substring(0, 2000),
      actionHint: (d.actionHint || '').substring(0, 500),
      innerThought: (d.innerThought || '').substring(0, 1000),
      cameraHint: (d.cameraHint || '').substring(0, 200),
    })).filter(d => d.text && d.characterName);
    // 清洗场景（保留已知字段 + 透传未知字段，确保枚举字段合法）
    return {
      ...scene,
      sceneNumber: scene.sceneNumber || 1,
      timeOfDay: VALID_TIMES.includes(scene.timeOfDay) ? scene.timeOfDay : '白天',
      location: (scene.location || '未知地点').substring(0, 200),
      shotType: VALID_SHOT_TYPES.includes(scene.shotType) ? scene.shotType : '中景',
      composition: (scene.composition || '').substring(0, 200),
      cameraMovement: VALID_CAM_MOVES.includes(scene.cameraMovement) ? scene.cameraMovement : '静止',
      lighting: (scene.lighting || '').substring(0, 200),
      soundEffect: (scene.soundEffect || '').substring(0, 200),
      duration: estDuration || (scene.duration || 3),
      characters: (scene.characters || []).map(c => String(c).substring(0, 50)),
      atmosphere: (scene.atmosphere || '').substring(0, 200),
      sceneDescription: (scene.sceneDescription || '').substring(0, 2000),
      dialogues: cleanDialogues,
      notes: (scene.notes || '').substring(0, 1000),
    };
  }); // end of map
  return scriptData;
}

// AI一键生成完整剧本体系（异步，WebSocket推送结果）

// 内存中追踪活跃的生成任务（刷新页面后前端可查询恢复）
const activeGenerations = new Map(); // projectId → { status, startTime, step, userId }

router.get('/generation-status', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ message: '缺少 projectId' });
  const job = activeGenerations.get(projectId);
  if (!job) return res.json({ data: { active: false } });
  // 清理超过 10 分钟的过期任务
  if (Date.now() - job.startTime > 600000) { activeGenerations.delete(projectId); return res.json({ data: { active: false } }); }
  res.json({ data: { active: true, status: job.status, step: job.step, startTime: job.startTime } });
});

router.post('/ai-generate', aiGenerateLimiter, async (req, res, next) => {
  try {
    await appConfig.loadUserConfig(req.user._id);
    const { projectId, tags } = req.body;
    const io = req.app.get('io');

    if (!projectId || !tags) {
      return res.status(400).json({ message: '缺少必要参数: projectId, tags' });
    }

    // 防止重复提交
    if (activeGenerations.has(projectId)) {
      const existing = activeGenerations.get(projectId);
      if (Date.now() - existing.startTime < 600000) {
        return res.status(409).json({ message: '该片场已有正在进行的剧本生成任务，请等待完成' });
      }
    }

    activeGenerations.set(projectId, { status: 'running', startTime: Date.now(), step: 0, userId: req.user._id });

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
      showInnerThought: tags.showInnerThought !== false,
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
      const scenes = sanitized.scenes || [];

      // 防护：LLM 返回空剧本时删除垃圾记录并通知前端
      if (!scenes.length) {
        console.error('[script] AI返回空剧本 (0 scenes)，已拒绝保存。finalState.script keys:', Object.keys(finalState.script || {}));
        io.to(`project-${projectId}`).emit('script-generation-error', {
          error: 'AI 生成失败：模型返回了空剧本。请在系统设置中检查 LLM 配置，或尝试更换模型提供商（DeepSeek/豆包/OpenAI）后重试。',
        });
        activeGenerations.delete(projectId);
        return;
      }

      const script = await Script.create({
        projectId,
        episodeNumber: 1,
        episodeTitle: sanitized.episodeTitle || finalState.script?.episodeTitle || '',
        source: 'ai_generated',
        summary: finalState.outline?.summary || '',
        scenes,
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
      activeGenerations.delete(projectId);
    }).catch((err) => {
      console.error('Script generation error:', err);
      let msg = err.message || '未知错误';
      if (msg.includes('API key not configured') || msg.includes('not configured')) {
        msg = '请先在系统设置中配置 LLM API Key（DeepSeek / 豆包 / OpenAI 任选一个）';
      } else if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
        msg = 'AI 服务连接超时，请检查 Base URL 和网络连接';
      } else if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
        msg = 'API Key 无效或无权限，请检查系统设置中的密钥配置';
      } else if (msg.includes('429') || msg.includes('频率') || msg.includes('rate')) {
        msg = 'API 调用频率限制，请稍后重试';
      }
      io.to(`project-${projectId}`).emit('script-generation-error', { error: msg });
      activeGenerations.delete(projectId);
    });
  } catch (error) { next(error); }
});

// 剧本续写
router.post('/continue', aiContinueLimiter, async (req, res, next) => {
  try {
    await appConfig.loadUserConfig(req.user._id);
    const { projectId, episodeId, continueCount = 1 } = req.body;
    const safeCount = Math.min(Math.max(1, Number(continueCount) || 1), 5); // 上限5集
    const io = req.app.get('io');

    if (!projectId) {
      return res.status(400).json({ message: '缺少必要参数: projectId' });
    }

    const historyScripts = await getProjectScriptHistory(projectId);
    const lastScript = historyScripts[historyScripts.length - 1];
    const targetEpisode = (lastScript?.episodeNumber || 0) + 1;

    // 读取项目的视觉配置 + 完结控制
    const project = await Project.findById(projectId);
    const totalEpisodes = project?.totalEpisodes || 15;
    const videoConfig = project?.videoConfig || {};
    const directorSettings = project?.directorSettings || {};
    console.log(`[script] 集数控制: 第${targetEpisode}/${totalEpisodes}集 风格=${videoConfig.visualStyle}/${videoConfig.subStyle}`);

    const graph = buildScriptContinueGraph();

    global.__io = io;
    global.__projectId = projectId;

    const initialState = {
      projectId,
      io,
      videoConfig,
      directorSettings,
      episodeNumber: targetEpisode,
      targetEpisode,
      safeCount,
      status: 'continuing',
      historyScripts,
      characters: [],
      totalEpisodes,
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

      // 最后一集：自动标记项目为已完成
      if (targetEpisode >= totalEpisodes) {
        await Project.updateOne({ _id: projectId }, { $set: { status: 'completed' } });
        io.to(`project-${projectId}`).emit('project-completed', { projectId, message: '全剧已完结！总集数：' + targetEpisode + ' 集' });
      }
    }).catch((err) => {
      console.error('Script continue error:', err);
      let msg = err.message || '未知错误';
      if (msg.includes('API key not configured') || msg.includes('not configured')) msg = '请先在系统设置中配置 LLM API Key';
      else if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) msg = 'AI 服务连接超时，请检查 Base URL 和网络连接';
      else if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) msg = 'API Key 无效或无权限，请检查系统设置中的密钥配置';
      else if (msg.includes('429') || msg.includes('rate')) msg = 'API 调用频率限制，请稍后重试';
      io.to(`project-${projectId}`).emit('script-continue-error', { error: msg });
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
    const { projectId, fileContent, fileType = 'txt', episodeTitle } = req.body;

    if (!projectId || !fileContent) {
      return res.status(400).json({ message: '缺少必要参数: projectId, fileContent' });
    }

    const structuredScenes = parseScriptToStructure(fileContent, fileType);

    // 自动推断剧集编号：当前最大集数 + 1
    const maxEp = await Script.findOne({ projectId }).sort({ episodeNumber: -1 }).select('episodeNumber').lean();
    const nextEp = (maxEp?.episodeNumber || 0) + 1;

    const script = await Script.create({
      projectId,
      episodeNumber: nextEp,
      episodeTitle: episodeTitle || '',
      source: 'manual_import',
      scenes: structuredScenes,
    });

    res.json({ message: '导入成功', data: script });
  } catch (error) { next(error); }
});

// 故事导入 → AI 改编为剧本
router.post('/story-to-script', async (req, res, next) => {
  try {
    await appConfig.loadUserConfig(req.user._id);
    const { projectId, storyContent, episodeTitle } = req.body;

    if (!projectId || !storyContent) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const project = await Project.findById(projectId).lean();
    const styleInfo = project?.videoConfig ? `${project.videoConfig.visualStyle || '写实'} / ${project.videoConfig.aspectRatio || '9:16'}` : '写实 / 9:16';

    const systemPrompt = `你是资深短剧编剧，擅长将故事/小说片段改编为标准短剧剧本格式。

【改编规则 - 严格遵循】
1. 忠于原作：保持原故事的人物性格、情节走向、核心冲突和情感基调，不添加无关新角色或支线
2. 剧本化：将叙述性文字转为场景+对白+动作提示的标准格式
3. 分场合理：按地点/时间转换自然分场，每场有明确的场景信息
4. 对白生动：将内心独白、间接引语转为自然的口语对白；叙述中的互动转为具体台词
5. 动作提示：环境描写、人物动作、表情用括号标注，如"（放下咖啡杯，目光闪躲）"
6. 节奏紧凑：短剧每场戏控制在 3-8 句对白，去掉冗长铺垫
7. JSON 输出格式必须严格遵照示例

【视觉风格】${styleInfo}

请输出 JSON 格式（只输出 JSON，不要其他文字）：
{
  "episodeTitle": "根据故事内容提炼的标题（10字以内）",
  "scenes": [
    {
      "sceneNumber": 1,
      "timeOfDay": "白天/夜晚/黄昏等",
      "location": "具体地点",
      "characters": ["人物1", "人物2"],
      "atmosphere": "氛围描述（温馨/紧张/悲伤等）",
      "shotType": "中景/近景/特写等",
      "cameraMovement": "固定/推镜/拉镜等",
      "lighting": "光影描述",
      "duration": 5,
      "composition": "中心构图/三分法等",
      "sceneDescription": "场景环境简述（不少于30字）",
      "dialogues": [
        { "characterName": "人物名", "text": "台词内容", "actionHint": "动作/表情提示", "cameraHint": "镜头提示", "innerThought": "内心独白" }
      ],
      "notes": "环境音/BGM/转场备注"
    }
  ]
}`;

    const userPrompt = `请将以下故事改编为短剧剧本：\n\n${storyContent}`;

    const result = await callLLM(systemPrompt, userPrompt, {
      responseFormat: 'json',
      temperature: 0.7,
      maxTokens: 4096,
    });

    let parsed;
    try {
      parsed = typeof result === 'string' ? JSON.parse(result) : result;
    } catch {
      // 尝试从文本中提取 JSON
      const jsonMatch = (typeof result === 'string' ? result : JSON.stringify(result)).match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('AI 返回格式无法解析');
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return res.status(500).json({ message: 'AI 未能生成有效剧本，请尝试缩短故事内容' });
    }

    // 给每场补齐 sceneNumber
    parsed.scenes.forEach((s, i) => {
      if (!s.sceneNumber) s.sceneNumber = i + 1;
      if (!s.dialogues) s.dialogues = [];
    });

    const maxEp = await Script.findOne({ projectId }).sort({ episodeNumber: -1 }).select('episodeNumber').lean();
    const nextEp = (maxEp?.episodeNumber || 0) + 1;

    const script = await Script.create({
      projectId,
      episodeNumber: nextEp,
      episodeTitle: episodeTitle || parsed.episodeTitle || '',
      source: 'manual_import',
      scenes: parsed.scenes,
    });

    res.json({ message: '故事已改编为剧本', data: script });
  } catch (error) {
    console.error('[story-to-script] 失败:', error.message);
    next(error);
  }
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
    if (!(await verifyScriptAccess(script, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此剧本' });
    }
    res.json({ data: script });
  } catch (error) { next(error); }
});

// 更新剧本（在线编辑，仅白名单字段）
router.put('/:id', async (req, res, next) => {
  try {
    const script = await Script.findById(req.params.id);
    if (!script) return res.status(404).json({ message: '剧本不存在' });
    if (!(await verifyScriptAccess(script, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权修改此剧本' });
    }
    const allowed = ['episodeTitle', 'scenes', 'summary', 'status', 'source'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    Object.assign(script, update);
    await script.save();
    res.json({ message: '保存成功', data: script });
  } catch (error) { next(error); }
});

// 删除剧本
router.delete('/:id', async (req, res, next) => {
  try {
    const script = await Script.findById(req.params.id);
    if (!script) return res.status(404).json({ message: '剧本不存在' });
    if (!(await verifyScriptAccess(script, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权删除此剧本' });
    }
    await Script.findByIdAndDelete(req.params.id);
    res.json({ message: '删除成功', data: script });
  } catch (error) { next(error); }
});

// 批量删除剧本
router.post('/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要删除的剧本' });
    }
    const scripts = await Script.find({ _id: { $in: ids } });
    for (const s of scripts) {
      if (!(await verifyScriptAccess(s, req.user._id, req.user.role))) {
        return res.status(403).json({ message: '无权删除部分剧本' });
      }
    }
    const r = await Script.deleteMany({ _id: { $in: ids } });
    res.json({ message: `已删除 ${r.deletedCount} 个剧本`, data: { deletedCount: r.deletedCount } });
  } catch (error) { next(error); }
});

module.exports = router;
