<template>
  <div class="page">
    <div class="page-header">
      <div class="breadcrumb">
        <router-link to="/" class="bc-link">导演台</router-link>
        <span class="bc-sep"> &gt; </span>
        <span class="bc-current">系统设置</span>
      </div>
    </div>

    <!-- 顶层 Tab 导航 -->
    <div class="settings-tabs">
      <span :class="['st-tab', { active: settingsTab === 'llm' }]" @click="settingsTab = 'llm'">LLM配置</span>
      <span :class="['st-tab', { active: settingsTab === 'image' }]" @click="settingsTab = 'image'">生图设置</span>
      <span :class="['st-tab', { active: settingsTab === 'storage' }]" @click="settingsTab = 'storage'">存储设置</span>
    </div>

    <!-- ===== LLM 配置 ===== -->
    <div v-show="settingsTab === 'llm'">
    <el-row :gutter="24">
      <el-col :span="14">
        <el-card class="section-card" shadow="never">
          <template #header><span class="card-title">LLM 大模型配置</span></template>
          <el-alert v-if="llmStatus.configured" :title="`当前活跃: ${llmStatus.activeProvider} (${llmStatus.model})`" type="success" :closable="false" show-icon style="margin-bottom:20px" />
          <el-alert v-else title="尚未配置任何LLM，请至少配置一个provider的API密钥" type="warning" :closable="false" show-icon style="margin-bottom:20px" />

          <el-tabs v-model="activeProvider">
            <el-tab-pane label="DeepSeek" name="deepseek">
              <el-form label-position="top">
                <el-form-item>
                  <template #label><span>API Key</span></template>
                  <el-input v-model="form.deepseek.apiKey" type="password" show-password placeholder="sk-..." />
                  <div style="margin-top:2px"><a href="https://platform.deepseek.com/api_keys" target="_blank" class="key-link">🔑 获取 Key →</a></div>
                </el-form-item>
                <el-form-item label="Base URL"><el-input v-model="form.deepseek.baseUrl" placeholder="https://api.deepseek.com/v1" /></el-form-item>
                <el-form-item label="Model">
                  <el-select v-model="form.deepseek.model" filterable allow-create>
                    <el-option v-for="m in deepseekModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </el-form-item>
                <div style="display:flex;gap:8px">
                  <el-button type="primary" @click="saveConfig('deepseek')" :loading="saving">保存</el-button>
                  <el-button @click="testConnection('deepseek')" :loading="testing === 'deepseek'" :type="testResults['deepseek'] === true ? 'success' : testResults['deepseek'] === false ? 'danger' : ''">{{ testBtnLabel('deepseek') }}</el-button>
                </div>
              </el-form>
            </el-tab-pane>
            <el-tab-pane label="OpenAI" name="openai">
              <el-form label-position="top">
                <el-form-item>
                  <template #label><span>API Key</span></template>
                  <el-input v-model="form.openai.apiKey" type="password" show-password placeholder="sk-..." />
                  <div style="margin-top:2px"><a href="https://platform.openai.com/api-keys" target="_blank" class="key-link">🔑 获取 Key →</a></div>
                </el-form-item>
                <el-form-item label="Base URL"><el-input v-model="form.openai.baseUrl" placeholder="https://api.openai.com/v1" /></el-form-item>
                <el-form-item label="Chat Model">
                  <el-select v-model="form.openai.model" filterable allow-create>
                    <el-option v-for="m in openaiModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </el-form-item>
                <el-form-item label="Image Model (生图)">
                  <el-select v-model="form.openai.imageModel" filterable allow-create>
                    <el-option v-for="m in openaiImageModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </el-form-item>
                <div style="display:flex;gap:8px">
                  <el-button type="primary" @click="saveConfig('openai')" :loading="saving">保存</el-button>
                  <el-button @click="testConnection('openai')" :loading="testing === 'openai'" :type="testResults['openai'] === true ? 'success' : testResults['openai'] === false ? 'danger' : ''">{{ testBtnLabel('openai') }}</el-button>
                </div>
              </el-form>
            </el-tab-pane>
            <el-tab-pane label="豆包 / Seedance" name="doubao">
              <el-form label-position="top">
                <el-form-item>
                  <template #label><span>API Key</span></template>
                  <el-input v-model="form.doubao.apiKey" type="password" show-password placeholder="输入火山方舟 API Key" />
                  <div style="margin-top:2px"><a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank" class="key-link">🔑 获取 Key →</a></div>
                </el-form-item>
                <el-form-item label="Base URL"><el-input v-model="form.doubao.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" /></el-form-item>
                <el-form-item label="视频/聊天模型 (Seedance/Chat)">
                  <el-select v-model="form.doubao.model" filterable allow-create>
                    <el-option v-for="m in doubaoModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </el-form-item>
                <el-form-item label="生图模型 (Seedream)">
                  <el-select v-model="form.doubao.imageModel" filterable allow-create>
                    <el-option v-for="m in seedreamModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </el-form-item>
                <div style="display:flex;gap:8px">
                  <el-button type="primary" @click="saveConfig('doubao')" :loading="saving">保存</el-button>
                  <el-button @click="testConnection('doubao')" :loading="testing === 'doubao'" :type="testResults['doubao'] === true ? 'success' : testResults['doubao'] === false ? 'danger' : ''">{{ testBtnLabel('doubao') }}</el-button>
                </div>
              </el-form>
            </el-tab-pane>
            <el-tab-pane label="通义 (Tongyi)" name="tongyi">
              <el-form label-position="top">
                <el-form-item>
                  <template #label><span>API Key</span></template>
                  <el-input v-model="form.tongyi.apiKey" type="password" show-password placeholder="输入通义API Key" />
                  <div style="margin-top:2px"><a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" class="key-link">🔑 获取 Key →</a></div>
                </el-form-item>
                <el-form-item label="Base URL"><el-input v-model="form.tongyi.baseUrl" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" /></el-form-item>
                <el-form-item label="Model">
                  <el-select v-model="form.tongyi.model" filterable allow-create>
                    <el-option v-for="m in tongyiModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </el-form-item>
                <div style="display:flex;gap:8px">
                  <el-button type="primary" @click="saveConfig('tongyi')" :loading="saving">保存</el-button>
                  <el-button @click="testConnection('tongyi')" :loading="testing === 'tongyi'" :type="testResults['tongyi'] === true ? 'success' : testResults['tongyi'] === false ? 'danger' : ''">{{ testBtnLabel('tongyi') }}</el-button>
                </div>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card class="section-card" shadow="never">
          <template #header><span class="card-title">当前配置状态</span></template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="DeepSeek"><el-tag :type="summary.deepseek?.apiKey ? 'success' : 'info'">{{ summary.deepseek?.apiKey || '未配置' }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="OpenAI"><el-tag :type="summary.openai.apiKey ? 'success' : 'info'">{{ summary.openai.apiKey || '未配置' }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="豆包"><el-tag :type="summary.doubao.apiKey ? 'success' : 'info'">{{ summary.doubao.apiKey || '未配置' }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="通义"><el-tag :type="summary.tongyi.apiKey ? 'success' : 'info'">{{ summary.tongyi.apiKey || '未配置' }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="活跃Provider"><el-tag type="success">{{ summary.activeProvider }}</el-tag></el-descriptions-item>
          </el-descriptions>
          <el-divider />
          <el-alert type="info" :closable="false" show-icon>
            <template #title>密钥已保存到 MongoDB 数据库，重启后自动加载，无需重新输入。<br/>也可在 backend/.env 中设置环境变量（数据库值优先）。</template>
          </el-alert>
          <el-divider />
          <el-button @click="refreshStatus" :loading="loading">刷新状态</el-button>
        </el-card>
      </el-col>
    </el-row>
    </div>

    <!-- ===== 生图设置 ===== -->
    <!-- ===== 生图设置 ===== -->
    <div v-show="settingsTab === 'image'" class="st-section">
      <div class="ac-grid">
        <div class="ac-card">
          <h3 class="ac-card-title">水印 / 文字控制</h3>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">禁止生成任何文字/水印</span><span class="ac-desc">自动在所有提示词中追加禁止文字、logo、乱码的约束，同时关闭豆包API自带水印</span></div><el-switch v-model="imgCfg.noTextWatermark" @change="saveImgCfg" /></div>
        </div>
        <div class="ac-card">
          <h3 class="ac-card-title">画质 / 风格默认参数</h3>
          <div class="ac-row"><span class="ac-label">图片默认画质</span><el-select v-model="imgCfg.imageQuality" size="small" @change="saveImgCfg" style="width:160px"><el-option label="8K" value="8K"/><el-option label="4K" value="4K"/><el-option label="2K" value="2K"/></el-select></div>
          <div class="ac-row"><span class="ac-label">图片默认风格</span><el-select v-model="imgCfg.imageStyle" size="small" @change="saveImgCfg" style="width:160px"><el-option label="超写实" value="超写实"/><el-option label="古风" value="古风"/><el-option label="动漫" value="动漫"/><el-option label="电影级" value="电影级"/></el-select></div>
          <div class="ac-row"><span class="ac-label">视频默认时长</span><el-select v-model="imgCfg.videoDuration" size="small" @change="saveImgCfg" style="width:160px"><el-option label="10s" :value="10"/><el-option label="15s" :value="15"/><el-option label="30s" :value="30"/></el-select></div>
          <div class="ac-row"><span class="ac-label">视频默认分辨率</span><el-select v-model="imgCfg.videoResolution" size="small" @change="saveImgCfg" style="width:160px"><el-option label="1080p" value="1080p"/><el-option label="2K (1440p)" value="2K"/></el-select></div>
        </div>
        <div class="ac-card">
          <h3 class="ac-card-title">豆包模型专属参数</h3>
          <div class="ac-row"><span class="ac-label">角色生图默认比例</span><el-select v-model="imgCfg.characterRatio" size="small" @change="saveImgCfg" style="width:160px"><el-option label="16:9 横屏" value="16:9"/><el-option label="9:16 竖屏" value="9:16"/><el-option label="4:3 方形" value="4:3"/></el-select></div>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">生视频风格化模式</span><span class="ac-desc">降低 Seedance 真人内容审核拦截概率</span></div><el-switch v-model="imgCfg.noRealPerson" @change="saveImgCfg"/></div>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">生图风格化（遮挡模式）</span><span class="ac-desc">对所有生图模型有效</span></div><el-switch v-model="imgCfg.characterStyleMode" @change="saveImgCfg"/></div>
        </div>
        <div class="ac-card" style="background:var(--accent-200);border-color:var(--accent-100)"><div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-100)"><span style="font-size:20px">💡</span><span>配置自动保存，全局生效。单个镜头生成时可临时覆盖。</span></div></div>
      </div>
    </div>

    <!-- ===== 存储设置 ===== -->
    <div v-show="settingsTab === 'storage'" class="st-section">
      <div class="ac-grid">
        <div class="ac-card">
          <h3 class="ac-card-title">对象存储配置</h3>
          <p class="ac-section-desc">生成的图片/视频自动上传至对象存储，获取公网URL供豆包API使用。关闭时使用服务器本地存储。</p>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">启用对象存储</span><span class="ac-desc">{{ stor.enabled ? '当前：对象存储模式（云存储）' : '当前：本地存储模式（服务器磁盘）' }}</span></div><el-switch v-model="stor.enabled" @change="saveStor"/></div>
          <div class="ac-row"><span class="ac-label">存储厂商</span><el-select v-model="stor.provider" size="small" style="width:200px" @change="onProviderChange"><el-option label="阿里云 OSS" value="aliyun_oss"/><el-option label="腾讯云 COS" value="tencent_cos"/><el-option label="MinIO" value="minio"/></el-select></div>
          <div class="ac-row" v-if="stor.provider !== 'minio'"><span class="ac-label">存储地域 <span class="ac-required">*</span></span><el-select v-model="selRegion" size="small" style="width:260px" @change="onRegionChange" placeholder="请选择Bucket所在地域" filterable><el-option v-for="r in storRegions" :key="r.region" :label="`${r.label} — ${r.endpoint}`" :value="r.region"/></el-select></div>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">Endpoint</span><span class="ac-desc">{{ stor.provider !== 'minio' ? '选择地域后自动填充' : 'MinIO服务器地址' }}</span></div><div style="display:flex;align-items:center;gap:6px"><el-input v-model="stor.endpoint" size="small" style="width:280px" :placeholder="epPlaceholder" :readonly="!customEp && stor.provider !== 'minio'" @change="saveStor"/><el-checkbox v-if="stor.provider !== 'minio'" v-model="customEp" size="small" style="white-space:nowrap;font-size:11px">自定义</el-checkbox></div></div>
          <div v-if="stor.provider !== 'minio' && stor.endpoint && selRegion" class="ac-hint"><span>💡</span><span>当前地域：<strong>{{ curRegionLabel }}</strong>（<code>{{ curRegionCode }}</code>），Endpoint：<code>{{ stor.endpoint }}</code></span></div>
          <div class="ac-row"><span class="ac-label">AccessKey ID</span><el-input v-model="stor.accessKeyId" size="small" style="width:320px" placeholder="您的 AccessKey ID" @change="saveStor"/></div>
          <div class="ac-row"><span class="ac-label">AccessKey Secret</span><el-input v-model="stor.accessKeySecret" size="small" style="width:320px" type="password" show-password :placeholder="stor._hasSecret ? '已保存（留空不修改）' : '您的 AccessKey Secret'" @change="saveStor"/></div>
          <div class="ac-row"><span class="ac-label">Bucket 名称</span><el-input v-model="stor.bucket" size="small" style="width:320px" placeholder="my-bucket" @change="saveStor"/></div>
          <div class="ac-row"><span class="ac-label">存储路径前缀</span><el-input v-model="stor.prefix" size="small" style="width:320px" placeholder="/autodrama/uploads/" @change="saveStor"/></div>
          <div class="ac-row" style="justify-content:flex-start;gap:12px;border:none;padding-top:8px"><el-button type="primary" size="small" @click="testStorConnection" :loading="storTesting">{{ storTesting ? '测试中...' : '测试连接' }}</el-button><el-button size="small" @click="saveStor">保存配置</el-button><span v-if="storResult" :style="{ color: storResult.ok ? '#67C23A' : '#F56C6C', fontSize:'13px', marginLeft:'8px' }">{{ storResult.ok ? '✓' : '✗' }} {{ storResult.message }}</span></div>
        </div>
        <div class="ac-card" :style="stor.enabled ? 'background:#E8F5E9;border-color:#A5D6A7' : 'background:var(--accent-200);border-color:var(--accent-100)'"><div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-100)"><span style="font-size:20px">{{ stor.enabled ? '☁️' : '💡' }}</span><span v-if="stor.enabled">对象存储已启用 — 生成素材自动上传至 <strong>{{ providerLabel }}</strong></span><span v-else>本地存储模式 — 素材保存在服务器 uploads/ 目录</span></div></div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { configAPI } from '../api';

