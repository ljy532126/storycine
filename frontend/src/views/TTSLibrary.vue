<template>
  <div class="tts-root">
    <Breadcrumb title="配音素材库" />

    <!-- 顶部工具栏 -->
    <div class="tts-bar">
      <div class="tts-bar-left">
        <el-select v-model="filterProjectId" placeholder="片场筛选" clearable style="width:200px" size="default" @change="fetchData">
          <el-option v-for="p in projectStore.projects" :key="p._id" :label="p.name" :value="p._id" />
        </el-select>
        <el-button @click="fetchData"><Refresh size="14" fill="currentColor"/> 刷新</el-button>
        <span class="tts-count" v-if="totalCount > 0">共 {{ totalCount }} 条配音</span>
      </div>
      <div class="tts-bar-right" v-if="selectedIds.length > 0">
        <span class="tts-sel-count">已选 {{ selectedIds.length }} 条</span>
        <el-button type="primary" size="small" @click="batchDownload"><FolderDownload size="14" fill="currentColor"/> 打包下载</el-button>
        <el-button type="danger" size="small" plain @click="batchDelete"><Delete size="14" fill="currentColor"/> 批量删除</el-button>
      </div>
    </div>

    <div v-if="loading" class="tts-loading">
      <el-icon class="tts-spin" size="24"><Refresh /></el-icon>
      <span>加载配音数据...</span>
    </div>

    <template v-else-if="tree.length > 0">
      <div v-for="project in tree" :key="project.projectId" class="tts-project">
        <div class="tts-project-head">
          <Film size="16" fill="var(--gold)"/>
          <span>{{ getProjectName(project.projectId) }}</span>
        </div>

        <div v-for="ep in project.episodes" :key="ep.scriptId" class="tts-episode">
          <div class="tts-ep-head">
            <span class="tts-ep-badge">{{ ep.episodeNumber }}</span>
            <span>第{{ ep.episodeNumber }}集</span>
            <span class="tts-ep-count">{{ ep.audios.length }} 条</span>
            <button class="tts-ep-dl" @click="downloadEpisode(ep)" title="一键下载本集全部配音">
              <DownloadTwo theme="outline" size="14" fill="currentColor" />
              下载本集
            </button>
          </div>

          <div class="tts-grid">
            <div
              v-for="a in ep.audios" :key="a._id"
              :class="['tts-card', { 'tts-playing': playingId === a._id, 'tts-selected': selectedIds.includes(a._id) }]"
              @click="toggleSelect(a._id, $event)"
            >
              <!-- 选中标记 -->
              <div v-if="selectedIds.includes(a._id)" class="tts-card-check">
                <CheckOne theme="filled" size="18" fill="#fff" />
              </div>

              <!-- 角色头像 -->
              <div class="tts-card-avatar">
                <span>{{ (a.characterName || 'VO')[0] }}</span>
              </div>

              <!-- 信息 -->
              <div class="tts-card-info">
                <div class="tts-card-top">
                  <span class="tts-card-char">{{ a.characterName || '配音' }}</span>
                  <span class="tts-card-shot">镜号 #{{ a.shotNumber }}</span>
                </div>
                <p class="tts-card-text">{{ a.text }}</p>
              </div>

              <!-- 播放区 -->
              <div class="tts-card-play" @click.stop>
                <button class="tts-play-btn" @click="togglePlay(a)">
                  <PlayOne v-if="playingId !== a._id" theme="filled" size="18" fill="currentColor" />
                  <PauseOne v-else theme="filled" size="18" fill="currentColor" />
                </button>
                <div class="tts-wave">
                  <span v-for="n in 20" :key="n" class="tts-wave-bar" :class="{ active: playingId === a._id }" :style="{ animationDelay: (n * 0.06) + 's', height: (12 + Math.abs(Math.sin(n * 0.7) * 16 + Math.cos(n * 1.3) * 8)) + 'px' }" />
                </div>
              </div>

              <!-- 悬停操作 -->
              <div class="tts-card-actions">
                <el-button size="small" circle @click.stop="downloadSingle(a)" title="下载">
                  <el-icon><Download /></el-icon>
                </el-button>
                <el-button size="small" circle type="danger" plain @click.stop="confirmDelete(a._id)" title="删除">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>

              <audio :ref="el => { if (el) audioRefs[a._id] = el }" :src="a.audioUrl" preload="none" @ended="onAudioEnd(a._id)" @play="onAudioPlay(a._id)" @pause="onAudioPause(a._id)" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <div class="tts-empty" v-else>
      <div class="tts-empty-icon">
        <Voice theme="outline" size="64" fill="#d4c5c0" />
      </div>
      <h2>还没有配音素材</h2>
      <p>去镜头板为分镜台词合成语音，生成的配音会自动出现在这里</p>
      <router-link to="/workspace?ws=storyboard" class="tts-empty-link">
        前往镜头板
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Delete, FolderDownload, Voice, Film, PlayOne, PauseOne, CheckOne, DownloadTwo } from '@icon-park/vue-next';
import { Download } from '@element-plus/icons-vue';
import { useProjectStore } from '../stores/project';
import { ttsAPI } from '../api';
import Breadcrumb from '../components/Breadcrumb.vue';

