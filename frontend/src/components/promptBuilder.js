/**
 * 共享提示词构建器 — 分镜 → 图片/视频提示词
 * 一键同步至故事板 和 生成故事板 共用同一套逻辑
 */

/** 从全局设定提取风格关键词 */
function getStyleKeywords(videoConfig) {
  const vc = videoConfig || {};
  const parts = [];
  if (vc.visualStyle) parts.push(vc.visualStyle);
  if (vc.subStyle) parts.push(vc.subStyle);
  return parts.filter(Boolean).join('，');
}

/** 从分镜描述中提取人物/服饰 */
function extractOutfit(imgDesc) {
  const m = imgDesc.match(/身穿[^，。；]+/);
  return m ? m[0] : '';
}

/** 从分镜描述中提取动作神态 */
function extractAction(imgDesc) {
  const patterns = /(站立|坐着|行走|奔跑|转身|回头|抬头|低头|微笑|哭泣|愤怒|凝视|挥手|拥抱|推门|拿起|放下|轻抿|目光扫过|缓步|快步|驻足|环顾|叹气|皱眉|抿嘴|挑眉|冷眼|瞥了|轻叹|冷笑|淡漠|不屑|兴奋|紧张|匆匆|慢慢|缓缓|突然|猛地)[^，。；]*/g;
  const matches = imgDesc.match(patterns);
  return matches ? matches.join('，') : (imgDesc ? imgDesc.substring(0, 50) : '');
}

/** 整合台词为画面描述 */
function buildDialogueDesc(dialogues, charName) {
  if (!dialogues || dialogues.length === 0) return '';
  return dialogues.map(d => {
    const name = d.characterName || charName || '';
    const txt = d.text || '';
    const act = d.actionHint || '';
    if (act && txt) return `${name}${act}，${txt}`;
    if (act) return `${name}${act}`;
    if (txt) return `${name}："${txt}"`;
    return '';
  }).filter(Boolean).join('；');
}

/**
 * 构建图片提示词（静态画面，无台词/运镜/时长）
 * 格式: [画幅] + [场景+氛围+光影] + [人物+服饰+动作+神态] + [景别+构图+景深] + [画质通用词]
 */
function getAIConfig() { return window.__aiConfig || {}; }

function buildImagePrompt(shot, videoConfig, directorSettings) {
  const aiCfg = getAIConfig();
  const ds = directorSettings || {};
  const aspect = (videoConfig?.aspectRatio === '16:9') ? '横屏16:9' : (videoConfig?.aspectRatio === '4:3' ? '横屏4:3' : (videoConfig?.aspectRatio === '3:4' ? '竖屏3:4' : '竖屏9:16'));
  const scene = [
    shot.sceneName || '',
    (shot._timeOfDay || ''),
    (shot._atmosphere || shot.notes?.match(/氛围:([^ ]+)/)?.[1] || ''),
  ].filter(Boolean).join('，');
  const lighting = shot.lighting || ds.atmosphereLighting || '电影级光影';
  const imgDesc = shot.imageDescription || '';
  const charName = shot.dialogue?.characterName || '';
  const outfit = extractOutfit(imgDesc);
  const action = extractAction(imgDesc);
  // 角色名+服饰合并
  const character = [charName, outfit].filter(Boolean).join('，');
  const shotType = shot.shotType || '中景';
  // composition 避免重复加"构图"
  const compRaw = shot.composition || '';
  const composition = compRaw ? (compRaw.includes('构图') ? compRaw : compRaw + '构图') : '中心构图';
  const styleKeywords = getStyleKeywords(videoConfig);

  const noText = aiCfg.noTextWatermark !== false;
  const ratio = (videoConfig?.aspectRatio === '16:9') ? '横屏16:9' : '竖屏9:16';

  // 画质/风格从导演设定读取，fallback 到 AI 全局配置
  const quality = ds.qualityKeywords || aiCfg.imageQuality || '8K';
  const artStyle = ds.artStyleCommands || styleKeywords || aiCfg.imageStyle || '写实';

  // 绑定主体的描述信息（角色外貌 + 场景描述）
  const boundDescs = (shot._boundDescriptions || []).filter(Boolean);

  const constraintPrefix = noText
    ? '【强约束】画面中严禁出现任何文字、字母、乱码、logo、水印、标题、字幕、签名、符号、海报元素、排版文字，仅保留场景与角色，纯画面，无任何额外元素'
    : '';

  // qualityBlock: 场景+光影+画质+风格+景别+构图
  const qualityBlock = `【画质/构图】${ratio}，${scene || '电影级场景'}，${lighting}，${quality}，${artStyle}，${shotType}，${composition}，焦点清晰，背景虚化`;

  // descBlock: 分镜描述完整 + 角色外貌绑定，去掉与imgDesc重复的action片段和已出现在artStyle中的styleKeywords
  const cleanAction = action && imgDesc.includes(action) ? '' : action; // action已在imgDesc中就不重复
  const descParts = [character, imgDesc, cleanAction, ...boundDescs].filter(Boolean);
  const descBlock = `【场景/角色描述】${descParts.join('，')}`;

  const parts = [constraintPrefix, qualityBlock, descBlock].filter(Boolean);
  return parts.join('；');
}

/**
 * 构建视频提示词（动态画面，含台词/运镜/时长）
 * 格式: [时长+画幅] + [场景+氛围+光影] + [人物+服饰+动作+神态] + [台词] + [景别+构图+运镜] + [画质通用词]
 */
