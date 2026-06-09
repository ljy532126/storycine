<template>
  <div class="err-root">
    <div class="err-topbar">
      <div class="err-topbar-left">
        <span class="err-logo">⚡ Error Monitor</span>
        <span v-if="unresolvedCount > 0" class="err-pulse-badge">
          <span class="err-pulse-dot"></span>
          {{ unresolvedCount > 99 ? '99+' : unresolvedCount }} 未处理
        </span>
      </div>
      <div class="err-topbar-right">
        <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" @change="onAutoRefresh" />
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="err-stat-row">
      <div class="err-stat err-stat-today" @click="filterResolved = ''; fetchLogs()">
        <div class="err-stat-icon"><Time theme="outline" size="20" fill="#409eff" /></div>
        <div><span class="err-stat-num">{{ summary?.todayCount || 0 }}</span><span class="err-stat-lbl">今日新增</span></div>
      </div>
      <div class="err-stat err-stat-urgent" @click="filterResolved = 'false'; fetchLogs()">
        <div class="err-stat-icon"><Alarm theme="outline" size="20" fill="#f56c6c" /></div>
        <div><span class="err-stat-num" :class="{ blink: (summary?.unresolved||0) > 0 }">{{ summary?.unresolved || 0 }}</span><span class="err-stat-lbl">待处理</span></div>
        <span v-if="(summary?.unresolved||0) > 0" class="err-stat-glow"></span>
      </div>
      <div class="err-stat err-stat-total">
        <div class="err-stat-icon"><Caution theme="outline" size="20" fill="#e6a23c" /></div>
        <div><span class="err-stat-num">{{ summary?.total || 0 }}</span><span class="err-stat-lbl">总计</span></div>
      </div>
      <div class="err-stat err-stat-paths" v-if="summary?.topPaths?.length">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <Data theme="outline" size="14" fill="var(--text-200)" />
          <span class="err-stat-lbl" style="margin:0">高频接口</span>
        </div>
        <div class="err-path-tags">
          <span v-for="p in summary.topPaths.slice(0, 3)" :key="p._id" class="err-path-tag">{{ p._id }}<b>{{ p.count }}</b></span>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="err-bar">
      <div class="err-bar-left">
        <el-input v-model="keyword" placeholder="搜索错误 / 路径 / 用户" size="default" style="width:240px" clearable @change="fetchLogs" class="err-search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filterStatusCode" placeholder="状态码" size="default" style="width:110px" clearable @change="fetchLogs">
          <el-option label="5xx 服务端" value="500" /><el-option label="4xx 客户端" value="400" />
          <el-option label="401 未授权" value="401" /><el-option label="403 禁止" value="403" />
          <el-option label="404 不存在" value="404" /><el-option label="429 限流" value="429" />
        </el-select>
        <el-select v-model="filterResolved" placeholder="状态" size="default" style="width:100px" @change="fetchLogs">
          <el-option label="未处理" value="false" /><el-option label="已处理" value="true" /><el-option label="全部" value="" />
        </el-select>
        <el-button size="default" @click="fetchLogs"><el-icon><Refresh /></el-icon></el-button>
      </div>
      <div class="err-bar-right">
        <el-button size="default" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</el-button>
        <el-button size="default" type="primary" @click="batchResolve" :disabled="selectedIds.length === 0" plain>标记已处理 ({{ selectedIds.length }})</el-button>
        <el-button size="default" type="danger" @click="clearResolved" :disabled="!hasResolved" plain>清空已处理</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="err-list" v-loading="loading">
      <div
        v-for="log in logs" :key="log._id"
        :class="['err-card', { unresolved: !log.resolved }]"
        @click="showDetail(log)"
      >
        <div :class="['err-card-stripe', log.statusCode >= 500 ? 'stripe-500' : 'stripe-400']"></div>
        <div class="err-card-check" @click.stop>
          <el-checkbox :model-value="selectedIds.includes(log._id)" @change="(v) => toggleSelect(log._id, v)" />
        </div>
        <div class="err-card-main">
          <div class="err-card-top">
            <span :class="['err-code', log.statusCode >= 500 ? 'code-500' : 'code-400']">{{ log.statusCode }}</span>
            <span class="err-method">{{ log.method }}</span>
            <span class="err-path" :title="log.path">{{ log.path }}</span>
            <span v-if="!log.resolved" class="err-new-badge">NEW</span>
            <span class="err-time">{{ relativeTime(log.createdAt) }}</span>
          </div>
          <div class="err-card-msg">{{ log.message }}</div>
          <div class="err-card-meta">
            <span v-if="log.username" class="err-meta-item"><User theme="outline" size="12" fill="currentColor" /> {{ log.username }}</span>
            <span class="err-meta-item"><Monitor theme="outline" size="12" fill="currentColor" /> {{ log.nodeEnv || 'prod' }}</span>
          </div>
        </div>
      </div>
      <div v-if="logs.length === 0 && !loading" class="err-empty">
        <Success theme="outline" size="48" fill="#67c23a" />
        <p>暂无错误记录</p>
        <span>所有接口运行正常</span>
      </div>
    </div>

    <!-- 分页 -->
    <div class="err-pager" v-if="totalPages > 1">
      <el-pagination v-model:current-page="page" :page-size="limit" :total="total" layout="prev, pager, next, total" @current-change="fetchLogs" size="default" background />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" width="820px" destroy-on-close top="2vh" class="err-dialog">
      <template #header>
        <div class="err-detail-head" v-if="detailLog">
          <span :class="['err-detail-code', detailLog.statusCode >= 500 ? 'code-500' : 'code-400']">{{ detailLog.statusCode }}</span>
          <span class="err-detail-method">{{ detailLog.method }}</span>
          <span class="err-detail-path">{{ detailLog.url || detailLog.path }}</span>
          <span v-if="!detailLog.resolved" class="err-detail-status unresolved">未处理</span>
          <span v-else class="err-detail-status resolved">已处理</span>
        </div>
      </template>

      <div v-if="detailLog" v-loading="detailLoading" class="err-detail-body">
        <!-- 元信息 -->
        <div class="err-detail-meta">
          <div class="err-dm-item"><span class="err-dm-label">时间</span><span class="err-dm-val">{{ formatTime(detailLog.createdAt) }}</span></div>
          <div class="err-dm-item"><span class="err-dm-label">用户</span><span class="err-dm-val">{{ detailLog.username || '匿名' }}<template v-if="detailLog.userRole"> · {{ detailLog.userRole }}</template></span></div>
          <div class="err-dm-item"><span class="err-dm-label">环境</span><span class="err-dm-val">{{ detailLog.nodeEnv || 'production' }}</span></div>
        </div>

        <!-- 错误消息 -->
        <div class="err-detail-msg">{{ detailLog.message }}</div>

        <!-- AI 分析 -->
        <div v-if="aiResult" class="err-detail-ai">
          <div class="err-detail-ai-head">
            <span class="err-detail-ai-dot"></span> AI 分析
          </div>
          <div v-for="(block, i) in aiBlocks" :key="i" class="err-detail-ai-block">
            <div v-if="block.title" class="err-detail-ai-title">{{ block.title }}</div>
            <div v-if="block.text" class="err-detail-ai-text">{{ block.text }}</div>
            <pre v-if="block.code" class="err-pre">{{ block.code }}</pre>
          </div>
        </div>

        <!-- 请求体 -->
        <div class="err-detail-section" v-if="hasBody">
          <div class="err-ds-head" @click="showBody = !showBody">
            <span>{{ showBody ? '▾' : '▸' }}</span> 请求体 Request Body
          </div>
          <pre v-if="showBody" class="err-pre">{{ prettyBody }}</pre>
        </div>

        <!-- Query -->
        <div class="err-detail-section" v-if="hasQuery">
          <div class="err-ds-head" @click="showQuery = !showQuery">
            <span>{{ showQuery ? '▾' : '▸' }}</span> URL 参数 Query String
          </div>
          <pre v-if="showQuery" class="err-pre">{{ JSON.stringify(detailLog.query, null, 2) }}</pre>
        </div>

        <!-- Headers -->
        <div class="err-detail-section" v-if="hasHeaders">
          <div class="err-ds-head" @click="showHeaders = !showHeaders">
            <span>{{ showHeaders ? '▾' : '▸' }}</span> 请求头 Headers
          </div>
          <pre v-if="showHeaders" class="err-pre">{{ JSON.stringify(detailLog.headers, null, 2) }}</pre>
        </div>

        <!-- 堆栈 -->
        <div class="err-detail-section" v-if="detailLog.stack">
          <div class="err-ds-head" @click="showStack = !showStack">
            <span>{{ showStack ? '▾' : '▸' }}</span> 堆栈跟踪 Stack Trace
          </div>
          <pre v-if="showStack" class="err-pre err-pre-stack">{{ detailLog.stack }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="danger" plain @click="deleteLog(detailLog._id)">删除</el-button>
        <el-button v-if="!detailLog?.resolved" type="primary" @click="resolveLog(detailLog._id)">标记已处理</el-button>
        <el-button type="success" @click="aiAnalyze" :loading="analyzing">
          <el-icon><MagicStick /></el-icon> AI 分析
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search, MagicStick } from '@element-plus/icons-vue';
import { Time, Alarm, Caution, Data, User, Monitor, Success } from '@icon-park/vue-next';
import { useSocket } from '../components/useSocket';

