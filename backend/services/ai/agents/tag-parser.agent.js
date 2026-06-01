const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'parsing_tags';
  state.currentStep = 1;
  emitProgress(state, '正在解析创作标签，理解故事方向...');

  const systemPrompt = prompts.tagParser.system;
  const userPrompt = prompts.tagParser.userTemplate(state.userTags);

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000, responseFormat: 'json' });
    state.creativeBrief = JSON.parse(res);
    emitProgress(state, '标签解析完成，已生成创作纲要');
  } catch (e) {
    emitProgress(state, '标签解析失败: ' + e.message, 'error');
    throw e;
  }
  return state;
}

function emitProgress(state, message, level = 'info') {
  console.log(`[${state.status}] ${message}`);
  socketRegistry.emitToProject(state.projectId, 'script-generation-progress', {
    step: state.currentStep,
    totalSteps: 7,
    status: state.status,
    message,
    level,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { run };
