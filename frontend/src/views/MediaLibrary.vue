<template>
  <div class="ml-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">素材库</span>
    </div>

    <!-- 项目 Pills -->
    <div class="ml-projects" v-if="projectStore.projects.length > 0">
      <span :class="['ml-pill', { active: currentProjectId === p._id }]" v-for="p in projectStore.projects" :key="p._id" @click="currentProjectId = p._id; loadMedia()">{{ p.name }}</span>
    </div>

    <!-- 分类 Tab -->
    <div class="ml-tabs" v-if="currentProjectId">
      <span style="font-size:13px;font-weight:600;color:var(--text-100);padding:6px 8px 6px 0;flex-shrink:0">筛选：</span>
      <span :class="['ml-tab', { active: filterType === '' }]" @click="setFilter('')">全部</span>
      <span :class="['ml-tab', { active: filterType === '角色' }]" @click="setFilter('角色')">👤 角色</span>
      <span :class="['ml-tab', { active: filterType === '场景' }]" @click="setFilter('场景')">🏞️ 场景</span>
      <span :class="['ml-tab', { active: filterType === '道具' }]" @click="setFilter('道具')">🔧 道具</span>
      <span :class="['ml-tab', { active: filterType === '故事板' }]" @click="setFilter('故事板')">🎬 故事板</span>
      <span :class="['ml-tab', { active: filterType === '视频' }]" @click="setFilter('视频')">🎥 视频</span>
      <span :class="['ml-tab', { active: filterType === '封面' }]" @click="setFilter('封面')">🎨 封面</span>
      <span class="ml-count" v-if="items.length > 0" style="margin-left:auto">
        共 {{ items.length }} 个
        <el-button size="small" :type="multiSelect ? 'warning' : ''" @click="multiSelect = !multiSelect; if(!multiSelect) selectedItems = []">
          {{ multiSelect ? '退出多选' : '多选' }}
        </el-button>
        <el-button v-if="selectedItems.length > 0" size="small" type="primary" style="margin-left:4px" @click="batchDownload" :loading="downloading">
          打包下载 ({{ selectedItems.length }})
        </el-button>
        <el-button v-if="selectedItems.length > 0" size="small" @click="selectedItems = []" style="margin-left:4px">取消选择</el-button>
      </span>
    </div>

    <!-- 图片网格 -->
    <div class="ml-grid" v-if="filteredItems.length > 0" ref="gridRef"
      @mousedown="onGridMouseDown" @mousemove="onGridMouseMove" @mouseup="onGridMouseUp" @mouseleave="onGridMouseUp">
      <div v-for="(item, idx) in filteredItems" :key="idx"
        :ref="el => { if (el) cardRefs[idx] = el }"
        class="ml-card" :class="{ 'ml-selected': selectedItems.includes(item) }"
        @click="multiSelect ? toggleSelect(item, !selectedItems.includes(item)) : openPreview(item)">
        <div class="ml-sel-overlay" v-if="multiSelect && selectedItems.includes(item)">
          <span class="ml-sel-check">✓</span>
        </div>
        <div class="ml-img-wrap">
          <img :src="item.url" loading="lazy" />
          <span v-if="item.isVideo" class="ml-video-badge">▶</span>
          <span class="ml-storage-badge" :class="isCloudUrl(item.url) ? 'cloud' : 'local'">{{ isCloudUrl(item.url) ? '☁️ 云端' : '💾 本地' }}</span>
        </div>
        <div class="ml-info">
          <span class="ml-name">{{ item.name }}</span>
          <div class="ml-meta">
            <el-tag size="small" :type="tagType(item.type)">{{ item.type }}</el-tag>
            <span class="ml-sub">{{ item.subType }}</span>
          </div>
        </div>
        <el-button class="ml-del-btn" size="small" type="danger" circle @click.stop="deleteItem(item)">×</el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="ml-empty" v-if="!currentProjectId">
      <p>请先选择一个片场</p>
    </div>
    <div class="ml-empty" v-else-if="items.length === 0">
      <span style="font-size:48px">🖼️</span>
      <p>资源库还是空的~ 去角色小店或故事板生成图片吧</p>
    </div>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewVisible" :title="previewItem?.name || '预览'" width="85%" top="1vh" destroy-on-close class="ml-viewer-dialog">
      <div class="ml-viewer-body">
        <div class="ml-viewer-main">
          <video v-if="previewItem?.isVideo" :src="previewItem.url" controls style="max-width:100%;max-height:75vh;border-radius:8px"></video>
          <img v-else :src="previewItem?.url" style="max-width:100%;max-height:75vh;object-fit:contain;border-radius:8px" />
        </div>
        <div class="ml-viewer-sidebar">
          <div class="ml-viewer-info">
            <span class="ml-viewer-name">{{ previewItem?.name }}</span>
            <div style="display:flex;gap:6px;margin-top:8px">
              <el-tag size="small">{{ previewItem?.type }}</el-tag>
              <el-tag size="small" type="info">{{ previewItem?.subType }}</el-tag>
            </div>
            <div class="ml-viewer-url" :title="previewItem?.url">{{ previewItem?.url }}</div>
          </div>
          <div class="ml-viewer-actions">
            <el-button @click="downloadItem(previewItem)" style="width:100%">📥 下载</el-button>
            <el-button type="danger" @click="deleteItem(previewItem); previewVisible = false" style="width:100%">🗑️ 删除</el-button>
            <el-button @click="previewVisible = false" style="width:100%">关闭</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';

