const PromoEngine = require('./composition/promo-engine');
const Storyboard = require('../models/storyboard.model');
const Project = require('../models/project.model');
const storage = require('./storage.service');
const socketRegistry = require('../utils/socket-registry');
const path = require('path');

/**
 * 引流短片生成服务
 * 从故事板提取素材，生成竖版引流片段
 */
async function generatePromoClips(projectId, storyboardId, options = {}) {
  const storyboard = await Storyboard.findById(storyboardId)
    .populate('scriptId', 'episodeTitle episodeNumber');
  if (!storyboard) throw new Error('分镜表不存在');
  const shots = storyboard.shots || [];
  if (shots.length === 0) throw new Error('分镜表无镜头数据');

  const project = await Project.findById(projectId).select('name directorSettings tags genre');
  const tags = (project?.genre || '').split(/[,，]/).filter(Boolean);
  const mode = options.mode || 'simple';
  const resolution = options.resolution || '1080x1920';
  const frameRate = options.frameRate || 24;
  const bgm = options.backgroundMusic || '';
  const maxDuration = options.maxDuration || 60;

  const engine = new PromoEngine({
    resolution, frameRate, outputFormat: 'mp4',
    backgroundMusic: bgm,
  });

  const io = socketRegistry.getIO();
  const room = `project-${projectId}`;
  const emit = (evt, data) => { if (io) io.to(room).emit(evt, { ...data }); };

  emit('promo-progress', { status: 'rendering', progress: 5, message: '准备素材...' });

  const shotsWithVideos = shots.filter(s => s.renderedVideo && !/^cgt-/.test(s.renderedVideo));
  if (shotsWithVideos.length === 0) throw new Error('没有已生成视频的镜头，请先生成视频');
  if (shotsWithVideos.length < 3) throw new Error('至少需要3个已生成视频的镜头才能制作引流短片');

  const clips = await engine.generate(shots, {
    mode, maxDuration,
    projectTags: tags,
  });

  // Upload each clip
  const results = [];
  for (const clip of clips) {
    if (!clip || !clip.outputPath) continue;
    const filename = path.basename(clip.outputPath);
    let publicUrl;
    try {
      publicUrl = await storage.upload(clip.outputPath, filename, 'promos');
    } catch {
      publicUrl = `/uploads/promos/${filename}`;
    }
    results.push({
      style: clip.style,
      label: { conflict: '冲突向', sweet: '甜宠向', suspense: '悬念向', simple: '引流短片' }[clip.style] || clip.style,
      hookText: clip.hookText,
      shotCount: clip.shots,
      url: publicUrl,
    });
  }

  await engine.cleanup();

  emit('promo-complete', { status: 'completed', clips: results });

  return results;
}

module.exports = { generatePromoClips };
