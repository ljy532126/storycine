<template>
  <div class="st-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">数据看板</span>
    </div>

    <!-- 工具栏 -->
    <div class="st-toolbar">
      <div class="st-toolbar-left">
        <span :class="{ 'st-status': true, loading: loading }">{{ loading ? '⏳ 加载中' : '✓ 已加载' }}</span>
        <span class="st-updated" v-if="lastUpdated">{{ lastUpdated }}</span>
        <span class="st-updated" v-if="fetchError" style="color:#F56C6C">{{ fetchError }}</span>
      </div>
      <div class="st-toolbar-right">
        <el-tooltip content="自动刷新（每5分钟）" placement="top">
          <el-switch v-model="autoRefresh" size="small" @change="toggleAutoRefresh" />
        </el-tooltip>
        <span style="font-size:12px;color:var(--text-200);margin:0 6px 0 2px">自动</span>
        <el-button size="small" @click="refreshAll" :loading="loading">🔄 刷新</el-button>
        <el-dropdown @command="handleExport" trigger="click">
          <el-button size="small">导出 ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="weekly">近7天趋势</el-dropdown-item>
              <el-dropdown-item command="genres">热门题材</el-dropdown-item>
              <el-dropdown-item command="overview">今日概览</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Tab 导航 -->
    <div class="st-tabs">
      <span :class="['st-tab', { active: statTab === 'overview' }]" @click="statTab = 'overview'">今日概览</span>
      <span :class="['st-tab', { active: statTab === 'trend' }]" @click="statTab = 'trend'">趋势 & 排行</span>
      <span :class="['st-tab', { active: statTab === 'monitor' }]" @click="statTab = 'monitor'">服务器监控</span>
      <span :class="['st-tab', { active: statTab === 'ai' }]" @click="statTab = 'ai'">AI 调用</span>
      <span :class="['st-tab', { active: statTab === 'endpoints' }]" @click="statTab = 'endpoints'">接口监控</span>
    </div>

    <!-- 今日概览 -->
    <section class="st-section" v-show="statTab === 'overview'">
      <div class="st-overview-cards">
        <div v-for="(c, idx) in overviewCards" :key="c.label" class="st-ov-card" :style="{ animationDelay: idx * 60 + 'ms' }">
          <div class="ov-icon" :style="{ background: c.color }">{{ c.icon }}</div>
          <div class="ov-body">
            <span class="ov-value" :style="{ color: c.color }">{{ c.value }}</span>
            <span class="ov-label">{{ c.label }}</span>
            <span class="ov-change" :class="c.up ? 'up' : 'down'">{{ c.changeText }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 趋势 -->
    <section class="st-section" v-show="statTab === 'trend'">
      <h2 class="st-section-title">近7天趋势</h2>
      <div class="st-card">
        <div class="st-chart-container">
          <canvas ref="trendCanvas" width="900" height="200"></canvas>
        </div>
        <div class="st-chart-empty" v-if="!trendData.labels || trendData.labels.length === 0">暂无数据</div>
        <div class="chart-legend">
          <span class="legend-dot" style="background:var(--gold)"></span> 剧本生成
          <span class="legend-dot" style="background:var(--primary-100)"></span> 成片合成
        </div>
      </div>
    </section>

    <!-- 排行 + 活跃 -->
    <div class="st-grid-2" v-show="statTab === 'trend'">
      <!-- 热门题材 Top5 -->
      <div class="st-card">
        <h3 class="st-card-title">热门题材 Top5</h3>
        <div class="st-rank-list">
          <div v-if="topGenres.length === 0" class="st-empty-hint">暂无数据</div>
          <div v-for="(g, i) in topGenres" :key="g.name" class="rank-item" :style="{ animationDelay: (i*80)+'ms' }">
            <span class="rank-num">{{ i+1 }}</span>
            <span class="rank-name">{{ g.name }}</span>
            <div class="rank-bar-wrap"><div class="rank-bar" :style="{ width: g.pct+'%', background: g.color }"></div></div>
            <span class="rank-val">{{ g.count }}次</span>
          </div>
        </div>
      </div>

      <!-- 用户活跃 -->
      <div class="st-card">
        <h3 class="st-card-title">用户活跃</h3>
        <div class="st-user-stats">
          <div class="user-stat-row"><span>日活跃 (DAU)</span><strong style="color:var(--gold)">{{ userActivity.dau }}</strong></div>
          <div class="user-stat-row"><span>人均生成</span><strong style="color:var(--primary-100)">{{ userActivity.avgGenerations }}</strong></div>
          <div class="user-stat-row"><span>本周新用户</span><strong style="color:var(--text-100)">{{ userActivity.newActive }}</strong></div>
          <div class="user-stat-row"><span>7日留存率</span><strong style="color:var(--gold-dark)">{{ userActivity.retentionRate }}%</strong></div>
        </div>
      </div>
    </div>

    <!-- 服务器监控（全宽） -->
    <section class="st-section" v-show="statTab === 'monitor'">
      <h2 class="st-section-title">服务器监控</h2>
      <div class="st-card" v-if="serverData">
        <div class="st-monitor-h">
          <div class="st-mon-h-item">
            <div class="st-mon-h-icon">🖥️</div>
            <div class="st-mon-h-body">
              <span class="st-mon-h-label">CPU {{ serverData.cpu.model }}</span>
              <el-progress :percentage="serverData.cpu.usagePct" :stroke-width="10" :color="serverData.cpu.usagePct > 80 ? '#C44545' : 'var(--navy)'" />
              <span class="mon-sub">{{ serverData.cpu.cores }}核 · 负载 {{ serverData.cpu.loadAvg?.[0] }}</span>
            </div>
          </div>
          <div class="st-mon-h-item">
            <div class="st-mon-h-icon">💾</div>
            <div class="st-mon-h-body">
              <span class="st-mon-h-label">内存 {{ serverData.memory.used }} / {{ serverData.memory.total }} GB</span>
              <el-progress :percentage="serverData.memory.usagePct" :stroke-width="10" :color="serverData.memory.usagePct > 80 ? '#C44545' : 'var(--gold)'" />
            </div>
          </div>
          <div class="st-mon-h-item">
            <div class="st-mon-h-icon">⏱️</div>
            <div class="st-mon-h-body">
              <span class="st-mon-h-label">运行时长</span>
              <strong style="font-size:18px;color:var(--text-100)">{{ serverData.uptimeFormatted }}</strong>
            </div>
          </div>
          <div class="st-mon-h-item">
            <div class="st-mon-h-icon">⚙️</div>
            <div class="st-mon-h-body">
              <span class="st-mon-h-label">系统</span>
              <span style="font-size:13px;color:var(--text-200)">{{ serverData.platform }} / {{ serverData.arch }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- AI 调用统计 -->
    <section class="st-section" v-if="endpoints.ai && statTab === 'ai'">
      <h2 class="st-section-title">AI 调用统计</h2>
      <div class="st-grid-3">
        <div class="st-card" style="text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🎨</div>
          <div style="font-size:28px;font-weight:900;color:var(--text-100);font-family:'Playfair Display',serif">{{ endpoints.ai?.image?.total || 0 }}</div>
          <div style="font-size:13px;color:var(--text-200);margin-top:4px">生图调用</div>
          <div style="font-size:11px;margin-top:6px"><span style="color:#67C23A">{{ endpoints.ai?.image?.success || 0 }} 成功</span> · <span style="color:#F56C6C">{{ endpoints.ai?.image?.fail || 0 }} 失败</span></div>
        </div>
        <div class="st-card" style="text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🎥</div>
          <div style="font-size:28px;font-weight:900;color:var(--text-100);font-family:'Playfair Display',serif">{{ endpoints.ai?.video?.total || 0 }}</div>
          <div style="font-size:13px;color:var(--text-200);margin-top:4px">生视频调用</div>
          <div style="font-size:11px;margin-top:6px"><span style="color:#67C23A">{{ endpoints.ai?.video?.success || 0 }} 成功</span> · <span style="color:#F56C6C">{{ endpoints.ai?.video?.fail || 0 }} 失败</span></div>
        </div>
        <div class="st-card" style="text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🤖</div>
          <div style="font-size:28px;font-weight:900;color:var(--text-100);font-family:'Playfair Display',serif">{{ endpoints.ai?.llm?.total || 0 }}</div>
          <div style="font-size:13px;color:var(--text-200);margin-top:4px">LLM 文本调用</div>
          <div style="font-size:11px;margin-top:6px"><span style="color:#67C23A">{{ endpoints.ai?.llm?.success || 0 }} 成功</span> · <span style="color:#F56C6C">{{ endpoints.ai?.llm?.fail || 0 }} 失败</span></div>
        </div>
      </div>
    </section>

    <!-- 接口监控 -->
    <section class="st-section" v-show="statTab === 'trend'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h2 class="st-section-title" style="margin:0">接口监控</h2>
        <el-button size="small" @click="fetchEndpoints" :loading="endpointsLoading">刷新</el-button>
      </div>
      <div class="st-card" v-show="statTab === 'endpoints'">
        <div class="st-endpoint-header">
          <span>总请求: <strong>{{ endpoints.total }}</strong></span>
          <span>健康度: <strong :style="{ color: endpoints.health > 90 ? '#67C23A' : endpoints.health > 70 ? '#E6A23C' : '#F56C6C' }">{{ endpoints.health }}%</strong></span>
        </div>
        <div class="st-endpoint-list">
          <div v-for="ep in endpoints.routes.slice(0, 12)" :key="ep.route" class="st-ep-row">
            <span class="st-ep-method" :class="ep.route.split(' ')[0].toLowerCase()">{{ ep.route.split(' ')[0] }}</span>
            <span class="st-ep-path">{{ ep.route.split(' ')[1] }}</span>
            <span class="st-ep-count">{{ ep.count }}次</span>
            <span class="st-ep-last" :title="ep.last">{{ timeAgo(ep.last) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 用户分布 -->
    <section class="st-section" v-show="statTab === 'trend'">
      <h2 class="st-section-title">用户分布</h2>
      <div class="st-grid-3">
        <div class="st-card">
          <h3 class="st-card-title">地区</h3>
          <div class="st-bar-chart" v-if="distribution.regions.length > 0">
            <div v-for="r in distribution.regions" :key="r.name" class="bar-row">
              <span class="bar-label">{{ r.name }}</span>
              <div class="bar-fill" :style="{ width: r.pct+'%', background: r.color }"></div>
              <span class="bar-val">{{ r.pct }}%</span>
            </div>
          </div>
          <div v-else class="st-empty-hint">收集中...</div>
        </div>
        <div class="st-card">
          <h3 class="st-card-title">平台</h3>
          <div class="st-pie-simple" v-if="distribution.platforms.length > 0">
            <div v-for="p in distribution.platforms" :key="p.name" class="pie-row"><span class="pie-dot" :style="{ background: p.color }"></span><span>{{ p.name }}</span><span class="pie-val">{{ p.pct }}%</span></div>
          </div>
          <div v-else class="st-empty-hint">收集中...</div>
        </div>
        <div class="st-card">
          <h3 class="st-card-title">浏览器</h3>
          <div class="st-pie-simple" v-if="distribution.browsers.length > 0">
            <div v-for="b in distribution.browsers" :key="b.name" class="pie-row"><span class="pie-dot" :style="{ background: b.color }"></span><span>{{ b.name }}</span><span class="pie-val">{{ b.pct }}%</span></div>
          </div>
          <div v-else class="st-empty-hint">收集中...</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// ===== 响应式数据 =====
const statTab = ref('overview');
const loading = ref(false);
const fetchError = ref('');
const lastUpdated = ref('');
const autoRefresh = ref(false);
let refreshTimer = null;

const overviewCards = ref([
  { label: '新增用户', value: '-', icon: '👤', color: 'var(--gold)', change: 0, up: true, changeText: '' },
  { label: '新增项目', value: '-', icon: '📁', color: 'var(--navy)', change: 0, up: true, changeText: '' },
  { label: '剧本生成', value: '-', icon: '📝', color: 'var(--primary-100)', change: 0, up: true, changeText: '' },
  { label: '成片合成', value: '-', icon: '🎥', color: 'var(--accent-100)', change: 0, up: true, changeText: '' },
  { label: '成功率', value: '-', icon: '✅', color: 'var(--primary-100)', change: 0, up: true, changeText: '' },
]);

const topGenres = ref([]);
const trendData = reactive({ labels: [], scripts: [], compositions: [] });
const serverData = ref(null);
const userActivity = reactive({ dau: '-', avgGenerations: '-', newActive: '-', retentionRate: '-' });
const distribution = reactive({ regions: [], platforms: [], browsers: [] });

const trendCanvas = ref(null);
const migrating = ref(false);
const migrateResult = ref('');
const endpoints = reactive({ total: 0, routes: [], recent: [], health: 100 });
const endpointsLoading = ref(false);
async function fetchEndpoints() { endpointsLoading.value = true; try { const r = await fetch('/api/v1/monitor/endpoints', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); const d = await r.json(); Object.assign(endpoints, d.data); } catch {} finally { endpointsLoading.value = false; } }
function timeAgo(t) { if (!t) return ''; const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000); if (s < 60) return s + '秒前'; if (s < 3600) return Math.floor(s / 60) + '分钟前'; return Math.floor(s / 3600) + '小时前'; }

function formatChange(change) {
  if (change === 0) return '持平';
  const arrow = change > 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(change)}%`;
}

// ===== API 调用 =====
const API = (path) => fetch(`/api/v1/statistics${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());

async function fetchOverview() {
  try {
    const { data } = await API('/daily-overview');
    if (!data) return;
    const cards = overviewCards.value;
    const sets = [
      { key: 'newUsers', idx: 0 },
      { key: 'newProjects', idx: 1 },
      { key: 'scriptsGenerated', idx: 2 },
      { key: 'compositions', idx: 3 },
      { key: 'successRate', idx: 4 },
    ];
    sets.forEach(({ key, idx }) => {
      const d = data[key];
      cards[idx].value = key === 'successRate' ? `${d.value}%` : String(d.value);
      cards[idx].change = d.change;
      cards[idx].up = d.change >= 0;
      cards[idx].changeText = formatChange(d.change);
    });
  } catch (e) { /* keep previous */ }
}

async function fetchWeeklyTrend() {
  try {
    const { data } = await API('/weekly-trend');
    if (!data) return;
    trendData.labels = data.labels || [];
    trendData.scripts = data.scripts || [];
    trendData.compositions = data.compositions || [];
    nextTick(() => drawTrendChart());
  } catch (e) { /* keep previous */ }
}

async function fetchTopGenres() {
  try {
    const { data } = await API('/top-genres');
    if (!data) return;
    topGenres.value = data;
  } catch (e) { /* keep previous */ }
}

async function fetchServerMonitor() {
  try {
    const { data } = await API('/server-monitor');
    if (data) serverData.value = data;
  } catch (e) { /* keep previous */ }
}

async function fetchUserActivity() {
  try {
    const { data } = await API('/user-activity');
    if (!data) return;
    Object.assign(userActivity, data);
  } catch (e) { /* keep previous */ }
}

async function fetchDistribution() {
  try {
    const { data } = await API('/user-distribution');
    if (!data) return;
    distribution.regions = data.regions || [];
    distribution.platforms = data.platforms || [];
    distribution.browsers = data.browsers || [];
  } catch (e) { /* keep previous */ }
}

async function refreshAll() {
  loading.value = true;
  fetchError.value = '';
  try {
    await Promise.all([
      fetchOverview(),
      fetchWeeklyTrend(),
      fetchTopGenres(),
      fetchServerMonitor(),
      fetchUserActivity(),
      fetchDistribution(),
      fetchEndpoints(),
    ]);
    lastUpdated.value = new Date().toLocaleTimeString();
  } catch (e) {
    fetchError.value = '部分数据加载失败，请检查网络连接';
  } finally {
    loading.value = false;
  }
}

function toggleAutoRefresh(val) {
  if (val) {
    refreshTimer = setInterval(refreshAll, 5 * 60 * 1000);
    ElMessage.success('已开启自动刷新（每5分钟）');
  } else {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ===== CSV 导出 =====
function handleExport(type) {
  const url = `/api/v1/statistics/export-csv?type=${type}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `statistics_${type}_${Date.now()}.csv`;
  a.click();
  ElMessage.success('导出已开始');
}

// ===== 图片迁移 =====
async function migrateImages() {
  try { await ElMessageBox.confirm('将把所有已生成的远程图片下载到本地 uploads/ 目录。此操作不会重复下载已有本地图片。确认开始？', '图片迁移', { type: 'info' }); } catch { return; }
  migrating.value = true;
  migrateResult.value = '';
  try {
    const res = await fetch('/api/v1/assets/migrate-images', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const data = await res.json();
    migrateResult.value = data.message;
    ElMessage.success(data.message);
  } catch (e) { ElMessage.error('迁移失败'); }
  finally { migrating.value = false; }
}

// ===== 埋点上报 =====
function trackEvent(event, extra = {}) {
  try {
    const ua = navigator.userAgent || '';
    const platform = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iOS') ? 'iOS' : '其他';
    const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : ua.includes('Firefox') ? 'Firefox' : '其他';
    // 尝试从 Intl 获取地区
    const region = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '';
    fetch('/api/v1/analytics/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, metadata: { platform, browser, region, page: 'statistics', ...extra } }),
    }).catch(() => {});
  } catch {}
}

// ===== Canvas 趋势图 =====
function drawTrendChart() {
  const canvas = trendCanvas.value;
  if (!canvas || !trendData.labels.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const labels = trendData.labels;
  const scripts = trendData.scripts;
  const comps = trendData.compositions;
  const maxVal = Math.max(...scripts, ...comps, 1) + 5;

  const pad = { top: 20, right: 20, bottom: 30, left: 35 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  // Grid
  ctx.strokeStyle = '#E8D5C4';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = '#8B7355'; ctx.font = '10px DM Sans'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), pad.left - 6, y + 4);
  }

  // X labels
  ctx.textAlign = 'center';
  labels.forEach((d, i) => {
    const x = pad.left + (pw / (labels.length - 1 || 1)) * i;
    ctx.fillStyle = '#8B7355'; ctx.fillText(d, x, H - 8);
  });

  // Draw lines
  [
    { data: scripts, color: '#C9A84C' },
    { data: comps, color: '#8B7355' },
  ].forEach(series => {
    ctx.beginPath();
    ctx.strokeStyle = series.color; ctx.lineWidth = 2.5;
    series.data.forEach((v, i) => {
      const x = pad.left + (pw / (labels.length - 1 || 1)) * i;
      const y = pad.top + ph - (v / maxVal) * ph;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    series.data.forEach((v, i) => {
      const x = pad.left + (pw / (labels.length - 1 || 1)) * i;
      const y = pad.top + ph - (v / maxVal) * ph;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = series.color; ctx.fill();
      ctx.fillStyle = '#FFFDF9'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    });
  });
}

// ===== 生命周期 =====
onMounted(async () => {
  await refreshAll();
  trackEvent('page_view');
});

onUnmounted(() => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
});
</script>

<style scoped>
.st-root { padding: 0; animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.st-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; margin-bottom: 20px;
  border-bottom: 2px solid var(--bg-300);
}
.st-toolbar-left { display: flex; align-items: center; gap: 10px; }
.st-toolbar-right { display: flex; align-items: center; gap: 8px; }
.st-status { font-size: 12px; color: #67C23A; font-weight: 600; }
.st-status.loading { color: var(--gold-dark); }
.st-updated { font-size: 11px; color: var(--text-200); }
.st-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid var(--bg-300); padding-bottom: 0; }
.st-tab { font-size: 14px; padding: 10px 20px; cursor: pointer; color: var(--text-200); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; user-select: none; font-weight: 500; }
.st-tab:hover { color: var(--text-100); }
.st-tab.active { color: var(--text-100); font-weight: 700; border-bottom-color: var(--gold); }

.st-section { margin-bottom: 24px; }
.st-section-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: var(--text-100); margin: 0 0 14px; letter-spacing: 0.5px; }

/* 概览卡片 */
.st-overview-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.st-ov-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px;
  padding: 18px; display: flex; gap: 14px; align-items: center;
  animation: fadeIn 0.4s ease-out both; transition: all 0.2s;
}
.st-ov-card:hover { border-color: var(--gold); transform: translateY(-1px); }
.ov-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.ov-body { display: flex; flex-direction: column; gap: 2px; }
.ov-value { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; line-height: 1; }
.ov-label { font-size: 11px; color: var(--text-200); letter-spacing: 0.5px; }
.ov-change { font-size: 11px; margin-top: 1px; }
.ov-change.up { color: var(--primary-100); }
.ov-change.down { color: #C44545; }

/* 双栏网格 */
.st-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.st-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

.st-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px;
  padding: 18px; transition: border-color 0.2s;
}
.st-card:hover { border-color: var(--gold); }
.st-card-title {
  font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; color: var(--text-100);
  margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid var(--gold);
}

/* 图表 */
.st-chart-container { margin: 8px 0; }
.st-chart-container canvas { width: 100%; height: auto; }
.st-chart-empty { text-align: center; padding: 20px; color: var(--text-200); font-size: 13px; }
.chart-legend { display: flex; gap: 16px; font-size: 11px; color: var(--text-200); align-items: center; }
.legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }

/* 排行 */
.st-rank-list { display: flex; flex-direction: column; gap: 8px; }
.rank-item {
  display: flex; align-items: center; gap: 10px;
  animation: fadeIn 0.3s ease-out both; font-size: 13px;
}
.rank-num { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 900; color: var(--gold); width: 20px; text-align: center; }
.rank-name { width: 70px; font-weight: 600; color: var(--text-100); flex-shrink: 0; }
.rank-bar-wrap { flex: 1; height: 8px; background: var(--bg-300); border-radius: 4px; overflow: hidden; }
.rank-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
.rank-val { font-size: 11px; color: var(--text-200); width: 40px; text-align: right; }

/* 监控 */
.st-monitor-list { display: flex; flex-direction: column; gap: 14px; }
.monitor-item { display: flex; flex-direction: column; gap: 4px; }
.mon-label { font-size: 12px; color: var(--text-100); font-weight: 600; }
.mon-sub { font-size: 10px; color: var(--text-200); margin-top: 2px; }
.mon-val-big { font-family: 'Playfair Display', serif; font-size: 16px; color: var(--gold-dark); font-weight: 700; }

/* 用户活跃 */
.st-user-stats { display: flex; flex-direction: column; gap: 14px; }
.user-stat-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-200); }
.user-stat-row strong { font-family: 'Playfair Display', serif; font-size: 20px; }

/* 柱状图 */
.st-bar-chart { display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.bar-label { width: 40px; color: var(--text-100); font-weight: 600; flex-shrink: 0; }
.bar-fill { height: 16px; border-radius: 4px; min-width: 4px; transition: width 0.5s ease; }
.bar-val { color: var(--text-200); font-size: 11px; width: 32px; }

/* 饼图简化版 */
.st-pie-simple { display: flex; flex-direction: column; gap: 10px; }
.pie-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-100); }
.pie-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.pie-val { margin-left: auto; color: var(--text-200); font-size: 12px; }

.st-empty-hint { text-align: center; padding: 24px; color: var(--text-200); font-size: 12px; }

/* 水平监控 */
.st-monitor-h { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.st-mon-h-item { display: flex; gap: 12px; align-items: flex-start; }
.st-mon-h-icon { font-size: 28px; flex-shrink: 0; width: 40px; text-align: center; }
.st-mon-h-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.st-mon-h-label { font-size: 12px; color: var(--text-100); font-weight: 600; }

/* 接口监控 */
.st-endpoint-header { display: flex; gap: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--bg-300); margin-bottom: 8px; font-size: 13px; color: var(--text-200); }
.st-endpoint-header strong { color: var(--text-100); font-size: 18px; font-family: 'Playfair Display', serif; }
.st-endpoint-list { display: flex; flex-direction: column; }
.st-ep-row { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-bottom: 1px solid var(--bg-300); font-size: 12px; }
.st-ep-row:last-child { border-bottom: none; }
.st-ep-method { padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; min-width: 42px; text-align: center; }
.st-ep-method.get { background: #E8F5E9; color: #2E7D32; }
.st-ep-method.post { background: #E3F2FD; color: #1565C0; }
.st-ep-method.put { background: #FFF3E0; color: #E65100; }
.st-ep-method.delete { background: #FFEBEE; color: #C62828; }
.st-ep-path { flex: 1; color: var(--text-100); font-family: monospace; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-ep-count { color: var(--text-200); min-width: 40px; text-align: right; }
.st-ep-last { color: var(--text-200); font-size: 10px; min-width: 60px; text-align: right; }

@media (max-width: 768px) {
  .st-overview-cards { grid-template-columns: repeat(2, 1fr); }
  .st-grid-2, .st-grid-3 { grid-template-columns: 1fr; }
  .st-monitor-h { grid-template-columns: repeat(2, 1fr); }
}
</style>
