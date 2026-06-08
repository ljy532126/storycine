<template>
  <div class="ann-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">公告管理</span>
    </div>

    <!-- 统计卡片 -->
    <div class="ann-stats">
      <div class="ann-stat-card ann-sc-active">
        <div class="ann-stat-icon"><Announcement theme="outline" size="22" fill="#fff" /></div>
        <div class="ann-stat-body"><span class="ann-stat-num">{{ stats.published }}</span><span class="ann-stat-label">已发布</span></div>
      </div>
      <div class="ann-stat-card ann-sc-draft">
        <div class="ann-stat-icon"><DocDetail theme="outline" size="22" fill="#fff" /></div>
        <div class="ann-stat-body"><span class="ann-stat-num">{{ stats.drafts }}</span><span class="ann-stat-label">草稿</span></div>
      </div>
      <div class="ann-stat-card ann-sc-pinned">
        <div class="ann-stat-icon"><Pin theme="outline" size="22" fill="#fff" /></div>
        <div class="ann-stat-body"><span class="ann-stat-num">{{ stats.pinned }}</span><span class="ann-stat-label">置顶</span></div>
      </div>
      <div class="ann-stat-card ann-sc-reads">
        <div class="ann-stat-icon"><People theme="outline" size="22" fill="#fff" /></div>
        <div class="ann-stat-body"><span class="ann-stat-num">{{ stats.totalReads }}</span><span class="ann-stat-label">总阅读</span></div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="ann-toolbar">
      <el-button type="primary" size="default" @click="openCreate"><el-icon><Plus /></el-icon> 新建公告</el-button>
      <div class="ann-tb-right">
        <el-select v-model="filterType" placeholder="类型" size="default" style="width:100px" clearable @change="fetchList">
          <el-option label="信息" value="info" /><el-option label="警告" value="warning" />
          <el-option label="成功" value="success" /><el-option label="重要" value="danger" />
        </el-select>
        <el-select v-model="filterTarget" placeholder="范围" size="default" style="width:110px" clearable @change="fetchList">
          <el-option label="所有人" value="all" /><el-option label="仅管理员" value="admin" />
        </el-select>
        <el-button size="default" @click="fetchList" :loading="loading"><el-icon><Refresh /></el-icon></el-button>
      </div>
    </div>

    <!-- 公告列表 -->
    <div class="ann-list" v-loading="loading">
      <div
        v-for="a in list" :key="a._id"
        :class="['ann-card', a.type, { 'ann-draft': !a.isActive }]"
        @click="openEdit(a)"
      >
        <div :class="['ann-card-indicator', a.type]"></div>
        <div class="ann-card-body">
          <div class="ann-card-row1">
            <span class="ann-card-title">{{ a.title }}</span>
            <div class="ann-card-badges">
              <span v-if="a.isPinned" class="ann-badge ann-badge-pin"><Pin theme="outline" size="12" fill="currentColor" /> 置顶</span>
              <span v-if="!a.isActive" class="ann-badge ann-badge-draft"><DocDetail theme="outline" size="12" fill="currentColor" /> 草稿</span>
              <span class="ann-badge" :class="'ann-badge-' + a.type">{{ typeLabel(a.type) }}</span>
              <span class="ann-badge ann-badge-target">{{ a.target === 'admin' ? '仅管理员' : '所有人' }}</span>
            </div>
          </div>
          <div class="ann-card-text" v-if="a.content">
            <div v-if="a.enableMarkdown" v-html="renderMD(a.content.length > 150 ? a.content.substring(0, 150) + '...' : a.content)"></div>
            <template v-else>{{ a.content.length > 150 ? a.content.substring(0, 150) + '...' : a.content }}</template>
          </div>
          <div class="ann-card-meta">
            <span>{{ a.createdBy || '系统' }}</span>
            <span class="ann-meta-sep">·</span>
            <span>{{ formatTime(a.createdAt) }}</span>
            <span class="ann-meta-sep">·</span>
            <span class="ann-meta-reads" @click.stop="openStats(a)">
              <PreviewOpen theme="outline" size="13" fill="currentColor" />
              {{ a.readBy?.length || 0 }} 人已读
            </span>
          </div>
        </div>
        <div class="ann-card-actions" @click.stop>
          <el-button size="small" circle class="ann-btn" @click="openEdit(a)" title="编辑"><el-icon><Edit /></el-icon></el-button>
          <el-button size="small" circle class="ann-btn ann-btn-del" @click="deleteAnn(a)" title="删除"><el-icon><Delete /></el-icon></el-button>
        </div>
      </div>
      <div v-if="list.length === 0 && !loading" class="ann-empty">
        <DocDetail theme="outline" size="48" fill="#d4c5c0" />
        <p>暂无公告</p>
        <span>点击「新建公告」创建第一条</span>
      </div>
    </div>

    <!-- 分页 -->
    <div class="ann-pager" v-if="totalPages > 1">
      <el-pagination background layout="prev, pager, next" :page-size="limit" :total="total" v-model:current-page="page" @current-change="fetchList" size="default" />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEditing ? '编辑公告' : '新建公告'" width="560px" destroy-on-close>
      <el-form :model="form" label-position="top" size="default">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="公告标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="支持纯文本，输入 URL 自动转为可点击链接" maxlength="2000" show-word-limit />
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <el-switch v-model="form.enableMarkdown" active-text="Markdown" inactive-text="纯文本" size="small" />
            <el-button size="small" v-if="form.enableMarkdown && form.content" @click="showPreview = !showPreview">{{ showPreview ? '收起预览' : '预览' }}</el-button>
          </div>
          <div v-if="showPreview && form.enableMarkdown && form.content" class="ann-md-preview">
            <div class="ann-md-preview-title">预览</div>
            <div class="ann-md-preview-body" v-html="renderMD(form.content)"></div>
          </div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="类型">
              <el-select v-model="form.type" style="width:100%">
                <el-option label="信息" value="info" />
                <el-option label="警告" value="warning" />
                <el-option label="成功" value="success" />
                <el-option label="重要" value="danger" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="范围">
              <el-select v-model="form.target" style="width:100%">
                <el-option label="所有人" value="all" />
                <el-option label="仅管理员" value="admin" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="发布">
              <el-switch v-model="form.isActive" active-text="发布" inactive-text="草稿" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-checkbox v-model="form.isPinned"><Pin theme="outline" size="14" fill="currentColor" style="vertical-align:-3px" /> 置顶公告</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting" size="default">{{ isEditing ? '保存' : '发布' }}</el-button>
      </template>
    </el-dialog>

    <!-- 阅读统计弹窗 -->
    <el-dialog v-model="statsVisible" title="阅读统计" width="460px" destroy-on-close>
      <div class="ann-stats-dlg" v-if="statsData">
        <div class="ann-stats-dlg-head">
          <span class="ann-stats-dlg-title">{{ statsData.title }}</span>
          <span class="ann-stats-dlg-count">{{ statsData.totalReads }} 人已读</span>
        </div>
        <div class="ann-stats-dlg-list" v-if="statsData.readers?.length">
          <div v-for="r in statsData.readers" :key="r.username + r.readAt" class="ann-stats-dlg-row">
            <span class="ann-stats-dlg-user">{{ r.username }}</span>
            <span class="ann-stats-dlg-time">{{ formatTime(r.readAt) }}</span>
          </div>
        </div>
        <div v-else class="ann-stats-dlg-empty">暂无阅读记录</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Edit, Delete } from '@element-plus/icons-vue';
