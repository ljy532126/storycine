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
      <span v-if="isAdmin" :class="['st-tab', { active: settingsTab === 'storage' }]" @click="settingsTab = 'storage'">存储设置</span>
      <span :class="['st-tab', { active: settingsTab === 'tts' }]" @click="settingsTab = 'tts'">火山 TTS 配音</span>
      <span :class="['st-tab', { active: settingsTab === 'changelog' }]" @click="settingsTab = 'changelog'">📋 更新日志</span>
      <span :class="['st-tab', { active: settingsTab === 'profile' }]" @click="settingsTab = 'profile'">👤 个人中心</span>
    </div>

    <!-- ===== LLM 配置 ===== -->
    <div v-show="settingsTab === 'llm'" class="st-section">
      <div class="ac-grid">
        <!-- 状态卡片：当前活跃 -->
        <div class="ac-card ac-llm-status" :class="{ 'ac-llm-ready': llmStatus.configured }">
          <div class="ac-llm-status-left">
            <span class="ac-llm-status-icon">{{ llmStatus.configured ? '✓' : '⚡' }}</span>
            <div>
              <div class="ac-llm-status-title">{{ llmStatus.configured ? '已连接' : '未配置' }}</div>
              <div class="ac-llm-status-sub" v-if="llmStatus.configured">{{ llmStatus.activeProvider }} · {{ llmStatus.model }}</div>
              <div class="ac-llm-status-sub" v-else>请至少配置一个 Provider 的 API Key</div>
            </div>
          </div>
          <el-button size="small" @click="refreshStatus" :loading="loading" class="ac-llm-refresh">刷新</el-button>
        </div>

        <!-- Provider 选项卡 -->
        <div class="ac-card ac-llm-providers">
          <el-tabs v-model="activeProvider" class="ac-llm-tabs">
            <el-tab-pane name="deepseek">
              <template #label>
                <span class="ac-llm-tab-label">
                  <span class="ac-llm-tab-dot" style="background:#409eff"></span> DeepSeek
                </span>
              </template>
              <div class="ac-llm-form">
                <div class="ac-llm-row">
                  <label>API Key</label>
                  <el-input v-model="form.deepseek.apiKey" type="password" show-password placeholder="sk-..." size="default" />
                  <a href="https://platform.deepseek.com/api_keys" target="_blank" class="ac-key-link">获取 Key →</a>
                </div>
                <div class="ac-llm-row">
                  <label>Base URL</label>
                  <el-input v-model="form.deepseek.baseUrl" placeholder="https://api.deepseek.com/v1" size="default" />
                </div>
                <div class="ac-llm-row">
                  <label>Model</label>
                  <el-select v-model="form.deepseek.model" filterable allow-create style="width:100%">
                    <el-option v-for="m in deepseekModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </div>
                <div class="ac-llm-actions">
                  <el-button type="primary" @click="saveConfig('deepseek')" :loading="saving"><el-icon><Check /></el-icon> 保存</el-button>
                  <el-button @click="testConnection('deepseek')" :loading="testing === 'deepseek'" :type="testResults['deepseek'] === true ? 'success' : testResults['deepseek'] === false ? 'danger' : ''">{{ testBtnLabel('deepseek') }}</el-button>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane name="openai">
              <template #label>
                <span class="ac-llm-tab-label">
                  <span class="ac-llm-tab-dot" style="background:#67c23a"></span> OpenAI
                </span>
              </template>
              <div class="ac-llm-form">
                <div class="ac-llm-row">
                  <label>API Key</label>
                  <el-input v-model="form.openai.apiKey" type="password" show-password placeholder="sk-..." size="default" />
                  <a href="https://platform.openai.com/api-keys" target="_blank" class="ac-key-link">获取 Key →</a>
                </div>
                <div class="ac-llm-row">
                  <label>Base URL</label>
                  <el-input v-model="form.openai.baseUrl" placeholder="https://api.openai.com/v1" size="default" />
                </div>
                <div class="ac-llm-row">
                  <label>Chat Model</label>
                  <el-select v-model="form.openai.model" filterable allow-create style="width:100%">
                    <el-option v-for="m in openaiModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </div>
                <div class="ac-llm-row">
                  <label>Image Model</label>
                  <el-select v-model="form.openai.imageModel" filterable allow-create style="width:100%">
                    <el-option v-for="m in openaiImageModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </div>
                <div class="ac-llm-actions">
                  <el-button type="primary" @click="saveConfig('openai')" :loading="saving"><el-icon><Check /></el-icon> 保存</el-button>
                  <el-button @click="testConnection('openai')" :loading="testing === 'openai'" :type="testResults['openai'] === true ? 'success' : testResults['openai'] === false ? 'danger' : ''">{{ testBtnLabel('openai') }}</el-button>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane name="doubao">
              <template #label>
                <span class="ac-llm-tab-label">
                  <span class="ac-llm-tab-dot" style="background:#e6a23c"></span> 豆包 / Seedance
                </span>
              </template>
              <div class="ac-llm-form">
                <div class="ac-llm-row">
                  <label>API Key</label>
                  <el-input v-model="form.doubao.apiKey" type="password" show-password placeholder="输入火山方舟 API Key" size="default" />
                  <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank" class="ac-key-link">获取 Key →</a>
                </div>
                <div class="ac-llm-row">
                  <label>Base URL</label>
                  <el-input v-model="form.doubao.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" size="default" />
                </div>
                <div class="ac-llm-row">
                  <label>视频/聊天模型</label>
                  <el-select v-model="form.doubao.model" filterable allow-create style="width:100%">
                    <el-option v-for="m in doubaoModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </div>
                <div class="ac-llm-row">
                  <label>生图模型</label>
                  <el-select v-model="form.doubao.imageModel" filterable allow-create style="width:100%">
                    <el-option v-for="m in seedreamModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </div>
                <div class="ac-llm-actions">
                  <el-button type="primary" @click="saveConfig('doubao')" :loading="saving"><el-icon><Check /></el-icon> 保存</el-button>
                  <el-button @click="testConnection('doubao')" :loading="testing === 'doubao'" :type="testResults['doubao'] === true ? 'success' : testResults['doubao'] === false ? 'danger' : ''">{{ testBtnLabel('doubao') }}</el-button>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane name="tongyi">
              <template #label>
                <span class="ac-llm-tab-label">
                  <span class="ac-llm-tab-dot" style="background:#9b59b6"></span> 通义
                </span>
              </template>
              <div class="ac-llm-form">
                <div class="ac-llm-row">
                  <label>API Key</label>
                  <el-input v-model="form.tongyi.apiKey" type="password" show-password placeholder="输入通义 API Key" size="default" />
                  <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" class="ac-key-link">获取 Key →</a>
                </div>
                <div class="ac-llm-row">
                  <label>Base URL</label>
                  <el-input v-model="form.tongyi.baseUrl" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" size="default" />
                </div>
                <div class="ac-llm-row">
                  <label>Model</label>
                  <el-select v-model="form.tongyi.model" filterable allow-create style="width:100%">
                    <el-option v-for="m in tongyiModels" :key="m" :label="m" :value="m" />
                  </el-select>
                </div>
                <div class="ac-llm-actions">
                  <el-button type="primary" @click="saveConfig('tongyi')" :loading="saving"><el-icon><Check /></el-icon> 保存</el-button>
                  <el-button @click="testConnection('tongyi')" :loading="testing === 'tongyi'" :type="testResults['tongyi'] === true ? 'success' : testResults['tongyi'] === false ? 'danger' : ''">{{ testBtnLabel('tongyi') }}</el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- Seedance 用量 -->
        <div class="ac-card" v-if="activeProvider === 'doubao'">
          <div class="ac-card-head">
            <h3 class="ac-card-title"><TrendCharts theme="outline" size="18" fill="var(--gold)" /> Seedance 2.0 用量</h3>
            <el-button size="small" @click="fetchUsage" :loading="usageLoading">刷新</el-button>
          </div>
          <el-alert type="warning" :closable="false" show-icon style="margin-bottom:14px">
            <template #title>火山引擎规则：视频生成后 <b>24 小时内</b>需下载，超时自动失效。已下载的视频可在 <router-link to="/media-library" style="color:var(--gold);text-decoration:underline">素材库</router-link> 查看。</template>
          </el-alert>
          <div v-if="usageError" style="color:#f56c6c;margin-bottom:8px;font-size:12px">{{ usageError }}</div>
          <div v-if="usage" class="ac-llm-usage-grid">
            <div class="ac-usage-card">
              <span class="ac-usage-num">{{ (usage.totalTokens / 1000).toFixed(0) }}K</span>
              <span class="ac-usage-label">总 Token</span>
            </div>
            <div class="ac-usage-card">
              <span class="ac-usage-num" style="color:#67c23a">{{ usage.succeededCount }}<span style="font-size:14px;color:var(--text-200)">/{{ usage.totalTasks }}</span></span>
              <span class="ac-usage-label">成功/总任务</span>
            </div>
            <div class="ac-usage-card">
              <span class="ac-usage-num" style="color:#e6a23c">~{{ usage.estimatedCost }}</span>
              <span class="ac-usage-label">预估费用</span>
            </div>
            <div v-for="(v, k) in usage.byResolution" :key="k" class="ac-usage-card">
              <span class="ac-usage-num" style="font-size:18px">{{ (v.tokens/1000).toFixed(0) }}K<span style="font-size:11px;color:var(--text-200)"> / {{ v.tasks }}个</span></span>
              <span class="ac-usage-label">{{ k }}</span>
            </div>
          </div>
          <div v-if="usage && usage.tasks" class="ac-usage-table-wrap">
            <div style="font-weight:600;margin-bottom:8px;font-size:13px">任务明细</div>
            <el-table :data="usage.tasks" size="small" stripe max-height="320" style="font-size:12px">
              <el-table-column label="状态" width="70">
                <template #default="{row}"><el-tag :type="row.status==='succeeded'?'success':row.status==='failed'?'danger':'warning'" size="small">{{ row.status==='succeeded'?'成功':row.status==='failed'?'失败':row.status }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="id" label="任务ID" min-width="120" show-overflow-tooltip />
              <el-table-column label="画质" width="60"><template #default="{row}">{{ row.resolution||'-' }}</template></el-table-column>
              <el-table-column label="时长" width="50"><template #default="{row}">{{ row.duration }}s</template></el-table-column>
              <el-table-column label="Token" width="70"><template #default="{row}">{{ (row.tokens/1000).toFixed(0) }}K</template></el-table-column>
              <el-table-column label="费用" width="60"><template #default="{row}"><span style="color:#e6a23c">¥{{ row.cost }}</span></template></el-table-column>
              <el-table-column label="时间" width="130"><template #default="{row}">{{ row.createdAt ? row.createdAt.slice(5,16).replace('T',' ') : '' }}</template></el-table-column>
              <el-table-column label="操作" width="60">
                <template #default="{row}">
                  <el-button v-if="row.status==='succeeded' && !row.expired && row.videoUrl" size="small" type="primary" link @click="downloadVideo(row)" :loading="row._downloading">下载</el-button>
                  <span v-else-if="row.status==='succeeded'" style="font-size:10px;color:var(--text-200)">已过期</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
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
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">启用对象存储</span><span class="ac-desc">{{ stor.enabled ? '当前：对象存储模式（云存储）' : '当前：本地存储模式（服务器磁盘）' }}</span></div><el-switch v-model="stor.enabled"/></div>
          <div class="ac-row"><span class="ac-label">存储厂商</span><el-select v-model="stor.provider" size="small" style="width:200px" @change="onProviderChange"><el-option label="阿里云 OSS" value="aliyun_oss"/><el-option label="腾讯云 COS" value="tencent_cos"/><el-option label="MinIO" value="minio"/></el-select></div>
          <div class="ac-row" v-if="stor.provider !== 'minio'"><span class="ac-label">存储地域 <span class="ac-required">*</span></span><el-select v-model="selRegion" size="small" style="width:260px" @change="onRegionChange" placeholder="请选择Bucket所在地域" filterable><el-option v-for="r in storRegions" :key="r.region" :label="`${r.label} — ${r.endpoint}`" :value="r.region"/></el-select></div>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">Endpoint</span><span class="ac-desc">{{ stor.provider !== 'minio' ? '选择地域后自动填充' : 'MinIO服务器地址' }}</span></div><div style="display:flex;align-items:center;gap:6px"><el-input v-model="stor.endpoint" size="small" style="width:280px" :placeholder="epPlaceholder" :readonly="!customEp && stor.provider !== 'minio'" @change="saveStor"/><el-checkbox v-if="stor.provider !== 'minio'" v-model="customEp" size="small" style="white-space:nowrap;font-size:11px">自定义</el-checkbox></div></div>
          <div v-if="stor.provider !== 'minio' && stor.endpoint && selRegion" class="ac-hint"><span>💡</span><span>当前地域：<strong>{{ curRegionLabel }}</strong>（<code>{{ curRegionCode }}</code>），Endpoint：<code>{{ stor.endpoint }}</code></span></div>
          <div class="ac-row"><span class="ac-label">AccessKey ID</span><el-input v-model="stor.accessKeyId" size="small" style="width:320px" placeholder="您的 AccessKey ID" /></div>
          <div class="ac-row"><span class="ac-label">AccessKey Secret</span><el-input v-model="stor.accessKeySecret" size="small" style="width:320px" type="password" show-password :placeholder="stor._hasSecret ? '已保存（留空不修改）' : '您的 AccessKey Secret'" /></div>
          <div class="ac-row"><span class="ac-label">Bucket 名称</span><el-input v-model="stor.bucket" size="small" style="width:320px" placeholder="my-bucket" /></div>
          <div class="ac-row"><span class="ac-label">存储路径前缀</span><el-input v-model="stor.prefix" size="small" style="width:320px" placeholder="/autodrama/uploads/" /></div>
          <div class="ac-row" style="justify-content:flex-start;gap:12px;border:none;padding-top:8px"><el-button type="primary" size="small" @click="testStorConnection" :loading="storTesting">{{ storTesting ? '测试中...' : '测试连接' }}</el-button><el-button size="small" @click="saveStor">保存配置</el-button><span v-if="storResult" :style="{ color: storResult.ok ? '#67C23A' : '#F56C6C', fontSize:'13px', marginLeft:'8px' }">{{ storResult.ok ? '✓' : '✗' }} {{ storResult.message }}</span></div>
        </div>
        <div class="ac-card" :style="stor.enabled ? 'background:#E8F5E9;border-color:#A5D6A7' : 'background:var(--accent-200);border-color:var(--accent-100)'"><div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-100)"><span style="font-size:20px">{{ stor.enabled ? '☁️' : '💡' }}</span><span v-if="stor.enabled">对象存储已启用 — 生成素材自动上传至 <strong>{{ providerLabel }}</strong></span><span v-else>本地存储模式 — 素材保存在服务器 uploads/ 目录</span></div></div>
      </div>
    </div>

    <!-- ===== TTS 配音设置 ===== -->
    <div v-show="settingsTab === 'tts'" class="st-section">
      <div class="ac-grid">
        <div class="ac-card">
          <h3 class="ac-card-title">鉴权配置</h3>
          <div class="ac-row"><span class="ac-label">API Key (X-Api-Key)</span><el-input v-model="ttsForm.apiKey" size="small" style="width:360px" type="password" show-password placeholder="火山控制台 API 密钥" @change="autoSaveTTS"/></div>
          <div class="ac-row"><span class="ac-label">Resource ID</span><el-select v-model="ttsForm.resourceId" size="small" style="width:260px" @change="autoSaveTTS"><el-option label="seed-tts-2.0 (325官方音色)" value="seed-tts-2.0"/><el-option label="seed-icl-2.0 (自定义复刻)" value="seed-icl-2.0"/><el-option label="seed-tts-1.0 (旧版)" value="seed-tts-1.0"/></el-select></div>
          <div class="ac-row" v-if="ttsForm.resourceId === 'seed-icl-2.0'"><span class="ac-label">自定义 Voice ID</span><el-input v-model="ttsForm.customVoiceId" size="small" style="width:280px" placeholder="ICL 复刻返回的 voice_id" @change="autoSaveTTS"/></div>
        </div>

        <div class="ac-card">
          <h3 class="ac-card-title">音色 & 音频参数</h3>
          <div class="ac-row"><span class="ac-label">默认音色</span><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><el-select v-model="ttsForm.defaultSpeaker" size="small" style="width:260px" filterable><el-option v-for="v in ttsVoiceOptions" :key="v.value" :label="v.label" :value="v.value"/></el-select></div></div>
          <div class="ac-row"><span class="ac-label">音频格式</span><el-select v-model="ttsForm.format" size="small" style="width:180px" @change="autoSaveTTS"><el-option label="MP3" value="mp3"/><el-option label="PCM" value="pcm"/><el-option label="OGG Opus" value="ogg_opus"/></el-select></div>
          <div class="ac-row"><span class="ac-label">采样率</span><el-select v-model="ttsForm.sampleRate" size="small" style="width:140px" @change="autoSaveTTS"><el-option :label="24000" :value="24000"/><el-option :label="16000" :value="16000"/><el-option :label="48000" :value="48000"/></el-select></div>
          <div class="ac-row"><span class="ac-label">语速</span><div style="display:flex;align-items:center;gap:8px"><el-slider v-model="ttsForm.speechRate" :min="-50" :max="100" :step="1" size="small" style="width:200px" @change="autoSaveTTS"/><code style="font-size:12px;width:40px">{{ ttsForm.speechRate }}</code></div></div>
          <div class="ac-row"><span class="ac-label">音量</span><div style="display:flex;align-items:center;gap:8px"><el-slider v-model="ttsForm.loudnessRate" :min="-50" :max="100" :step="1" size="small" style="width:200px" @change="autoSaveTTS"/><code style="font-size:12px;width:40px">{{ ttsForm.loudnessRate }}</code></div></div>
        </div>

        <div class="ac-card">
          <h3 class="ac-card-title">高级选项</h3>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">开启字幕时间戳</span><span class="ac-desc">短剧字幕必备</span></div><el-switch v-model="ttsForm.enableSubtitle" @change="autoSaveTTS"/></div>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">过滤 Markdown 符号</span><span class="ac-desc">移除 ** 加粗等标记</span></div><el-switch v-model="ttsForm.disableMarkdownFilter" @change="autoSaveTTS"/></div>
          <div class="ac-row"><div class="ac-label-wrap"><span class="ac-label">开启文本缓存</span><span class="ac-desc">重复台词复用音频、不计费</span></div><el-switch v-model="ttsForm.useCache" @change="autoSaveTTS"/></div>
          <div class="ac-row"><span class="ac-label">语种</span><el-select v-model="ttsForm.explicitLanguage" size="small" style="width:140px" @change="autoSaveTTS"><el-option label="中文" value="zh-cn"/><el-option label="英文" value="en"/><el-option label="日文" value="ja"/><el-option label="自动" value=""/></el-select></div>
        </div>

        <div class="ac-card" style="display:flex;align-items:center;gap:12px;flex-direction:row">
          <el-button type="primary" size="small" @click="saveTTS" :loading="ttsSaving">{{ ttsSaving ? '保存中...' : '保存 TTS 配置' }}</el-button>
          <el-button size="small" @click="testTTS" :loading="ttsTesting">{{ ttsTesting ? '测试中...' : '测试合成连接' }}</el-button>
          <span v-if="ttsTestResult" :style="{ color: ttsTestResult.ok ? '#67C23A' : '#F56C6C', fontSize:'13px' }">{{ ttsTestResult.ok ? '✓' : '✗' }} {{ ttsTestResult.message }}</span>
        </div>

        <div class="ac-card" :style="ttsStatusText.includes('已配置') ? 'background:#E8F5E9;border-color:#A5D6A7' : 'background:var(--accent-200);border-color:var(--accent-100)'">
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-100)">
            <span style="font-size:20px">🎙️</span>
            <span>{{ ttsStatusText }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 更新日志 ===== -->
    <div v-show="settingsTab === 'changelog'" class="st-section">
      <div class="changelog-timeline">
        <div v-for="(item, i) in changelog" :key="i" class="cl-item">
          <div class="cl-dot" :class="{ 'cl-dot-latest': i === 0 }"></div>
          <div class="cl-line" v-if="i < changelog.length - 1"></div>
          <div class="cl-body">
            <div class="cl-header">
              <span class="cl-version">{{ item.version }}</span>
              <span class="cl-date">{{ item.date }}</span>
              <el-tag v-if="i === 0" size="small" type="danger" effect="dark" class="cl-latest-tag">最新</el-tag>
            </div>
            <ul class="cl-changes">
              <li v-for="(change, j) in item.changes" :key="j">
                <span :class="['cl-tag', change.type]">{{ tagLabel(change.type) }}</span>
                {{ change.text }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 个人中心 ===== -->
    <div v-show="settingsTab === 'profile'" class="st-section">
      <div class="pf-cards">
        <div class="pf-card">
          <h3 class="pf-card-title">个人信息</h3>
          <div class="pf-avatar-row">
            <div class="pf-avatar" :style="{ background: avatarBg }" @click="triggerUpload">
              <img v-if="profileForm.avatar" :src="profileForm.avatar" />
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
              <el-input :model-value="profileUser.username" disabled />
            </el-form-item>
            <el-form-item label="昵称">
              <el-input v-model="profileForm.nickname" placeholder="给自己取个昵称" maxlength="20" />
            </el-form-item>
            <el-button type="primary" @click="saveProfile" :loading="savingProfile">保存</el-button>
          </el-form>
        </div>

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
            <el-button type="primary" @click="changePwd" :loading="changingPwd">修改密码</el-button>
          </el-form>
        </div>

        <div class="pf-card">
          <h3 class="pf-card-title">登录信息</h3>
          <div class="pf-info-row">
            <span>用户ID</span>
            <strong class="pf-uid" @click="copyUid" :title="copiedUid ? '已复制' : '点击复制'">{{ profileUser.uid || '-' }}</strong>
          </div>
          <div class="pf-info-row"><span>角色</span><strong>{{ profileUser.role === 'admin' ? '管理员' : '普通用户' }}</strong></div>
          <div class="pf-info-row"><span>注册时间</span><strong>{{ fmt(profileUser.createdAt) }}</strong></div>
          <div class="pf-info-row"><span>最后登录</span><strong>{{ fmt(profileUser.lastLoginAt) }}</strong></div>
          <div class="pf-info-row"><span>登录IP</span><strong>{{ profileUser.lastLoginIp || '-' }}</strong></div>
        </div>
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

// ===== 更新日志（从 /changelog.json 动态加载） =====
function tagLabel(t) {
  const m = { feat: '新功能', fix: '修复', style: '样式', refactor: '优化', docs: '文档', perf: '性能' };
  return m[t] || t;
}
const changelog = ref([]);
async function loadChangelog() {
  try {
    const res = await fetch('/changelog.json');
    if (res.ok) changelog.value = await res.json();
  } catch { /* ignore */ }
}

// ===== 个人中心 =====
const profileUser = reactive({ username: '', nickname: '', avatar: '', uid: '', role: '', createdAt: '', lastLoginAt: '', lastLoginIp: '' });
const profileForm = reactive({ nickname: '', avatar: '' });
const savingProfile = ref(false);
const changingPwd = ref(false);
const copiedUid = ref(false);
const fileInput = ref(null);
const pwdForm = ref(null);

const pwd = reactive({ oldPassword: '', newPassword: '', confirmPwd: '' });
const pwdRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, min: 6, message: '新密码至少6位', trigger: 'blur' }],
  confirmPwd: [{ required: true, validator: (r, v, cb) => v !== pwd.newPassword ? cb(new Error('两次密码不一致')) : cb(), trigger: 'blur' }],
};

