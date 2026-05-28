const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const { buildStyleInfo } = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'creating_characters';
  state.currentStep = 3;
  emitProgress(state, '正在塑造角色人设，赋予人物灵魂...');

  const styleInfo = buildStyleInfo(state);
  const systemPrompt = prompts.character.system;
  const userPrompt = prompts.character.userTemplate(state.outline, state.creativeBrief, styleInfo);

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 100000, responseFormat: 'json' });
    state.characters = JSON.parse(res);
    const names = (state.characters || []).map(c => c.name).join('、');
    emitProgress(state, `角色塑造完成：${names || '未提取到角色'}`);
  } catch (e) {
    emitProgress(state, '角色塑造失败: ' + e.message, 'error');
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
