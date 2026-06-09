<template>
  <div class="auth-root">
    <div class="auth-card">
      <div class="auth-header">
        <span class="auth-diamond">◆</span>
        <h1>StoryCine</h1>
        <p>全自动AI短剧生成平台</p>
      </div>

      <h2>登录</h2>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="handleLogin">
        <el-form-item label="账号" prop="username">
          <div class="input-counter-wrap">
            <el-input v-model="form.username" placeholder="请输入账号" prefix-icon="User" maxlength="30" />
            <span v-if="form.username" class="input-counter">{{ form.username.length }}/30</span>
          </div>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <div class="input-counter-wrap">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" prefix-icon="Lock" maxlength="50" />
            <span v-if="form.password" class="input-counter">{{ form.password.length }}/50</span>
          </div>
        </el-form-item>

        <!-- 验证码 -->
        <el-form-item label="验证码" prop="captchaText">
          <div class="captcha-row">
            <div class="input-counter-wrap" style="flex:1">
              <el-input v-model="form.captchaText" placeholder="请输入验证码" maxlength="4" />
              <span v-if="form.captchaText" class="input-counter">{{ form.captchaText.length }}/4</span>
            </div>
            <div class="captcha-svg" v-html="captchaSvg" @click="refreshCaptcha" title="点击刷新验证码"></div>
          </div>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="rememberMe">记住登录</el-checkbox>
        </el-form-item>
        <el-button type="primary" @click="handleLogin" :loading="loading" style="width:100%">
          {{ loading ? '登录中...' : '登录' }}
        </el-button>
        <div style="text-align:center;margin-top:12px">
          <el-button type="info" link size="small" @click="smsVisible = true">忘记密码？短信找回</el-button>
        </div>
      </el-form>

      <div class="auth-footer">
        <span>还没有账号？</span>
        <router-link to="/register">立即注册 →</router-link>
      </div>
    </div>

    <!-- 短信找回密码弹窗 -->
    <el-dialog v-model="smsVisible" title="短信找回密码" width="400px" destroy-on-close center>
      <el-steps :active="smsStep" finish-status="success" align-center simple style="margin-bottom:24px">
        <el-step title="验证身份" />
        <el-step title="重置密码" />
      </el-steps>

      <!-- 步骤1：输入手机号 + 验证码 -->
      <div v-if="smsStep === 0">
        <div class="input-counter-wrap" style="margin-bottom:14px">
          <el-input v-model="smsForm.phone" placeholder="输入绑定手机号" maxlength="11" size="large" />
          <span v-if="smsForm.phone" class="input-counter">{{ smsForm.phone.length }}/11</span>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <div class="input-counter-wrap" style="flex:1">
            <el-input v-model="smsForm.code" placeholder="短信验证码" maxlength="6" size="large" />
            <span v-if="smsForm.code" class="input-counter">{{ smsForm.code.length }}/6</span>
          </div>
          <el-button @click="sendSmsCode" :loading="smsSending" :disabled="smsCountdown > 0 || !smsForm.phone" size="large" style="min-width:120px">
            {{ smsCountdown > 0 ? smsCountdown + 's' : smsSending ? '发送中' : '获取验证码' }}
          </el-button>
        </div>
        <el-button type="primary" @click="verifySmsCode" :loading="smsVerifying" :disabled="!smsForm.phone || !smsForm.code" style="width:100%" size="large">下一步</el-button>
      </div>

      <!-- 步骤2：设置新密码 -->
      <div v-else>
        <div class="input-counter-wrap" style="margin-bottom:14px">
          <el-input v-model="smsForm.newPassword" type="password" show-password placeholder="新密码（至少8位）" maxlength="50" size="large" />
          <span v-if="smsForm.newPassword" class="input-counter">{{ smsForm.newPassword.length }}/50</span>
        </div>
        <div class="input-counter-wrap" style="margin-bottom:14px">
          <el-input v-model="smsForm.confirmPwd" type="password" show-password placeholder="确认新密码" maxlength="50" size="large" />
          <span v-if="smsForm.confirmPwd" class="input-counter">{{ smsForm.confirmPwd.length }}/50</span>
        </div>
        <el-button type="primary" @click="resetPasswordBySms" :loading="smsResetting" :disabled="!smsForm.newPassword || smsForm.newPassword !== smsForm.confirmPwd" style="width:100%" size="large">重置密码</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const rememberMe = ref(false);
const formRef = ref(null);
const captchaSvg = ref('');
const form = reactive({ username: '', password: '', captchaText: '', captchaId: '' });

async function refreshCaptcha() {
  try {
    const res = await fetch('/api/v1/auth/captcha');
    const data = await res.json();
    form.captchaId = data.data.captchaId;
    captchaSvg.value = data.data.svg;
  } catch {}
}
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }],
};

