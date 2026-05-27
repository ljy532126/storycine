<template>
  <div class="um-root">
    <div class="breadcrumb">
      <router-link to="/dashboard" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">用户管理</span>
    </div>

    <!-- 搜索栏 -->
    <div class="um-toolbar">
      <el-input v-model="search" placeholder="搜索账号" size="default" style="width:200px" clearable @clear="fetchUsers" @keyup.enter="fetchUsers" />
      <el-select v-model="statusFilter" size="default" style="width:130px;margin-left:8px" clearable placeholder="全部状态" @change="fetchUsers">
        <el-option label="正常" value="active" />
        <el-option label="已禁用" value="disabled" />
        <el-option label="已封禁" value="banned" />
      </el-select>
      <el-button type="primary" size="default" style="margin-left:8px" @click="fetchUsers">搜索</el-button>
      <span class="um-total">共 {{ total }} 个用户</span>
    </div>

    <!-- 用户表格 -->
    <el-table :data="users" stripe style="width:100%" v-loading="loading">
      <el-table-column prop="username" label="账号" min-width="120" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">{{ row.role === 'admin' ? '管理员' : '普通用户' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : row.status === 'banned' ? 'danger' : 'warning'" size="small">
            {{ statusMap[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginIp" label="最后登录IP" width="150" />
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="最后登录" width="170">
        <template #default="{ row }">{{ fmt(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="viewLogs(row)">日志</el-button>
          <el-button size="small" type="success" v-if="row.status !== 'active'" @click="setStatus(row, 'active')">启用</el-button>
          <el-button size="small" type="warning" v-if="row.status === 'active'" @click="setStatus(row, 'disabled')">禁用</el-button>
          <el-button size="small" type="danger" v-if="row.status !== 'banned'" @click="setStatus(row, 'banned')">封禁</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="um-pager" v-if="total > size">
      <el-pagination background layout="prev, pager, next" :page-size="size" :total="total" :current-page="page" @current-change="p => { page = p; fetchUsers(); }" />
    </div>

    <!-- 登录日志弹窗 -->
    <el-dialog v-model="logVisible" :title="'登录日志 — ' + logUser" width="700px" destroy-on-close>
      <el-table :data="logs" stripe max-height="400" v-loading="logLoading" size="small">
        <el-table-column label="时间" width="170"><template #default="{ row }">{{ fmt(row.createdAt) }}</template></el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="120" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const users = ref([]);
const loading = ref(false);
const search = ref('');
const statusFilter = ref('');
const page = ref(1);
const size = ref(20);
const total = ref(0);
const statusMap = { active: '正常', disabled: '已禁用', banned: '已封禁' };

const logVisible = ref(false);
const logUser = ref('');
const logs = ref([]);
const logLoading = ref(false);

function fmt(d) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }

async function fetchUsers() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, size: size.value });
    if (search.value) params.set('search', search.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    const res = await fetch(`/api/v1/auth/users?${params}`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    const data = await res.json();
    users.value = data.data?.users || [];
    total.value = data.data?.total || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

async function setStatus(row, status) {
  try {
    const res = await fetch(`/api/v1/auth/users/${row._id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) { row.status = status; ElMessage.success(data.message || '已更新'); }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('操作失败'); }
}

async function viewLogs(row) {
  logUser.value = row.username;
  logVisible.value = true;
  logLoading.value = true;
  try {
    const res = await fetch(`/api/v1/auth/users/${row._id}/logs`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    const data = await res.json();
    logs.value = data.data?.logs || [];
  } catch (e) { logs.value = []; }
  finally { logLoading.value = false; }
}

onMounted(() => fetchUsers());
</script>

<style scoped>
.um-root { padding: 0; }
.um-toolbar { display: flex; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 8px; }
.um-total { margin-left: auto; font-size: 13px; color: var(--text-200); }
.um-pager { display: flex; justify-content: center; margin-top: 20px; }
</style>
