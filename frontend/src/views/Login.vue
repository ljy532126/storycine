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

        <!-- 验证码（输错2次后显示） -->
        <el-form-item v-if="needCaptcha" label="验证码" prop="captchaText">
          <div class="captcha-row">
            <el-input v-model="form.captchaText" placeholder="请输入验证码" style="flex:1" />
            <div class="captcha-img" @click="refreshCaptcha" v-html="captchaSvg" title="点击刷新"></div>
          </div>
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
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const needCaptcha = ref(false);
const captchaSvg = ref('');
const formRef = ref(null);
const form = reactive({ username: '', password: '', captchaText: '', captchaId: '' });
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

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const body = { username: form.username, password: form.password };
    if (needCaptcha.value) Object.assign(body, { captchaId: form.captchaId, captchaText: form.captchaText });
    const res = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 400 && data.message.includes('输错')) { needCaptcha.value = true; refreshCaptcha(); }
      ElMessage.error(data.message || '登录失败');
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
.captcha-row { display: flex; gap: 12px; align-items: center; }
.captcha-img { cursor: pointer; border: 1px solid var(--bg-300); border-radius: 6px; overflow: hidden; height: 40px; flex-shrink: 0; }
.captcha-img:hover { border-color: var(--gold); }
.auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-200); }
.auth-footer a { color: var(--gold-dark); font-weight: 600; text-decoration: none; }
.auth-footer a:hover { color: var(--gold); }
</style>