onMounted(() => {
  refreshCaptcha();
  // 显示被踢出的原因
  const reason = sessionStorage.getItem('logout_reason');
  if (reason) {
    sessionStorage.removeItem('logout_reason');
    ElMessage.warning(reason);
  }
});

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const body = { username: form.username, password: form.password, captchaId: form.captchaId, captchaText: form.captchaText };
    const res = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      ElMessage.error(data.message || '登录失败');
      refreshCaptcha();
      return;
    }
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (e) { ElMessage.error('网络错误'); }
  finally { loading.value = false; }
}

// ===== 短信找回密码 =====
const smsVisible = ref(false);
const smsStep = ref(0);
const smsSending = ref(false);
const smsCountdown = ref(0);
const smsVerifying = ref(false);
const smsResetting = ref(false);
const smsForm = reactive({ phone: '', code: '', newPassword: '', confirmPwd: '' });
let smsTimer = null;

async function sendSmsCode() {
  if (smsCountdown.value > 0) return;
  smsSending.value = true;
  try {
    const res = await fetch('/api/v1/auth/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: smsForm.phone }) });
    const data = await res.json();
    if (res.ok) { ElMessage.success(data.message || '验证码已发送'); smsCountdown.value = 60; smsTimer = setInterval(() => { smsCountdown.value--; if (smsCountdown.value <= 0) clearInterval(smsTimer); }, 1000); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('发送失败'); }
  finally { smsSending.value = false; }
}

async function verifySmsCode() {
  smsVerifying.value = true;
  try {
    const res = await fetch('/api/v1/auth/sms/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: smsForm.phone, code: smsForm.code }) });
    const data = await res.json();
    if (res.ok) { smsStep.value = 1; ElMessage.success('验证通过'); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('验证失败'); }
  finally { smsVerifying.value = false; }
}

async function resetPasswordBySms() {
  if (!smsForm.newPassword || smsForm.newPassword.length < 8) { ElMessage.warning('密码至少8位'); return; }
  if (smsForm.newPassword !== smsForm.confirmPwd) { ElMessage.warning('两次密码不一致'); return; }
  smsResetting.value = true;
  try {
    const res = await fetch('/api/v1/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: smsForm.phone, code: smsForm.code, newPassword: smsForm.newPassword }) });
    const data = await res.json();
    if (res.ok) { ElMessage.success('密码已重置，请重新登录'); smsVisible.value = false; smsStep.value = 0; smsForm.phone = ''; smsForm.code = ''; smsForm.newPassword = ''; smsForm.confirmPwd = ''; }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('重置失败'); }
  finally { smsResetting.value = false; }
}

onUnmounted(() => { if (smsTimer) clearInterval(smsTimer); });
</script>

<style scoped>
.auth-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-100); padding: 40px; }
.auth-card { width: 420px; background: var(--bg-200); border: 1px solid var(--bg-300); padding: 44px 36px; }
.auth-header { text-align: center; margin-bottom: 32px; }
.auth-diamond { color: var(--gold); font-size: 16px; }
.auth-header h1 { font-family: 'Playfair Display', serif; color: var(--text-100); font-size: 24px; margin: 8px 0 4px; letter-spacing: 1px; }
.auth-header p { color: var(--text-200); font-size: 12px; letter-spacing: 2px; }
.auth-card h2 { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--text-100); text-align: center; margin-bottom: 28px; padding-bottom: 14px; border-bottom: 2px solid var(--gold); }
.captcha-row { display: flex; gap: 10px; align-items: center; }
.captcha-svg { width: 110px; height: 40px; cursor: pointer; border: 1px solid var(--bg-300); border-radius: 6px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #FBF7F0; }
.captcha-svg:hover { border-color: var(--gold); }
.auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-200); }
.auth-footer a { color: var(--gold-dark); font-weight: 600; text-decoration: none; }
.auth-footer a:hover { color: var(--gold); }
@media (max-width: 768px) {
  .auth-root { padding: 16px; align-items: flex-start; padding-top: 60px; }
  .auth-card { width: 100%; max-width: 420px; padding: 28px 20px; }
  .auth-header { margin-bottom: 24px; }
  .auth-header h1 { font-size: 20px; }
  .auth-card h2 { font-size: 18px; margin-bottom: 20px; }
}

/* 输入计数 */
.input-counter-wrap { position: relative; width: 100%; }
.input-counter {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  font-size: 11px; color: var(--text-200); background: var(--bg-100);
  padding: 1px 8px; border-radius: 4px; pointer-events: none;
  font-weight: 600; z-index: 2; font-family: 'DM Sans', sans-serif;
  transition: color 0.2s;
}
</style>
