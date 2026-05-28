<template>
  <div class="script-edit-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <router-link to="/script-generate" class="bc-link">剧本工坊</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">分镜台本</span>
    </div>
    <div class="top-bar">
      <div class="sg-project-pills">
        <span v-for="p in projectStore.projects" :key="p._id" :class="['sg-pill', { active: currentProjectId === p._id }]" @click="currentProjectId = p._id; onProjectChange(p._id)">{{ p.name }}</span>
      </div>
      <el-button type="primary" size="large" style="margin-left:12px" @click="handleSave" :disabled="!currentScript">保存分镜 💾</el-button>
      <span v-if="currentScript" class="word-count">{{ currentScript.wordCount || 0 }} / 2000 字
        <el-progress :percentage="Number(Math.min((currentScript.wordCount||0)/2000*100,100).toFixed(2))" :stroke-width="8" style="width:120px;display:inline-block;margin-left:8px" />
      </span>
    </div>
    <!-- 新手引导条 -->
    <div class="flow-guide" v-if="currentProjectId">
      <div class="flow-step" :class="{ done: currentScript?.scenes?.length > 0 }">① 左侧选剧集，编辑分镜</div>
      <span class="flow-arrow">→</span>
      <div class="flow-step" :class="{ done: videoConfig.subStyle }">② 右侧选风格（自动配置导演设定）</div>
      <span class="flow-arrow">→</span>
      <div class="flow-step" :class="{ done: flowDoneAI }">③ AI 智能拆镜（点一下自动优化参数）</div>
      <span class="flow-arrow">→</span>
      <div class="flow-step" :class="{ done: flowDoneExtract }">④ 提取主体（把角色/场景同步到角色小店）</div>
      <span class="flow-arrow">→</span>
      <div class="flow-step" :class="{ done: flowDoneSync }">⑤ 同步至故事板（去故事板生图/生视频）</div>
    </div>

    <!-- 移动端 Tab 导航 -->
    <div class="mobile-tabs" v-if="currentProjectId && screenWidth < 768">
      <div :class="['mtab', { active: mobileTab === 'episodes' }]" @click="mobileTab = 'episodes'">📋 剧集</div>
      <div :class="['mtab', { active: mobileTab === 'scenes' }]" @click="mobileTab = 'scenes'">🎬 分镜</div>
      <div :class="['mtab', { active: mobileTab === 'settings' }]" @click="mobileTab = 'settings'">🎥 设定</div>
    </div>

    <div class="three-column" v-if="currentProjectId">
      <div class="left-panel" v-show="screenWidth >= 768 || mobileTab === 'episodes'">
        <div class="panel-title"><span>剧集列表</span><span class="panel-actions"><el-button size="small" text @click="addEpisode" title="新建剧集">+</el-button><el-button size="small" text @click="duplicateEpisode" :disabled="!currentScriptId" title="复制当前集">⧉</el-button></span></div>
        <div class="episode-list"><div v-for="ep in scripts" :key="ep._id" :class="['ep-item',{active:currentScriptId===ep._id}]" @click="switchEpisode(ep._id)"><span class="ep-num">第 {{ ep.episodeNumber }} 集</span><span class="ep-title">{{ ep.episodeTitle||'未命名剧集' }}</span></div></div>
      </div>
      <div class="center-panel" v-if="currentScript" v-show="screenWidth >= 768 || mobileTab === 'scenes'">
        <div class="ep-header">
          <el-input v-model="currentScript.episodeTitle" placeholder="给这集起个名字..." size="large" class="title-input" @change="markDirty" />
          <el-tooltip content="AI 根据剧本内容自动推荐景别/运镜/光影/时长，点击后弹出前后对比" placement="bottom"><el-button type="primary" @click="handleAutoStoryboard" :loading="autoStoryboarding" style="margin-left:12px">AI 智能拆镜 🎯</el-button></el-tooltip>
          <el-button type="success" @click="syncToStoryboard" :loading="syncing" style="margin-left:8px">同步至故事板 📤</el-button>
          <el-button size="large" style="margin-left:8px" @click="openExport">导出分镜 📋</el-button>
          <span class="scene-count">{{ currentScript.scenes?.length||0 }} 个镜头</span>
        </div>
        <div class="scenes-area">
          <div v-for="(scene,si) in currentScript.scenes" :key="si" :class="['scene-card',{'shot-invalid':!scene.sceneDescription}]">
            <div class="scene-top-row"><span class="scene-num">🎬 镜号 {{ scene.sceneNumber }}</span><el-button size="small" type="danger" text @click="removeScene(si)">移除此镜</el-button></div>
            <div class="scene-meta-row">
              <div class="meta-item"><label>📍 场景</label><el-input v-model="scene.location" size="small" placeholder="如：咖啡厅、街道..." @change="markDirty" /></div>
              <div class="meta-item"><label>⏰ 时间</label><el-select v-model="scene.timeOfDay" size="small" @change="markDirty"><el-option v-for="t in timeOptions" :key="t" :label="t" :value="t" /></el-select></div>
              <div class="meta-item"><label>📷 景别</label><el-select v-model="scene.shotType" size="small" @change="markDirty"><el-option v-for="t in shotTypes" :key="t" :label="t" :value="t" /></el-select></div>
              <div class="meta-item"><label>🖼️ 构图</label><el-input v-model="scene.composition" size="small" placeholder="如：三分法、对角线..." @change="markDirty" /></div>
            </div>
            <div class="scene-meta-row">
              <div class="meta-item"><label>🎥 运镜</label><el-select v-model="scene.cameraMovement" size="small" @change="markDirty"><el-option v-for="t in cameraMoves" :key="t" :label="t" :value="t" /></el-select></div>
              <div class="meta-item"><label>💡 光影</label><el-input v-model="scene.lighting" size="small" placeholder="如：柔光、逆光..." @change="markDirty" /></div>
              <div class="meta-item"><label>🔊 音效</label><el-input v-model="scene.soundEffect" size="small" placeholder="如：雨声、脚步声..." @change="markDirty" /></div>
              <div class="meta-item"><label>⏱ 时长</label><el-input-number v-model="scene.duration" :min="1" :max="60" size="small" @change="markDirty" /></div>
            </div>
            <div class="scene-meta-row">
              <div class="meta-item" style="flex:1"><label>👤 人物</label><el-input v-model="charactersStr[si]" size="small" placeholder="角色名，逗号分隔" @change="onCharsChange(si)" /></div>
              <div class="meta-item" style="flex:1"><label>🌤 氛围</label><el-input v-model="scene.atmosphere" size="small" placeholder="如：温馨、紧张..." @change="markDirty" /></div>
              <div class="meta-item" style="flex:1"><label>🔗 绑定主体</label><el-select v-model="scene.boundSubjects" size="small" multiple filterable placeholder="选择关联的角色或场景" @change="markDirty"><el-option v-for="a in allAssets" :key="a._id" :label="a.name||a.sceneName||a.propName" :value="a._id" /></el-select></div>
            </div>
            <div class="scene-desc-row"><label>分镜描述 ✍️ <span style="font-size:10px;color:var(--text-200);font-weight:400">（只写画面内容，不用写运镜/景别，那些有专门参数）</span></label><el-input v-model="scene.sceneDescription" type="textarea" :rows="3" placeholder="写清4要素：①谁在画面 ②做什么动作 ③什么环境 ④什么情绪。运镜/景别/光影用上方参数设置，不要写进描述里。例：林晓站在落地窗前，夕阳勾勒出轮廓，办公室空无一人，她低头看手机嘴角微扬" @change="markDirty" /></div>
            <div class="dialogues-block">
              <div v-for="(d,di) in scene.dialogues" :key="di" class="dialogue-row">
                <el-input v-model="d.characterName" size="small" placeholder="角色" style="width:90px" @change="markDirty" /><span class="colon">：</span>
                <el-input v-model="d.text" size="small" placeholder="对话内容" style="flex:1" @change="markDirty" />
                <el-input v-model="d.actionHint" size="small" placeholder="动作/表情" style="width:120px" @change="markDirty" />
                <el-button size="small" text type="danger" @click="removeDialogue(scene,di)">×</el-button>
              </div>
              <el-button size="small" text type="primary" @click="addDialogue(scene)" style="margin-top:4px">+ 加句台词</el-button>
            </div>
          </div>
        </div>
        <el-button style="margin-top:12px;width:100%" @click="addScene" dashed>+ 添加新镜头</el-button>
      </div>
      <div class="center-panel center-empty" v-if="!currentScript && scripts.length===0"><el-empty description="点击左侧「新剧集」创建第一集 ✨" /></div>
      <div class="center-panel center-empty" v-if="!currentScript && scripts.length>0"><el-empty description="点击左侧剧集，开始编辑 ✍️" /></div>
      <div class="right-panel" v-show="screenWidth >= 768 || mobileTab === 'settings'">
        <div class="panel-title">导演设定 🎥</div>
        <div class="setting-group"><label>画面比例 📐</label><el-radio-group v-model="videoConfig.aspectRatio" size="small" @change="onVideoConfigChange"><el-radio-button value="16:9">16:9</el-radio-button><el-radio-button value="9:16">9:16</el-radio-button><el-radio-button value="4:3">4:3</el-radio-button><el-radio-button value="3:4">3:4</el-radio-button></el-radio-group></div>
        <div class="setting-group"><label>创作模式 🎞️</label><el-radio-group v-model="videoConfig.creationMode" size="small" @change="onVideoConfigChange"><el-radio-button value="image_to_video">生图转视频</el-radio-button><el-radio-button value="reference_video">参考生视频</el-radio-button></el-radio-group></div>
        <div class="setting-group"><label>风格参考 🎨 <span style="font-size:10px;color:var(--text-200);font-weight:400">（选后自动配置导演设定）</span></label><el-radio-group v-model="videoConfig.visualStyle" size="small" @change="onStyleChange"><el-radio-button value="写实">写实</el-radio-button><el-radio-button value="动漫">动漫</el-radio-button></el-radio-group></div>
        <div class="setting-group" v-if="videoConfig.visualStyle"><label>风格细分 ✨</label><div class="sub-style-grid"><div v-for="s in currentSubStyles" :key="s" :class="['sub-style-item',{active:videoConfig.subStyle===s}]" @click="selectSubStyle(s)">{{ s }}</div></div></div>
        <div class="setting-group">
          <el-tooltip content="从剧本中自动识别角色、场景、道具，一键创建到「角色小店」方便后续生图时参考" placement="left">
            <el-button style="width:100%" @click="handleExtractSubjects" :disabled="!currentScriptId">提取主体 👥</el-button>
          </el-tooltip>
        </div>
        <div class="setting-group">
          <el-tooltip content="选完右侧风格后自动填充。点击手动检查和微调导演设定参数" placement="left">
            <el-button type="warning" style="width:100%" @click="openDirectorDialog" :disabled="!currentProjectId">导演全局设定 🎬</el-button>
          </el-tooltip>
        </div>
      </div>
    </div>
    <el-empty v-if="!currentProjectId" description="请先在上方选择一个片场 🎬" style="margin-top:80px" />
    <el-dialog v-model="showDirectorDialog" title="导演全局设定 🎬" :width="screenWidth < 768 ? '94%' : '650px'" destroy-on-close>
      <el-form :model="directorForm" label-position="top">
        <el-form-item label="画质与质感 🖌️"><el-input v-model="directorForm.qualityKeywords" type="textarea" :rows="2" placeholder="8K、超写实、电影级摄影..." /></el-form-item>
        <el-form-item label="氛围与光影 🌅"><el-input v-model="directorForm.atmosphereLighting" placeholder="情感氛围描述..." /></el-form-item>
        <el-form-item label="画风指令 🎨"><el-input v-model="directorForm.artStyleCommands" type="textarea" :rows="3" placeholder="写实风、电影颗粒感..." /></el-form-item>
      </el-form>
      <div class="ai-hint"><el-alert type="info" :closable="false" show-icon><template #title>AI 会读懂你的设定，自动优化后应用到全剧所有镜头 ✨</template></el-alert></div>
      <template #footer><el-button @click="showDirectorDialog=false">下次再说叭</el-button><el-button type="primary" @click="handleAIUnderstand" :loading="aiUnderstanding">AI 理解并润色 ✨</el-button><el-button type="success" @click="handleApplyDirectorSettings">应用到全剧 ✅</el-button></template>
    </el-dialog>
    <el-dialog v-model="showExtractDialog" title="提取结果 👥" :width="screenWidth < 768 ? '94%' : '650px'" destroy-on-close>
      <div v-if="extracting" style="text-align:center;padding:40px"><p style="color:var(--text-100)">AI 正在识别剧本中的角色、场景、道具...</p></div>
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
    <!-- AI 拆镜对比 -->
    <el-dialog v-model="showStoryboardDiff" title="AI 拆镜前后对比 🎯" :width="screenWidth < 768 ? '94%' : '700px'" destroy-on-close>
      <el-alert type="success" :closable="false" show-icon style="margin-bottom:14px"><template #title>AI 已优化 {{ diffChanges }} 处参数</template></el-alert>
      <div style="max-height:50vh;overflow-y:auto">
        <div v-for="(d, i) in diffShots" :key="i" v-if="d && d.changes && d.changes.length > 0" style="margin-bottom:10px;padding:12px;background:var(--bg-100);border-radius:8px">
          <div style="font-weight:700;color:var(--text-100);margin-bottom:6px">🎬 镜号 {{ d.shotNumber }}</div>
          <div v-for="ch in d.changes" :key="ch.field" style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:3px;padding:3px 6px;background:var(--bg-200);border-radius:4px">
            <span style="color:var(--text-200);min-width:44px;font-weight:600">{{ ch.label }}</span>
            <span style="color:#999;text-decoration:line-through;min-width:50px">{{ ch.old }}</span>
            <span style="color:var(--text-200)">→</span>
            <span style="color:#67C23A;font-weight:600">{{ ch.new }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="undoStoryboardDiff" type="warning">撤销 AI 修改</el-button>
        <el-button @click="showStoryboardDiff = false">保留优化</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="showExportDialog" title="导出分镜内容 📋" :width="screenWidth < 768 ? '94%' : '540px'">
      <el-form label-position="top" size="small">
        <el-form-item label="选择剧集">
          <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="全部剧集（不选=导出全部）"><el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" /></el-select>
          <div style="display:flex;gap:8px;margin-top:4px"><el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">全选</el-button><el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">当前集</el-button><el-button size="small" link @click="exportEpisodes = []">清空</el-button></div>
        </el-form-item>
        <el-form-item label="导出内容"><el-checkbox-group v-model="exportTypes"><el-checkbox label="script">📝 剧本全文</el-checkbox><el-checkbox label="shots">🎬 分镜全文</el-checkbox><el-checkbox label="full_storyboard">🎞️ 故事板全文</el-checkbox></el-checkbox-group></el-form-item>
        <el-form-item label="导出格式"><el-select v-model="exportFormat" style="width:100%"><el-option label="PDF" value="pdf" /><el-option label="Markdown" value="markdown" /><el-option label="CSV" value="csv" /><el-option label="Word" value="word" /></el-select></el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" show-icon style="margin-top:8px"><template #title>{{ formatHint }}</template></el-alert>
      <template #footer><el-button @click="showExportDialog = false">下次再说叭</el-button><el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0 || exportEpisodes.length === 0">导出文件</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref,reactive,computed,onMounted,nextTick } from 'vue';
import { useRoute,useRouter } from 'vue-router';

const screenWidth = ref(window.innerWidth);
const mobileTab = ref('scenes');
window.addEventListener('resize', () => { screenWidth.value = window.innerWidth; });
import { ElMessage,ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { useAssetStore } from '../stores/asset';
import { assetAPI,scriptAPI,storyboardAPI } from '../api';
import { buildShotsFromScenes } from '../components/promptBuilder';

const route=useRoute();const router=useRouter();
const projectStore=useProjectStore();const scriptStore=useScriptStore();const assetStore=useAssetStore();

const currentProjectId=ref('');const currentScriptId=ref('');const currentScript=ref(null);
const scripts=ref([]);const showDirectorDialog=ref(false);const showExtractDialog=ref(false);
const extractResult=ref(null);const extracting=ref(false);const aiUnderstanding=ref(false);
const dirty=ref(false);const timeOptions=['白天','夜晚','黄昏','傍晚','清晨','黎明','正午','深夜','雨天','雪天','不限'];
const shotTypes=['远景','中景','近景','特写','大特写','全景','中近景'];
const cameraMoves=['推','拉','摇','移','跟','静止','升','降','晃动'];
const charactersStr=ref([]);const autoStoryboarding=ref(false);const syncing=ref(false);
const allAssets=ref([]);const showStoryboardDiff=ref(false);const diffShots=ref([]);const diffChanges=ref(0);const diffBackup=ref(null);const flowDoneAI=ref(false);const flowDoneExtract=ref(false);const flowDoneSync=ref(false);

const videoConfig=reactive({aspectRatio:'9:16',creationMode:'image_to_video',visualStyle:'写实',subStyle:''});
const directorForm=reactive({qualityKeywords:'8K, 超写实, 电影级摄影, 高细节, HDR',atmosphereLighting:'',artStyleCommands:''});
const realisticSubStyles=['古风写实','古风明艳','古风唐朝','古风宋朝','古风明朝','古风清朝','真人写实','都市情感','玄幻修仙','历史战争','现代末日','悬疑恐怖','赛博朋克','未来科幻','纪实摄影','民国风格','乡土风格','职场商战','家庭伦理','医疗救援','80年代','律政法庭','北欧极简'];
const animeSubStyles=['二次元','国风动漫','日系动漫','水墨风','赛博朋克'];
const currentSubStyles=computed(()=>videoConfig.visualStyle==='动漫'?animeSubStyles:realisticSubStyles);

const directorPresets={
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
  '国风动漫':{qualityKeywords:'4K, 中国传统水墨画, 水彩风格',atmosphereLighting:'宁静雅致，散射柔光，墨色浓淡晕染，虚实相生',artStyleCommands:'中国传统水墨画与水彩风格融合，墨线勾勒轮廓，水彩透明晕染着色，色彩清透淡雅，飞白留白，气韵生动'},
  '日系动漫':{qualityKeywords:'8K, 赛璐珞风格, 日式动画电影质感',atmosphereLighting:'清新明亮，柔和漫反射，新海诚式光影',artStyleCommands:'日系动漫, 赛璐珞风格, 新海诚式光影, 治愈系色调'},
  '水墨风':{qualityKeywords:'4K, 中国传统水墨画, 水彩风格',atmosphereLighting:'宁静雅致，散射柔光，墨色浓淡晕染，虚实相生',artStyleCommands:'中国传统水墨画与水彩风格融合，墨线勾勒轮廓，水彩透明晕染着色，色彩清透淡雅，飞白留白，气韵生动'},
  '写实':{qualityKeywords:'8K, 超写实, 电影级摄影, 高细节, HDR',atmosphereLighting:'根据剧情情感动态调整',artStyleCommands:'写实风, 电影颗粒感, 低饱和调色'},
  '动漫':{qualityKeywords:'8K, 赛璐珞风格, 动画电影质感',atmosphereLighting:'明亮通透，动画光影',artStyleCommands:'二次元, 赛璐珞风格, 清晰线条, 高饱和色彩'},
};

onMounted(async()=>{
window.__triggerSave=handleSave;
  await projectStore.fetchProjects();
  const qProjectId=route.query.projectId;
  if(qProjectId){currentProjectId.value=qProjectId;onProjectChange(qProjectId)}
  else{const restored=await projectStore.restoreLastProject();if(restored){currentProjectId.value=restored._id;onProjectChange(restored._id)}}
});

async function onProjectChange(val){
  currentScriptId.value='';currentScript.value=null;if(!val)return;
  try{const project=await projectStore.fetchProject(val);if(project.videoConfig){videoConfig.aspectRatio=project.videoConfig.aspectRatio||'9:16';videoConfig.creationMode=project.videoConfig.creationMode||'image_to_video';videoConfig.visualStyle=project.videoConfig.visualStyle||'写实';videoConfig.subStyle=project.videoConfig.subStyle||''}
    if(project.directorSettings){directorForm.qualityKeywords=project.directorSettings.qualityKeywords||directorForm.qualityKeywords;directorForm.atmosphereLighting=project.directorSettings.atmosphereLighting||'';directorForm.artStyleCommands=project.directorSettings.artStyleCommands||''}}catch(e){}
  scriptStore.fetchScripts(val).then(()=>{scripts.value=[...scriptStore.scripts];if(scripts.value.length>0)switchEpisode(scripts.value[0]._id)});
  loadAllAssets(val);
}

async function loadAllAssets(pid){try{await assetStore.fetchCharacters(pid);await assetStore.fetchScenes(pid);await assetStore.fetchProps(pid);allAssets.value=[...assetStore.characters,...assetStore.scenes,...assetStore.props]}catch(e){}}

async function switchEpisode(scriptId){if(dirty.value)await handleSave();currentScriptId.value=scriptId;const s=await scriptStore.fetchScript(scriptId);currentScript.value=JSON.parse(JSON.stringify(s));charactersStr.value=(currentScript.value.scenes||[]).map(x=>(x.characters||[]).join(', '));dirty.value=false}
async function addEpisode(){if(!currentProjectId.value)return;const maxNum=scripts.value.reduce((m,s)=>Math.max(m,s.episodeNumber),0);try{const res=await scriptAPI.createEmpty({projectId:currentProjectId.value,episodeNumber:maxNum+1,episodeTitle:''});await scriptStore.fetchScripts(currentProjectId.value);scripts.value=[...scriptStore.scripts];currentScriptId.value=res.data._id;await switchEpisode(res.data._id);ElMessage.success(`第${maxNum+1}集已创建 🎉`)}catch(e){ElMessage.error('哎呀，创建出错啦，再试一次哦')}}
async function duplicateEpisode(){if(!currentScript.value)return;const maxNum=scripts.value.reduce((m,s)=>Math.max(m,s.episodeNumber),0);try{const res=await scriptAPI.createEmpty({projectId:currentProjectId.value,episodeNumber:maxNum+1,episodeTitle:(currentScript.value.episodeTitle||'')+' (副本)',scenes:JSON.parse(JSON.stringify(currentScript.value.scenes||[]))});await scriptStore.fetchScripts(currentProjectId.value);scripts.value=[...scriptStore.scripts];const ns=scripts.value.find(s=>s._id===res.data._id);if(ns){currentScriptId.value=ns._id;await switchEpisode(ns._id)}ElMessage.success(`已复制为第${maxNum+1}集 📋`)}catch(e){ElMessage.error('复制失败')}}

function cleanEpTitle(ep){return(ep.episodeTitle||"").replace(/^第d+集[：:]*s*/,"").trim()}
function markDirty(){dirty.value=true}
function onCharsChange(si){const names=charactersStr.value[si]?.split(/[,，、]/).map(s=>s.trim()).filter(Boolean)||[];currentScript.value.scenes[si].characters=names;markDirty()}
function addScene(){const maxNum=(currentScript.value.scenes||[]).reduce((m,s)=>Math.max(m,s.sceneNumber),0);currentScript.value.scenes.push({sceneNumber:maxNum+1,timeOfDay:'白天',location:'',shotType:'中景',composition:'',cameraMovement:'静止',lighting:'',soundEffect:'',duration:3,characters:[],atmosphere:'',sceneDescription:'',dialogues:[],boundSubjects:[]});charactersStr.value.push('');markDirty()}
function removeScene(i){currentScript.value.scenes.splice(i,1);charactersStr.value.splice(i,1);markDirty()}
function addDialogue(scene){scene.dialogues.push({characterName:'',text:'',actionHint:'',innerThought:'',cameraHint:''});markDirty()}
function removeDialogue(scene,i){scene.dialogues.splice(i,1);markDirty()}

async function handleSave(){if(!currentScript.value)return;try{await scriptStore.updateScript(currentScript.value._id,{scenes:currentScript.value.scenes,episodeTitle:currentScript.value.episodeTitle});dirty.value=false;ElMessage.success('内容已经稳稳保存好咯~')}catch(e){ElMessage.error('哎呀，保存出错啦，再试一次哦')}}

async function handleAutoStoryboard(){
  if(!currentProjectId.value||!currentScript.value)return;
  const scenes=currentScript.value.scenes;if(!scenes||scenes.length===0){ElMessage.warning('当前没有分镜哦，先添加一个镜头吧');return}
  autoStoryboarding.value=true;
  try{
    const backup=scenes.map(s=>({shotType:s.shotType,composition:s.composition,cameraMovement:s.cameraMovement,lighting:s.lighting,duration:s.duration,soundEffect:s.soundEffect,sceneDescription:s.sceneDescription}));
    diffBackup.value={scenes:scenes,backup:backup};
    const scriptFull=scenes.map((s,i)=>{const dialogs=(s.dialogues||[]).map(d=>`${d.characterName}: ${d.text} ${d.actionHint?'('+d.actionHint+')':''}`).join('\n');const sceneTitle=s.location+(s.atmosphere?'（'+s.atmosphere+'）':'');return `[镜${i+1}] ${s.timeOfDay||''}，${sceneTitle}\n${s.sceneDescription||''}\n对话:${dialogs}`}).join('\n\n');
    const sysPrompt=`你是资深影视分镜师，为每个分镜推荐镜头参数。规则：景别-表情特写用特写/对话用中近景/多人用中景/环境用全景；构图-对角线/对称/框架式/三分法/中心；运镜-揭示信息推/展示环境摇移/跟踪人物跟；光影-柔光/硬光/逆光/侧光/自然光/暖光/冷光；时长智能估算-纯场景无对话2~4秒/单人单句4~6秒/2-3轮对话6~10秒/多人互动或情绪转折8~12秒/激烈动作3~5秒；音效-环境音/动作音/背景音乐。重要：sceneDescription字段请保留原有分镜描述不要缩短，如果原描述为空才补写简短描述。输出JSON数组：[{"index":0,"shotType":"中景","composition":"三分法","cameraMovement":"静止","lighting":"柔光","duration":5,"soundEffect":"环境音","sceneDescription":"保留原描述或补写"}]`;
    const res=await fetch('/api/v1/assets/generate-prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:currentProjectId.value,assetId:currentProjectId.value,assetType:'storyboard',existingPrompt:`${sysPrompt}\n\n剧本：\n${scriptFull}\n\n为以上${scenes.length}个分镜推荐参数。只输出JSON数组。`})});
    const data=await res.json();const raw=data.data?.prompt||'';const m=raw.match(/\[[\s\S]*\]/);const rec=m?JSON.parse(m[0]):[];
    let filled=0;rec.forEach(r=>{if(scenes[r.index]!==undefined){const s=scenes[r.index];if(r.shotType)s.shotType=r.shotType;if(r.composition)s.composition=r.composition;if(r.cameraMovement)s.cameraMovement=r.cameraMovement;if(r.lighting)s.lighting=r.lighting;if(r.duration)s.duration=r.duration;if(r.soundEffect)s.soundEffect=r.soundEffect;if(r.sceneDescription)s.sceneDescription=r.sceneDescription.replace(/^\[镜\d+\]\s*/,'');filled++}});
    markDirty();
    // 2. 构建前后对比数据
    const diffResult=scenes.map((s,i)=>{const b=backup[i];const changes=[];const fields=[{key:'shotType',label:'景别'},{key:'composition',label:'构图'},{key:'cameraMovement',label:'运镜'},{key:'lighting',label:'光影'},{key:'duration',label:'时长'},{key:'soundEffect',label:'音效'},{key:'sceneDescription',label:'描述'}];fields.forEach(f=>{if(b[f.key]!==s[f.key]&&(s[f.key]||b[f.key]))changes.push({field:f.key,label:f.label,old:b[f.key]||'(空)',new:s[f.key]||'(空)'});});return {shotNumber:s.sceneNumber,changes};});
    let totalChanges=0;diffResult.forEach(d=>totalChanges+=d.changes.length);
    diffShots.value=diffResult;diffChanges.value=totalChanges;
    console.log('[AI拆镜] 变化数:', totalChanges, 'filled:', filled);if(totalChanges>0){showStoryboardDiff.value=true;}else{ElMessage.success('所有分镜参数已是最优，无需调整 ✨');}
    flowDoneAI.value=true;
  }catch(e){console.error(e);fallbackAutoStoryboard()}finally{autoStoryboarding.value=false}
}

function undoStoryboardDiff(){
  if(!diffBackup.value)return;
  const {scenes,backup}=diffBackup.value;
  backup.forEach((b,i)=>{
    Object.keys(b).forEach(k=>{scenes[i][k]=b[k];});
  });
  diffBackup.value=null;diffShots.value=[];diffChanges.value=0;
  showStoryboardDiff.value=false;markDirty();
  ElMessage.success('已撤销 AI 修改，恢复原始参数');
}

function fallbackAutoStoryboard(){const s=currentScript.value.scenes;if(!s)return;const backup2=s.map(x=>({shotType:x.shotType,duration:x.duration}));diffBackup.value={scenes:s,backup:backup2};const rules={'特写':[/表情|眼神|泪|笑|吻|哭|怒|惊|细节|手|脸/],'全景':[/全景|环境|城市|天空|山|海|街道|建筑|远处/],'近景':[/对话|说|问|答|告诉|喊|叫/],'中景':[/走|跑|站|坐|躺|动作|拿|放|推/]};s.forEach(x=>{const t=(x.sceneDescription||'')+' '+(x.dialogues||[]).map(d=>d.text).join(' ');if(!x.shotType||x.shotType==='中景'){for(const[ty,ps]of Object.entries(rules)){if(ps.some(p=>p.test(t))){x.shotType=ty;break}}}
// 智能时长估算
if(!x.duration||x.duration===3){const dialogs=x.dialogues||[];const totalChars=dialogs.reduce((a,d)=>a+(d.text||'').length,0);const count=dialogs.length;
if(count===0) x.duration=totalChars>20?4:2;else if(count===1) x.duration=Math.max(4,Math.min(8,Math.round(totalChars/4)+2));else if(count<=3) x.duration=Math.max(6,Math.min(12,Math.round(totalChars/3)+3));else x.duration=Math.max(8,Math.min(15,Math.round(totalChars/2)+4));
if(/(跑|追|打|冲|逃|摔|跳|飞|转)/.test(t)) x.duration=Math.min(x.duration,6);if(/(哭|怒|吻|拥抱|转身|回头)/.test(t)) x.duration=Math.max(x.duration,5)}});markDirty();ElMessage.success(`智能规则已填充 ${s.length} 个分镜（含智能时长）`)}

async function syncToStoryboard(){if(!currentProjectId.value||!currentScriptId.value||!currentScript.value)return;syncing.value=true;try{const scenes=currentScript.value.scenes;if(!scenes||scenes.length===0){ElMessage.warning('没有分镜可同步，请先添加镜头');syncing.value=false;return}const noSub=localStorage.getItem('ad_no_subtitles')==='true';const shots=buildShotsFromScenes(scenes, videoConfig, noSub, directorForm, allAssets.value);const rawRes=await fetch('/api/v1/storyboards/auto-generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scriptId:currentScriptId.value,projectId:currentProjectId.value,batchShots:shots})});const data=await rawRes.json();ElMessage.success(`已同步 ${shots.length} 个分镜到故事板，图片/视频提示词已区分生成`);flowDoneSync.value=true}catch(e){ElMessage.error('同步失败: '+(e.message||''))}finally{syncing.value=false}}

function selectSubStyle(s){videoConfig.subStyle=s;const preset=getStylePreset();if(preset){directorForm.qualityKeywords=preset.qualityKeywords;directorForm.atmosphereLighting=preset.atmosphereLighting;directorForm.artStyleCommands=preset.artStyleCommands}onVideoConfigChange();handleApplyDirectorSettings()}
function openDirectorDialog(){const preset=getStylePreset();if(preset&&!directorForm.atmosphereLighting&&!directorForm.artStyleCommands){directorForm.qualityKeywords=preset.qualityKeywords;directorForm.atmosphereLighting=preset.atmosphereLighting;directorForm.artStyleCommands=preset.artStyleCommands}showDirectorDialog.value=true}
function getStylePreset(){if(videoConfig.subStyle&&directorPresets[videoConfig.subStyle])return directorPresets[videoConfig.subStyle];if(directorPresets[videoConfig.visualStyle])return directorPresets[videoConfig.visualStyle];return null}
async function onVideoConfigChange(){if(!currentProjectId.value)return;dirty.value=true;try{await projectStore.updateProject(currentProjectId.value,{videoConfig:{...videoConfig}})}catch(e){}}
function onStyleChange(){videoConfig.subStyle='';const preset=directorPresets[videoConfig.visualStyle];if(preset){directorForm.qualityKeywords=preset.qualityKeywords;directorForm.atmosphereLighting=preset.atmosphereLighting;directorForm.artStyleCommands=preset.artStyleCommands}onVideoConfigChange();handleApplyDirectorSettings()}
async function handleExtractSubjects(){if(!currentScriptId.value||!currentProjectId.value)return;extracting.value=true;extractResult.value=null;showExtractDialog.value=true;try{const res=await assetAPI.extractAll(currentScriptId.value,currentProjectId.value);extractResult.value=res.data;flowDoneExtract.value=true}catch(e){ElMessage.error('提取失败，请确认已选择剧集')}finally{extracting.value=false}}
function goToAssets(){showExtractDialog.value=false;router.push({path:'/assets',query:{projectId:currentProjectId.value}})}
async function handleAIUnderstand(){
  if(!currentProjectId.value)return;
  aiUnderstanding.value=true;
  try{
    const systemPrompt='你是资深影视导演。根据用户提供的风格关键词，输出优化后的导演设定。只返回JSON：{"qualityKeywords":"画质质感设定","atmosphereLighting":"氛围光影设定","artStyleCommands":"画风指令设定"}。每个字段用中文，不超过100字。';
    const userPrompt=`当前风格：${videoConfig.visualStyle||'写实'} ${videoConfig.subStyle||''}
当前画质质感：${directorForm.qualityKeywords}
当前氛围光影：${directorForm.atmosphereLighting||'无'}
当前画风指令：${directorForm.artStyleCommands||'无'}
请基于风格优化以上三项设定。`;
    const res=await fetch('/api/v1/assets/generate-prompt',{
      method:'POST',headers:{'Content-Type':'application/json'},
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
async function handleApplyDirectorSettings(){if(!currentProjectId.value)return;try{await projectStore.updateProject(currentProjectId.value,{directorSettings:{...directorForm,aiOptimized:true}});showDirectorDialog.value=false;ElMessage.success('导演设定已应用到全剧 ✅')}catch(e){ElMessage.error('应用失败')}}

// ===== 导出 =====
const showExportDialog = ref(false);
const exportTypes = ref(['script', 'shots']);
const exportFormat = ref('pdf');
const exportEpisodes = ref([]);
const formatHint = computed(() => {
  const m = { pdf: 'PDF：打开打印预览，浏览器「另存为 PDF」保存', markdown: 'Markdown：下载 .md 文件，可用 Typora/VS Code 打开', csv: 'Excel/CSV：下载 .csv 文件，用 Excel/WPS 打开编辑', word: 'Word：下载 .doc 文件，用 Word/WPS 打开编辑' };
  return m[exportFormat.value] || '';
});

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
    const ext = fmt === 'csv' ? 'csv' : fmt === 'markdown' ? 'md' : fmt === 'word' ? 'doc' : 'html';
    if (fmt === 'csv' || fmt === 'markdown' || fmt === 'word') {
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${data.filename || 'export'}.${ext}`;
      a.click(); URL.revokeObjectURL(url);
    } else {
      // PDF: 在新窗口中打开 HTML，让用户手动打印
      const w = window.open('', '_blank');
      w.document.write(data.html);
      w.document.close();
    }
    ElMessage.success('备份文件已准备就绪~');
  } catch (e) { ElMessage.error('哎呀，导出出错啦，再试一次哦'); }
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
.center-panel{flex:1;background:var(--bg-200);border-radius:8px;border:1px solid var(--bg-300);padding:16px;overflow-y:auto;min-width:0}
.center-empty{display:flex;align-items:center;justify-content:center}
.ep-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.title-input{flex:1}
.scene-count{color:var(--text-100);font-size:13px;white-space:nowrap}
.scenes-area{display:flex;flex-direction:column;gap:12px}
.scene-card{background:var(--bg-200);border:1px solid var(--bg-300);border-radius:8px;padding:12px}
.shot-invalid{border-color:var(--accent-200);background:var(--bg-100)}
.scene-top-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.scene-num{color:var(--primary-200);font-weight:bold;font-size:14px}
.scene-meta-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.meta-item{display:flex;flex-direction:column;gap:2px;min-width:100px}
.meta-item label{color:var(--text-100);font-size:11px}
.scene-desc-row{margin-bottom:8px}
.scene-desc-row label{color:var(--text-100);font-size:11px;display:block;margin-bottom:4px}
.dialogues-block{padding-left:8px}
.dialogue-row{display:flex;gap:4px;align-items:center;margin-bottom:4px}
.colon{color:var(--text-100);font-size:14px}
.right-panel{width:250px;flex-shrink:0;background:var(--bg-200);border-radius:8px;border:1px solid var(--bg-300);padding:12px;overflow-y:auto}
.setting-group{margin-bottom:14px}
.setting-group>label{color:var(--text-200);font-size:12px;display:block;margin-bottom:4px;font-weight:bold}
.sub-style-grid{display:flex;flex-wrap:wrap;gap:4px}
.sub-style-item{padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;background:var(--bg-100);border:1px solid var(--bg-300);color:var(--text-200);transition:all 0.15s}
.sub-style-item:hover{border-color:var(--primary-200);color:var(--primary-200)}
.sub-style-item.active{background:var(--primary-100);border-color:var(--primary-200);color:var(--primary-200)}
.ai-hint{margin-top:12px}
.flow-guide{display:flex;align-items:center;gap:8px;padding:8px 14px;margin-bottom:12px;background:var(--accent-200);border-radius:8px;border:1px solid var(--accent-100);font-size:12px;color:var(--text-200);flex-wrap:wrap}
.flow-step{padding:4px 10px;border-radius:12px;background:var(--bg-200);white-space:nowrap}
.flow-step.done{background:#E8F5E9;color:#2E7D32;font-weight:600}
.flow-arrow{color:var(--gold-dark);font-weight:700}
.extract-tags{display:flex;flex-wrap:wrap;min-height:32px}
.diff-item{animation:fadeIn 0.3s ease-out}
.diff-header{font-weight:700;color:var(--text-100);margin-bottom:8px;font-size:14px}
.diff-row{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px;padding:4px 8px;background:var(--bg-200);border-radius:4px}
.diff-field{color:var(--text-200);min-width:50px;font-weight:600}
.diff-old{color:#999;text-decoration:line-through;min-width:60px}
.diff-arrow{color:var(--text-200)}
.diff-new{color:#67C23A;font-weight:600}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

.sg-project-pills { display: flex; gap: 8px; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--bg-300) transparent; padding-bottom: 4px; }
.sg-pill { font-size: 13px; padding: 6px 16px; border-radius: 18px; cursor: pointer; background: var(--bg-200); border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500; white-space: nowrap; transition: all 0.15s; user-select: none; }
.sg-pill:hover { border-color: var(--gold); color: var(--text-100); }
.sg-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }
.sg-project-pills::-webkit-scrollbar { height: 4px; }
.sg-project-pills::-webkit-scrollbar-thumb { background: var(--bg-300); border-radius: 2px; }
/* 移动端 Tab 导航 */
.mobile-tabs { display: none; }
@media (max-width: 768px) {
  .mobile-tabs { display: flex; gap: 4px; margin-bottom: 8px; background: var(--bg-200); border-radius: 10px; padding: 4px; border: 1px solid var(--bg-300); }
  .mtab { flex: 1; text-align: center; padding: 10px 4px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; color: var(--text-200); cursor: pointer; transition: all 0.15s; }
  .mtab.active { background: var(--navy); color: var(--gold); }
  .mtab:hover { color: var(--text-100); }

  .script-edit-root { max-width: 100vw; overflow-x: hidden; }
  .top-bar { flex-wrap: wrap; gap: 8px; }
  .top-bar .el-button { min-height: 44px; }
  .word-count { width: 100%; margin-left: 0 !important; justify-content: flex-end; }

  /* 流程引导 */
  .flow-guide { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 4px; padding: 6px 8px; }
  .flow-step { font-size: 10px; padding: 3px 8px; }
  .flow-arrow { display: none; }

  /* 三列：只显示当前 tab */
  .three-column { flex-direction: column; gap: 0; overflow-y: auto; flex: 1; }
  .left-panel { width: 100%; max-height: none; flex: 1; overflow-y: auto; }
  .left-panel :deep(.episode-list) { display: flex; flex-direction: column; overflow-y: auto; }
  .left-panel :deep(.ep-item) { white-space: normal; }
  .center-panel { width: 100%; min-width: 0; padding: 10px; flex: 1; overflow-y: auto; }
  .right-panel { width: 100%; max-height: none; padding: 10px; flex: 1; overflow-y: auto; }

  /* 剧集标题和按钮 */
  .ep-header { flex-wrap: wrap; gap: 6px; }
  .ep-header :deep(.title-input) { flex: 1 1 100%; }
  .ep-header .el-button { font-size: 0.75rem; padding: 6px 10px; min-height: 40px; }
  .scene-count { font-size: 0.75rem; }

  /* 分镜卡片 */
  .scene-meta-row { gap: 4px; }
  .meta-item { min-width: 45%; flex: 1 1 45%; }
  .meta-item .el-select,
  .meta-item .el-input,
  .meta-item .el-input-number { width: 100% !important; }

  /* 对话行 */
  .dialogue-row { flex-wrap: wrap; gap: 4px; }
  .dialogue-row .el-input { min-width: 0 !important; }
  .dialogue-row .el-input:first-child { width: 70px !important; flex-shrink: 0; }
  .dialogue-row .el-input:nth-child(2) { flex: 1 1 100px; }
  .dialogue-row .el-input:nth-child(3) { width: 100px !important; }
  .colon { display: none; }

  /* 右侧导演设定 */
  .sub-style-grid { gap: 3px; }
  .sub-style-item { padding: 4px 10px; font-size: 0.75rem; min-height: 32px; display: flex; align-items: center; }

  /* 所有交互元素 */
  :deep(.el-button) { min-height: 40px; }
  :deep(.el-input__wrapper) { min-height: 40px; }
  :deep(.el-select__wrapper) { min-height: 40px; }
}
</style>