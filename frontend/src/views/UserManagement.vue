<template>
  <div class="um-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">用户管理</span>
    </div>

    <!-- 统计卡片 -->
    <div class="um-stats">
      <div class="um-stat-card">
        <div class="um-stat-icon" style="background:rgba(201,168,76,0.12)"><People theme="outline" size="22" fill="var(--gold)" /></div>
        <div class="um-stat-body">
          <span class="um-stat-num">{{ total }}</span>
          <span class="um-stat-label">注册用户</span>
        </div>
      </div>
      <div class="um-stat-card">
        <div class="um-stat-icon" style="background:rgba(103,194,58,0.12)"><CheckOne theme="outline" size="22" fill="#67c23a" /></div>
        <div class="um-stat-body">
          <span class="um-stat-num">{{ statCounts.active }}</span>
          <span class="um-stat-label">正常用户</span>
        </div>
      </div>
      <div class="um-stat-card">
        <div class="um-stat-icon" style="background:rgba(230,162,60,0.12)"><Time theme="outline" size="22" fill="#e6a23c" /></div>
        <div class="um-stat-body">
          <span class="um-stat-num">{{ statCounts.todayNew }}</span>
          <span class="um-stat-label">今日新增</span>
        </div>
      </div>
      <div class="um-stat-card">
        <div class="um-stat-icon" style="background:rgba(201,168,76,0.1)"><FolderOpen theme="outline" size="22" fill="var(--primary-100)" /></div>
        <div class="um-stat-body">
          <span class="um-stat-num">{{ statCounts.admin }}</span>
          <span class="um-stat-label">管理员</span>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="um-toolbar">
      <div class="um-tb-left">
        <el-input v-model="search" placeholder="搜索账号 / 昵称 / UID" size="default" style="width:240px" clearable @clear="fetchUsers" @keyup.enter="fetchUsers" />
        <el-select v-model="statusFilter" size="default" style="width:120px" clearable placeholder="全部状态" @change="fetchUsers">
          <el-option label="正常" value="active" />
          <el-option label="已禁用" value="disabled" />
          <el-option label="已封禁" value="banned" />
        </el-select>
        <el-select v-model="roleFilter" size="default" style="width:120px" clearable placeholder="全部角色" @change="fetchUsers">
          <el-option label="管理员" value="admin" />
          <el-option label="普通用户" value="user" />
        </el-select>
        <el-button type="primary" size="default" @click="fetchUsers">🔍 搜索</el-button>
      </div>
      <div class="um-tb-right">
        <el-button size="default" @click="fetchUsers" :loading="loading">🔄</el-button>
        <span class="um-total">共 {{ total }} 个用户</span>
      </div>
    </div>

    <!-- 用户卡片列表 -->
    <div class="um-list" v-loading="loading">
      <div v-for="u in users" :key="u._id" class="um-user-card" :class="{ 'um-disabled': u.status !== 'active' }" @click="openDetail(u)">
        <div class="um-card-left">
          <div class="um-avatar" :style="{ backgroundImage: u.avatar ? 'url('+u.avatar+')' : '', background: u.avatar ? '' : getAvatarBg(u) }">
            <span v-if="!u.avatar">{{ (u.nickname || u.username || '?')[0]?.toUpperCase() }}</span>
          </div>
        </div>
        <div class="um-card-body">
          <div class="um-card-row1">
            <span class="um-uname">{{ u.nickname || u.username }}</span>
            <span class="um-uid" @click.stop="copyUID(u.uid)" :title="copiedUID === u.uid ? '已复制' : '点击复制UID'">{{ u.uid }}</span>
            <el-tag :type="u.role === 'admin' ? 'danger' : ''" size="small" effect="plain">{{ u.role === 'admin' ? '管理员' : '用户' }}</el-tag>
            <el-tag :type="statusTag(u.status)" size="small" effect="plain">{{ statusMap[u.status] }}</el-tag>
          </div>
          <div class="um-card-row2">
            <span>@{{ u.username }}</span>
            <span>{{ fmt(u.createdAt) }} 注册</span>
            <span v-if="u.lastLoginAt">最后登录 {{ fmt(u.lastLoginAt) }}</span>
          </div>
          <div class="um-card-row3">
            <span v-if="u.lastLoginIp">IP: {{ u.lastLoginIp }}</span>
            <span v-if="u.loginAttempts > 0" style="color:var(--gold)">登录失败 {{ u.loginAttempts }} 次</span>
          </div>
        </div>
        <div class="um-card-right" @click.stop>
          <el-dropdown trigger="click" @command="(cmd) => handleAction(cmd, u)">
            <el-button size="small" circle>···</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logs">📋 登录日志</el-dropdown-item>
                <el-dropdown-item command="active" v-if="u.status !== 'active'">✅ 启用</el-dropdown-item>
                <el-dropdown-item command="disabled" v-if="u.status === 'active'">⏸ 禁用</el-dropdown-item>
                <el-dropdown-item command="banned" v-if="u.status !== 'banned'" divided>🚫 封禁</el-dropdown-item>
                <el-dropdown-item command="resetPwd">🔑 重置密码</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <el-empty v-if="users.length === 0 && !loading" description="无匹配用户" :image-size="60" />
    </div>

    <!-- 分页 -->
    <div class="um-pager" v-if="total > size">
      <el-pagination background layout="prev, pager, next" :page-size="size" :total="total" :current-page="page" @current-change="p => { page = p; fetchUsers(); }" />
    </div>

    <!-- 用户详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detailUser?.nickname || detailUser?.username || '用户详情'" size="420px" destroy-on-close>
      <template v-if="detailUser">
        <div class="um-detail-avatar">
          <div class="um-d-avatar" :style="{ backgroundImage: detailUser.avatar ? 'url('+detailUser.avatar+')' : '', background: detailUser.avatar ? '' : getAvatarBg(detailUser) }">
            <span v-if="!detailUser.avatar">{{ (detailUser.nickname || detailUser.username || '?')[0]?.toUpperCase() }}</span>
          </div>
          <div>
            <div class="um-d-name">{{ detailUser.nickname || detailUser.username }}</div>
            <div class="um-d-role">@{{ detailUser.username }} · {{ detailUser.role === 'admin' ? '管理员' : '普通用户' }}</div>
          </div>
        </div>

        <el-descriptions :column="1" border size="small" style="margin-top:20px">
          <el-descriptions-item label="UID">{{ detailUser.uid }}
            <el-button size="small" link @click="copyUID(detailUser.uid)">{{ copiedUID === detailUser.uid ? '已复制' : '复制' }}</el-button>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(detailUser.status)" size="small">{{ statusMap[detailUser.status] }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ fmt(detailUser.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="最后登录">{{ fmt(detailUser.lastLoginAt) }}</el-descriptions-item>
          <el-descriptions-item label="最后登录 IP">{{ detailUser.lastLoginIp || '—' }}</el-descriptions-item>
          <el-descriptions-item label="登录失败次数">{{ detailUser.loginAttempts || 0 }}</el-descriptions-item>
          <el-descriptions-item label="锁定期限">{{ detailUser.lockedUntil ? fmt(detailUser.lockedUntil) : '—' }}</el-descriptions-item>
        </el-descriptions>

        <div class="um-detail-actions" style="margin-top:20px;display:flex;flex-wrap:wrap;gap:8px">
          <el-button size="small" @click="handleAction('logs', detailUser); detailVisible = false">登录日志</el-button>
          <el-button size="small" type="success" v-if="detailUser.status !== 'active'" @click="handleAction('active', detailUser)">启用</el-button>
          <el-button size="small" type="warning" v-if="detailUser.status === 'active'" @click="handleAction('disabled', detailUser)">禁用</el-button>
          <el-button size="small" type="danger" v-if="detailUser.status !== 'banned'" @click="handleAction('banned', detailUser)">封禁</el-button>
          <el-button size="small" type="warning" @click="handleAction('resetPwd', detailUser)">重置密码</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 登录日志弹窗 -->
    <el-dialog v-model="logVisible" :title="'登录日志 — ' + logUser" width="760px" destroy-on-close>
      <el-table :data="logs" stripe max-height="450" v-loading="logLoading" size="small">
        <el-table-column label="时间" width="160"><template #default="{ row }">{{ fmt(row.createdAt) }}</template></el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column label="地理位置" min-width="160">
          <template #default="{ row }">
            <span v-if="row.geoInfo?.country">{{ row.geoInfo.country }} {{ row.geoInfo.province }} {{ row.geoInfo.city }}</span>
            <span v-else style="color:var(--text-200)">—</span>
          </template>
        </el-table-column>
        <el-table-column label="运营商" width="100">
          <template #default="{ row }">{{ row.geoInfo?.isp || '—' }}</template>
        </el-table-column>
        <el-table-column label="结果" width="70">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="100" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="420px" destroy-on-close>
      <p style="color:var(--text-200);margin-bottom:14px">为 <strong>{{ resetUser?.username }}</strong> 设置新密码</p>
      <el-input v-model="newPassword" type="password" show-password placeholder="至少8位" style="margin-bottom:12px" />
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" @click="doResetPwd" :loading="resetting">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { People, CheckOne, Time, FolderOpen } from '@icon-park/vue-next';

