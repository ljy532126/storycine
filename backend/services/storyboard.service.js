const Script = require('../models/script.model');
const Storyboard = require('../models/storyboard.model');

/**
 * 根据剧情情感自动调整镜头参数
 */
function optimizeShotRhythm(shots) {
  return shots.map(shot => {
    const text = (shot.dialogue?.text || '') + (shot.imageDescription || '');

    if (/紧张|危险|快|跑|追|杀|死|打|冲|逃|惊|吓/.test(text)) {
      return { ...shot, shotType: '特写', cameraMovement: '跟', duration: 1.5, lighting: '暗调/高对比' };
    }
    if (/哭|泪|悲伤|难过|离开|分手|失去|想念|回忆/.test(text)) {
      return { ...shot, shotType: '远景', cameraMovement: '静止', duration: 5, lighting: '冷色调/低饱和' };
    }
    if (/说|问|答|告诉|听|笑|喊|叫|骂/.test(text)) {
      return { ...shot, shotType: '中近景', cameraMovement: '静止', duration: 3 };
    }
    if (/走|跳|飞|爬|摔|倒|站|坐|躺/.test(text)) {
      return { ...shot, shotType: '中景', cameraMovement: '跟', duration: 2.5 };
    }
    if (/怒|恨|仇|爱|吻|抱|拥/.test(text)) {
      return { ...shot, shotType: '近景', cameraMovement: '推', duration: 4, lighting: '戏剧光/高反差' };
    }
    return shot;
  });
}

/**
 * 校验并修正镜头字段，确保值都在 Schema 枚举范围内
 */
function sanitizeShot(shot) {
  const validShotTypes = ['远景', '中景', '近景', '特写', '大特写', '全景', '中近景'];
  const validCameraMoves = ['推', '拉', '摇', '移', '跟', '静止', '升', '降', '晃动'];
  const cam = validCameraMoves.includes(shot.cameraMovement) ? shot.cameraMovement : '静止';
  const imgDesc = shot.imageDescription || '';
  const charName = shot.dialogue?.characterName || '';
  const text = shot.dialogue?.text || '';
  const dur = shot.duration || 3;

  // 自动生成视频提示词模板
  const videoPromptParts = [`${dur}秒短视频`];
  if (imgDesc) videoPromptParts.push(imgDesc);
  if (cam && cam !== '静止') videoPromptParts.push(`${cam}运镜`);
  if (charName && text) videoPromptParts.push(`${charName}台词："${text.substring(0, 50)}"`);
  videoPromptParts.push('电影级画质，流畅过渡');
  const videoPrompt = videoPromptParts.join('，');

  return {
    shotNumber: shot.shotNumber,
    sceneName: shot.sceneName || '',
    shotType: validShotTypes.includes(shot.shotType) ? shot.shotType : '中景',
    composition: shot.composition || '',
    cameraMovement: cam,
    lighting: shot.lighting || '',
    duration: dur,
    imageDescription: imgDesc,
    renderedImage: shot.renderedImage || '',
    renderedVideo: shot.renderedVideo || '',
    dialogue: { characterName: charName, text, audioUrl: shot.dialogue?.audioUrl || '' },
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
        cameraMovement: '静止',
        duration: 3,
        imageDescription: `${scene.location || ''}，${scene.timeOfDay || ''}，${scene.atmosphere || ''}，${scene.sceneDescription || ''}`.substring(0, 500),
        dialogue: { characterName: '', text: '' },
        notes: `场次${scene.sceneNumber} 环境建立镜头`,
      }));
    }

    // 每句台词一个镜头
    (scene.dialogues || []).forEach(dialogue => {
      const camMove = (dialogue.cameraHint && validCameraMoves.includes(dialogue.cameraHint))
        ? dialogue.cameraHint : '静止';

      shots.push(sanitizeShot({
        shotNumber: shotNum++,
        sceneName: scene.location || '',
        shotType: '中景',
        duration: 3,
        imageDescription: `${scene.location || ''}，${dialogue.characterName || ''}，${dialogue.actionHint || ''}`.substring(0, 500),
        dialogue: {
          characterName: dialogue.characterName || '',
          text: dialogue.text || '',
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

const validCameraMoves = ['推', '拉', '摇', '移', '跟', '静止', '升', '降', '晃动'];

module.exports = { optimizeShotRhythm, autoGenerateStoryboard };
