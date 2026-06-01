const { callLLM } = require('../../../utils/llm-client');
const prompts = require('../../../utils/prompt-templates');
const socketRegistry = require('../../../utils/socket-registry');

async function run(state) {
  state.status = 'validating_script';
  state.currentStep = 6;
  emitProgress(state, '正在校验剧本质量，检查漏洞/OOC/格式...');

  const systemPrompt = prompts.scriptValidator.system;
  const userPrompt = prompts.scriptValidator.userTemplate(state.script, state.characters);

  try {
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 4000, responseFormat: 'json' });
    const validationResult = JSON.parse(res);

    state.validationErrors = validationResult.errors || [];
    state.validationWarnings = validationResult.warnings || [];
    state.validationScore = validationResult.score || 0;
    state.validationPassed = validationResult.passed || false;

    if (validationResult.passed) {
      emitProgress(state, `校验通过！评分: ${validationResult.score}/100`);
    } else if (state.retryCount < 3) {
      state.retryCount = (state.retryCount || 0) + 1;
      state.lastValidationFeedback = validationResult.errors.map(e => e.description).join('; ');
      emitProgress(state, `校验未通过 (${state.retryCount}/3)，问题: ${validationResult.errors.length} 个，正在回退修改...`, 'warning');
    } else {
      emitProgress(state, `校验完成（已达最大重试次数），评分: ${validationResult.score}/100，剩余问题: ${validationResult.errors.length} 个`, 'warning');
    }
  } catch (e) {
    emitProgress(state, '校验失败: ' + e.message, 'error');
    state.validationErrors = [{ type: 'system', location: 'validator', description: e.message, suggestion: '检查 LLM 连接或重试' }];
    state.validationPassed = false;
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
