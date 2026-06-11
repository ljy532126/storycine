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
    // 容错解析：截断/换行/转义等问题导致 JSON 不完整时，尝试修复
    let validationResult;
    try {
      validationResult = JSON.parse(res);
    } catch (parseErr) {
      // 尝试从回复中提取第一个完整 JSON 对象
      const m = res.match(/\{[\s\S]*\}/);
      if (m) {
        try { validationResult = JSON.parse(m[0]); } catch {}
      }
      if (!validationResult) {
        // 回退：用正则提取关键字段
        const scoreMatch = res.match(/"score"\s*:\s*(\d+)/);
        validationResult = {
          passed: /"passed"\s*:\s*true/i.test(res),
          score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
          errors: [],
          warnings: [],
          summary: 'LLM 返回了非标准JSON，已回退提取评分',
        };
      }
    }

    state.validationErrors = validationResult.errors || [];
    state.validationWarnings = validationResult.warnings || [];
    state.validationScore = validationResult.score || 0;

    if (validationResult.passed || validationResult.score >= 60) {
      state.validationPassed = true;
      emitProgress(state, `校验通过！评分: ${validationResult.score || '?'}/100`);
    } else {
      state.validationPassed = false;
      const errs = validationResult.errors || [];
      const warns = validationResult.warnings || [];
      let feedback;
      if (errs.length > 0) {
        feedback = errs.map(e => e.description).join('; ');
      } else if (warns.length > 0) {
        feedback = warns.map(w => w.description).join('; ');
      } else {
        feedback = validationResult.summary || `评分${validationResult.score}分，需要优化整体质量`;
      }
      state.lastValidationFeedback = feedback;
      state.retryCount = (state.retryCount || 0) + 1;
      if (state.retryCount < 3) {
        emitProgress(state, `校验未通过 (${state.retryCount}/3)，${feedback.substring(0, 80)}，正在回退修改...`, 'warning');
      } else {
        emitProgress(state, `校验达最大重试次数，评分: ${validationResult.score}/100，进入下一步`, 'warning');
        state.validationPassed = true;
      }
    }
  } catch (e) {
    emitProgress(state, '校验调用失败: ' + e.message, 'error');
    state.validationErrors = [{ type: 'system', location: 'validator', description: e.message, suggestion: '检查 LLM 连接或重试' }];
    state.validationScore = 0;
    state.retryCount = (state.retryCount || 0) + 1;
    if (state.retryCount >= 3) {
      state.validationPassed = true;
    } else {
      state.validationPassed = false;
    }
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
