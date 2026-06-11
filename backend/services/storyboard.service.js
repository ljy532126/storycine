const Script = require('../models/script.model');
const Storyboard = require('../models/storyboard.model');
const Character = require('../models/character.model');

/**
 * 根据剧情情感自动调整镜头参数
 */
function optimizeShotRhythm(shots) {
  return shots.map(shot => {
    const text = (shot.dialogue?.text || '') + (shot.imageDescription || '');

    if (/紧张|危险|快|跑|追|杀|死|打|冲|逃|惊|吓/.test(text)) {
      return { ...shot, shotType: '特写', cameraMovement: '跟镜', duration: 1.5, lighting: '暗调/高对比' };
    }
    if (/哭|泪|悲伤|难过|离开|分手|失去|想念|回忆/.test(text)) {
      return { ...shot, shotType: '远景', cameraMovement: '固定', duration: 5, lighting: '冷色调/低饱和' };
    }
    if (/说|问|答|告诉|听|笑|喊|叫|骂/.test(text)) {
      return { ...shot, shotType: '近景', cameraMovement: '固定', duration: 3 };
    }
    if (/走|跳|飞|爬|摔|倒|站|坐|躺/.test(text)) {
      return { ...shot, shotType: '中景', cameraMovement: '跟镜', duration: 2.5 };
    }
    if (/怒|恨|仇|爱|吻|抱|拥/.test(text)) {
      return { ...shot, shotType: '近景', cameraMovement: '推镜', duration: 4, lighting: '戏剧光/高反差' };
    }
    return shot;
  });
}

/**
 * 校验并修正镜头字段，确保值都在 Schema 枚举范围内
 */
function sanitizeShot(shot) {
  const validShotTypes = ['远景', '全景', '中景', '近景', '特写', '大特写', '微距'];
  const validCameraMoves = ['固定', '推镜', '拉镜', '平移', '摇镜', '跟镜', '升降', '希区柯克变焦', '变速推近'];
  const validCameraAngles = ['平视', '俯拍', '仰拍', '顶拍', '荷兰角'];
  const cam = validCameraMoves.includes(shot.cameraMovement) ? shot.cameraMovement : '固定';
  const angle = validCameraAngles.includes(shot.cameraAngle) ? shot.cameraAngle : '平视';
  const imgDesc = shot.imageDescription || '';
  const charName = shot.dialogue?.characterName || '';
  const text = shot.dialogue?.text || '';
  const dur = shot.duration || 3;

  // 自动生成视频提示词模板
  const videoPromptParts = [`${dur}秒短视频`];
  if (imgDesc) videoPromptParts.push(imgDesc);
  if (cam && cam !== '固定') videoPromptParts.push(`${cam}运镜`);
  if (angle && angle !== '平视') videoPromptParts.push(`${angle}视角`);
  if (charName && text) videoPromptParts.push(`${charName}台词："${text.substring(0, 50)}"`);
  videoPromptParts.push('电影级画质，流畅过渡');
  const videoPrompt = videoPromptParts.join('，');

  return {
    shotNumber: Math.max(1, Number(shot.shotNumber) || 0),
    sceneName: shot.sceneName || '',
    shotType: validShotTypes.includes(shot.shotType) ? shot.shotType : '中景',
    cameraAngle: angle,
    composition: shot.composition || '',
    cameraMovement: cam,
    lighting: shot.lighting || '',
    characterEmotion: (shot.characterEmotion || '').substring(0, 300),
    duration: dur,
    imageDescription: imgDesc,
    renderedImage: shot.renderedImage || '',
    renderedVideo: shot.renderedVideo || '',
    dialogue: {
      characterName: charName, text, audioUrl: shot.dialogue?.audioUrl || '',
      actionHint: shot.dialogue?.actionHint || '',
      cameraHint: shot.dialogue?.cameraHint || '',
      innerThought: shot.dialogue?.innerThought || '',
    },
    soundEffect: shot.soundEffect || '',
    notes: shot.notes || '',
    status: 'pending',
    _imagePrompt: imgDesc,
    _videoPrompt: videoPrompt,
  };
}

