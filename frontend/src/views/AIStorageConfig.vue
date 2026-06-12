<template>
  <div class="ac-root">
    <div class="ac-grid">
      <div class="ac-card">
        <h3 class="ac-card-title">对象存储配置</h3>
        <p class="ac-section-desc">生成的图片/视频自动上传至对象存储，获取公网URL供豆包API使用。关闭时使用服务器本地存储。</p>

        <div class="ac-row">
          <div class="ac-label-wrap">
            <span class="ac-label">启用对象存储</span>
            <span class="ac-desc">{{ stor.enabled ? '当前：对象存储模式（云存储）' : '当前：本地存储模式（服务器磁盘）' }}</span>
          </div>
          <el-switch v-model="stor.enabled" @change="saveStorage" />
        </div>

        <div class="ac-row">
          <span class="ac-label">存储厂商</span>
          <el-select v-model="stor.provider" size="small" style="width:200px" @change="onProviderChange">
            <el-option label="阿里云 OSS" value="aliyun_oss" />
            <el-option label="腾讯云 COS" value="tencent_cos" />
            <el-option label="MinIO (兼容S3)" value="minio" />
          </el-select>
        </div>

        <div class="ac-row" v-if="stor.provider !== 'minio'">
          <span class="ac-label">存储地域 <span class="ac-required">*</span></span>
          <el-select v-model="selectedRegion" size="small" style="width:260px" @change="onRegionChange"
            placeholder="请选择Bucket所在地域" filterable>
            <el-option v-for="r in regions" :key="r.region" :label="`${r.label} — ${r.endpoint}`" :value="r.region" />
          </el-select>
        </div>

        <div class="ac-row">
          <div class="ac-label-wrap">
            <span class="ac-label">Endpoint <span class="ac-required">*</span></span>
            <span class="ac-desc">
              {{ stor.provider !== 'minio' ? '选择地域后自动填充，Bucket地域必须与Endpoint一致' : 'MinIO服务器地址，如 127.0.0.1:9000' }}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <el-input v-model="stor.endpoint" size="small" style="width:280px"
              :placeholder="endpointPlaceholder"
              :readonly="!customEndpoint && stor.provider !== 'minio'"
              @change="onEndpointChange" />
            <el-tooltip v-if="stor.provider !== 'minio'" content="勾选后可手动输入自定义Endpoint" placement="top">
              <el-checkbox v-model="customEndpoint" size="small" style="white-space:nowrap;font-size:11px" @change="onCustomEndpointToggle">自定义</el-checkbox>
            </el-tooltip>
          </div>
        </div>

        <div v-if="stor.provider !== 'minio' && stor.endpoint && selectedRegion" class="ac-hint">
          <span>💡</span>
          <span>当前地域：<strong>{{ currentRegionLabel }}</strong>（<code>{{ currentRegionCode }}</code>），Endpoint：<code>{{ stor.endpoint }}</code>。请确保 Bucket 创建在同一地域，否则上传和测试连接将失败。</span>
        </div>

        <div class="ac-row">
          <span class="ac-label">AccessKey ID <span class="ac-required">*</span></span>
          <el-input v-model="stor.accessKeyId" size="small" style="width:320px" placeholder="您的 AccessKey ID" @change="saveStorage" />
        </div>
        <div class="ac-row">
          <span class="ac-label">AccessKey Secret <span class="ac-required">*</span></span>
          <el-input v-model="stor.accessKeySecret" size="small" style="width:320px" type="password" show-password
            :placeholder="stor._hasSecret ? '已保存（留空则不修改）' : '您的 AccessKey Secret'" @change="saveStorage" />
        </div>
        <div class="ac-row">
          <span class="ac-label">Bucket 名称 <span class="ac-required">*</span></span>
          <el-input v-model="stor.bucket" size="small" style="width:320px" placeholder="my-bucket" @change="saveStorage" />
        </div>
        <div class="ac-row">
          <span class="ac-label">存储路径前缀</span>
          <el-input v-model="stor.prefix" size="small" style="width:320px" placeholder="/autodrama/uploads/" @change="saveStorage" />
        </div>

        <div class="ac-row" style="justify-content:flex-start;gap:12px;border:none;padding-top:8px">
          <el-button type="primary" size="small" @click="testStorageConnection" :loading="testing">
            {{ testing ? '测试中...' : '测试连接' }}
          </el-button>
          <el-button size="small" @click="saveStorage">保存配置</el-button>
          <span v-if="testResult" :style="{ color: testResult.ok ? '#67C23A' : '#F56C6C', fontSize: '13px', marginLeft: '8px' }">
            {{ testResult.ok ? '✓' : '✗' }} {{ testResult.message }}
          </span>
        </div>
      </div>

      <div class="ac-card" :style="stor.enabled ? 'background:#E8F5E9;border-color:#A5D6A7' : 'background:var(--accent-200);border-color:var(--accent-100)'">
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-100)">
          <span style="font-size:20px">{{ stor.enabled ? '☁️' : '💡' }}</span>
          <span v-if="stor.enabled">
            对象存储已启用 — 生成素材自动上传至 <strong>{{ providerLabel }}</strong>
          </span>
          <span v-else>
            本地存储模式 — 素材保存在服务器 uploads/ 目录。配置对象存储后可自动切换。
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const stor = reactive({
  enabled: false, provider: 'minio', endpoint: '', accessKeyId: '',
  accessKeySecret: '', bucket: '', prefix: '/autodrama/uploads/', _hasSecret: false,
});
const testing = ref(false);
const testResult = ref(null);
const regions = ref([]);
const selectedRegion = ref('');
const customEndpoint = ref(false);

