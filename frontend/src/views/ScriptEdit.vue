<template>
  <div class="script-edit-root">
    <!-- 移动端 Tab 导航 -->
    <div class="mobile-tabs" v-if="currentProjectId && screenWidth < 768">
      <div :class="['mtab', { active: mobileTab === 'episodes' }]" @click="mobileTab = 'episodes'">📋 剧集</div>
      <div :class="['mtab', { active: mobileTab === 'scenes' }]" @click="mobileTab = 'scenes'">🎬 分镜</div>
      <div :class="['mtab', { active: mobileTab === 'settings' }]" @click="mobileTab = 'settings'">🎥 设定</div>
    </div>

    <div class="three-column" v-if="currentProjectId">
      <!-- 移动端才显示左侧剧集面板 -->
      <div class="left-panel" v-if="screenWidth < 768" v-show="mobileTab === 'episodes'">
 <div class="panel-title"><span>剧集列表</span><span class="panel-actions"><el-button size="small" text @click="addEpisode" title="新建剧集">+</el-button><el-button size="small" text @click="duplicateEpisode" :disabled="!currentScriptId" title="复制当前集">⧉</el-button></span></div>
 <div class="episode-list"><div v-for="ep in scripts" :key="ep._id" :class="['ep-item',{active:currentScriptId===ep._id}]" @click="switchEpisode(ep._id)"><span class="ep-num">第 {{ ep.episodeNumber }} 集</span><span class="ep-title">{{ ep.episodeTitle||'未命名剧集' }}</span></div></div>
      </div>
      <div class="center-panel" v-if="currentScript && (screenWidth >= 768 || mobileTab === 'scenes')">
 <div class="ep-header">
   <el-input v-model="currentScript.episodeTitle" placeholder="给这集起个名字..." size="default" class="title-input" @change="markDirty" />
   <el-tooltip content="AI 分析剧本后智能补全空白字段，不覆盖已有数据，支持撤消/重做" placement="bottom">
     <el-button size="small" plain @click="handleAutoStoryboard" :loading="autoStoryboarding">
<MagicWand v-if="!autoStoryboarding" size="14" fill="currentColor" style="margin-right:3px;vertical-align:text-bottom"/> AI 智能补全
     </el-button>
   </el-tooltip>
   <el-button-group v-if="historyStack.length>0" size="small">
     <el-button :disabled="historyIndex<=0" @click="undoHistory" title="回退"><Undo size="13" fill="currentColor"/></el-button>
     <el-button :disabled="historyIndex>=historyStack.length-1" @click="redoHistory" title="前进"><Redo size="13" fill="currentColor"/></el-button>
   </el-button-group>
   <span v-if="historyStack.length>0" style="font-size:10px;color:var(--text-200)">{{ historyIndex+1 }}/{{ historyStack.length }}</span>
   <el-button size="small" plain type="success" @click="syncToStoryboard" :loading="syncing">
     <Send size="13" fill="currentColor" style="margin-right:3px;vertical-align:text-bottom"/> 同步至故事板
   </el-button>
   <el-button size="small" plain @click="showExportDialog = true">
     <Download size="13" fill="currentColor" style="margin-right:3px;vertical-align:text-bottom"/> 导出
   </el-button>
   <span class="scene-count">{{ currentScript.scenes?.length||0 }} 个镜头</span>
 </div>
 <div class="scenes-area">
   <div v-for="(scene,si) in currentScript.scenes" :key="si" :class="['scene-card',{'shot-invalid':!scene.sceneDescription},{'shot-amended': amendedFields[si] && Object.keys(amendedFields[si]||{}).length>0}]">
     <div class="scene-top-row"><span class="scene-num"><Film size="14" fill="#C9A84C"/> 镜号 {{ scene.sceneNumber }}</span><el-button size="small" type="danger" text @click="removeScene(si)">移除此镜</el-button></div>
     <div class="scene-meta-row">
<div class="meta-item"><label><Local size="12" fill="var(--text-200)"/> 场景</label><el-input v-model="scene.location" size="small" placeholder="如：咖啡厅、街道..." @change="markDirty" /></div>
<div class="meta-item"><label><Time size="12" fill="var(--text-200)"/> 时间</label><el-select v-model="scene.timeOfDay" size="small" @change="markDirty"><el-option v-for="t in timeOptions" :key="t" :label="t" :value="t" /></el-select></div>
<div class="meta-item"><label><Camera size="12" fill="var(--text-200)"/> 景别</label><el-select v-model="scene.shotType" size="small" @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.shotType }"><el-option v-for="t in shotTypes" :key="t" :label="t" :value="t" /></el-select></div>
<div class="meta-item"><label><Edit size="12" fill="var(--text-200)"/> 构图</label><el-input v-model="scene.composition" size="small" placeholder="如：三分法、对角线..." @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.composition }" /></div>
     </div>
     <div class="scene-meta-row">
<div class="meta-item"><label><PlayTwo size="12" fill="var(--text-200)"/> 运镜</label><el-select v-model="scene.cameraMovement" size="small" @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.cameraMovement }"><el-option v-for="t in cameraMoves" :key="t" :label="t" :value="t" /></el-select></div>
<div class="meta-item"><label><PictureOne size="12" fill="var(--text-200)"/> 视角</label><el-select v-model="scene.cameraAngle" size="small" @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.cameraAngle }"><el-option v-for="t in cameraAngles" :key="t" :label="t" :value="t" /></el-select></div>
<div class="meta-item"><label><Light size="12" fill="var(--text-200)"/> 光影</label><el-input v-model="scene.lighting" size="small" placeholder="如：柔光、逆光..." @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.lighting }" /></div>
<div class="meta-item"><label><Help size="12" fill="var(--text-200)"/> 音效</label><el-input v-model="scene.soundEffect" size="small" placeholder="如：雨声、脚步声..." @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.soundEffect }" /></div>
<div class="meta-item"><label><Time size="12" fill="var(--text-200)"/> 时长</label><el-input-number v-model="scene.duration" :min="1" :max="60" size="small" @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.duration }" /></div>
     </div>
     <div class="scene-meta-row">
<div class="meta-item" style="flex:1"><label><User size="12" fill="var(--text-200)"/> 人物</label><el-input v-model="charactersStr[si]" size="small" placeholder="角色名，逗号分隔" @change="onCharsChange(si)" /></div>
<div class="meta-item" style="flex:1"><label><SunOne size="12" fill="var(--text-200)"/> 氛围</label><el-input v-model="scene.atmosphere" size="small" placeholder="如：温馨、紧张..." @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.atmosphere }" /></div>
<div class="meta-item" style="flex:1"><label><LinkOne size="12" fill="var(--text-200)"/> 绑定主体</label><el-select v-model="scene.boundSubjects" size="small" multiple filterable placeholder="选择关联的角色或场景" @change="markDirty"><el-option v-for="a in allAssets" :key="a._id" :label="a.name||a.sceneName||a.propName" :value="a._id" /></el-select></div>
     </div>
     <div class="scene-desc-row"><label>分镜描述 ✍️ <span style="font-size:10px;color:var(--text-200);font-weight:400">（只写画面内容，不用写运镜/景别，那些有专门参数）</span></label><el-input v-model="scene.sceneDescription" type="textarea" :rows="3" placeholder="写清4要素：①谁在画面 ②做什么动作 ③什么环境 ④什么情绪。运镜/景别/光影用上方参数设置，不要写进描述里。例：林晓站在落地窗前，夕阳勾勒出轮廓，办公室空无一人，她低头看手机嘴角微扬" @change="markDirty" :class="{ 'field-amended': amendedFields[si]?.sceneDescription }" /></div>
     <div class="dialogues-block">
<div class="dr-table">
  <div class="dr-thead">
    <span class="dr-th dr-th-role">角色</span>
    <span class="dr-th dr-th-text">对话内容</span>
    <span class="dr-th dr-th-action">动作/表情</span>
    <span class="dr-th dr-th-camera">镜头提示</span>
    <span class="dr-th dr-th-inner">内心独白</span>
    <span class="dr-th dr-th-op"></span>
  </div>
  <div v-for="(d,di) in scene.dialogues" :key="di" class="dr-tr">
    <div class="dr-td dr-td-role"><el-input v-model="d.characterName" size="small" placeholder="角色" @change="markDirty" /></div>
    <div class="dr-td dr-td-text"><el-input v-model="d.text" size="small" placeholder="对话内容" @change="markDirty" /></div>
    <div class="dr-td dr-td-action"><el-input v-model="d.actionHint" size="small" placeholder="动作/表情" @change="markDirty" /></div>
    <div class="dr-td dr-td-camera"><el-input v-model="d.cameraHint" size="small" placeholder="镜头提示" @change="markDirty" /></div>
    <div class="dr-td dr-td-inner"><el-input v-model="d.innerThought" size="small" placeholder="内心独白" @change="markDirty" /></div>
    <div class="dr-td dr-td-op"><el-button size="small" text type="danger" @click="removeDialogue(scene,di)">×</el-button></div>
  </div>
</div>
<el-button size="small" text type="primary" @click="addDialogue(scene)" style="margin-top:4px">+ 加句台词</el-button>
<div class="scene-notes-row" style="margin-top:6px">
  <el-input v-model="scene.notes" size="small" placeholder="备注（环境音/BGM/转场）" @change="markDirty" />
