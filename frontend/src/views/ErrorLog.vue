<template>
  <div class="el-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">错误日志</span>
      <span v-if="unresolvedCount > 0" class="error-badge-sm">{{ unresolvedCount > 99 ? '99+' : unresolvedCount }}</span>
    </div>

    <!-- 统计卡片 -->
    <div class="el-stats">
      <div class="stat-item stat-today">
        <span class="stat-num">{{ summary?.todayCount || 0 }}</span>
        <span class="stat-label">今日新增</span>
      </div>
      <div class="stat-item stat-unresolved" :class="{ 'has-err': (summary?.unresolved || 0) > 0 }">
        <span class="stat-num">{{ summary?.unresolved || 0 }}</span>
        <span class="stat-label">待处理</span>
      </div>
      <div class="stat-item stat-total">
        <span class="stat-num">{{ summary?.total || 0 }}</span>
        <span class="stat-label">总计</span>
      </div>
      <div v-if="summary?.topPaths?.length" class="stat-item stat-paths">
        <span class="stat-label">高频接口</span>
        <span v-for="p in summary.topPaths.slice(0, 3)" :key="p._id" class="stat-path-tag">{{ p._id }} <b>{{ p.count }}</b></span>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="el-toolbar">
      <div class="tb-left">
        <el-input v-model="keyword" placeholder="搜索错误/路径/用户" size="small" style="width:220px" clearable @change="fetchLogs" />
        <el-select v-model="filterStatusCode" placeholder="状态码" size="small" style="width:100px" clearable @change="fetchLogs">
          <el-option label="5xx" value="500" />
          <el-option label="4xx" value="400" />
          <el-option label="401" value="401" />
          <el-option label="403" value="403" />
          <el-option label="404" value="404" />
          <el-option label="409" value="409" />
          <el-option label="429" value="429" />
        </el-select>
        <el-select v-model="filterResolved" placeholder="状态" size="small" style="width:100px" @change="fetchLogs">
          <el-option label="未处理" value="false" />
          <el-option label="已处理" value="true" />
          <el-option label="全部" value="" />
        </el-select>
        <el-button size="small" @click="fetchLogs" :icon="RefreshRight">刷新</el-button>
        <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" style="margin-left:4px" @change="onAutoRefresh" />
      </div>
      <div class="tb-right">
        <el-button size="small" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</el-button>
        <el-button size="small" type="primary" @click="batchResolve" :disabled="selectedIds.length === 0">标记已处理 ({{ selectedIds.length }})</el-button>
        <el-button size="small" type="danger" plain @click="clearResolved" :disabled="!hasResolved">清空已处理</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="el-list" v-loading="loading">
      <div
        v-for="log in logs" :key="log._id"
        class="el-card" :class="{ 'el-unresolved': !log.resolved }"
        @click="showDetail(log)"
      >
        <div class="el-card-left">
          <span :class="['el-card-badge', log.statusCode >= 500 ? 'badge-err' : 'badge-warn']">{{ log.statusCode }}</span>
        </div>
        <div class="el-card-body">
          <div class="el-card-row1">
            <span class="el-method">{{ log.method }}</span>
            <span class="el-path" :title="log.path">{{ log.path }}</span>
            <span class="el-time">{{ relativeTime(log.createdAt) }}</span>
            <span v-if="!log.resolved" class="el-tag-new">NEW</span>
          </div>
          <div class="el-card-row2">{{ log.message }}</div>
          <div class="el-card-row3">
            <span v-if="log.username" class="el-user">👤 {{ log.username }}</span>
            <span class="el-env">{{ log.nodeEnv || 'prod' }}</span>
          </div>
        </div>
        <div class="el-card-right" @click.stop>
          <el-checkbox :model-value="selectedIds.includes(log._id)" @change="(v) => toggleSelect(log._id, v)" />
        </div>
      </div>
      <el-empty v-if="logs.length === 0 && !loading" description="暂无错误记录 🎉" :image-size="60" />
    </div>

    <!-- 分页 -->
    <div class="el-pagination" v-if="totalPages > 1">
      <el-pagination
        v-model:current-page="page"
        :page-size="limit"
        :total="total"
        layout="prev, pager, next, total"
        @current-change="fetchLogs"
        size="small"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="错误详情" width="760px" destroy-on-close top="3vh">
      <template v-if="detailLog">
        <el-descriptions :column="2" border size="small" style="margin-bottom:16px">
          <el-descriptions-item label="状态码">
            <el-tag :type="detailLog.statusCode >= 500 ? 'danger' : 'warning'" size="small">{{ detailLog.statusCode }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="时间">{{ formatTime(detailLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="请求">{{ detailLog.method }} {{ detailLog.path }}</el-descriptions-item>
          <el-descriptions-item label="用户">{{ detailLog.username || '匿名' }}<span v-if="detailLog.userRole"> ({{ detailLog.userRole }})</span></el-descriptions-item>
          <el-descriptions-item label="环境">{{ detailLog.nodeEnv }} / {{ detailLog.hostname }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detailLog.resolved ? 'success' : 'danger'" size="small">{{ detailLog.resolved ? '已处理' : '未处理' }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <div class="detail-section-title">错误消息</div>
          <div class="detail-msg">{{ detailLog.message }}</div>
        </div>

        <div v-if="detailLog.stack" class="detail-section">
          <div class="detail-section-title" @click="showStack = !showStack" style="cursor:pointer;user-select:none">
            堆栈跟踪 {{ showStack ? '▾' : '▸' }}
          </div>
          <pre v-if="showStack" class="detail-pre">{{ detailLog.stack }}</pre>
        </div>

        <div v-if="detailLog.body && Object.keys(detailLog.body).length" class="detail-section">
          <div class="detail-section-title" @click="showBody = !showBody" style="cursor:pointer;user-select:none">
            请求体 {{ showBody ? '▾' : '▸' }}
          </div>
          <pre v-if="showBody" class="detail-pre">{{ JSON.stringify(detailLog.body, null, 2) }}</pre>
        </div>

        <div v-if="detailLog.headers && Object.keys(detailLog.headers).length" class="detail-section">
          <div class="detail-section-title" @click="showHeaders = !showHeaders" style="cursor:pointer;user-select:none">
            请求头 {{ showHeaders ? '▾' : '▸' }}
          </div>
          <pre v-if="showHeaders" class="detail-pre">{{ JSON.stringify(detailLog.headers, null, 2) }}</pre>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="danger" plain size="small" @click="deleteLog(detailLog._id)">删除</el-button>
        <el-button v-if="!detailLog?.resolved" type="primary" @click="resolveLog(detailLog._id)">标记已处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { RefreshRight } from '@element-plus/icons-vue';

const logs = ref([]);
const total = ref(0);
const totalPages = ref(0);
const page = ref(1);
const limit = 30;
const loading = ref(false);
const keyword = ref('');
const filterStatusCode = ref('');
const filterResolved = ref('false');
const selectedIds = ref([]);
const summary = ref(null);
const unresolvedCount = ref(0);
const autoRefresh = ref(false);
let refreshTimer = null;

const detailVisible = ref(false);
const detailLog = ref(null);
const showStack = ref(false);
const showBody = ref(false);
const showHeaders = ref(false);

const token = () => localStorage.getItem('token');

const allSelected = computed(() => logs.value.length > 0 && selectedIds.value.length === logs.value.length);
const hasResolved = computed(() => logs.value.some(l => l.resolved));

async function fetchLogs() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, limit, resolved: filterResolved.value });
    if (keyword.value) params.set('keyword', keyword.value);
    if (filterStatusCode.value) params.set('statusCode', filterStatusCode.value);
    const res = await fetch(`/api/v1/error-logs?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    const json = await res.json();
    logs.value = json.data || [];
    total.value = json.total || 0;
    totalPages.value = json.totalPages || 0;
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

async function fetchSummary() {
  try {
    const res = await fetch('/api/v1/error-logs/stats/summary', { headers: { Authorization: `Bearer ${token()}` } });
    const json = await res.json();
    summary.value = json.data;
    unresolvedCount.value = json.data?.unresolved || 0;
  } catch { /* ignore */ }
}

function onAutoRefresh(val) {
  clearInterval(refreshTimer);
  if (val) {
    fetchLogs(); fetchSummary();
    refreshTimer = setInterval(() => { fetchLogs(); fetchSummary(); }, 10000);
  }
}

function toggleSelect(id, val) {
  if (val) selectedIds.value.push(id);
  else selectedIds.value = selectedIds.value.filter(x => x !== id);
}

function toggleSelectAll() {
  if (allSelected.value) { selectedIds.value = []; return; }
  selectedIds.value = logs.value.map(l => l._id);
}

async function batchResolve() {
  if (selectedIds.value.length === 0) return;
  try { await ElMessageBox.confirm(`确认标记 ${selectedIds.value.length} 条为已处理？`, '批量处理', { type: 'info' }); } catch { return; }
  try {
    await fetch('/api/v1/error-logs/batch-resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ids: [...selectedIds.value] }),
    });
    selectedIds.value = [];
    ElMessage.success('已标记');
    fetchLogs(); fetchSummary();
  } catch (e) { ElMessage.error('操作失败'); }
}

async function clearResolved() {
  try { await ElMessageBox.confirm('确认删除所有已处理的错误记录？此操作不可撤销。', '清空已处理', { type: 'warning', confirmButtonText: '确认删除' }); } catch { return; }
  try {
    const ids = logs.value.filter(l => l.resolved).map(l => l._id);
    for (const id of ids) {
      await fetch(`/api/v1/error-logs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    }
    ElMessage.success(`已删除 ${ids.length} 条`);
    fetchLogs(); fetchSummary();
  } catch (e) { ElMessage.error('操作失败'); }
}

async function resolveLog(id) {
  try {
    await fetch(`/api/v1/error-logs/${id}/resolve`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ note: '' }),
    });
    ElMessage.success('已标记');
    detailVisible.value = false;
    fetchLogs(); fetchSummary();
  } catch (e) { ElMessage.error('操作失败'); }
}

