<template>
  <div class="sb-root">
    <!-- 顶部栏 -->
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">故事板</span>
    </div>
    <div class="sb-top">
      <div class="tb-right">
        <div class="sg-project-pills">
          <span v-for="p in projectStore.projects" :key="p._id" :class="['sg-pill', { active: currentProjectId === p._id }]" @click="currentProjectId = p._id; onProjectChange(p._id)">{{ p.name }}</span>
        </div>
        <el-select v-model="currentScriptId" placeholder="选择剧本" @change="onScriptChange" size="default" style="width:180px;margin-left:8px">
          <el-option v-for="s in scripts" :key="s._id" :label="`第${s.episodeNumber}集`" :value="s._id" />
        </el-select>
        <el-button type="primary" style="margin-left:8px" @click="handleAutoGenerate" :disabled="!currentScriptId" :loading="generating">生成故事板</el-button>
        <el-button type="danger" size="small" style="margin-left:4px" @click="deleteStoryboard" :disabled="!currentStoryboard" :loading="deletingSB">删除故事板</el-button>
        <el-button size="small" style="margin-left:4px" @click="openExport">导出</el-button>
        <el-button size="small" style="margin-left:4px" @click="showImportDialog = true" :disabled="!currentStoryboard">导入</el-button>
        <el-divider direction="vertical" style="margin:0 8px" />
        <span style="font-size:12px;color:var(--text-100)">关闭内嵌字幕</span>
        <el-switch v-model="noSubtitles" size="small" />
        <el-tooltip content="开启后，生成的视频画面不会出现自动字幕、文字、水印，台词请在后期手动添加。" placement="bottom">
          <el-icon style="color:var(--text-100);cursor:help;margin-left:4px"><QuestionFilled /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <div class="sb-body" v-if="currentProjectId">
      <!-- ===== 左：剧集列表 ===== -->
      <div class="sb-left">
        <div class="panel-title">剧集</div>
        <div class="ep-list">
          <div v-for="ep in scripts" :key="ep._id"
            :class="['ep-item', { active: currentScriptId === ep._id }]"
            @click="currentScriptId = ep._id; onScriptChange(ep._id)">
            <span class="ep-num">第{{ ep.episodeNumber }}集</span>
            <span class="ep-name">{{ ep.episodeTitle || '未命名' }}</span>
          </div>
        </div>
        <div v-if="scripts.length === 0" style="color:var(--text-200);text-align:center;padding:20px">暂无剧集</div>
      </div>

      <!-- ===== 中：预览 + 时间线 ===== -->
      <div class="sb-center">
        <!-- 视频预览区 -->
        <div class="preview-area">
          <div v-if="!currentShot" class="preview-empty">
            <span style="font-size:48px">🎬</span>
            <p>点击下方镜头缩略图预览</p>
          </div>
          <div v-else class="preview-shot">
            <div class="preview-frame">
              <!-- 视频播放器 -->
              <video v-if="currentShot.renderedVideo && !isTaskId(currentShot.renderedVideo)"
                :src="currentShot.renderedVideo" controls preload="metadata"
                style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px"
                @loadedmetadata="console.log('[视频] 已加载:', currentShot.renderedVideo)">
              </video>
              <!-- 视频生成中（仅当前分镜，跨页面不丢失） -->
              <div v-else-if="videoPollingShot === currentShot?.shotNumber && videoPollingScript === currentScriptId" class="preview-empty">
                <span style="font-size:48px">⏳</span>
                <p>视频生成中... 已等待 {{ videoPollProgress }} 秒</p>
                <p style="font-size:11px;color:var(--text-200)">Seedance 视频通常需要 1~3 分钟</p>
                <el-progress :percentage="Number(Math.min(videoPollProgress / 1.8, 99).toFixed(2))" style="width:200px;margin-top:8px" :stroke-width="6" />
              </div>
              <!-- 图片预览 -->
              <img v-else-if="currentShot.renderedImage" :src="currentShot.renderedImage" style="max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in" @click="openImgViewer(currentShot.renderedImage)" />
              <span v-else style="font-size:64px;color:var(--primary-300)">🎞️</span>
            </div>
            <div class="preview-info">
              <span class="pi-tag">{{ currentShot.shotType }}</span>
              <span class="pi-tag">{{ currentShot.cameraMovement }}</span>
              <span>{{ currentShot.duration }}s</span>
            </div>
            <div class="preview-dialogue" v-if="currentShot.dialogue?.text">
              <strong>{{ currentShot.dialogue.characterName }}</strong>：{{ currentShot.dialogue.text }}
            </div>
          </div>
        </div>

        <!-- 分镜时间线 -->
        <div class="timeline" v-if="currentStoryboard && currentStoryboard.shots" @wheel.prevent="onTimelineWheel">
          <div class="tl-header">
            <span class="tl-label">分镜时间线 ({{ currentStoryboard.shots.length }} 镜头)</span>
            <div class="tl-batch-btns">
              <el-button size="small" type="primary" @click="batchGenerateImages" :loading="batchGenning">批量生图</el-button>
              <el-button size="small" type="success" @click="batchGenerateVideos" :loading="batchGenningVideo" style="margin-left:4px">批量生视频</el-button>
            </div>
          </div>
          <div class="tl-track" ref="tlTrack">
            <template v-for="(s, idx) in currentStoryboard.shots" :key="s.shotNumber">
              <!-- 分镜间插入按钮 -->
              <div class="tl-insert" @click.stop="insertAt(idx)" title="在此插入新分镜">+</div>
              <!-- 分镜卡片 -->
              <div :class="['tl-card', { 'tl-active': currentShot?.shotNumber === s.shotNumber }]" @click="selectShot(s)">
                <div class="tl-card-header">
                  <span class="tl-shot-num">镜头 {{ s.shotNumber }}</span>
                  <span class="tl-shot-dur">⏱ {{ s.duration }}s</span>
                </div>
                <div class="tl-img">
                  <img v-if="s.renderedImage" :src="s.renderedImage" @dblclick.stop="openImgViewer(s.renderedImage)" />
                  <span v-else class="tl-placeholder">待生成</span>
                </div>
                <div class="tl-meta">
                  <span class="tl-type">{{ s.shotType }}</span>
                  <span>{{ s.shotNumber }}</span>
                </div>
                <div class="tl-actions">
                  <label class="tl-btn" title="上传图片" @click.stop>
                    <input type="file" accept="image/*" hidden @change="e => uploadShotImage(s, e)" />🖼️
                  </label>
                  <label class="tl-btn" title="上传视频" @click.stop>
                    <input type="file" accept="video/*" hidden @change="e => uploadShotVideo(s, e)" />🎥
                  </label>
                  <span class="tl-btn" title="复制分镜" @click.stop="copyShot(s)">📋</span>
                  <span class="tl-btn" title="插入新分镜" @click.stop="insertShotAfter(s)">➕</span>
                  <span class="tl-btn tl-btn-del" title="删除分镜" @click.stop="deleteShot(s)">🗑️</span>
                </div>
              </div>
            </template>
            <!-- 末尾插入 + 创建空白分镜 -->
            <div class="tl-insert tl-insert-end" @click.stop="addBlankShot" title="创建空白分镜">+</div>
            <div class="tl-card tl-card-end" @click="addBlankShot">
              <div class="tl-card-header">
                <span class="tl-shot-num">新增</span>
                <span class="tl-shot-dur">⏱ 3s</span>
              </div>
              <div class="tl-img tl-img-add">
                <span class="tl-add-icon">+</span>
              </div>
              <div class="tl-meta-end">创建空白分镜</div>
              <div class="tl-actions-end">
                <span style="font-size:10px;color:var(--primary-300)">点击添加</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 右：绘图/视频面板 ===== -->
      <div class="sb-right">
        <div class="tab-switch">
          <div :class="['tab-btn', { active: rightTab === 'draw' }]" @click="rightTab = 'draw'">绘图</div>
          <div :class="['tab-btn', { active: rightTab === 'video' }]" @click="rightTab = 'video'">视频</div>
        </div>

        <!-- ===== 绘图标签页 ===== -->
        <div v-show="rightTab === 'draw'">
          <div class="right-section">
            <label>图片提示词</label>
            <el-input v-model="currentShotPrompt" type="textarea" :rows="4" placeholder="输入或修改提示词..." size="small" @change="saveCurrentPrompt" />
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <span class="char-count">{{ (currentShotPrompt || '').length }} / 5000</span>
              <el-button size="small" type="primary" link @click="generatePromptForShot" :loading="genningPrompt">AI 生成</el-button>
            </div>
          </div>
          <div class="right-section">
            <label>模型选择</label>
            <el-select v-model="selectedModel" size="small" style="width:100%">
              <el-option label="Seedream 4.0 | 2K" value="doubao_image" />
              <el-option label="Seedream 4.0 | 4K" value="doubao_image_4k" />
              <el-option label="gpt-image-2" value="openai_image" />
            </el-select>
            <el-button size="small" type="primary" style="width:100%;margin-top:8px" @click="generateImageForShot" :loading="genningImage" :disabled="!currentShot">生成图片</el-button>
          </div>
        </div>

        <!-- ===== 视频标签页 ===== -->
        <div v-show="rightTab === 'video'">
          <div class="right-section" style="background:var(--accent-200);padding:10px 12px;border-radius:6px;margin-bottom:12px;font-size:11px;color:var(--text-100);line-height:1.6">
            <strong>⚠️ Seedance 2.0 真人内容规避</strong><br/>
            AI 写实人像也会被判定为"真人"拦截。建议：<br/>
            ① 使用纯场景/道具图片（无人物）<br/>
            ② 使用卡通、动漫、古风等非写实风格<br/>
            ③ 用侧面/背影代替正面特写
          </div>
          <div class="right-section">
            <label>视频提示词</label>
            <el-input v-model="currentVideoPrompt" type="textarea" :rows="4" placeholder="输入视频生成提示词..." size="small" @change="saveCurrentVideoPrompt" />
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <span class="char-count">{{ (currentVideoPrompt || '').length }} / 5000</span>
              <el-button size="small" type="primary" link @click="generateVideoPromptForShot" :loading="genningVideoPrompt">AI 生成</el-button>
            </div>
          </div>
          <div class="right-section">
            <label>时长设置 (秒)</label>
            <el-input-number v-model="videoDuration" :min="1" :max="30" size="small" style="width:100%" @change="saveVideoDuration" />
          </div>
          <div class="right-section">
            <label>视频模型</label>
            <el-select v-model="selectedVideoModel" size="small" style="width:100%">
              <el-option label="Seedance 2.0" value="doubao_video" />
            </el-select>
            <el-button size="small" type="primary" style="width:100%;margin-top:8px" @click="generateVideoForShot" :loading="genningVideo" :disabled="!currentShot">生成视频</el-button>
            <!-- 恢复视频任务 -->
            <div style="margin-top:8px;display:flex;gap:4px">
              <el-input v-model="recoverTaskId" size="small" placeholder="粘贴 taskId 恢复视频" clearable style="flex:1" />
              <el-button size="small" @click="recoverVideo" :loading="recovering" :disabled="!recoverTaskId">恢复</el-button>
            </div>
          </div>
        </div>

        <!-- 参考主体 -->
        <div class="right-section">
          <label>参考角色</label>
          <div class="ref-chars">
            <div v-for="c in assetStore.characters" :key="c._id" class="ref-chip"
              :class="{ active: selectedRefs.includes(c._id), 'has-img': getCharThumb(c) }"
              @click="toggleRef(c._id)"
              :title="getCharThumb(c) ? `${c.name}（有参考图）` : `${c.name}（无参考图）`">
              {{ c.name }}{{ getCharThumb(c) ? ' 🖼️' : '' }}
            </div>
          </div>
        </div>
        <div class="right-section">
          <label>参考场景</label>
          <div class="ref-chars">
            <div v-for="s in assetStore.scenes" :key="s._id" class="ref-chip"
              :class="{ active: selectedSceneRefs.includes(s._id), 'has-img': getSceneThumb(s) }"
              @click="toggleSceneRef(s._id)"
              :title="getSceneThumb(s) ? `${s.sceneName}（有参考图）` : `${s.sceneName}（无参考图）`">
              {{ s.sceneName }}{{ getSceneThumb(s) ? ' 🖼️' : '' }}
            </div>
          </div>
        </div>

        <!-- 参考图片上传 -->
        <div class="right-section">
          <label>参考图片</label>
          <div class="ref-imgs">
            <div v-for="(img, i) in currentRefImages" :key="i" class="ref-img-item">
              <img :src="img" />
              <span class="ref-img-del" @click="removeRefImage(i)">×</span>
            </div>
            <label class="ref-upload-btn">
              + 上传
              <input type="file" accept="image/*" multiple hidden @change="onRefImageUpload" />
            </label>
          </div>
        </div>

        <!-- 分镜素材管理 -->
        <div class="right-section">
          <label>分镜素材 ({{ (currentShot?.materials || []).length }} 版本)</label>
          <div class="mat-grid">
            <div v-for="m in (currentShot?.materials || [])" :key="m.version"
              class="mat-item" :class="{ 'mat-active': (currentShot.renderedImage === m.url || currentShot.renderedVideo === m.url) }">
              <!-- 视频素材显示播放图标 -->
              <div v-if="m.type === 'video'" class="mat-video-preview" @click="openVideoPreview(m.url)">
                <span class="mat-play-icon">▶</span>
              </div>
              <img v-else-if="m.url" :src="m.url" @click="openImgViewer(m.url)" />
              <span class="mat-type">{{ m.type === 'video' ? '🎥' : '🖼️' }}</span>
              <span class="mat-ver">v{{ m.version }}</span>
              <span class="mat-set" @click.stop="setMatAsCurrent(m)" title="设为主素材">★</span>
            </div>
          </div>
          <div v-if="!(currentShot?.materials || []).length" style="color:var(--primary-300);font-size:12px">生成图片/视频后将显示此处</div>
        </div>
        <div class="right-section">
          <label>其他分镜素材</label>
          <div class="mat-grid">
            <div v-for="s in (currentStoryboard?.shots || []).filter(x => x.renderedImage || x.renderedVideo).slice(0, 8)" :key="s.shotNumber"
              class="mat-item" @click="applyMaterialToShot(s)">
              <div v-if="s.renderedVideo && !s.renderedImage" class="mat-video-preview"><span class="mat-play-icon">▶</span></div>
              <img v-else-if="s.renderedImage" :src="s.renderedImage" />
              <span class="mat-num">#{{ s.shotNumber }}</span>
            </div>
          </div>
          <div v-if="!currentStoryboard?.shots?.filter(x => x.renderedImage || x.renderedVideo).length" style="color:var(--primary-300);font-size:12px">生成图片/视频后将显示在此处</div>
        </div>
      </div>
    </div>

    <el-empty v-if="!currentProjectId" description="请选择片场" style="margin-top:80px" />

    <!-- 导出弹窗 -->
    <el-dialog v-model="showExportDialog" title="导出内容" width="540px">
      <el-form label-position="top" size="small">
        <el-form-item label="选择剧集">
          <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="全部剧集（不选=导出全部）">
            <el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" />
          </el-select>
          <div style="display:flex;gap:8px;margin-top:4px">
            <el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">全选</el-button>
            <el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">当前集</el-button>
            <el-button size="small" link @click="exportEpisodes = []">清空</el-button>
          </div>
        </el-form-item>
        <el-form-item label="导出内容">
          <el-checkbox-group v-model="exportTypes">
            <el-checkbox label="script">📝 剧本全文</el-checkbox>
            <el-checkbox label="shots">🎬 分镜全文</el-checkbox>
            <el-checkbox label="full_storyboard">🎞️ 故事板全文</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="导出格式">
          <el-select v-model="exportFormat" style="width:100%">
            <el-option label="PDF（浏览器打印/另存为 PDF）" value="pdf" />
            <el-option label="Markdown（.md 文件）" value="markdown" />
            <el-option label="Excel / CSV（表格格式）" value="csv" />
            <el-option label="Word（.doc 文件）" value="word" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" show-icon style="margin-top:8px">
        <template #title>{{ formatHint }}</template>
      </el-alert>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0 || exportEpisodes.length === 0">导出</el-button>
      </template>
    </el-dialog>

    <!-- 图片查看器 -->
    <el-dialog v-model="imgViewerVisible" title="图片预览" width="90%" top="2vh" destroy-on-close>
      <div class="img-viewer-toolbar">
        <el-button size="small" @click="imgScale = Math.max(0.2, imgScale - 0.2)">−</el-button>
        <span class="img-scale-text">{{ Math.round(imgScale * 100) }}%</span>
        <el-button size="small" @click="imgScale = Math.min(5, imgScale + 0.2)">+</el-button>
        <el-button size="small" @click="imgScale = 1; imgViewerVisible = false">关闭</el-button>
      </div>
      <div class="img-viewer-body"
        @wheel.prevent="(e) => { e.deltaY < 0 ? imgScale = Math.min(5, imgScale + 0.1) : imgScale = Math.max(0.2, imgScale - 0.1) }"
        @mousedown="onImgDragStart" @mousemove="onImgDragMove" @mouseup="onImgDragEnd" @mouseleave="onImgDragEnd"
        :style="{ cursor: imgDragStart ? 'grabbing' : 'grab' }">
        <img v-if="imgViewerSrc" :src="imgViewerSrc"
          :style="{ transform: `translate(${imgX}px,${imgY}px) scale(${imgScale})` }"
          draggable="false" />
      </div>
    </el-dialog>

    <!-- 导入弹窗 -->
    <el-dialog v-model="showImportDialog" title="导入分镜数据" width="600px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        <template #title>粘贴 CSV 或 JSON。CSV表头：镜头号,场景名称,景别,构图,运镜,灯光,时长,图像描述,角色名,台词,音效,备注,状态</template>
      </el-alert>
      <el-input v-model="importText" type="textarea" :rows="14" placeholder="粘贴数据..." />
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!importText.trim()">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { useStoryboardStore } from '../stores/storyboard';
import { useAssetStore } from '../stores/asset';
import { storyboardAPI } from '../api';
import { buildShotsFromScenes } from '../components/promptBuilder';