const users = ref([]);
const loading = ref(false);
const search = ref('');
const statusFilter = ref('');
const roleFilter = ref('');
const page = ref(1);
const size = ref(20);
const total = ref(0);
const statusMap = { active: '正常', disabled: '已禁用', banned: '已封禁' };
const statCounts = reactive({ active: 0, todayNew: 0, admin: 0 });

const detailVisible = ref(false);
const detailUser = ref(null);
const copiedUID = ref('');

const logVisible = ref(false);
const logUser = ref('');
const logs = ref([]);
const logLoading = ref(false);

const resetVisible = ref(false);
const resetUser = ref(null);
const newPassword = ref('');
const resetting = ref(false);

function fmt(d) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }
function statusTag(s) { return s === 'active' ? 'success' : s === 'banned' ? 'danger' : 'warning'; }
function getAvatarBg(u) {
  const colors = ['#c9a84c','#6b8fa3','#8B7355','#7b6ba3','#409eff','#67c23a','#e6a23c'];
  const idx = (u.username || '?').charCodeAt(0) % colors.length;
  return colors[idx];
}

const token = () => localStorage.getItem('token');

async function fetchUsers() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, size: size.value });
    if (search.value) params.set('search', search.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (roleFilter.value) params.set('role', roleFilter.value);
    const res = await fetch(`/api/v1/auth/users?${params}`, { headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    users.value = data.data?.users || [];
    total.value = data.data?.total || 0;
    // 统计
    if (data.data?.stats) Object.assign(statCounts, data.data.stats);
    else {
      statCounts.active = users.value.filter(u => u.status === 'active').length;
      statCounts.admin = users.value.filter(u => u.role === 'admin').length;
      const today = new Date().toDateString();
      statCounts.todayNew = users.value.filter(u => new Date(u.createdAt).toDateString() === today).length;
    }
  } catch (e) { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

function openDetail(u) { detailUser.value = u; detailVisible.value = true; }

async function copyUID(uid) {
  if (!uid) return;
  try { await navigator.clipboard.writeText(uid); copiedUID.value = uid; setTimeout(() => { if (copiedUID.value === uid) copiedUID.value = ''; }, 2000); } catch {}
}

function handleAction(cmd, u) {
  if (cmd === 'logs') { viewLogs(u); return; }
  if (cmd === 'resetPwd') { resetUser.value = u; newPassword.value = ''; resetVisible.value = true; return; }
  setStatus(u, cmd);
}

async function setStatus(row, status) {
  try { await ElMessageBox.confirm(`确认将 "${row.username}" 设为「${statusMap[status]}」？`, '提示', { type: 'warning' }); } catch { return; }
  try {
    const res = await fetch(`/api/v1/auth/users/${row._id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) { row.status = status; ElMessage.success(data.message || '已更新'); }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('操作失败'); }
}

async function doResetPwd() {
  if (!newPassword.value || newPassword.value.length < 8) { ElMessage.warning('密码至少8位'); return; }
  resetting.value = true;
  try {
    const res = await fetch(`/api/v1/auth/users/${resetUser.value._id}/reset-password`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ newPassword: newPassword.value }),
    });
    const data = await res.json();
    if (res.ok) { ElMessage.success('密码已重置'); resetVisible.value = false; }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('操作失败'); }
  finally { resetting.value = false; }
}

async function viewLogs(row) {
  logUser.value = row.username;
  logVisible.value = true;
  logLoading.value = true;
  try {
    const res = await fetch(`/api/v1/auth/users/${row._id}/logs`, { headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    logs.value = data.data?.logs || [];
  } catch (e) { logs.value = []; }
  finally { logLoading.value = false; }
}

onMounted(() => fetchUsers());
</script>

<style scoped>
.um-root { padding: 0; }

/* 统计卡片 */
.um-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.um-stat-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 16px 18px; transition: all 0.2s;
}
.um-stat-card:hover { border-color: var(--gold); }
.um-stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.um-stat-body { display: flex; flex-direction: column; gap: 1px; }
.um-stat-num { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; color: var(--text-100); line-height: 1; }
.um-stat-label { font-size: 11px; color: var(--text-200); text-transform: uppercase; letter-spacing: 0.5px; }

/* 工具栏 */
.um-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 8px; flex-wrap: wrap; }
.um-tb-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.um-tb-right { display: flex; align-items: center; gap: 8px; }
.um-total { font-size: 13px; color: var(--text-200); white-space: nowrap; }

/* 卡片列表 */
.um-list { display: flex; flex-direction: column; gap: 8px; }
.um-user-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 14px 18px; cursor: pointer; transition: all 0.2s;
}
.um-user-card:hover { border-color: var(--gold); }
.um-disabled { opacity: 0.55; }
.um-card-left { flex-shrink: 0; }
.um-avatar {
  width: 46px; height: 46px; border-radius: 50%; background-size: cover; background-position: center;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px; font-weight: 700;
}
.um-card-body { flex: 1; min-width: 0; }
.um-card-right { flex-shrink: 0; }
.um-card-row1 { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; flex-wrap: wrap; }
.um-card-row2 { display: flex; gap: 12px; font-size: 12px; color: var(--text-200); }
.um-card-row3 { display: flex; gap: 12px; font-size: 11px; color: var(--primary-300); margin-top: 2px; }
.um-uname { font-size: 14px; font-weight: 700; color: var(--text-100); }
.um-uid {
  font-size: 10px; font-family: 'Courier New', monospace; color: var(--primary-300);
  background: var(--bg-100); padding: 1px 6px; border-radius: 3px; cursor: pointer; user-select: all;
}
.um-uid:hover { color: var(--gold); }

/* 详情抽屉 */
.um-detail-avatar { display: flex; align-items: center; gap: 14px; }
.um-d-avatar {
  width: 64px; height: 64px; border-radius: 50%; background-size: cover; background-position: center;
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 700; flex-shrink: 0;
}
.um-d-name { font-size: 18px; font-weight: 700; color: var(--text-100); }
.um-d-role { font-size: 12px; color: var(--text-200); margin-top: 2px; }

.um-pager { display: flex; justify-content: center; margin-top: 20px; }

@media (max-width: 768px) {
  .um-stats { grid-template-columns: repeat(2, 1fr); }
  .um-toolbar { flex-direction: column; align-items: stretch; }
  .um-tb-left { flex-wrap: wrap; }
  .um-card-row2 { flex-wrap: wrap; gap: 6px; }
}
</style>
