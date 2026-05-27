import { defineStore } from 'pinia';
import { assetAPI } from '../api';

export const useAssetStore = defineStore('asset', {
  state: () => ({
    characters: [],
    scenes: [],
    props: [],
    currentCharacter: null,
    loading: false,
  }),
  actions: {
    async fetchCharacters(projectId) {
      this.loading = true;
      try {
        const res = await assetAPI.listCharacters(projectId);
        this.characters = res.data;
      } finally {
        this.loading = false;
      }
    },
    async createCharacter(data) {
      const res = await assetAPI.createCharacter(data);
      this.characters.push(res.data);
      return res.data;
    },
    async updateCharacter(id, data) {
      const res = await assetAPI.updateCharacter(id, data);
      const idx = this.characters.findIndex(c => c._id === id);
      if (idx > -1) this.characters[idx] = res.data;
      return res.data;
    },
    async deleteCharacter(id) {
      await assetAPI.deleteCharacter(id);
      this.characters = this.characters.filter(c => c._id !== id);
    },
    async fetchScenes(projectId) {
      const res = await assetAPI.listScenes(projectId);
      this.scenes = res.data;
    },
    async createScene(data) {
      const res = await assetAPI.createScene(data);
      this.scenes.push(res.data);
      return res.data;
    },
    async deleteScene(id) {
      await assetAPI.deleteScene(id);
      this.scenes = this.scenes.filter(s => s._id !== id);
    },
    async fetchProps(projectId) {
      const res = await assetAPI.listProps(projectId);
      this.props = res.data;
    },
    async createProp(data) {
      const res = await assetAPI.createProp(data);
      this.props.push(res.data);
      return res.data;
    },
    async deleteProp(id) {
      await assetAPI.deleteProp(id);
      this.props = this.props.filter(p => p._id !== id);
    },
  },
});
