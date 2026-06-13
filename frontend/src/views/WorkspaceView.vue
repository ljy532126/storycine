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
      <ProjectSwitcher v-model="currentProjectId" />
      <div v-if="(activeStep === 'script-edit' || activeStep === 'storyboard') && episodeBar.scripts.length && screenWidth >= 768" class="ws-episode-bar">
        <el-select :model-value="episodeBar.currentScriptId" @update:model-value="episodeBar.select" size="small" class="ws-ep-select" placeholder="选择剧集">
          <el-option v-for="ep in episodeBar.scripts" :key="ep._id" :label="'第'+ep.episodeNumber+'集 '+ (ep.episodeTitle||'未命名')" :value="ep._id" />
        </el-select>
        <el-button v-if="activeStep === 'script-edit'" size="small" text @click="episodeBar.add?.()" title="新建剧集">+ 新建</el-button>
        <el-button v-if="activeStep === 'script-edit'" size="small" text @click="episodeBar.dup?.()" title="复制当前集">⧉ 复制</el-button>
      </div>
      <div v-if="activeStep === 'storyboard' && sbActions.visible" class="ws-sb-actions">
        <el-button size="small" @click="sbActions.save" :loading="sbActions.saving" class="ws-act-btn ws-act-save">保存</el-button>
        <el-button size="small" @click="sbActions.refresh" :disabled="!sbActions.canRefresh" :loading="sbActions.generating" class="ws-act-btn ws-act-refresh">刷新</el-button>
        <el-button size="small" @click="sbActions.del" :disabled="!sbActions.canDelete" :loading="sbActions.deleting" class="ws-act-btn ws-act-del">删除</el-button>
        <el-button size="small" @click="sbActions.export_click" :disabled="!sbActions.canExport" class="ws-act-btn ws-act-export" title="导出">导出</el-button>
        <el-button size="small" @click="sbActions.import_click" :disabled="!sbActions.canImport" class="ws-act-btn ws-act-import" title="导入">导入</el-button>
        <el-divider direction="vertical" style="margin:0 4px;height:18px" />
        <span style="font-size:10px;color:var(--text-200);white-space:nowrap">无字幕</span>
        <el-switch :model-value="sbActions.noSubtitles" @update:model-value="sbActions.setNoSubtitles" size="small" />
      </div>
    </div>

    <div class="ws-content">
      <KeepAlive>
        <component :is="currentComponent" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, provide, markRaw, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import ProjectSwitcher from '../components/ProjectSwitcher.vue';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();

const currentProjectId = ref('');
const screenWidth = ref(window.innerWidth);
window.addEventListener('resize', () => { screenWidth.value = window.innerWidth; });

// 初始化：恢复上次项目
onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  if (restored) currentProjectId.value = restored._id;
});

// 提供给子页面使用
provide('currentProjectId', currentProjectId);

// 分镜台本的剧集栏（由 ScriptEdit 填充）
const episodeBar = reactive({ scripts: [], currentScriptId: '', add: null, dup: null, select: null });
provide('wsEpisodeBar', episodeBar);