const endpointPlaceholder = computed(() => {
  const m = { aliyun_oss: 'oss-cn-beijing.aliyuncs.com', tencent_cos: 'cos.ap-beijing.myqcloud.com', minio: '127.0.0.1:9000' };
  return m[stor.provider] || '';
});
const providerLabel = computed(() => {
  const m = { aliyun_oss: '阿里云 OSS', tencent_cos: '腾讯云 COS', minio: 'MinIO' };
  return m[stor.provider] || stor.provider;
});
const currentRegionLabel = computed(() => {
  const r = regions.value.find(x => x.region === selectedRegion.value);
  return r ? r.label : '未知';
});
const currentRegionCode = computed(() => selectedRegion.value || '未知');

function matchRegionFromEndpoint(provider, endpoint) {
  if (!endpoint || !regions.value.length) return '';
  const found = regions.value.find(r => r.endpoint === endpoint);
  return found ? found.region : '';
}
function getEndpointFromRegion(region) {
  const found = regions.value.find(r => r.region === region);
  return found ? found.endpoint : '';
}

async function onProviderChange() {
  testResult.value = null; customEndpoint.value = false; selectedRegion.value = ''; stor.endpoint = '';
  await loadRegions();
  if (regions.value.length > 0) { selectedRegion.value = regions.value[0].region; stor.endpoint = regions.value[0].endpoint; }
  saveStorage();
}
function onRegionChange(region) { testResult.value = null; stor.endpoint = getEndpointFromRegion(region); saveStorage(); }
function onEndpointChange() { testResult.value = null; const matched = matchRegionFromEndpoint(stor.provider, stor.endpoint); if (matched) selectedRegion.value = matched; saveStorage(); }
function onCustomEndpointToggle(val) { if (!val) { stor.endpoint = getEndpointFromRegion(selectedRegion.value); testResult.value = null; } }

async function loadRegions() {
  if (stor.provider === 'minio') { regions.value = []; return; }
  try { const res = await fetch(`/api/v1/config/storage/regions?provider=${stor.provider}`); const data = await res.json(); regions.value = data.data || []; } catch (e) { regions.value = []; }
}

async function load() {
  try {
    const res = await fetch('/api/v1/config/all');
    const data = await res.json();
    if (data.data?.storageConfig) { Object.assign(stor, data.data.storageConfig); stor._hasSecret = !!data.data.storageConfig.accessKeySecret; }
    await loadRegions();
    if (stor.endpoint && stor.provider !== 'minio') {
      const matched = matchRegionFromEndpoint(stor.provider, stor.endpoint);
      if (matched) selectedRegion.value = matched; else customEndpoint.value = true;
    }
  } catch (e) {}
}

async function saveStorage() {
  try {
    const body = { ...stor }; delete body._hasSecret;
    const res = await fetch('/api/v1/config/storage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.data) stor._hasSecret = !!data.data.accessKeySecret;
  } catch (e) { ElMessage.error('哎呀，保存出错啦，再试一次哦'); }
}

async function testStorageConnection() {
  testing.value = true; testResult.value = null;
  try {
    const res = await fetch('/api/v1/config/storage/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stor }) });
    const data = await res.json(); testResult.value = data;
    if (data.ok) ElMessage.success('连接测试通过');
    else ElMessage.error(data.message);
  } catch (e) { testResult.value = { ok: false, message: '请求失败: ' + (e.message || '') }; }
  finally { testing.value = false; }
}

onMounted(() => { load(); });
</script>

<style scoped>
.ac-root { padding: 0; }
.ac-grid { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.ac-card { background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 18px 20px; transition: border-color 0.2s; }
.ac-card:hover { border-color: var(--gold); }
.ac-card-title { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700; color: var(--text-100); margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); }
.ac-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--bg-300); }
.ac-row:last-child { border-bottom: none; }
.ac-label { font-size: 13px; color: var(--text-100); font-weight: 600; }
.ac-desc { display: block; font-size: 11px; color: var(--text-200); margin-top: 2px; }
.ac-section-desc { font-size: 12px; color: var(--text-200); margin: -8px 0 12px; line-height: 1.5; }
.ac-required { color: #F56C6C; font-weight: 400; }
.ac-hint { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0; padding: 10px 14px; background: var(--accent-200); border-radius: 6px; font-size: 12px; color: var(--text-100); line-height: 1.6; border: 1px solid var(--accent-100); }
.ac-hint code { background: var(--bg-100); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
@media (max-width: 768px) {
  .ac-row { flex-direction: column; align-items: flex-start; gap: 6px; }
  .ac-card { padding: 14px 12px; }
  .ac-row .el-input, .ac-row .el-select { width: 100% !important; }
}
</style>
