import { defineStore } from 'pinia';
import { storyboardAPI } from '../api';

export const useStoryboardStore = defineStore('storyboard', {
  state: () => ({
    storyboards: [],
    currentStoryboard: null,
    loading: false,
  }),
  actions: {
    async fetchStoryboards(params = {}) {
      this.loading = true;
      try {
        const res = await storyboardAPI.list(params);
        this.storyboards = res.data;
      } finally {
        this.loading = false;
      }
    },
    async fetchStoryboard(id) {
      const res = await storyboardAPI.get(id);
      this.currentStoryboard = res.data;
      return res.data;
    },
    async autoGenerate(scriptId, projectId) {
      const res = await storyboardAPI.autoGenerate({ scriptId, projectId });
      this.storyboards.unshift(res.data);
      this.currentStoryboard = res.data;
      return res.data;
    },
    async updateStoryboard(id, data) {
      const res = await storyboardAPI.update(id, data);
      if (this.currentStoryboard?._id === id) this.currentStoryboard = res.data;
      return res.data;
    },
    async updateShot(storyboardId, shotNumber, data) {
      const res = await storyboardAPI.updateShot(storyboardId, shotNumber, data);
      if (this.currentStoryboard?._id === storyboardId) this.currentStoryboard = res.data;
      return res.data;
    },
    async batchUpdateShots(storyboardId, shotIds, updates) {
      const res = await storyboardAPI.batchUpdateShots(storyboardId, { shotIds, updates });
      if (this.currentStoryboard?._id === storyboardId) this.currentStoryboard = res.data;
      return res.data;
    },
  },
});
