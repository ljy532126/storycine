<template>
  <div class="ws-root">
    <div class="ws-steps">
      <div
        v-for="(s, i) in steps"
        :key="s.key"
        :class="['ws-step', { active: activeStep === s.key, done: i < activeIndex }]"
        @click="switchStep(s.key)"
      >
        <div class="ws-step-circle">
          <span v-if="i < activeIndex" class="ws-step-check">✓</span>
          <span v-else>{{ i + 1 }}</span>
        </div>
        <span class="ws-step-label">{{ s.label }}</span>
        <div v-if="i < steps.length - 1" class="ws-step-line"></div>
      </div>
    </div>

    <div class="ws-content" :key="activeStep">
      <component :is="currentComponent" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, provide, markRaw, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();

const steps = [
  { key: 'script-generate', label: '剧本工坊' },
  { key: 'script-edit', label: '分镜台本' },
  { key: 'assets', label: '演员库' },
  { key: 'storyboard', label: '镜头板' },
  { key: 'composition', label: '剪辑室' },
];

const STORAGE_KEY = 'ws_active_step_' + (() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').username || 'default'; } catch { return 'default'; }
})();

const validKeys = steps.map(s => s.key);

function getActiveStep() {
  const wsFromUrl = route.query.ws;
  if (wsFromUrl && validKeys.includes(wsFromUrl)) return wsFromUrl;
  const saved = localStorage.getItem(STORAGE_KEY);
  return validKeys.includes(saved) ? saved : 'script-generate';
}
const activeStep = ref(getActiveStep());
const activeIndex = computed(() => steps.findIndex(s => s.key === activeStep.value));

const loaded = {};
function getComponent(key) {
  if (!loaded[key]) {
    const map = {
      'script-generate': () => import('./ScriptGenerate.vue'),
      'script-edit': () => import('./ScriptEdit.vue'),
      'assets': () => import('./AssetManager.vue'),
      'storyboard': () => import('./StoryboardView.vue'),
      'composition': () => import('./CompositionView.vue'),
    };
    loaded[key] = markRaw(defineAsyncComponent(map[key]));
  }
  return loaded[key];
}
const currentComponent = computed(() => getComponent(activeStep.value));

function switchStep(key) {
  activeStep.value = key;
  localStorage.setItem(STORAGE_KEY, key);
}

// 子页面切换项目时自动回到剧本工坊，避免新片场空跳转
provide('resetToScriptGenerate', (projectId) => {
  if (!projectId) return;
  // 同步设置 store.currentProject 为临时对象，保证 ScriptGenerate.onActivated 能立即检测到变化
  projectStore.currentProject = { _id: projectId, name: '...' };
  projectStore.lastProjectId = projectId;
  try { localStorage.setItem('autodrama_last_project', projectId); } catch {}
  if (activeStep.value !== 'script-generate') {
    activeStep.value = 'script-generate';
    localStorage.setItem(STORAGE_KEY, 'script-generate');
  }
});

watch(activeStep, (key) => {
  if (route.query.ws !== key) router.replace({ query: { ...route.query, ws: key } });
});

// keep-alive: URL 变化时同步 tab
watch(() => route.query.ws, (ws) => {
  if (ws && validKeys.includes(ws) && ws !== activeStep.value) {
    activeStep.value = ws;
    localStorage.setItem(STORAGE_KEY, ws);
  }
});

onMounted(() => {
  if (route.query.ws && validKeys.includes(route.query.ws)) {
    activeStep.value = route.query.ws;
    localStorage.setItem(STORAGE_KEY, route.query.ws);
  }
});
</script>

<style scoped>
.ws-root { display: flex; flex-direction: column; height: 100%; min-height: calc(100vh - 120px); }

.ws-steps {
  display: flex; align-items: center; justify-content: center;
  padding: 16px 24px; margin-bottom: 8px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  flex-shrink: 0; overflow-x: auto;
}
.ws-step {
  display: flex; align-items: center; gap: 0;
  cursor: pointer; user-select: none; position: relative; flex-shrink: 0;
}
.ws-step-circle {
  width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
  border: 2px solid var(--bg-300); background: var(--bg-100); color: var(--text-200);
  transition: all 0.25s; z-index: 1;
}
.ws-step.active .ws-step-circle {
  border-color: var(--gold); background: var(--gold); color: #fff;
  box-shadow: 0 0 12px rgba(201,168,76,0.3);
}
.ws-step.done .ws-step-circle {
  border-color: #67c23a; background: #67c23a; color: #fff;
}
.ws-step-check { font-size: 14px; }

.ws-step-label {
  font-size: 13px; font-weight: 600; color: var(--text-200); white-space: nowrap;
  padding: 0 4px 0 8px; transition: color 0.2s;
}
.ws-step.active .ws-step-label { color: var(--gold-dark); }
.ws-step.done .ws-step-label { color: #67c23a; }

.ws-step-line {
  width: 36px; height: 2px; background: var(--bg-300);
  margin: 0 8px; flex-shrink: 0; transition: background 0.3s;
}
.ws-step.done .ws-step-line { background: #67c23a; }

.ws-step:hover .ws-step-circle { border-color: var(--gold); }

.ws-content { flex: 1; min-height: 0; }

@media (max-width: 768px) {
  .ws-steps { justify-content: flex-start; padding: 10px 14px; }
  .ws-step-line { width: 18px; margin: 0 4px; }
  .ws-step-label { font-size: 11px; padding: 0 2px 0 6px; }
  .ws-step-circle { width: 28px; height: 28px; font-size: 11px; }
}
</style>
