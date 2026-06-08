<template>
  <div class="mag-page">
    <div class="breadcrumb"><router-link to="/" class="bc-link">导演台</router-link><span class="bc-sep"> &gt; </span><span class="bc-current">配音素材库</span></div>

    <div class="mag-masthead">
      <div class="mag-issue-line"><span class="mag-issue-tag">TTS LIBRARY</span><span class="mag-issue-date">{{ new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' }) }}</span></div>
      <div class="mag-title-row">
        <div class="mag-title-col"><h1 class="mag-title">配音素材</h1></div>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <el-select v-model="filterProjectId" placeholder="片场筛选" clearable style="width:220px" size="small" @change="fetchData">
        <el-option v-for="p in projectStore.projects" :key="p._id" :label="p.name" :value="p._id" />
      </el-select>
      <el-button size="small" @click="fetchData"><Refresh size="14" fill="currentColor"/> 刷新</el-button>
      <el-button v-if="selectedIds.length > 0" size="small" type="primary" @click="batchDownload"><FolderDownload size="14" fill="currentColor"/> 打包下载 ({{ selectedIds.length }})</el-button>
      <el-button v-if="selectedIds.length > 0" size="small" type="danger" @click="batchDelete"><Delete size="14" fill="currentColor"/> 批量删除 ({{ selectedIds.length }})</el-button>
    </div>

    <div v-if="loading" style="text-align:center;padding:60px;color:var(--text-200)">加载中...</div>

    <template v-else-if="tree.length > 0">
      <div v-for="project in tree" :key="project.projectId" style="margin-bottom:32px">
        <h3 style="font-family:'Playfair Display',serif;font-size:16px;color:var(--text-100);margin-bottom:12px;border-bottom:1px solid var(--gold);padding-bottom:6px">
          <Film size="16" fill="var(--gold)"/> {{ getProjectName(project.projectId) }}
        </h3>
        <div v-for="ep in project.episodes" :key="ep.scriptId" style="margin-bottom:16px">
          <h4 style="font-size:13px;color:var(--gold-dark);margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--gold);color:var(--navy);font-weight:700;font-size:11px">{{ ep.episodeNumber }}</span>
            第{{ ep.episodeNumber }}集
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:10px">
            <div v-for="a in ep.audios" :key="a._id" class="tts-item" :class="{ selected: selectedIds.includes(a._id) }" @click="toggleSelect(a._id, $event)">
              <div class="tts-left">
                <span class="tts-shot-num">#{{ a.shotNumber }}</span>
                <div class="tts-avatar">{{ (a.characterName || '?')[0] }}</div>
              </div>
              <div class="tts-center">
                <span class="tts-char">{{ a.characterName || '配音' }}</span>
                <span class="tts-text">{{ a.text.substring(0, 40) }}{{ a.text.length > 40 ? '...' : '' }}</span>
                <div class="tts-player-row">
                  <button class="tts-play-btn" @click.stop="togglePlay(a)">
                    <Right v-if="playingId !== a._id" theme="filled" size="18" fill="#fff" />
                    <PauseOne v-else theme="filled" size="18" fill="#fff" />
                  </button>
                  <div class="tts-wave-bar" @click.stop>
                    <span v-for="n in 12" :key="n" class="tts-wave-seg" :class="{ active: playingId === a._id && n <= 12 }"></span>
                  </div>
                </div>
                <audio :ref="el => { if (el) audioRefs[a._id] = el }" :src="a.audioUrl" preload="none" @ended="onAudioEnd(a._id)" />
              </div>
              <div class="tts-actions">
                <el-button size="small" circle @click.stop="downloadSingle(a)" title="下载"><Download size="14" fill="currentColor"/></el-button>
                <el-button size="small" circle type="danger" @click.stop="confirmDelete(a._id)" title="删除"><Delete size="14" fill="currentColor"/></el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="mag-empty">
      <div class="mag-empty-num">No. 00</div>
      <Voice size="48" fill="var(--primary-300)"/>
      <h2>还没有配音素材</h2>
      <p>去镜头板为分镜台词合成语音吧~</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Delete, Download, FolderDownload, Voice, Film, Right, PauseOne } from '@icon-park/vue-next';
import { useProjectStore } from '../stores/project';
import { ttsAPI } from '../api';

const projectStore = useProjectStore();
const tree = ref([]);
const loading = ref(false);
const filterProjectId = ref('');
const selectedIds = ref([]);
const playingId = ref(null);
const audioRefs = reactive({});

function togglePlay(a) {
  const el = audioRefs[a._id];
  if (!el) return;
  if (playingId.value === a._id) {
    el.pause();
    playingId.value = null;
  } else {
    if (playingId.value) {
      const prev = audioRefs[playingId.value];
      if (prev) prev.pause();
    }
    el.play();
    playingId.value = a._id;
  }
}
function onAudioEnd(id) {
  if (playingId.value === id) playingId.value = null;
}

function getProjectName(id) {
  return projectStore.projects.find(p => p._id === id)?.name || '未知片场';
}

function toggleSelect(id, e) {
  if (e.target.closest('audio') || e.target.closest('button')) return;
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) selectedIds.value.splice(idx, 1);
  else selectedIds.value.push(id);
}

