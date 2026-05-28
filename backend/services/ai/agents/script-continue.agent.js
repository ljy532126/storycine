const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const { buildStyleInfo } = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'continuing_script';
  state.currentStep = 5;

  const historyScripts = state.historyScripts || [];
  const targetEpisode = state.targetEpisode || state.episodeNumber;

  // 检测剧集间隙
  const gapInfo = detectGaps(historyScripts, targetEpisode);
  if (gapInfo) {
    emitProgress(state, `检测到剧集间隙: ${gapInfo}，AI 将自动补全衔接`, 'warning');
  } else {
    emitProgress(state, '正在续写剧本，承接前文剧情...');
  }

  const systemPrompt = prompts.scriptContinue.system;
  const styleInfo = buildStyleInfo(state);
  let userPrompt = prompts.scriptContinue.userTemplate(
    historyScripts,
    targetEpisode,
    state.characters,
    state.plotStructure,
    styleInfo
  );

  // 如果有间隙，注入衔接提示
  if (gapInfo) {
    userPrompt += `\n\n【重要】${gapInfo}\n请在本集中自然过渡，通过角色对话或内心独白简要交代跳过的剧情，确保观众理解故事发展。`;
  }

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 4096, responseFormat: 'json' });
    state.script = JSON.parse(res);
    const sceneCount = state.script?.scenes?.length || 0;
    emitProgress(state, `续写完成：${sceneCount} 场次`);
  } catch (e) {
    emitProgress(state, '续写失败: ' + e.message, 'error');
    throw e;
  }
  return state;
}

/**
 * 检测剧集编号是否有间隙
 * @returns {string|null} 间隙描述，无间隙则返回 null
 */
function detectGaps(scripts, targetEpisode) {
  if (!scripts || scripts.length === 0) return null;

  const episodes = scripts.map(s => s.episodeNumber).sort((a, b) => a - b);
  const lastEpisode = episodes[episodes.length - 1];

  // 目标续写集与前一个最大集号之间有差距
  if (targetEpisode - lastEpisode > 1) {
    return `剧集从第${lastEpisode}集跳到第${targetEpisode}集，中间第${lastEpisode + 1}到${targetEpisode - 1}集缺失`;
  }

  // 检查现有剧集之间是否有间隙
  for (let i = 1; i < episodes.length; i++) {
    if (episodes[i] - episodes[i - 1] > 1) {
      return `第${episodes[i - 1]}集和第${episodes[i]}集之间缺少第${episodes[i - 1] + 1}到${episodes[i] - 1}集`;
    }
  }

  return null;
}

function emitProgress(state, message, level = 'info') {
  console.log(`[${state.status}] ${message}`);
  socketRegistry.emitToProject(state.projectId, 'script-generation-progress', {
    step: state.currentStep, totalSteps: 7, status: state.status, message, level, timestamp: new Date().toISOString(),
  });
}

module.exports = { run };