const avatarLetter = computed(() => (profileForm.nickname || profileUser.username || '?')[0]?.toUpperCase());
const avatarBg = computed(() => profileForm.avatar ? 'transparent' : '#C9A84C');

function fmt(d) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }
function triggerUpload() { fileInput.value?.click(); }
function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { ElMessage.warning('图片不能超过2MB'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => { profileForm.avatar = ev.target.result; };
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function loadProfileData() {
  try {
    const res = await fetch('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    const d = (await res.json()).data;
    if (d) { Object.assign(profileUser, d); profileForm.nickname = d.nickname || ''; profileForm.avatar = d.avatar || ''; localStorage.setItem('user', JSON.stringify(d)); }
  } catch {}
}

async function saveProfile() {
  savingProfile.value = true;
  try {
    const res = await fetch('/api/v1/auth/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ nickname: profileForm.nickname, avatar: profileForm.avatar }),
    });
    const data = await res.json();
    if (res.ok) { profileUser.nickname = profileForm.nickname; profileUser.avatar = profileForm.avatar; localStorage.setItem('user', JSON.stringify(profileUser)); ElMessage.success('已保存'); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('保存失败'); }
  finally { savingProfile.value = false; }
}

async function changePwd() {
  const valid = await pwdForm.value?.validate().catch(() => false);
  if (!valid) return;
  changingPwd.value = true;
  try {
    const res = await fetch('/api/v1/auth/password', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword }),
    });
    const data = await res.json();
    if (res.ok) { Object.assign(pwd, { oldPassword: '', newPassword: '', confirmPwd: '' }); ElMessage.success('密码已修改'); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('修改失败'); }
  finally { changingPwd.value = false; }
}

async function copyUid() {
  if (!profileUser.uid) return;
  try { await navigator.clipboard.writeText(profileUser.uid); copiedUid.value = true; setTimeout(() => copiedUid.value = false, 2000); } catch {}
}

// 切换到个人中心 tab 时加载数据
watch(() => settingsTab.value, (v) => { if (v === 'profile') loadProfileData(); });

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
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro' },
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', imageModel: '' },
  doubao: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seedance-2-0-260128', imageModel: '' },
  tongyi: { apiKey: '', baseUrl: '', model: '' },
});
const deepseekModels = ['deepseek-v4-pro', 'deepseek-v4-flash'];
const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const openaiImageModels = ['gpt-image-2', 'dall-e-3', 'dall-e-2'];
const doubaoModels = ['doubao-seedance-2-0-260128', 'doubao-pro-32k', 'doubao-lite-32k'];
const seedreamModels = ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'];
const tongyiModels = ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen2.5-72b-instruct'];

