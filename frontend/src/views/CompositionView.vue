<template>
  <div class="comp-root">
    <div class="breadcrumb" v-if="$route.name !== 'WorkspaceView'">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">成片合成</span>
    </div>
    <div class="comp-top">
      <el-select v-model="currentProjectId" placeholder="选择片场" @change="onProjectChange" style="width:200px">
        <el-option v-for="p in projectStore.projects" :key="p._id" :label="p.name" :value="p._id" />
      </el-select>
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
                  :label="`分镜表 - ${s.totalShots}镜头 (${new Date(s.createdAt).toLocaleDateString()})`" :value="s._id" />
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
            <el-progress v-if="c.status === 'rendering'" :percentage="c.progress" :stroke-width="6" style="margin:6px 0" />
            <div class="task-meta">
              <span>{{ c.resolution }} | {{ c.outputFormat }} | {{ c.frameRate }}fps</span>
              <span>{{ formatDate(c.createdAt) }}</span>
            </div>
            <div v-if="c.status === 'completed' && c.outputUrl" class="task-actions">
              <el-button size="small" type="success" @click="downloadComposition(c)">下载成片</el-button>
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
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '../stores/project';
import { useStoryboardStore } from '../stores/storyboard';
import { useCompositionStore } from '../stores/composition';
import { useSocket } from '../components/useSocket';

const projectStore = useProjectStore();
const storyboardStore = useStoryboardStore();
const compositionStore = useCompositionStore();
const socket = useSocket();

const currentProjectId = ref('');
const selectedStoryboardId = ref('');
const composing = ref(false);
const storyboards = ref([]);
const composeOptions = reactive({ outputFormat: 'mp4', resolution: '1080x1920', frameRate: 24, transitions: 'fade', backgroundMusic: '', subtitlesEnabled: true });

onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  if (restored) { currentProjectId.value = restored._id; onProjectChange(restored._id); }
  socket.connect();
});

function onProjectChange(val) {
  if (val) {
    storyboardStore.fetchStoryboards({ projectId: val }).then(() => { storyboards.value = storyboardStore.storyboards; });
    compositionStore.fetchCompositions(val);
    socket.joinProject(val);
  }
}

async function handleCreateComposition() {
  composing.value = true;
  socket.onCompositionProgress((data) => {
    const c = compositionStore.compositions.find(x => x._id === data.compositionId);
    if (c) { c.status = data.status; c.progress = data.progress; }
  });
  socket.onCompositionComplete((data) => {
    const c = compositionStore.compositions.find(x => x._id === data.compositionId);
    if (c) { c.status = 'completed'; c.outputUrl = data.outputUrl; }
    composing.value = false;
    ElMessage.success('合成完成！');
  });
  try {
    await compositionStore.createComposition({
      projectId: currentProjectId.value,
      storyboardId: selectedStoryboardId.value,
      options: { ...composeOptions },
    });
    ElMessage.info('合成任务已提交');
  } catch (e) { ElMessage.error('创建失败'); composing.value = false; }
}

function downloadComposition(c) { window.open(c.outputUrl, '_blank'); }

function compStatusTag(s) { return { pending: 'info', rendering: 'warning', completed: 'success', failed: 'danger' }[s] || 'info'; }
function compStatusLabel(s) { return { pending: '等待中', rendering: '渲染中', completed: '已完成', failed: '失败' }[s] || s; }
function formatDate(d) { return d ? new Date(d).toLocaleString('zh-CN') : ''; }
</script>

<style scoped>
.comp-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.comp-top { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
.comp-body { flex: 1; overflow-y: auto; min-height: 0; }

.panel { background: var(--bg-200); border-radius: 8px; border: 1px solid var(--bg-300); padding: 20px; }
.panel-list { display: flex; flex-direction: column; }
.panel-title { font-size: 15px; font-weight: bold; color: var(--text-100); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--bg-300); }

.empty-list { color: var(--text-200); text-align: center; padding: 60px 0; font-size: 14px; }

.task-item { padding: 12px; border-radius: 6px; margin-bottom: 8px; background: var(--bg-200); border: 1px solid var(--bg-300); }
.task-header { display: flex; justify-content: space-between; align-items: center; }
.task-name { font-weight: bold; color: var(--text-100); font-size: 14px; }
.task-meta { display: flex; justify-content: space-between; color: var(--text-200); font-size: 12px; margin-top: 4px; }
.task-actions { margin-top: 8px; }
.task-error { color: var(--accent-100); font-size: 12px; margin-top: 4px; }
@media (max-width: 768px) {
  .task-header { flex-direction: column; align-items: flex-start; gap: 4px; }
  .task-meta { flex-direction: column; gap: 2px; }
}
</style>