const projectStore = useProjectStore();
const currentProjectId = ref('');
const items = ref([]);
const filterType = ref('');
const previewVisible = ref(false);
const previewItem = ref(null);
const selectedItems = ref([]);
const multiSelect = ref(false);
const downloading = ref(false);
const gridRef = ref(null);
const cardRefs = ref({});
// 拖选
const dragging = ref(false);
let dragStartX = 0, dragStartY = 0;
let dragSelected = new Set();

function onGridMouseDown(e) {
  if (!multiSelect.value) return;
  dragging.value = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragSelected = new Set(selectedItems.value.map(i => i.url));
}
function onGridMouseMove(e) {
  if (!dragging.value || !multiSelect.value) return;
  const rect = { left: Math.min(dragStartX, e.clientX), right: Math.max(dragStartX, e.clientX), top: Math.min(dragStartY, e.clientY), bottom: Math.max(dragStartY, e.clientY) };
  const newSelected = new Set(dragSelected);
  filteredItems.value.forEach((item, idx) => {
    const el = cardRefs.value[idx];
    if (!el) return;
    const cr = el.getBoundingClientRect();
    const overlaps = !(cr.right < rect.left || cr.left > rect.right || cr.bottom < rect.top || cr.top > rect.bottom);
    if (overlaps) newSelected.add(item.url); else if (!e.shiftKey) newSelected.delete(item.url);
  });
  selectedItems.value = filteredItems.value.filter(i => newSelected.has(i.url));
}
function onGridMouseUp() { dragging.value = false; }

function toggleSelect(item, val) { if (val) { if (!selectedItems.value.find(i => i.url === item.url)) selectedItems.value.push(item); } else { selectedItems.value = selectedItems.value.filter(i => i.url !== item.url); } }

async function batchDownload() {
  if (selectedItems.value.length === 0) return;
  downloading.value = true;
  try {
    const urls = selectedItems.value.map(i => i.url);
    const names = selectedItems.value.map(i => (i.name || 'file') + (i.isVideo ? '.mp4' : '.png'));
    const res = await fetch('/api/v1/media-library/batch-download', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ urls, names }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'media_batch.zip'; a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('下载已开始');
    } else {
      const d = await res.json();
      ElMessage.error(d.message || '下载失败');
    }
  } catch (e) { ElMessage.error('下载失败'); }
  finally { downloading.value = false; }
}

const filteredItems = computed(() => {
  if (!filterType.value) return items.value;
  if (filterType.value === '视频') return items.value.filter(i => i.isVideo);
  return items.value.filter(i => i.type === filterType.value);
});

function setFilter(type) { filterType.value = type; }
function isCloudUrl(url) { return url && (url.startsWith('https://') || url.startsWith('http://')); }
function tagType(t) {
  const m = { '角色': 'success', '场景': '', '道具': 'warning', '故事板': 'info', '视频': 'danger', '封面': 'danger' };
  return m[t] || 'info';
}

onMounted(async () => {
  await projectStore.fetchProjects();
  const r = await projectStore.restoreLastProject();
  if (r) { currentProjectId.value = r._id; loadMedia(); }
});