// ===== TTS 配音配置 =====
const ttsForm = reactive({
  apiKey: '', resourceId: 'seed-tts-2.0', defaultSpeaker: 'zh_female_vv_uranus_bigtts',
  customVoiceId: '', format: 'mp3', sampleRate: 24000,
  speechRate: 0, loudnessRate: 0, enableSubtitle: true, disableMarkdownFilter: true,
  useCache: true, explicitLanguage: 'zh-cn',
});

const ttsVoiceOptions = ref([{ label: '加载中...', value: '' }]);

async function fetchTTSVoices() {
  try {
    const { data } = await configAPI.getTTSVoices();
    if (data && data.length > 0) {
      const opts = [{ label: '🤖 自定义音色ID...', value: '__custom__' }];
      const byGender = {};
      data.forEach(v => {
        const g = v.gender || '其他';
        if (!byGender[g]) byGender[g] = [];
        byGender[g].push({ label: `${v.name} (${v.id.split('_').slice(0,3).join('_')})`, value: v.id });
      });
      Object.entries(byGender).forEach(([gender, voices]) => {
        const emoji = { '女': '👩', '男': '👨' }[gender] || '🎤';
        opts.push({ label: `──────── ${emoji} ${gender}声 ────────`, value: '', disabled: true });
        opts.push(...voices);
      });
      ttsVoiceOptions.value = opts;
    }
  } catch {}
}
const ttsSaving = ref(false);
const ttsTesting = ref(false);
const ttsTestResult = ref(null);
const ttsStatusText = computed(() => ttsForm.apiKey ? '已配置 ✓' : '未配置 — 请填写火山 API Key');

