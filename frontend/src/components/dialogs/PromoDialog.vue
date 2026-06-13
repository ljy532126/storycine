<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :width="screenWidth < 768 ? '94%' : '460px'" destroy-on-close title="生成引流短片">
    <div style="font-size:13px;color:var(--text-100);margin-bottom:16px">从故事板已有视频中自动提取精彩片段，生成竖版引流推广短片。</div>
    <el-form label-position="top" size="small">
      <el-form-item label="生成模式">
        <el-radio-group v-model="promoMode">
          <el-radio value="simple">简单版 — 1条冲突向引流片</el-radio>
          <el-radio value="complete">完整版 — 3条不同风格（冲突/甜宠/悬念）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="背景音乐 URL（可选）">
        <el-input v-model="promoBGM" placeholder="填写音乐链接，留空则不添加背景音乐" />
      </el-form-item>
    </el-form>
    <div v-if="promoStatus === 'rendering'" style="padding:12px;margin:12px 0">
      <el-progress :percentage="promoProgress" :stroke-width="6" />
      <p style="font-size:12px;color:var(--text-200);margin-top:6px">{{ promoMessage }}</p>
    </div>
    <div v-if="promoResults.length > 0" style="margin-top:12px">
      <div v-for="(r, i) in promoResults" :key="i" style="padding:8px 12px;margin-bottom:8px;border-radius:8px;border:1px solid var(--bg-300);display:flex;align-items:center;gap:10px">
        <span style="font-weight:700;font-size:12px;color:var(--gold-dark)">{{ r.label }}</span>
        <span style="flex:1;font-size:11px;color:var(--text-200);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ r.hookText }}</span>
        <el-button size="small" type="success" @click="downloadPromo(r)">下载</el-button>
      </div>
    </div>
    <div v-if="promoError" style="color:#e74c3c;font-size:12px;margin-top:8px">{{ promoError }}</div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleGeneratePromo" :loading="promoRendering" :disabled="!hasVideo">开始生成</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useSocket } from '../useSocket';

const props = defineProps({
  modelValue: Boolean,
  projectId: String,
  storyboardId: String,
  hasVideo: Boolean,
  screenWidth: { type: Number, default: 1024 },
});

defineEmits(['update:modelValue']);

const promoMode = ref('simple');
const promoBGM = ref('');
const promoRendering = ref(false);
const promoProgress = ref(0);
const promoMessage = ref('');
const promoStatus = ref('');
const promoResults = ref([]);
const promoError = ref('');

const socket = useSocket();
let _init = false;

function setupSocket() {
  if (_init) return; _init = true;
  socket.connect();
  socket.on('promo-progress', (d) => { promoStatus.value = 'rendering'; promoMessage.value = d.message || ''; promoProgress.value = d.progress || 0; });
  socket.on('promo-complete', (d) => { promoStatus.value = 'completed'; promoProgress.value = 100; promoResults.value = d.clips || []; promoRendering.value = false; ElMessage.success('引流短片生成完成'); });
  socket.on('promo-error', (d) => { promoStatus.value = 'failed'; promoError.value = d.error || '生成失败'; promoRendering.value = false; ElMessage.error(d.error || '引流短片生成失败'); });
}

onMounted(() => setupSocket());

async function handleGeneratePromo() {
  promoRendering.value = true; promoError.value = ''; promoResults.value = []; promoStatus.value = 'rendering'; promoProgress.value = 0; promoMessage.value = '正在生成...';
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/v1/promos/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId: props.projectId, storyboardId: props.storyboardId, options: { mode: promoMode.value, backgroundMusic: promoBGM.value, maxDuration: 60 } }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || '生成请求失败'); }
    ElMessage.success('已提交引流短片生成任务，请等待完成通知');
    const start = Date.now();
    const poll = setInterval(() => {
      if (promoResults.value.length > 0 || promoStatus.value === 'completed' || promoStatus.value === 'failed') {
        clearInterval(poll); promoRendering.value = false; return;
      }
      if (Date.now() - start > 5 * 60 * 1000) { clearInterval(poll); promoRendering.value = false; promoError.value = '生成超时'; return; }
      promoProgress.value = Math.min(promoProgress.value + 2, 95);
    }, 2000);
  } catch (e) { promoError.value = e.message || '生成失败'; promoRendering.value = false; promoStatus.value = ''; }
}

function downloadPromo(r) {
  const a = document.createElement('a'); a.href = r.url; a.download = `promo_${r.label}_${Date.now()}.mp4`; a.click();
}

function reset() { promoError.value = ''; promoResults.value = []; promoStatus.value = ''; }
defineExpose({ reset });
</script>
