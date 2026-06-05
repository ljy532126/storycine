<template>
  <div class="el-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">错误日志</span>
      <el-badge v-if="unresolvedCount > 0" :value="unresolvedCount" class="el-badge" />
    </div>

    <div class="el-toolbar">
      <div style="display:flex;gap:8px;align-items:center">
        <el-input v-model="keyword" placeholder="搜索错误/路径/用户" size="small" style="width:240px" clearable @change="fetchLogs" />
        <el-select v-model="filterStatusCode" placeholder="状态码" size="small" style="width:110px" clearable @change="fetchLogs">
          <el-option label="4xx" value="400" />
          <el-option label="500" value="500" />
          <el-option label="401" value="401" />
          <el-option label="403" value="403" />
          <el-option label="404" value="404" />
          <el-option label="409" value="409" />
          <el-option label="429" value="429" />
        </el-select>
        <el-select v-model="filterResolved" placeholder="状态" size="small" style="width:100px" @change="fetchLogs">
          <el-option label="未处理" value="false" />
          <el-option label="已处理" value="true" />
        </el-select>
        <el-button size="small" @click="fetchLogs">刷新</el-button>
      </div>
      <div style="display:flex;gap:6px">
        <el-button size="small" type="primary" @click="batchResolve" :disabled="selectedIds.length === 0">批量标记已处理</el-button>
        <span style="font-size:12px;color:var(--text-200);line-height:28px">共 {{ total }} 条</span>
      </div>
    </div>

    <div class="el-summary" v-if="summary">
      <span>今日新增 <b>{{ summary.todayCount }}</b></span>
      <span>未处理 <b style="color:var(--red)">{{ summary.unresolved }}</b></span>
      <span>总计 <b>{{ summary.total }}</b></span>
    </div>

    <div class="el-list" v-loading="loading">
      <div v-for="log in logs" :key="log._id" class="el-card" :class="{ 'el-unresolved': !log.resolved }" @click="showDetail(log)">
        <div class="el-card-left">
          <span :class="['el-badge', log.statusCode >= 500 ? 'el-badge-err' : 'el-badge-warn']">{{ log.statusCode }}</span>
        </div>
        <div class="el-card-body">
          <div class="el-card-top">
            <span class="el-method">{{ log.method }}</span>
            <span class="el-path" :title="log.path">{{ log.path }}</span>
          </div>
          <div class="el-message">{{ log.message }}</div>
          <div class="el-meta">
            <span>{{ formatTime(log.createdAt) }}</span>
            <span v-if="log.username">{{ log.username }}</span>
            <span v-if="log.userRole">({{ log.userRole }})</span>
          </div>
        </div>
        <div class="el-card-right">
          <el-checkbox :model-value="selectedIds.includes(log._id)" @change="(v) => toggleSelect(log._id, v)" @click.stop />
        </div>
      </div>
      <el-empty v-if="logs.length === 0 && !loading" description="暂无错误记录 🎉" :image-size="60" />
    </div>

    <div class="el-pagination" v-if="totalPages > 1">
      <el-pagination
        v-model:current-page="page"
        :page-size="limit"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchLogs"
        size="small"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="错误详情" width="700px" destroy-on-close>
      <div class="detail-grid" v-if="detailLog">
        <div class="dg-row"><span class="dg-label">状态码</span><span :class="detailLog.statusCode >= 500 ? 'color-red' : 'color-orange'">{{ detailLog.statusCode }}</span></div>
        <div class="dg-row"><span class="dg-label">请求</span><span>{{ detailLog.method }} {{ detailLog.path }}</span></div>
        <div class="dg-row"><span class="dg-label">时间</span><span>{{ formatTime(detailLog.createdAt) }}</span></div>
        <div class="dg-row"><span class="dg-label">用户</span><span>{{ detailLog.username || '匿名' }} ({{ detailLog.userRole || '-' }})</span></div>
        <div class="dg-row"><span class="dg-label">环境</span><span>{{ detailLog.nodeEnv }} / {{ detailLog.hostname }}</span></div>
        <div class="dg-row"><span class="dg-label">消息</span><span class="color-red">{{ detailLog.message }}</span></div>
        <div v-if="detailLog.stack" class="dg-row dg-stack"><span class="dg-label">堆栈</span><pre>{{ detailLog.stack }}</pre></div>
        <div v-if="detailLog.body && Object.keys(detailLog.body).length" class="dg-row dg-stack">
          <span class="dg-label">请求体</span><pre>{{ JSON.stringify(detailLog.body, null, 2) }}</pre>
        </div>
        <div class="dg-row"><span class="dg-label">状态</span><span>{{ detailLog.resolved ? '✅ 已处理' : '⚠️ 未处理' }}</span></div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="danger" size="small" @click="deleteLog(detailLog._id)">删除</el-button>
        <el-button v-if="!detailLog?.resolved" type="primary" @click="resolveLog(detailLog._id)">标记已处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useSocket } from '../components/useSocket';

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

