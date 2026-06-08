<template>
  <div class="db-root">
    <!-- Masthead -->
    <header class="db-masthead">
      <div class="db-masthead-left">
        <span class="db-overline">{{ greeting }}</span>
        <h1 class="db-title">创作指挥中心</h1>
        <p class="db-sub">你的故事，你的视野，你的工作室</p>
      </div>
      <div class="db-masthead-right">
        <div class="db-date-card">
          <span class="db-date-num">{{ dayNum }}</span>
          <div class="db-date-text">
            <span>{{ monthLabel }}</span>
            <span>{{ weekLabel }}</span>
          </div>
        </div>
        <el-button class="db-cta" size="large" @click="$router.push('/projects')">
          <Film theme="outline" size="18" fill="currentColor" /> 开始创作
        </el-button>
      </div>
    </header>

    <!-- Stat Cards -->
    <div class="db-stats-row">
      <div v-for="s in stats" :key="s.label" class="db-stat-card" :style="{ animationDelay: s.delay }">
        <div class="stat-icon-wrap" :style="{ background: s.gradient }">
          <component :is="s.icon" theme="outline" size="22" :fill="s.iconFill" />
        </div>
        <div class="stat-body">
          <span class="stat-value">{{ s.value }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
        <div class="stat-bg-pattern">{{ s.pattern }}</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="db-grid">
      <!-- Quick Actions -->
      <div class="db-card db-actions">
        <div class="db-card-head">
          <h3 class="db-card-title"><Help theme="outline" size="18" fill="var(--gold)" /> 快捷操作</h3>
        </div>
        <div class="action-grid">
          <div v-for="a in quickActions" :key="a.label" class="action-tile" @click="$router.push(a.route)">
            <div class="action-icon-wrap" :style="{ background: a.bg }">
              <component :is="a.icon" theme="outline" size="22" :fill="a.color" />
            </div>
            <div class="action-text">
              <span class="action-label">{{ a.label }}</span>
              <span class="action-desc">{{ a.desc }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Projects -->
      <div class="db-card db-recent">
        <div class="db-card-head">
          <h3 class="db-card-title"><Film theme="outline" size="18" fill="var(--gold)" /> 最近片场</h3>
          <span class="db-card-badge" v-if="projectStore.projects.length">{{ projectStore.projects.length }}</span>
        </div>
        <div v-if="projectStore.projects.length > 0" class="recent-list">
          <div
            v-for="(p, i) in recentProjects"
            :key="p._id"
            class="recent-item"
            :style="{ animationDelay: (i * 60) + 'ms' }"
            @click="goToProject(p)"
          >
            <div class="recent-index" :style="{ color: statusColor(p.status) }">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="recent-body">
              <span class="recent-name">{{ p.name }}</span>
              <div class="recent-meta">
                <span :class="['recent-badge', 'badge-' + p.status]">{{ statusLabel(p.status) }}</span>
                <span>{{ formatDate(p.createdAt) }}</span>
              </div>
            </div>
            <span class="recent-arrow">→</span>
          </div>
        </div>
        <div v-else class="recent-empty">
          <Film theme="outline" size="40" fill="var(--primary-300)" />
          <p>还没有片场哦~ 点击上方"开始创作"</p>
        </div>
      </div>

      <!-- System Status -->
      <div class="db-card db-status">
        <div class="db-card-head">
          <h3 class="db-card-title"><SettingTwo theme="outline" size="18" fill="var(--gold)" /> 系统状态</h3>
        </div>
        <div class="status-list">
          <div class="status-row">
            <div class="status-icon-wrap" :style="{ background: llmReady ? 'rgba(103,194,58,0.12)' : 'rgba(230,162,60,0.12)' }">
              <SettingTwo theme="outline" size="14" :fill="llmReady ? '#67c23a' : '#e6a23c'" />
            </div>
            <span>AI 引擎</span>
            <span class="status-val" :style="{ color: llmReady ? '#67c23a' : '#e6a23c' }">{{ llmReady ? '已连接' : '未配置' }}</span>
          </div>
          <div class="status-row">
            <div class="status-icon-wrap" style="background: rgba(103,194,58,0.12)">
              <Data theme="outline" size="14" fill="#67c23a" />
            </div>
            <span>MongoDB</span>
            <span class="status-val" style="color: #67c23a">运行中</span>
          </div>
          <div class="status-row">
            <div class="status-icon-wrap" style="background: rgba(103,194,58,0.12)">
              <Time theme="outline" size="14" fill="#67c23a" />
            </div>
            <span>Redis</span>
            <span class="status-val" style="color: #67c23a">运行中</span>
          </div>
          <div class="status-row">
            <div class="status-icon-wrap" style="background: rgba(201,168,76,0.1)">
              <Download theme="outline" size="14" fill="var(--primary-300)" />
            </div>
            <span>存储</span>
            <span class="status-val" style="color: var(--primary-300)">待机</span>
          </div>
        </div>
        <div class="db-footer-text">
          StoryCine <span class="footer-ver">v2.7</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, markRaw } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { configAPI } from '../api';
import {
  Film, Play, User, EditTwo, PictureOne, SettingTwo, Data, Time, Help, Download, Plus
} from '@icon-park/vue-next';

const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const router = useRouter();
const llmReady = ref(false);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，注意休息';
  if (h < 9) return '早上好，元气满满';
  if (h < 12) return '上午好，专注创作';
  if (h < 14) return '中午好，稍作休整';
  if (h < 18) return '下午好，灵感迸发';
  return '晚上好，精彩继续';
});

