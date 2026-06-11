<template>
  <div class="auth-root">
    <div class="auth-card">
      <div class="auth-header">
        <span class="auth-diamond">◆</span>
        <h1>StoryCine</h1>
        <p>全自动AI短剧生成平台</p>
      </div>

      <h2>注册</h2>

      <!-- 隐藏陷阱表单吸收浏览器自动填充 -->
      <form style="position:absolute;left:-9999px;top:-9999px" aria-hidden="true" tabindex="-1">
        <input type="text" name="username" autocomplete="username" tabindex="-1" />
        <input type="password" name="password" autocomplete="new-password" tabindex="-1" />
      </form>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="handleRegister">
        <el-form-item label="账号" prop="username">
          <div class="input-counter-wrap">
            <el-input :model-value="form.username" placeholder="字母开头英文+数字" maxlength="30" autocomplete="off" @update:model-value="v => form.username = String(v).replace(/[^a-zA-Z0-9_]/g, '')" />
            <span v-if="form.username" class="input-counter">{{ form.username.length }}/30</span>
          </div>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <div class="input-counter-wrap">
            <el-input v-model="form.password" type="password" show-password placeholder="至少8位" maxlength="50" autocomplete="new-password" />
            <span v-if="form.password" class="input-counter">{{ form.password.length }}/50</span>
          </div>
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPwd">
          <div class="input-counter-wrap">
            <el-input v-model="form.confirmPwd" type="password" show-password placeholder="再次输入密码" maxlength="50" autocomplete="new-password" />
            <span v-if="form.confirmPwd" class="input-counter">{{ form.confirmPwd.length }}/50</span>
          </div>
        </el-form-item>
        <el-form-item v-if="smsEnabled" label="手机号（用于短信登录和找回密码）">
          <SmsCodeInput v-model:phone="form.phone" v-model:code="form.smsCode" scene="login" phone-placeholder="输入手机号" code-placeholder="短信验证码" />
        </el-form-item>
        <el-button type="primary" @click="handleRegister" :loading="loading" style="width:100%" size="large">
          {{ loading ? '注册中...' : '注册' }}
        </el-button>
      </el-form>

      <div class="auth-footer">
        <span>已有账号？</span>
        <router-link to="/login">立即登录 →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import SmsCodeInput from '../components/SmsCodeInput.vue';

const router = useRouter();
const loading = ref(false);
const formRef = ref(null);
const smsEnabled = ref(false);
const form = reactive({ username: '', password: '', confirmPwd: '', phone: '', smsCode: '' });

onMounted(async () => {
  try { const r = await fetch('/api/v1/auth/sms/status'); const d = await r.json(); smsEnabled.value = d.data?.enabled || false; } catch {}
});

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/, message: '字母开头，3-30位英文/数字/下划线', trigger: 'blur' },
  ],
  password: [{ required: true, min: 8, message: '密码至少8位', trigger: 'blur' }],
  confirmPwd: [{ required: true, validator: (r, v, cb) => v !== form.password ? cb(new Error('两次密码不一致')) : cb(), trigger: 'blur' }],
};

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  // 填了手机号需要验证短信码
  if (smsEnabled.value && form.phone) {
    const vRes = await fetch('/api/v1/auth/sms/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: form.phone, code: form.smsCode }) });
    const vData = await vRes.json();
    if (!vRes.ok) { ElMessage.error(vData.message || '短信验证码错误'); return; }
  }
  loading.value = true;
  try {
    const res = await fetch('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.username, password: form.password, phone: form.phone }) });
    const data = await res.json();
    if (res.ok) { ElMessage.success('注册成功'); router.push('/login'); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('网络错误'); }
  finally { loading.value = false; }
}
</script>

<style scoped>
.auth-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-100); padding: 40px; }
.auth-card { width: 420px; background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 14px; padding: 40px 36px; }
.auth-header { text-align: center; margin-bottom: 32px; }
.auth-diamond { font-size: 20px; color: var(--gold); }
.auth-header h1 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--text-100); margin: 8px 0; }
.auth-header p { font-size: 13px; color: var(--text-200); }
.auth-card h2 { font-size: 20px; color: var(--text-100); margin-bottom: 20px; text-align: center; }
.auth-footer { text-align: center; margin-top: 20px; font-size: 13px; }
.auth-footer span { color: var(--text-200); }
.auth-footer a { color: var(--gold-dark); text-decoration: none; font-weight: 600; }
.auth-footer a:hover { text-decoration: underline; }
.input-counter-wrap { position: relative; width: 100%; }
.input-counter {
  position: absolute; right: 38px; top: 50%; transform: translateY(-50%);
  font-size: 11px; color: var(--text-200); background: var(--bg-100);
  padding: 1px 8px; border-radius: 4px; pointer-events: none; font-weight: 600; z-index: 1;
}
.input-counter-wrap :deep(.el-input--suffix .el-input__inner) { padding-right: 85px; }
@media (max-width: 500px) {
  .auth-card { width: 100%; padding: 30px 20px; }
  .auth-header h1 { font-size: 22px; }
}
</style>
