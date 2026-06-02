import { defineStore } from 'pinia';
import { scriptAPI } from '../api';

export const useScriptStore = defineStore('script', {
  state: () => ({
    scripts: [],
    currentScript: null,
    generating: false,
    generationStatus: '',
    loading: false,
    // 持久化进度状态（跨路由切换不丢失）
    progressStep: 0,
    progressMessages: {},
    genLogLines: [],
    flowType: 'generate',
    genProjectId: '',
  }),
  actions: {
    async fetchScripts(projectId) {
      this.loading = true;
      try { const res = await scriptAPI.list(projectId); this.scripts = res.data; }
      finally { this.loading = false; }
    },
    async fetchScript(id) {
      const res = await scriptAPI.get(id);
      this.currentScript = res.data;
      return res.data;
    },
    async updateScript(id, data) {
      const res = await scriptAPI.update(id, data);
      if (this.currentScript?._id === id) this.currentScript = res.data;
      return res.data;
    },
    async aiGenerate(projectId, tags) {
      this.generating = true;
      this.generationStatus = '已提交';
      this.progressStep = 0;
      this.progressMessages = {};
      this.genLogLines = [];
      this.flowType = 'generate';
      this.genProjectId = projectId;
      try { const res = await scriptAPI.aiGenerate({ projectId, tags }); return res; }
      finally {}
    },
    async continueScript(projectId, episodeId, continueCount) {
      this.generating = true;
      this.progressStep = 0;
      this.progressMessages = {};
      this.genLogLines = [];
      this.flowType = 'continue';
      this.genProjectId = projectId;
      try { const res = await scriptAPI.continue({ projectId, episodeId, continueCount }); return res; }
      finally {}
    },
    async importScript(projectId, fileContent, fileType, episodeTitle) {
      const res = await scriptAPI.import({ projectId, fileContent, fileType, episodeTitle });
      this.scripts.push(res.data);
      return res.data;
    },
    async storyToScript(projectId, storyContent, episodeTitle) {
      const res = await scriptAPI.storyToScript({ projectId, storyContent, episodeTitle });
      this.scripts.push(res.data);
      return res.data;
    },
    setGenerationComplete() {
      this.generating = false;
      this.generationStatus = '完成';
      this.progressStep = 7;
      this.progressMessages[7] = '完成';
    },
    setGenerationError() {
      this.generating = false;
      this.generationStatus = '失败';
    },
    addGenLog(msg, level) {
      const now = new Date();
      const time = now.toLocaleTimeString('zh-CN', { hour12: false });
      this.genLogLines.push({ time, msg, level: level || 'info' });
    },
    clearGenState() {
      this.progressStep = 0;
      this.progressMessages = {};
      this.genLogLines = [];
      this.flowType = 'generate';
      this.genProjectId = '';
    },
  },
});
