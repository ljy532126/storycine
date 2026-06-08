<template>
  <div class="ml-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">素材库</span>
    </div>

    <!-- 项目 Pills -->
    <div class="ml-projects" v-if="projectStore.projects.length > 0">
      <span
        :class="['ml-pill', { active: currentProjectId === p._id }]"
        v-for="p in projectStore.projects" :key="p._id"
        @click="currentProjectId = p._id; loadMedia()"
      >
        <FolderOpen theme="outline" size="15" fill="currentColor" style="vertical-align:-3px;margin-right:4px" />
        {{ p.name }}
      </span>
    </div>

    <!-- 分类 Tab + 工具栏 -->
    <div class="ml-bar" v-if="currentProjectId">
      <div class="ml-filters">
        <span
          :class="['ml-tab', { active: filterType === '' }]"
          @click="setFilter('')"
        >
          <AllApplication theme="outline" size="14" fill="currentColor" />
          全部
        </span>
        <span :class="['ml-tab', { active: filterType === '角色' }]" @click="setFilter('角色')">
          <People theme="outline" size="14" fill="currentColor" /> 角色
        </span>
        <span :class="['ml-tab', { active: filterType === '场景' }]" @click="setFilter('场景')">
          <Pic theme="outline" size="14" fill="currentColor" /> 场景
        </span>
        <span :class="['ml-tab', { active: filterType === '道具' }]" @click="setFilter('道具')">
          <Tool theme="outline" size="14" fill="currentColor" /> 道具
        </span>
        <span :class="['ml-tab', { active: filterType === '故事板' }]" @click="setFilter('故事板')">
          <Film theme="outline" size="14" fill="currentColor" /> 故事板
        </span>
        <span :class="['ml-tab', { active: filterType === '视频' }]" @click="setFilter('视频')">
          <PlayTwo theme="outline" size="14" fill="currentColor" /> 视频
        </span>
        <span :class="['ml-tab', { active: filterType === '封面' }]" @click="setFilter('封面')">
          <PictureOne theme="outline" size="14" fill="currentColor" /> 封面
        </span>
      </div>
      <div class="ml-tools" v-if="items.length > 0">
        <span class="ml-count">共 {{ filteredItems.length }} / {{ items.length }} 个</span>
        <el-button size="small" :type="multiSelect ? 'warning' : ''" plain @click="multiSelect = !multiSelect; if(!multiSelect) selectedItems = []">
          <el-icon><Select /></el-icon> {{ multiSelect ? '取消多选' : '多选' }}
        </el-button>
        <el-button v-if="selectedItems.length > 0" size="small" type="primary" @click="batchDownload" :loading="downloading">
          <el-icon><Download /></el-icon> 打包 ({{ selectedItems.length }})
        </el-button>
        <el-button v-if="selectedItems.length > 0" size="small" @click="selectedItems = []">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 图片网格 -->
    <div class="ml-grid" v-if="filteredItems.length > 0" ref="gridRef"
      @mousedown="onGridMouseDown" @mousemove="onGridMouseMove" @mouseup="onGridMouseUp" @mouseleave="onGridMouseUp">
      <div v-for="(item, idx) in filteredItems" :key="idx"
        :ref="el => { if (el) cardRefs[idx] = el }"
        class="ml-card" :class="{ 'ml-selected': selectedItems.includes(item) }"
        @click="multiSelect ? toggleSelect(item, !selectedItems.includes(item)) : openPreview(item)">
        <div class="ml-card-img" :class="{ 'is-video': item.isVideo }">
          <template v-if="item.isVideo">
            <div class="ml-video-placeholder">
              <div class="ml-video-ph-icon">
                <PlayTwo theme="filled" size="28" fill="#fff" />
              </div>
              <span class="ml-video-ph-label">视频素材</span>
            </div>
          </template>
          <img v-else :src="item.url" loading="lazy" @error="onImgError($event)" />
          <div class="ml-storage-badge" :class="isCloudUrl(item.url) ? 'cloud' : 'local'">
            <Cloudy v-if="isCloudUrl(item.url)" theme="outline" size="12" fill="#fff" />
            <FolderDownload v-else theme="outline" size="12" fill="#fff" />
            {{ isCloudUrl(item.url) ? '云端' : '本地' }}
          </div>
        </div>
        <div class="ml-card-body">
          <span class="ml-card-name">{{ item.name || '未命名' }}</span>
          <div class="ml-card-meta">
            <el-tag size="small" :type="tagType(item.type)" effect="plain">{{ item.type }}</el-tag>
            <span class="ml-card-sub">{{ item.subType }}</span>
          </div>
        </div>
        <div class="ml-card-actions">
          <el-button size="small" circle @click.stop="downloadItem(item)" title="下载"><el-icon><Download /></el-icon></el-button>
          <el-button size="small" circle type="danger" @click.stop="deleteItem(item)" title="删除"><el-icon><Delete /></el-icon></el-button>
        </div>
        <div v-if="multiSelect && selectedItems.includes(item)" class="ml-sel-overlay">
          <span class="ml-sel-check"><Check theme="outline" size="20" fill="#fff" /></span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="ml-empty" v-if="!currentProjectId">
      <div class="ml-empty-icon">
        <FolderOpen theme="outline" size="56" fill="#d4c5c0" />
      </div>
      <p>请先选择一个片场</p>
      <span class="ml-empty-sub">在顶部片场列表中选择一个项目查看其素材</span>
    </div>
    <div class="ml-empty" v-else-if="items.length === 0">
      <div class="ml-empty-icon">
        <PictureOne theme="outline" size="56" fill="#d4c5c0" />
      </div>
      <p>资源库还是空的</p>
      <span class="ml-empty-sub">去角色小店、故事板或生成图片后会出现在这里</span>
    </div>

    <!-- 预览弹窗 -->
    <Teleport to="body">
      <div v-if="previewVisible" class="ml-lightbox" @click.self="previewVisible = false" @keydown.escape="previewVisible = false">
        <!-- 顶部栏 -->
        <div class="ml-lb-topbar">
          <div class="ml-lb-top-left">
            <span class="ml-lb-name">{{ previewItem?.name || '预览' }}</span>
            <div class="ml-lb-tags">
              <el-tag size="small" :type="tagType(previewItem?.type)" effect="dark">{{ previewItem?.type }}</el-tag>
              <el-tag size="small" type="info" effect="dark">{{ previewItem?.subType }}</el-tag>
              <el-tag size="small" effect="dark" :type="isCloudUrl(previewItem?.url) ? 'success' : 'warning'">
                <Cloudy v-if="isCloudUrl(previewItem?.url)" theme="outline" size="12" fill="currentColor" />
                <FolderDownload v-else theme="outline" size="12" fill="currentColor" />
                {{ isCloudUrl(previewItem?.url) ? '云端' : '本地' }}
              </el-tag>
            </div>
          </div>
          <div class="ml-lb-top-right">
            <el-button circle @click="downloadItem(previewItem)" title="下载"><el-icon size="18"><Download /></el-icon></el-button>
            <el-button circle type="danger" plain @click="deleteItem(previewItem); previewVisible = false" title="删除"><el-icon size="18"><Delete /></el-icon></el-button>
            <el-button circle @click="previewVisible = false" title="关闭"><el-icon size="20"><Close /></el-icon></el-button>
          </div>
        </div>

        <!-- 主内容区 -->
        <div class="ml-lb-stage">
          <div class="ml-lb-frame" :class="{ 'portrait': isPreviewPortrait }">
            <video v-if="previewItem?.isVideo" :src="previewItem.url" controls autoplay class="ml-lb-media" />
            <img v-else :src="previewItem?.url" class="ml-lb-media" @load="onPreviewLoad" />
          </div>
        </div>

        <!-- 底部信息条 -->
        <div class="ml-lb-bottombar">
          <span class="ml-lb-url" :title="previewItem?.url">{{ previewItem?.url }}</span>
          <span class="ml-lb-ratio" v-if="previewRatio">{{ previewRatio }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';
import {
  FolderOpen, People, Pic, Tool, Film, PlayTwo, PictureOne,
  Cloudy, FolderDownload, AllApplication, Check,
} from '@icon-park/vue-next';
import { Download, Delete, Select, Close } from '@element-plus/icons-vue';

const projectStore = useProjectStore();
const currentProjectId = ref('');
const items = ref([]);
const filterType = ref('');
const previewVisible = ref(false);
const previewItem = ref(null);
const isPreviewPortrait = ref(false);
const previewRatio = ref('');
const selectedItems = ref([]);
const multiSelect = ref(false);
const downloading = ref(false);
const gridRef = ref(null);
const cardRefs = ref({});

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
    if (!(cr.right < rect.left || cr.left > rect.right || cr.bottom < rect.top || cr.top > rect.bottom))
      newSelected.add(item.url);
    else if (!e.shiftKey) newSelected.delete(item.url);
  });
  selectedItems.value = filteredItems.value.filter(i => newSelected.has(i.url));
}
function onGridMouseUp() { dragging.value = false; }