const logs = ref([]); const total = ref(0); const totalPages = ref(0);
const page = ref(1); const limit = 30; const loading = ref(false);
const keyword = ref(''); const filterStatusCode = ref(''); const filterResolved = ref('false');
const selectedIds = ref([]); const summary = ref(null); const unresolvedCount = ref(0);
const autoRefresh = ref(false); let refreshTimer = null;

const detailVisible = ref(false); const detailLog = ref(null); const detailLoading = ref(false);
const showStack = ref(false); const showBody = ref(true); const showQuery = ref(true); const showHeaders = ref(false);

const hasBody = computed(() => detailLog.value?.body && Object.keys(detailLog.value.body).length > 0);
const hasQuery = computed(() => detailLog.value?.query && Object.keys(detailLog.value.query).length > 0);
const hasHeaders = computed(() => detailLog.value?.headers && Object.keys(detailLog.value.headers).length > 0);
const prettyBody = computed(() => { const b = detailLog.value?.body; if (!b) return ''; try { return JSON.stringify(b, null, 2); } catch { return String(b); } });
const token = () => localStorage.getItem('token');
const allSelected = computed(() => logs.value.length > 0 && selectedIds.value.length === logs.value.length);
const hasResolved = computed(() => logs.value.some(l => l.resolved));