const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const storyboardStore = useStoryboardStore();
const assetStore = useAssetStore();

const currentProjectId = ref('');
const currentScriptId = ref('');
const currentStoryboard = ref(null);
const currentShot = ref(null);
const scripts = ref([]);
const generating = ref(false);
const deletingSB = ref(false);
const genningImage = ref(false);
const genningVideo = ref(false);
const genningPrompt = ref(false);
const genningVideoPrompt = ref(false);
const batchGenning = ref(false);
const batchGenningVideo = ref(false);
const noSubtitles = ref(getStoredNoSubtitles());

function getStoredNoSubtitles() { try { return localStorage.getItem('ad_no_subtitles') === 'true'; } catch { return true; } }
function saveNoSubtitles(v) { try { localStorage.setItem('ad_no_subtitles', String(v)); } catch {} }
const showImportDialog = ref(false);
const showExportDialog = ref(false);
const exportTypes = ref(['script', 'shots', 'full_storyboard']);
const exportFormat = ref('pdf');
const exportEpisodes = ref([]);
const formatHint = computed(() => {
  const m = { pdf: 'PDF：打开打印预览，浏览器「另存为 PDF」保存', markdown: 'Markdown：下载 .md 文件，可用 Typora/VS Code 打开', csv: 'Excel/CSV：下载 .csv 文件，用 Excel/WPS 打开编辑', word: 'Word：下载 .doc 文件，用 Word/WPS 打开编辑' };
  return m[exportFormat.value] || '';
});
const importText = ref('');
const importing = ref(false);
const shotPrompt = ref('');
const selectedModel = ref('doubao_image');
const selectedRefs = ref([]);
const rightTab = ref('draw');
const currentShotPrompt = ref('');
const currentVideoPrompt = ref('');
const videoDuration = ref(5);
const selectedVideoModel = ref('doubao_video');
const currentRefImages = ref([]);
const tlTrack = ref(null);

