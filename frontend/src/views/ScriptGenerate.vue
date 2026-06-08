<template>
  <div class="sg-root">
    <div class="breadcrumb" v-if="$route.name !== 'WorkspaceView'">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">剧本工坊</span>
    </div>
    <div class="sg-topbar">
      <div class="topbar-right">
        <div class="sg-project-pills">
          <span v-if="projectStore.projects.length === 0" style="color:var(--text-200);font-size:14px">还没有片场哦~</span>
          <span v-for="p in projectStore.projects" :key="p._id"
            :class="['sg-pill', { active: currentProjectId === p._id }]"
            @click="currentProjectId = p._id; onProjectChange(p._id)">
            {{ p.name }}
          </span>
        </div>
        <el-button type="primary" link size="large" @click="showImportDialog = true" class="import-link">已有剧本？直接导入</el-button>
      </div>
    </div>

    <!-- 上下布局主体 -->
    <div class="sg-main" v-if="currentProjectId">
      <!-- 第一行：标签表单（横向） -->
      <el-card shadow="never" class="tag-card">
        <!-- 快速模板 -->
        <div class="quick-templates">
          <span class="qt-label">快速模板：</span>
          <span v-for="t in quickTemplates" :key="t.name" class="qt-chip" @click="applyQuickTemplate(t)">{{ t.icon }} {{ t.name }}</span>
        </div>
        <el-alert v-if="scripts.length > 0" type="info" :closable="false" show-icon style="margin-bottom:8px"><template #title>续写模式：以下标签仅作记录，不会影响续写内容。续写基于已有剧本自动延续。</template></el-alert>
        <el-form size="default" inline class="tag-form">
          <el-form-item label="题材 🎭">
            <el-select v-model="tags.genre" placeholder="搜索或输入" style="width:160px" filterable allow-create clearable :disabled="scripts.length > 0" @create="(v) => addCustomOption('genre', v)">
              <el-option v-for="g in genreOptions" :key="g" :label="g" :value="g" />
            </el-select>
          </el-form-item>
          <el-form-item label="热门梗 📌">
            <el-select v-model="tags.plots" multiple placeholder="搜索或输入" :disabled="scripts.length > 0" style="width:260px" filterable allow-create clearable @create="(v) => addCustomOption('plots', v)">
              <el-option v-for="p in plotOptions" :key="p" :label="p" :value="p" />
            </el-select>
          </el-form-item>
          <el-form-item label="类型 🏷️">
            <el-select v-model="tags.type" placeholder="搜索或输入" :disabled="scripts.length > 0" style="width:140px" filterable allow-create clearable @create="(v) => addCustomOption('types', v)">
              <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="风格 🎨">
            <el-select v-model="tags.style" placeholder="搜索或输入" :disabled="scripts.length > 0" style="width:140px" filterable allow-create clearable @create="(v) => addCustomOption('styles', v)">
              <el-option v-for="s in styleOptions" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <el-button type="primary" size="large" @click="scripts.length > 0 ? handleContinue() : handleGenerate()" :loading="scriptStore.generating" :disabled="!tags.genre">
                {{ scriptStore.generating ? 'AI 创作中...' : scripts.length > 0 ? '续写下一集 📖' : 'AI 开写！✍️' }}
              </el-button>
              <el-tooltip content="开启后生成内心独白字段，可加深角色层次；关闭可加快生成速度" placement="top">
                <el-checkbox v-model="showInnerThought" border size="large" :disabled="scriptStore.generating">💭 内心独白</el-checkbox>
              </el-tooltip>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 第二行：进度(生成时) -->
      <el-card v-if="scriptStore.generating" shadow="never" style="margin-top:12px">
        <template #header><span class="card-title">{{ flowType === 'continue' ? 'AI 续写进行中 📖' : 'AI 正在为你写剧本 ✍️' }}</span></template>
        <div class="custom-steps">
          <div
            v-for="s in currentStepLabels" :key="s.step"
            :class="['cstep', {
              'cstep-done': s.step < currentStep,
              'cstep-active': s.step === currentStep,
              'cstep-wait': s.step > currentStep
            }]"
          >
            <div class="cstep-dot">
              <span v-if="s.step < currentStep" class="cstep-check">✓</span>
              <span v-else-if="s.step === currentStep" class="cstep-spinner"></span>
              <span v-else class="cstep-num">{{ s.step }}</span>
            </div>
            <div class="cstep-content">
              <div class="cstep-title">{{ s.title }}</div>
              <div class="cstep-desc">{{ progressMessages[s.step] || '等待中...' }}</div>
            </div>
          </div>
        </div>
        <el-progress :percentage="stepPercentage" :stroke-width="14" style="margin-top:12px" />
      </el-card>

      <!-- 第三行：创作记录（响应式卡片列表） -->
      <el-card v-if="scripts.length > 0" shadow="never" class="history-fill">
        <template #header>
          <div class="card-header-row">
            <span class="card-title">创作记录 ({{ scripts.length }} 集)</span>
            <div class="card-header-btns">
              <el-button type="warning" @click="showStoryline">📖 故事线总览</el-button>
              <el-button type="success" @click="handleContinue" :loading="scriptStore.generating">续写下一集 📖</el-button>
            </div>
          </div>
        </template>
        <!-- PC 端表格 -->
        <div v-if="screenWidth >= 768" class="history-scroll">
          <el-table ref="scriptTableRef" :data="scripts" stripe style="width:100%;min-width:820px" max-height="360" @row-click="openScript" @selection-change="onScriptSelectionChange">
            <el-table-column type="selection" width="40" />
            <el-table-column prop="episodeNumber" label="集数" width="70">
              <template #default="{ row }">第{{ row.episodeNumber }}集</template>
            </el-table-column>
            <el-table-column prop="episodeTitle" label="标题" min-width="160">
              <template #default="{ row }">{{ row.episodeTitle || '未命名' }}</template>
            </el-table-column>
            <el-table-column label="来源" width="90">
              <template #default="{ row }">
                <el-tag :type="row.source === 'ai_generated' ? 'success' : 'info'" size="small">{{ row.source === 'ai_generated' ? 'AI生成' : row.source === 'ai_continue' ? '续写' : '导入' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="wordCount" label="字数" width="70" />
            <el-table-column label="场次" width="60">
              <template #default="{ row }">{{ row.scenes?.length || 0 }}</template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" width="150">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click.stop="openScript(row)">进片场</el-button>
                <el-button size="small" type="success" link @click.stop="exportScriptText(row)">导出</el-button>
                <el-button size="small" type="danger" link @click.stop="handleDeleteScript(row)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <!-- 移动端卡片列表 -->
        <div v-else class="script-card-list">
          <div v-for="row in scripts" :key="row._id" class="sc-card" @click="mobileDetailScript = row; mobileDetailVisible = true">
            <div class="sc-card-top">
              <span class="sc-ep-num">第{{ row.episodeNumber }}集</span>
              <el-tag :type="row.source === 'ai_generated' ? 'success' : 'info'" size="small">{{ row.source === 'ai_generated' ? 'AI生成' : row.source === 'ai_continue' ? '续写' : '导入' }}</el-tag>
            </div>
            <div class="sc-title">{{ row.episodeTitle || '未命名' }}</div>
            <div class="sc-meta">
              <span>{{ row.wordCount || 0 }} 字</span>
              <span>{{ row.scenes?.length || 0 }} 场次</span>
              <span>{{ formatDate(row.createdAt) }}</span>
            </div>
            <div class="sc-actions">
              <el-button size="small" type="primary" @click.stop="openScript(row)">进片场</el-button>
              <el-button size="small" type="success" @click.stop="exportScriptText(row)">导出</el-button>
              <el-button size="small" type="danger" @click.stop="handleDeleteScript(row)">移除</el-button>
            </div>
          </div>
        </div>
        <div v-if="selectedScripts.length > 0" class="batch-bar">
          <span>已选 {{ selectedScripts.length }} 集</span>
          <el-button size="small" type="danger" @click="batchDeleteScripts">批量移除</el-button>
          <el-button size="small" link @click="toggleScriptSelectAll">{{ selectedScripts.length === scripts.length ? '取消全选' : '全选' }}</el-button>
        </div>
      </el-card>

      <!-- 生成结果（仅首次生成展示，有创作记录后隐藏） -->
      <el-card v-if="generationResult && scripts.length === 0 && !scriptStore.generating" shadow="never" style="margin-top:12px">
        <template #header><span class="card-title">刚刚出炉的剧本 🔥</span></template>
        <el-tabs>
          <el-tab-pane label="大纲">
            <pre class="json-preview">{{ JSON.stringify(generationResult.outline, null, 2) }}</pre>
          </el-tab-pane>
          <el-tab-pane label="角色">
            <div v-for="c in generationResult.characters" :key="c.name" class="char-card">
              <strong>{{ c.name }}</strong> ({{ c.role_type }})
              <p>{{ c.appearance }}</p>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- 没历史也没进度 -->
      <div v-if="scripts.length === 0 && !scriptStore.generating && !generationResult" class="welcome-placeholder">
        <div class="welcome-icon">🎬</div>
        <h3>开始创作你的第一部短剧</h3>
        <p>选好题材标签，点击「AI 开写！」</p>
        <p>或点击顶部「已有剧本？直接导入」粘贴已有剧本</p>
      </div>

      <!-- 悬浮日志 -->
      <div
        class="log-float-toggle" v-if="currentProjectId"
        :style="{ left: logPos.x + 'px', top: logPos.y + 'px' }"
        @mousedown="startDrag"
        @click.stop="toggleLog"
        :title="logCollapsed ? '展开日志' : '收起日志'"
      >
        📋<span v-if="logLines.length > 0" class="log-float-badge">{{ logLines.length }}</span>
      </div>
      <div class="log-float-panel" :class="{ 'log-hidden': logCollapsed }" v-if="currentProjectId"
        :style="logPanelStyle">
        <div class="log-header" @click="logCollapsed = !logCollapsed">
          运行日志
          <span v-if="logLines.length > 0" class="log-badge">{{ logLines.length }}</span>
          <span style="margin-left:auto;cursor:pointer;font-size:14px">×</span>
        </div>
        <div class="log-body" ref="logBody">
          <div v-if="logLines.length === 0" class="log-empty">等待创作任务...</div>
          <div v-for="(line, i) in logLines" :key="i" :class="['log-line', 'log-' + line.level]">
            <span class="log-time">{{ line.time }}</span>
            <span class="log-msg">{{ line.msg }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!currentProjectId" class="welcome-placeholder full">
      <div class="welcome-icon">📽️</div>
      <h3>欢迎来到剧本创作间 🎬</h3>
      <p>选个片场，我们开写吧！</p>
    </div>

    <!-- 故事线弹窗 -->
    <el-dialog v-model="showStorylineDialog" title="故事线总览 📖" :width="screenWidth < 768 ? '94%' : '750px'" destroy-on-close :close-on-click-modal="false">
      <div class="storyline-wrap" v-if="scripts.length > 0">
        <div class="storyline-summary-box">
          <div class="sl-label">创作进度</div>
          <div class="sl-text">{{ scripts.length }} 集已杀青，最新：{{ latestScriptTitle }}</div>
        </div>
        <div class="storyline-scroll">
          <div class="storyline-timeline">
            <div
              v-for="(ep, idx) in storylineList" :key="ep._id"
              :class="['sl-episode', { 'sl-current': idx === storylineList.length - 1 }]"
            >
              <div class="sl-dot-line">
                <div class="sl-dot"></div>
                <div v-if="idx < storylineList.length - 1" class="sl-line"></div>
              </div>
              <div class="sl-card">
                <div class="sl-ep-header">
                  <span class="sl-ep-num">第{{ ep.episodeNumber }}集</span>
                  <el-tag size="small" :type="ep.source === 'ai_generated' ? 'success' : ep.source === 'ai_continue' ? 'warning' : 'info'">
                    {{ ep.source === 'ai_generated' ? 'AI生成' : ep.source === 'ai_continue' ? 'AI续写' : '导入' }}
                  </el-tag>
                  <span class="sl-word-count">{{ ep.wordCount || 0 }} 字 · {{ ep.scenes?.length || 0 }} 场次</span>
                </div>
                <div class="sl-ep-title">{{ ep.episodeTitle || '未命名' }}</div>
                <div class="sl-ep-summary">{{ ep.summary || '剧情待揭晓...' }}</div>
                <div v-if="ep.scenes && ep.scenes.length > 0" class="sl-scene-pills">
                  <span v-for="s in ep.scenes" :key="s.sceneNumber" class="sl-pill">{{ s.location || '场' + s.sceneNumber }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="还没有剧集哦 ~" />
      <template #footer>
        <el-button @click="showStorylineDialog = false">知道啦</el-button>
      </template>
    </el-dialog>

    <!-- 移动端剧本详情弹窗 -->
    <el-dialog v-model="mobileDetailVisible" :title="'第' + (mobileDetailScript?.episodeNumber || '') + '集 ' + (mobileDetailScript?.episodeTitle || '详情')" :width="screenWidth < 768 ? '94%' : '600px'" destroy-on-close>
      <div v-if="mobileDetailScript" class="ms-detail">
        <div class="ms-detail-row"><span class="ms-dl">来源</span><el-tag :type="mobileDetailScript.source === 'ai_generated' ? 'success' : 'info'" size="small">{{ mobileDetailScript.source === 'ai_generated' ? 'AI生成' : mobileDetailScript.source === 'ai_continue' ? 'AI续写' : '导入' }}</el-tag></div>
        <div class="ms-detail-row"><span class="ms-dl">字数</span><strong>{{ mobileDetailScript.wordCount || 0 }} 字</strong></div>
        <div class="ms-detail-row"><span class="ms-dl">场次</span><strong>{{ mobileDetailScript.scenes?.length || 0 }} 场</strong></div>
        <div class="ms-detail-row"><span class="ms-dl">创建时间</span><strong>{{ formatDate(mobileDetailScript.createdAt) }}</strong></div>
        <div v-if="mobileDetailScript.summary" class="ms-detail-summary">
          <div class="ms-dl">剧情摘要</div>
          <p>{{ mobileDetailScript.summary }}</p>
        </div>
        <div v-if="mobileDetailScript.scenes && mobileDetailScript.scenes.length > 0" class="ms-detail-scenes">
          <div class="ms-dl">场次列表</div>
          <div v-for="s in mobileDetailScript.scenes" :key="s.sceneNumber" class="ms-scene-item">
            <span class="ms-scene-num">{{ s.sceneNumber }}</span>
            <span>{{ s.location || '未命名场地' }}</span>
            <span class="ms-scene-time">{{ s.time || '' }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="mobileDetailVisible = false">关闭</el-button>
        <el-button type="primary" @click="mobileDetailVisible = false; openScript(mobileDetailScript)">进入片场编辑</el-button>
      </template>
    </el-dialog>

    <!-- 导入剧本弹窗 -->
    <el-dialog v-model="showImportDialog" :title="importMode === 'format' ? '导入外部剧本 📥' : '导入故事，AI转剧本 ✨'" :width="screenWidth < 768 ? '94%' : '700px'" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        <template #title v-if="importMode === 'format'">把剧本粘贴进来，AI 会自动帮你识别场次、时间、地点、人物和台词，一键结构化！</template>
        <template #title v-else>把你的故事/小说片段粘贴进来，AI 会把它改编成标准剧本格式，保持原故事的方向和味道。</template>
      </el-alert>

      <!-- 模式切换 -->
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;border:1px solid var(--bg-300);border-radius:6px;overflow:hidden">
          <span :class="['tab-switch', { active: importMode === 'format' }]" @click="importMode = 'format'">📋 格式导入</span>
          <span :class="['tab-switch', { active: importMode === 'story' }]" @click="importMode = 'story'">📖 故事转剧本</span>
        </div>
        <el-input v-model="importTitle" placeholder="剧集标题（选填）" size="small" style="width:200px" clearable />
      </div>

      <template v-if="importMode === 'format'">
        <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:var(--text-200)">格式参考：</span>
          <el-button size="small" plain @click="fillExample" :disabled="!!importContent">📋 填入示例</el-button>
        </div>
        <el-input v-model="importContent" type="textarea" :rows="14" placeholder="场次：1&#10;时间：白天&#10;地点：咖啡厅&#10;人物：张三, 李四&#10;氛围：温馨&#10;&#10;张三：你好，好久不见。&#10;（张三微笑）&#10;&#10;李四：是你..." />
      </template>
      <template v-else>
        <el-input v-model="importContent" type="textarea" :rows="16" placeholder="把故事粘贴在这里...&#10;&#10;比如：&#10;&#10;林悦是个普通的上班族，每天挤地铁、加班、吃外卖。直到那天，她在公司楼下遇到了一个西装革履的男人。他递过来一张名片——「星辰集团 CEO · 顾言深」。她以为这是一场美丽的邂逅，没想到这只是他精心策划的复仇开端..." />
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:var(--text-200)">AI 会根据故事方向生成对应剧本</span>
        </div>
      </template>
      <template #footer>
        <el-button @click="showImportDialog = false">下次再说叭</el-button>
        <el-button v-if="importMode === 'format'" type="primary" @click="handleImport" :loading="importing" :disabled="!importContent">
          {{ importing ? '解析中...' : '一键导入结构化' }}
        </el-button>
        <el-button v-else type="primary" @click="handleStoryToScript" :loading="importing" :disabled="!importContent">
          {{ importing ? 'AI正在改编剧本...' : '✨ AI 转写剧本' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onActivated, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { useSocket } from '../components/useSocket';
import api, { scriptAPI } from '../api';

const router = useRouter();
const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const socket = useSocket();

const currentProjectId = ref('');
const importContent = ref('');
const importTitle = ref('');
const importMode = ref('format'); // 'format' | 'story'
const showImportDialog = ref(false);
const showStorylineDialog = ref(false);
const logCollapsed = ref(true);
const showInnerThought = ref(true);
const logPos = reactive({ x: 0, y: 0 });
const selectedScripts = ref([]);

const scriptTableRef = ref(null);

function onScriptSelectionChange(rows) { selectedScripts.value = rows; }
function clearScriptSelection() { selectedScripts.value = []; }
function toggleScriptSelectAll() {
  if (!scriptTableRef.value) return;
  if (selectedScripts.value.length === scripts.value.length) {
    scriptTableRef.value.clearSelection();
  } else {
    scripts.value.forEach(row => scriptTableRef.value.toggleRowSelection(row, true));
  }
}

async function batchDeleteScripts() {
  if (selectedScripts.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认移除选中的 ${selectedScripts.value.length} 集？`, '批量移除', { type: 'warning' });
  } catch { return; }
  try {
    const ids = selectedScripts.value.map(s => s._id);
    await scriptAPI.batchDelete(ids);
    addLog(`批量移除 ${ids.length} 集`, 'warning');
    selectedScripts.value = [];
    await loadScripts(currentProjectId.value);
    ElMessage.success(`已移除 ${ids.length} 集`);
  } catch (e) {
    ElMessage.error('批量哎呀，移除出错啦，再试一次哦');
  }
}
const importing = ref(false);
const mobileDetailVisible = ref(false);
const mobileDetailScript = ref(null);
const screenWidth = ref(window.innerWidth);
window.addEventListener('resize', () => { screenWidth.value = window.innerWidth; });

const logPanelStyle = computed(() => ({
  left: Math.min(logPos.x, window.innerWidth - 500) + 'px',
  bottom: (window.innerHeight - logPos.y + 12) + 'px',
}));

function initLogPos() {
  logPos.x = window.innerWidth - 80;
  logPos.y = window.innerHeight - 120;
}
let dragging = false, dragStartX = 0, dragStartY = 0, origX = 0, origY = 0;
function startDrag(e) {
  dragging = true; dragStartX = e.clientX; dragStartY = e.clientY; origX = logPos.x; origY = logPos.y;
  document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', stopDrag);
}
function onDrag(e) {
  if (!dragging) return;
  logPos.x = Math.max(0, Math.min(window.innerWidth - 48, origX + e.clientX - dragStartX));
  logPos.y = Math.max(0, Math.min(window.innerHeight - 48, origY + e.clientY - dragStartY));
}
function stopDrag() {
  dragging = false;
  document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag);
}
function toggleLog() {
  if (!dragging) logCollapsed.value = !logCollapsed.value;
}
const generationResult = ref(null);
const scripts = ref([]);
const logBody = ref(null);

const currentStep = ref(scriptStore.progressStep || 0);
const flowType = ref(scriptStore.flowType || 'generate');
const progressMessages = reactive({ ...(scriptStore.progressMessages || {}) });
const logLines = reactive([...(scriptStore.genLogLines || [])]);

// 同步到 store，跨路由持久化
watch(currentStep, (v) => { scriptStore.progressStep = v; });
watch(flowType, (v) => { scriptStore.flowType = v; });
watch(progressMessages, (v) => { scriptStore.progressMessages = { ...v }; }, { deep: true });
watch(logLines, (v) => { scriptStore.genLogLines = [...v]; }, { deep: true });

const generateSteps = [
  { step: 1, title: '解析创作标签' },
  { step: 2, title: '生成故事大纲' },
  { step: 3, title: '塑造角色人设' },
  { step: 4, title: '规划剧情架构' },
  { step: 5, title: '撰写剧本内容' },
  { step: 6, title: '校验剧本质量' },
  { step: 7, title: '保存生成结果' },
];

const continueSteps = [
  { step: 5, title: '续写剧本内容' },
  { step: 6, title: '校验剧本质量' },
  { step: 7, title: '保存续写结果' },
];

const currentStepLabels = computed(() => flowType.value === 'continue' ? continueSteps : generateSteps);

const storylineList = computed(() =>
  [...scripts.value].sort((a, b) => a.episodeNumber - b.episodeNumber)
);

const latestScriptTitle = computed(() => {
  const sorted = storylineList.value;
  if (sorted.length === 0) return '';
  const last = sorted[sorted.length - 1];
  return `第${last.episodeNumber}集 ${last.episodeTitle || '未命名'}`;
});

function showStoryline() { showStorylineDialog.value = true; }

const stepPercentage = computed(() => {
  const labels = currentStepLabels.value;
  const idx = labels.findIndex(s => s.step === currentStep.value);
  if (idx < 0) return 0;
  return Math.round((idx + 1) / labels.length * 100);
});

function addLog(msg, level = 'info') {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour12: false });
  logLines.push({ time, msg, level });
  nextTick(() => {
    if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight;
  });
}

// 预设 + 用户自定义选项（localStorage 持久化）
const DEFAULT_GENRES = ['都市爱情', '古代言情', '悬疑推理', '科幻未来', '奇幻仙侠', '校园青春', '家庭伦理', '职场商战', '武侠江湖', '恐怖惊悚', '民国风云', '宫斗宅斗', '重生复仇', '末日生存', '黑道风云', '娱乐圈', '电竞网游', '军旅热血', '乡村致富', '医疗救援', '律政法庭', '盗墓冒险', '神话传说', '西方奇幻', 'ABO设定', '无限流'];
const DEFAULT_PLOTS = ['霸道总裁', '失忆', '重生', '穿越', '替身', '闪婚', '复仇', '逆袭', '误会', '渣男', '绿茶', '追妻火葬场', '先婚后爱', '豪门', '契约婚姻', '天才宝宝', '系统', '末世', '天降', '竹马', '白月光', '双重生', '掉马甲', '读心术', '预言梦', '时间循环', '扮猪吃虎', '病娇', '疯批', '白切黑', '扮丑逆袭', '真假千金', '替身文学', '带球跑', '叔嫂', '姐弟恋', '年下', '破镜重圆', '暗恋成真', '双向奔赴', '追星成功', '穿书', '穿游戏', '穿成反派', '打脸', '虐渣', '团宠', '万人嫌逆袭', '开局签到', '金手指', '异能觉醒', '灵气复苏'];
const DEFAULT_TYPES = ['爱情', '悬疑', '喜剧', '虐心', '爽文', '甜宠', '惊悚', '热血', '治愈', '复仇爽文', '虐恋情深', '轻松搞笑', '烧脑悬疑', '逆袭打脸', '双向暗恋', '大女主', '双强', '病娇偏执', '救赎治愈', '快节奏', '慢热细腻'];
const DEFAULT_STYLES = ['写实', '古风', '现代', '轻喜', '虐心', '甜宠', '高燃', '暗黑', '温馨', '文艺', '日系', '韩系', '港风', '民国', '赛博朋克', '废土', '玄幻', '仙气', '胶片感', '极简'];

function loadCustom(key, defaults) {
  try { const v = localStorage.getItem('ad_tags_' + key); if (v) return [...new Set([...JSON.parse(v), ...defaults])]; } catch {}
  return defaults;
}
function saveCustom(key, arr, defaults) {
  const custom = arr.filter(x => !defaults.includes(x));
  try { localStorage.setItem('ad_tags_' + key, JSON.stringify(custom)); } catch {}
}

const genreOptions = ref(loadCustom('genre', DEFAULT_GENRES));
const plotOptions = ref(loadCustom('plots', DEFAULT_PLOTS));
const typeOptions = ref(loadCustom('types', DEFAULT_TYPES));
const styleOptions = ref(loadCustom('styles', DEFAULT_STYLES));

function addCustomOption(key, value) {
  const map = { genre: genreOptions, plots: plotOptions, types: typeOptions, styles: styleOptions };
  const defaults = { genre: DEFAULT_GENRES, plots: DEFAULT_PLOTS, types: DEFAULT_TYPES, styles: DEFAULT_STYLES };
  if (!map[key].value.includes(value)) {
    map[key].value.push(value);
    saveCustom(key, map[key].value, defaults[key]);
  }
}

onMounted(async () => {
  initLogPos();
  window.addEventListener('resize', initLogPos);
  window.__triggerGenerate = handleGenerate;
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  if (restored) { currentProjectId.value = restored._id; loadScripts(restored._id); socket.joinProject(restored._id); }
  socket.connect();

  // 刷新后恢复：检查后端是否有未完成的生成任务
  const pid = currentProjectId.value || restored?._id;
  if (pid) {
    try {
      const res = await fetch(`/api/v1/scripts/generation-status?projectId=${pid}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();
      if (json.data?.active) {
        // 后端有正在运行的生成任务，恢复前端状态
        scriptStore.generating = true;
        scriptStore.genProjectId = pid;
        logCollapsed.value = false;
        addLog('检测到后台有正在进行的创作任务，已恢复监听...', 'info');
        reconnectGenListeners(pid, true);
      }
    } catch { /* ignore */ }
  }

  // 如果切回页面时有 scriptStore 中记录的进行中任务，也恢复监听
  if (scriptStore.generating && !pid) {
    reconnectGenListeners(scriptStore.genProjectId, false);
  }
});

function reconnectGenListeners(pid, fromRefresh) {
  const shown = fromRefresh === true;
  socket.joinProject(pid);
  socket.onScriptGenerationProgress((data) => {
    currentStep.value = data.step; nextTick(() => { currentStep.value = data.step; });
    progressMessages[data.step] = data.message;
    addLog(data.message, data.level || 'info');
    if (shown) logCollapsed.value = false;
  });
  socket.onScriptGenerationComplete((data) => {
    scriptStore.progressStep = 7;
    progressMessages[7] = '剧本已保存';
    addLog('创作完成', 'success');
    generationResult.value = data.data;
    scriptStore.setGenerationComplete();
    loadScripts(currentProjectId.value);
    setTimeout(() => { logCollapsed.value = true; }, 1500);
    ElMessage.success('创作完成！剧本已保存 🎉');
    window.__addNotification?.('创作完成', 'success', '✅');
  });
  socket.onScriptGenerationError((data) => {
    scriptStore.setGenerationError();
    addLog('创作失败: ' + data.error, 'error');
    showFriendlyError(data.error);
  });
}

function showFriendlyError(msg) {
  const isKeyError = /API\s*Key|api.?key|密钥|未配置|无效|invalid.*key|unauthorized|authentication/i.test(msg);
  const isBalanceError = /balance|余额|额度|quota|欠费|billing|not enough|limit exceeded|overdue/i.test(msg);
  if (isKeyError || isBalanceError) {
    ElMessageBox.alert(
      (isBalanceError ? '💳 余额不足或配额已用完\n\n' : '🔑 API Key 无效或未配置\n\n') +
      msg.replace(/\n+原始错误.*/s, ''),
      isBalanceError ? 'API 账户异常' : 'API 配置异常',
      { confirmButtonText: '前往系统设置', type: 'warning', dangerouslyUseHTMLString: false }
    ).then(() => { router.push('/settings'); }).catch(() => {});
  } else {
    ElMessage.error(msg || '生成失败，请稍后重试');
  }
}

// keep-alive 缓存激活时：同步从片场列表点击进入的项目
onActivated(() => {
  const storeProject = projectStore.currentProject;
  if (storeProject && storeProject._id !== currentProjectId.value) {
    currentProjectId.value = storeProject._id;
    loadScripts(storeProject._id);
    socket.joinProject(storeProject._id);
  }
});

// 监听项目列表变化：如果当前选中的项目被删除了，清空状态
watch(() => projectStore.projects, (newList) => {
  if (currentProjectId.value && !newList.find(p => p._id === currentProjectId.value)) {
    currentProjectId.value = '';
    scripts.value = [];
    generationResult.value = null;
    logLines.length = 0;
    addLog('当前片场已被移除，请选择其他项目', 'warning');
  }
}, { deep: false });

function onProjectChange(val) {
  if (val) { projectStore.rememberProject(val); loadScripts(val); socket.joinProject(val); }
}

async function loadScripts(projectId) {
  await scriptStore.fetchScripts(projectId);
  scripts.value = [...scriptStore.scripts];
}

function openScript(row) {
  router.push({ path: '/script-edit', query: { projectId: currentProjectId.value } });
}

async function handleDeleteScript(row) {
  try {
    await ElMessageBox.confirm(
      `狠心移除「第${row.episodeNumber}集 ${row.episodeTitle || '未命名'}」？删掉就找不回来咯~。`,
      '确认移除', { type: 'warning', confirmButtonText: '狠心移除', cancelButtonText: '再想想' }
    );
  } catch { return; }

  try {
    // 检查移除后是否会产生剧情断层
    const episodes = scripts.value.map(s => s.episodeNumber).sort((a, b) => a - b);
    const delIdx = episodes.indexOf(row.episodeNumber);
    let gapWarning = '';
    if (delIdx > 0 && delIdx < episodes.length - 1) {
      // 移除中间集，前后都有
      gapWarning = `\n⚠️ 删除后第${episodes[delIdx - 1]}集和第${episodes[delIdx + 1]}集之间会有断层。续写时 AI 会在新剧集中自动衔接过渡。`;
    }

    await scriptAPI.delete(row._id);
    addLog(`已移除第${row.episodeNumber}集`, 'warning');
    await loadScripts(currentProjectId.value);
    const maxEp = scripts.value.reduce((m, s) => Math.max(m, s.episodeNumber), 0);
    ElMessage.success(`已移除。续写将基于第 ${maxEp} 集继续。${gapWarning}`);
  } catch (e) {
    addLog('哎呀，移除出错啦，再试一次哦: ' + (e.response?.data?.message || e.message), 'error');
    ElMessage.error('哎呀，移除出错啦，再试一次哦');
  }
}

async function handleGenerate() {
  scriptStore.clearGenState();
  flowType.value = 'generate';
  scriptStore.flowType = 'generate';
  logCollapsed.value = false;
  generationResult.value = null;
  currentStep.value = 0;
  Object.keys(progressMessages).forEach(k => delete progressMessages[k]);
  logLines.length = 0;
  addLog('提交创作任务，AI 开始写剧本...', 'info');
  socket.offAll();

  socket.onScriptGenerationProgress((data) => {
    console.log('[前端收到进度]', data);
    currentStep.value = data.step; nextTick(() => { currentStep.value = data.step; });
    progressMessages[data.step] = data.message;
    nextTick(() => { currentStep.value = data.step; });
    addLog(data.message, data.level || 'info');
  });

  socket.onScriptGenerationComplete((data) => {
    console.log('[前端收到完成]', data);
    currentStep.value = 7;
    progressMessages[7] = '剧本已保存';
    addLog('创作完成', 'success');
    generationResult.value = data.data;
    scriptStore.setGenerationComplete();
    loadScripts(currentProjectId.value);
    // 自动生成封面海报
    console.log('[封面] 剧本完成，自动生成海报... projectId=' + currentProjectId.value);
    api.post(`/projects/${currentProjectId.value}/generate-cover`)
      .then(d => console.log('[封面] 海报生成结果:', d.data?.coverImage ? '成功 ' + d.data.coverImage.substring(0, 50) + '...' : '失败', d))
      .catch(e => console.error('[封面] 海报生成请求失败:', e));
    setTimeout(() => { logCollapsed.value = true; }, 1500);
    ElMessage.success('创作完成！剧本已保存 🎉');
  });

  socket.onScriptGenerationError((data) => {
    scriptStore.setGenerationError();
    addLog('创作失败: ' + data.error, 'error');
    progressMessages[currentStep.value] = '失败: ' + data.error;
    showFriendlyError(data.error);
  });

  try {
    await scriptStore.aiGenerate(currentProjectId.value, { ...tags, showInnerThought: showInnerThought.value });
    ElMessage.info('已提交！右下角查看创作进度 📋');
  } catch (e) {
    addLog('提交失败，请稍后重试: ' + (e.response?.data?.message || e.message), 'error');
    ElMessage.error('提交失败，请稍后重试');
  }
}

async function handleContinue() {
  flowType.value = 'continue';
  scriptStore.flowType = 'continue';
  logCollapsed.value = false; // 续写时展开
  currentStep.value = 0;
  Object.keys(progressMessages).forEach(k => delete progressMessages[k]);
  socket.offAll();
  addLog('提交续写任务，AI 继续创作...', 'info');
  socket.onScriptContinueComplete((data) => {
    currentStep.value = 7;
    progressMessages[7] = '续写已保存';
    nextTick(() => { currentStep.value = 7; });
    addLog('续写完成', 'success');
    scriptStore.setGenerationComplete();
    loadScripts(currentProjectId.value);
    setTimeout(() => { logCollapsed.value = true; }, 1500);
    ElMessage.success('续写完成！下一集已就绪 📖');
  });
  socket.onScriptGenerationProgress((data) => {
    console.log('[前端收到进度]', data);
    currentStep.value = data.step;
    progressMessages[data.step] = data.message;
    nextTick(() => { currentStep.value = data.step; });
    addLog(data.message, data.level || 'info');
  });
  const lastScript = scripts.value[scripts.value.length - 1];
  await scriptStore.continueScript(currentProjectId.value, lastScript?._id, 1);
  addLog('续写已启动，为你续写新剧情...', 'info');
}

async function handleImport() {
  if (!currentProjectId.value) return ElMessage.warning('请先在上方选择一个片场');
  if (!importContent.value.trim()) return;
  importing.value = true;
  try {
    const res = await scriptStore.importScript(currentProjectId.value, importContent.value, 'txt', importTitle.value);
    addLog('剧本片场导入成功啦！ 📥：' + (res.scenes?.length || 0) + ' 场次', 'success');
    ElMessage.success('片场导入成功啦！');
    importContent.value = '';
    importTitle.value = '';
    showImportDialog.value = false;
    loadScripts(currentProjectId.value);
  } catch (e) {
    addLog('导入失败，请检查格式: ' + (e.response?.data?.message || e.message), 'error');
    ElMessage.error('导入失败，请检查格式');
  } finally { importing.value = false; }
}

async function handleStoryToScript() {
  if (!currentProjectId.value) return ElMessage.warning('请先在上方选择一个片场');
  if (!importContent.value.trim()) return;
  importing.value = true;
  try {
    const res = await scriptStore.storyToScript(currentProjectId.value, importContent.value, importTitle.value);
    addLog('AI改编完成！ 📖：' + (res.scenes?.length || 0) + ' 场次', 'success');
    ElMessage.success('故事已转写为剧本！');
    importContent.value = '';
    importTitle.value = '';
    showImportDialog.value = false;
    loadScripts(currentProjectId.value);
  } catch (e) {
    addLog('AI转写失败: ' + (e.response?.data?.message || e.message), 'error');
    ElMessage.error('AI改编失败，请重试');
  } finally { importing.value = false; }
}

const EXAMPLE_SCRIPT = `场次:1
时间:白天
地点:咖啡厅
人物:张三, 李四
氛围:温馨

张三:你好，好久不见。
(张三微笑)

李四:是你...没想到会在这里遇见你。
(低头搅动咖啡)

张三:这些年，你过得好吗？
(目光注视对方)

李四:还行吧，老样子。你呢？

场次:2
时间:夜晚
地点:江边步道
人物:张三, 李四
氛围:感伤

(江风吹过，两人并肩而行)

张三:还记得以前我们总来这儿吗？
(停下脚步，望向远处灯火)

李四:怎么会忘。那时候真傻。`;

function fillExample() {
  importContent.value = EXAMPLE_SCRIPT;
}

function formatDate(d) { return d ? new Date(d).toLocaleString('zh-CN') : ''; }
function exportScriptText(raw) {
  const row = raw && typeof raw === 'object' ? JSON.parse(JSON.stringify(raw)) : null;
  if (!row || !row.scenes || !row.scenes.length) { ElMessage.warning('该剧集暂无剧本内容，请先生成剧本'); return; }
  const lines = [];
  lines.push(`第${row.episodeNumber || '?'}集：${row.episodeTitle || '未命名'}`);
  lines.push('');
  if (row.summary) { lines.push(`【剧情摘要】${row.summary}`); lines.push(''); }
  const scenes = row.scenes;
  scenes.forEach((s, i) => {
    lines.push(`--- 第${s.sceneNumber || i+1}场 ---`);
    if (s.location) lines.push(`场景：${s.location}`);
    if (s.timeOfDay) lines.push(`时间：${s.timeOfDay}`);
    if (s.atmosphere) lines.push(`氛围：${s.atmosphere}`);
    if (s.sceneDescription) lines.push(`描述：${s.sceneDescription}`);
    if (s.notes) lines.push(`备注：${s.notes}`);
    if (s.dialogues?.length) {
      lines.push('');
      s.dialogues.forEach(d => {
        const action = d.actionHint ? `（${d.actionHint}）` : '';
        const camera = d.cameraHint ? `【${d.cameraHint}】` : '';
        lines.push(`${d.characterName}${action}：${d.text}`);
        if (camera) lines.push(`  ↳ 镜头：${camera}`);
        if (d.innerThought) lines.push(`  ↳ 内心：${d.innerThought}`);
      });
    }
    lines.push('');
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `第${row.episodeNumber}集_${row.episodeTitle||'剧本'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('剧本已导出');
}

const tags = reactive({ genre: '', plots: [], type: '', style: '' });

const quickTemplates = [
  { name: '重生复仇', icon: '🔥', genre: '重生复仇', plots: ['重生', '复仇', '逆袭', '打脸'], type: '复仇爽文', style: '古风' },
  { name: '霸总甜宠', icon: '💕', genre: '都市爱情', plots: ['霸道总裁', '契约婚姻', '先婚后爱'], type: '甜宠', style: '现代' },
  { name: '穿书逆袭', icon: '📖', genre: '古代言情', plots: ['穿书', '穿成反派', '逆袭', '系统'], type: '逆袭打脸', style: '古风' },
  { name: '悬疑烧脑', icon: '🔍', genre: '悬疑推理', plots: ['时间循环', '预言梦'], type: '烧脑悬疑', style: '暗黑' },
  { name: '校园甜宠', icon: '🌸', genre: '校园青春', plots: ['暗恋成真', '双向奔赴', '竹马'], type: '甜宠', style: '日系' },
  { name: '末世生存', icon: '🧟', genre: '末日生存', plots: ['末世', '异能觉醒', '系统'], type: '热血', style: '废土' },
  { name: '宫斗上位', icon: '👑', genre: '宫斗宅斗', plots: ['重生', '复仇', '真假千金'], type: '大女主', style: '古风' },
  { name: '大女主商战', icon: '💼', genre: '职场商战', plots: ['逆袭', '打脸', '金手指'], type: '大女主', style: '现代' },
];
function applyQuickTemplate(t) {
  tags.genre = t.genre;
  tags.plots = [...t.plots];
  tags.type = t.type;
  tags.style = t.style;
  ElMessage.success(`已选择「${t.name}」模板`);
}
</script>

<style scoped>
/* ===== ART DECO SCRIPT STUDIO ===== */

.sg-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.sg-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-shrink: 0; }
.sg-project-pills { display: flex; gap: 8px; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--bg-300) transparent; padding-bottom: 4px; }
.sg-pill { font-size: 13px; padding: 6px 16px; border-radius: 18px; cursor: pointer; background: var(--bg-200); border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500; white-space: nowrap; transition: all 0.15s; user-select: none; }
.sg-pill:hover { border-color: var(--gold); color: var(--text-100); }
.sg-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }
.sg-project-pills::-webkit-scrollbar { height: 4px; }
.sg-project-pills::-webkit-scrollbar-thumb { background: var(--bg-300); border-radius: 2px; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.import-link { font-size: 14px; color: var(--gold-dark) !important; font-weight: 600; letter-spacing: 0.5px; background: transparent !important; border: none !important; }
.import-link:hover { color: var(--navy) !important; }

.tab-switch { padding: 6px 16px; font-size: 13px; cursor: pointer; color: var(--text-200); font-weight: 500; background: var(--bg-200); transition: all 0.15s; user-select: none; letter-spacing: 0.5px; }
.tab-switch.active { background: var(--navy); color: var(--gold); font-weight: 700; }
.tab-switch:hover:not(.active) { color: var(--text-100); background: var(--bg-100); }
.sg-main { display: flex; flex-direction: column; flex: 1; overflow-y: auto; min-height: 0; }
.card-title { font-family: 'Playfair Display', serif; font-weight: 700; color: var(--text-100); font-size: 15px; letter-spacing: 0.5px; }
.card-header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.card-header-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.history-fill { margin-top: 14px; flex: 1; display: flex; flex-direction: column; overflow: visible; min-height: 0; }
.history-fill :deep(.el-card__body) { flex: 1; display: flex; flex-direction: column; overflow: visible; }

/* PC 表格滚动容器 */
.history-scroll { flex: 1; overflow-x: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
/* 响应式卡片列表 */
.script-card-list { display: flex; flex-direction: column; gap: 10px; overflow: visible; }
.sc-card { background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 16px; cursor: pointer; transition: border-color 0.15s; overflow: visible; }
.sc-card:hover { border-color: var(--gold); }
.sc-card:active { background: var(--bg-100); }
.sc-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sc-ep-num { font-weight: 700; color: var(--text-100); font-size: 0.9375rem; font-family: 'Playfair Display', serif; }
.sc-title { font-size: 1rem; color: var(--text-100); font-weight: 600; margin-bottom: 8px; line-height: 1.4; word-break: break-all; }
.sc-meta { display: flex; gap: 16px; font-size: 0.8125rem; color: var(--text-200); margin-bottom: 12px; flex-wrap: wrap; }
.sc-actions { display: flex; gap: 8px; }
.sc-actions .el-button { flex: 1; }
.batch-bar { display: flex; align-items: center; gap: 12px; padding: 10px 0 0; color: var(--text-100); font-size: 0.8125rem; border-top: 2px solid var(--gold); margin-top: 8px; flex-wrap: wrap; }
.tag-card { flex-shrink: 0; border: 1px solid var(--gold) !important; border-radius: 10px !important; }
.tag-form { display: flex; flex-wrap: wrap; gap: 0; margin-bottom: 0; }
.quick-templates{display:flex;align-items:center;gap:8px;padding:8px 0;flex-wrap:wrap}
.qt-label{font-size:12px;color:var(--text-200);font-weight:600}
.qt-chip{padding:5px 12px;border-radius:16px;font-size:12px;cursor:pointer;background:var(--bg-100);border:1px solid var(--bg-300);color:var(--text-100);transition:all 0.15s;white-space:nowrap;user-select:none}
.qt-chip:hover{border-color:var(--gold);background:var(--gold-light);transform:translateY(-1px)}
.tag-form .el-form-item { margin-right: 16px; margin-bottom: 4px; }

/* 悬浮日志 */
.log-float-toggle {
  position: fixed; z-index: 1000;
  width: 44px; height: 44px; border-radius: 50%; background: var(--gold); color: var(--navy);
  display: flex; align-items: center; justify-content: center; cursor: grab;
  font-size: 18px; box-shadow: 0 2px 16px rgba(201,168,76,0.5);
  user-select: none; border: 2px solid var(--gold-dark);
}
.log-float-toggle:active { cursor: grabbing; }
.log-float-badge { position: absolute; top: -4px; right: -4px; background: #C44545; color: #fff; border-radius: 10px; padding: 0 5px; font-size: 10px; line-height: 16px; min-width: 16px; text-align: center; }
.log-float-panel {
  position: fixed; z-index: 999;
  width: 480px; height: 160px; background: var(--bg-200); border-radius: 10px;
  border: 2px solid var(--gold); box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  display: flex; flex-direction: column; overflow: hidden;
  transition: opacity 0.25s, transform 0.25s;
}
.log-hidden { opacity: 0; transform: translateY(20px); pointer-events: none; }
.log-header { padding: 6px 14px; font-size: 11px; font-weight: 700; color: var(--text-100); background: var(--bg-100); border-bottom: 1px solid var(--gold); flex-shrink: 0; cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px; letter-spacing: 1px; }
.log-header:hover { color: var(--gold-dark); }
.log-badge { background: var(--gold); color: var(--navy); border-radius: 10px; padding: 0 6px; font-size: 10px; font-weight: 700; }
.log-body { flex: 1; overflow-y: auto; padding: 6px 14px; font-family: 'DM Sans', monospace; font-size: 11px; line-height: 1.7; }
.log-empty { color: var(--text-200); text-align: center; padding: 20px 0; font-size: 13px; }
.log-line { display: flex; gap: 10px; }
.log-time { color: var(--text-200); flex-shrink: 0; font-size: 10px; }
.log-info .log-msg { color: var(--text-200); }
.log-success .log-msg { color: var(--gold-dark); font-weight: 600; }
.log-warning .log-msg { color: var(--accent-100); }
.log-error .log-msg { color: #C44545; }

.welcome-placeholder { text-align: center; padding: 80px 40px; }
.welcome-placeholder.full { flex: 1; padding: 120px 40px; }
.welcome-placeholder .welcome-icon { font-size: 72px; margin-bottom: 20px; }
.welcome-placeholder h3 { font-family: 'Playfair Display', serif; font-size: 24px; color: var(--text-100); margin-bottom: 12px; }
.welcome-placeholder p { font-size: 14px; line-height: 1.8; color: var(--text-200); }

.json-preview { background: var(--bg-100); color: var(--text-100); padding: 16px; border-radius: 8px; overflow-x: auto; max-height: 300px; font-size: 12px; border: 1px solid var(--gold); }
.char-card { background: var(--bg-100); padding: 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--bg-300); }
.char-card strong { color: var(--text-100); font-family: 'Playfair Display', serif; }
.char-card p { color: var(--text-200); margin-top: 4px; font-size: 13px; }

/* 自定义步骤条 */
.custom-steps { display: flex; flex-direction: column; gap: 2px; }
.cstep { display: flex; gap: 14px; padding: 10px 0; align-items: flex-start; }
.cstep-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; font-size: 12px; font-weight: bold; transition: all 0.35s; }
.cstep-wait .cstep-dot { background: var(--bg-300); color: var(--text-200); }
.cstep-active .cstep-dot { background: var(--gold); color: var(--navy); }
.cstep-done .cstep-dot { background: var(--gold-dark); color: #fff; }
.cstep-content { flex: 1; min-width: 0; }
.cstep-title { font-size: 14px; line-height: 1.6; font-weight: 600; }
.cstep-wait .cstep-title { color: var(--text-200); }
.cstep-active .cstep-title { color: var(--text-100); }
.cstep-done .cstep-title { color: var(--text-100); }
.cstep-desc { font-size: 12px; margin-top: 2px; }
.cstep-wait .cstep-desc { color: var(--text-200); }
.cstep-active .cstep-desc { color: var(--gold-dark); }
.cstep-done .cstep-desc { color: var(--text-200); }
.cstep-check { font-size: 13px; }
.cstep-spinner { width: 12px; height: 12px; border: 2px solid var(--navy); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 故事线 */
.storyline-wrap { display: flex; flex-direction: column; max-height: 60vh; overflow: hidden; }
.storyline-summary-box { background: var(--navy); padding: 16px 18px; border-radius: 10px; margin-bottom: 14px; display: flex; align-items: center; gap: 16px; flex-shrink: 0; border: 1px solid var(--gold); }
.sl-label { font-weight: 700; color: var(--gold); font-size: 13px; letter-spacing: 1px; }
.sl-text { color: var(--gold-light); font-size: 14px; }
.storyline-scroll { flex: 1; overflow-y: auto; padding-right: 4px; }
.storyline-timeline { display: flex; flex-direction: column; gap: 0; }
.sl-episode { display: flex; gap: 14px; min-height: 60px; }
.sl-dot-line { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
.sl-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--gold); border: 2px solid var(--gold); flex-shrink: 0; }
.sl-current .sl-dot { background: var(--navy); border-color: var(--gold); width: 14px; height: 14px; }
.sl-line { width: 2px; flex: 1; background: var(--gold); opacity: 0.3; min-height: 40px; }
.sl-card { flex: 1; background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 8px; padding: 14px 16px; margin-bottom: 8px; }
.sl-current .sl-card { border-color: var(--gold); background: var(--bg-100); }
.sl-ep-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sl-ep-num { font-weight: 700; color: var(--text-100); font-size: 14px; font-family: 'Playfair Display', serif; }
.sl-word-count { margin-left: auto; color: var(--text-200); font-size: 11px; }
.sl-ep-title { font-size: 15px; color: var(--text-100); font-weight: 700; margin-bottom: 4px; }
.sl-ep-summary { font-size: 13px; color: var(--text-200); line-height: 1.6; }
.sl-scene-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.sl-pill { background: var(--bg-300); color: var(--text-200); padding: 3px 10px; border-radius: 4px; font-size: 0.6875rem; }

/* 移动端详情弹窗 */
.ms-detail { display: flex; flex-direction: column; gap: 12px; }
.ms-detail-row { display: flex; align-items: center; gap: 12px; }
.ms-dl { font-size: 0.8125rem; color: var(--text-200); min-width: 60px; }
.ms-detail-row strong { color: var(--text-100); font-size: 0.9375rem; }
.ms-detail-summary { background: var(--bg-100); padding: 12px; border-radius: 8px; }
.ms-detail-summary p { margin: 6px 0 0; font-size: 0.875rem; color: var(--text-100); line-height: 1.6; }
.ms-detail-scenes { margin-top: 4px; }
.ms-scene-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--bg-300); font-size: 0.875rem; }
.ms-scene-num { background: var(--gold); color: var(--navy); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
.ms-scene-time { color: var(--text-200); font-size: 0.75rem; margin-left: auto; }

@media (max-width: 768px) {
  .sg-root { height: auto; min-height: 100vh; overflow-x: hidden; }
  .sg-main { padding: 0.5rem; overflow-y: visible; overflow-x: hidden; }
  .sg-topbar { flex-wrap: wrap; gap: 8px; }
  .topbar-right { width: 100%; flex-wrap: wrap; flex-direction: column; gap: 8px; }

  /* 标签表单：2×2 网格 */
  .tag-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .tag-form .el-form-item { margin-right: 0 !important; width: 100% !important; }
  .tag-form .el-form-item:last-child { grid-column: 1 / -1; }
  .tag-form .el-select { width: 100% !important; }

  /* 按钮全宽 */
  .card-header-row { flex-direction: column; align-items: stretch; }
  .card-header-btns { display: flex; flex-direction: row; gap: 8px; }
  .card-header-btns .el-button { flex: 1; min-height: 44px; justify-content: center; }

  /* 卡片列表 */
  .script-card-list { gap: 8px; }
  .sc-card { padding: 12px; }
  .sc-actions .el-button { min-height: 40px; font-size: 0.875rem; }

  /* 日志面板 */
  .log-float-panel { width: calc(100vw - 16px) !important; left: 8px !important; }
  .log-float-toggle { left: auto !important; right: 12px !important; bottom: 80px !important; }

  .welcome-placeholder { padding: 40px 20px; }
  .welcome-placeholder.full { padding: 60px 20px; }

  /* 所有交互 ≥44px */
  .tag-form .el-button { width: 100%; min-height: 44px; font-size: 0.9375rem; }
  :deep(.el-input__wrapper) { min-height: 44px; }
  :deep(.el-select__wrapper) { min-height: 44px; }
}
</style>