async function fetchLogs() { loading.value = true; try { const p = new URLSearchParams({ page: page.value, limit, resolved: filterResolved.value }); if (keyword.value) p.set('keyword', keyword.value); if (filterStatusCode.value) p.set('statusCode', filterStatusCode.value); const r = await fetch(`/api/v1/error-logs?${p}`, { headers: { Authorization: `Bearer ${token()}` } }); const j = await r.json(); logs.value = j.data || []; total.value = j.total || 0; totalPages.value = j.totalPages || 0; } catch {} finally { loading.value = false; } }
async function fetchSummary() { try { const r = await fetch('/api/v1/error-logs/stats/summary', { headers: { Authorization: `Bearer ${token()}` } }); const j = await r.json(); summary.value = j.data; unresolvedCount.value = j.data?.unresolved || 0; } catch {} }
function onAutoRefresh(v) { clearInterval(refreshTimer); if (v) { fetchLogs(); fetchSummary(); refreshTimer = setInterval(() => { fetchLogs(); fetchSummary(); }, 10000); } }
function toggleSelect(id, v) { if (v) selectedIds.value.push(id); else selectedIds.value = selectedIds.value.filter(x => x !== id); }
function toggleSelectAll() { if (allSelected.value) { selectedIds.value = []; return; } selectedIds.value = logs.value.map(l => l._id); }
async function batchResolve() { if (selectedIds.value.length === 0) return; try { await ElMessageBox.confirm(`确认标记 ${selectedIds.value.length} 条为已处理？`, '批量处理', { type: 'info' }); } catch { return; } try { await fetch('/api/v1/error-logs/batch-resolve', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ ids: [...selectedIds.value] }) }); selectedIds.value = []; ElMessage.success('已标记'); fetchLogs(); fetchSummary(); } catch { ElMessage.error('操作失败'); } }
async function clearResolved() { try { await ElMessageBox.confirm('确认删除所有已处理的错误记录？', '清空已处理', { type: 'warning', confirmButtonText: '确认删除' }); } catch { return; } try { const ids = logs.value.filter(l => l.resolved).map(l => l._id); for (const id of ids) await fetch(`/api/v1/error-logs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }); ElMessage.success(`已删除 ${ids.length} 条`); fetchLogs(); fetchSummary(); } catch { ElMessage.error('操作失败'); } }
async function resolveLog(id) { try { await fetch(`/api/v1/error-logs/${id}/resolve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ note: '' }) }); ElMessage.success('已标记'); detailVisible.value = false; fetchLogs(); fetchSummary(); } catch { ElMessage.error('操作失败'); } }
async function deleteLog(id) { try { await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' }); } catch { return; } try { await fetch(`/api/v1/error-logs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }); ElMessage.success('已删除'); detailVisible.value = false; fetchLogs(); fetchSummary(); } catch { ElMessage.error('删除失败'); } }
async function showDetail(log) { detailLog.value = log; showStack.value = false; showBody.value = true; showQuery.value = true; showHeaders.value = false; detailVisible.value = true; if (log._id) { detailLoading.value = true; try { const r = await fetch(`/api/v1/error-logs/${log._id}`, { headers: { Authorization: `Bearer ${token()}` } }); const j = await r.json(); if (j.data) detailLog.value = j.data; } catch {} finally { detailLoading.value = false; } } }
function formatTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : ''; }

const analyzing = ref(false); const aiResult = ref(null);
const aiBlocks = computed(() => { if (!aiResult.value) return []; const text = aiResult.value; const blocks = []; const sections = text.split(/\n(?=##\s)/); sections.forEach(s => { const lines = s.trim().split('\n'); const title = lines[0].replace(/^##\s*/, '').trim(); const body = lines.slice(1).join('\n').trim(); if (body.startsWith('```') && body.endsWith('```')) { blocks.push({ title, code: body.replace(/^```\w*\n?/, '').replace(/\n?```$/, '') }); } else { blocks.push({ title, text: body }); } }); return blocks.length ? blocks : [{ title: '分析结果', text }]; });
async function aiAnalyze() { if (!detailLog.value) return; analyzing.value = true; aiResult.value = null; try { const r = await fetch(`/api/v1/error-logs/${detailLog.value._id}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` } }); const d = await r.json(); if (d.data?.analysis) aiResult.value = d.data.analysis; else ElMessage.error(d.message || 'AI 分析失败'); } catch { ElMessage.error('AI 分析请求失败'); } finally { analyzing.value = false; } }
function relativeTime(t) { if (!t) return ''; const diff = Date.now() - new Date(t).getTime(); const s = Math.floor(diff / 1000); if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + '分钟前'; if (s < 86400) return Math.floor(s / 3600) + '小时前'; if (s < 604800) return Math.floor(s / 86400) + '天前'; return new Date(t).toLocaleDateString('zh-CN'); }

const { on: socketOn, connect } = useSocket();
socketOn('error-log:new', (data) => { unresolvedCount.value++; if (summary.value) summary.value.unresolved = (summary.value.unresolved || 0) + 1; ElMessage.warning({ message: `${data.statusCode} ${data.path} — ${data.message?.substring(0, 50)}`, duration: 5000 }); });

onMounted(() => { connect(); fetchLogs(); fetchSummary(); });
onUnmounted(() => { clearInterval(refreshTimer); });
</script>

<style scoped>
.err-root { display: flex; flex-direction: column; height: calc(100vh - 100px); padding: 0; }

/* ===== 顶栏 ===== */
.err-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.err-logo { font-size: 15px; font-weight: 700; color: var(--text-100); letter-spacing: 0.5px; }
.err-pulse-badge { display: inline-flex; align-items: center; gap: 6px; margin-left: 12px; font-size: 12px; font-weight: 600; color: #f56c6c; background: rgba(245,108,108,0.08); padding: 4px 12px; border-radius: 20px; }
.err-pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #f56c6c; animation: errPulse 1.5s ease-in-out infinite; }
@keyframes errPulse { 0%, 100% { box-shadow: 0 0 4px rgba(245,108,108,0.3); } 50% { box-shadow: 0 0 14px rgba(245,108,108,0.7); } }

/* ===== 统计卡片 ===== */
.err-stat-row { display: grid; grid-template-columns: 1fr 1fr 1fr 2fr; gap: 10px; margin-bottom: 16px; flex-shrink: 0; }
.err-stat { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 12px; background: var(--bg-200); border: 1px solid var(--bg-300); cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
.err-stat:hover { border-color: var(--gold); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
.err-stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.err-stat-today .err-stat-icon { background: rgba(64,158,255,0.08); }.err-stat-urgent .err-stat-icon { background: rgba(245,108,108,0.08); }.err-stat-total .err-stat-icon { background: rgba(230,162,60,0.08); }
.err-stat-num { font-size: 26px; font-weight: 900; color: var(--text-100); display: block; line-height: 1; font-family: 'DM Sans', sans-serif; }
.err-stat-lbl { font-size: 11px; color: var(--text-200); margin-top: 2px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
.err-stat-urgent .err-stat-num { color: #f56c6c; }
.err-stat-urgent .err-stat-num.blink { animation: errBlink 2s ease-in-out infinite; }
@keyframes errBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.err-stat-glow { position: absolute; right: -20px; top: -20px; width: 80px; height: 80px; background: radial-gradient(circle, rgba(245,108,108,0.08) 0%, transparent 70%); pointer-events: none; }
.err-stat-paths { align-items: flex-start; flex-direction: column; gap: 6px; cursor: default; min-width: 200px; }
.err-stat-paths:hover { transform: none; box-shadow: none; }
.err-path-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.err-path-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--bg-100); color: var(--text-100); }
.err-path-tag b { color: #e6a23c; margin-left: 3px; }

/* ===== 工具栏 ===== */
.err-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; gap: 10px; flex-wrap: wrap; }
.err-bar-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.err-bar-right { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.err-search :deep(.el-input__wrapper) { background: var(--bg-200); border-color: var(--bg-300); }

/* ===== 列表 ===== */
.err-list { flex: 1; overflow-y: auto; min-height: 0; display: flex; flex-direction: column; gap: 3px; }
.err-card { display: flex; align-items: flex-start; gap: 0; padding: 14px 16px; border-radius: 10px; background: var(--bg-200); border: 1px solid var(--bg-300); cursor: pointer; transition: all 0.18s; overflow: hidden; }
.err-card:hover { border-color: var(--gold); background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.err-card-stripe { width: 4px; border-radius: 2px; align-self: stretch; flex-shrink: 0; margin-right: 12px; }
.stripe-500 { background: #f56c6c; }
.stripe-400 { background: #e6a23c; }
.err-card-check { display: flex; align-items: flex-start; padding-top: 2px; margin-right: 10px; flex-shrink: 0; }
.err-card-main { flex: 1; min-width: 0; }
.err-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap; }
.err-code { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: 'DM Sans', monospace; }
.code-500 { background: rgba(245,108,108,0.1); color: #f56c6c; }
.code-400 { background: rgba(230,162,60,0.1); color: #e6a23c; }
.err-method { font-size: 11px; font-weight: 600; color: var(--text-200); background: var(--bg-100); padding: 2px 7px; border-radius: 4px; text-transform: uppercase; }
.err-path { font-size: 13px; font-weight: 600; color: var(--text-100); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Courier New', monospace; }
.err-new-badge { font-size: 9px; font-weight: 700; color: #f56c6c; background: rgba(245,108,108,0.1); padding: 1px 5px; border-radius: 3px; flex-shrink: 0; letter-spacing: 0.5px; }
.err-time { margin-left: auto; font-size: 11px; color: var(--text-200); white-space: nowrap; flex-shrink: 0; }
.err-card-msg { font-size: 12px; color: var(--text-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; max-width: 680px; }
.err-card-meta { display: flex; gap: 14px; font-size: 11px; color: var(--text-200); }
.err-meta-item { display: flex; align-items: center; gap: 4px; }

/* 空状态 */
.err-empty { text-align: center; padding: 80px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.err-empty p { font-size: 15px; color: var(--text-100); font-weight: 600; margin: 0; }
.err-empty span { font-size: 12px; color: var(--text-200); }

/* ===== 分页 ===== */
.err-pager { display: flex; justify-content: center; padding: 14px 0 0; flex-shrink: 0; }

/* ===== 弹窗顶部 ===== */
.err-dialog :deep(.el-dialog__header) { border-bottom: 1px solid var(--bg-300); padding: 16px 20px; }
.err-detail-head { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.err-detail-code { padding: 3px 10px; border-radius: 5px; font-size: 13px; font-weight: 700; font-family: 'DM Sans', monospace; }
.err-detail-method { font-weight: 600; color: var(--text-200); background: var(--bg-100); padding: 3px 8px; border-radius: 4px; text-transform: uppercase; font-size: 12px; }
.err-detail-path { font-weight: 600; color: var(--text-100); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Courier New', monospace; flex: 1; font-size: 13px; }
.err-detail-status { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; flex-shrink: 0; }
.err-detail-status.unresolved { background: rgba(245,108,108,0.1); color: #f56c6c; }
.err-detail-status.resolved { background: rgba(103,194,58,0.1); color: #67c23a; }

/* ===== 弹窗内容 ===== */
.err-detail-body { padding: 4px 0; }
.err-detail-meta { display: flex; gap: 10px; margin-bottom: 14px; }
.err-dm-item { flex: 1; padding: 10px 12px; border-radius: 8px; background: var(--bg-100); display: flex; flex-direction: column; gap: 2px; }
.err-dm-label { font-size: 10px; color: var(--text-200); text-transform: uppercase; letter-spacing: 1px; }
.err-dm-val { font-size: 13px; font-weight: 600; color: var(--text-100); }
.err-detail-msg { font-size: 14px; color: #c44545; padding: 12px 16px; background: rgba(196,69,69,0.04); border-radius: 8px; line-height: 1.7; word-break: break-all; margin-bottom: 14px; border: 1px solid rgba(196,69,69,0.12); }

/* AI 分析 */
.err-detail-ai { margin-bottom: 14px; padding: 16px; border-radius: 10px; background: rgba(201,168,76,0.04); border: 1px solid rgba(201,168,76,0.2); }
.err-detail-ai-head { font-size: 13px; font-weight: 700; color: var(--gold); display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.err-detail-ai-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 8px rgba(201,168,76,0.4); }
.err-detail-ai-block { margin-bottom: 10px; }
.err-detail-ai-block:last-child { margin-bottom: 0; }
.err-detail-ai-title { font-size: 13px; font-weight: 700; color: var(--text-100); margin-bottom: 4px; }
.err-detail-ai-text { font-size: 12px; color: var(--text-200); line-height: 1.7; white-space: pre-wrap; }

/* 可折叠段 */
.err-detail-section { margin-bottom: 10px; }
.err-ds-head { font-size: 12px; font-weight: 700; color: var(--text-100); padding: 8px 12px; border-radius: 6px; background: var(--bg-100); cursor: pointer; user-select: none; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
.err-ds-head:hover { background: var(--bg-300); }
.err-ds-head span:first-child { color: var(--gold); font-size: 10px; width: 14px; }
.err-pre { background: #151721; color: #a0b0c0; padding: 14px 16px; border-radius: 8px; font-size: 11px; line-height: 1.6; max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-all; margin: 6px 0 0; font-family: 'Courier New', monospace; }
.err-pre-stack { color: #90a0b0; font-size: 10px; }

@media (max-width: 768px) {
  .err-stat-row { grid-template-columns: 1fr 1fr; }
  .err-bar { flex-direction: column; align-items: stretch; }
  .err-bar-right { justify-content: flex-end; }
  .err-detail-meta { flex-direction: column; }
}
</style>