watch(noSubtitles, saveNoSubtitles);

onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  // 恢复视频生成状态
  if (window.__videoGenning) { genningVideo.value = true; window.__setLoading?.(true); }
  if (window.__imgGenning) { genningImage.value = true; window.__setLoading?.(true); }
  if (restored) { currentProjectId.value = restored._id; onProjectChange(restored._id); }
  // 恢复未完成的视频任务
  setTimeout(() => resumeVideoTasks(), 1000);
});

function onProjectChange(val) {
  currentScriptId.value = ''; currentStoryboard.value = null; currentShot.value = null;
  if (val) {
    scriptStore.fetchScripts(val).then(() => {
      scripts.value = [...scriptStore.scripts];
      if (scripts.value.length > 0) { currentScriptId.value = scripts.value[0]._id; onScriptChange(scripts.value[0]._id); }
    });
    storyboardStore.fetchStoryboards({ projectId: val });
    assetStore.fetchCharacters(val);
    assetStore.fetchScenes(val);
  }
}
function onScriptChange(val) {
  if (val) {
    const existing = storyboardStore.storyboards.find(s => s.scriptId === val);
    currentStoryboard.value = existing ? JSON.parse(JSON.stringify(existing)) : null;
    currentShot.value = currentStoryboard.value?.shots?.[0] || null;
    updatePrompt();
  }
}
async function handleAutoGenerate() {
  if (!currentScriptId.value || !currentProjectId.value) return;
  generating.value = true;
  try {
    // 1. 拉取分镜 + 全局设定
    const script = await scriptStore.fetchScript(currentScriptId.value);
    const scenes = script.scenes || [];
    if (scenes.length === 0) {
      ElMessage.warning('该集还没有分镜，请先在「分镜管理」中添加或生成分镜');
      generating.value = false;
      return;
    }

    // 读取项目全局设定
    let videoConfig = { aspectRatio: '9:16', visualStyle: '写实', subStyle: '' };
    let directorSettings = null;
    try {
      const project = await projectStore.fetchProject(currentProjectId.value);
      if (project?.videoConfig) videoConfig = project.videoConfig;
      if (project?.directorSettings) directorSettings = project.directorSettings;
    } catch (e) { /* ignore */ }

    ElMessage.info(`正在同步 ${scenes.length} 个分镜到故事板（画幅:${videoConfig.aspectRatio} 风格:${videoConfig.visualStyle}）...`);

    // 2. 用共享构建器批量生成镜头+提示词
    const shots = buildShotsFromScenes(scenes, videoConfig, noSubtitles.value, directorSettings);

    // 保留旧的已生成素材（按镜号匹配）
    const oldShots = currentStoryboard.value?.shots || [];
    shots.forEach(newShot => {
      const old = oldShots.find(s => s.shotNumber === newShot.shotNumber);
      if (old) {
        if (old.renderedImage) newShot.renderedImage = old.renderedImage;
        if (old.renderedVideo) newShot.renderedVideo = old.renderedVideo;
        if (old.materials?.length) newShot.materials = [...old.materials];
        if (old._imagePrompt) newShot._imagePrompt = old._imagePrompt;
        if (old._videoPrompt) newShot._videoPrompt = old._videoPrompt;
      }
    });

    // 3. 批量同步到故事板
    const rawRes = await fetch('/api/v1/storyboards/auto-generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId: currentScriptId.value, projectId: currentProjectId.value, batchShots: shots }),
    });
    const data = await rawRes.json();

    currentStoryboard.value = data.data ? JSON.parse(JSON.stringify(data.data)) : { shots };
    currentStoryboard.value.shots = currentStoryboard.value.shots || shots;
    // 保留当前选中的分镜（按镜号匹配）
    const prevShotNum = currentShot.value?.shotNumber;
    const matched = currentStoryboard.value.shots.find(s => s.shotNumber === prevShotNum);
    currentShot.value = matched || currentStoryboard.value.shots[0] || null;
    loadShotData(currentShot.value);

    ElMessage.success(`已同步 ${shots.length} 个分镜，图片/视频提示词已自动区分生成`);
  } catch (e) {
    console.error(e);
    ElMessage.error('同步失败: ' + (e.message || ''));
  }
  finally { generating.value = false; }
}