function toggleSelect(item, val) {
  if (val) { if (!selectedItems.value.find(i => i.url === item.url)) selectedItems.value.push(item); }
  else selectedItems.value = selectedItems.value.filter(i => i.url !== item.url);
}

async function batchDownload() {
  if (selectedItems.value.length === 0) return;
  downloading.value = true;
  try {
    const res = await fetch('/api/v1/media-library/batch-download', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ urls: selectedItems.value.map(i => i.url), names: selectedItems.value.map(i => (i.name || 'file') + (i.isVideo ? '.mp4' : '.png')) }),
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
  } catch { ElMessage.error('下载失败'); }
  finally { downloading.value = false; }
}

const filteredItems = computed(() => {
  if (!filterType.value) return items.value;
  if (filterType.value === '视频') return items.value.filter(i => i.isVideo);
  return items.value.filter(i => i.type === filterType.value);
});

function setFilter(type) { filterType.value = type; }
function isCloudUrl(url) { return url && (url.startsWith('https://') || url.startsWith('http://')); }
function onImgError(e) {
  e.target.style.display = 'none';
}
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
    const res = await fetch(`/api/v1/media-library?projectId=${currentProjectId.value}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    items.value = data.data?.items || [];
  } catch { items.value = []; }
}

function openPreview(item) {
  previewItem.value = item;
  isPreviewPortrait.value = false;
  previewRatio.value = '';
  previewVisible.value = true;
}
function onPreviewLoad(e) {
  const w = e.target.naturalWidth || e.target.videoWidth || 0;
  const h = e.target.naturalHeight || e.target.videoHeight || 0;
  if (w && h) {
    isPreviewPortrait.value = h > w;
    const ratio = w / h;
    if (ratio > 1.7) previewRatio.value = '超宽 ' + w + '×' + h;
    else if (ratio > 1.3) previewRatio.value = '16:9';
    else if (ratio > 0.7) previewRatio.value = '1:1';
    else previewRatio.value = '9:16 竖屏';
  }
}

function downloadItem(item) {
  const a = document.createElement('a');
  a.href = item.url; a.download = item.name + (item.isVideo ? '.mp4' : '.png'); a.target = '_blank'; a.click();
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
  } catch { ElMessage.error('删除失败'); }
}
</script>

<style scoped>
.ml-root { padding: 0; }

.ml-projects { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.ml-pill {
  font-size: 13px; padding: 7px 18px; border-radius: 20px; cursor: pointer;
  background: var(--bg-200); border: 1px solid var(--bg-300);
  color: var(--text-200); font-weight: 500; transition: all 0.18s; user-select: none;
  display: flex; align-items: center;
}
.ml-pill:hover { border-color: var(--gold); color: var(--text-100); }
.ml-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }

/* ===== 工具栏 ===== */
.ml-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 18px; flex-wrap: wrap;
}
.ml-filters { display: flex; gap: 2px; background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 4px; }
.ml-tab {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; padding: 7px 14px; border-radius: 7px;
  cursor: pointer; color: var(--text-200); font-weight: 500;
  transition: all 0.15s; user-select: none; white-space: nowrap;
}
.ml-tab:hover { color: var(--text-100); background: var(--bg-100); }
.ml-tab.active { background: var(--navy); color: var(--gold); font-weight: 700; }
.ml-tools { display: flex; align-items: center; gap: 8px; }
.ml-count { font-size: 12px; color: var(--text-200); white-space: nowrap; }

/* ===== 卡片网格 ===== */
.ml-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.ml-card {
  background: var(--bg-200); border-radius: 12px; overflow: hidden;
  border: 1px solid var(--bg-300); cursor: pointer; position: relative;
  transition: all 0.2s; display: flex; flex-direction: column;
}
.ml-card:hover { border-color: var(--gold); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }

.ml-card-img { width: 100%; padding-top: 100%; position: relative; overflow: hidden; background: var(--bg-100); }
.ml-card-img.is-video { background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 40%, #1a1a2e 100%); }
.ml-card-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.ml-card:hover .ml-card-img img { transform: scale(1.05); }

/* 视频占位卡片 */
.ml-video-placeholder {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
}
.ml-video-ph-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(201,168,76,0.15); border: 2px solid rgba(201,168,76,0.3);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s;
}
.ml-card:hover .ml-video-ph-icon {
  background: rgba(201,168,76,0.25); border-color: var(--gold);
  transform: scale(1.1); box-shadow: 0 0 20px rgba(201,168,76,0.2);
}
.ml-video-ph-label {
  font-size: 10px; font-weight: 600; color: rgba(201,168,76,0.5);
  text-transform: uppercase; letter-spacing: 2px;
}
.ml-card-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }

.ml-storage-badge {
  position: absolute; bottom: 6px; left: 6px; z-index: 2;
  font-size: 10px; padding: 2px 7px; border-radius: 4px; color: #fff;
  display: flex; align-items: center; gap: 3px; font-weight: 600;
}
.ml-storage-badge.cloud { background: rgba(103,194,58,0.85); }
.ml-storage-badge.local { background: rgba(139,115,85,0.85); }

.ml-card-body { padding: 10px 12px 8px; }
.ml-card-name { font-size: 12px; font-weight: 600; color: var(--text-100); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 6px; }
.ml-card-meta { display: flex; align-items: center; gap: 6px; }
.ml-card-sub { font-size: 10px; color: var(--text-200); }
.ml-card-actions {
  display: flex; gap: 4px; padding: 0 12px 10px; opacity: 0; transition: opacity 0.15s;
}
.ml-card:hover .ml-card-actions { opacity: 1; }

.ml-sel-overlay { position: absolute; inset: 0; z-index: 5; background: rgba(201,168,76,0.15); display: flex; align-items: center; justify-content: center; pointer-events: none; border-radius: 12px; }
.ml-sel-check { width: 40px; height: 40px; border-radius: 50%; background: var(--gold); display: flex; align-items: center; justify-content: center; }
.ml-selected { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.25); }

/* ===== 空状态 ===== */
.ml-empty { text-align: center; padding: 100px 20px; }
.ml-empty-icon { margin-bottom: 16px; opacity: 0.4; }
.ml-empty p { font-size: 15px; color: var(--text-100); font-weight: 600; margin: 0 0 4px; }
.ml-empty-sub { font-size: 12px; color: var(--text-200); }

/* ===== Lightbox 预览 ===== */
.ml-lightbox {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(8, 10, 16, 0.96); backdrop-filter: blur(20px);
  display: flex; flex-direction: column;
  animation: ml-lb-in 0.2s ease-out;
}
@keyframes ml-lb-in { from { opacity: 0; } to { opacity: 1; } }

.ml-lb-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ml-lb-top-left { display: flex; align-items: center; gap: 14px; }
.ml-lb-name { font-size: 15px; font-weight: 700; color: #e0d6c2; }
.ml-lb-tags { display: flex; gap: 6px; }
.ml-lb-top-right { display: flex; gap: 8px; }
.ml-lb-top-right .el-button--circle {
  width: 38px; height: 38px; background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: #999;
}
.ml-lb-top-right .el-button--circle:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* 主舞台 */
.ml-lb-stage {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 20px; min-height: 0; overflow: auto;
}
.ml-lb-frame {
  display: flex; align-items: center; justify-content: center;
  max-width: 90vw; max-height: calc(100vh - 150px);
  border-radius: 8px; overflow: hidden;
  box-shadow: 0 0 80px rgba(0,0,0,0.5);
  background: #0a0a0a;
}
.ml-lb-frame.portrait { max-width: min(50vw, 500px); }
.ml-lb-media {
  display: block; max-width: 100%; max-height: calc(100vh - 150px);
  object-fit: contain; border-radius: 6px;
}

/* 底部栏 */
.ml-lb-bottombar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 11px; color: rgba(255,255,255,0.3);
}
.ml-lb-url { max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
.ml-lb-ratio { color: rgba(255,255,255,0.2); font-weight: 600; }

/* 按需引入的 lightbox 标签样式覆盖 */
.ml-lightbox .el-tag--dark { border: none; }


@media (max-width: 700px) {
  .ml-bar { flex-direction: column; align-items: stretch; }
  .ml-lb-name { font-size: 13px; }
  .ml-lb-tags { display: none; }
  .ml-lb-topbar { padding: 10px 14px; }
  .ml-lb-stage { padding: 10px; }
}

/* 兼容旧 breadcrumb */
.breadcrumb { padding: 4px 0 8px; flex-shrink: 0; }
.bc-link { color: var(--text-200); text-decoration: none; font-weight: 500; }
.bc-link:hover { color: var(--gold-dark); }
.bc-sep { font-size: 11px; color: var(--text-200); margin: 0 6px; }
.bc-current { font-size: 11px; color: var(--gold-dark); font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; }
</style>
