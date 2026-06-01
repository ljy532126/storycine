const { StateGraph } = require('@langchain/langgraph');
const tagParserAgent = require('./agents/tag-parser.agent');
const outlineAgent = require('./agents/outline.agent');
const characterAgent = require('./agents/character.agent');
const plotStructureAgent = require('./agents/plot-structure.agent');
const scriptWriterAgent = require('./agents/script-writer.agent');
const scriptValidatorAgent = require('./agents/script-validator.agent');
const scriptContinueAgent = require('./agents/script-continue.agent');

const workflowState = {
  userTags: {},
  creativeBrief: null,
  outline: null,
  characters: [],
  plotStructure: null,
  script: null,
  validationErrors: [],
  validationWarnings: [],
  validationScore: 0,
  validationPassed: false,
  lastValidationFeedback: '',
  retryCount: 0,
  status: 'idle',
  projectId: '',
  episodeNumber: 1,
  historyScripts: [],
  targetEpisode: 1,
};

/**
 * 构建剧本生成工作流图
 * 流程: 标签解析 → 大纲 → 人物 → 剧情架构 → 剧本撰写 → 剧本校验
 * 校验不通过 → 回退到剧本撰写重试（最多3次）
 */
function buildScriptGenerationGraph() {
  const graph = new StateGraph({ channels: workflowState });

  graph.addNode('tag_parser', tagParserAgent.run);
  graph.addNode('outline_generator', outlineAgent.run);
  graph.addNode('character_creator', characterAgent.run);
  graph.addNode('plot_architect', plotStructureAgent.run);
  graph.addNode('script_writer', scriptWriterAgent.run);
  graph.addNode('script_validator', scriptValidatorAgent.run);

  graph.addEdge('tag_parser', 'outline_generator');
  graph.addEdge('outline_generator', 'character_creator');
  graph.addEdge('character_creator', 'plot_architect');
  graph.addEdge('plot_architect', 'script_writer');
  graph.addEdge('script_writer', 'script_validator');

  graph.addConditionalEdges('script_validator', async (state) => {
    if (state.validationPassed && state.validationErrors.length === 0) return '__end__';
    if (state.retryCount < 3) {
      // 重试前退避，避免连续打 LLM
      const delay = 2000 * (state.retryCount + 1);
      console.log(`[langgraph] 校验未通过，${delay/1000}s 后重试 (${state.retryCount + 1}/3)`);
      await new Promise(r => setTimeout(r, delay));
      return 'script_writer';
    }
    return '__end__';
  });

  graph.setEntryPoint('tag_parser');
  return graph.compile();
}

/**
 * 构建剧本续写工作流图
 * 流程: 续写 → 校验
 * 校验不通过 → 回退续写重试（最多3次）
 */
function buildScriptContinueGraph() {
  const graph = new StateGraph({ channels: workflowState });

  graph.addNode('script_continue', scriptContinueAgent.run);
  graph.addNode('script_validator', scriptValidatorAgent.run);

  graph.addEdge('script_continue', 'script_validator');

  graph.addConditionalEdges('script_validator', (state) => {
    if (state.validationErrors.length === 0 || state.validationPassed) return '__end__';
    if (state.retryCount < 3) return 'script_continue';
    return '__end__';
  });

  graph.setEntryPoint('script_continue');
  return graph.compile();
}

module.exports = { buildScriptGenerationGraph, buildScriptContinueGraph };