/**
 * 从剧本自动拆解分镜
 */
async function autoGenerateStoryboard(scriptId, projectId) {
  const script = await Script.findById(scriptId);
  if (!script) throw new Error('剧本不存在');

  const shots = [];
  let shotNum = 1;

  (script.scenes || []).forEach(scene => {
    // 环境建立镜头
    if (scene.sceneDescription && scene.sceneDescription.trim()) {
      shots.push(sanitizeShot({
        shotNumber: shotNum++,
        sceneName: scene.location || '',
        shotType: '全景',
        cameraMovement: '固定',
        duration: 3,
        imageDescription: `${scene.location || ''}，${scene.timeOfDay || ''}，${scene.atmosphere || ''}，${scene.sceneDescription || ''}`.substring(0, 500),
        dialogue: { characterName: '', text: '' },
        notes: `场次${scene.sceneNumber} 环境建立镜头`,
      }));
    }

    // 每句台词一个镜头
    (scene.dialogues || []).forEach(dialogue => {
      const camMove = (dialogue.cameraHint && validCameraMoves.includes(dialogue.cameraHint))
        ? dialogue.cameraHint : '固定';

      shots.push(sanitizeShot({
        shotNumber: shotNum++,
        sceneName: scene.location || '',
        shotType: '中景',
        duration: 3,
        imageDescription: `${scene.location || ''}，${dialogue.characterName || ''}，${dialogue.actionHint || ''}`.substring(0, 500),
        dialogue: {
          characterName: dialogue.characterName || '',
          text: dialogue.text || '',
          actionHint: dialogue.actionHint || '',
          cameraHint: dialogue.cameraHint || '',
          innerThought: dialogue.innerThought || '',
        },
        cameraMovement: camMove,
        notes: `场次${scene.sceneNumber} ${dialogue.characterName || ''}台词`,
      }));
    });
  });

  if (shots.length === 0) {
    throw new Error('剧本中没有可拆解的内容（无场景描述和台词）');
  }

  const optimizedShots = optimizeShotRhythm(shots).map(sanitizeShot);

  const storyboard = await Storyboard.create({
    projectId,
    scriptId,
    shots: optimizedShots,
  });

  console.log(`[storyboard] 拆解完成: ${storyboard.totalShots} 镜头, ${storyboard.totalDuration}s`);
  return storyboard;
}

/**
 * AI驱动的分镜生成（替代纯规则拆解）
 * @param {string} scriptId
 * @param {string} projectId
 * @param {Object} options - { duration: 10|15, useAI: true }
 */
async function autoGenerateStoryboardAI(scriptId, projectId, options = {}) {
  const script = await Script.findById(scriptId);
  if (!script) throw new Error('剧本不存在');

  const characters = await Character.find({ projectId }).lean();
  const maxDuration = options.maxDuration || 15;
  const startScene = options.startScene || 0;
  const sceneCount = options.sceneCount || script.scenes?.length || 0;

  console.log(`[storyboard] AI分镜: script=${scriptId} chars=${characters.length} range=[${startScene},${startScene + sceneCount})`);

  const storyboardAgent = require('./ai/agents/storyboard.agent');
  const shots = await storyboardAgent.run(
    script.toObject ? script.toObject() : script,
    characters,
    { maxDuration, startScene, sceneCount }
  );

  if (!shots || shots.length === 0) {
    throw new Error('AI未生成有效分镜');
  }

  // 只返回镜头数组（供分批调用），不创建 Storyboard 文档
  if (options.returnShots) return shots;

  // upsert: 同剧本已有故事板则更新，避免重复创建
  const storyboard = await Storyboard.findOneAndUpdate(
    { projectId, scriptId },
    { $set: { shots, projectId, scriptId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`[storyboard] AI分镜完成: ${storyboard.totalShots} 镜头, ${storyboard.totalDuration}s`);
  return storyboard;
}

const validCameraMoves = ['固定', '推镜', '拉镜', '平移', '摇镜', '跟镜', '升降', '希区柯克变焦', '变速推近'];

module.exports = { optimizeShotRhythm, autoGenerateStoryboard, autoGenerateStoryboardAI };