async function deleteStoryboard() {
  if (!currentStoryboard.value?._id) return;
  try { await ElMessageBox.confirm('确定删除当前故事板？删除后可以重新生成。', '删除故事板', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '下次再说叭' }); } catch { return; }
  deletingSB.value = true;
  try {
    await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}`, { method: 'DELETE' });
    currentStoryboard.value = null;
    currentShot.value = null;
    ElMessage.success('故事板已删除，可重新生成');
  } catch (e) { ElMessage.error('删除失败'); }
  finally { deletingSB.value = false; }
}

function selectShot(s) {
  // 保存当前分镜的提示词
  saveCurrentPrompt();
  saveCurrentVideoPrompt();
  saveVideoDuration();
  // 切换到新分镜
  currentShot.value = s;
  loadShotData(s);
}

function loadShotData(s) {
  if (!s) return;
  currentShotPrompt.value = s._imagePrompt || s.imageDescription || '';
  currentVideoPrompt.value = s._videoPrompt || '';
  videoDuration.value = s.duration || 5;
  currentRefImages.value = s._refImages || [];
}

function saveCurrentPrompt() {
  if (currentShot.value) currentShot.value._imagePrompt = currentShotPrompt.value;
}
function saveCurrentVideoPrompt() {
  if (currentShot.value) currentShot.value._videoPrompt = currentVideoPrompt.value;
}
function saveVideoDuration() {
  if (currentShot.value && videoDuration.value) currentShot.value.duration = videoDuration.value;
}

function updatePrompt() {
  loadShotData(currentShot.value);
}

function getCharThumb(c) { return c.morphs?.[0]?.referenceImage || c.morphs?.[0]?.generatedImages?.front || c.referenceImage || c.generatedImage || ''; }
function getSceneThumb(s) { return s.generatedImage || s.referenceImage || s.styleImage || ''; }
// 优先取公网可访问的 URL（云存储），fallback 到本地路径
function getRefUrl(asset) {
  const morph = asset.morphs?.[0];
  // 候选 URL 列表：公网 URL 优先，本地 /uploads/ 兜底
  const candidates = [
    morph?.generatedImages?.front,
    morph?.generatedImages?.side,
    morph?.generatedImages?.back,
    morph?.referenceImage,
    asset.generatedImage,
    asset.referenceImage,
  ].filter(Boolean);
  // 优先返回 https:// 公网 URL（对象存储/云存储）
  const cloud = candidates.find(u => u.startsWith('https://') || u.startsWith('http://'));
  if (cloud) return cloud;
  // fallback 到 /uploads/ 本地路径
  const local = candidates.find(u => u.startsWith('/uploads/'));
  return local || candidates[0] || '';
}

const selectedSceneRefs = ref([]);

function toggleRef(id) {
  const idx = selectedRefs.value.indexOf(id);
  if (idx > -1) selectedRefs.value.splice(idx, 1);
  else selectedRefs.value.push(id);
}
function setMatAsCurrent(m) {
  if (!currentShot.value) return;
  if (m.type === 'video') {
    currentShot.value.renderedVideo = m.url;
  } else {
    currentShot.value.renderedImage = m.url;
  }
  if (currentStoryboard.value?._id) {
    fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${currentShot.value.shotNumber}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m.type === 'video' ? { renderedVideo: m.url } : { renderedImage: m.url }),
    }).catch(() => {});
  }
  ElMessage.success(m.type === 'video' ? `已切换为当前视频 (v${m.version})` : `已切换为主图 (v${m.version})`);
}
function toggleSceneRef(id) {
  const idx = selectedSceneRefs.value.indexOf(id);
  if (idx > -1) selectedSceneRefs.value.splice(idx, 1);
  else selectedSceneRefs.value.push(id);
}

function onTimelineWheel(e) {
  // @wheel.prevent 已处理 preventDefault
  const el = tlTrack.value || e.currentTarget?.querySelector('.tl-track');
  if (!el) return;
  el.scrollLeft += e.deltaY || e.deltaX || 0;
}

function onRefImageUpload(e) {
  const files = e.target.files;
  if (!files) return;
  for (const f of files) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentRefImages.value.push(ev.target.result);
      if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
    };
    reader.readAsDataURL(f);
  }
  e.target.value = '';
}

function removeRefImage(i) {
  currentRefImages.value.splice(i, 1);
  if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
}

const imgViewerVisible = ref(false);
const imgViewerSrc = ref('');
const imgScale = ref(1);
const imgX = ref(0);
const imgY = ref(0);
let imgDragStart = false, imgStartX = 0, imgStartY = 0, imgOrigX = 0, imgOrigY = 0;

function openVideoPreview(url) {
  if (!url) return;
  window.open(url, '_blank');
}
function openImgViewer(src) {
  if (!src) return;
  imgViewerSrc.value = src;
  imgScale.value = 1;
  imgX.value = 0;
  imgY.value = 0;
  imgViewerVisible.value = true;
}
function onImgDragStart(e) { imgDragStart = true; imgStartX = e.clientX; imgStartY = e.clientY; imgOrigX = imgX.value; imgOrigY = imgY.value; }
function onImgDragMove(e) { if (!imgDragStart) return; imgX.value = imgOrigX + e.clientX - imgStartX; imgY.value = imgOrigY + e.clientY - imgStartY; }
function onImgDragEnd() { imgDragStart = false; }

function applyMaterialToShot(s) {
  if (!currentShot.value || !s.renderedImage) return;
  currentShot.value.renderedImage = s.renderedImage;
  ElMessage.success(`素材 #${s.shotNumber} 已应用到当前分镜`);
}

// ===== 分镜卡片按钮功能 =====