const projectStore = useProjectStore();
const tree = ref([]);
const loading = ref(false);
const filterProjectId = ref('');
const selectedIds = ref([]);
const playingId = ref(null);
const audioRefs = reactive({});

const totalCount = computed(() => {
  let c = 0;
  tree.value.forEach(p => p.episodes.forEach(e => c += e.audios.length));
  return c;
});

function togglePlay(a) {
  const el = audioRefs[a._id];
  if (!el) return;
  if (playingId.value === a._id) {
    el.pause();
  } else {
    if (playingId.value) {
      const prev = audioRefs[playingId.value];
      if (prev) { prev.pause(); prev.currentTime = 0; }
    }
    el.play();
  }
}
function onAudioPlay(id) { playingId.value = id; }
function onAudioPause(id) { if (playingId.value === id) playingId.value = null; }
function onAudioEnd(id) { if (playingId.value === id) playingId.value = null; }

function getProjectName(id) {
  return projectStore.projects.find(p => p._id === id)?.name || '未知片场';
}

function toggleSelect(id, e) {
  if (e.target.closest('audio') || e.target.closest('button') || e.target.closest('.el-button') || e.target.closest('.tts-ep-dl')) return;
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
    link.href = url; link.download = `tts-batch-${Date.now()}.zip`; link.click();
    window.URL.revokeObjectURL(url);
  } catch { ElMessage.error('下载失败'); }
}

function downloadEpisode(ep) {
  ep.audios.forEach((a, i) => {
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = a.audioUrl;
      link.download = `${i + 1}-shot${a.shotNumber}_${a.characterName || 'voice'}.mp3`;
      link.click();
    }, i * 300);
  });
  ElMessage.success(`开始下载 ${ep.audios.length} 条配音`);
}

onMounted(async () => {
  await projectStore.fetchProjects();
  fetchData();
});
</script>

<style scoped>
.tts-root { padding: 0; max-width: 1100px; margin: 0 auto; }

/* 工具栏 */
.tts-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 20px; flex-wrap: wrap;
}
.tts-bar-left { display: flex; align-items: center; gap: 10px; }
.tts-bar-right { display: flex; align-items: center; gap: 8px; }
.tts-count { font-size: 12px; color: var(--text-200); }
.tts-sel-count { font-size: 12px; color: var(--gold-dark); font-weight: 600; }

.tts-loading { text-align: center; padding: 80px 20px; color: var(--text-200); display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 14px; }
.tts-spin { animation: tts-spin 1s linear infinite; }
@keyframes tts-spin { to { transform: rotate(360deg); } }

/* 项目标题 */
.tts-project { margin-bottom: 28px; }
.tts-project-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: var(--text-100);
  margin-bottom: 14px; padding-bottom: 8px;
  border-bottom: 2px solid rgba(201,168,76,0.2);
}