async function fetchData() {
  loading.value = true;
  try {
    const params = {};
    if (filterProjectId.value) params.projectId = filterProjectId.value;
    const { data } = await ttsAPI.getLibrary(params);
    tree.value = data.tree || [];
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

function downloadSingle(a) {
  const link = document.createElement('a');
  link.href = a.audioUrl;
  link.download = `shot-${a.shotNumber}_${a.characterName || 'voice'}.mp3`;
  link.click();
}

async function confirmDelete(id) {
  try { await ElMessageBox.confirm('确定删除这条配音？', '删除', { type: 'warning' }); } catch { return; }
  try { await ttsAPI.deleteAudio(id); ElMessage.success('已删除'); fetchData(); } catch { ElMessage.error('删除失败'); }
}

async function batchDelete() {
  try { await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条配音？`, '批量删除', { type: 'warning' }); } catch { return; }
  try { await ttsAPI.batchDelete(selectedIds.value); ElMessage.success('已删除'); selectedIds.value = []; fetchData(); } catch { ElMessage.error('删除失败'); }
}

async function batchDownload() {
  try {
    const res = await ttsAPI.batchDownload(selectedIds.value);
    const url = window.URL.createObjectURL(new Blob([res]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tts-batch-${Date.now()}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch { ElMessage.error('下载失败'); }
}

onMounted(async () => {
  await projectStore.fetchProjects();
  fetchData();
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Noto+Serif+SC:wght@400;600;700;900&display=swap');

.mag-page { padding: 0; font-family: 'Noto Serif SC', serif; max-width: 1100px; margin: 0 auto; }
.breadcrumb { display: flex; align-items: center; padding: 0 0 16px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; }
.bc-link { color: var(--text-200); text-decoration: none; font-weight: 500; }
.bc-link:hover { color: var(--gold-dark); }
.bc-sep { color: var(--gold); margin: 0 8px; font-size: 9px; user-select: none; }
.bc-current { color: var(--text-100); font-weight: 700; border-bottom: 2px solid var(--gold); padding-bottom: 3px; }
.mag-masthead { margin-bottom: 32px; border-bottom: 2px solid var(--gold); padding-bottom: 24px; }
.mag-issue-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.mag-issue-tag { font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 700; letter-spacing: 4px; color: var(--gold-dark); }
.mag-issue-date { font-size: 12px; color: var(--text-200); letter-spacing: 2px; }
.mag-title { font-family: 'Playfair Display', serif; font-size: 48px; font-weight: 900; color: var(--text-100); margin: 0; }
.tts-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: var(--bg-200);
  border: 1px solid var(--bg-300); border-radius: 10px; cursor: pointer; transition: all 0.2s;
}
.tts-item:hover { border-color: var(--gold); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.tts-item.selected { border-color: var(--gold); background: var(--accent-200); }
.tts-left { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.tts-shot-num { font-size: 11px; color: var(--gold-dark); width: 24px; font-weight: 600; }
.tts-avatar {
  width: 36px; height: 36px; border-radius: 50%; background: var(--navy); color: var(--gold);
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;
}
.tts-center { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.tts-char { font-size: 13px; font-weight: 700; color: var(--text-100); }
.tts-text { font-size: 11px; color: var(--text-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; }
.tts-player-row { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
.tts-play-btn {
  width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--gold);
  background: var(--navy); color: var(--gold); font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all 0.15s;
}
.tts-play-btn:hover { background: var(--gold); color: var(--navy); }
.tts-wave-bar { display: flex; align-items: flex-end; gap: 3px; height: 28px; flex: 1; pointer-events: none; }
.tts-wave-seg {
  width: 4px; border-radius: 2px; background: var(--bg-300); transition: all 0.3s;
  height: 8px;
}
.tts-wave-seg:nth-child(1) { height: 12px; } .tts-wave-seg:nth-child(2) { height: 18px; }
.tts-wave-seg:nth-child(3) { height: 24px; } .tts-wave-seg:nth-child(4) { height: 16px; }
.tts-wave-seg:nth-child(5) { height: 22px; } .tts-wave-seg:nth-child(6) { height: 14px; }
.tts-wave-seg:nth-child(7) { height: 20px; } .tts-wave-seg:nth-child(8) { height: 10px; }
.tts-wave-seg:nth-child(9) { height: 16px; } .tts-wave-seg:nth-child(10) { height: 8px; }
.tts-wave-seg:nth-child(11) { height: 12px; } .tts-wave-seg:nth-child(12) { height: 6px; }
.tts-wave-seg.active { background: var(--gold); }
.tts-actions { display: flex; gap: 4px; flex-shrink: 0; }
.mag-empty { text-align: center; padding: 80px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.mag-empty-num { font-family: 'Playfair Display', serif; font-size: 14px; color: var(--primary-300); letter-spacing: 4px; }
.mag-empty h2 { font-family: 'Playfair Display', serif; font-size: 24px; color: var(--text-100); margin: 0; }
.mag-empty p { font-size: 14px; color: var(--text-200); margin: 0; }
</style>
