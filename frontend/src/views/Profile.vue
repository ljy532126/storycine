<template>
  <div class="pf-root">
    <div class="pf-cards">
      <!-- 头像 & 昵称 -->
      <div class="pf-card">
        <h3 class="pf-card-title">个人信息</h3>
        <div class="pf-avatar-row">
          <div class="pf-avatar" :style="{ background: avatarBg }" @click="triggerUpload">
            <img v-if="form.avatar" :src="form.avatar" />
            <span v-else>{{ avatarLetter }}</span>
            <div class="pf-avatar-edit">📷</div>
          </div>
          <input type="file" accept="image/*" ref="fileInput" hidden @change="onFileChange" />
          <div>
            <p class="pf-hint">点击头像上传新图片</p>
            <p class="pf-hint-sub">建议正方形，不超过 2MB</p>
          </div>
        </div>
        <el-form label-position="top" size="default" style="margin-top:16px">
          <el-form-item label="账号">
            <el-input :model-value="user.username" disabled />
          </el-form-item>
          <el-form-item label="昵称">
            <el-input v-model="form.nickname" placeholder="给自己取个昵称" maxlength="20" />
          </el-form-item>
          <el-button type="primary" @click="saveProfile" :loading="saving">保存</el-button>
        </el-form>
      </div>

      <!-- 修改密码 -->
      <div class="pf-card">
        <h3 class="pf-card-title">修改密码</h3>
        <el-form ref="pwdForm" :model="pwd" :rules="pwdRules" label-position="top" size="default">
          <el-form-item label="原密码" prop="oldPassword">
            <el-input v-model="pwd.oldPassword" type="password" show-password placeholder="输入当前密码" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="pwd.newPassword" type="password" show-password placeholder="至少6位" />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPwd">
            <el-input v-model="pwd.confirmPwd" type="password" show-password placeholder="再次输入" />
          </el-form-item>
          <el-button type="primary" @click="changePwd" :loading="changing">修改密码</el-button>
        </el-form>
      </div>

      <!-- 登录信息 -->
      <div class="pf-card">
        <h3 class="pf-card-title">登录信息</h3>
        <div class="pf-info-row">
          <span>用户ID</span>
          <strong class="pf-uid" @click="copyUid" :title="copied ? '已复制' : '点击复制'">{{ user.uid || '-' }}</strong>
        </div>
        <div class="pf-info-row"><span>角色</span><strong>{{ user.role === 'admin' ? '管理员' : '普通用户' }}</strong></div>
        <div class="pf-info-row"><span>注册时间</span><strong>{{ fmt(user.createdAt) }}</strong></div>
        <div class="pf-info-row"><span>最后登录</span><strong>{{ fmt(user.lastLoginAt) }}</strong></div>
        <div class="pf-info-row"><span>登录IP</span><strong>{{ user.lastLoginIp || '-' }}</strong></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

const route = useRoute();

const user = reactive({ username: '', nickname: '', avatar: '', role: '', createdAt: '', lastLoginAt: '', lastLoginIp: '' });
const form = reactive({ nickname: '', avatar: '' });
const saving = ref(false);
const changing = ref(false);
const copied = ref(false);

async function copyUid() {
  if (!user.uid) return;
  try { await navigator.clipboard.writeText(user.uid); copied.value = true; setTimeout(() => copied.value = false, 2000); } catch {}
}
const fileInput = ref(null);
const pwdForm = ref(null);

const pwd = reactive({ oldPassword: '', newPassword: '', confirmPwd: '' });
const pwdRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, min: 6, message: '新密码至少6位', trigger: 'blur' }],
  confirmPwd: [{ required: true, validator: (r, v, cb) => v !== pwd.newPassword ? cb(new Error('两次密码不一致')) : cb(), trigger: 'blur' }],
};

const avatarLetter = computed(() => (form.nickname || user.username || '?')[0]?.toUpperCase());
const avatarBg = computed(() => form.avatar ? 'transparent' : '#C9A84C');

function fmt(d) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }

function triggerUpload() { fileInput.value?.click(); }

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { ElMessage.warning('图片不能超过2MB'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => { form.avatar = ev.target.result; };
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function loadUser() {
  try {
    const res = await fetch('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    const d = (await res.json()).data;
    if (d) { Object.assign(user, d); form.nickname = d.nickname || ''; form.avatar = d.avatar || ''; localStorage.setItem('user', JSON.stringify(d)); }
  } catch (e) {}
}

async function saveProfile() {
  saving.value = true;
  try {
    const res = await fetch('/api/v1/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ nickname: form.nickname, avatar: form.avatar }),
    });
    const data = await res.json();
    if (res.ok) { user.nickname = form.nickname; user.avatar = form.avatar; localStorage.setItem('user', JSON.stringify(user)); ElMessage.success('已保存'); }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
}

async function changePwd() {
  const valid = await pwdForm.value?.validate().catch(() => false);
  if (!valid) return;
  changing.value = true;
  try {
    const res = await fetch('/api/v1/auth/password', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword }),
    });
    const data = await res.json();
    if (res.ok) { Object.assign(pwd, { oldPassword: '', newPassword: '', confirmPwd: '' }); ElMessage.success('密码已修改'); }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('修改失败'); }
  finally { changing.value = false; }
}

onMounted(() => loadUser());
watch(() => route.path, (p) => { if (p === '/profile') loadUser(); });
</script>

<style scoped>
.pf-root { padding: 0; max-width: 900px; }
.pf-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
.pf-card { background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 24px; }
.pf-card:nth-child(3) { grid-column: span 2; }
.pf-card-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--text-100); margin: 0 0 18px; padding-bottom: 10px; border-bottom: 2px solid var(--gold); }
.pf-avatar-row { display: flex; align-items: center; gap: 16px; }
.pf-avatar { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; font-size: 28px; font-weight: 700; color: var(--navy); flex-shrink: 0; }
.pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pf-avatar-edit { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); text-align: center; font-size: 14px; opacity: 0; transition: opacity 0.2s; }
.pf-avatar:hover .pf-avatar-edit { opacity: 1; }
.pf-hint { font-size: 13px; color: var(--text-100); margin: 0; }
.pf-hint-sub { font-size: 11px; color: var(--text-200); margin: 2px 0 0; }
.pf-info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--bg-300); font-size: 13px; }
.pf-info-row span { color: var(--text-200); }
.pf-info-row strong { color: var(--text-100); }
.pf-uid { cursor: pointer; font-family: 'Courier New', monospace; letter-spacing: 1px; user-select: all; }
.pf-uid:hover { color: var(--gold); }
@media (max-width: 700px) { .pf-cards { grid-template-columns: 1fr; } .pf-card:nth-child(3) { grid-column: span 1; } }
</style>