async function fetchTTSConfig() {
  try {
    const { data } = await configAPI.getTTSConfig();
    if (data) Object.keys(ttsForm).forEach(k => { if (data[k] !== undefined && data[k] !== null) ttsForm[k] = data[k]; });
  } catch {}
}
async function saveTTS() {
  ttsSaving.value = true;
  try {
    await configAPI.updateTTSConfig({ ...ttsForm });
    ElMessage.success('TTS 配置已保存');
  } catch { ElMessage.error('保存失败'); }
  finally { ttsSaving.value = false; }
}
function autoSaveTTS() {}
async function testTTS() {
  if (!ttsForm.apiKey) { ElMessage.warning('请先填写 API Key'); return; }
  ttsTesting.value = true; ttsTestResult.value = null;
  try {
    await configAPI.updateTTSConfig({ ...ttsForm });
    const res = await configAPI.testTTSConnection({});
    ttsTestResult.value = res.data || res;
    if (res.data?.ok) ElMessage.success('TTS 连接成功');
    else ElMessage.error(res.data?.message || '测试失败');
  } catch (e) { ttsTestResult.value = { ok: false, message: e.response?.data?.message || e.message }; }
  finally { ttsTesting.value = false; }
}

onMounted(() => { refreshStatus(); fetchTTSConfig(); fetchTTSVoices(); loadChangelog(); });
// keep-alive 后切换用户需要刷新
import { watch } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();