const dayNum = new Date().getDate();
const monthLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
const weekLabel = '星期' + ['日','一','二','三','四','五','六'][new Date().getDay()];

const stats = ref([
  { label: '我的片场', value: 0, icon: markRaw(Film), iconFill: '#fff', gradient: 'linear-gradient(135deg, #1A1A2E, #2d2d4a)', pattern: '🎬', delay: '0ms' },
  { label: '剧本集数', value: 0, icon: markRaw(EditTwo), iconFill: 'var(--navy)', gradient: 'linear-gradient(135deg, #c9a84c, #e8c97a)', pattern: '📝', delay: '80ms' },
  { label: '故事板', value: 0, icon: markRaw(PictureOne), iconFill: '#fff', gradient: 'linear-gradient(135deg, #8B7355, #a89070)', pattern: '🎞️', delay: '160ms' },
  { label: '角色资产', value: 0, icon: markRaw(User), iconFill: '#fff', gradient: 'linear-gradient(135deg, #6b8fa3, #8aafc2)', pattern: '🎭', delay: '240ms' },
]);

const recentProjects = computed(() => projectStore.projects.slice(0, 5));

const quickActions = [
  { label: '开拍新短剧', desc: '创建项目', icon: markRaw(Film), color: 'var(--navy)', bg: 'rgba(26,26,46,0.06)', route: '/projects' },
  { label: '剧本工坊', desc: 'AI 智能编剧', icon: markRaw(EditTwo), color: '#c9a84c', bg: 'rgba(201,168,76,0.08)', route: '/script-generate' },
  { label: '演员库', desc: '角色场景道具', icon: markRaw(User), color: '#8B7355', bg: 'rgba(139,115,85,0.08)', route: '/assets' },
  { label: '镜头板', desc: '分镜与生图', icon: markRaw(PictureOne), color: '#6b8fa3', bg: 'rgba(107,143,163,0.08)', route: '/storyboard' },
  { label: '分镜台本', desc: '场次台词编辑', icon: markRaw(SettingTwo), color: '#7b6ba3', bg: 'rgba(123,107,163,0.08)', route: '/script-edit' },
  { label: '剪辑室', desc: '视频合成预览', icon: markRaw(Play), color: '#c97a4c', bg: 'rgba(201,122,76,0.08)', route: '/composition' },
];

function goToProject(p) {
  projectStore.setCurrentProject(p);
  router.push('/script-generate');
}

function statusLabel(s) {
  return { draft:'筹备中', in_progress:'拍摄中', completed:'已杀青', archived:'已存档' }[s] || s;
}