</div>
     </div>
   </div>
 </div>
 <el-button style="margin-top:12px;width:100%" @click="addScene" dashed>+ 添加新镜头</el-button>
      </div>
      <div class="center-panel center-empty" v-if="!currentScript && scripts.length===0 && (screenWidth >= 768 || mobileTab === 'scenes')"><el-empty description="点击上方剧集「新建」创建第一集 ✨" /></div>
      <div class="center-panel center-empty" v-if="!currentScript && scripts.length>0 && (screenWidth >= 768 || mobileTab === 'scenes')"><el-empty description="点击上方剧集，开始编辑 ✍️" /></div>
      <div class="right-panel" :class="{ collapsed: rightCollapsed }" v-show="screenWidth >= 768 || mobileTab === 'settings'">
 <div class="panel-title" @click="rightCollapsed = !rightCollapsed" style="cursor:pointer;user-select:none">
   <Config size="16" fill="var(--gold)" style="vertical-align:text-bottom;margin-right:4px"/>
   <span>导演设定</span>
   <span class="collapse-toggle">{{ rightCollapsed ? '◀ 展开' : '▶ 收起' }}</span>
 </div>
 <div class="right-panel-body" v-show="!rightCollapsed">
 <div class="setting-group"><label><Video size="12" fill="var(--text-200)"/> 画面比例</label><el-radio-group v-model="videoConfig.aspectRatio" size="small" @change="onVideoConfigChange"><el-radio-button value="16:9">16:9</el-radio-button><el-radio-button value="9:16">9:16</el-radio-button><el-radio-button value="4:3">4:3</el-radio-button><el-radio-button value="3:4">3:4</el-radio-button></el-radio-group></div>
 <div class="setting-group"><label><MagicWand size="12" fill="var(--text-200)"/> 风格参考 <span style="font-size:10px;color:var(--text-200);font-weight:400">（选后自动配置导演设定）</span></label><el-radio-group v-model="videoConfig.visualStyle" size="small" @change="onStyleChange"><el-radio-button value="写实">写实</el-radio-button><el-radio-button value="动漫">动漫</el-radio-button></el-radio-group></div>
 <div class="setting-group" v-if="videoConfig.visualStyle"><label><Edit size="12" fill="var(--text-200)"/> 风格细分</label><div class="sub-style-grid"><div v-for="s in currentSubStyles" :key="s" :class="['sub-style-item',{active:videoConfig.subStyle===s}]" @click="selectSubStyle(s)">{{ s }}</div></div></div>
 <div class="setting-group" v-if="directorForm.qualityKeywords">
   <div class="director-preset-badge">
     <Light size="12" fill="var(--gold)"/> 已加载预设：
     <span class="dpb-value">{{ videoConfig.subStyle || videoConfig.visualStyle }}</span>
     <el-button size="small" type="warning" link @click="openDirectorDialog">查看/微调</el-button>
   </div>
 </div>
 <div class="setting-group">
   <el-tooltip content="从剧本中自动识别角色、场景、道具，一键创建到演员库方便后续生图时参考" placement="left">
     <el-button size="small" style="width:100%" @click="handleExtractSubjects" :disabled="!currentScriptId"><User size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 提取主体</el-button>
   </el-tooltip>
 </div>
 <div class="setting-group">
   <el-button size="small" type="warning" style="width:100%" @click="openDirectorDialog" :disabled="!currentProjectId"><Config size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 导演全局设定</el-button>
 </div>
 </div><!-- end right-panel-body -->
      </div>
    </div>
    <el-empty v-if="!currentProjectId" description="请先在上方选择一个片场 🎬" style="margin-top:80px" />
    <el-dialog v-model="showDirectorDialog" title="导演全局设定 🎬" :width="screenWidth < 768 ? '94%' : '650px'" destroy-on-close>
      <div class="director-body"><div class="director-intro"><Light size="14" fill="var(--navy)"/> 这些设定会注入到每一镜的图片和视频提示词中，直接影响生成画面的质感和风格。</div><div class="director-field"><div class="director-field-label"><Edit size="13" fill="var(--gold)"/> 画质质感</div><el-input v-model="directorForm.qualityKeywords" type="textarea" :rows="2" placeholder="例：8K, 超写实, 电影级摄影, 高细节, HDR, 胶片颗粒感" /><div class="director-field-hint">控制画质分辨率、摄影风格、细节层次。</div></div><div class="director-field"><div class="director-field-label"><SunOne size="13" fill="var(--gold)"/> 氛围光影</div><el-input v-model="directorForm.atmosphereLighting" placeholder="例：冷峻光影，低饱和，侧光突出轮廓，阴影浓郁" /><div class="director-field-hint">控制灯光方向、色调、明暗对比。</div></div><div class="director-field"><div class="director-field-label"><MagicWand size="13" fill="var(--gold)"/> 画风指令</div><el-input v-model="directorForm.artStyleCommands" type="textarea" :rows="3" placeholder="例：写实风, 胶片颗粒, 低饱和调色, 浅景深, 柔焦高光" /><div class="director-field-hint">控制整体美术风格、后期调色、特效倾向。</div></div><div class="director-preview" v-if="directorForm.qualityKeywords"><div class="director-preview-title"><PreviewOpen size="14" fill="var(--navy)"/> 注入效果预览</div><code class="director-preview-code">【画质/构图】竖屏9:16，{场景}，{氛围光影}，{画质}，{风格}，{景别}，{视角}视角，{构图}，焦点清晰，背景虚化</code></div></div>
 
 
 
  
      <div class="ai-hint"><el-alert type="info" :closable="false" show-icon><template #title>AI 会读懂你的设定，自动优化后应用到全剧所有镜头 ✨</template></el-alert></div>
      <template #footer><el-button @click="showDirectorDialog=false">取消</el-button><el-button type="primary" @click="handleAIUnderstand" :loading="aiUnderstanding"><MagicWand size="14" fill="currentColor" style="margin-right:4px"/> AI 理解并润色</el-button><el-button type="success" @click="handleApplyDirectorSettings"><Send size="14" fill="currentColor" style="margin-right:4px"/> 应用到全剧</el-button></template>
    </el-dialog>
    <el-dialog v-model="showExtractDialog" title="提取结果 👥" :width="screenWidth < 768 ? '94%' : '650px'" destroy-on-close>
      <div v-if="extracting" class="extract-loading">
        <div class="extract-spinner"><span class="extract-dot"></span><span class="extract-dot"></span><span class="extract-dot"></span></div>
        <p class="extract-loading-text">AI 正在识别剧本中的角色、场景、道具...</p>
        <div class="extract-skeleton">
          <div class="extract-sk-item" v-for="i in 3" :key="i">
            <div class="extract-sk-bar"></div>
            <div class="extract-sk-tags"><span class="extract-sk-tag"></span><span class="extract-sk-tag"></span><span class="extract-sk-tag w2"></span></div>
          </div>
        </div>
      </div>
      <div v-else-if="extractResult">
 <el-divider content-position="left"><strong>角色 ({{extractResult.characters?.length||0}})</strong></el-divider>
 <div v-if="extractResult.characters?.length" class="extract-tags"><el-tag v-for="c in extractResult.characters" :key="c.name" :type="c.existed?'info':'success'" size="default" style="margin:4px">{{c.name}}{{c.existed?'(已存在)':' ✓ 新建'}}</el-tag></div>
 <el-divider content-position="left"><strong>场景 ({{extractResult.scenes?.length||0}})</strong></el-divider>
 <div v-if="extractResult.scenes?.length" class="extract-tags"><el-tag v-for="s in extractResult.scenes" :key="s.sceneName" :type="s.existed?'info':''" size="default" style="margin:4px">{{s.sceneName}}{{s.existed?'(已存在)':' ✓ 新建'}}</el-tag></div>
 <el-divider content-position="left"><strong>道具 ({{extractResult.props?.length||0}})</strong></el-divider>
 <div v-if="extractResult.props?.length" class="extract-tags"><el-tag v-for="p in extractResult.props" :key="p.propName" :type="p.existed?'info':'warning'" size="default" style="margin:4px">{{p.propName}}{{p.existed?'(已存在)':' ✓ 新建'}}</el-tag></div>
 <el-alert type="success" style="margin-top:16px" :closable="false"><template #title>提取完成！已自动添加到「主体管理」页面 ✅</template></el-alert>
      </div>
      <template #footer><el-button @click="showExtractDialog=false">知道啦</el-button><el-button type="primary" @click="goToAssets">去主体管理看看</el-button></template>
    </el-dialog>
    <!-- AI 补全回退确认 -->
    <el-dialog v-model="showStoryboardDiff" title="回退确认" :width="screenWidth < 768 ? '94%' : '420px'" destroy-on-close>
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom:14px">
 <template #title>确认回退到 AI 补全前的版本？回退将恢复所有字段的原始值。</template>
      </el-alert>
      <template #footer>
 <el-button @click="showStoryboardDiff = false">取消</el-button>
 <el-button @click="undoHistory(); showStoryboardDiff = false" type="warning">确认回退</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="showExportDialog" :width="screenWidth < 768 ? '94%' : '520px'" destroy-on-close class="export-dialog">
      <template #header>
 <div style="display:flex;align-items:center;gap:8px">
   <Download size="20" fill="var(--gold)"/>
   <span style="font-size:17px;font-weight:700;color:var(--text-100)">导出分镜</span>
 </div>
      </template>
      <div class="export-body">
 <div class="export-section">
   <div class="export-section-title"><Film size="14" fill="var(--navy)"/> 选择剧集</div>
   <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="全部剧集（不选=导出全部）"><el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" /></el-select>
   <div style="display:flex;gap:8px;margin-top:6px"><el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">全选</el-button><el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">当前集</el-button><el-button size="small" link @click="exportEpisodes = []">清空</el-button></div>
 </div>
 <div class="export-section">
   <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 导出内容</div>
   <el-checkbox-group v-model="exportTypes"><el-checkbox value="script">剧本全文</el-checkbox><el-checkbox value="shots">分镜全文</el-checkbox><el-checkbox value="full_storyboard">故事板全文</el-checkbox></el-checkbox-group>
 </div>
 <div class="export-section">
   <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 导出格式</div>
   <div class="export-format-cards">
     <div v-for="f in formatOptions" :key="f.value" :class="['ef-card',{active:exportFormat===f.value}]" @click="exportFormat=f.value">
<div class="ef-card-icon" v-html="f.icon"></div>
<div class="ef-card-label">{{ f.label }}</div>
<div class="ef-card-hint">{{ f.hint }}</div>
     </div>
   </div>
 </div>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top:12px"><template #title>{{ formatHint }}</template></el-alert>
      <template #footer>
 <el-button @click="showExportDialog = false">取消</el-button>
 <el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0 || exportEpisodes.length === 0">
   <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 导出文件
 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref,reactive,computed,onMounted,onActivated,nextTick,watch, inject } from 'vue';
import { useRoute,useRouter } from 'vue-router';

