<template>
  <div class="comp-root">
    <div class="comp-top">
          </div>

    <el-row :gutter="16" class="comp-body" v-if="currentProjectId">
      <!-- 左侧：合成配置 -->
      <el-col :span="12">
        <div class="panel">
          <div class="panel-title">合成配置</div>
          <el-form label-position="top" size="default">
            <el-form-item label="选择分镜表">
              <el-select v-model="selectedStoryboardId" placeholder="选择分镜表" style="width:100%">
                <el-option v-for="s in storyboards" :key="s._id"
                  :label="(s.projectName || '') + ' · 第' + (s.episodeNumber || '?') + '集' + (s.episodeTitle ? ' '+s.episodeTitle : '') + ' · ' + s.totalShots + '镜头 (' + new Date(s.createdAt).toLocaleDateString('zh-CN') + ')'" :value="s._id" />
              </el-select>
            </el-form-item>
            <el-form-item label="输出格式">
              <el-select v-model="composeOptions.outputFormat">
                <el-option v-for="f in ['mp4','mov','avi']" :key="f" :label="f.toUpperCase()" :value="f" />
              </el-select>
            </el-form-item>
            <el-form-item label="分辨率">
              <el-select v-model="composeOptions.resolution">
                <el-option label="1080x1920 (竖屏)" value="1080x1920" />
                <el-option label="1920x1080 (横屏)" value="1920x1080" />
                <el-option label="720x1280 (竖屏)" value="720x1280" />
              </el-select>
            </el-form-item>
            <el-form-item label="帧率">
              <el-input-number v-model="composeOptions.frameRate" :min="12" :max="60" />
            </el-form-item>
            <el-form-item label="转场效果">
              <el-select v-model="composeOptions.transitions">
                <el-option label="淡入淡出" value="fade" />
                <el-option label="剪切" value="cut" />
                <el-option label="滑动" value="slide" />
                <el-option label="叠加" value="dissolve" />
              </el-select>
            </el-form-item>
            <el-form-item label="背景音乐 URL">
              <el-input v-model="composeOptions.backgroundMusic" placeholder="可选，填写音乐文件链接" />
            </el-form-item>
            <el-form-item label="字幕">
              <el-switch v-model="composeOptions.subtitlesEnabled" active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="large" style="width:100%" @click="handleCreateComposition" :disabled="!selectedStoryboardId" :loading="composing">开始合成</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>

      <!-- 右侧：合成任务列表 -->
      <el-col :span="12">
        <div class="panel panel-list">
          <div class="panel-title">合成任务列表</div>
          <div v-if="compositionStore.compositions.length === 0" class="empty-list">暂无合成任务</div>
          <div v-for="c in compositionStore.compositions" :key="c._id" class="task-item">
            <div class="task-header">
              <span class="task-name">{{ c.name }}</span>
              <el-tag :type="compStatusTag(c.status)" size="small">{{ compStatusLabel(c.status) }}</el-tag>
            </div>
            <div class="task-episode" v-if="c.episodeNumber">
              📺 第{{ c.episodeNumber }}集{{ c.episodeTitle ? ' · ' + c.episodeTitle : '' }}
            </div>
            <el-progress v-if="c.status === 'rendering'" :percentage="c.progress" :stroke-width="6" style="margin:6px 0" />
            <div class="task-meta">
              <span>{{ c.resolution }} | {{ c.outputFormat }} | {{ c.frameRate }}fps | {{ c.totalDuration || 0 }}s</span>
              <span>{{ compTransitionLabel(c.transitions) }} | {{ c.subtitlesEnabled ? '字幕开' : '字幕关' }}</span>
            </div>
            <div class="task-meta" style="margin-top:2px">
              <span>{{ formatDate(c.createdAt) }}</span>
            </div>
            <div v-if="c.status === 'completed' && c.outputUrl" class="task-actions">
              <el-button size="small" type="success" @click="downloadComposition(c)">下载成片</el-button>
              <el-button size="small" @click="copyOutputUrl(c.outputUrl)">复制链接</el-button>
              <el-button size="small" @click="deleteTask(c)" class="task-btn-delete">删除</el-button>
            </div>
            <div v-if="c.status !== 'completed'" style="display:flex;gap:6px;margin-top:6px">
              <el-button size="small" @click="deleteTask(c)" class="task-btn-delete">删除</el-button>
            </div>
            <div v-if="c.errorMessage" class="task-error">{{ c.errorMessage }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-empty v-if="!currentProjectId" description="请先选择片场" style="margin-top:80px" />
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onUnmounted, inject, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';
import { useStoryboardStore } from '../stores/storyboard';
import { useCompositionStore } from '../stores/composition';
import { useSocket } from '../components/useSocket';
import ProjectSwitcher from '../components/ProjectSwitcher.vue';


const resetToScriptGenerate = inject('resetToScriptGenerate', () => {});
const projectStore = useProjectStore();
const storyboardStore = useStoryboardStore();
const compositionStore = useCompositionStore();
const socket = useSocket();

const currentProjectId = inject('currentProjectId');
const selectedStoryboardId = ref('');
const composingIds = reactive(new Set()); // 任务级跟踪，替代全局布尔
const composing = computed(() => composingIds.size > 0);
const storyboards = ref([]);
const composeOptions = reactive({ outputFormat: 'mp4', resolution: '1080x1920', frameRate: 24, transitions: 'fade', backgroundMusic: '', subtitlesEnabled: true });
const compTimeouts = {}; // compositionId -> timer

// 合成超时(10分钟)自动清理
const COMP_TIMEOUT = 10 * 60 * 1000;

// 只在 mounted 时注册一次 socket 监听 — 避免重复叠加泄漏
onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  if (restored) { currentProjectId.value = restored._id; onProjectChange(restored._id); }
  socket.connect();

  // 全局注册一次（带 compositionId 匹配，防止串台）
  socket.onCompositionProgress((data) => {
    const c = compositionStore.compositions.find(x => x._id === data.compositionId);
    if (c) { c.status = data.status; c.progress = data.progress; }
  });
  socket.onCompositionComplete((data) => {
    const c = compositionStore.compositions.find(x => x._id === data.compositionId);
    if (c) {
      c.status = 'completed';
      c.outputUrl = data.outputUrl || c.outputUrl;
      if (data.duration) c.totalDuration = data.duration;
    }
    composingIds.delete(data.compositionId);
    clearTimeout(compTimeouts[data.compositionId]);
    delete compTimeouts[data.compositionId];
    ElMessage.success('合成完成！');
  });
});