async function deleteLog(id) {
  try { await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' }); } catch { return; }
  try {
    await fetch(`/api/v1/error-logs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    ElMessage.success('已删除');
    detailVisible.value = false;
    fetchLogs(); fetchSummary();
  } catch (e) { ElMessage.error('删除失败'); }
}

function showDetail(log) {
  detailLog.value = log;
  showStack.value = false;
  showBody.value = false;
  showHeaders.value = false;
  detailVisible.value = true;
}

function formatTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : ''; }

function relativeTime(t) {
  if (!t) return '';
  const diff = Date.now() - new Date(t).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  if (sec < 3600) return Math.floor(sec / 60) + '分钟前';
  if (sec < 86400) return Math.floor(sec / 3600) + '小时前';
  if (sec < 604800) return Math.floor(sec / 86400) + '天前';
  return new Date(t).toLocaleDateString('zh-CN');
}

// Socket
import { useSocket } from '../components/useSocket';
const { on: socketOn, connect } = useSocket();
socketOn('error-log:new', (data) => {
  unresolvedCount.value++;
  if (summary.value) summary.value.unresolved = (summary.value.unresolved || 0) + 1;
  ElMessage.warning({ message: `${data.statusCode} ${data.path} — ${data.message?.substring(0, 50)}`, duration: 5000 });
});

onMounted(() => { connect(); fetchLogs(); fetchSummary(); });
onUnmounted(() => { clearInterval(refreshTimer); });
</script>

<style scoped>
.el-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }

/* 统计卡片 */
.el-stats { display: flex; gap: 12px; margin-bottom: 14px; flex-shrink: 0; }
.stat-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-width: 80px; padding: 12px 16px; border-radius: 10px;
  background: var(--bg-200); border: 1px solid var(--bg-300);
}
.stat-num { font-size: 24px; font-weight: 800; line-height: 1.2; }
.stat-label { font-size: 11px; color: var(--text-200); margin-top: 2px; }
.stat-today .stat-num { color: var(--primary-100); }
.stat-unresolved .stat-num { color: var(--text-200); }
.stat-unresolved.has-err .stat-num { color: #f56c6c; }
.stat-total .stat-num { color: var(--text-100); }
.stat-paths { flex: 1; align-items: flex-start; gap: 4px; min-width: 200px; padding: 10px 14px; }
.stat-path-tag { font-size: 11px; color: var(--text-100); background: var(--bg-100); padding: 2px 8px; border-radius: 4px; }
.stat-path-tag b { color: var(--accent-100); }

/* 工具栏 */
.el-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; gap: 8px; flex-wrap: wrap; }
.tb-left { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.tb-right { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

/* 面包屑红点 */
.error-badge-sm {
  display: inline-block; min-width: 18px; height: 18px; line-height: 18px;
  padding: 0 5px; border-radius: 9px; background: #f56c6c; color: #fff;
  font-size: 11px; font-weight: 700; text-align: center; margin-left: 8px; vertical-align: middle;
}

/* 列表 */
.el-list { flex: 1; overflow-y: auto; min-height: 0; }
.el-card {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 8px; background: var(--bg-200);
  margin-bottom: 5px; cursor: pointer; border-left: 3px solid transparent;
  transition: background 0.12s;
}
.el-card:hover { background: var(--bg-100); }
.el-unresolved { border-left-color: #f56c6c; }
.el-card-left { flex-shrink: 0; }
.el-card-body { flex: 1; min-width: 0; }
.el-card-right { flex-shrink: 0; display: flex; align-items: center; }
.el-card-badge { padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; line-height: 1.6; }
.badge-warn { background: #e6a23c20; color: #e6a23c; }
.badge-err { background: #f56c6c20; color: #f56c6c; }

.el-card-row1 { display: flex; gap: 8px; align-items: center; margin-bottom: 3px; }
.el-method { font-size: 10px; font-weight: 700; color: var(--accent-100); background: var(--accent-200); padding: 1px 5px; border-radius: 3px; }
.el-path { font-size: 13px; font-weight: 600; color: var(--text-100); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.el-time { font-size: 11px; color: var(--primary-300); margin-left: auto; white-space: nowrap; flex-shrink: 0; }
.el-tag-new { font-size: 9px; font-weight: 700; color: #f56c6c; background: #fef0f0; padding: 1px 4px; border-radius: 3px; flex-shrink: 0; }

.el-card-row2 { font-size: 12px; color: var(--text-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
.el-card-row3 { display: flex; gap: 12px; font-size: 11px; color: var(--primary-300); }
.el-user { color: var(--text-200); }
.el-env { color: var(--primary-300); }

/* 分页 */
.el-pagination { display: flex; justify-content: center; padding: 10px 0; flex-shrink: 0; }

/* 详情 */
.detail-section { margin-bottom: 14px; }
.detail-section-title { font-size: 13px; font-weight: 700; color: var(--text-100); margin-bottom: 6px; }
.detail-msg { font-size: 14px; color: #f56c6c; padding: 10px 14px; background: #fef0f0; border-radius: 6px; line-height: 1.6; word-break: break-all; }
.detail-pre {
  background: #1a1a2e; color: #ccc; padding: 12px 14px; border-radius: 6px;
  font-size: 11px; line-height: 1.55; max-height: 260px; overflow: auto;
  white-space: pre-wrap; word-break: break-all; margin: 0;
}
</style>