const settingsTab = ref('llm');
const activeProvider = ref('deepseek');
const saving = ref(false);
const loading = ref(false);
const testing = ref('');
const testResults = reactive({});

function testBtnLabel(p) {
  if (testing.value === p) return '测试中...';
  if (testResults[p] === true) return '✓ 连接成功';
  if (testResults[p] === false) return '✗ 连接失败';
  return '测试连接';
}

async function testConnection(provider) {
  const cfg = form[provider];
  if (!cfg.apiKey) { ElMessage.warning('请先填写 API Key'); return; }
  testing.value = provider;
  try {
    const res = await configAPI.testLLMConnection({ provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model });
    testResults[provider] = res.data?.ok;
    ElMessage.success(res.message || (res.data?.ok ? '连接成功' : '连接失败'));
  } catch (e) {
    testResults[provider] = false;
    ElMessage.error('测试失败: ' + (e.response?.data?.message || e.message));
  }
  finally { testing.value = ''; }
}
const llmStatus = reactive({ configured: false, activeProvider: '', model: '' });
const summary = reactive({ deepseek: { apiKey: '' }, doubao: { apiKey: '' }, tongyi: { apiKey: '' }, openai: { apiKey: '' }, activeProvider: '' });
const form = reactive({
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', imageModel: '' },
  doubao: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seedance-2-0-260128', imageModel: '' },
  tongyi: { apiKey: '', baseUrl: '', model: '' },
});
const deepseekModels = ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v3', 'deepseek-r1'];
const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const openaiImageModels = ['gpt-image-2', 'dall-e-3', 'dall-e-2'];
const doubaoModels = ['doubao-seedance-2-0-260128', 'doubao-pro-32k', 'doubao-lite-32k'];
const seedreamModels = ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'];
const tongyiModels = ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen2.5-72b-instruct'];