// 管理员检查
const isAdmin = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'admin'; } catch { return false; }
});
watch(() => route.path, (p) => { if (p === '/settings') refreshStatus(); });

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

// ===== Seedance 用量 =====
const usage = ref(null);
const usageLoading = ref(false);
const usageError = ref('');
async function fetchUsage() {
  usageLoading.value = true; usageError.value = '';
  try {
    const r = await fetch('/api/v1/config/llm/usage', { headers: tokenHdr() });
    const d = await r.json();
    if (d.data?.error) { usageError.value = d.data.error; usage.value = null; }
    else { usage.value = d.data; }
  } catch (e) { usageError.value = e.message || '查询失败'; }
  finally { usageLoading.value = false; }
}

async function downloadVideo(task) {
  task._downloading = true;
  try {
    const r = await fetch('/api/v1/config/llm/download-video', {
      method: 'POST', headers: tokenHdr(),
      body: JSON.stringify({ taskId: task.id, uid: '' }),
    });
    const d = await r.json();
    if (d.data?.ok) {
      ElMessage.success(d.data.updatedShot
        ? `已下载到素材库（关联镜头${d.data.updatedShot.shotNumber}）`
        : '已下载到素材库');
      fetchUsage(); // 刷新
    } else {
      ElMessage.error(d.data?.message || d.message || '下载失败');
    }
  } catch (e) { ElMessage.error('下载失败: ' + (e.message || '')); }
  finally { task._downloading = false; }
}
window.__aiConfig = imgCfg;
const tokenHdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
async function loadImgCfg() { try { const r = await fetch('/api/v1/config/all', { headers: tokenHdr() }); const d = await r.json(); if (d.data?.aiConfig) Object.assign(imgCfg, d.data.aiConfig); window.__aiConfig = imgCfg; } catch {} }
async function saveImgCfg() { try { await fetch('/api/v1/config/ai', { method: 'PUT', headers: tokenHdr(), body: JSON.stringify(imgCfg) }); window.__aiConfig = imgCfg; } catch {} }

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
async function loadRegions() { if (stor.provider === 'minio') { storRegions.value = []; return; } try { const r = await fetch(`/api/v1/config/storage/regions?provider=${stor.provider}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); const d = await r.json(); storRegions.value = d.data || []; } catch {} }
async function loadStorCfg() { try { const r = await fetch('/api/v1/config/all', { headers: tokenHdr() }); const d = await r.json(); if (d.data?.storageConfig) { Object.assign(stor, d.data.storageConfig); stor._hasSecret = !!d.data.storageConfig.accessKeySecret; } await loadRegions(); if (stor.endpoint && stor.provider !== 'minio') { const m = regionFromEp(stor.endpoint); if (m) selRegion.value = m; else customEp.value = true; } } catch {} }
async function saveStor() { try { const b = { ...stor }; delete b._hasSecret; await fetch('/api/v1/config/storage', { method: 'PUT', headers: tokenHdr(), body: JSON.stringify(b) }); } catch {} }
async function testStorConnection() { storTesting.value = true; storResult.value = null; try { const r = await fetch('/api/v1/config/storage/test', { method: 'POST', headers: tokenHdr(), body: JSON.stringify({ ...stor }) }); storResult.value = await r.json(); } catch {} finally { storTesting.value = false; } }

onMounted(() => { if (localStorage.getItem('token')) { loadImgCfg(); if (isAdmin.value) loadStorCfg(); } });
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

/* ===== 更新日志时间轴 ===== */
.changelog-timeline { padding: 10px 0; max-width: 720px; }
.cl-item { display: flex; gap: 16px; position: relative; padding-bottom: 20px; }
.cl-dot {
  width: 14px; height: 14px; border-radius: 50%; background: var(--bg-300); border: 2px solid var(--primary-300);
  flex-shrink: 0; margin-top: 4px; position: relative; z-index: 1;
}
.cl-dot-latest { background: var(--gold); border-color: var(--gold); box-shadow: 0 0 0 4px rgba(201,168,76,0.2); }
.cl-line {
  position: absolute; left: 6px; top: 22px; bottom: 0; width: 2px; background: var(--bg-300);
}
.cl-body { flex: 1; min-width: 0; }
.cl-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.cl-version { font-size: 16px; font-weight: 700; color: var(--text-100); }
.cl-date { font-size: 12px; color: var(--primary-300); }
.cl-latest-tag { margin-left: 2px; }
.cl-changes { list-style: none; padding: 0; margin: 0; }
.cl-changes li { font-size: 13px; color: var(--text-200); padding: 4px 0; line-height: 1.6; display: flex; align-items: flex-start; gap: 8px; }
.cl-tag {
  display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 10px; font-weight: 700;
  flex-shrink: 0; margin-top: 2px;
}
.cl-tag.feat { background: #e1f3d8; color: #67c23a; }
.cl-tag.fix { background: #fef0f0; color: #f56c6c; }
.cl-tag.style { background: #f5e6c8; color: #c9a84c; }
.cl-tag.refactor { background: #e2f3f5; color: #02adb5; }
.cl-tag.docs { background: #ecf5ff; color: #409eff; }
.cl-tag.perf { background: #f0e6f6; color: #9b59b6; }
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

/* ===== 个人中心 ===== */
.pf-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 900px; }
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

/* ===== LLM 配置精装 ===== */
.ac-llm-status {
  display: flex !important; flex-direction: row !important; align-items: center; justify-content: space-between;
  padding: 18px 22px !important;
  border-left: 4px solid var(--bg-300);
  transition: all 0.3s;
}
.ac-llm-ready { border-left-color: #67c23a !important; background: rgba(103,194,58,0.03) !important; }
.ac-llm-status-left { display: flex; align-items: center; gap: 14px; }
.ac-llm-status-icon {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700;
  background: var(--bg-300); color: var(--text-200);
}
.ac-llm-ready .ac-llm-status-icon { background: rgba(103,194,58,0.15); color: #67c23a; }
.ac-llm-status-title { font-size: 15px; font-weight: 700; color: var(--text-100); }
.ac-llm-status-sub { font-size: 12px; color: var(--text-200); margin-top: 2px; }
.ac-llm-refresh { flex-shrink: 0; }

.ac-llm-tabs { margin: 0; }
.ac-llm-tab-label { display: flex; align-items: center; gap: 6px; }
.ac-llm-tab-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ac-llm-form { display: flex; flex-direction: column; gap: 14px; padding-top: 8px; max-width: 520px; }
.ac-llm-row { display: flex; flex-direction: column; gap: 4px; }
.ac-llm-row label { font-size: 13px; font-weight: 600; color: var(--text-100); }
.ac-key-link { font-size: 11px; color: #409eff; text-decoration: none; margin-top: 2px; display: inline-block; }
.ac-key-link:hover { text-decoration: underline; }
.ac-llm-actions { display: flex; gap: 10px; margin-top: 8px; }
.ac-llm-actions .el-button {
  flex: 1; max-width: 180px; height: 42px; border-radius: 10px;
  font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
  padding: 0 18px !important; line-height: 1;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.ac-llm-actions .el-button--primary {
  background: linear-gradient(135deg, #2d4a22, #3d6430) !important;
  border: 1px solid #4a7a3a !important; color: #d4e8c0 !important;
  box-shadow: 0 2px 8px rgba(61,100,48,0.25);
}
.ac-llm-actions .el-button--primary:hover {
  transform: translateY(-2px); box-shadow: 0 6px 20px rgba(61,100,48,0.4);
  background: linear-gradient(135deg, #36782a, #4a8a3a) !important;
  color: #fff !important;
}
.ac-llm-actions .el-button--primary:active { transform: translateY(0) scale(0.97); }
.ac-llm-actions .el-button--default {
  background: var(--bg-100) !important; border: 2px solid var(--bg-300) !important; color: var(--text-100) !important;
}
.ac-llm-actions .el-button--default:hover {
  border-color: var(--gold) !important; color: var(--gold) !important;
  transform: translateY(-1px); box-shadow: 0 4px 12px rgba(201,168,76,0.1);
}
.ac-llm-actions .el-button--success {
  background: rgba(103,194,58,0.1) !important; border: 2px solid #67c23a !important; color: #3d8e2c !important;
  font-weight: 700 !important;
}
.ac-llm-actions .el-button--danger {
  background: rgba(245,108,108,0.08) !important; border: 2px solid #f56c6c !important; color: #d43a3a !important;
  font-weight: 700 !important;
}

.ac-llm-usage-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px; }
.ac-usage-card {
  background: var(--bg-100); border: 1px solid var(--bg-300); border-radius: 10px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
}
.ac-usage-num { font-size: 22px; font-weight: 900; color: var(--text-100); font-family: 'Playfair Display', serif; }
.ac-usage-label { font-size: 11px; color: var(--text-200); text-transform: uppercase; letter-spacing: 0.5px; }
.ac-usage-table-wrap { margin-top: 12px; }
</style>
