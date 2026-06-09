<template>
  <div class="auth-root">
    <div class="auth-card">
      <div class="auth-header">
        <span class="auth-diamond">◆</span>
        <h1>StoryCine</h1>
        <p>全自动AI短剧生成平台</p>
      </div>

      <h2>登录</h2>

      <!-- 切换模式 -->
      <div class="auth-mode-tabs" v-if="smsEnabled">
        <span :class="{ active: loginMode === 'password' }" @click="loginMode = 'password'">密码登录</span>
        <span :class="{ active: loginMode === 'sms' }" @click="loginMode = 'sms'">短信登录</span>
      </div>

      <!-- 密码登录 -->
      <el-form v-if="loginMode === 'password'" ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="handleLogin">
        <el-form-item label="账号" prop="username">
          <div class="input-counter-wrap">
            <el-input v-model="form.username" placeholder="请输入账号" maxlength="30" />
            <span v-if="form.username" class="input-counter">{{ form.username.length }}/30</span>
          </div>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <div class="input-counter-wrap">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" maxlength="50" />
            <span v-if="form.password" class="input-counter">{{ form.password.length }}/50</span>
          </div>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="rememberMe">记住登录</el-checkbox>
        </el-form-item>
        <el-button type="primary" @click="handleLogin" :loading="loading" style="width:100%" size="large">
          {{ loading ? '登录中...' : '登录' }}
        </el-button>
      </el-form>

      <!-- 短信登录 -->
      <div v-else>
        <SmsCodeInput v-model:phone="smsForm.phone" v-model:code="smsForm.code" scene="login" code-width="130px" />
        <el-button type="primary" @click="handleSmsLogin" :loading="loading" :disabled="!smsForm.phone || !smsForm.code" style="width:100%;margin-top:12px" size="large">
          {{ loading ? '登录中...' : '短信登录' }}
        </el-button>
      </div>

      <div class="auth-footer">
        <span>还没有账号？</span>
        <router-link to="/register">立即注册 →</router-link>
      </div>
      <div style="text-align:center;margin-top:8px">
        <el-button v-if="smsEnabled" type="info" link size="small" @click="smsVisible = true">忘记密码？短信找回</el-button>
      </div>
    </div>

    <!-- 短信找回密码弹窗 -->
    <el-dialog v-model="smsVisible" title="短信找回密码" width="400px" destroy-on-close center>
      <el-steps :active="smsStep" finish-status="success" align-center simple style="margin-bottom:24px">
        <el-step title="验证身份" />
        <el-step title="重置密码" />
      </el-steps>
      <div v-if="smsStep === 0">
        <SmsCodeInput v-model:phone="forgotForm.phone" v-model:code="forgotForm.code" scene="resetPwd" code-width="130px" />
        <el-button type="primary" @click="verifyForgotCode" :loading="smsVerifying" :disabled="!forgotForm.phone || !forgotForm.code" style="width:100%;margin-top:12px" size="large">下一步</el-button>
      </div>
      <div v-else>
        <div class="input-counter-wrap" style="margin-bottom:14px">
          <el-input v-model="forgotForm.newPassword" type="password" show-password placeholder="新密码（至少8位）" maxlength="50" size="large" />
          <span v-if="forgotForm.newPassword" class="input-counter">{{ forgotForm.newPassword.length }}/50</span>
        </div>
        <div class="input-counter-wrap" style="margin-bottom:14px">
          <el-input v-model="forgotForm.confirmPwd" type="password" show-password placeholder="确认新密码" maxlength="50" size="large" />
          <span v-if="forgotForm.confirmPwd" class="input-counter">{{ forgotForm.confirmPwd.length }}/50</span>
        </div>
        <el-button type="primary" @click="resetPasswordBySms" :loading="smsResetting" :disabled="!forgotForm.newPassword || forgotForm.newPassword !== forgotForm.confirmPwd" style="width:100%" size="large">重置密码</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import SmsCodeInput from '../components/SmsCodeInput.vue';