onMounted(() => { refreshStatus(); });

async function refreshStatus() {
  loading.value = true;
  try { const [cfgRes, statusRes] = await Promise.all([configAPI.getLLMConfig(), configAPI.getLLMStatus()]); Object.assign(summary, cfgRes.data); Object.assign(llmStatus, statusRes.data); }
  catch (e) { console.error('Failed to load config:', e); }
  finally { loading.value = false; }
}

async function saveConfig(provider) {
  saving.value = true;
  try { const cfg = form[provider]; await configAPI.updateLLMConfig({ provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, imageModel: cfg.imageModel || '' }); ElMessage.success(`${provider} 已保存到数据库，重启不丢失`); await refreshStatus(); }
  catch (e) { ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message)); }
  finally { saving.value = false; }
}

// ===== 生图设置 =====
const imgCfg = reactive({ noTextWatermark: true, imageQuality: '8K', imageStyle: '超写实', videoDuration: 15, videoResolution: '2K', noRealPerson: true, characterRatio: '16:9', characterStyleMode: false });
window.__aiConfig = imgCfg;
async function loadImgCfg() { try { const r = await fetch('/api/v1/config/all'); const d = await r.json(); if (d.data?.aiConfig) Object.assign(imgCfg, d.data.aiConfig); window.__aiConfig = imgCfg; } catch {} }
async function saveImgCfg() { try { await fetch('/api/v1/config/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imgCfg) }); window.__aiConfig = imgCfg; } catch {} }

// ===== 存储设置 =====
const stor = reactive({ enabled: false, provider: 'minio', endpoint: '', accessKeyId: '', accessKeySecret: '', bucket: '', prefix: '/autodrama/uploads/', _hasSecret: false });
const storTesting = ref(false); const storResult = ref(null); const storRegions = ref([]); const selRegion = ref(''); const customEp = ref(false);
const epPlaceholder = computed(() => ({ aliyun_oss: 'oss-cn-beijing.aliyuncs.com', tencent_cos: 'cos.ap-beijing.myqcloud.com', minio: '127.0.0.1:9000' }[stor.provider] || ''));
const providerLabel = computed(() => ({ aliyun_oss: '阿里云 OSS', tencent_cos: '腾讯云 COS', minio: 'MinIO' }[stor.provider] || ''));
const curRegionLabel = computed(() => { const r = storRegions.value.find(x => x.region === selRegion.value); return r ? r.label : '未知'; });
const curRegionCode = computed(() => selRegion.value || '未知');
function getEpFromRegion(r) { const f = storRegions.value.find(x => x.region === r); return f ? f.endpoint : ''; }
function regionFromEp(ep) { const f = storRegions.value.find(x => x.endpoint === ep); return f ? f.region : ''; }
async function onProviderChange() { storResult.value = null; customEp.value = false; selRegion.value = ''; stor.endpoint = ''; await loadRegions(); if (storRegions.value.length > 0) { selRegion.value = storRegions.value[0].region; stor.endpoint = storRegions.value[0].endpoint; } saveStor(); }
function onRegionChange(r) { storResult.value = null; stor.endpoint = getEpFromRegion(r); saveStor(); }
async function loadRegions() { if (stor.provider === 'minio') { storRegions.value = []; return; } try { const r = await fetch(`/api/v1/config/storage/regions?provider=${stor.provider}`); const d = await r.json(); storRegions.value = d.data || []; } catch {} }
async function loadStorCfg() { try { const r = await fetch('/api/v1/config/all'); const d = await r.json(); if (d.data?.storageConfig) { Object.assign(stor, d.data.storageConfig); stor._hasSecret = !!d.data.storageConfig.accessKeySecret; } await loadRegions(); if (stor.endpoint && stor.provider !== 'minio') { const m = regionFromEp(stor.endpoint); if (m) selRegion.value = m; else customEp.value = true; } } catch {} }
async function saveStor() { try { const b = { ...stor }; delete b._hasSecret; await fetch('/api/v1/config/storage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); } catch {} }
async function testStorConnection() { storTesting.value = true; storResult.value = null; try { const r = await fetch('/api/v1/config/storage/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...stor }) }); storResult.value = await r.json(); } catch {} finally { storTesting.value = false; } }

onMounted(() => { loadImgCfg(); loadStorCfg(); });
</script>

<style scoped>
/* ===== ART DECO SETTINGS ===== */
.page { padding: 0; }
.page-header { margin-bottom: 24px; }
.section-card { border: 1px solid var(--gold) !important; border-radius: 10px !important; box-shadow: 0 4px 20px rgba(139,105,20,0.06) !important; }
.card-title { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 16px; color: var(--text-100); letter-spacing: 0.5px; }
.key-link { font-size: 12px; color: var(--gold); text-decoration: none; font-weight: 600; margin-left: 8px; }
.key-link:hover { color: var(--gold-dark); text-decoration: underline; }

/* Settings Tabs */
.settings-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid var(--bg-300); padding-bottom: 0; }
.st-tab { font-size: 14px; padding: 10px 20px; cursor: pointer; color: var(--text-200); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; user-select: none; font-weight: 500; }
.st-tab:hover { color: var(--text-100); }
.st-tab.active { color: var(--text-100); font-weight: 700; border-bottom-color: var(--gold); }

.st-section { margin-top: 0; }
.ac-grid { display: flex; flex-direction: column; gap: 16px; }
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
  .el-col { margin-bottom: 8px; }
}
</style>
