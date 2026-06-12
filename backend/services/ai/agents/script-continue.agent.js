const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const { buildStyleInfo } = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'continuing_script';
  state.currentStep = 5;

  const historyScripts = state.historyScripts || [];
  const targetEpisode = state.targetEpisode || state.episodeNumber;
  const totalEpisodes = state.totalEpisodes || 30;

  // 检测剧集间隙
  const gapInfo = detectGaps(historyScripts, targetEpisode);
  const isFinalEpisode = targetEpisode >= totalEpisodes;
  const remainingEpisodes = Math.max(0, totalEpisodes - targetEpisode);

  if (isFinalEpisode) {
    emitProgress(state, `正在续写最终结局（第${targetEpisode}/${totalEpisodes}集）...`);
  } else if (remainingEpisodes <= 3) {
    emitProgress(state, `正在续写（还剩${remainingEpisodes}集完结）...`);
  } else if (gapInfo) {
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

  // 间隙衔接
  if (gapInfo) {
    userPrompt += `\n\n【重要】${gapInfo}\n请在本集中自然过渡，通过角色对话或内心独白简要交代跳过的剧情，确保观众理解故事发展。`;
  }

  // 完结控制：最后3集注入收敛提示
  if (remainingEpisodes <= 3 || isFinalEpisode) {
    const endingGuidance = isFinalEpisode
      ? '【大结局】这是全剧最后一集！必须：1）所有主线伏笔回收 2）角色命运交代清楚 3）主题升华点题 4）情感高潮后给一个有力且余味悠长的结尾 5）可选：隐藏反转/开放式结局增加传播性'
      : `【接近尾声】还剩${remainingEpisodes}集完结。本集需：1）收束至少一条副线 2）为最终结局铺垫情感高潮 3）减少新人物/新事件引入 4）整体节奏加快`;
    userPrompt += `\n\n${endingGuidance}`;
  }

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 16000, responseFormat: 'json' });
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