const screenWidth = ref(window.innerWidth);
const mobileTab = ref('scenes');
const rightCollapsed = ref(false);
window.addEventListener('resize', () => { screenWidth.value = window.innerWidth; });
import { ElMessage,ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { useAssetStore } from '../stores/asset';
import { assetAPI,scriptAPI,storyboardAPI } from '../api';
import { buildShotsFromScenes } from '../components/promptBuilder';
import ProjectSwitcher from '../components/ProjectSwitcher.vue';

import { MagicWand, Send, Download, Undo, Redo, Add, Delete, Camera, Edit, Film, FolderOpen, PictureOne, PlayTwo, PlusCross, Help, Local, Time, User, SunOne, LinkOne, Light, Config, Video, PreviewOpen } from '@icon-park/vue-next';

const route=useRoute();const router=useRouter();
const resetToScriptGenerate = inject('resetToScriptGenerate', () => {});
const projectStore=useProjectStore();const scriptStore=useScriptStore();const assetStore=useAssetStore();
const episodeBar = inject('wsEpisodeBar', null);

const currentProjectId=inject('currentProjectId');const currentScriptId=ref('');const currentScript=ref(null);
const scripts=ref([]);const showDirectorDialog=ref(false);const showExtractDialog=ref(false);
const extractResult=ref(null);const extracting=ref(false);const aiUnderstanding=ref(false);
const dirty=ref(false);const timeOptions=['白天','夜晚','黄昏','傍晚','清晨','黎明','正午','深夜','雨天','雪天','不限'];
const shotTypes=['远景','全景','中景','近景','特写','大特写','微距'];
const cameraMoves=['固定','推镜','拉镜','平移','摇镜','跟镜','升降','希区柯克变焦','变速推近'];
const cameraAngles=['平视','俯拍','仰拍','顶拍','荷兰角'];
const charactersStr=ref([]);const autoStoryboarding=ref(false);const syncing=ref(false);
const allAssets=ref([]);const showStoryboardDiff=ref(false);const diffChanges=ref(0);const flowDoneAI=ref(false);const flowDoneExtract=ref(false);const flowDoneSync=ref(false);
// 历史栈：支持前进/后退双向回退，每项是 scenes+charsStr 的深拷贝
const historyStack=ref([]);
const historyIndex=ref(-1);
const amendedFields=ref({}); // { [sceneIdx]: Set of field names } — AI 补全过的字段用于高亮

function pushHistory(label='') {
  if(!currentScript.value)return;
  // 截断当前位置之后的历史（新操作覆盖旧redo）
  historyStack.value=historyStack.value.slice(0,historyIndex.value+1);
  historyStack.value.push({
    scenes:JSON.parse(JSON.stringify(currentScript.value.scenes)),
    charsStr:[...charactersStr.value],
    label,
    time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),
  });
  if(historyStack.value.length>30)historyStack.value.shift(); // 最多30步
  historyIndex.value=historyStack.value.length-1;
  diffChanges.value=historyStack.value.length;
  persistHistory();
}

function undoHistory(){
  if(historyIndex.value<=0)return;
  historyIndex.value--;
  applyHistory(historyStack.value[historyIndex.value]);
  persistHistory();
  showStoryboardDiff.value=false;
  ElMessage.success(`已回退 (${historyIndex.value+1}/${historyStack.value.length})`);
}

function redoHistory(){
  if(historyIndex.value>=historyStack.value.length-1)return;
  historyIndex.value++;
  applyHistory(historyStack.value[historyIndex.value]);
  persistHistory();
  ElMessage.success(`已前进 (${historyIndex.value+1}/${historyStack.value.length})`);
}

function applyHistory(item){
  currentScript.value.scenes=JSON.parse(JSON.stringify(item.scenes));
  charactersStr.value=[...item.charsStr];
  amendedFields.value={};
  markDirty();
}

const HISTORY_KEY = () => `se_hist_${currentProjectId.value}_${currentScriptId.value}`;
function persistHistory(){
  try {
    sessionStorage.setItem(HISTORY_KEY(), JSON.stringify({
      stack: historyStack.value.slice(0, historyIndex.value+1),
      index: historyIndex.value,
    }));
  } catch{}
}
function loadHistory(){
  historyStack.value=[]; historyIndex.value=-1; amendedFields.value={};
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY());
    if(raw){
      const parsed = JSON.parse(raw);
      historyStack.value = parsed.stack || [];
      historyIndex.value = parsed.index ?? -1;
    }
  } catch{}
}

const videoConfig=reactive({aspectRatio:'9:16',visualStyle:'写实',subStyle:''});
const directorForm=reactive({qualityKeywords:'8K, 超写实, 电影级摄影, 高细节, HDR',atmosphereLighting:'',artStyleCommands:''});
const realisticSubStyles=['邵氏风格','古风写实','古风明艳','古风唐朝','古风宋朝','古风明朝','古风清朝','真人写实','都市情感','玄幻修仙','历史战争','现代末日','悬疑恐怖','赛博朋克','未来科幻','纪实摄影','民国风格','乡土风格','职场商战','家庭伦理','医疗救援','80年代','律政法庭','北欧极简'];
const animeSubStyles=['二次元','国风动漫','日系动漫','水墨风','吉卜力风','韩式漫画','像素复古'];
const currentSubStyles=computed(()=>videoConfig.visualStyle==='动漫'?animeSubStyles:realisticSubStyles);

const directorPresets={
  '邵氏风格':{qualityKeywords:'4K, 电影级摄影, 浓艳胶片色, 柔和颗粒感',atmosphereLighting:'戏剧暖光，柔焦漫射，朦胧梦幻，高饱和暖色笼罩',artStyleCommands:'邵氏风格, 手绘棚景质感, 古典对称构图, 浓艳胶片调色, 假得高级艳得有韵味'},
  '古风写实':{qualityKeywords:'4K, 电影级摄影, 高细节, 古风质感',atmosphereLighting:'古典雅致，柔光漫射，暖金色调为主',artStyleCommands:'古风写实, 服饰考究, 场景古朴'},
  '古风明艳':{qualityKeywords:'8K, 高饱和, 电影级摄影, HDR',atmosphereLighting:'明艳华丽，强对比光影，富丽堂皇',artStyleCommands:'古风明艳, 色彩浓烈, 装饰繁复, 宫廷贵气'},
  '古风唐朝':{qualityKeywords:'8K, 电影级摄影, 高细节',atmosphereLighting:'盛唐气象，大气磅礴，暖金与朱红色调',artStyleCommands:'唐朝风格, 丰腴华美, 唐装襦裙'},
  '古风宋朝':{qualityKeywords:'4K, 电影级摄影, 精细纹理',atmosphereLighting:'宋韵雅致，清淡素雅，水墨般柔和光影',artStyleCommands:'宋朝风格, 清瘦雅致, 素色衣衫, 文人气息'},
  '古风明朝':{qualityKeywords:'8K, 电影级摄影, 高细节',atmosphereLighting:'明式典雅，庄重沉稳，深红与墨绿调',artStyleCommands:'明朝风格, 端庄大气, 明制汉服'},
  '古风清朝':{qualityKeywords:'8K, 电影级摄影, HDR',atmosphereLighting:'清宫华丽，珠光宝气，暖金色与宝蓝色调',artStyleCommands:'清朝风格, 旗装旗袍, 宫廷华贵'},
  '真人写实':{qualityKeywords:'8K, 超写实, 电影级摄影, 高细节, HDR',atmosphereLighting:'真实自然光，柔和阴影，电影级布光',artStyleCommands:'写实风, 电影颗粒感, 低饱和调色, 真实质感'},
  '都市情感':{qualityKeywords:'8K, 超写实, 电影级摄影, 高细节',atmosphereLighting:'现代都市自然光，暖色调，柔和影调',artStyleCommands:'现代都市, 时尚简约, 真实生活感, 清新色调'},
  '玄幻修仙':{qualityKeywords:'8K, 电影级摄影, HDR, 高细节',atmosphereLighting:'仙气缥缈，灵气环绕，冷暖光交织',artStyleCommands:'玄幻仙侠, 灵气特效, 仙风道骨, 飘逸出尘'},
  '历史战争':{qualityKeywords:'8K, 电影级摄影, 高细节',atmosphereLighting:'史诗般光影，烟尘弥漫，冷峻色调',artStyleCommands:'战争史诗, 铠甲兵器, 沙场肃杀, 冷色调'},
  '现代末日':{qualityKeywords:'8K, HDR, 电影级摄影',atmosphereLighting:'末日废土，灰暗压抑，局部高光',artStyleCommands:'末日废土, 破败城市, 灰暗色调, 生存感'},
  '悬疑恐怖':{qualityKeywords:'4K, 电影级摄影, 高对比',atmosphereLighting:'阴暗压抑，局部高光，冷蓝与暗绿色调',artStyleCommands:'悬疑恐怖, 暗黑氛围, 阴影质感, 紧张感'},
  '赛博朋克':{qualityKeywords:'8K, HDR, 超写实, 电影级摄影',atmosphereLighting:'霓虹灯光，蓝紫洋红色调，全息光影',artStyleCommands:'赛博朋克, 霓虹灯效, 机械义体, 未来都市'},
  '未来科幻':{qualityKeywords:'8K, HDR, 电影级摄影',atmosphereLighting:'冷峻科技感，蓝白光源，极简光影',artStyleCommands:'未来科幻, 科技质感, 太空美学, 冷色调'},
  '纪实摄影':{qualityKeywords:'4K, 纪实风格, 自然光',atmosphereLighting:'真实自然光，不加修饰，纪录片质感',artStyleCommands:'纪实摄影, 真实记录, 街头风格, 自然光影'},
  '民国风格':{qualityKeywords:'4K, 电影级摄影, 怀旧质感',atmosphereLighting:'民国风情，复古暖黄光，柔和朦胧',artStyleCommands:'民国风格, 旗袍中山装, 旧上海, 怀旧色调'},
  '乡土风格':{qualityKeywords:'4K, 纪实风格, 自然光',atmosphereLighting:'乡村自然光，朴实温暖，阳光通透',artStyleCommands:'乡土风格, 田园风光, 质朴自然, 温暖色调'},
  '职场商战':{qualityKeywords:'8K, 超写实, 电影级摄影',atmosphereLighting:'现代办公室灯光，冷白荧光，都市感',artStyleCommands:'职场商战, 现代办公, 商务精英, 冷峻专业'},
  '家庭伦理':{qualityKeywords:'4K, 纪实风格, 自然光',atmosphereLighting:'温馨家庭光，暖色调，柔和自然',artStyleCommands:'家庭伦理, 温馨生活, 真实质感, 暖色调'},
  '医疗救援':{qualityKeywords:'4K, 纪实风格, 高细节',atmosphereLighting:'医院冷白灯光，紧张氛围，高亮手术灯',artStyleCommands:'医疗救援, 医院场景, 专业严谨, 冷白色调'},
  '80年代':{qualityKeywords:'4K, 复古质感, 胶片颗粒',atmosphereLighting:'复古暖光，胶片质感，年代感光影',artStyleCommands:'80年代, 复古港风, 胶片质感, 怀旧色调'},
  '律政法庭':{qualityKeywords:'4K, 纪实风格, 高细节',atmosphereLighting:'法庭庄重光影，深木色调，严肃氛围',artStyleCommands:'律政法庭, 法庭场景, 庄重严肃, 深色调'},
  '北欧极简':{qualityKeywords:'4K, 极简风格, 自然光',atmosphereLighting:'北欧极简光影，大面积留白，柔和自然光',artStyleCommands:'北欧极简, 简约设计, 留白美学, 清新色调'},
  '二次元':{qualityKeywords:'8K, 赛璐珞风格, 日式动画质感',atmosphereLighting:'明亮通透，高饱和色彩，动画光影',artStyleCommands:'二次元, 赛璐珞风格, 日系动画, 明亮色彩, 清晰线条'},
  '国风动漫':{qualityKeywords:'4K, 国风动画质感, 赛璐珞风格, 手绘线条',atmosphereLighting:'明亮雅致，柔光散射，国风色彩搭配，适度留白',artStyleCommands:'国风动漫, 赛璐珞描线, 水墨晕染背景, 国风配色, 工笔细节, 动画光影'},
  '日系动漫':{qualityKeywords:'8K, 赛璐珞风格, 日式动画电影质感',atmosphereLighting:'清新明亮，柔和漫反射，新海诚式光影',artStyleCommands:'日系动漫, 赛璐珞风格, 新海诚式光影, 治愈系色调'},
  '水墨风':{qualityKeywords:'4K, 中国传统水墨画, 宣纸质感和水彩风格',atmosphereLighting:'墨色浓淡晕染，留白意境，虚实相生，散射柔光',artStyleCommands:'纯正水墨画风, 毛笔笔触, 浓淡干湿, 飞白皴擦, 气韵生动, 黑白为主点缀淡彩'},
  '吉卜力风':{qualityKeywords:'4K, 吉卜力手绘质感, 水彩背景, 温暖治愈',atmosphereLighting:'柔和自然光，草地蓝天，温暖治愈系光影',artStyleCommands:'吉卜力风格, 宫崎骏美学, 手绘水彩背景, 细腻人物, 自然田园, 温暖治愈'},
  '韩式漫画':{qualityKeywords:'8K, Webtoon数字绘画, 高饱和, 干净线条',atmosphereLighting:'清透高亮，柔光漫射，糖果色系',artStyleCommands:'韩式漫画, Webtoon风格, 精致线稿, 高饱和配色, 时尚造型, 清透感'},
  '像素复古':{qualityKeywords:'像素风, 8-bit/16-bit美学, 复古游戏质感',atmosphereLighting:'高对比，像素格阴影，霓虹边缘光',artStyleCommands:'像素艺术, 8-bit复古, 点阵渲染, 块面构成, 霓虹光效, 街机美学'},
  '写实':{qualityKeywords:'8K, 超写实, 电影级摄影, 高细节, HDR',atmosphereLighting:'根据剧情情感动态调整',artStyleCommands:'写实风, 电影颗粒感, 低饱和调色'},
  '动漫':{qualityKeywords:'8K, 赛璐珞风格, 动画电影质感',atmosphereLighting:'明亮通透，动画光影',artStyleCommands:'二次元, 赛璐珞风格, 清晰线条, 高饱和色彩'},
};


