const Composition = require('../models/composition.model');
const Storyboard = require('../models/storyboard.model');
const Project = require('../models/project.model');
const CompositionEngine = require('./composition/composition-engine');
const storage = require('./storage.service');
const socketRegistry = require('../utils/socket-registry');
const path = require('path');

/** Track running engines for cancellation */
const runningEngines = new Map();

/**
 * 创建合成任务（仅写DB，不启动处理）
 */
async function createComposition(projectId, storyboardId, options = {}) {
  const storyboard = await Storyboard.findById(storyboardId)
    .populate('scriptId', 'episodeTitle episodeNumber');
  if (!storyboard) throw new Error('分镜表不存在');

  // 生成中文名称：片场名_第N集_标题_时间
  let displayName;
  try {
    const project = await Project.findById(projectId).select('name');
    const projectName = project?.name || '未命名片场';
    const epNum = storyboard.scriptId?.episodeNumber || '?';
    const epTitle = storyboard.scriptId?.episodeTitle || '';
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    displayName = `${projectName}_第${epNum}集`;
    if (epTitle) displayName += `_${epTitle}`;
    displayName += `_${ts}`;
  } catch { displayName = options.name || `合成_${Date.now()}`; }

  const composition = await Composition.create({
    projectId,
    storyboardId,
    name: options.name || displayName,
    outputFormat: options.outputFormat || 'mp4',
    resolution: options.resolution || '1080x1920',
    frameRate: options.frameRate || 24,
    totalDuration: storyboard.totalDuration || 0,
    backgroundMusic: options.backgroundMusic || '',
    subtitlesEnabled: options.subtitlesEnabled !== undefined ? options.subtitlesEnabled : true,
    transitions: options.transitions || 'fade',
    status: 'pending',
    progress: 0,
  });

  return composition;
}

/**
 * 获取合成进度
 */
async function getCompositionProgress(compositionId) {
  const composition = await Composition.findById(compositionId);
  if (!composition) throw new Error('合成任务不存在');
  return {
    status: composition.status,
    progress: composition.progress,
    outputUrl: composition.outputUrl,
    errorMessage: composition.errorMessage,
    warnings: composition.warnings || [],
  };
}

/**
 * 取消合成任务（中止 FFmpeg 进程）
 */
async function cancelComposition(compositionId) {
  const engine = runningEngines.get(compositionId.toString());
  if (engine) {
    engine.abort();
    runningEngines.delete(compositionId.toString());
  }

  const composition = await Composition.findByIdAndUpdate(
    compositionId,
    { status: 'failed', errorMessage: '用户取消' },
    { new: true }
  );
  if (!composition) throw new Error('合成任务不存在');

  const io = socketRegistry.getIO();
  if (io) {
    io.to(`project-${composition.projectId}`).emit('composition-error', {
      compositionId,
      error: '用户取消',
    });
  }

  return composition;
}

/**
 * 主处理流程：加载素材 → FFmpeg 合成 → 上传存储 → 写库 + Socket 推送
 * 由 composition.routes 异步调用（不阻塞 HTTP 响应）
 */
async function processComposition(compositionId) {
  let composition;
  let engine;
  let outputPath = null;

  try {
    composition = await Composition.findById(compositionId);
    if (!composition) throw new Error('合成任务不存在');
    if (composition.status === 'failed' && composition.errorMessage === '用户取消') {
      return; // already cancelled
    }

    composition.status = 'rendering';
    composition.progress = 0;
    await composition.save();

    const storyboard = await Storyboard.findById(composition.storyboardId);
    if (!storyboard) throw new Error('分镜表不存在');
    if (!storyboard.shots || storyboard.shots.length === 0) {
      throw new Error('分镜表没有镜头数据');
    }

    const io = socketRegistry.getIO();
    const projectRoom = `project-${composition.projectId}`;

    const emit = (event, data) => {
      if (io) io.to(projectRoom).emit(event, { compositionId, ...data });
    };

    // Build engine
    engine = new CompositionEngine({
      resolution: composition.resolution,
      frameRate: composition.frameRate,
      outputFormat: composition.outputFormat,
      transition: composition.transitions,
      subtitlesEnabled: composition.subtitlesEnabled,
      backgroundMusic: composition.backgroundMusic,
      onProgress: async (pct, stage) => {
        // 每隔 20% 才写库一次，避免与最终 save 冲突
        try {
          const lastWritten = composition._lastProgressWrite || 0;
          if (pct - lastWritten >= 20 || pct >= 100) {
            composition.progress = pct;
            composition._lastProgressWrite = pct;
            await Composition.updateOne({ _id: composition._id }, { $set: { progress: pct } }).catch(() => {});
            emit('composition-progress', { status: 'rendering', progress: pct, stage });
          }
        } catch (_) { /* non-critical */ }
      },
    });

    runningEngines.set(compositionId.toString(), engine);

    // Run composition
    emit('composition-progress', { status: 'rendering', progress: 0, stage: '开始合成...' });
    const result = await engine.compose(storyboard.shots);
    outputPath = result.outputPath;

    runningEngines.delete(compositionId.toString());

    // ---- Upload to storage (cloud or local) ----
    const filename = path.basename(outputPath);
    let publicUrl;
    try {
      publicUrl = await storage.upload(outputPath, filename, 'compositions');
    } catch (upErr) {
      console.error('[composition] storage upload failed, using local URL:', upErr.message);
      publicUrl = result.publicUrl || `/uploads/compositions/${filename}`;
    }
    // 开发环境直接用本地路径，不走 PUBLIC_URL 重写
    const resolvedUrl = storage.resolvePublicUrl(publicUrl);
    const localUrl = publicUrl.startsWith('http') ? `http://localhost:${process.env.SERVER_PORT || 3012}${new URL(publicUrl).pathname}` : publicUrl;
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    // ---- Success (重取最新文档避免 onProgress 并发 save 冲突) ----
    const fresh = await Composition.findById(compositionId);
    if (fresh) {
      fresh.status = 'completed';
      fresh.progress = 100;
      fresh.outputUrl = isDev ? localUrl : resolvedUrl;
      fresh.totalDuration = result.duration || fresh.totalDuration;
      fresh.warnings = result.warnings || [];
      await fresh.save();
    }

    emit('composition-complete', {
      status: 'completed',
      progress: 100,
      outputUrl: isDev ? localUrl : resolvedUrl,
      duration: result.duration,
      warnings: result.warnings,
    });

  } catch (err) {
    runningEngines.delete(compositionId ? compositionId.toString() : '');

    if (err.code === 'ABORTED') {
      console.log(`[composition] ${compositionId} aborted`);
      return;
    }

    console.error(`[composition] ${compositionId} failed:`, err.message);

    if (composition) {
      try {
        const failDoc = await Composition.findById(compositionId);
        if (failDoc) {
          failDoc.status = 'failed';
          failDoc.errorMessage = err.message;
          await failDoc.save();
        }
      } catch (_) {}
    }

    const io = socketRegistry.getIO();
    if (io && composition) {
      io.to(`project-${composition.projectId}`).emit('composition-error', {
        compositionId,
        error: err.message,
      });
    }
  } finally {
    runningEngines.delete(compositionId ? compositionId.toString() : '');
    if (outputPath) {
      // Let engine cleanup its workdir; leave the final output in place
      if (engine) await engine.cleanup().catch(() => {});
    }
  }
}

module.exports = {
  createComposition,
  getCompositionProgress,
  cancelComposition,
  processComposition,
};
