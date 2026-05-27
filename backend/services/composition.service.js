const Composition = require('../models/composition.model');
const Storyboard = require('../models/storyboard.model');

/**
 * 创建合成任务
 * @param {string} projectId
 * @param {string} storyboardId
 * @param {Object} options - 合成选项
 * @returns {Promise<Object>}
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
 * @param {string} compositionId
 * @returns {Promise<Object>}
 */
async function getCompositionProgress(compositionId) {
  const composition = await Composition.findById(compositionId);
  if (!composition) throw new Error('合成任务不存在');
  return {
    status: composition.status,
    progress: composition.progress,
    outputUrl: composition.outputUrl,
    errorMessage: composition.errorMessage,
  };
}

module.exports = { createComposition, getCompositionProgress };