// 监听顶栏切片场
watch(currentProjectId, (n, o) => { if (n && n !== o) onProjectChange(n); });
onMounted(async()=>{
window.__triggerSave=handleSave;
  await projectStore.fetchProjects();
  const qProjectId=route.query.projectId;
  const qScriptId=route.query.scriptId;
  if(qProjectId){currentProjectId.value=qProjectId;onProjectChange(qProjectId, qScriptId)}
  else{const restored=await projectStore.restoreLastProject();if(restored){currentProjectId.value=restored._id;onProjectChange(restored._id)}}
});
// keep-alive 缓存激活时：同步从片场列表或剧本工坊带入的项目
onActivated(() => {
  const storeProject = projectStore.currentProject;
  const qProjectId = route.query.projectId;
  const qScriptId = route.query.scriptId;
  if (qProjectId && qProjectId !== currentProjectId.value) {
    currentProjectId.value = qProjectId;
    onProjectChange(qProjectId, qScriptId);
  } else if (storeProject && storeProject._id !== currentProjectId.value) {
    currentProjectId.value = storeProject._id;
    onProjectChange(storeProject._id);
  } else if (qScriptId && qScriptId !== currentScriptId.value && scripts.value.length > 0) {
    switchEpisode(qScriptId);
  }
});
// keep-alive 缓存后，每次进入页面重新拉取剧集列表
watch(() => route.path, (p) => {
  if (p === '/script-edit' && currentProjectId.value) {
    scriptStore.fetchScripts(currentProjectId.value).then(() => { scripts.value = [...scriptStore.scripts]; syncEpisodeBar(); });
  }
});

async function onProjectChange(val, targetScriptId){
  currentScriptId.value='';currentScript.value=null;
  if(!val)return;
  try{const project=await projectStore.fetchProject(val);if(project.videoConfig){videoConfig.aspectRatio=project.videoConfig.aspectRatio||'9:16';videoConfig.visualStyle=project.videoConfig.visualStyle||'写实';videoConfig.subStyle=project.videoConfig.subStyle||''}
    if(project.directorSettings){directorForm.qualityKeywords=project.directorSettings.qualityKeywords||directorForm.qualityKeywords;directorForm.atmosphereLighting=project.directorSettings.atmosphereLighting||'';directorForm.artStyleCommands=project.directorSettings.artStyleCommands||''}}catch(e){}
  scriptStore.fetchScripts(val).then(()=>{
    scripts.value=[...scriptStore.scripts];
    syncEpisodeBar();
    if(scripts.value.length>0){
      const target = targetScriptId ? scripts.value.find(s => s._id === targetScriptId) : null;
      switchEpisode(target ? target._id : scripts.value[0]._id);
    }
  });
  loadAllAssets(val);
}

async function loadAllAssets(pid){try{await assetStore.fetchCharacters(pid);await assetStore.fetchScenes(pid);await assetStore.fetchProps(pid);allAssets.value=[...assetStore.characters,...assetStore.scenes,...assetStore.props]}catch(e){}}

async function switchEpisode(scriptId){if(dirty.value)await handleSave();currentScriptId.value=scriptId;const s=await scriptStore.fetchScript(scriptId);currentScript.value=JSON.parse(JSON.stringify(s));charactersStr.value=(currentScript.value.scenes||[]).map(x=>(x.characters||[]).join(', '));dirty.value=false;loadHistory();syncEpisodeBar();}
function syncEpisodeBar(){if(!episodeBar)return;episodeBar.scripts=scripts.value;episodeBar.currentScriptId=currentScriptId.value;episodeBar.add=addEpisode;episodeBar.dup=duplicateEpisode;episodeBar.select=switchEpisode;}
async function addEpisode(){if(!currentProjectId.value)return;const maxNum=scripts.value.reduce((m,s)=>Math.max(m,s.episodeNumber),0);try{const res=await scriptAPI.createEmpty({projectId:currentProjectId.value,episodeNumber:maxNum+1,episodeTitle:''});await scriptStore.fetchScripts(currentProjectId.value);scripts.value=[...scriptStore.scripts];currentScriptId.value=res.data._id;await switchEpisode(res.data._id);ElMessage.success(`第${maxNum+1}集已创建 🎉`)}catch(e){ElMessage.error('哎呀，创建出错啦，再试一次哦')}}
async function duplicateEpisode(){if(!currentScript.value)return;const maxNum=scripts.value.reduce((m,s)=>Math.max(m,s.episodeNumber),0);try{const res=await scriptAPI.createEmpty({projectId:currentProjectId.value,episodeNumber:maxNum+1,episodeTitle:(currentScript.value.episodeTitle||'')+' (副本)',scenes:JSON.parse(JSON.stringify(currentScript.value.scenes||[]))});await scriptStore.fetchScripts(currentProjectId.value);scripts.value=[...scriptStore.scripts];const ns=scripts.value.find(s=>s._id===res.data._id);if(ns){currentScriptId.value=ns._id;await switchEpisode(ns._id)}ElMessage.success(`已复制为第${maxNum+1}集 📋`)}catch(e){ElMessage.error('复制失败')}}

function cleanEpTitle(ep){return(ep.episodeTitle||"").replace(/^第d+集[：:]*s*/,"").trim()}
let _lastAutoHistory=0;
function markDirty(){
  dirty.value=true;
  // 自动写历史（节流3秒，避免每次按键都push）
  const now=Date.now();
  if(now-_lastAutoHistory>3000){
    _lastAutoHistory=now;
    pushHistory('编辑');
  }
}
function onCharsChange(si){const names=charactersStr.value[si]?.split(/[,，、]/).map(s=>s.trim()).filter(Boolean)||[];currentScript.value.scenes[si].characters=names;markDirty()}
function addScene(){const maxNum=(currentScript.value.scenes||[]).reduce((m,s)=>Math.max(m,s.sceneNumber),0);currentScript.value.scenes.push({sceneNumber:maxNum+1,timeOfDay:'白天',location:'',shotType:'中景',cameraAngle:'平视',composition:'',cameraMovement:'固定',lighting:'',soundEffect:'',duration:4,characters:[],atmosphere:'',sceneDescription:'',dialogues:[],boundSubjects:[]});charactersStr.value.push('');pushHistory('添加镜头');markDirty()}
function removeScene(i){currentScript.value.scenes.splice(i,1);charactersStr.value.splice(i,1);pushHistory('删除镜头');markDirty()}
function addDialogue(scene){scene.dialogues.push({characterName:'',text:'',actionHint:'',innerThought:'',cameraHint:''});pushHistory('添加台词');markDirty()}
function removeDialogue(scene,i){scene.dialogues.splice(i,1);pushHistory('删除台词');markDirty()}