function buildVideoPrompt(shot, videoConfig, directorSettings) {
  const ds = directorSettings || {};
  const aspect = (videoConfig?.aspectRatio === '16:9') ? '横屏16:9' : (videoConfig?.aspectRatio === '4:3' ? '横屏4:3' : (videoConfig?.aspectRatio === '3:4' ? '竖屏3:4' : '竖屏9:16'));
  const duration = shot.duration || 3;
  const scene = shot.sceneName || '';
  const timeOfDay = shot._timeOfDay || '';
  const atmosphere = shot._atmosphere || '';
  const lighting = shot.lighting || ds.atmosphereLighting || '电影级光影';
  const imgDesc = shot.imageDescription || '';
  const shotType = shot.shotType || '中景';
  const compRaw = shot.composition || '';
  const composition = compRaw ? (compRaw.includes('构图') ? compRaw : compRaw + '构图') : '中心构图';
  const camMove = shot.cameraMovement && shot.cameraMovement !== '固定' ? `${shot.cameraMovement}镜头` : '固定镜头';
  const styleKeywords = getStyleKeywords(videoConfig);
  const aiCfg = getAIConfig();

  // 画质/风格
  const quality = ds.qualityKeywords || '电影级画质，8K高清';
  const artStyle = ds.artStyleCommands || styleKeywords || '写实';
  const noReal = aiCfg.noRealPerson;
  const qualitySuffix = noReal
    ? `${quality}，动漫/古风/风格化表现，非写实人物`
    : `${quality}，${artStyle}`;

  // 完整台词（含动作提示和角色名）
  const dialogues = shot._dialogues || [];
  const dialogueLines = dialogues.map(d => {
    const name = d.characterName || '';
    const txt = d.text || '';
    const act = d.actionHint || '';
    if (!name && !txt) return '';
    let line = name;
    if (txt) line += '："' + txt + '"';
    if (act) line += '（' + act + '）';
    return line;
  }).filter(Boolean);

  // 构建自然语言叙事描述（去掉标签，节省 Token，Seedance 更懂自然语言）
  const sceneSetup = [timeOfDay, scene].filter(Boolean).join('，');
  const atmosphereDesc = atmosphere || '';
  const actionDesc = imgDesc || (shot.dialogue?.text ? shot.dialogue.characterName + '的戏份' : '');

  const parts = [
    `${duration}秒${aspect}短视频`,
    sceneSetup || '',
    atmosphereDesc ? `${atmosphereDesc}的氛围` : '',
    `${shotType}镜头，${composition}，${camMove}`,
    lighting,
    actionDesc || '',
    dialogueLines.length > 0 ? `台词：${dialogueLines.join('；')}` : '',
    qualitySuffix,
  ].filter(Boolean);

  return parts.join('，');
}

/**
 * 从分镜管理场景数据批量构建故事板镜头
 * @param {Array} scenes - 剧本 scenes 数组
 * @param {Object} videoConfig - 项目视频配置
 * @returns {Array} 故事板 shots 数组
 */
export function buildShotsFromScenes(scenes, videoConfig, noSubtitles = false, directorSettings = null, allAssets = []) {
  if (!scenes || scenes.length === 0) return [];
  const subtitleBlock = noSubtitles ? '，无字幕' : '';
  const VALID_SHOT_TYPES = ['远景', '全景', '中景', '近景', '特写', '大特写', '微距'];
  const VALID_CAM_MOVES = ['固定', '推镜', '拉镜', '平移', '摇镜', '跟镜', '升降', '希区柯克变焦', '变速推近'];

  return scenes.map(s => {
    const imgDesc = s.sceneDescription || '';
    const dialogues = s.dialogues || [];
    const charName = dialogues[0]?.characterName || (s.characters || [])[0] || '';
    const text = dialogues[0]?.text || '';
    const action = extractAction(imgDesc);
    const outfit = extractOutfit(imgDesc);

    const st = s.shotType || '中景';
    const shotType = VALID_SHOT_TYPES.includes(st) ? st : '中景';
    const cm = s.cameraMovement || '固定';
    const cameraMovement = VALID_CAM_MOVES.includes(cm) ? cm : '固定';

    const shot = {
      shotNumber: s.sceneNumber,
      sceneName: s.location || '',
      _timeOfDay: s.timeOfDay || '',
      _atmosphere: s.atmosphere || '',
      shotType,
      composition: s.composition || '',
      cameraMovement,
      lighting: s.lighting || '',
      duration: s.duration || 3,
      imageDescription: imgDesc,
      soundEffect: s.soundEffect || '',
      dialogue: { characterName: charName, text },
      _dialogues: dialogues,
      notes: `氛围:${s.atmosphere || ''} 人物:${(s.characters || []).join('、')}`,
      status: 'pending',
      _imagePrompt: '',
      _videoPrompt: '',
      boundSubjects: s.boundSubjects || [],
    };

    // 构建绑定主体的描述列表（角色外貌 + 场景描述，用于提示词增强）
    if (s.boundSubjects && s.boundSubjects.length > 0 && allAssets.length > 0) {
      const descs = [];
      s.boundSubjects.forEach(id => {
        const a = allAssets.find(x => x._id === id);
        if (a) {
          if (a.name) descs.push(`${a.name}：${a.appearance || a.morphs?.[0]?.appearancePrompt || ''}`.trim());
          else if (a.sceneName) descs.push(`${a.sceneName}：${a.description || ''}`.trim());
        }
      });
      shot._boundDescriptions = descs.filter(d => d.includes('：'));
    } else {
      shot._boundDescriptions = [];
    }

    shot._imagePrompt = buildImagePrompt(shot, videoConfig, directorSettings);
    shot._videoPrompt = buildVideoPrompt(shot, videoConfig, directorSettings) + subtitleBlock;

    return shot;
  });
}

export { buildImagePrompt, buildVideoPrompt, getStyleKeywords };
