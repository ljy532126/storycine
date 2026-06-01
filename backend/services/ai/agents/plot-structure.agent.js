const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'architecting_plot';
  state.currentStep = 4;
  emitProgress(state, '正在规划剧情架构，设计起承转合...');

  const systemPrompt = prompts.plotStructure.system;
  const userPrompt = prompts.plotStructure.userTemplate(state.outline, state.characters);

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 4000, responseFormat: 'json' });
    state.plotStructure = JSON.parse(res);
    emitProgress(state, '剧情架构规划完成');
  } catch (e) {
    emitProgress(state, '剧情架构规划失败: ' + e.message, 'error');
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