async function handleSave(){if(!currentScript.value)return;try{await scriptStore.updateScript(currentScript.value._id,{scenes:currentScript.value.scenes,episodeTitle:currentScript.value.episodeTitle});dirty.value=false;_lastAutoHistory=0;pushHistory('保存');ElMessage.success('内容已经稳稳保存好咯~')}catch(e){ElMessage.error('哎呀，保存出错啦，再试一次哦')}}

async function handleAutoStoryboard(){
  if(!currentProjectId.value||!currentScript.value)return;
  const scenes=currentScript.value.scenes;if(!scenes||scenes.length===0){ElMessage.warning('当前没有分镜哦，先添加一个镜头吧');return}
  autoStoryboarding.value=true;
  const token=localStorage.getItem('token');
  // 保存历史快照（补全前状态）
  pushHistory('补全前');
  try{
        ElMessage.info('AI 正在分析剧本，智能补全空白字段...');
    const startTime = Date.now();

    // 按每批3场分批调用LLM，每批独立请求+进度反馈
    const BATCH_SIZE = 3;
    const totalBatches = Math.ceil(scenes.length / BATCH_SIZE);
    const allAiShots = [];

    for (let b = 0; b < totalBatches; b++) {
      const startIdx = b * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, scenes.length);
      const batchLabel = `${startIdx + 1}-${endIdx}/${scenes.length}`;
      ElMessage.info(`AI 正在分析第 ${batchLabel} 镜... (${b + 1}/${totalBatches})`);
      const rawRes = await fetch('/api/v1/storyboards/auto-generate',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          scriptId:currentScriptId.value, projectId:currentProjectId.value,
          useAI:true, maxDuration:15,
          startScene: startIdx, sceneCount: endIdx - startIdx,
        })
      });
      if(!rawRes.ok){const errText=await rawRes.text();throw new Error(`第${batchLabel}镜失败: ${errText}`)}
      const batchData = await rawRes.json();
      allAiShots.push(...(batchData.data?.shots || []));
    }
    allAiShots.sort((a,b)=>(a.shotNumber||0)-(b.shotNumber||0));
    const aiShots = allAiShots;
    if(!aiShots.length)throw new Error('AI未生成有效分镜');


    // 角色名→assetId 映射表，用于自动绑定主体
    const charNameToId={};
    allAssets.value.forEach(a=>{if(a.name)charNameToId[a.name]=a._id;});

    const newAmended={};let totalAmended=0;
    scenes.forEach((s,i)=>{
      const ai=aiShots[i];
      if(!ai)return;
      newAmended[i]={};
      // 只在实际有变化时标记：旧值为空/默认值 且 AI返回了不同值
      const tryAmend = (oldVal, aiVal, defaultVal, field) => {
        const isEmpty = !oldVal || !String(oldVal).trim() || oldVal === defaultVal;
        const newVal = aiVal || defaultVal;
        if (isEmpty && String(newVal) !== String(oldVal || defaultVal)) {
          s[field] = newVal;
          newAmended[i][field] = true;
          totalAmended++;
          return true;
        }
        return false;
      };
      tryAmend(s.shotType, ai.shotType, '中景', 'shotType');
      tryAmend(s.cameraAngle, ai.cameraAngle, '平视', 'cameraAngle');
      tryAmend(s.composition, ai.composition, '', 'composition');
      tryAmend(s.cameraMovement, ai.cameraMovement, '固定', 'cameraMovement');
      tryAmend(s.lighting, ai.lighting, '', 'lighting');
      tryAmend(s.soundEffect, ai.soundEffect, '', 'soundEffect');
      tryAmend(s.atmosphere, ai.characterEmotion || ai.atmosphere, '', 'atmosphere');
      tryAmend(s.sceneDescription, ai._imagePrompt || ai.imageDescription || ai.sceneDescription, '', 'sceneDescription');
      if (Number(s.duration) <= 3 || !s.duration) {
        const aiDur = Number(ai.duration) || 5;
        if (aiDur !== (Number(s.duration) || 3)) { s.duration = aiDur; newAmended[i].duration = true; totalAmended++; }
      }
      // 兜底：AI未返回构图时，按景别推断
      if ((!s.composition || !s.composition.trim()) && !newAmended[i].composition) {
        const compMap = { '远景': '留白', '全景': '引导线', '中景': '三分法', '近景': '中心构图', '特写': '中心构图', '大特写': '中心构图', '微距': '中心构图' };
        s.composition = compMap[s.shotType] || '三分法';
        newAmended[i].composition = true; totalAmended++;
      }
      // 兜底：AI未返回视角时，按场景情绪推断
      if ((!s.cameraAngle || s.cameraAngle === '平视') && !newAmended[i].cameraAngle) {
        const txt = (s.sceneDescription || '') + (s.atmosphere || '');
        if (/对峙|冲突|吵架|压迫|恐惧|威胁|俯视/.test(txt)) { s.cameraAngle = '俯拍'; }
        else if (/仰望|崇拜|敬仰|高大|宏伟|天空|仰/.test(txt)) { s.cameraAngle = '仰拍'; }
        else { s.cameraAngle = '平视'; }
        newAmended[i].cameraAngle = true; totalAmended++;
      }
      // 自动绑定主体：匹配台词角色名 → assetId
      s.characters?.forEach(cName=>{
 const id=charNameToId[cName];
 if(id&&(!s.boundSubjects||!s.boundSubjects.includes(id))){
   if(!s.boundSubjects)s.boundSubjects=[];
   s.boundSubjects.push(id);
   newAmended[i].boundSubjects=true;totalAmended++;
 }
      });
      (s.dialogues||[]).forEach((d,j)=>{
 const aiDialogues=(ai._dialogues||[]);
 const aiD=aiDialogues[j]||(ai.dialogue?.text===d.text?ai.dialogue:null);
 if(!aiD)return;
 if((!d.actionHint||!d.actionHint.trim())&&aiD.actionHint){d.actionHint=aiD.actionHint;newAmended[i].dialogues=true;totalAmended++;}
 if((!d.cameraHint||!d.cameraHint.trim())&&aiD.cameraHint){d.cameraHint=aiD.cameraHint;newAmended[i].dialogues=true;totalAmended++;}
      });
    });

    
    amendedFields.value=newAmended;
    pushHistory('AI补全');
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const msg = [];
    if(totalAmended>0) msg.push(`补全 ${totalAmended} 处字段`);
    msg.push(`${totalBatches} 批 ${elapsed}s`);
    ElMessage.success(msg.length?`AI 补全完成：${msg.join('，')} | 可回退/前进`:'所有字段已完善');
    flowDoneAI.value=true;
  }catch(e){console.error(e);ElMessage.error('AI补全失败: '+(e.message||''));fallbackAutoStoryboard()}finally{autoStoryboarding.value=false}
}

function fallbackAutoStoryboard(){
  const scenes=currentScript.value.scenes;
  if(!scenes||!scenes.length)return;
  pushHistory('补全前');
  const rules={'特写':[/表情|眼神|泪|笑|吻|哭|怒|惊|细节|手|脸/],'全景':[/全景|环境|城市|天空|山|海|街道|建筑|远处/],'近景':[/对话|说|问|答|告诉|喊|叫/],'中景':[/走|跑|站|坐|躺|动作|拿|放|推/]};
  let localAmend=0;
  scenes.forEach(x=>{
    const t=(x.sceneDescription||'')+' '+(x.dialogues||[]).map(d=>d.text).join(' ');
    if(!x.shotType||x.shotType==='中景'){for(const[ty,ps]of Object.entries(rules)){if(ps.some(p=>p.test(t))){x.shotType=ty;localAmend++;break}}}
    if(!x.composition||!x.composition.trim()){x.composition='中心构图';localAmend++;}
    if(!x.duration||x.duration <= 6){const dialogs=x.dialogues||[];const totalChars=dialogs.reduce((a,d)=>a+(d.text||'').length,0);const count=dialogs.length;
      if(count===0)x.duration=Math.max(4,Math.min(6,Math.round(totalChars/10)+2));else if(count===1)x.duration=Math.max(5,Math.min(12,Math.round(totalChars/3)+3));else if(count<=3)x.duration=Math.max(8,Math.min(15,Math.round(totalChars/2)+4));else x.duration=Math.max(10,Math.min(15,Math.round(totalChars/2)+5));
      if(count<=1&&/(跑|追|打|冲|逃|摔|跳|飞|转)/.test(t))x.duration=Math.min(x.duration,6);if(/(哭|怒|吻|拥抱|转身|回头)/.test(t))x.duration=Math.max(x.duration,6);localAmend++;}
  });
  pushHistory('本地规则补全');
  markDirty();ElMessage.success(`本地规则补全 ${localAmend} 处空白（AI 暂不可用，可回退）`);
}

