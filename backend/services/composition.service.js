const Composition = require('../models/composition.model');
const Storyboard = require('../models/storyboard.model');
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
  const storyboard = await Storyboard.findById(storyboardId);
  if (!storyboard) throw new Error('分镜表不存在');

  const composition = await Composition.create({
    projectId,
    storyboardId,
    name: options.name || `合成_${Date.now()}`,
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
        // Throttle DB writes: only write on 5 % increments or stage change
        try {
          composition.progress = pct;
          await composition.save();
          emit('composition-progress', { status: 'rendering', progress: pct, stage });
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
    const resolvedUrl = storage.resolvePublicUrl(publicUrl);

    // ---- Success ----
    composition.status = 'completed';
    composition.progress = 100;
    composition.outputUrl = resolvedUrl;
    composition.warnings = result.warnings || [];
    await composition.save();

    emit('composition-complete', {
      status: 'completed',
      progress: 100,
      outputUrl: resolvedUrl,
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
      composition.status = 'failed';
      composition.errorMessage = err.message;
      await composition.save().catch(() => {});
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