function uploadShotImage(shot, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    shot.renderedImage = ev.target.result;
    ElMessage.success(`分镜 #${shot.shotNumber} 图片已上传`);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function uploadShotVideo(shot, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    shot.renderedVideo = ev.target.result;
    ElMessage.success(`分镜 #${shot.shotNumber} 视频已上传`);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function copyShot(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  const copy = JSON.parse(JSON.stringify(shot));
  copy.shotNumber = shot.shotNumber + 0.5; // 临时编号
  shots.splice(idx + 1, 0, copy);
  renumberShots();
  ElMessage.success(`已复制分镜 #${shot.shotNumber}`);
}

function insertShotAfter(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  shots.splice(idx + 1, 0, {
    shotNumber: shot.shotNumber + 0.5,
    sceneName: shot.sceneName || '',
    shotType: '中景', cameraMovement: '静止', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
  ElMessage.success(`已在 #${shot.shotNumber} 后插入新分镜`);
}

async function deleteShot(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  if (shots.length <= 1) { ElMessage.warning('至少保留一个分镜'); return; }
  try {
    await ElMessageBox.confirm(`确认移除分镜 #${shot.shotNumber}？此操作不可撤销。`, '删除确认', { type: 'warning', confirmButtonText: '确认移除', cancelButtonText: '取消' });
  } catch { return; }
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  shots.splice(idx, 1);
  renumberShots();
  if (currentShot.value?.shotNumber === shot.shotNumber) {
    currentShot.value = shots[Math.min(idx, shots.length - 1)] || null;
  }
  ElMessage.success(`已移除分镜 #${shot.shotNumber}`);
}

function insertAt(idx) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  shots.splice(idx, 0, {
    shotNumber: idx + 0.5, sceneName: shots[idx]?.sceneName || '',
    shotType: '中景', cameraMovement: '静止', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
  ElMessage.success(`已在位置 #${idx + 1} 插入新分镜`);
}

function addBlankShot() {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  shots.push({
    shotNumber: shots.length + 1, sceneName: '',
    shotType: '中景', cameraMovement: '静止', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
}

async function batchGenerateImages() {
  if (!currentStoryboard.value) return;
  const pending = currentStoryboard.value.shots.filter(s => !s.renderedImage && (s._imagePrompt || s.imageDescription));
  if (pending.length === 0) { ElMessage.warning('没有待生成的分镜（需要先填写提示词）'); return; }
  try { await ElMessageBox.confirm(`将为 ${pending.length} 个分镜批量生成图片，确认开始？`, '批量生图', { type: 'info' }); } catch { return; }
  batchGenning.value = true;
  window.__imgGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  for (const s of pending) {
    try {
      const prompt = s._imagePrompt || s.imageDescription;
      const res = await fetch('/api/v1/assets/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'character', prompt, model: selectedModel.value, referenceImages: s._refImages || [] })
      });
      const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
      if (data.data?.imageUrl) { s.renderedImage = data.data.imageUrl; done++; const mats2 = s.materials || []; mats2.push({ version: mats2.length + 1, type: "image", url: data.data.imageUrl, prompt: s._imagePrompt || "", createdAt: new Date().toISOString() }); s.materials = mats2; const mats = s.materials || []; mats.push({ version: mats.length + 1, type: "image", url: data.data.imageUrl, prompt: s._imagePrompt || "", createdAt: new Date().toISOString() }); s.materials = mats; try { if (currentStoryboard.value?._id) await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${s.shotNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renderedImage: data.data.imageUrl, materials: s.materials }) }); } catch {} }
    } catch (e) { console.error('batch image fail:', e); }
  }
  batchGenning.value = false;
  window.__imgGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`批量生图完成：${done}/${pending.length}`);
}

async function batchGenerateVideos() {
  if (!currentStoryboard.value) return;
  const pending = currentStoryboard.value.shots.filter(s => !s.renderedVideo && (s._videoPrompt || s.imageDescription));
  if (pending.length === 0) { ElMessage.warning('没有待生成的分镜（需要先填写视频提示词）'); return; }
  try { await ElMessageBox.confirm(`将为 ${pending.length} 个分镜批量生成视频，确认开始？`, '批量生视频', { type: 'info' }); } catch { return; }
  batchGenningVideo.value = true;
  window.__videoGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  for (const s of pending) {
    try {
      const prompt = s._videoPrompt || s.imageDescription;
      const res = await fetch('/api/v1/assets/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt, model: selectedVideoModel.value, inputImage: s.renderedImage || '', duration: s.duration || 5 })
      });
      const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
      if (data.data?.imageUrl) { s.renderedVideo = data.data.imageUrl; done++; try { if (currentStoryboard.value?._id) await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${s.shotNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renderedVideo: data.data.imageUrl }) }); } catch {} }
    } catch (e) { console.error('batch video fail:', e); }
  }
  batchGenningVideo.value = false;
  window.__videoGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`批量生视频完成：${done}/${pending.length}`);
}

function renumberShots() {
  if (!currentStoryboard.value) return;
  currentStoryboard.value.shots.forEach((s, i) => { s.shotNumber = i + 1; });
}

async function generatePromptForShot() {
  if (!currentShot.value) return;
  genningPrompt.value = true;
  try {
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'storyboard', existingPrompt: '你是AI绘图提示词专家。根据分镜描述生成高质量中文图片提示词，包含画面内容、人物动作、场景氛围、光影、构图、风格。只输出完整提示词。\\n\\n分镜描述：' + currentShotPrompt.value + '\\n\\n请生成完整图片提示词。' })
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
    currentShotPrompt.value = data.data?.prompt || currentShotPrompt.value;
    saveCurrentPrompt();
    ElMessage.success('图片提示词已生成');
  } catch (e) { ElMessage.error('生成失败'); }
  finally { genningPrompt.value = false; }
}