async function syncToStoryboard(){if(!currentProjectId.value||!currentScriptId.value||!currentScript.value)return;syncing.value=true;try{const scenes=currentScript.value.scenes;if(!scenes||scenes.length===0){ElMessage.warning('没有分镜可同步，请先添加镜头');syncing.value=false;return}const noSub=localStorage.getItem('ad_no_subtitles')==='true';const shots=buildShotsFromScenes(scenes, videoConfig, noSub, directorForm, allAssets.value);const rawRes=await fetch('/api/v1/storyboards/auto-generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({scriptId:currentScriptId.value,projectId:currentProjectId.value,batchShots:shots})});const data=await rawRes.json();ElMessage.success({message:`已同步 ${shots.length} 个分镜 → 请切换到「镜头板」查看`,duration:5000});flowDoneSync.value=true}catch(e){ElMessage.error('同步失败: '+(e.message||''))}finally{syncing.value=false}}

function selectSubStyle(s){videoConfig.subStyle=s;const preset=getStylePreset();if(preset){directorForm.qualityKeywords=preset.qualityKeywords;directorForm.atmosphereLighting=preset.atmosphereLighting;directorForm.artStyleCommands=preset.artStyleCommands}onVideoConfigChange();handleApplyDirectorSettings();}
function openDirectorDialog(){const preset=getStylePreset();if(preset&&!directorForm.atmosphereLighting&&!directorForm.artStyleCommands){directorForm.qualityKeywords=preset.qualityKeywords;directorForm.atmosphereLighting=preset.atmosphereLighting;directorForm.artStyleCommands=preset.artStyleCommands}showDirectorDialog.value=true;}
function getStylePreset(){if(videoConfig.subStyle&&directorPresets[videoConfig.subStyle])return directorPresets[videoConfig.subStyle];if(directorPresets[videoConfig.visualStyle])return directorPresets[videoConfig.visualStyle];return null;}
async function onVideoConfigChange(){if(!currentProjectId.value)return;dirty.value=true;try{await projectStore.updateProject(currentProjectId.value,{videoConfig:{...videoConfig}})}catch(e){}}
function onStyleChange(){videoConfig.subStyle='';const preset=directorPresets[videoConfig.visualStyle];if(preset){directorForm.qualityKeywords=preset.qualityKeywords;directorForm.atmosphereLighting=preset.atmosphereLighting;directorForm.artStyleCommands=preset.artStyleCommands}onVideoConfigChange();handleApplyDirectorSettings()}
async function handleExtractSubjects(){if(!currentScriptId.value||!currentProjectId.value)return;extracting.value=true;extractResult.value=null;showExtractDialog.value=true;try{const res=await assetAPI.extractAll(currentScriptId.value,currentProjectId.value);extractResult.value=res.data;flowDoneExtract.value=true}catch(e){ElMessage.error('提取失败，请确认已选择剧集')}finally{extracting.value=false}}
function goToAssets(){showExtractDialog.value=false;router.push({path:'/assets',query:{projectId:currentProjectId.value}})}
async function handleAIUnderstand(){
  if(!currentProjectId.value)return;
  aiUnderstanding.value=true;
  try{
    const systemPrompt='你是资深影视导演和AI绘图调参专家。根据风格关键词和当前剧本内容，输出优化后的导演设定。读懂剧本基调，给出精准匹配的画质、光影、画风建议。只返回JSON：{"qualityKeywords":"画质质感设定","atmosphereLighting":"氛围光影设定","artStyleCommands":"画风指令设定"}。每个字段用中文，不超过150字。';
    const userPrompt=`【剧本信息】
标题：${currentScript.value?.episodeTitle || '未设定'} 
摘要：${currentScript.value?.summary || '暂无'} 
当前风格：${videoConfig.subStyle||videoConfig.visualStyle||'写实'}

【当前导演设定】
画质质感：${directorForm.qualityKeywords}
当前画质质感：${directorForm.qualityKeywords}
氛围光影：${directorForm.atmosphereLighting||'无'}
当前画风指令：${directorForm.artStyleCommands||'无'}
请基于风格优化以上三项设定。`;
    const res=await fetch('/api/v1/assets/generate-prompt',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`},
      body:JSON.stringify({projectId:currentProjectId.value,assetId:currentProjectId.value,assetType:'director',existingPrompt:`${systemPrompt}\n\n${userPrompt}\n\n只输出JSON。`})
    });
    const data=await res.json();
    const raw=data.data?.prompt||'';
    const m=raw.match(/\{[\s\S]*\}/);
    if(m){
      const r=JSON.parse(m[0]);
      if(r.qualityKeywords)directorForm.qualityKeywords=r.qualityKeywords;
      if(r.atmosphereLighting)directorForm.atmosphereLighting=r.atmosphereLighting;
      if(r.artStyleCommands)directorForm.artStyleCommands=r.artStyleCommands;
    }
    ElMessage.success('AI 已润色导演设定 ✨');
  }catch(e){ElMessage.error('润色失败，请稍后重试')}
  finally{aiUnderstanding.value=false}
}
async function handleApplyDirectorSettings(){if(!currentProjectId.value)return;try{await projectStore.updateProject(currentProjectId.value,{videoConfig:{...videoConfig},directorSettings:{...directorForm,aiOptimized:true}});showDirectorDialog.value=false;ElMessage.success('导演设定已应用到全剧 ✅')}catch(e){ElMessage.error('应用失败')}}

// ===== 导出 =====
const showExportDialog = ref(false);
const exportTypes = ref(['script', 'shots']);
const exportFormat = ref('pdf');
const exportEpisodes = ref([]);
const formatHint = computed(() => {
  const m = { pdf: 'PDF：打开打印预览，浏览器「另存为 PDF」保存', markdown: 'Markdown：下载 .md 文件，可用 Typora/VS Code 打开', csv: 'Excel/CSV：下载 .csv 文件，用 Excel/WPS 打开编辑', word: 'Word：下载 .doc 文件，用 Word/WPS 打开编辑', json: 'JSON：下载 .json 文件，结构化数据，可程序化处理', html: 'HTML：下载 .html 文件，浏览器直接打开查看', png: 'PNG：将导出内容渲染为高清截图下载，多集全选时可能需几秒' };
  return m[exportFormat.value] || '';
});
const formatOptions = [
  { value:'pdf', label:'PDF', hint:'打印预览保存', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e74c3c"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zM16.5 13H15v-2h-1.5V7H15v2h1.5v1.5H15V13zM19 13h-1.5V7H19v6zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>' },
  { value:'markdown', label:'Markdown', hint:'Typora/VS Code', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#3498db"><path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19v-4.69l1.88 2.35 1.88-2.35v4.69h1.13V8.81h-1.13l-1.88 2.35-1.88-2.35H5.69v6.38h1.12zM15.73 15.19l2.62-3.19-2.62-3.19h1.51l1.87 2.31 1.87-2.31h1.51l-2.62 3.19 2.62 3.19h-1.51l-1.87-2.31-1.87 2.31h-1.51z"/></svg>' },
  { value:'csv', label:'CSV Excel', hint:'Excel/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#27ae60"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v-2H8v2zm0-4h2V8H8v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2z"/></svg>' },
  { value:'word', label:'Word', hint:'Word/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#2980b9"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2.5-4.5L10 13l1.5 2.5H13l-2-3 2-3h-1.5L10 11.5 8.5 9.5H7l2 3-2 3h1.5z"/></svg>' },
  { value:'json', label:'JSON', hint:'结构化数据', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#8e44ad"><path d="M5 3h2v2H5v5c0 1.1-.9 2-2 2v1c1.1 0 2 .9 2 2v5h2v2H5c-1.07 0-2-.94-2-2.03V17c0-1.1-.9-2-2-2v-1c1.1 0 2-.9 2-2V7c0-1.08.93-2 2-2zm14 0c1.07 0 2 .94 2 2.03V7c0 1.1.9 2 2 2v1c-1.1 0-2 .9-2 2v5.03c0 1.09-.93 2-2 2h-2v-2h2v-5c0-1.1.9-2 2-2V7c0-1.1-.9-2-2-2h-2V3h2z"/></svg>' },
  { value:'html', label:'HTML', hint:'浏览器打开', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e67e22"><path d="M12 18.177l-6.72-3.878-.9-8.12L12 2l7.62 4.179-.9 8.12L12 18.177zM4.86 6.556l.72 6.482L12 16.545l6.42-3.507.72-6.482L12 3.455 4.86 6.556zM11 13h2l-.3 3.5-1 .5-1-.5L11 13zm0-6h2l-.2 5H11.2L11 7z"/></svg>' },
  { value:'png', label:'PNG 图片', hint:'截图导出', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#16a085"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' },
];

function formatEpLabel(ep) {
  const title = (ep.episodeTitle || '').replace(/^第\d+集[：:]*\s*/, '').trim();
  return title ? `第${ep.episodeNumber}集：${title}` : `第${ep.episodeNumber}集`;
}

function openExport() {
  exportEpisodes.value = currentScriptId.value ? [currentScriptId.value] : scripts.value.map(e => e._id);
  showExportDialog.value = true;
}

async function handleExport() {
  if (exportTypes.value.length === 0) return;
  const fmt = exportFormat.value;
  showExportDialog.value = false;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/v1/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
 projectId: currentProjectId.value,
 episodeIds: exportEpisodes.value,
 types: exportTypes.value,
 format: fmt === 'png' ? 'html' : fmt,
      }),
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '导出失败'); return; }

    if (fmt === 'pdf') {
      const w = window.open('', '_blank');
      w.document.write(data.html || '');
      w.document.close();
      setTimeout(() => w.print(), 500);
    } else if (fmt === 'html') {
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (data.filename || 'export') + '.html';
      a.click(); URL.revokeObjectURL(url);
    } else if (fmt === 'png') {
      await exportAsPng(data.html, data.filename || 'export');
    } else if (fmt === 'csv' || fmt === 'markdown' || fmt === 'word' || fmt === 'json') {
      const ext = { markdown: 'md', csv: 'csv', word: 'doc', json: 'json' }[fmt] || 'txt';
      const blob = new Blob([data.content || ''], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (data.filename || 'export') + '.' + ext;
      a.click(); URL.revokeObjectURL(url);
    }
    ElMessage.success('备份文件已准备就绪~');
  } catch (e) { ElMessage.error('哎呀，导出出错啦，再试一次哦'); }
}

async function exportAsPng(html, filename) {
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:820px;height:0;border:0;';
  document.body.appendChild(iframe);
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  await new Promise(function(r) { setTimeout(r, 600); });
  try {
    var html2canvas = (await import('html2canvas')).default;
    var canvas = await html2canvas(doc.body, {
      scale: 2, useCORS: true, backgroundColor: '#FBF7F0',
      windowWidth: 820, windowHeight: doc.body.scrollHeight,
    });
    canvas.toBlob(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename + '.png';
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('PNG 导出完成');
    }, 'image/png');
  } catch (e) { ElMessage.error('PNG 截图失败'); }
  finally { document.body.removeChild(iframe); }
}
</script>
<style scoped>
.script-edit-root{display:flex;flex-direction:column;height:calc(100vh - 48px)}
.top-bar{display:flex;align-items:center;margin-bottom:12px;flex-shrink:0}
.word-count{margin-left:auto;color:var(--primary-200);font-size:14px;font-weight:bold;display:flex;align-items:center;gap:8px}
.three-column{display:flex;flex:1;gap:12px;overflow:hidden;min-height:0}
.left-panel{width:200px;flex-shrink:0;background:var(--bg-200);border-radius:8px;border:1px solid var(--bg-300);padding:12px;display:flex;flex-direction:column;overflow-y:auto}
.panel-title{display:flex;justify-content:space-between;align-items:center;color:var(--text-100);font-size:14px;font-weight:bold;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--bg-300)}
.panel-actions{display:flex;gap:2px}
.panel-actions .el-button{font-size:16px;padding:2px 6px;color:var(--text-200)}
.panel-actions .el-button:hover{color:var(--gold-dark)}
.episode-list{flex:1;overflow-y:auto}
.ep-item{padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:4px;display:flex;flex-direction:column;gap:2px}
.ep-item:hover{background:var(--bg-100)}
.ep-item.active{background:var(--primary-100)}
.ep-item.active .ep-title{color:var(--gold-light)}.ep-item.active .ep-num{color:var(--text-100)}
.ep-num{color:var(--primary-200);font-size:13px;font-weight:bold}
.ep-title{color:var(--text-100);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ep-actions{margin-top:10px;padding-top:10px;border-top:1px solid var(--bg-300)}
.center-panel{flex:1;background:var(--bg-200);border-radius:8px;border:1px solid var(--bg-300);padding:0 16px 16px;overflow-y:auto;min-width:0;scrollbar-width:thin;scrollbar-color:rgba(139,115,85,0.12) transparent}
.center-panel::-webkit-scrollbar{width:4px}
.center-panel::-webkit-scrollbar-track{background:transparent}
.center-panel::-webkit-scrollbar-thumb{background:rgba(139,115,85,0.10);border-radius:10px}
.center-panel::-webkit-scrollbar-thumb:hover{background:rgba(139,115,85,0.25)}
.center-empty{display:flex;align-items:center;justify-content:center}
.ep-header{display:flex;align-items:center;gap:6px;font-size:12px;position:sticky;top:0;z-index:20;background:var(--bg-200);padding:8px 0 10px;border-bottom:1px solid var(--bg-300);margin-bottom:4px}
.ep-header .el-button{font-size:11px}
.title-input{flex:1}
.scene-count{color:var(--text-200);font-size:11px;white-space:nowrap}
.scenes-area{display:flex;flex-direction:column;gap:12px}
.scene-card{background:var(--bg-200);border:1px solid var(--bg-300);border-radius:8px;padding:12px}
.shot-invalid{border-color:var(--accent-200);background:var(--bg-100)}
/* AI 补全高亮：柔和的琥珀色边框 + 左侧色条 */
.shot-amended{border-left:3px solid #e6a23c !important;background:linear-gradient(90deg,rgba(230,162,60,0.08) 0%,var(--bg-200) 12%)}
.shot-amended .scene-num::after{content:' ✨ AI已优化';font-size:10px;color:#e6a23c;font-weight:600}
/* 补全字段高亮 */
:deep(.field-amended .el-input__wrapper){background:rgba(230,162,60,0.10);box-shadow:0 0 0 1px rgba(230,162,60,0.4) inset}
:deep(.field-amended .el-select .el-input__wrapper){background:rgba(230,162,60,0.10);box-shadow:0 0 0 1px rgba(230,162,60,0.4) inset}
:deep(.field-amended .el-input-number .el-input__wrapper){background:rgba(230,162,60,0.10);box-shadow:0 0 0 1px rgba(230,162,60,0.4) inset}
.scene-top-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--bg-300)}
.scene-num{color:var(--text-100);font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px}
.scene-meta-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.meta-item{display:flex;flex-direction:column;gap:2px;min-width:100px}
.meta-item label{color:var(--text-100);font-size:11px}
.scene-desc-row{margin-bottom:8px}
.scene-desc-row label{color:var(--text-100);font-size:11px;display:block;margin-bottom:4px}
.dialogues-block{padding-left:8px}
.dr-table{display:flex;flex-direction:column;border:1px solid var(--bg-300);border-radius:8px;overflow:hidden}
.dr-thead{display:flex;background:var(--navy);color:var(--gold);font-size:12px;font-weight:700;padding:8px 10px;gap:6px}
.dr-th-role{width:90px;flex-shrink:0}
.dr-th-text{flex:1;min-width:0}
.dr-th-action{width:120px;flex-shrink:0}
.dr-th-camera{width:120px;flex-shrink:0}
.dr-th-inner{width:140px;flex-shrink:0}
.dr-th-op{width:30px;flex-shrink:0;text-align:center}
.dr-tr{display:flex;gap:6px;padding:6px 10px;border-bottom:1px solid var(--bg-300);align-items:center}
.dr-tr:last-child{border-bottom:none}
.dr-tr:nth-child(even){background:var(--bg-100)}
.dr-td-role{width:90px;flex-shrink:0}
.dr-td-text{flex:1;min-width:0}
.dr-td-action{width:120px;flex-shrink:0}
.dr-td-camera{width:120px;flex-shrink:0}
.dr-td-inner{width:140px;flex-shrink:0}
.dr-td-op{width:32px;flex-shrink:0;text-align:center}
.dr-td-op .el-button{width:24px;height:24px;padding:0;border-radius:50%;font-size:14px;color:#C44545;border:1px solid #C44545;display:inline-flex;align-items:center;justify-content:center}
.dr-td-op .el-button:hover{background:#C44545;color:#fff}
.right-panel{width:250px;flex-shrink:0;background:var(--bg-200);border-radius:8px;border:1px solid var(--bg-300);padding:12px;overflow-y:auto;transition:width 0.25s}
.right-panel.collapsed{width:40px;padding:12px 8px;overflow:hidden}
.right-panel.collapsed .right-panel-body{display:none}
.collapse-toggle{font-size:11px;color:var(--text-200);font-weight:400}
.panel-title:hover .collapse-toggle{color:var(--gold)}
.setting-group{margin-bottom:14px}
.setting-group>label{color:var(--text-200);font-size:12px;display:block;margin-bottom:4px;font-weight:bold}
.sub-style-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.sub-style-item{padding:5px 6px;border-radius:6px;font-size:11px;cursor:pointer;background:var(--bg-100);border:1px solid var(--bg-300);color:var(--text-200);transition:all 0.15s;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub-style-item:hover{border-color:var(--primary-200);color:var(--primary-200)}
.sub-style-item.active{background:var(--primary-100);border-color:var(--primary-200);color:var(--primary-200)}
.ai-hint{margin-top:12px}
.flow-guide{display:flex;align-items:center;gap:8px;padding:8px 14px;margin-bottom:12px;background:var(--accent-200);border-radius:8px;border:1px solid var(--accent-100);font-size:12px;color:var(--text-200);flex-wrap:wrap}
/* PC 端剧集列表（固定高度 + 上下滚动 + 底部渐变遮罩） */
.episode-row-wrap{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;flex-shrink:0}
.er-header{display:flex;align-items:center;gap:8px}
.er-label{font-size:12px;color:var(--text-200);font-weight:600}
.episode-row{
  position:relative; display:flex; flex-direction:row; flex-wrap:wrap; flex:1;
  gap:4px; padding:8px 12px; max-height:96px;
  background:var(--bg-200); border-radius:8px; border:1px solid var(--bg-300);
  overflow-y:auto; overflow-x:hidden; align-content:flex-start;
  scrollbar-width:thin; scrollbar-color:var(--gold) transparent;
  -webkit-mask-image:linear-gradient(to bottom,black 0%,black calc(100% - 20px),transparent 100%);
  mask-image:linear-gradient(to bottom,black 0%,black calc(100% - 20px),transparent 100%);
}
.episode-row::-webkit-scrollbar{width:4px}
.episode-row::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px}
.episode-row::-webkit-scrollbar-track{background:transparent}

.er-chip{padding:5px 12px;border-radius:14px;font-size:12px;cursor:pointer;background:var(--bg-100);border:1px solid var(--bg-300);color:var(--text-200);white-space:nowrap;transition:all 0.15s;flex-shrink:0;overflow:hidden;text-overflow:ellipsis}
.er-chip:hover{border-color:var(--gold);color:var(--text-100)}
.er-chip.active{background:var(--navy);border-color:var(--gold);color:var(--gold);font-weight:700}
.er-add{flex-shrink:0;font-size:12px;color:var(--gold-dark);white-space:nowrap}
.flow-step{padding:4px 10px;border-radius:12px;background:var(--bg-200);white-space:nowrap}
.flow-step.done{background:#E8F5E9;color:#2E7D32;font-weight:600}
.flow-arrow{color:var(--gold-dark);font-weight:700}
.extract-tags{display:flex;flex-wrap:wrap;min-height:32px}
/* 提取加载动画 */
.extract-loading{text-align:center;padding:32px 20px}
.extract-spinner{display:flex;justify-content:center;gap:10px;margin-bottom:20px}
.extract-dot{width:10px;height:10px;border-radius:50%;background:var(--gold);animation:extractBounce 1.4s ease-in-out infinite}
.extract-dot:nth-child(2){animation-delay:0.2s}
.extract-dot:nth-child(3){animation-delay:0.4s}
@keyframes extractBounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}
.extract-loading-text{font-size:14px;color:var(--text-100);font-weight:600;margin-bottom:24px}
.extract-skeleton{display:flex;flex-direction:column;gap:16px}
.extract-sk-item{display:flex;flex-direction:column;gap:10px;padding:14px 16px;background:var(--bg-200);border-radius:10px;border:1px solid var(--bg-300)}
.extract-sk-bar{height:14px;width:80px;border-radius:4px;background:linear-gradient(90deg,var(--bg-300) 25%,var(--bg-200) 50%,var(--bg-300) 75%);background-size:200% 100%;animation:extractShimmer 1.8s ease-in-out infinite}
.extract-sk-tags{display:flex;gap:8px}
.extract-sk-tag{height:28px;width:72px;border-radius:14px;background:linear-gradient(90deg,var(--bg-300) 25%,var(--bg-200) 50%,var(--bg-300) 75%);background-size:200% 100%;animation:extractShimmer 1.8s ease-in-out infinite}
.extract-sk-tag.w2{width:96px}
.extract-sk-tag:nth-child(2){animation-delay:0.15s}
.extract-sk-tag:nth-child(3){animation-delay:0.3s}
@keyframes extractShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.diff-item{animation:fadeIn 0.3s ease-out}
.diff-header{font-weight:700;color:var(--text-100);margin-bottom:8px;font-size:14px}
.diff-row{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;padding:4px 8px;background:var(--bg-200);border-radius:4px}
.diff-field{color:var(--text-200);min-width:50px;font-weight:600}
.diff-old{color:#999;text-decoration:line-through;min-width:60px}
.diff-arrow{color:var(--text-200)}
.diff-new{color:#67C23A;font-weight:600}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* 移动端 Tab 导航 */
.mobile-tabs { display: none; }
@media (max-width: 768px) {
  html, body { height: 100%; min-height: 100vh; }
  * { box-sizing: border-box; }
  .mobile-tabs { display: flex; gap: 0; margin-bottom: 10px; background: var(--bg-200); border-radius: 12px; padding: 4px; border: 1px solid var(--bg-300); flex-shrink: 0; }
  .mtab { flex: 1; text-align: center; padding: 0; border-radius: 10px; font-size: 0.875rem; font-weight: 600; color: var(--text-200); cursor: pointer; transition: all 0.15s; height: 48px; display: flex; align-items: center; justify-content: center; }
  .mtab.active { background: var(--navy); color: var(--gold); }
  .mtab:hover { color: var(--text-100); }

  /* 根容器 */
  .script-edit-root { max-width: 100vw; overflow-x: hidden; display: flex; flex-direction: column; height: 100vh; height: 100dvh; padding: 0; }

  /* 顶部栏：两行布局 */
  .top-bar { display: flex; flex-direction: column; gap: 8px; padding: 0 12px; flex-shrink: 0; }
  .top-bar   .top-bar .el-button { order: 1; width: 100%; min-height: 48px; font-size: 0.9375rem; font-weight: 700; margin-left: 0 !important; background: var(--navy) !important; border-color: var(--gold) !important; color: var(--gold) !important; border-radius: 10px; }
  .word-count { order: 3; width: 100%; margin-left: 0 !important; display: flex; align-items: center; gap: 10px; font-size: 0.8125rem; padding: 4px 0; }
  .word-count :deep(.el-progress) { flex: 1; }
  .word-count :deep(.el-progress-bar__outer) { height: 8px !important; }

  /* 流程引导：横向滑动 */
  .flow-guide { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 0; padding: 8px 12px; flex-shrink: 0; scrollbar-width: none; }
  .flow-guide::-webkit-scrollbar { display: none; }
  .flow-step { font-size: 0.6875rem; padding: 6px 12px; white-space: nowrap; border-radius: 20px; text-align: center; flex-shrink: 0; }
  .flow-step.done { background: rgba(46,125,50,0.15); color: #2E7D32; }
  .flow-step:not(.done) { background: var(--bg-100); }
  .flow-arrow { display: none; }

  /* 三列：撑满剩余高度，内部面板也填满 */
  .three-column { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0; overflow-y: visible; }

  /* 左/中/右面板：自动撑满父容器 */
  .left-panel { width: 100%; flex: 1; min-height: 0; padding: 12px 16px; }
  .left-panel :deep(.episode-list) { overflow-y: visible; }
  .left-panel :deep(.ep-item) { white-space: normal; padding: 10px 12px; font-size: 0.875rem; }
  .center-panel { width: 100%; min-width: 0; padding: 12px 16px; flex: 1; min-height: 0; }
  .right-panel { width: 100%; padding: 16px; flex: 1; min-height: 0; }
  .right-panel.collapsed { width: 100%; padding: 12px 16px; flex: none; }
  .right-panel .panel-title { font-size: 1rem; padding: 8px 0 12px; cursor: pointer; border-bottom: 1px solid var(--bg-300); margin-bottom: 14px; }
  .collapse-toggle { font-size: 0.75rem; }

  /* 设定组：紧凑间距 */
  .setting-group { margin-bottom: 10px; }
  .setting-group > label { font-size: 0.75rem; margin-bottom: 4px; display: block; font-weight: 600; }

  /* radio-button：一行两个均分，4 个时自动换行 */
  .setting-group :deep(.el-radio-group) { display: flex; flex-direction: row; flex-wrap: wrap; gap: 6px; width: 100%; }
  .setting-group :deep(.el-radio-button) { flex: 1; min-width: calc(50% - 6px); }
  .setting-group :deep(.el-radio-button__inner) { width: 100%; padding: 8px 6px; font-size: 0.8125rem; min-height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 8px !important; border: 1px solid var(--bg-300) !important; }

  /* 风格细分：3 列紧凑网格 */
  .sub-style-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .sub-style-item { padding: 6px 4px; font-size: 0.6875rem; display: flex; align-items: center; justify-content: center; border-radius: 6px; text-align: center; border: 1px solid var(--bg-300); min-height: 30px; }
  .sub-style-item.active { background: var(--navy); color: var(--gold); border-color: var(--gold); }

  /* 操作按钮 */
  .setting-group .el-button { width: 100% !important; font-size: 0.8125rem; min-height: 36px; }

  /* 面板标题紧凑 */
  .right-panel .panel-title { font-size: 0.9375rem; padding: 6px 0 10px; margin-bottom: 10px; }

  /* 剧集标题和按钮 */
  .ep-header { flex-wrap: wrap; gap: 8px; }
  .ep-header :deep(.title-input) { flex: 1 1 100%; }
  .ep-header .el-button { font-size: 0.8125rem; padding: 8px 12px; min-height: 44px; flex: 1; min-width: 0; }
  .ep-header .el-button + .el-button { margin-left: 0 !important; }
  .ep-header .scene-count { width: 100%; text-align: right; font-size: 0.75rem; }

  /* 分镜卡片 */
  .scene-meta-row { gap: 6px; }
  .meta-item { min-width: 45%; flex: 1 1 45%; }
  .meta-item .el-select,
  .meta-item .el-input,
  .meta-item .el-input-number { width: 100% !important; }

  /* 对话表格：移动端横向滚动 */
  .dr-table { overflow-x: auto; min-width: 600px; }

  /* 所有交互元素 ≥44px */
  :deep(.el-button) { min-height: 44px; }
  :deep(.el-input__wrapper) { min-height: 44px; }
  :deep(.el-select__wrapper) { min-height: 44px; }

  /* 消除底部空白 */
  .center-empty { padding: 40px 16px !important; }
}

/* ===== 导出对话框 ===== */
.export-dialog :deep(.el-dialog__header) { padding-bottom: 8px; border-bottom: 1px solid var(--bg-300); }
.export-body { display: flex; flex-direction: column; gap: 16px; }
.export-section { padding: 12px 16px; background: var(--bg-100); border-radius: 10px; border: 1px solid var(--bg-300); }
.export-section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-100); margin-bottom: 10px; }
.export-format-cards { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
@media (max-width: 600px) { .export-format-cards { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 400px) { .export-format-cards { grid-template-columns: repeat(3, 1fr); } }
.ef-card { display: flex; flex-direction: column; align-items: center; padding: 12px 6px 8px; border-radius: 10px; border: 2px solid var(--bg-300); cursor: pointer; transition: all 0.2s; background: var(--bg-200); }
.ef-card:hover { border-color: var(--navy); background: var(--bg-100); transform: translateY(-1px); }
.ef-card.active { border-color: var(--navy); background: rgba(26,35,50,0.05); box-shadow: 0 0 0 2px rgba(26,35,50,0.12); }
.ef-card-icon { margin-bottom: 6px; line-height: 1; }
.ef-card-label { font-size: 12px; font-weight: 700; color: var(--text-100); margin-bottom: 1px; }
.ef-card-hint { font-size: 10px; color: var(--text-200); }

/* ===== 字数统计进度条（脉冲效果）===== */
.word-count-bar { display: flex; align-items: center; gap: 10px; margin-left: 16px; min-width: 180px; }
.word-count-bar .wc-label { font-size: 14px; font-weight: 700; color: var(--text-100); white-space: nowrap; }
.wc-pulse { flex: 1; min-width: 80px; }
@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; filter: brightness(1.15); }
}
.wc-pulse :deep(.el-progress-bar__inner) { animation: pulse-bar 2s ease-in-out infinite; transition: width 0.6s ease; }
.wc-pulse :deep(.el-progress-bar__outer) { background: var(--bg-300); border-radius: 3px; }
/* ===== 导演设定面板 ===== */
.director-preset-badge { display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(230,162,60,0.08);border-radius:8px;border:1px solid rgba(230,162,60,0.2);font-size:12px;color:var(--text-100) }
.director-preset-badge .dpb-value { font-weight:700;color:var(--navy) }

/* ===== 导演全局设定弹窗 ===== */
.director-dialog :deep(.el-dialog__header) { padding-bottom:8px;border-bottom:1px solid var(--bg-300) }
.director-body { display:flex;flex-direction:column;gap:16px }
.director-intro { display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-200);padding:8px 12px;background:var(--bg-100);border-radius:8px;border:1px solid var(--bg-300) }
.director-field { padding:12px 14px;background:var(--bg-100);border-radius:10px;border:1px solid var(--bg-300) }
.director-field-label { display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--text-100);margin-bottom:8px }
.director-field-hint { margin-top:6px;font-size:11px;color:var(--text-200);line-height:1.5 }
.director-preview { padding:12px 14px;background:rgba(26,35,50,0.03);border-radius:10px;border:1px solid var(--navy);border-left:3px solid var(--navy) }
.director-preview-title { display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px }
.director-preview-code { display:block;font-size:12px;line-height:1.6;color:var(--text-100);background:var(--bg-200);padding:10px 12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,SFMono-Regular,monospace }
</style>