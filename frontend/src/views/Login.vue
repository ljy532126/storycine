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
          <el-input v-model="form.username" placeholder="请输入账号" prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" prefix-icon="Lock" />
        </el-form-item>

        <!-- 验证码 -->
        <el-form-item label="验证码" prop="captchaText">
          <div v-if="!sliderPassed" class="slider-wrap" @mousedown="sliderStart" @mousemove="sliderMove" @mouseup="sliderEnd" @mouseleave="sliderEnd" @touchstart="sliderStart" @touchmove="sliderMove" @touchend="sliderEnd">
            <div class="slider-track">
              <div class="slider-fill" :style="{width: sliderPercent + '%'}"></div>
              <div class="slider-btn" :style="{left: sliderPercent + '%'}" :class="{done: sliderPassed}">
                <span v-if="!sliderPassed">→</span><span v-else>✓</span>
              </div>
            </div>
            <div class="slider-text">{{ sliderPassed ? '验证通过 ✓' : '按住滑块拖到最右边' }}</div>
          </div>
          <div v-else class="slider-done">✅ 验证通过</div>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="rememberMe">记住登录</el-checkbox>
        </el-form-item>
        <el-button type="primary" @click="handleLogin" :loading="loading" style="width:100%">
          {{ loading ? '登录中...' : '登录' }}
        </el-button>
      </el-form>

      <div class="auth-footer">
        <span>还没有账号？</span>
        <router-link to="/register">立即注册 →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const rememberMe = ref(false);
const needCaptcha = ref(true);
const formRef = ref(null);
const form = reactive({ username: '', password: '', captchaText: '', captchaId: '' });
// 滑块验证
const sliderPassed = ref(false);
const sliderPercent = ref(0);
let sliderDragging = false;
let sliderStartX = 0;
let sliderTrackWidth = 0;

async function initCaptcha() {
  sliderPassed.value = false;
  sliderPercent.value = 0;
  try {
    const res = await fetch('/api/v1/auth/captcha/slider');
    const data = await res.json();
    form.captchaId = data.data.captchaId;
    form.captchaText = data.data.captchaText;
  } catch {}
}
function sliderStart(e) {
  if (sliderPassed.value) return;
  sliderDragging = true;
  const track = e.currentTarget.querySelector('.slider-track');
  sliderTrackWidth = track.offsetWidth - 40;
  sliderStartX = (e.touches ? e.touches[0].clientX : e.clientX) - sliderPercent.value / 100 * sliderTrackWidth;
}
function sliderMove(e) {
  if (!sliderDragging || sliderPassed.value) return;
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - sliderStartX;
  sliderPercent.value = Math.max(0, Math.min(100, (x / sliderTrackWidth) * 100));
}
async function sliderEnd() {
  sliderDragging = false;
  if (sliderPercent.value >= 90) {
    sliderPercent.value = 100;
    sliderPassed.value = true;
  } else if (!sliderPassed.value) {
    sliderPercent.value = 0;
  }
}
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }],
};

async function refreshCaptcha() {
  try {
    const res = await fetch('/api/v1/auth/captcha');
    const data = await res.json();
    form.captchaId = data.data.captchaId;
    captchaSvg.value = data.data.svg;
  } catch (e) {}
}

onMounted(() => {
  initCaptcha();
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
      initCaptcha();
      return;
    }
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (e) { ElMessage.error('网络错误'); }
  finally { loading.value = false; }
}
</script>

<style scoped>
.auth-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-100); padding: 40px; }
.auth-card { width: 420px; background: var(--bg-200); border: 1px solid var(--bg-300); padding: 44px 36px; }
.auth-header { text-align: center; margin-bottom: 32px; }
.auth-diamond { color: var(--gold); font-size: 16px; }
.auth-header h1 { font-family: 'Playfair Display', serif; color: var(--text-100); font-size: 24px; margin: 8px 0 4px; letter-spacing: 1px; }
.auth-header p { color: var(--text-200); font-size: 12px; letter-spacing: 2px; }
.auth-card h2 { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--text-100); text-align: center; margin-bottom: 28px; padding-bottom: 14px; border-bottom: 2px solid var(--gold); }
.slider-wrap { user-select: none; margin: 4px 0; }
.slider-track { position: relative; height: 40px; background: var(--bg-100); border-radius: 20px; overflow: hidden; border: 1px solid var(--bg-300); }
.slider-fill { position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-dark)); border-radius: 20px 0 0 20px; transition: width 0.05s; }
.slider-btn { position: absolute; top: 2px; width: 36px; height: 36px; background: var(--navy); color: var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; cursor: grab; transform: translateX(-18px); transition: background 0.2s; }
.slider-btn.done { background: var(--gold); color: var(--navy); cursor: default; }
.slider-btn:active { cursor: grabbing; }
.slider-text { text-align: center; font-size: 12px; color: var(--text-200); margin-top: 4px; }
.slider-done { text-align: center; padding: 8px; background: rgba(46,125,50,0.1); border-radius: 6px; font-size: 13px; color: #2E7D32; }
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
</style>
