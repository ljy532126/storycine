<template>
  <div class="sms-root">
    <div class="sms-phone" v-if="!hidePhone">
      <div class="input-counter-wrap">
        <el-input v-model="localPhone" :placeholder="phonePlaceholder" maxlength="11" size="large" :disabled="disabled" />
        <span v-if="localPhone" class="input-counter">{{ localPhone.length }}/11</span>
      </div>
    </div>
    <div class="sms-row">
      <div class="input-counter-wrap" :style="{ width: codeWidth }">
        <el-input v-model="localCode" :placeholder="codePlaceholder" maxlength="6" size="large" :disabled="disabled" />
        <span v-if="localCode" class="input-counter">{{ localCode.length }}/6</span>
      </div>
      <el-button @click="handleSend" :loading="sending" :disabled="cooldown > 0 || !canSend" size="large" style="min-width:120px">
        {{ cooldown > 0 ? cooldown + 's' : sending ? '发送中' : '获取验证码' }}
      </el-button>
    </div>
    <slot />
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  phone: { type: String, default: '' },
  code: { type: String, default: '' },
  hidePhone: { type: Boolean, default: false },
  phonePlaceholder: { type: String, default: '输入手机号' },
  codePlaceholder: { type: String, default: '短信验证码' },
  codeWidth: { type: String, default: '140px' },
  scene: { type: String, default: 'login' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:phone', 'update:code', 'sent']);

const localPhone = computed({
  get: () => props.phone,
  set: (v) => emit('update:phone', v),
});
const localCode = computed({
  get: () => props.code,
  set: (v) => emit('update:code', v),
});

const sending = ref(false);
const cooldown = ref(0);
let timer = null;

const canSend = computed(() => !props.hidePhone ? localPhone.value && /^1[3-9]\d{9}$/.test(localPhone.value) : true);

async function handleSend() {
  if (cooldown.value > 0 || !canSend.value) return;
  sending.value = true;
  try {
    const res = await fetch('/api/v1/auth/sms/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: props.hidePhone ? '' : localPhone.value, scene: props.scene }),
    });
    const data = await res.json();
    if (res.ok) {
      ElMessage.success(data.message || '验证码已发送');
      cooldown.value = 60;
      clearInterval(timer); timer = setInterval(() => { cooldown.value--; if (cooldown.value <= 0) clearInterval(timer); }, 1000);
      emit('sent');
    } else { ElMessage.error(data.message || '发送失败'); }
  } catch { ElMessage.error('网络错误'); }
  finally { sending.value = false; }
}

onUnmounted(() => { clearInterval(timer); });
</script>

<style scoped>
.sms-root { display: flex; flex-direction: column; gap: 10px; }
.sms-phone { margin-bottom: 0; }
.sms-row { display: flex; gap: 10px; align-items: flex-start; }
.input-counter-wrap { position: relative; width: 100%; }
.input-counter {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  font-size: 11px; color: var(--text-200); background: var(--bg-100);
  padding: 1px 8px; border-radius: 4px; pointer-events: none; font-weight: 600; z-index: 2;
}
</style>