onUnmounted(() => {
  socket.offAll();
  Object.values(compTimeouts).forEach(t => clearTimeout(t));
});

// 监听顶栏切片场
watch(currentProjectId, (n, o) => { if (n && n !== o) { currentProjectId.value = n; onProjectChange(n); } });

function onProjectChange(val) {
  if (val) {
    storyboardStore.fetchStoryboards({ projectId: val }).then(() => { storyboards.value = storyboardStore.storyboards; });
    compositionStore.fetchCompositions(val);
    socket.joinProject(val);
    // 恢复正在渲染的任务到 composingIds
    compositionStore.compositions.forEach(c => {
      if (c.status === 'pending' || c.status === 'rendering') {
        composingIds.add(c._id);
        startCompTimeout(c._id);
      }
    });
  }
}

async function handleCreateComposition() {
  if (!selectedStoryboardId.value) return;
  try {
    const comp = await compositionStore.createComposition({
      projectId: currentProjectId.value,
      storyboardId: selectedStoryboardId.value,
      options: { ...composeOptions },
    });
    composingIds.add(comp._id);
    startCompTimeout(comp._id);
    ElMessage.info('合成任务已提交');
  } catch (e) { ElMessage.error('创建失败: ' + (e.message || '')); }
}

function startCompTimeout(compId) {
  clearTimeout(compTimeouts[compId]);
  compTimeouts[compId] = setTimeout(() => {
    const c = compositionStore.compositions.find(x => x._id === compId);
    if (c && c.status !== 'completed' && c.status !== 'failed') {
      c.status = 'failed';
      c.errorMessage = '合成超时（超过10分钟未完成），请检查服务器日志';
    }
    composingIds.delete(compId);
    delete compTimeouts[compId];
    ElMessage.error('合成超时，请重试');
  }, COMP_TIMEOUT);
}

function downloadComposition(c) {
  const a = document.createElement('a');
  a.href = c.outputUrl;
  a.download = c.name ? `${c.name}.${c.outputFormat || 'mp4'}` : `composition.${c.outputFormat || 'mp4'}`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
async function copyOutputUrl(url) {
  const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
  try {
    // 优先 clipboard API (HTTPS)，fallback execCommand (HTTP)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(fullUrl);
    } else {
      const ta = document.createElement('textarea');
      ta.value = fullUrl;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    ElMessage.success('已复制链接');
  } catch (e) {
    console.error('[复制失败]', e);
    ElMessage.error('复制失败，请手动复制：' + fullUrl);
  }
}
function compTransitionLabel(t) { return { fade: '淡入淡出', cut: '剪切', slide: '滑动', dissolve: '叠加' }[t] || t; }
async function deleteTask(c) {
  try { await ElMessageBox.confirm('确认删除该合成任务？', '提示', { type: 'warning', confirmButtonText: '删除' }); } catch { return; }
  try {
    await compositionStore.deleteComposition(c._id);
    composingIds.delete(c._id);
    clearTimeout(compTimeouts[c._id]);
    delete compTimeouts[c._id];
    ElMessage.success('已删除');
  } catch { ElMessage.error('删除失败'); }
}

function compStatusTag(s) { return { pending: 'info', rendering: 'warning', completed: 'success', failed: 'danger' }[s] || 'info'; }
function compStatusLabel(s) { return { pending: '等待中', rendering: '渲染中', completed: '已完成', failed: '失败' }[s] || s; }
function formatDate(d) { return d ? new Date(d).toLocaleString('zh-CN') : ''; }
</script>

<style scoped>
.comp-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.comp-top { display: flex; justify-content: flex-start; align-items: center; margin-bottom: 12px; flex-shrink: 0; }

/* 片场胶囊 */
.comp-body { flex: 1; overflow-y: auto; min-height: 0; }

.panel { background: var(--bg-200); border-radius: 8px; border: 1px solid var(--bg-300); padding: 20px; }
.panel-list { display: flex; flex-direction: column; }
.panel-title { font-size: 15px; font-weight: bold; color: var(--text-100); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--bg-300); }

.empty-list { color: var(--text-200); text-align: center; padding: 60px 0; font-size: 14px; }

.task-item { padding: 12px; border-radius: 6px; margin-bottom: 8px; background: var(--bg-200); border: 1px solid var(--bg-300); }
.task-header { display: flex; justify-content: space-between; align-items: center; }
.task-name { font-weight: bold; color: var(--text-100); font-size: 14px; }
.task-episode { font-size: 11px; color: var(--gold-dark); margin-top: 2px; }
.task-meta { display: flex; justify-content: space-between; color: var(--text-200); font-size: 12px; margin-top: 4px; }
.task-actions { margin-top: 8px; }
.task-error { color: var(--accent-100); font-size: 12px; margin-top: 4px; }
@media (max-width: 768px) {
  .task-header { flex-direction: column; align-items: flex-start; gap: 4px; }
  .task-meta { flex-direction: column; gap: 2px; }
}
</style>
