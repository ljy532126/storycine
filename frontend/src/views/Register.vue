<template>
  <div class="auth-root">
    <div class="auth-card">
      <div class="auth-header">
        <span class="auth-diamond">◆</span>
        <h1>StoryCine</h1>
        <p>全自动AI短剧生成平台</p>
      </div>

      <h2>注册</h2>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @keyup.enter="handleRegister">
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" placeholder="3-30个字符" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPwd">
          <el-input v-model="form.confirmPwd" type="password" show-password placeholder="再次输入密码" />
        </el-form-item>
        <el-form-item label="验证码" prop="captchaText">
          <div class="captcha-row">
            <el-input v-model="form.captchaText" placeholder="请输入验证码" maxlength="4" style="flex:1" />
            <div class="captcha-svg" v-html="captchaSvg" @click="refreshCaptcha" title="点击刷新验证码"></div>
          </div>
        </el-form-item>
        <el-button type="primary" @click="handleRegister" :loading="loading" style="width:100%">
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

const router = useRouter();
const loading = ref(false);
const formRef = ref(null);
const captchaSvg = ref('');

async function refreshCaptcha() {
  try {
    const res = await fetch('/api/v1/auth/captcha');
    const data = await res.json();
    form.captchaId = data.data.captchaId;
    captchaSvg.value = data.data.svg;
  } catch {}
}

const form = reactive({ username: '', password: '', confirmPwd: '', captchaText: '', captchaId: '' });

const validateConfirm = (rule, value, cb) => {
  if (value !== form.password) cb(new Error('两次密码不一致'));
  else cb();
};
const rules = {
  username: [{ required: true, min: 3, max: 30, message: '账号3-30个字符', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }],
  confirmPwd: [{ required: true, validator: validateConfirm, trigger: 'blur' }],
  captchaText: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
};

async function handleRegister() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, password: form.password, captchaId: form.captchaId, captchaText: form.captchaText }),
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message); refreshCaptcha(); return; }
    ElMessage.success('注册成功，即将跳转登录');
    setTimeout(() => router.push('/login'), 1000);
  } catch (e) { ElMessage.error('网络错误'); }
  finally { loading.value = false; }
}

onMounted(() => refreshCaptcha());
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
</style>
