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
    const res = await callLLM(systemPrompt, userPrompt, { temperature: 0.9, maxTokens: 16000, responseFormat: 'json' });
    console.log(`[script-writer] LLM response length: ${res.length}, first 200: ${res.substring(0, 200)}`);
    // 容错解析：LLM 可能返回截断/非标准 JSON
    try {
      state.script = JSON.parse(res);
    } catch (parseErr) {
      console.warn('[script-writer] Direct parse failed, trying regex extraction...');
      const m = res.match(/\{[\s\S]*\}/);
      if (m) {
        try { state.script = JSON.parse(m[0]); console.log('[script-writer] Regex extraction succeeded'); } catch { console.warn('[script-writer] Regex extraction also failed'); }
      }
      if (!state.script) {
        const scenesMatch = res.match(/"scenes"\s*:\s*(\[[\s\S]*\])/);
        if (scenesMatch) {
          try { state.script = { scenes: JSON.parse(scenesMatch[1]) }; console.log('[script-writer] Scenes extraction succeeded'); } catch { console.warn('[script-writer] Scenes extraction failed'); }
        }
        if (!state.script) throw parseErr;
      }
    }
    // 检查是否生成了有效内容
    const sceneCount = state.script?.scenes?.length || 0;
    const dialogueCount = (state.script?.scenes || []).reduce((sum, s) => sum + (s.dialogues?.length || 0), 0);
    if (sceneCount === 0) {
      console.error('[script-writer] LLM returned valid JSON but 0 scenes! Full response:', res.substring(0, 500));
      throw new Error('AI 生成失败：模型返回了空剧本，请重试或更换模型提供商');
    }
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
