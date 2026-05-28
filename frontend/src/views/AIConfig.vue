<template>
  <div class="ac-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">生图设置</span>
    </div>

    <div class="ac-grid">
      <!-- 水印/文字控制 -->
      <div class="ac-card">
        <h3 class="ac-card-title">水印 / 文字控制</h3>
        <div class="ac-row">
          <div class="ac-label-wrap">
            <span class="ac-label">禁止生成任何文字/水印</span>
            <span class="ac-desc">自动在所有提示词中追加禁止文字、logo、乱码的约束，同时关闭豆包API自带水印</span>
          </div>
          <el-switch v-model="cfg.noTextWatermark" @change="save" />
        </div>
      </div>

      <!-- 画质/风格默认参数 -->
      <div class="ac-card">
        <h3 class="ac-card-title">画质 / 风格默认参数</h3>
        <div class="ac-row">
          <span class="ac-label">图片默认画质</span>
          <el-select v-model="cfg.imageQuality" size="small" @change="save" style="width:160px">
            <el-option label="8K" value="8K" />
            <el-option label="4K" value="4K" />
            <el-option label="2K" value="2K" />
          </el-select>
        </div>
        <div class="ac-row">
          <span class="ac-label">图片默认风格</span>
          <el-select v-model="cfg.imageStyle" size="small" @change="save" style="width:160px">
            <el-option label="超写实" value="超写实" />
            <el-option label="古风" value="古风" />
            <el-option label="动漫" value="动漫" />
            <el-option label="电影级" value="电影级" />
          </el-select>
        </div>
        <div class="ac-row">
          <span class="ac-label">视频默认时长</span>
          <el-select v-model="cfg.videoDuration" size="small" @change="save" style="width:160px">
            <el-option label="10s" :value="10" />
            <el-option label="15s" :value="15" />
            <el-option label="30s" :value="30" />
          </el-select>
        </div>
        <div class="ac-row">
          <span class="ac-label">视频默认分辨率</span>
          <el-select v-model="cfg.videoResolution" size="small" @change="save" style="width:160px">
            <el-option label="1080p" value="1080p" />
            <el-option label="2K (1440p)" value="2K" />
          </el-select>
        </div>
      </div>

      <!-- 豆包模型专属参数 -->
      <div class="ac-card">
        <h3 class="ac-card-title">豆包模型专属参数</h3>
        <div class="ac-row">
          <span class="ac-label">角色生图默认比例</span>
          <el-select v-model="cfg.characterRatio" size="small" @change="save" style="width:160px">
            <el-option label="16:9 横屏（推荐三视图）" value="16:9" />
            <el-option label="9:16 竖屏" value="9:16" />
            <el-option label="4:3 方形" value="4:3" />
          </el-select>
        </div>
        <div class="ac-row">
          <div class="ac-label-wrap">
            <span class="ac-label">生视频风格化模式</span>
            <span class="ac-desc">开启后自动在视频提示词中追加非写实风格引导，降低被 Seedance 真人内容审核拦截的概率</span>
          </div>
          <el-switch v-model="cfg.noRealPerson" @change="save" />
        </div>
        <div class="ac-row">
          <div class="ac-label-wrap">
            <span class="ac-label">生图风格化（遮挡模式）</span>
            <span class="ac-desc">开启后所有生图自动叠加遮挡特效，降低AI内容审核误判率，对所有生图模型有效</span>
          </div>
          <el-switch v-model="cfg.characterStyleMode" @change="save" />
        </div>
      </div>

      <!-- 状态提示 -->
      <div class="ac-card" style="background:var(--accent-200);border-color:var(--accent-100)">
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-100)">
          <span style="font-size:20px">💡</span>
          <span>{{ saveMsg || '配置自动保存，全局生效。单个镜头生成时可临时覆盖。' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const cfg = reactive({
  noTextWatermark: true,
  imageQuality: '8K',
  imageStyle: '超写实',
  videoDuration: 15,
  videoResolution: '2K',
  noRealPerson: true,
  characterRatio: '16:9',
  characterStyleMode: false,
});
const saveMsg = ref('');

window.__aiConfig = cfg;

async function load() {
  try {
    const res = await fetch('/api/v1/config/all');
    const data = await res.json();
    if (data.data?.aiConfig) Object.assign(cfg, data.data.aiConfig);
    window.__aiConfig = cfg;
  } catch (e) {}
}

async function save() {
  try {
    await fetch('/api/v1/config/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    window.__aiConfig = cfg;
    saveMsg.value = '✓ 内容已经稳稳保存好咯~';
    setTimeout(() => { saveMsg.value = ''; }, 2000);
  } catch (e) { ElMessage.error('哎呀，保存出错啦，再试一次哦'); }
}

onMounted(() => { load(); });
</script>

<style scoped>
.ac-root { padding: 0; }
.ac-grid { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.ac-card { background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 18px 20px; transition: border-color 0.2s; }
.ac-card:hover { border-color: var(--gold); }
.ac-card-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--text-100); margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); }
.ac-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--bg-300); }
.ac-row:last-child { border-bottom: none; }
@media (max-width: 768px) {
  .ac-row { flex-direction: column; align-items: flex-start; gap: 6px; }
  .ac-card { padding: 14px 12px; }
}
</style>
.ac-label { font-size: 13px; color: var(--text-100); font-weight: 600; }
.ac-desc { display: block; font-size: 11px; color: var(--text-200); margin-top: 2px; }
</style>
