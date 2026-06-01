const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const { buildStyleInfo } = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'generating_outline';
  state.currentStep = 2;
  emitProgress(state, '正在生成故事大纲，构思剧情走向...');

  const styleInfo = buildStyleInfo(state);
  const systemPrompt = prompts.outline.system;
  const userPrompt = prompts.outline.userTemplate(state.creativeBrief, styleInfo);

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 8000, responseFormat: 'json' });
    state.outline = JSON.parse(res);
    emitProgress(state, `大纲生成完成：${state.outline?.title || '未命名'}，共 ${state.outline?.episodes?.length || 0} 集`);
  } catch (e) {
    emitProgress(state, '大纲生成失败: ' + e.message, 'error');
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