// 镜头板快捷操作栏（由 StoryboardView 填充）
const sbActions = reactive({ visible: false, saving: false, generating: false, deleting: false, canRefresh: false, canDelete: false, canExport: false, canImport: false, noSubtitles: true, save: null, refresh: null, del: null, export_click: null, import_click: null, setNoSubtitles: null });
provide('wsSbActions', sbActions);

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
  padding: 5px 12px; margin-bottom: 8px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  flex-shrink: 0; overflow-x: auto; gap: 0; flex-wrap: nowrap;
}
.ws-steps :deep(.ps-root) { margin-left: auto; }
.ws-steps :deep(.ps-label) { font-size: 10px; letter-spacing: 0.5px; }
.ws-steps :deep(.ps-select) { width: 130px; }
.ws-step {
  display: flex; align-items: center; gap: 0;
  cursor: pointer; user-select: none; position: relative; flex-shrink: 0;
}
.ws-step-circle {
  width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
  border: 2px solid var(--bg-300); background: var(--bg-100); color: var(--text-200);
  transition: all 0.25s; z-index: 1; position: relative;
}
.ws-step.active .ws-step-circle {
  border-color: var(--gold); background: var(--gold); color: #fff;
  box-shadow: 0 0 0 0 rgba(201,168,76,0.5);
  animation: stepPulse 2s ease-in-out infinite;
}
.ws-step.active .ws-step-circle::before {
  content: ''; position: absolute; inset: -5px; border-radius: 50%;
  border: 2px solid rgba(201,168,76,0.25);
  animation: stepRipple 2s ease-in-out infinite;
}
.ws-step.active .ws-step-circle::after {
  content: ''; position: absolute; inset: -9px; border-radius: 50%;
  border: 1px solid rgba(201,168,76,0.12);
  animation: stepRipple 2s ease-in-out infinite 0.3s;
}
.ws-step.done .ws-step-circle {
  border-color: #67c23a; background: #67c23a; color: #fff;
}
.ws-step.done .ws-step-circle::before,
.ws-step.done .ws-step-circle::after { display: none; }
.ws-step-check { font-size: 12px; }

@keyframes stepPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.5); }
  50% { box-shadow: 0 0 0 8px rgba(201,168,76,0); }
}
@keyframes stepRipple {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.4; }
}

.ws-step-label {
  font-size: 11px; font-weight: 600; color: var(--text-200); white-space: nowrap;
  padding: 0 3px 0 6px; transition: color 0.2s;
}
.ws-step.active .ws-step-label { color: var(--gold-dark); }
.ws-step.done .ws-step-label { color: #67c23a; }

.ws-step-line {
  width: 22px; height: 2px; background: var(--bg-300);
  margin: 0 4px; flex-shrink: 0; transition: all 0.3s; border-radius: 1px;
}
.ws-step.done .ws-step-line {
  background: linear-gradient(90deg, #67c23a 0%, rgba(103,194,58,0.3) 100%);
}
.ws-step.active .ws-step-line {
  background: linear-gradient(90deg, var(--gold) 0%, rgba(201,168,76,0.2) 100%);
  animation: lineShimmer 1.5s ease-in-out infinite;
}
@keyframes lineShimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.ws-step:hover .ws-step-circle { border-color: var(--gold); }

.ws-content { flex: 1; min-height: 0; }
.ws-project-pick { margin-left: auto; }
.ws-episode-bar { display: flex; align-items: center; gap: 4px; margin-left: 6px; padding-left: 8px; border-left: 1px solid var(--bg-300); flex-shrink: 0; }
.ws-ep-select { width: 130px; }
.ws-ep-select :deep(.el-input__wrapper) { background: var(--bg-200); border-color: var(--bg-300); box-shadow: none !important; border-radius: 6px; }
.ws-sb-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.ws-sb-actions .ws-act-btn { font-size: 10px !important; padding: 4px 8px !important; font-weight: 600; height: 26px; }
.ws-act-save, .ws-act-refresh { color: var(--gold-dark) !important; border-color: var(--gold) !important; background: var(--bg-200) !important; }
.ws-act-save:hover, .ws-act-refresh:hover { background: var(--gold) !important; color: #fff !important; }
.ws-act-del { color: var(--text-200) !important; border-color: var(--bg-300) !important; background: var(--bg-200) !important; }
.ws-act-del:hover { color: #c44545 !important; border-color: #c44545 !important; }
.ws-act-export, .ws-act-import { color: var(--text-200) !important; border-color: var(--bg-300) !important; background: var(--bg-200) !important; }
.ws-act-export:hover, .ws-act-import:hover { color: var(--gold-dark) !important; border-color: var(--gold) !important; }

@media (max-width: 768px) {
  .ws-steps { justify-content: flex-start; padding: 10px 14px; }
  .ws-step-line { width: 18px; margin: 0 4px; }
  .ws-step-label { font-size: 11px; padding: 0 2px 0 6px; }
  .ws-step-circle { width: 28px; height: 28px; font-size: 11px; }
}
</style>
