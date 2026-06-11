const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');

/**
 * AI分镜生成Agent — 替代纯规则拆解
 * 融入资料包: 分镜头提示词(完整框架) + 六维一致性 + 违禁词库
 */
async function run(script, characters, options = {}) {
  if (!script || !script.scenes || script.scenes.length === 0) {
    throw new Error('剧本为空，无法生成分镜');
  }

  const maxDuration = options.maxDuration || 15;
  const startScene = options.startScene || 0;
  const sceneCount = options.sceneCount || script.scenes.length;
  const endScene = Math.min(startScene + sceneCount, script.scenes.length);
  const batchLabel = (startScene > 0 || sceneCount < script.scenes.length)
    ? ` [镜${startScene + 1}-${endScene}/${script.scenes.length}]` : '';

  console.log(`[storyboard-agent] AI分镜${batchLabel}: ${endScene - startScene} 场次, 最长${maxDuration}s`);

  const systemPrompt = prompts.storyboardAgent.system;
  const userPrompt = prompts.storyboardAgent.userTemplate(script, characters, maxDuration, startScene, endScene);

  try {
    const res = await callLLM(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 16000,
      responseFormat: 'json',
    });
    const shots = JSON.parse(res);

    if (!Array.isArray(shots) || shots.length === 0) {
      throw new Error('AI分镜生成结果为空');
    }

    // 数据清洗：确保每个shot字段合法，duration 取 AI 决定的值
    const validShotTypes = ['远景', '全景', '中景', '近景', '特写', '大特写', '微距'];
    const validCameraMoves = ['固定', '推镜', '拉镜', '平移', '摇镜', '跟镜', '升降', '希区柯克变焦', '变速推近'];
    const validCameraAngles = ['平视', '俯拍', '仰拍', '顶拍', '荷兰角'];
    const sanitized = shots.map((shot, idx) => {
      const dur = Math.max(4, Math.min(maxDuration, Number(shot.duration) || 5));
      const emotion = String(shot.characterEmotion || '').substring(0, 300);
      const imageBase = String(shot.imagePrompt || '').substring(0, 1000);
      // 确保 imagePrompt 开头注入了情绪
      const imagePrompt = (emotion && !imageBase.includes(emotion.substring(0, 8)))
        ? `${emotion}，${imageBase}`.substring(0, 1000)
        : imageBase;
      const videoBase = String(shot.videoPrompt || '').substring(0, 2000);
      // 确保 videoPrompt 的动作描述含情绪
      const videoPrompt = (emotion && !videoBase.includes(emotion.substring(0, 8)))
        ? videoBase.replace(/^(衔接前置指令：.+?\n)/, `$1【情绪基调：${emotion}】\n`)
        : videoBase;
      return {
      shotNumber: Math.max(1, Number(shot.shotNumber) || idx + 1),
      sceneName: String(shot.sceneName || '').substring(0, 100),
      timeOfDay: String(shot.timeOfDay || '白天'),
      shotType: validShotTypes.includes(shot.shotType) ? shot.shotType : '中景',
      cameraAngle: validCameraAngles.includes(shot.cameraAngle) ? shot.cameraAngle : '平视',
      cameraMovement: validCameraMoves.includes(shot.cameraMovement) ? shot.cameraMovement : '固定',
      duration: dur,
      lighting: String(shot.lighting || '').substring(0, 100),
      characterEmotion: emotion,
      imageDescription: imagePrompt,
      dialogue: {
        characterName: String(shot.dialogue?.characterName || '').substring(0, 50),
        text: String(shot.dialogue?.text || '').substring(0, 500),
        audioUrl: shot.dialogue?.audioUrl || '',
        actionHint: String(shot.dialogue?.actionHint || '').substring(0, 200),
        cameraHint: String(shot.dialogue?.cameraHint || '').substring(0, 200),
        innerThought: String(shot.dialogue?.innerThought || '').substring(0, 500),
      },
      soundEffect: String(shot.soundEffect || '').substring(0, 200),
      notes: String(shot.notes || '').substring(0, 500),
      _imagePrompt: imagePrompt,
      _videoPrompt: videoPrompt,
      _refImages: [],
      status: 'pending',
    }});

    const avgDur = (sanitized.reduce((s, x) => s + x.duration, 0) / sanitized.length).toFixed(1);
    console.log(`[storyboard-agent] 完成: ${sanitized.length} 个分镜, 均长${avgDur}s, 范围${Math.min(...sanitized.map(x=>x.duration))}-${Math.max(...sanitized.map(x=>x.duration))}s`);
    return sanitized;
  } catch (e) {
    console.error('[storyboard-agent] 分镜生成失败:', e.message);
    throw e;
  }
}

module.exports = { run };