const detailVisible = ref(false);
const detailLog = ref(null);

const token = () => localStorage.getItem('token');

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
  } catch (e) { ElMessage.error('加载失败'); }
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

function toggleSelect(id, val) {
  if (val) selectedIds.value.push(id);
  else selectedIds.value = selectedIds.value.filter(x => x !== id);
}

async function batchResolve() {
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
  detailVisible.value = true;
}

function formatTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : ''; }

// Socket.IO 实时监听新错误
const { on: socketOn, connect } = useSocket();
socketOn('error-log:new', (data) => {
  unresolvedCount.value++;
  if (summary.value) summary.value.unresolved = (summary.value.unresolved || 0) + 1;
  ElMessage.warning(`新错误: ${data.statusCode} ${data.path} — ${data.message?.substring(0, 60)}`);
});

onMounted(() => { connect(); fetchLogs(); fetchSummary(); });
</script>

<style scoped>
.el-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.el-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
.el-badge { flex-shrink: 0; }
.el-summary { display: flex; gap: 24px; padding: 8px 14px; background: var(--bg-200); border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: var(--text-200); }
.el-list { flex: 1; overflow-y: auto; min-height: 0; }
.el-card { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 8px; background: var(--bg-200); margin-bottom: 6px; cursor: pointer; border-left: 3px solid transparent; transition: all 0.15s; }
.el-card:hover { background: var(--bg-100); }
.el-unresolved { border-left-color: var(--red, #f56c6c); }
.el-card-left { flex-shrink: 0; }
.el-card-body { flex: 1; min-width: 0; }
.el-card-top { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.el-card-right { flex-shrink: 0; }
.el-method { font-size: 11px; font-weight: 700; color: var(--gold-dark); }
.el-path { font-size: 13px; font-weight: 600; color: var(--text-100); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.el-message { font-size: 12px; color: var(--text-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
.el-meta { display: flex; gap: 12px; font-size: 11px; color: var(--primary-300); }
.el-badge-warn { background: #e6a23c20; color: #e6a23c; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; }
.el-badge-err { background: #f56c6c20; color: #f56c6c; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; }
.color-red { color: #f56c6c; }
.color-orange { color: #e6a23c; }
.detail-grid { display: flex; flex-direction: column; gap: 8px; }
.dg-row { display: flex; gap: 12px; font-size: 13px; }
.dg-label { width: 60px; flex-shrink: 0; color: var(--text-200); font-weight: 600; }
.dg-stack { flex-direction: column; }
.dg-stack pre { background: #1a1a2e; color: #e0e0e0; padding: 10px 14px; border-radius: 6px; font-size: 11px; line-height: 1.5; max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
.el-pagination { display: flex; justify-content: center; padding: 12px 0; flex-shrink: 0; }
</style>