async function generateVideoPromptForShot() {
  if (!currentShot.value) return;
  genningVideoPrompt.value = true;
  try {
    const s = currentShot.value;
    const dialogues = s._dialogues || [];
    const dialogueText = dialogues.map(d => (d.characterName || '') + '：' + (d.text || '') + (d.actionHint ? '(' + d.actionHint + ')' : '')).filter(x => x.includes('：')).join('；');
    const charNames = [...new Set(dialogues.map(d => d.characterName).filter(Boolean))];
    const charAppearances = [];
    charNames.forEach(name => {
      const c = assetStore.characters.find(x => x.name === name);
      if (c && c.appearance) charAppearances.push('【' + name + '】' + c.appearance);
    });
    const parts = [
      '场景：' + (s.sceneName || '') + '，' + (s._timeOfDay || '') + '，' + (s._atmosphere || ''),
      '景别：' + (s.shotType || '中景') + '，运镜：' + (s.cameraMovement || '静止'),
      '时长：' + videoDuration.value + '秒',
      dialogueText ? '台词：' + dialogueText : '',
      charAppearances.length > 0 ? '角色外貌：' + charAppearances.join('；') : '',
      s.imageDescription ? '画面描述：' + s.imageDescription : '',
    ].filter(Boolean).join('\n');
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'video', existingPrompt: '你是短视频导演。根据以下分镜信息生成一段完整的视频提示词。要求：包含画面描述、运镜方式、人物动作、台词节奏、光影氛围，适合' + videoDuration.value + '秒竖屏短视频。只输出视频提示词文本。\n\n' + parts })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
    if (data.data?.prompt) {
      currentVideoPrompt.value = data.data.prompt;
      saveCurrentVideoPrompt();
      ElMessage.success('视频提示词已生成（含台词节奏）');
    }
  } catch (e) { ElMessage.error('生成失败: ' + (e.message || '')); }
}
async function generateImageForShot() {
  if (!currentShot.value || !currentShotPrompt.value) { ElMessage.warning('请先填写提示词'); return; }
  genningImage.value = true;
  window.__imgGenning = true;
  window.__setLoading?.(true);
  try {
    // 收集参考图：选中角色 + 选中场景 + 当前分镜已上传的参考图
    const refUrls = [];
    const charAppearances = [];
    selectedRefs.value.forEach(id => {
      const c = assetStore.characters.find(x => x._id === id);
      if (!c) return;
      const url = getRefUrl(c);
      if (url) refUrls.push(url);
      const appearance = c.appearance || (c.morphs && c.morphs[0] && c.morphs[0].appearancePrompt) || '';
      if (appearance) charAppearances.push('【' + c.name + '】' + appearance);
    });
    selectedSceneRefs.value.forEach(id => {
      const s = assetStore.scenes.find(x => x._id === id);
      const url = getRefUrl(s);
      if (url) refUrls.push(url);
    });
    if (currentShot.value._refImages?.length) refUrls.push(...currentShot.value._refImages);

    let enrichedPrompt = currentShotPrompt.value;
    if (charAppearances.length > 0) {
      enrichedPrompt += '；【角色外貌约束·必须遵守】严格按照以下角色设定生成，保持人物五官、发型、服饰100%一致：' + charAppearances.join('；') + '；注意：面部特征、发型发色、服饰风格必须与以上设定完全吻合，不得改变';
    }
    console.log('[生图] 参考图数量:', refUrls.length, '角色外貌描述:', charAppearances.length, 'URLs:', refUrls);
    const res = await fetch('/api/v1/assets/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'character', prompt: enrichedPrompt, model: selectedModel.value, referenceImages: refUrls })
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
    if (data.data?.imageUrl) {
      currentShot.value.renderedImage = data.data.imageUrl;
      const mats = currentShot.value.materials || []; mats.push({ version: mats.length + 1, type: "image", url: data.data.imageUrl, prompt: currentShotPrompt.value, createdAt: new Date().toISOString() }); currentShot.value.materials = mats;
      // 持久化到数据库
      if (currentStoryboard.value?._id) {
        try { await storyboardAPI.updateShot(currentStoryboard.value._id, currentShot.value.shotNumber, { renderedImage: data.data.imageUrl, materials: mats }); } catch {}
      }
      ElMessage.success('图片生成完成，已保存到数据库');
    }
  } catch (e) { ElMessage.error('生成失败'); }
  finally {
    genningImage.value = false;
    window.__imgGenning = false;
    window.__setLoading?.(false);
  }
}

const videoPollingShot = ref(null);
const videoPollingScript = ref(null);
const videoPollProgress = ref(0);
const recoverTaskId = ref('');
const recovering = ref(false);
let videoPollTimer = null;
function isTaskId(url) { return url && /^cgt-/.test(url); }

async function recoverVideo() {
  const tid = recoverTaskId.value.trim();
  if (!tid) return;
  recovering.value = true;
  try {
    const res = await fetch('/api/v1/assets/video-tasks/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: [tid] }),
    });
    const json = await res.json();
    const r = json.data?.[0];
    if (r?.videoUrl) {
      currentShot.value.renderedVideo = r.videoUrl;
      const mats = currentShot.value.materials || [];
      mats.push({ version: mats.length + 1, type: 'video', url: r.videoUrl, prompt: currentVideoPrompt.value, createdAt: new Date().toISOString() });
      currentShot.value.materials = mats;
      if (currentStoryboard.value?._id) {
        try { await storyboardAPI.updateShot(currentStoryboard.value._id, currentShot.value.shotNumber, { renderedVideo: r.videoUrl, materials: mats }); } catch {}
      }
      recoverTaskId.value = '';
      ElMessage.success('视频已恢复到当前分镜 🎉');
    } else {
      ElMessage.warning(r?.status === 'running' || r?.status === 'queued' ? '任务仍在生成中，已开始轮询' : `任务状态: ${r?.status || '未知'}`);
      if (r?.status === 'running' || r?.status === 'queued') {
        startVideoPolling(tid);
      }
    }
  } catch (e) { ElMessage.error('恢复失败: ' + (e.message || '')); }
  finally { recovering.value = false; }
}

