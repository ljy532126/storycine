<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="shot ? `配音: 镜头 ${shot.shotNumber}` : '批量全集配音'" width="560px" destroy-on-close>
    <div v-if="shot" style="margin-bottom:12px">
      <span style="font-size:12px;font-weight:600;color:var(--text-100);display:block;margin-bottom:6px">选择台词（共 {{ dialogueOptions.length }} 句）</span>
      <div v-if="dialogueOptions.length > 0" class="tts-dialogue-list">
        <div v-for="(d, di) in dialogueOptions" :key="di"
          :class="['tts-dialogue-item', { active: ttsSelectedDi === di }]"
          @click="ttsSelectedDi = di">
          <span class="tts-di-char">{{ d.characterName || '未知' }}</span>
          <span class="tts-di-text">{{ d.text }}</span>
        </div>
      </div>
      <div v-else style="color:var(--text-200);font-size:12px">该镜头没有台词，将合成镜头描述</div>
    </div>
    <el-form label-position="top" size="small">
      <el-form-item label="音色">
        <el-select v-model="ttsParams.speaker" style="width:100%" filterable>
          <el-option v-for="v in ttsVoiceOptions" :key="v.value" :label="v.label" :value="v.value" :disabled="v.disabled"/>
        </el-select>
        <el-input v-if="ttsParams.speaker === '__custom__'" v-model="ttsCustomSpeaker" placeholder="输入音色ID" size="small" style="margin-top:8px" />
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="语速"><el-slider v-model="ttsParams.speechRate" :min="-50" :max="100" /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="音量"><el-slider v-model="ttsParams.loudnessRate" :min="-50" :max="100" /></el-form-item>
        </el-col>
      </el-row>
      <el-alert type="info" :closable="false" style="font-size:12px" title="临时修改仅本次合成生效" />
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleSynthesize" :loading="synthing" :disabled="shot && dialogueOptions.length > 0 && ttsSelectedDi < 0">
        <Voice size="14" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"/>{{ shot ? '合成选中的台词' : '批量合成全部' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Voice } from '@icon-park/vue-next';
import { ttsAPI, configAPI } from '../../api';

const props = defineProps({
  modelValue: Boolean,
  shot: { type: Object, default: null },
  dialogueOptions: { type: Array, default: () => [] },
  storyboardId: String,
  projectId: String,
  scriptId: String,
});

const emit = defineEmits(['update:modelValue', 'synth-done']);

const ttsSelectedDi = ref(-1);
const synthing = ref(false);
const ttsParams = reactive({ speaker: 'zh_female_vv_uranus_bigtts', speechRate: 0, loudnessRate: 0 });
const ttsCustomSpeaker = ref('');
const ttsVoiceOptions = ref([{ label: '加载中...', value: '' }]);

async function fetchVoices() {
  try {
    const { data } = await configAPI.getTTSVoices();
    if (data && data.length > 0) {
      const opts = [{ label: '自定义音色ID (手动输入)', value: '__custom__' }];
      const byGender = {};
      data.forEach(v => { const g = v.gender || '其他'; if (!byGender[g]) byGender[g] = []; byGender[g].push({ label: v.name, value: v.id }); });
      Object.entries(byGender).forEach(([g, voices]) => { opts.push({ label: `──── ${g}声 ────`, value: '', disabled: true }); opts.push(...voices); });
      ttsVoiceOptions.value = opts;
    }
  } catch {}
}

onMounted(() => fetchVoices());

async function handleSynthesize() {
  synthing.value = true;
  const speaker = ttsParams.speaker === '__custom__' ? (ttsCustomSpeaker.value || 'zh_female_vv_uranus_bigtts') : ttsParams.speaker;
  try {
    if (!props.shot) {
      const { data } = await ttsAPI.batchSynthesize({
        storyboardId: props.storyboardId,
        speaker, speechRate: ttsParams.speechRate, loudnessRate: ttsParams.loudnessRate,
      });
      const ok = data.results?.filter(r => r.success).length || 0;
      ElMessage.success(`批量配音完成: ${ok}/${data.results?.length || 0}`);
    } else {
      const sel = props.dialogueOptions[ttsSelectedDi.value];
      const text = sel?.text || props.shot.dialogue?.text || props.shot.imageDescription || '';
      const charName = sel?.characterName || props.shot.dialogue?.characterName || '';
      if (!text.trim()) { ElMessage.warning('该镜头没有台词'); return; }
      const { data } = await ttsAPI.synthesize({
        storyboardId: props.storyboardId,
        shotNumber: props.shot.shotNumber,
        text, characterName: charName,
        projectId: props.projectId,
        scriptId: props.scriptId,
        speaker, speechRate: ttsParams.speechRate, loudnessRate: ttsParams.loudnessRate,
      });
      if (props.shot.dialogue) props.shot.dialogue.audioUrl = data.audioUrl;
      ElMessage.success('配音完成');
    }
    emit('update:modelValue', false);
    emit('synth-done');
  } catch (e) { ElMessage.error(e.response?.data?.message || '配音失败'); }
  finally { synthing.value = false; }
}

function reset() {
  ttsSelectedDi.value = props.dialogueOptions.length > 0 ? 0 : -1;
  ttsParams.speaker = 'zh_female_vv_uranus_bigtts';
  ttsParams.speechRate = 0;
  ttsParams.loudnessRate = 0;
}
defineExpose({ reset });
</script>
