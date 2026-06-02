import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
});

// 自动携带 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      const msg = err.response?.data?.message || '登录已过期';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        // 存下原因，登录页取出来展示
        try { sessionStorage.setItem('logout_reason', msg); } catch {}
        window.location.href = '/login';
      }
    }
    const msg = err.response?.data?.message || err.message || '请求失败';
    console.error('API Error:', msg);
    return Promise.reject(err);
  }
);

export default api;

// ===== 项目 =====
export const projectAPI = {
  list: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
};

// ===== 剧本 =====
export const scriptAPI = {
  list: (projectId) => api.get('/scripts', { params: { projectId } }),
  get: (id) => api.get(`/scripts/${id}`),
  update: (id, data) => api.put(`/scripts/${id}`, data),
  aiGenerate: (data) => api.post('/scripts/ai-generate', data),
  continue: (data) => api.post('/scripts/continue', data),
  import: (data) => api.post('/scripts/import', data),
  storyToScript: (data) => api.post('/scripts/story-to-script', data),
  createEmpty: (data) => api.post('/scripts/create-empty', data),
  delete: (id) => api.delete(`/scripts/${id}`),
  batchDelete: (ids) => api.post('/scripts/batch-delete', { ids }),
};

// ===== 资产 =====
export const assetAPI = {
  // 角色
  listCharacters: (projectId) => api.get('/assets/characters', { params: { projectId } }),
  getCharacter: (id) => api.get(`/assets/characters/${id}`),
  createCharacter: (data) => api.post('/assets/characters', data),
  updateCharacter: (id, data) => api.put(`/assets/characters/${id}`, data),
  deleteCharacter: (id) => api.delete(`/assets/characters/${id}`),
  batchDeleteCharacters: (ids) => api.post('/assets/characters/batch-delete', { ids }),
  uploadCharacterImage: (id, file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post(`/assets/characters/${id}/upload-image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  // 场景
  listScenes: (projectId) => api.get('/assets/scenes', { params: { projectId } }),
  createScene: (data) => api.post('/assets/scenes', data),
  updateScene: (id, data) => api.put(`/assets/scenes/${id}`, data),
  deleteScene: (id) => api.delete(`/assets/scenes/${id}`),
  batchDeleteScenes: (ids) => api.post('/assets/scenes/batch-delete', { ids }),
  // 道具
  listProps: (projectId) => api.get('/assets/props', { params: { projectId } }),
  createProp: (data) => api.post('/assets/props', data),
  updateProp: (id, data) => api.put(`/assets/props/${id}`, data),
  deleteProp: (id) => api.delete(`/assets/props/${id}`),
  batchDeleteProps: (ids) => api.post('/assets/props/batch-delete', { ids }),
  // 批量提取
  extractAll: (scriptId, projectId) => api.post('/assets/extract-all', { scriptId, projectId }),
  // 提示词生成
  generatePrompt: (data) => api.post('/assets/generate-prompt', data),
  // 图片生成
  generateImage: (data) => api.post('/assets/generate-image', data),
};

// ===== 分镜 =====
export const storyboardAPI = {
  list: (params) => api.get('/storyboards', { params }),
  get: (id) => api.get(`/storyboards/${id}`),
  update: (id, data) => api.put(`/storyboards/${id}`, data),
  autoGenerate: (data) => api.post('/storyboards/auto-generate', data),
  batchUpdateShots: (id, data) => api.put(`/storyboards/${id}/shots/batch`, data),
  updateShot: (id, shotNumber, data) => api.put(`/storyboards/${id}/shots/${shotNumber}`, data),
  optimizeRhythm: (shots) => api.post('/storyboards/optimize-rhythm', { shots }),
  importData: (id, data, format) => api.post(`/storyboards/${id}/import`, { data, format }),
};

// ===== 配置 =====
export const configAPI = {
  getLLMConfig: () => api.get('/config/llm'),
  updateLLMConfig: (data) => api.put('/config/llm', data),
  getLLMStatus: () => api.get('/config/llm/status'),
  testLLMConnection: (data) => api.post('/config/llm/test', data),
  // TTS
  getTTSConfig: () => api.get('/config/tts'),
  updateTTSConfig: (data) => api.put('/config/tts', data),
  testTTSConnection: (data) => api.post('/config/tts/test', data),
};

// ===== TTS 配音 =====
export const ttsAPI = {
  synthesize: (data) => api.post('/tts/synthesize', data),
  batchSynthesize: (data) => api.post('/tts/batch-synthesize', data),
  getLibrary: (params) => api.get('/tts/library', { params }),
  deleteAudio: (id) => api.delete(`/tts/library/${id}`),
  batchDelete: (ids) => api.post('/tts/library/batch-delete', { ids }),
  batchDownload: (ids) => api.post('/tts/library/batch-download', { ids }, { responseType: 'blob' }),
};

// ===== 合成 =====
export const compositionAPI = {
  list: (projectId) => api.get('/compositions', { params: { projectId } }),
  get: (id) => api.get(`/compositions/${id}`),
  create: (data) => api.post('/compositions', data),
  getProgress: (id) => api.get(`/compositions/${id}/progress`),
  cancel: (id) => api.post(`/compositions/${id}/cancel`),
};
