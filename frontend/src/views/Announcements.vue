<template>
  <div class="ann-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">公告管理</span>
    </div>

    <!-- 统计卡片 -->
    <div class="ann-stats">
      <div class="ann-stat-card" v-for="s in statCards" :key="s.label" :class="s.css">
        <div class="ann-stat-left">
          <span class="ann-stat-num">{{ s.value }}</span>
          <span class="ann-stat-label">{{ s.label }}</span>
        </div>
        <div class="ann-stat-icon-wrap">
          <component :is="s.icon" theme="outline" size="22" :fill="s.iconFill" />
        </div>
        <div class="ann-stat-glow"></div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="ann-toolbar">
      <el-button type="primary" size="default" @click="openCreate">
        <el-icon><Plus /></el-icon> 新建公告
      </el-button>
      <div style="display:flex;gap:8px">
        <el-select v-model="filterType" placeholder="类型" size="default" style="width:110px" clearable @change="fetchList">
          <el-option label="信息" value="info" /><el-option label="警告" value="warning" />
          <el-option label="成功" value="success" /><el-option label="危险" value="danger" />
        </el-select>
        <el-select v-model="filterTarget" placeholder="范围" size="default" style="width:120px" clearable @change="fetchList">
          <el-option label="所有人" value="all" /><el-option label="仅管理员" value="admin" />
        </el-select>
        <el-button size="default" @click="fetchList" :loading="loading">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 公告列表 -->
    <div class="ann-list" v-loading="loading">
      <div v-for="a in list" :key="a._id" class="ann-card" :class="[a.type, { 'ann-inactive': !a.isActive }]"
        @mousemove="onCardMouseMove" @click="openEdit(a)">
        <div class="ann-card-left">
          <span :class="['ann-type-dot', a.type]"></span>
        </div>
        <div class="ann-card-body">
          <div class="ann-card-head">
            <span class="ann-title">{{ a.title }}</span>
            <div class="ann-tags">
              <el-tag v-if="a.isPinned" size="small" type="danger" effect="dark">置顶</el-tag>
              <el-tag v-if="!a.isActive" size="small" type="info" effect="dark">草稿</el-tag>
              <el-tag size="small" :type="a.target === 'admin' ? 'warning' : ''" effect="plain">{{ a.target === 'admin' ? '仅管理员' : '所有人' }}</el-tag>
            </div>
          </div>
          <div class="ann-content" v-if="a.content">
            <div v-if="a.enableMarkdown" v-html="renderMD(a.content.length > 200 ? a.content.substring(0, 200) + '...' : a.content)"></div>
            <template v-else>{{ a.content }}</template>
          </div>
          <div class="ann-meta">
            <span class="ann-meta-item">{{ typeLabel(a.type) }}</span>
            <span class="ann-sep">·</span>
            <span class="ann-meta-item" v-if="a.createdBy">{{ a.createdBy }} 创建</span>
            <span class="ann-sep" v-if="a.createdBy">·</span>
            <span class="ann-meta-item">{{ formatTime(a.createdAt) }}</span>
          </div>
        </div>
        <div class="ann-card-right" @click.stop>
          <el-button size="small" circle class="ann-action-btn" @click="openEdit(a)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button size="small" circle class="ann-action-btn ann-action-danger" @click="deleteAnn(a._id)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
      <el-empty v-if="list.length === 0 && !loading" description="暂无公告，点击上方「新建公告」发布第一条" :image-size="60" />
    </div>

    <!-- 分页 -->
    <div class="ann-pager" v-if="totalPages > 1">
      <el-pagination background layout="prev, pager, next" :page-size="limit" :total="total" v-model:current-page="page" @current-change="fetchList" size="default" />
    </div>

    <!-- 编辑 / 创建弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEditing ? '编辑公告' : '新建公告'" width="560px" destroy-on-close>
      <el-form :model="form" label-position="top" size="default">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="公告标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="支持纯文本，输入 URL 自动转为可点击链接" maxlength="2000" show-word-limit />
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <el-switch v-model="form.enableMarkdown" active-text="Markdown 渲染" inactive-text="纯文本" size="small" />
            <el-button size="small" v-if="form.enableMarkdown && form.content" @click="showPreview = !showPreview">
              {{ showPreview ? '收起预览' : '预览效果' }}
            </el-button>
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
                <el-option label="💬 信息" value="info" />
                <el-option label="⚠️ 警告" value="warning" />
                <el-option label="✅ 成功" value="success" />
                <el-option label="🚨 重要" value="danger" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="范围">
              <el-select v-model="form.target" style="width:100%">
                <el-option label="👥 所有人" value="all" />
                <el-option label="🔒 仅管理员" value="admin" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="发布状态">
              <el-switch v-model="form.isActive" active-text="发布" inactive-text="草稿" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-checkbox v-model="form.isPinned">📌 置顶公告（始终显示在最前）</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting" size="default">
          {{ isEditing ? '保存修改' : '发布公告' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Edit, Delete } from '@element-plus/icons-vue';
import { People, User } from '@icon-park/vue-next';
import { marked } from 'marked';

// 简易 XSS 过滤：去掉 script / on* / javascript:
function sanitizeMD(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
}

function renderMD(text) {
  if (!text) return '';
  return sanitizeMD(marked.parse(text));
}

const list = ref([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const limit = 20;
const loading = ref(false);
const filterType = ref('');
const filterTarget = ref('');

const dialogVisible = ref(false);
const isEditing = ref(false);
const editingId = ref('');
const submitting = ref(false);
const form = reactive({ title: '', content: '', type: 'info', target: 'all', isPinned: false, isActive: true, enableMarkdown: false });
const showPreview = ref(false);

const statCards = computed(() => {
  const active = list.value.filter(a => a.isActive).length;
  const pinned = list.value.filter(a => a.isPinned).length;
  const info = list.value.filter(a => a.type === 'info').length;
  const urgent = list.value.filter(a => a.type === 'danger').length;
  return [
    { label: '已发布', value: active, icon: People, iconFill: '#fff', css: 'ann-sc-active' },
    { label: '置顶', value: pinned, icon: People, iconFill: '#fff', css: 'ann-sc-pinned' },
    { label: '信息通知', value: info, icon: People, iconFill: '#fff', css: 'ann-sc-info' },
    { label: '重要公告', value: urgent, icon: User, iconFill: '#fff', css: 'ann-sc-urgent' },
  ];
});

function typeLabel(t) {
  return { info: '信息通知', warning: '警告提醒', success: '好消息', danger: '重要公告' }[t] || t;
}

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
    total.value = json.total || 0;
    totalPages.value = json.totalPages || 1;
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

function openCreate() {
  isEditing.value = false; editingId.value = '';
  Object.assign(form, { title: '', content: '', type: 'info', target: 'all', isPinned: false, isActive: true, enableMarkdown: false });
  showPreview.value = false;
  dialogVisible.value = true;
}

function openEdit(a) {
  isEditing.value = true; editingId.value = a._id;
  Object.assign(form, { title: a.title, content: a.content, type: a.type, target: a.target, isPinned: a.isPinned, isActive: a.isActive, enableMarkdown: a.enableMarkdown || false });
  showPreview.value = false;
  dialogVisible.value = true;
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
    dialogVisible.value = false;
    fetchList();
  } catch { ElMessage.error('操作失败'); }
  finally { submitting.value = false; }
}

async function deleteAnn(id) {
  try { await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' }); } catch { return; }
  try {
    await fetch(`/api/v1/announcements/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    ElMessage.success('已删除');
    fetchList();
  } catch { ElMessage.error('删除失败'); }
}

function formatTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : ''; }

function onCardMouseMove(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  card.style.setProperty('--mouse-x', x + 'px');
  card.style.setProperty('--mouse-y', y + 'px');
}

onMounted(() => { fetchList(); });
</script>

<style scoped>
.ann-root { padding: 0; }

/* 统计卡片 */
.ann-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.ann-stat-card {
  position: relative; overflow: hidden;
  display: flex; justify-content: space-between; align-items: center;
  border-radius: 14px; padding: 18px 20px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.ann-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
.ann-stat-card:active { transform: translateY(-1px) scale(0.98); }
.ann-sc-active { background: linear-gradient(135deg, #1a3a1a, #2d5a2d); border: 1px solid #3a5a3a; }
.ann-sc-pinned { background: linear-gradient(135deg, #3a1a1a, #5a2a2a); border: 1px solid #5a3a3a; }
.ann-sc-info { background: linear-gradient(135deg, #1a2a3a, #2d4a5a); border: 1px solid #3a4a5a; }
.ann-sc-urgent { background: linear-gradient(135deg, #1A1A2E, #2d2d4a); border: 1px solid #3a3a5e; }

.ann-stat-left { display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
.ann-stat-num { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900; color: #fff; line-height: 1; }
.ann-stat-label { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
.ann-stat-icon-wrap { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
.ann-stat-glow { position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%); pointer-events: none; }

/* 工具栏 */
.ann-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 8px; flex-wrap: wrap; }

/* 列表 */
.ann-list { display: flex; flex-direction: column; gap: 10px; }
.ann-card {
  display: flex; align-items: flex-start; gap: 14px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 14px;
  padding: 18px 20px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-left: 4px solid transparent;
  animation: cardSlideUp 0.35s ease-out both;
  cursor: pointer; position: relative;
  overflow: hidden;
}
.ann-card::after {
  content: ''; position: absolute; inset: 0; border-radius: 14px;
  background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(201,168,76,0.06), transparent 40%);
  opacity: 0; transition: opacity 0.4s;
}
.ann-card:hover::after { opacity: 1; }
.ann-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(201,168,76,0.15);
  border-color: rgba(201,168,76,0.4);
}
.ann-card:active { transform: translateY(-1px) scale(0.995); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }

@keyframes cardSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.ann-card.info { border-left-color: #409eff; }
.ann-card.warning { border-left-color: #e6a23c; }
.ann-card.success { border-left-color: #67c23a; }
.ann-card.danger { border-left-color: #f56c6c; }
.ann-card.ann-inactive { opacity: 0.45; filter: grayscale(0.3); }
.ann-card.ann-inactive:hover { opacity: 0.65; filter: grayscale(0.1); }

.ann-card-left { flex-shrink: 0; padding-top: 5px; }
.ann-type-dot {
  display: block; width: 12px; height: 12px; border-radius: 50%;
  position: relative; box-shadow: 0 0 8px currentColor;
}
.ann-type-dot::after {
  content: ''; position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid currentColor; opacity: 0.2;
  animation: dotPulse 2s ease-in-out infinite;
}
@keyframes dotPulse { 0%, 100% { transform: scale(1); opacity: 0.15; } 50% { transform: scale(1.5); opacity: 0.35; } }

.ann-type-dot.info { background: #409eff; color: #409eff; }
.ann-type-dot.warning { background: #e6a23c; color: #e6a23c; }
.ann-type-dot.success { background: #67c23a; color: #67c23a; }
.ann-type-dot.danger { background: #f56c6c; color: #f56c6c; animation-duration: 1.2s; }

.ann-card-body { flex: 1; min-width: 0; }
.ann-card-right {
  flex-shrink: 0; display: flex; gap: 6px;
  opacity: 0; transform: translateX(8px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.ann-card:hover .ann-card-right { opacity: 1; transform: translateX(0); }

.ann-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.ann-title {
  font-size: 16px; font-weight: 700; color: var(--text-100);
  transition: color 0.2s;
}
.ann-card:hover .ann-title { color: var(--gold); }
.ann-tags { display: flex; gap: 5px; flex-shrink: 0; }
.ann-content {
  font-size: 13px; color: var(--text-200); line-height: 1.75;
  margin-bottom: 8px; word-break: break-word;
}
.ann-meta { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--primary-300); }
.ann-meta-item { color: var(--primary-300); }
.ann-sep { color: var(--bg-300); }
.ann-card:hover .ann-sep { color: var(--gold); opacity: 0.4; }

.ann-action-btn {
  border: 1.5px solid var(--bg-300) !important; background: var(--bg-100) !important;
  color: var(--text-200) !important; transition: all 0.2s !important;
}
.ann-action-btn:hover {
  transform: scale(1.1);
  border-color: var(--gold) !important; color: var(--gold) !important;
  box-shadow: 0 2px 8px rgba(201,168,76,0.15);
}
.ann-action-danger:hover {
  border-color: #f56c6c !important; color: #f56c6c !important;
  box-shadow: 0 2px 8px rgba(245,108,108,0.15);
}

.ann-pager { display: flex; justify-content: center; margin-top: 20px; }

/* Markdown 预览 */
.ann-md-preview {
  margin-top: 10px; border: 1px solid var(--bg-300); border-radius: 10px;
  overflow: hidden;
}
.ann-md-preview-title {
  font-size: 11px; color: var(--text-200); background: var(--bg-200);
  padding: 6px 12px; border-bottom: 1px solid var(--bg-300);
  text-transform: uppercase; letter-spacing: 1px;
}
.ann-md-preview-body {
  padding: 12px 14px; font-size: 13px; line-height: 1.8; color: var(--text-100);
  max-height: 280px; overflow-y: auto;
}
.ann-md-preview-body :deep(h1), .ann-md-preview-body :deep(h2), .ann-md-preview-body :deep(h3) {
  margin: 8px 0 4px; font-weight: 700;
}
.ann-md-preview-body :deep(h1) { font-size: 18px; }
.ann-md-preview-body :deep(h2) { font-size: 16px; }
.ann-md-preview-body :deep(h3) { font-size: 14px; }
.ann-md-preview-body :deep(p) { margin: 4px 0; }
.ann-md-preview-body :deep(ul), .ann-md-preview-body :deep(ol) { padding-left: 20px; margin: 4px 0; }
.ann-md-preview-body :deep(code) {
  background: var(--bg-200); padding: 1px 5px; border-radius: 3px; font-size: 12px;
}
.ann-md-preview-body :deep(pre) {
  background: var(--navy); color: #e2e8f0; padding: 10px 14px; border-radius: 8px;
  overflow-x: auto; font-size: 12px; line-height: 1.5;
}
.ann-md-preview-body :deep(a) { color: var(--gold-dark); }
.ann-md-preview-body :deep(blockquote) {
  border-left: 3px solid var(--gold); padding-left: 12px; margin: 8px 0;
  color: var(--text-200);
}

/* 列表卡片内的 MD 简易渲染 */
.ann-content :deep(h1), .ann-content :deep(h2), .ann-content :deep(h3) {
  font-size: 13px; font-weight: 700; margin: 0;
}
.ann-content :deep(p) { margin: 0; display: inline; }
.ann-content :deep(ul), .ann-content :deep(ol) { padding-left: 16px; margin: 2px 0; }
.ann-content :deep(code) { font-size: 11px; background: var(--bg-200); padding: 1px 3px; border-radius: 2px; }
.ann-content :deep(pre) { display: none; }
.ann-content :deep(blockquote) { border-left: 2px solid var(--gold); padding-left: 8px; margin: 2px 0; }

@media (max-width: 768px) {
  .ann-stats { grid-template-columns: repeat(2, 1fr); }
  .ann-toolbar { flex-direction: column; align-items: stretch; }
}
</style>
