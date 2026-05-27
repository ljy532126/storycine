const Script = require('../models/script.model');

/**
 * 将TXT/Word文本解析为结构化场次
 * @param {string} content - 原始文本内容
 * @param {string} fileType - 文件类型 (txt/word)
 * @returns {Array} 结构化场次数组
 */
function parseScriptToStructure(content, fileType) {
  const scenes = [];
  let currentScene = null;

  const lines = content.split('\n');

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    const sceneMatch = line.match(/场次[：:]\s*(\d+)|第(\d+)场/);
    if (sceneMatch) {
      if (currentScene) scenes.push(currentScene);
      currentScene = {
        sceneNumber: parseInt(sceneMatch[1] || sceneMatch[2]),
        timeOfDay: '白天',
        location: '',
        characters: [],
        atmosphere: '',
        sceneDescription: '',
        dialogues: [],
      };
      return;
    }

    if (!currentScene) return;

    if (line.startsWith('时间')) {
      currentScene.timeOfDay = line.split(/[：:]/)[1]?.trim() || '白天';
    } else if (line.startsWith('地点')) {
      currentScene.location = line.split(/[：:]/)[1]?.trim() || '';
    } else if (line.startsWith('人物')) {
      currentScene.characters = line.split(/[：:]/)[1]?.split(/[,，、]/).map(s => s.trim()).filter(Boolean) || [];
    } else if (line.startsWith('氛围')) {
      currentScene.atmosphere = line.split(/[：:]/)[1]?.trim() || '';
    } else if (/^[^\s：:]+[：:]/.test(line)) {
      const colonIndex = line.search(/[：:]/);
      const name = line.substring(0, colonIndex).trim();
      const text = line.substring(colonIndex + 1).trim();
      currentScene.dialogues.push({
        characterName: name,
        text: text,
        actionHint: '',
        innerThought: '',
        cameraHint: '',
      });
    } else {
      currentScene.sceneDescription += line + '\n';
    }
  });

  if (currentScene) scenes.push(currentScene);

  return scenes.map(s => ({
    ...s,
    sceneDescription: s.sceneDescription.trim(),
  }));
}

/**
 * 获取项目所有历史剧本用于续写上下文
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
async function getProjectScriptHistory(projectId) {
  return Script.find({ projectId })
    .sort({ episodeNumber: 1 })
    .select('episodeNumber episodeTitle summary scenes')
    .lean();
}

module.exports = { parseScriptToStructure, getProjectScriptHistory };
