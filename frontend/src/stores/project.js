import { defineStore } from 'pinia';
import { projectAPI } from '../api';

const LS_KEY = 'autodrama_last_project';

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [],
    currentProject: null,
    loading: false,
  }),
  getters: {
    lastProjectId: () => {
      try { return localStorage.getItem(LS_KEY); } catch { return null; }
    },
    currentProjectId: (state) => state.currentProject?._id || null,
  },
  actions: {
    async fetchProjects() {
      this.loading = true;
      try {
        const res = await projectAPI.list();
        this.projects = res.data;
      } finally {
        this.loading = false;
      }
    },
    async fetchProject(id) {
      const res = await projectAPI.get(id);
      this.currentProject = res.data;
      this.rememberProject(id);
      return res.data;
    },
    async createProject(data) {
      const res = await projectAPI.create(data);
      this.projects.unshift(res.data);
      return res.data;
    },
    async updateProject(id, data) {
      const res = await projectAPI.update(id, data);
      const idx = this.projects.findIndex(p => p._id === id);
      if (idx > -1) this.projects[idx] = res.data;
      if (this.currentProject?._id === id) this.currentProject = res.data;
      return res.data;
    },
    async deleteProject(id) {
      const res = await projectAPI.remove(id);
      this.projects = this.projects.filter(p => p._id !== id);
      if (this.currentProject?._id === id) {
        this.currentProject = null;
        this.forgetProject();
      }
      return res.data;
    },
    setCurrentProject(project) {
      this.currentProject = project;
      if (project?._id) this.rememberProject(project._id);
    },
    selectProjectById(id) {
      const p = this.projects.find(x => x._id === id);
      if (p) this.currentProject = p;
    },
    rememberProject(id) {
      try { localStorage.setItem(LS_KEY, id); } catch {}
    },
    forgetProject() {
      try { localStorage.removeItem(LS_KEY); } catch {}
    },
    /** 自动恢复上次选择的项目，不存在则清除记忆 */
    async restoreLastProject() {
      const id = this.lastProjectId;
      if (!id) return null;
      if (this.projects.length === 0) await this.fetchProjects();
      const project = this.projects.find(p => p._id === id);
      if (project) {
        this.currentProject = project;
        return project;
      }
      // 项目不在列表中且 API 也查不到 → 彻底清除
      try {
        return await this.fetchProject(id);
      } catch {
        // 项目已不存在
      }
      this.forgetProject();
      this.currentProject = null;
      return null;
    },
  },
});
