import { defineStore } from 'pinia';
import { compositionAPI } from '../api';

export const useCompositionStore = defineStore('composition', {
  state: () => ({
    compositions: [],
    currentComposition: null,
    loading: false,
  }),
  actions: {
    async fetchCompositions(projectId) {
      this.loading = true;
      try {
        const res = await compositionAPI.list(projectId);
        this.compositions = res.data;
      } finally {
        this.loading = false;
      }
    },
    async fetchComposition(id) {
      const res = await compositionAPI.get(id);
      this.currentComposition = res.data;
      return res.data;
    },
    async createComposition(data) {
      const res = await compositionAPI.create(data);
      this.compositions.unshift(res.data);
      this.currentComposition = res.data;
      return res.data;
    },
    async getProgress(id) {
      const res = await compositionAPI.getProgress(id);
      return res.data;
    },
    async cancelComposition(id) {
      await compositionAPI.cancel(id);
    },
    async deleteComposition(id) {
      await compositionAPI.delete(id);
      this.compositions = this.compositions.filter(c => c._id !== id);
    },
  },
});