const router = useRouter();
const loading = ref(false);
const rememberMe = ref(false);
const formRef = ref(null);
const loginMode = ref('password');
const smsEnabled = ref(false);
const form = reactive({ username: '', password: '' });

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }],
};

onMounted(async () => {
  const reason = sessionStorage.getItem('logout_reason');
  if (reason) { sessionStorage.removeItem('logout_reason'); ElMessage.warning(reason); }
  try { const r = await fetch('/api/v1/auth/sms/status'); const d = await r.json(); smsEnabled.value = d.data?.enabled || false; } catch {}
});

// 密码登录
async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const res = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.username, password: form.password }) });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '登录失败'); return; }
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch { ElMessage.error('网络错误'); }
  finally { loading.value = false; }
}

// 短信登录
const smsForm = reactive({ phone: '', code: '' });

async function handleSmsLogin() {
  loading.value = true;
  try {
    const res = await fetch('/api/v1/auth/login-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: smsForm.phone, code: smsForm.code }) });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '登录失败'); loading.value = false; return; }
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch { ElMessage.error('网络错误'); }
  finally { loading.value = false; }
}

// 找回密码
const smsVisible = ref(false);
const smsStep = ref(0);
const smsVerifying = ref(false);
const smsResetting = ref(false);
const forgotForm = reactive({ phone: '', code: '', newPassword: '', confirmPwd: '' });

async function verifyForgotCode() {
  if (!forgotForm.phone) { ElMessage.warning('请输入手机号'); return; }
  if (!forgotForm.code) { ElMessage.warning('请输入验证码'); return; }
  smsStep.value = 1; // 直接进第二步，重置密码时后端会校验验证码

async function resetPasswordBySms() {
  if (!forgotForm.newPassword || forgotForm.newPassword.length < 8) { ElMessage.warning('密码至少8位'); return; }
  if (forgotForm.newPassword !== forgotForm.confirmPwd) { ElMessage.warning('两次密码不一致'); return; }
  smsResetting.value = true;
  try {
    const res = await fetch('/api/v1/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: forgotForm.phone, code: forgotForm.code, newPassword: forgotForm.newPassword }) });
    const data = await res.json();
    if (res.ok) { ElMessage.success('密码已重置，请重新登录'); smsVisible.value = false; smsStep.value = 0; Object.assign(forgotForm, { phone: '', code: '', newPassword: '', confirmPwd: '' }); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('重置失败'); }
  finally { smsResetting.value = false; }
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

.auth-mode-tabs { display: flex; gap: 0; margin-bottom: 22px; border: 1px solid var(--bg-300); border-radius: 8px; overflow: hidden; }
.auth-mode-tabs span { flex: 1; text-align: center; padding: 10px 0; font-size: 13px; cursor: pointer; color: var(--text-200); background: var(--bg-100); transition: all 0.15s; font-weight: 500; }
.auth-mode-tabs span.active { background: var(--navy); color: var(--gold); font-weight: 700; }
.auth-mode-tabs span:hover:not(.active) { color: var(--text-100); }

.auth-footer { text-align: center; margin-top: 20px; font-size: 13px; }
.auth-footer span { color: var(--text-200); }
.auth-footer a { color: var(--gold-dark); text-decoration: none; font-weight: 600; }
.auth-footer a:hover { text-decoration: underline; }

.input-counter-wrap { position: relative; width: 100%; }
.input-counter {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  font-size: 11px; color: var(--text-200); background: var(--bg-100);
  padding: 1px 8px; border-radius: 4px; pointer-events: none; font-weight: 600; z-index: 2;
}

/* 把验证码输入框的 show-password 图标空间留出来 */
.input-counter-wrap :deep(.el-input--suffix .el-input__inner) { padding-right: 50px; }

@media (max-width: 500px) {
  .auth-card { width: 100%; padding: 30px 20px; }
  .auth-header h1 { font-size: 22px; }
}
</style>