function statusColor(s) {
  return { draft:'var(--primary-300)', in_progress:'var(--gold)', completed:'#67c23a', archived:'var(--text-200)' }[s] || 'var(--primary-300)';
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN', { month:'short', day:'numeric' }) : ''; }

onMounted(async () => {
  await projectStore.fetchProjects();
  stats.value[0].value = projectStore.projects.length;

  try {
    const res = await configAPI.getLLMStatus();
    llmReady.value = res.data?.configured || false;
  } catch (e) { /* offline */ }

  try {
    const allScripts = [];
    for (const p of projectStore.projects) {
      await scriptStore.fetchScripts(p._id);
      allScripts.push(...scriptStore.scripts);
    }
    stats.value[1].value = allScripts.length;
  } catch (e) {}
});
</script>

<style scoped>
.db-root { padding: 0; animation: fadeIn 0.6s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* Masthead */
.db-masthead {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-bottom: 32px; gap: 24px;
}
.db-masthead-left { flex: 1; }
.db-masthead-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.db-overline {
  display: inline-block;
  font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
  color: var(--gold-dark); font-weight: 600;
  background: linear-gradient(90deg, rgba(201,168,76,0.12), transparent);
  padding: 4px 14px; border-radius: 4px;
}
.db-title {
  font-family: 'Playfair Display', serif; font-size: 44px; font-weight: 900;
  color: var(--text-100); line-height: 1.1; margin: 10px 0 8px; letter-spacing: -1px;
}
.db-sub { color: var(--text-200); font-size: 14px; margin: 0; }

/* Date card */
.db-date-card {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-200); border: 1px solid var(--bg-300);
  border-radius: 10px; padding: 8px 14px;
}
.db-date-num {
  font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900;
  color: var(--gold); line-height: 1;
}
.db-date-text { display: flex; flex-direction: column; font-size: 12px; color: var(--text-200); gap: 2px; }

.db-cta {
  font-family: 'DM Sans', sans-serif !important; padding: 16px 28px !important;
  height: auto !important; font-size: 14px !important; font-weight: 700 !important;
  letter-spacing: 0.5px !important; background: var(--navy) !important;
  color: var(--gold) !important; border: 2px solid var(--gold) !important;
  border-radius: 8px !important; display: flex !important; align-items: center !important; gap: 8px !important;
}
.db-cta:hover { background: var(--gold) !important; color: var(--navy) !important; }

/* Stat Cards */
.db-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
.db-stat-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 18px 20px; display: flex; align-items: center; gap: 14px;
  position: relative; overflow: hidden;
  animation: fadeIn 0.5s ease-out both; cursor: default;
  transition: all 0.25s;
}
.db-stat-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(139,105,20,0.1); }
.stat-icon-wrap {
  width: 46px; height: 46px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.stat-body { display: flex; flex-direction: column; position: relative; z-index: 1; }
.stat-value { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 900; color: var(--text-100); line-height: 1; }
.stat-label { font-size: 11px; color: var(--text-200); letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
.stat-bg-pattern {
  position: absolute; right: -8px; bottom: -12px; font-size: 48px; opacity: 0.06;
  pointer-events: none; user-select: none;
}

/* Cards */
.db-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.db-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 20px; transition: border-color 0.25s;
}
.db-card:hover { border-color: rgba(201,168,76,0.3); }
.db-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 14px; margin-bottom: 14px; border-bottom: 2px solid rgba(201,168,76,0.2);
}
.db-card-title {
  font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 700;
  color: var(--text-100); margin: 0; display: flex; align-items: center; gap: 8px;
}
.db-card-badge {
  background: var(--gold); color: var(--navy); font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 10px;
}
.db-actions { grid-row: span 2; }

/* Quick Actions */
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.action-tile {
  background: var(--bg-100); border-radius: 10px; padding: 14px;
  cursor: pointer; border: 1px solid var(--bg-300);
  transition: all 0.2s; display: flex; align-items: center; gap: 10px;
}
.action-tile:hover { border-color: var(--gold); background: var(--bg-200); transform: translateX(2px); }
.action-icon-wrap {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.action-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.action-label { font-size: 13px; color: var(--text-100); font-weight: 600; }
.action-desc { font-size: 10px; color: var(--text-200); }

/* Recent Projects */
.recent-list { display: flex; flex-direction: column; gap: 4px; }
.recent-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 10px;
  border-radius: 8px; cursor: pointer; transition: all 0.2s;
  animation: fadeIn 0.4s ease-out both;
}
.recent-item:hover { background: var(--bg-100); }
.recent-index { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; opacity: 0.5; width: 28px; text-align: right; flex-shrink: 0; transition: opacity 0.2s; }
.recent-item:hover .recent-index { opacity: 0.8; }
.recent-body { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 3px; }
.recent-name { font-weight: 700; color: var(--text-100); font-size: 14px; }
.recent-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-200); }
.recent-badge {
  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;
  background: var(--bg-100); color: var(--text-200);
}
.badge-in_progress { background: rgba(201,168,76,0.12); color: var(--gold); }
.badge-completed { background: rgba(103,194,58,0.12); color: #67c23a; }
.recent-arrow { opacity: 0; transition: all 0.2s; flex-shrink: 0; }
.recent-item:hover .recent-arrow { opacity: 1; transform: translateX(4px); }
.recent-empty { text-align: center; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.recent-empty p { color: var(--text-200); font-size: 13px; margin: 0; }

/* System Status */
.status-list { display: flex; flex-direction: column; gap: 6px; }
.status-row {
  display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-100);
  padding: 8px 10px; border-radius: 8px; background: var(--bg-100);
}
.status-icon-wrap {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.status-val { margin-left: auto; font-size: 12px; font-weight: 600; }
.db-footer-text {
  margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--bg-300);
  font-size: 10px; color: var(--text-200); text-align: center; letter-spacing: 1px;
}
.footer-ver { color: var(--gold); font-weight: 700; }

@media (max-width: 768px) {
  .db-masthead { flex-direction: column; align-items: flex-start; gap: 16px; }
  .db-masthead-right { width: 100%; justify-content: space-between; }
  .db-title { font-size: 28px !important; }
  .db-overline { font-size: 9px; letter-spacing: 2px; }
  .db-stats-row { grid-template-columns: repeat(2, 1fr); }
  .db-grid { grid-template-columns: 1fr; }
  .db-stat-card { padding: 14px; }
  .stat-value { font-size: 24px; }
  .db-actions { grid-row: auto; }
}
</style>