async function loadMedia() {
  if (!currentProjectId.value) return;
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`/api/v1/media-library?projectId=${currentProjectId.value}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    items.value = data.data?.items || [];
  } catch (e) { items.value = []; }
}

function openPreview(item) {
  previewItem.value = item;
  previewVisible.value = true;
}

function downloadItem(item) {
  const a = document.createElement('a');
  a.href = item.url;
  a.download = item.name + (item.isVideo ? '.mp4' : '.png');
  a.target = '_blank';
  a.click();
}

async function deleteItem(item) {
  try { await ElMessageBox.confirm('确定删除这个资源？', '提示', { type: 'warning' }); } catch { return; }
  try {
    await fetch('/api/v1/media-library/item', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ type: item.type, assetId: item.assetId, url: item.url }),
    });
    items.value = items.value.filter(i => i !== item);
    ElMessage.success('已删除');
  } catch (e) { ElMessage.error('删除失败'); }
}
</script>

<style scoped>
.ml-root { padding: 0; }
.ml-topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.ml-projects { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.ml-pill { font-size: 14px; padding: 8px 20px; border-radius: 20px; cursor: pointer; background: var(--bg-200); border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500; transition: all 0.15s; user-select: none; }
.ml-pill:hover { border-color: var(--gold); color: var(--text-100); }
.ml-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }
.ml-count { font-size: 13px; color: var(--text-200); }
.ml-tabs { display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap; }
.ml-tab { font-size: 13px; padding: 6px 16px; cursor: pointer; color: var(--text-200); border-bottom: 2px solid transparent; transition: all 0.15s; user-select: none; }
.ml-tab:hover { color: var(--text-100); }
.ml-tab.active { color: var(--text-100); font-weight: 700; border-bottom-color: var(--gold); }
.ml-storage-badge { position: absolute; bottom: 4px; left: 4px; font-size: 10px; padding: 1px 6px; border-radius: 4px; color: #fff; z-index: 2; }
.ml-storage-badge.cloud { background: rgba(103,194,58,0.8); }
.ml-storage-badge.local { background: rgba(139,115,85,0.8); }

.ml-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.ml-card {
  background: var(--bg-200); border-radius: 10px; overflow: hidden;
  border: 1px solid var(--bg-300); cursor: pointer; position: relative;
  transition: all 0.2s;
}
.ml-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.ml-img-wrap { width: 100%; padding-top: 100%; position: relative; overflow: hidden; background: var(--bg-100); }
.ml-img-wrap img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ml-video-badge {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  font-size: 32px; color: rgba(255,255,255,0.9); background: rgba(0,0,0,0.5);
  width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
}
.ml-info { padding: 10px 12px 12px; }
.ml-name { font-size: 13px; font-weight: 600; color: var(--text-100); display: block; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-meta { display: flex; align-items: center; gap: 6px; }
.ml-sub { font-size: 11px; color: var(--text-200); }
.ml-sel-overlay { position: absolute; inset: 0; z-index: 2; background: rgba(201,168,76,0.2); display: flex; align-items: center; justify-content: center; pointer-events: none; }
.ml-sel-check { width: 36px; height: 36px; border-radius: 50%; background: var(--gold); display: flex; align-items: center; justify-content: center; color: var(--navy); font-size: 16px; font-weight: 700; line-height: 1; }
.ml-selected { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.3); }
.ml-del-btn { position: absolute; top: 6px; right: 6px; z-index: 2; opacity: 0; transition: opacity 0.15s; }
.ml-card:hover .ml-del-btn { opacity: 1; }

/* 查看器 */
.ml-viewer-body { display: flex; gap: 20px; min-height: 400px; }
.ml-viewer-main { flex: 1; display: flex; align-items: center; justify-content: center; background: #111; border-radius: 10px; padding: 20px; min-width: 0; }
.ml-viewer-sidebar { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }
.ml-viewer-info { flex: 1; }
.ml-viewer-name { font-size: 16px; font-weight: 700; color: var(--text-100); }
.ml-viewer-url { margin-top: 12px; font-size: 10px; color: var(--text-200); word-break: break-all; opacity: 0.6; cursor: default; }
.ml-viewer-actions { display: flex; flex-direction: column; gap: 6px; }
@media (max-width: 700px) { .ml-viewer-body { flex-direction: column; } .ml-viewer-sidebar { width:100%; } }
.ml-empty { text-align: center; padding: 80px 20px; color: var(--text-200); }
.ml-empty p { font-size: 14px; }
</style>