/* 集标题 */
.tts-episode { margin-bottom: 16px; }
.tts-ep-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--gold-dark); font-weight: 600;
  margin-bottom: 10px; padding-left: 2px;
}
.tts-ep-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--gold); color: var(--navy); font-weight: 700; font-size: 11px;
}
.tts-ep-count { font-size: 11px; color: var(--text-200); font-weight: 400; margin-left: auto; }
.tts-ep-dl {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 12px; font-size: 11px; font-family: inherit; font-weight: 600;
  border: 1px solid var(--bg-300); border-radius: 6px;
  background: var(--bg-100); color: var(--text-200); cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.tts-ep-dl:hover { border-color: var(--gold); color: var(--gold-dark); background: rgba(201,168,76,0.05); }

/* 卡片网格 */
.tts-grid { display: flex; flex-direction: column; gap: 8px; }

/* 卡片 */
.tts-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; background: var(--bg-200);
  border: 1px solid var(--bg-300); border-radius: 12px;
  cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
}
.tts-card:hover { border-color: var(--gold); box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
.tts-card.tts-playing {
  border-color: var(--gold);
  background: linear-gradient(135deg, rgba(201,168,76,0.04) 0%, var(--bg-200) 100%);
}
.tts-card.tts-playing::after {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px; background: var(--gold); border-radius: 0 3px 3px 0;
}
.tts-card.tts-selected {
  border-color: var(--gold); background: rgba(201,168,76,0.04);
}

/* 选中勾 */
.tts-card-check {
  position: absolute; top: 8px; right: 8px; z-index: 2;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--gold); display: flex; align-items: center; justify-content: center;
}

/* 头像 */
.tts-card-avatar {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--navy), #2d2d4a);
  color: var(--gold); display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px;
}

/* 信息 */
.tts-card-info { flex: 1; min-width: 0; }
.tts-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.tts-card-char { font-size: 14px; font-weight: 700; color: var(--text-100); }
.tts-card-shot { font-size: 11px; color: var(--gold-dark); background: rgba(201,168,76,0.1); padding: 1px 8px; border-radius: 4px; font-weight: 600; }
.tts-card-text {
  font-size: 12px; color: var(--text-200); margin: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 480px; line-height: 1.5;
}

/* 播放 */
.tts-card-play { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.tts-play-btn {
  width: 42px; height: 42px; border-radius: 50%; border: none;
  background: var(--bg-100); color: var(--gold-dark); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all 0.2s;
}
.tts-play-btn:hover { background: var(--gold); color: #fff; }
.tts-card.tts-playing .tts-play-btn { background: var(--gold); color: #fff; box-shadow: 0 0 16px rgba(201,168,76,0.35); }

/* 波形 */
.tts-wave { display: flex; align-items: center; gap: 2px; height: 32px; }
.tts-wave-bar {
  width: 3px; border-radius: 2px; background: var(--bg-300); min-height: 6px;
  transition: background 0.2s;
}
.tts-playing .tts-wave-bar { background: var(--bg-300); }
.tts-playing .tts-wave-bar.active { background: var(--gold); animation: tts-bounce 0.8s ease-in-out infinite alternate; }
@keyframes tts-bounce {
  0% { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
}

/* 操作按钮 */
.tts-card-actions { display: flex; gap: 4px; flex-shrink: 0; opacity: 0; transition: opacity 0.15s; }
.tts-card:hover .tts-card-actions { opacity: 1; }

/* 空状态 */
.tts-empty {
  text-align: center; padding: 100px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.tts-empty-icon { opacity: 0.3; margin-bottom: 8px; }
.tts-empty h2 { font-size: 18px; font-weight: 700; color: var(--text-100); margin: 0; }
.tts-empty p { font-size: 13px; color: var(--text-200); margin: 0; }
.tts-empty-link {
  margin-top: 8px; padding: 10px 24px; background: var(--gold); color: var(--navy);
  border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none;
  transition: all 0.2s;
}
.tts-empty-link:hover { opacity: 0.85; }

/* 面包屑 */
.breadcrumb { padding: 4px 0 12px; font-size: 12px; }
.bc-link { color: var(--text-200); text-decoration: none; font-weight: 500; }
.bc-link:hover { color: var(--gold-dark); }
.bc-sep { font-size: 11px; color: var(--text-200); margin: 0 6px; }
.bc-current { font-size: 11px; color: var(--gold-dark); font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; }

@media (max-width: 768px) {
  .tts-card-text { max-width: 200px; }
  .tts-card-actions { opacity: 1; }
  .tts-bar { flex-direction: column; align-items: stretch; }
}
</style>