import { Announcement, DocDetail, Pin, People, PreviewOpen } from '@icon-park/vue-next';
import { marked } from 'marked';

function sanitizeMD(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
}
function renderMD(text) { return text ? sanitizeMD(marked.parse(text)) : ''; }

const list = ref([]);
const total = ref(0); const totalPages = ref(1); const page = ref(1); const limit = 20;
const loading = ref(false);
const filterType = ref(''); const filterTarget = ref('');

const dialogVisible = ref(false); const isEditing = ref(false); const editingId = ref('');
const submitting = ref(false);
const form = reactive({ title: '', content: '', type: 'info', target: 'all', isPinned: false, isActive: true, enableMarkdown: false });
const showPreview = ref(false);

const statsVisible = ref(false); const statsData = ref(null);

const stats = computed(() => ({
  published: list.value.filter(a => a.isActive).length,
  drafts: list.value.filter(a => !a.isActive).length,
  pinned: list.value.filter(a => a.isPinned).length,
  totalReads: list.value.reduce((s, a) => s + (a.readBy?.length || 0), 0),
}));

function typeLabel(t) { return { info: '信息', warning: '警告', success: '成功', danger: '重要' }[t] || t; }
const token = () => localStorage.getItem('token');

async function fetchList() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, limit });
    if (filterType.value) params.set('type', filterType.value);
    if (filterTarget.value) params.set('target', filterTarget.value);
    const res = await fetch(`/api/v1/announcements?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    const json = await res.json();
    list.value = json.data || [];
    total.value = json.total || 0; totalPages.value = json.totalPages || 1;
  } catch { /* */ }
  finally { loading.value = false; }
}

function openCreate() {
  isEditing.value = false; editingId.value = '';
  Object.assign(form, { title: '', content: '', type: 'info', target: 'all', isPinned: false, isActive: true, enableMarkdown: false });
  showPreview.value = false; dialogVisible.value = true;
}
function openEdit(a) {
  isEditing.value = true; editingId.value = a._id;
  Object.assign(form, { title: a.title, content: a.content, type: a.type, target: a.target, isPinned: a.isPinned, isActive: a.isActive, enableMarkdown: a.enableMarkdown || false });
  showPreview.value = false; dialogVisible.value = true;
}

async function submitForm() {
  if (!form.title.trim()) { ElMessage.warning('请输入标题'); return; }
  submitting.value = true;
  try {
    const url = isEditing.value ? `/api/v1/announcements/${editingId.value}` : '/api/v1/announcements';
    const method = isEditing.value ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ ...form, title: form.title.trim(), content: form.content.trim() }) });
    const json = await res.json();
    if (!res.ok) { ElMessage.error(json.message || '操作失败'); return; }
    ElMessage.success(isEditing.value ? '已更新' : '已发布');
    dialogVisible.value = false; fetchList();
  } catch { ElMessage.error('操作失败'); }
  finally { submitting.value = false; }
}

async function deleteAnn(a) {
  try { await ElMessageBox.confirm(`删除「${a.title}」？`, '删除公告', { type: 'warning', confirmButtonText: '确认删除' }); } catch { return; }
  try {
    await fetch(`/api/v1/announcements/${a._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    ElMessage.success('已删除'); fetchList();
  } catch { ElMessage.error('删除失败'); }
}

