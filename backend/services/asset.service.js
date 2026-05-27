const Character = require('../models/character.model');
const SceneAsset = require('../models/scene.model');
const Prop = require('../models/prop.model');

/**
 * 构建角色外貌映射表，用于生图时注入角色描述
 * @param {string} projectId
 * @returns {Promise<Object>} { 角色名: 角色对象 }
 */
async function buildCharacterMap(projectId) {
  const characters = await Character.find({ projectId }).lean();
  const map = {};
  characters.forEach(c => {
    map[c.name] = c;
  });
  return map;
}

/**
 * 为分镜镜头注入角色外貌描述，确保生图角色一致性
 * @param {string} prompt - 原始图像描述
 * @param {Object} characterMap - 角色映射表
 * @returns {string} 增强后的prompt
 */
function buildShotPrompt(prompt, characterMap) {
  let enhancedPrompt = prompt;

  Object.entries(characterMap).forEach(([name, character]) => {
    if (enhancedPrompt.includes(name)) {
      const morph = character.morphs?.[0];
      enhancedPrompt += `，${name}的外貌：${character.appearance}`;
      if (morph?.referenceImage) {
        enhancedPrompt += `，参考图：${morph.referenceImage}`;
      }
    }
  });

  return enhancedPrompt;
}

/**
 * 批量创建角色
 * @param {string} projectId
 * @param {Array} characters - AI生成的角色数组
 * @returns {Promise<Array>}
 */
async function batchCreateCharacters(projectId, characters) {
  const results = [];
  for (const char of characters) {
    try {
      const existing = await Character.findOne({ projectId, name: char.name });
      if (!existing) {
        const created = await Character.create({
          projectId,
          name: char.name,
          age: char.age || 0,
          gender: char.gender || '其他',
          appearance: char.appearance || '',
          personality: char.personality || '',
          background: char.background || '',
          relationships: char.relationships || '',
          weakness: char.weakness || '',
          goal: char.goal || '',
          tags: char.tags || [],
          roleType: char.role_type || '配角',
        });
        results.push(created);
      } else {
        results.push(existing);
      }
    } catch (err) {
      console.error(`Failed to create character ${char.name}:`, err.message);
    }
  }
  return results;
}

module.exports = { buildCharacterMap, buildShotPrompt, batchCreateCharacters };