async function generateVideoForShot() {
  if (!currentShot.value || !currentVideoPrompt.value) { ElMessage.warning('请先填写或生成视频提示词'); return; }
  genningVideo.value = true;
  window.__videoGenning = true;
  window.__setLoading?.(true);
  try {
    const refUrls = [];
    selectedRefs.value.forEach(id => {
      const c = assetStore.characters.find(x => x._id === id);
      const url = getRefUrl(c); if (url) refUrls.push(url);
    });
    selectedSceneRefs.value.forEach(id => {
      const s = assetStore.scenes.find(x => x._id === id);
      const url = getRefUrl(s); if (url) refUrls.push(url);
    });
    if (currentShot.value._refImages?.length) refUrls.push(...currentShot.value._refImages);
    const inputImage = currentShot.value.renderedImage || '';

    console.log('[生视频] 参考图数量:', refUrls.length);

    const res = await fetch('/api/v1/assets/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt: currentVideoPrompt.value, model: selectedVideoModel.value, inputImage, referenceImages: refUrls, duration: videoDuration.value })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '视频生成失败'); return; }

    const taskId = data.data?.imageUrl;
    if (!taskId) { ElMessage.error('未获取到视频任务ID'); return; }

    // 保存 taskId 到 shot + localStorage 持久化（刷新页面也不丢失）
    currentShot.value.renderedVideo = taskId;
    currentShot.value._videoTaskId = taskId;
    const task = { taskId, shotNumber: currentShot.value.shotNumber, startTime: Date.now(), storyboardId: currentStoryboard.value?._id, scriptId: currentScriptId.value };
    try {
      const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
      tasks[taskId] = task;
      localStorage.setItem('ad_video_tasks', JSON.stringify(tasks));
    } catch {}
    ElMessage.success('视频任务已提交，后台生成中（约1-3分钟），可切换页面稍后回来看');
    window.__addNotification?.('视频任务已提交', 'info', '⏳');

    startVideoPolling(taskId);
  } catch (e) { ElMessage.error('视频生成失败: ' + (e.message || '')); }
  finally {
    genningVideo.value = false;
    window.__videoGenning = false;
    window.__setLoading?.(false);
  }
}

function startVideoPolling(taskId, shotNumOverride, sbIdOverride, scriptIdOverride) {
  const shotNum = shotNumOverride || currentShot.value?.shotNumber;
  const sbId = sbIdOverride || currentStoryboard.value?._id;
  const scriptId = scriptIdOverride || currentScriptId.value;
  videoPollingShot.value = shotNum; videoPollingScript.value = scriptId;
  videoPollProgress.value = 0;
  clearInterval(videoPollTimer);

  videoPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/v1/assets/video-task/${taskId}?provider=doubao`);
      const json = await res.json();
      const d = json.data;
      if ((d.status === 'completed' || d.status === 'succeeded') && d.videoUrl) {
        clearInterval(videoPollTimer);
        videoPollingShot.value = null; videoPollingScript.value = null;
        try {
          const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
          delete tasks[taskId];
          localStorage.setItem('ad_video_tasks', JSON.stringify(tasks));
        } catch {}
        // 更新对应分镜（使用捕获的 sbId 而非 currentStoryboard，防止切换剧集后串位）
        const targetSB = (sbId && sbId === currentStoryboard.value?._id) ? currentStoryboard.value : null;
        const shot = targetSB?.shots?.find(s => s.shotNumber === shotNum);
        if (shot) { shot.renderedVideo = d.videoUrl; delete shot._videoTaskId; }
        // 如果当前选中的正好是目标分镜，即时更新预览
        if (currentStoryboard.value?._id === sbId && currentShot.value?.shotNumber === shotNum && currentScriptId.value === scriptId) {
          currentShot.value.renderedVideo = d.videoUrl;
          const mats = currentShot.value.materials || [];
          mats.push({ version: mats.length + 1, type: 'video', url: d.videoUrl, prompt: currentVideoPrompt.value, createdAt: new Date().toISOString() });
          currentShot.value.materials = mats;
        }
        // 持久化到数据库（用捕获的 sbId）
        if (sbId) {
          try { await storyboardAPI.updateShot(sbId, shotNum, { renderedVideo: d.videoUrl }); } catch {}
        }
        ElMessage.success('视频生成完成，可在预览区播放 🎉');
        window.__addNotification?.('视频生成完成', 'success', '🎥');
      } else if (d.status === 'running' || d.status === 'queued' || d.status === 'processing') {
        // 显示真实已用时间
        let startTime = Date.now();
        try { const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}'); startTime = tasks[taskId]?.startTime || Date.now(); } catch {}
        videoPollProgress.value = Math.floor((Date.now() - startTime) / 1000);
      } else if (d.status === 'failed' || d.status === 'expired' || d.status === 'cancelled') {
        clearInterval(videoPollTimer); videoPollingShot.value = null; videoPollingScript.value = null;
        try {
          const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
          delete tasks[taskId];
          localStorage.setItem('ad_video_tasks', JSON.stringify(tasks));
        } catch {}
        ElMessage.error(d.message || '视频生成失败');
      }
    } catch (e) { /* 继续轮询 */ }
  }, 5000);
}

// 页面挂载时恢复未完成的视频任务（从 localStorage 读取）
function resumeVideoTasks() {
  try {
    const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
    const entries = Object.values(tasks);
    if (entries.length === 0) return;
    console.log('[视频] 恢复未完成任务:', entries.length, '个');
    entries.forEach(t => {
      videoPollingShot.value = t.shotNumber;
      videoPollingScript.value = t.scriptId || currentScriptId.value;
      videoPollProgress.value = Math.floor((Date.now() - (t.startTime || Date.now())) / 1000);
      startVideoPolling(t.taskId, t.shotNumber, t.storyboardId, t.scriptId);
    });
  } catch {}
}

onUnmounted(() => { clearInterval(videoPollTimer); });

function formatEpLabel(ep) {
  const title = (ep.episodeTitle || '').replace(/^第\d+集[：:]*\s*/, '').trim();
  return title ? `第${ep.episodeNumber}集：${title}` : `第${ep.episodeNumber}集`;
}

function openExport() {
  exportEpisodes.value = currentScriptId.value ? [currentScriptId.value] : scripts.value.map(e => e._id);
  showExportDialog.value = true;
}

async function handleExport() {
  if (exportTypes.value.length === 0 || exportEpisodes.value.length === 0) return;
  const fmt = exportFormat.value;
  showExportDialog.value = false;
  try {
    const res = await fetch('/api/v1/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: currentProjectId.value,
        episodeIds: exportEpisodes.value,
        types: exportTypes.value,
        format: fmt,
      }),
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }

    if (fmt === 'pdf') {
      // PDF: 打开打印窗口
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(data.html); w.document.close(); setTimeout(() => w.print(), 500); }
    } else {
      // Markdown / CSV / Word: 下载文件
      const ext = { markdown: 'md', csv: 'csv', word: 'doc' }[fmt] || 'txt';
      const mime = { markdown: 'text/markdown', csv: 'text/csv', word: 'application/msword' }[fmt] || 'text/plain';
      const blob = new Blob([data.content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${data.filename || 'export'}.${ext}`;
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('下载完成');
    }
  } catch (e) { ElMessage.error('导出失败'); }
}
async function handleImport() {
  if (!currentStoryboard.value || !importText.value.trim()) return;
  importing.value = true;
  const text = importText.value.trim();
  const format = text.startsWith('[') || text.startsWith('{') ? 'json' : 'csv';
  try {
    const data = format === 'json' ? JSON.parse(text) : text;
    await storyboardAPI.importData(currentStoryboard.value._id, data, format);
    const refreshed = await storyboardStore.fetchStoryboard(currentStoryboard.value._id);
    currentStoryboard.value = JSON.parse(JSON.stringify(refreshed));
    importText.value = ''; showImportDialog.value = false;
    ElMessage.success('导入成功');
  } catch (e) { ElMessage.error('导入失败'); }
  finally { importing.value = false; }
}
</script>

<style scoped>
/* ===== ART DECO FILM SUITE ===== */

.sb-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.sb-top { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 16px; flex-shrink: 0; }
.tb-right { display: flex; align-items: center; gap: 6px; }

.sb-body { display: flex; flex: 1; gap: 16px; overflow: hidden; min-height: 0; }