async function openStats(a) {
  try {
    const res = await fetch(`/api/v1/announcements/${a._id}/stats`, { headers: { Authorization: `Bearer ${token()}` } });
    const json = await res.json();
    statsData.value = json.data;
    statsVisible.value = true;
  } catch { ElMessage.error('加载失败'); }
}

function formatTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : ''; }

onMounted(() => fetchList());
</script>

<style scoped>
.ann-root { padding: 0; }

.ann-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.ann-stat-card {
  display: flex; align-items: center; gap: 14px;
  border-radius: 12px; padding: 16px 18px;
}
.ann-sc-active { background: linear-gradient(135deg, #1a3a1a, #2a4a2a); border: 1px solid #3a5a3a; }
.ann-sc-draft { background: linear-gradient(135deg, #2a2a1a, #3a3a2a); border: 1px solid #4a4a3a; }
.ann-sc-pinned { background: linear-gradient(135deg, #3a1a1a, #5a2a2a); border: 1px solid #5a3a3a; }
.ann-sc-reads { background: linear-gradient(135deg, #1a2a3a, #2a3a4a); border: 1px solid #3a4a5a; }
.ann-stat-icon { width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ann-stat-body { display: flex; flex-direction: column; gap: 1px; }
.ann-stat-num { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 900; color: #fff; line-height: 1; }
.ann-stat-label { font-size: 11px; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 1px; }

.ann-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 8px; flex-wrap: wrap; }
.ann-tb-right { display: flex; gap: 8px; align-items: center; }

/* 列表 */
.ann-list { display: flex; flex-direction: column; gap: 8px; }
.ann-card {
  display: flex; align-items: flex-start; gap: 0;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 16px 18px; cursor: pointer; transition: all 0.2s;
  overflow: hidden;
}
.ann-card:hover { border-color: var(--gold); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
.ann-card.ann-draft { opacity: 0.5; }
.ann-card.ann-draft:hover { opacity: 0.75; }

.ann-card-indicator { width: 4px; border-radius: 2px; align-self: stretch; flex-shrink: 0; margin-right: 14px; }
.ann-card-indicator.info { background: #409eff; }
.ann-card-indicator.warning { background: #e6a23c; }
.ann-card-indicator.success { background: #67c23a; }
.ann-card-indicator.danger { background: #f56c6c; }

.ann-card-body { flex: 1; min-width: 0; }
.ann-card-row1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.ann-card-title { font-size: 15px; font-weight: 700; color: var(--text-100); }
.ann-card:hover .ann-card-title { color: var(--gold); }
.ann-card-badges { display: flex; gap: 5px; flex-wrap: wrap; }
.ann-badge {
  display: flex; align-items: center; gap: 3px;
  font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 600; white-space: nowrap;
}
.ann-badge-pin { background: rgba(245,108,108,0.1); color: #f56c6c; }
.ann-badge-draft { background: rgba(160,160,160,0.1); color: #888; }
.ann-badge-target { background: var(--bg-100); color: var(--text-200); }
.ann-badge-info { background: rgba(64,158,255,0.1); color: #409eff; }
.ann-badge-warning { background: rgba(230,162,60,0.1); color: #e6a23c; }
.ann-badge-success { background: rgba(103,194,58,0.1); color: #67c23a; }
.ann-badge-danger { background: rgba(245,108,108,0.1); color: #f56c6c; }

.ann-card-text {
  font-size: 12px; color: var(--text-200); line-height: 1.6; margin-bottom: 6px;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.ann-card-text :deep(p) { margin: 0; display: inline; }
.ann-card-text :deep(h1),.ann-card-text :deep(h2),.ann-card-text :deep(h3) { font-size: 12px; margin: 0; }

.ann-card-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-200); }
.ann-meta-sep { color: var(--bg-300); }
.ann-meta-reads {
  display: flex; align-items: center; gap: 3px; cursor: pointer;
  color: var(--text-200); transition: color 0.15s;
}
.ann-meta-reads:hover { color: var(--gold-dark); }

.ann-card-actions { display: flex; gap: 4px; flex-shrink: 0; opacity: 0; transition: opacity 0.15s; margin-left: 12px; }
.ann-card:hover .ann-card-actions { opacity: 1; }
.ann-btn { border: 1px solid var(--bg-300) !important; background: var(--bg-100) !important; color: var(--text-200) !important; }
.ann-btn:hover { border-color: var(--gold) !important; color: var(--gold-dark) !important; }
.ann-btn-del:hover { border-color: #c44545 !important; color: #c44545 !important; }

.ann-empty { text-align: center; padding: 80px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ann-empty p { font-size: 15px; color: var(--text-100); font-weight: 600; margin: 0; }
.ann-empty span { font-size: 12px; color: var(--text-200); }

.ann-pager { display: flex; justify-content: center; margin-top: 20px; }

/* 编辑弹窗 */
.ann-md-preview { margin-top: 10px; border: 1px solid var(--bg-300); border-radius: 10px; overflow: hidden; }
.ann-md-preview-title { font-size: 11px; color: var(--text-200); background: var(--bg-200); padding: 6px 12px; border-bottom: 1px solid var(--bg-300); text-transform: uppercase; letter-spacing: 1px; }
.ann-md-preview-body { padding: 12px 14px; font-size: 13px; line-height: 1.8; color: var(--text-100); max-height: 280px; overflow-y: auto; }
.ann-md-preview-body :deep(h1),.ann-md-preview-body :deep(h2),.ann-md-preview-body :deep(h3) { margin: 8px 0 4px; font-weight: 700; }
.ann-md-preview-body :deep(p) { margin: 4px 0; }
.ann-md-preview-body :deep(code) { background: var(--bg-200); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
.ann-md-preview-body :deep(pre) { background: var(--navy); color: #e2e8f0; padding: 10px 14px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
.ann-md-preview-body :deep(a) { color: var(--gold-dark); }
.ann-md-preview-body :deep(blockquote) { border-left: 3px solid var(--gold); padding-left: 12px; margin: 8px 0; color: var(--text-200); }

/* 阅读统计弹窗 */
.ann-stats-dlg-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--bg-300); }
.ann-stats-dlg-title { font-size: 15px; font-weight: 700; color: var(--text-100); }
.ann-stats-dlg-count { font-size: 13px; color: var(--gold-dark); font-weight: 600; }
.ann-stats-dlg-list { display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto; }
.ann-stats-dlg-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: var(--bg-100); font-size: 13px; }
.ann-stats-dlg-user { color: var(--text-100); font-weight: 600; }
.ann-stats-dlg-time { color: var(--text-200); font-size: 11px; }
.ann-stats-dlg-empty { text-align: center; padding: 40px; color: var(--text-200); font-size: 13px; }

@media (max-width: 768px) {
  .ann-stats { grid-template-columns: repeat(2, 1fr); }
  .ann-toolbar { flex-direction: column; align-items: stretch; }
}
</style>
