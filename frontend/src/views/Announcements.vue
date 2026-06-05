<template>
  <div class="ann-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">公告管理</span>
    </div>

    <div class="ann-toolbar">
      <el-button type="primary" size="small" @click="openCreate">+ 新建公告</el-button>
      <div style="display:flex;gap:6px">
        <el-select v-model="filterType" placeholder="类型" size="small" style="width:100px" clearable @change="fetchList">
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warning" />
          <el-option label="成功" value="success" />
          <el-option label="危险" value="danger" />
        </el-select>
        <el-select v-model="filterTarget" placeholder="范围" size="small" style="width:100px" clearable @change="fetchList">
          <el-option label="所有人" value="all" />
          <el-option label="仅管理员" value="admin" />
        </el-select>
        <el-button size="small" @click="fetchList">刷新</el-button>
      </div>
    </div>

    <div class="ann-list" v-loading="loading">
      <div v-for="a in list" :key="a._id" class="ann-card" :class="{ 'ann-inactive': !a.isActive }">
        <div class="ann-card-top">
          <div class="ann-left">
            <span :class="['ann-type-dot', a.type]"></span>
            <span class="ann-title">{{ a.title }}</span>
            <el-tag v-if="a.isPinned" size="small" type="danger" effect="dark">置顶</el-tag>
            <el-tag v-if="!a.isActive" size="small" type="info">未发布</el-tag>
            <el-tag size="small" :type="a.target === 'admin' ? 'warning' : ''">{{ a.target === 'admin' ? '仅管理员' : '所有人' }}</el-tag>
          </div>
          <div class="ann-right">
            <span class="ann-time">{{ formatTime(a.createdAt) }}</span>
            <el-button size="small" link @click="openEdit(a)">编辑</el-button>
            <el-button size="small" link type="danger" @click="deleteAnn(a._id)">删除</el-button>
          </div>
        </div>
        <div class="ann-content" v-if="a.content">{{ a.content }}</div>
        <div class="ann-meta">
          <span>{{ a.type }}</span>
          <span v-if="a.createdBy">由 {{ a.createdBy }} 创建</span>
        </div>
      </div>
      <el-empty v-if="list.length === 0 && !loading" description="暂无公告" :image-size="60" />
    </div>

    <div class="ann-pagination" v-if="totalPages > 1">
      <el-pagination v-model:current-page="page" :page-size="limit" :total="total" layout="prev, pager, next" @current-change="fetchList" size="small" />
    </div>

    <!-- 编辑/创建弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEditing ? '编辑公告' : '新建公告'" width="560px" destroy-on-close>
      <el-form :model="form" label-position="top" size="small">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="公告标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="公告详细内容（支持纯文本）" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="类型">
              <el-select v-model="form.type" style="width:100%">
                <el-option label="信息 (蓝)" value="info" />
                <el-option label="警告 (橙)" value="warning" />
                <el-option label="成功 (绿)" value="success" />
                <el-option label="危险 (红)" value="danger" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="可见范围">
              <el-select v-model="form.target" style="width:100%">
                <el-option label="所有人" value="all" />
                <el-option label="仅管理员" value="admin" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-switch v-model="form.isActive" active-text="发布" inactive-text="草稿" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-checkbox v-model="form.isPinned">置顶公告</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">{{ isEditing ? '保存修改' : '发布公告' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

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
const form = reactive({ title: '', content: '', type: 'info', target: 'all', isPinned: false, isActive: true });

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
  isEditing.value = false;
  editingId.value = '';
  form.title = ''; form.content = ''; form.type = 'info'; form.target = 'all';
  form.isPinned = false; form.isActive = true;
  dialogVisible.value = true;
}

function openEdit(a) {
  isEditing.value = true;
  editingId.value = a._id;
  form.title = a.title; form.content = a.content; form.type = a.type;
  form.target = a.target; form.isPinned = a.isPinned; form.isActive = a.isActive;
  dialogVisible.value = true;
}

async function submitForm() {
  if (!form.title.trim()) { ElMessage.warning('请输入标题'); return; }
  submitting.value = true;
  try {
    const url = isEditing.value ? `/api/v1/announcements/${editingId.value}` : '/api/v1/announcements';
    const method = isEditing.value ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ...form, title: form.title.trim(), content: form.content.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { ElMessage.error(json.message || '操作失败'); return; }
    ElMessage.success(isEditing.value ? '已更新' : '已发布');
    dialogVisible.value = false;
    fetchList();
  } catch (e) { ElMessage.error('操作失败'); }
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

onMounted(() => { fetchList(); });
</script>

<style scoped>
.ann-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.ann-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-shrink: 0; }
.ann-list { flex: 1; overflow-y: auto; min-height: 0; }
.ann-card { padding: 12px 14px; border-radius: 8px; background: var(--bg-200); margin-bottom: 6px; border-left: 3px solid var(--accent-100); }
.ann-card.ann-inactive { opacity: 0.55; border-left-color: var(--bg-300); }
.ann-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ann-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.ann-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.ann-type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ann-type-dot.info { background: #409eff; }
.ann-type-dot.warning { background: #e6a23c; }
.ann-type-dot.success { background: #67c23a; }
.ann-type-dot.danger { background: #f56c6c; }
.ann-title { font-size: 14px; font-weight: 700; color: var(--text-100); }
.ann-content { font-size: 13px; color: var(--text-200); margin-top: 6px; line-height: 1.6; }
.ann-meta { display: flex; gap: 16px; font-size: 11px; color: var(--primary-300); margin-top: 6px; }
.ann-time { font-size: 11px; color: var(--primary-300); }
.ann-pagination { display: flex; justify-content: center; padding: 10px 0; flex-shrink: 0; }
</style>