/* ===== LEFT: Episode List ===== */
.sb-left {
  width: 190px; flex-shrink: 0; background: var(--bg-200);
  border-radius: 10px; border: 1px solid var(--gold);
  box-shadow: 0 4px 20px rgba(139,105,20,0.08);
  overflow-y: auto; padding: 16px;
}
.panel-title {
  font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700;
  color: var(--text-100); margin-bottom: 12px; padding-bottom: 10px;
  border-bottom: 2px solid var(--gold); letter-spacing: 1px;
}
.ep-item {
  padding: 10px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 6px;
  display: flex; flex-direction: column; gap: 2px;
  border-left: 3px solid transparent; transition: all 0.25s;
}
.ep-item:hover { background: var(--gold-light); border-left-color: var(--gold); }
.ep-item.active { background: var(--navy); border-left-color: var(--gold); }
.ep-item.active .ep-num{color:var(--gold)!important}
.ep-item.active .ep-name{color:var(--gold-light)!important}
.ep-num { color: var(--text-100); font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
.ep-name { color: var(--text-200); font-size: 11px; }

/* ===== CENTER: Preview + Timeline ===== */
.sb-center { flex: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* Preview */
.preview-area {
  background: var(--navy); border-radius: 12px;
  border: 2px solid var(--gold); flex: 1; display: flex;
  align-items: center; justify-content: center; overflow: hidden;
  position: relative;
  box-shadow: inset 0 0 60px rgba(0,0,0,0.3), 0 4px 24px rgba(139,105,20,0.1);
}
.preview-area::before {
  content: ''; position: absolute; top: 12px; left: 16px;
  font-family: 'Playfair Display', serif; font-size: 10px;
  color: var(--gold); letter-spacing: 3px; opacity: 0.6;
}
.preview-empty { text-align: center; color: var(--primary-300); }
.preview-empty p { margin-top: 10px; font-size: 14px; color: var(--gold); opacity: 0.5; letter-spacing: 1px; }
.preview-shot { text-align: center; width: 100%; }
.preview-frame {
  height: 220px; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.2);
}
.preview-info { display: flex; gap: 10px; justify-content: center; padding: 10px; font-size: 12px; }
.pi-tag {
  background: var(--gold); color: var(--navy); padding: 3px 10px;
  border-radius: 3px; font-size: 11px; font-weight: 700; letter-spacing: 1px;
}
.preview-dialogue {
  padding: 10px 18px; color: var(--gold-light); font-size: 13px;
  background: rgba(0,0,0,0.3); border-top: 1px solid var(--gold);
  font-style: italic;
}

/* Timeline */
.timeline {
  background: var(--bg-200); border-radius: 10px; border: 1px solid var(--gold);
  padding: 14px; flex-shrink: 0; box-shadow: 0 2px 12px rgba(139,105,20,0.05);
}
.tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.tl-label { font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700; color: var(--text-100); letter-spacing: 1px; }
.tl-track { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; align-items: flex-start; }
.tl-track::-webkit-scrollbar { height: 4px; }
.tl-track::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }
.tl-card {
  flex-shrink: 0; width: 112px; border-radius: 8px;
  border: 2px solid var(--bg-300); background: var(--bg-200);
  transition: all 0.25s cubic-bezier(0.22,0.61,0.36,1); overflow: hidden;
}
.tl-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(201,168,76,0.15); }
.tl-active { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.2); }
.tl-card-header { display: flex; justify-content: space-between; padding: 5px 8px; background: var(--bg-100); border-bottom: 1px solid var(--bg-300); }
.tl-shot-num { font-size: 10px; font-weight: 700; color: var(--text-100); letter-spacing: 0.5px; }
.tl-shot-dur { font-size: 10px; color: var(--gold-dark); font-weight: 600; }
.tl-img { width: 100%; height: 58px; background: var(--navy); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
.tl-img img { width: 100%; height: 100%; object-fit: cover; }
.tl-placeholder { color: var(--gold); font-size: 11px; opacity: 0.5; letter-spacing: 1px; }
.tl-meta { display: flex; justify-content: space-between; padding: 3px 8px 0; font-size: 10px; cursor: pointer; }
.tl-type { color: var(--gold-dark); font-weight: 600; letter-spacing: 0.5px; }
.tl-insert {
  flex-shrink: 0; width: 22px; height: 60px; border-radius: 4px;
  background: var(--bg-100); border: 1px dashed var(--gold);
  color: var(--gold); display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; align-self: center;
}
.tl-insert:hover { border-color: var(--gold-dark); color: var(--gold-dark); background: var(--gold-light); }
.tl-insert-end { height: 130px; }
.tl-card-end { cursor: pointer; opacity: 0.5; flex-shrink: 0; width: 112px; }
.tl-card-end:hover { opacity: 1; border-color: var(--gold); }
.tl-img-add { cursor: pointer !important; }
.tl-add-icon { font-size: 32px; color: var(--gold); line-height: 1; opacity: 0.4; }
.tl-card-end:hover .tl-add-icon { opacity: 1; color: var(--gold-dark); }
.tl-meta-end { padding: 3px 8px 0; font-size: 10px; text-align: center; }
.tl-actions-end { display: flex; justify-content: center; align-items: center; padding: 4px 2px; border-top: 1px solid var(--bg-300); height: 26px; }
.tl-actions { display: flex; justify-content: center; gap: 3px; padding: 4px 2px; border-top: 1px solid var(--bg-300); height: 26px; align-items: center; }
.tl-btn {
  width: 20px; height: 20px; border-radius: 3px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 11px; color: var(--text-200); transition: all 0.15s; position: relative;
}
.tl-btn:hover { background: var(--gold); color: var(--navy); }
.tl-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.tl-btn-del:hover { background: #C44545; color: #fff; }

/* ===== RIGHT: Image/Video Panel ===== */
.sb-right {
  width: 250px; flex-shrink: 0; background: var(--bg-200);
  border-radius: 10px; border: 1px solid var(--gold);
  padding: 14px; overflow-y: auto;
  box-shadow: 0 4px 20px rgba(139,105,20,0.08);
}
.tab-switch { display: flex; margin-bottom: 14px; border-radius: 6px; overflow: hidden; border: 1px solid var(--gold); }
.tab-btn {
  flex: 1; text-align: center; padding: 8px 0; font-size: 12px; font-weight: 600;
  cursor: pointer; background: var(--bg-100); color: var(--text-200);
  letter-spacing: 1px; transition: all 0.25s;
}
.tab-btn.active { background: var(--navy); color: var(--gold); }
.right-section { margin-bottom: 16px; }
.right-section > label {
  display: block; font-size: 11px; font-weight: 700; color: var(--text-100);
  margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;
}
.char-count { font-size: 10px; color: var(--text-200); }
.ref-chars { display: flex; flex-wrap: wrap; gap: 5px; }
.ref-chip {
  padding: 4px 10px; border-radius: 4px; background: var(--bg-100);
  font-size: 11px; cursor: pointer; border: 1px solid var(--bg-300);
  color: var(--text-200); transition: all 0.2s;
}
.ref-chip:hover { border-color: var(--gold); }
.ref-chip.active { background: var(--navy); border-color: var(--gold); color: var(--gold) !important; }
.ref-chip.has-img { border-color: var(--gold); }
.ref-chip:not(.has-img) { opacity: 0.6; }
.mat-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.mat-item {
  width: 54px; height: 54px; border-radius: 6px; overflow: hidden; cursor: pointer;
  position: relative; background: var(--navy); border: 1px solid var(--bg-300);
}
.mat-item:hover { border-color: var(--gold); }
.mat-item img { width: 100%; height: 100%; object-fit: cover; }
.mat-num { position: absolute; bottom: 1px; right: 2px; font-size: 9px; color: var(--gold); background: rgba(26,26,46,0.8); padding: 0 4px; border-radius: 2px; }
.mat-ver { position: absolute; top: 2px; left: 2px; font-size: 9px; color: var(--gold); background: rgba(26,26,46,0.8); padding: 0 3px; border-radius: 2px; }
.mat-set { position: absolute; top: 2px; right: 2px; font-size: 12px; color: var(--gold); cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.mat-item:hover .mat-set { opacity: 1; }
.mat-active { border-color: var(--gold) !important; box-shadow: 0 0 0 2px rgba(201,168,76,0.3); }
.mat-video-preview { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.mat-play-icon { font-size: 16px; color: var(--gold); }
.mat-type { position: absolute; bottom: 1px; left: 2px; font-size: 10px; }
.ref-imgs { display: flex; flex-wrap: wrap; gap: 6px; }
.ref-img-item { width: 54px; height: 54px; border-radius: 6px; overflow: hidden; position: relative; background: var(--bg-100); border: 1px solid var(--bg-300); }
.ref-img-item img { width: 100%; height: 100%; object-fit: cover; }
.ref-img-del { position: absolute; top: 0; right: 0; width: 16px; height: 16px; background: var(--accent-100); color: var(--navy); font-size: 11px; line-height: 16px; text-align: center; cursor: pointer; font-weight: 700; }
.ref-upload-btn { width: 54px; height: 54px; border-radius: 6px; border: 1px dashed var(--gold); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--gold); cursor: pointer; transition: all 0.2s; }
.ref-upload-btn:hover { border-color: var(--gold-dark); color: var(--gold-dark); background: var(--gold-light); }

/* 图片查看器 */
.img-viewer-toolbar { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px; background: var(--navy); border-radius: 8px 8px 0 0; }
.img-scale-text { color: var(--gold); font-size: 14px; font-weight: 700; min-width: 50px; text-align: center; }
.img-viewer-body { display: flex; align-items: center; justify-content: center; min-height: 400px; background: #111; overflow: hidden; cursor: zoom-in; }
.img-viewer-body img { max-width: 100%; max-height: 70vh; object-fit: contain; }

.sg-project-pills { display: flex; gap: 8px; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--bg-300) transparent; padding-bottom: 4px; }
.sg-pill { font-size: 13px; padding: 6px 16px; border-radius: 18px; cursor: pointer; background: var(--bg-200); border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500; white-space: nowrap; transition: all 0.15s; user-select: none; }
.sg-pill:hover { border-color: var(--gold); color: var(--text-100); }
.sg-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }
.sg-project-pills::-webkit-scrollbar { height: 4px; }
.sg-project-pills::-webkit-scrollbar-thumb { background: var(--bg-300); border-radius: 2px; }
@media (max-width: 768px) {
  .sb-body { gap: 8px; }
  .sb-left, .sb-right { max-height: 200px; }
  .tl-track-row { flex-wrap: wrap; gap: 4px; }
}
</style>
