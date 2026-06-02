<template>
  <div class="db-root">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">导演台</span>
    </div>
    <!-- Masthead -->
    <header class="db-masthead">
      <div class="db-greeting">
        <span class="db-overline">{{ greeting }}</span>
        <h1 class="db-title">创作<br>指挥中心</h1>
        <p class="db-sub">你的故事，你的视野，你的工作室</p>
      </div>
      <div class="db-masthead-actions">
        <el-button class="db-cta" size="large" @click="$router.push('/projects')">
          <span class="cta-icon">✦</span> 开始创作
        </el-button>
      </div>
    </header>

    <!-- Stat Cards Row -->
    <div class="db-stats-row">
      <div class="db-stat-card" v-for="s in stats" :key="s.label" :style="{ animationDelay: s.delay }">
        <div class="stat-icon-wrap" :style="{ background: s.color }">{{ s.icon }}</div>
        <div class="stat-body">
          <span class="stat-value">{{ s.value }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
        <div class="stat-accent" :style="{ background: s.color }"></div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="db-grid">
      <!-- Quick Actions -->
      <div class="db-card db-actions">
        <h3 class="db-card-title">快捷操作</h3>
        <div class="action-grid">
          <div class="action-tile" v-for="a in quickActions" :key="a.label" @click="$router.push(a.route)">
            <span class="action-icon">{{ a.icon }}</span>
            <span class="action-label">{{ a.label }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Projects -->
      <div class="db-card db-recent">
        <h3 class="db-card-title">最近片场</h3>
        <div v-if="projectStore.projects.length > 0" class="recent-list">
          <div
            v-for="(p, i) in recentProjects"
            :key="p._id"
            class="recent-item"
            :style="{ animationDelay: (i * 60) + 'ms' }"
            @click="goToProject(p)"
          >
            <div class="recent-index">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="recent-body">
              <span class="recent-name">{{ p.name }}</span>
              <span class="recent-meta">{{ statusLabel(p.status) }} · {{ formatDate(p.createdAt) }}</span>
            </div>
            <span class="recent-arrow">→</span>
          </div>
        </div>
        <div v-else class="recent-empty">
          <span class="empty-ornament">◇</span>
          <p>还没有片场哦~ — 点击上方开始创作</p>
        </div>
      </div>

      <!-- System Status -->
      <div class="db-card db-status">
        <h3 class="db-card-title">系统状态</h3>
        <div class="status-list">
          <div class="status-row">
            <span class="status-dot on"></span>
            <span>LLM Engine</span>
            <span class="status-val">{{ llmReady ? '已连接' : '未配置' }}</span>
          </div>
          <div class="status-row">
            <span class="status-dot on"></span>
            <span>MongoDB</span>
            <span class="status-val">已连接</span>
          </div>
          <div class="status-row">
            <span class="status-dot on"></span>
            <span>Redis</span>
            <span class="status-val">已连接</span>
          </div>
          <div class="status-row">
            <span class="status-dot idle"></span>
            <span>MinIO Storage</span>
            <span class="status-val">待机</span>
          </div>
        </div>
        <div class="db-footer-text">
          StoryCine v1.0 · Art Deco 版
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { configAPI } from '../api';

const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const llmReady = ref(false);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const stats = ref([
  { label: '我的片场', value: 0, icon: '🎬', color: 'var(--navy)', delay: '0ms' },
  { label: '剧本集数', value: 0, icon: '📝', color: 'var(--gold)', delay: '80ms' },
  { label: '故事板', value: 0, icon: '🎞️', color: 'var(--primary-100)', delay: '160ms' },
  { label: '角色资产', value: 0, icon: '🎭', color: 'var(--accent-100)', delay: '240ms' },
]);

const recentProjects = computed(() => projectStore.projects.slice(0, 5));

const quickActions = [
  { label: '开拍新短剧！', icon: '🎥', route: '/projects' },
  { label: '剧本工坊', icon: '✨', route: '/script-generate' },
  { label: '分镜台本', icon: '🎬', route: '/script-edit' },
  { label: '演员库', icon: '🎭', route: '/assets' },
  { label: '镜头板', icon: '🎞️', route: '/storyboard' },
  { label: '剪辑室', icon: '🎥', route: '/composition' },
];

function goToProject(p) {
  projectStore.setCurrentProject(p);
  router.push('/script-generate');
}

onMounted(async () => {
  await projectStore.fetchProjects();
  stats.value[0].value = projectStore.projects.length;

  try {
    const res = await configAPI.getLLMStatus();
    llmReady.value = res.data?.configured || false;
  } catch (e) { /* offline */ }

  // Fetch stats from all stores
  try {
    const allScripts = [];
    for (const p of projectStore.projects) {
      await scriptStore.fetchScripts(p._id);
      allScripts.push(...scriptStore.scripts);
    }
    stats.value[1].value = allScripts.length;
  } catch (e) {}
});

function statusLabel(s) { return { draft:'剧本筹备中', in_progress:'拍摄进行时', completed:'杀青大吉啦', archived:'片场已存档' }[s] || s; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN', { month:'short', day:'numeric' }) : ''; }
</script>

<style scoped>
/* ===== ART DECO DASHBOARD ===== */
.db-root { padding: 0; animation: fadeIn 0.6s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* Masthead */
.db-masthead { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 36px; }
.db-overline { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: var(--gold-dark); font-weight: 600; }
.db-title { font-family: 'Playfair Display', serif; font-size: 48px; font-weight: 900; color: var(--text-100); line-height: 1.05; margin: 8px 0 10px; letter-spacing: -1px; }
.db-sub { color: var(--text-200); font-size: 14px; margin: 0; letter-spacing: 0.5px; }
.db-cta { font-family: 'DM Sans', sans-serif !important; padding: 16px 32px !important; height: auto !important; font-size: 15px !important; font-weight: 700 !important; letter-spacing: 1px !important; background: var(--navy) !important; color: var(--gold) !important; border: 2px solid var(--gold) !important; border-radius: 8px !important; }
.db-cta:hover { background: var(--gold) !important; color: var(--navy) !important; }
.cta-icon { margin-right: 8px; font-size: 16px; }

/* Stat Cards */
.db-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
.db-stat-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px;
  padding: 20px; display: flex; align-items: center; gap: 14px; position: relative; overflow: hidden;
  animation: fadeIn 0.5s ease-out both; cursor: default;
  transition: all 0.25s;
}
.db-stat-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(139,105,20,0.1); }
.stat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.stat-body { display: flex; flex-direction: column; }
.stat-value { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 900; color: var(--text-100); line-height: 1; }
.stat-label { font-size: 11px; color: var(--text-200); letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
.stat-accent { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; }

/* Grid */
.db-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.db-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px;
  padding: 20px; transition: border-color 0.25s;
}
.db-card:hover { border-color: var(--gold); }
.db-card-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: var(--text-100); margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid var(--gold); letter-spacing: 0.5px; }
.db-actions { grid-row: span 2; }

/* Quick Actions */
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.action-tile {
  background: var(--bg-100); border-radius: 8px; padding: 16px; text-align: center; cursor: pointer;
  border: 1px solid var(--bg-300); transition: all 0.2s; display: flex; flex-direction: column; gap: 6px;
}
.action-tile:hover { border-color: var(--gold); background: var(--bg-200); transform: translateY(-1px); }
.action-icon { font-size: 24px; }
.action-label { font-size: 12px; color: var(--text-100); font-weight: 600; }

/* Recent Projects */
.recent-list { display: flex; flex-direction: column; gap: 6px; }
.recent-item {
  display: flex; align-items: center; gap: 12px; padding: 12px;
  border-radius: 6px; cursor: pointer; transition: all 0.2s;
  animation: fadeIn 0.4s ease-out both;
}
.recent-item:hover { background: var(--bg-100); }
.recent-index { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; color: var(--gold); opacity: 0.4; width: 28px; text-align: right; flex-shrink: 0; }
.recent-body { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.recent-name { font-weight: 700; color: var(--text-100); font-size: 14px; }
.recent-meta { font-size: 11px; color: var(--text-200); margin-top: 2px; }
.recent-arrow { color: var(--gold); font-size: 16px; opacity: 0; transition: all 0.2s; }
.recent-item:hover .recent-arrow { opacity: 1; transform: translateX(4px); }
.recent-empty { text-align: center; padding: 40px 20px; }
.empty-ornament { font-size: 32px; color: var(--primary-300); display: block; margin-bottom: 10px; }
.recent-empty p { color: var(--text-200); font-size: 13px; }

/* Status */
.status-list { display: flex; flex-direction: column; gap: 10px; }
.status-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-100); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.on { background: #67c23a; }
.status-dot.idle { background: var(--primary-300); }
.status-val { margin-left: auto; color: var(--text-200); font-size: 12px; }
.db-footer-text { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--bg-300); font-size: 10px; color: var(--text-200); text-align: center; letter-spacing: 1px; }

@media (max-width: 768px) {
  .db-masthead { flex-direction: column; align-items: flex-start; gap: 16px; }
  .db-title { font-size: 28px !important; }
  .db-overline { font-size: 9px; letter-spacing: 2px; }
  .db-stats-row { grid-template-columns: repeat(2, 1fr); }
  .db-grid { grid-template-columns: 1fr; }
  .db-stat-card { padding: 14px; }
  .stat-value { font-size: 24px; }
}
</style>
