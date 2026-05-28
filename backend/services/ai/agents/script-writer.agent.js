const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const { buildStyleInfo } = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'writing_script';
  state.currentStep = 5;
  const retryInfo = state.retryCount > 0 ? `（校验反馈修改，第${state.retryCount}次重试）` : '';
  emitProgress(state, `正在撰写剧本内容${retryInfo}...`);

  const episodeNumber = state.episodeNumber || 1;
  const styleInfo = buildStyleInfo(state);
  const systemPrompt = prompts.scriptWriter.system;
  const showInnerThought = state.showInnerThought !== false;
  let userPrompt = prompts.scriptWriter.userTemplate(state.plotStructure, state.characters, episodeNumber, styleInfo, showInnerThought);

  // 如果是重试，注入校验反馈
  if (state.lastValidationFeedback) {
    userPrompt += `\n\n【上次校验反馈，请务必修正以下问题】\n${state.lastValidationFeedback}`;
  }

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.9, maxTokens: 4096, responseFormat: 'json' });
    state.script = JSON.parse(res);
    const sceneCount = state.script?.scenes?.length || 0;
    const dialogueCount = (state.script?.scenes || []).reduce((sum, s) => sum + (s.dialogues?.length || 0), 0);
    emitProgress(state, `剧本撰写完成：${sceneCount} 场次，${dialogueCount} 句台词`);
  } catch (e) {
    emitProgress(state, '剧本撰写失败: ' + e.message, 'error');
    throw e;
  }
  return state;
}

function emitProgress(state, message, level = 'info') {
  console.log(`[${state.status}] ${message}`);
  socketRegistry.emitToProject(state.projectId, 'script-generation-progress', {
    step: state.currentStep, totalSteps: 7, status: state.status, message, level, timestamp: new Date().toISOString(),
  });
}

module.exports = { run };
