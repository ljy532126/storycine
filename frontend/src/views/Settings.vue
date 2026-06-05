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
      <span :class="['st-tab', { active: settingsTab === 'tts' }]" @click="settingsTab = 'tts'">火山 TTS 配音</span>
      <span :class="['st-tab', { active: settingsTab === 'changelog' }]" @click="settingsTab = 'changelog'">📋 更新日志</span>
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

              <!-- Seedance 用量 -->
              <el-divider />
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-weight:600;font-size:14px">Seedance 2.0 用量</span>
                <el-button size="small" @click="fetchUsage" :loading="usageLoading">刷新</el-button>
              </div>
              <el-alert type="warning" :closable="false" show-icon style="margin-bottom:12px">
                <template #title>
                  火山引擎规则：视频生成后 <b>24 小时内</b>需下载，超时链接自动失效。已下载的视频可在 <router-link to="/media-library" style="color:#E6A23C;text-decoration:underline">素材库 → 视频</router-link> 中查看。
                </template>
              </el-alert>
              <div v-if="usageError" style="color:#E17373;margin-bottom:8px">{{ usageError }}</div>
              <div v-if="usage" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px">
                <div style="background:#f5f7fa;border-radius:8px;padding:12px 16px;min-width:100px">
                  <div style="font-size:12px;color:#909399">总 Token</div>
                  <div style="font-size:20px;font-weight:700;color:#303133">{{ (usage.totalTokens / 1000).toFixed(0) }}K</div>
                </div>
                <div style="background:#f5f7fa;border-radius:8px;padding:12px 16px;min-width:100px">
                  <div style="font-size:12px;color:#909399">成功/总任务</div>
                  <div style="font-size:20px;font-weight:700;color:#67C23A">{{ usage.succeededCount }}<span style="font-size:14px;color:#909399">/{{ usage.totalTasks }}</span></div>
                </div>
                <div style="background:#f5f7fa;border-radius:8px;padding:12px 16px;min-width:100px">
                  <div style="font-size:12px;color:#909399">预估费用</div>
                  <div style="font-size:20px;font-weight:700;color:#E6A23C">~{{ usage.estimatedCost }}</div>
                </div>
                <div v-for="(v, k) in usage.byResolution" :key="k" style="background:#f5f7fa;border-radius:8px;padding:12px 16px">
                  <div style="font-size:12px;color:#909399">{{ k }}</div>
                  <div style="font-size:18px;font-weight:700;color:#303133">{{ (v.tokens/1000).toFixed(0) }}K<span style="font-size:12px;color:#909399;font-weight:400"> / {{ v.tasks }}个</span></div>
                </div>
              </div>

              <!-- 任务明细列表 -->
              <div v-if="usage && usage.tasks" style="font-size:12px">
                <div style="font-weight:600;margin-bottom:6px;font-size:13px">全部任务明细</div>
                <!-- 表头 -->
                <div style="display:flex;align-items:center;padding:4px 8px;background:#f0f2f5;border-radius:4px;gap:4px;font-size:11px;color:#909399;font-weight:600">
                  <span style="flex-shrink:0;width:44px;text-align:center">状态</span>
                  <span style="flex:1;min-width:0">任务ID</span>
                  <span style="flex-shrink:0;width:36px;text-align:center">画质</span>
                  <span style="flex-shrink:0;width:40px;text-align:center">时长</span>
                  <span style="flex-shrink:0;width:46px;text-align:right">Token</span>
                  <span style="flex-shrink:0;width:36px;text-align:right">费用</span>
                  <span style="flex-shrink:0;width:74px;text-align:right">提交时间</span>
                  <span style="flex-shrink:0;width:20px" title="在线播放">▶</span>
                  <span style="flex-shrink:0;width:20px" title="下载到素材库">⬇</span>
                </div>
                <div v-for="t in usage.tasks" :key="t.id" style="display:flex;align-items:center;padding:6px 8px;border-bottom:1px solid #ebeef5;gap:4px">
                  <el-tag :type="t.status==='succeeded'?'success':t.status==='failed'?'danger':'warning'" size="small" style="flex-shrink:0;width:44px;text-align:center;font-size:11px">{{ t.status==='succeeded'?'成功':t.status==='failed'?'失败':t.status }}</el-tag>
                  <span style="flex:1;color:#606266;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:11px" :title="t.id">{{ t.id }}</span>
                  <span style="color:#909399;flex-shrink:0;width:36px;text-align:center;font-size:11px">{{ t.resolution||'-' }}</span>
                  <span style="color:#909399;flex-shrink:0;width:40px;text-align:center;font-size:11px">{{ t.duration }}s</span>
                  <span style="color:#303133;font-weight:600;flex-shrink:0;width:46px;text-align:right;font-size:11px">{{ (t.tokens/1000).toFixed(0) }}K</span>
                  <span style="color:#E6A23C;flex-shrink:0;width:36px;text-align:right;font-size:11px">¥{{ t.cost }}</span>
                  <span style="color:#909399;flex-shrink:0;width:74px;text-align:right;font-size:10px">{{ t.createdAt ? t.createdAt.slice(5,16).replace('T',' ') : '' }}</span>
                  <a v-if="t.videoUrl && !t.expired" :href="`/api/v1/config/llm/video-proxy?url=${encodeURIComponent(t.videoUrl)}`" target="_blank" style="flex-shrink:0;width:20px;text-align:center;color:#409EFF;text-decoration:none;font-size:12px" title="在线播放">▶</a>
                  <span v-else-if="t.status==='succeeded' && t.expired" style="flex-shrink:0;width:20px;text-align:center;font-size:10px;color:#C0C4CC" title="TOS链接已过期（超24小时）">⏰</span>
                  <span v-else style="flex-shrink:0;width:20px"></span>
                  <el-button v-if="t.status==='succeeded' && !t.expired && t.videoUrl" size="small" type="primary" text @click="downloadVideo(t)" :loading="t._downloading" style="flex-shrink:0;width:20px;min-width:20px;padding:0;font-size:13px" title="下载到素材库（24小时内有效）">⬇</el-button>
                  <span v-else-if="t.status==='succeeded' && t.expired" style="flex-shrink:0;width:20px;text-align:center;font-size:10px;color:#C0C4CC" title="TOS链接已过期，无法下载">⏰</span>
                  <span v-else style="flex-shrink:0;width:20px"></span>
                </div>
              </div>
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

// ===== 更新日志 =====
function tagLabel(t) {
  const m = { feat: '新功能', fix: '修复', style: '样式', refactor: '优化', docs: '文档', perf: '性能' };
  return m[t] || t;
}
const changelog = [
  {
    version: 'v2.7 — 更新日志 & URL 链接',
    date: '2026-06-06',
    changes: [
      { type: 'feat', text: '公告弹窗内容自动识别 URL，转为蓝色下划线可点击链接' },
      { type: 'feat', text: '系统设置新增「更新日志」模块，时间轴展示版本历史' },
      { type: 'style', text: '通知铃铛移至侧边栏 logo 行右侧，圆形金色按钮风格统一' },
      { type: 'fix', text: '修复通知铃铛点击闪烁问题' },
    ],
  },
  {
    version: 'v2.6 — 公告 & 错误日志系统',
    date: '2026-06-05',
    changes: [
      { type: 'feat', text: '公告通知管理系统：管理员可发布/编辑/删除公告，支持类型(信息/警告/成功/重要)、可见范围、置顶' },
      { type: 'feat', text: '用户端通知铃铛：新公告自动弹窗，点击铃铛查看公告列表，支持「今日不再提示」' },
      { type: 'feat', text: '全局错误日志收集：所有接口错误自动写入 MongoDB，30 天自动清理' },
      { type: 'feat', text: '错误日志管理页：搜索/筛选/详情弹窗/批量处理，Socket.IO 实时推送新错误' },
      { type: 'feat', text: '侧边栏错误日志红点数字 + 铃铛通知红点，进入页面自动清零' },
      { type: 'refactor', text: '错误日志页全面优化：统计卡片、相对时间、可折叠详情、自动刷新、全选、清空已处理' },
      { type: 'fix', text: '@mention 标签按是否有参考图区分颜色：有图=金色/蓝色，无图=灰色' },
      { type: 'fix', text: '@mention 下拉菜单跟随 @ 符号位置动态定位，限制最大宽度防溢出' },
    ],
  },
  {
    version: 'v2.5 — 故事板场景引用 & 对话框',
    date: '2026-06-04',
    changes: [
      { type: 'feat', text: '故事板 @mention 支持场景引用：图片/视频提示词均可 @场景名称，AI 生成时注入场景描述' },
      { type: 'fix', text: '场景 @mention 不再因无参考图被过滤，无图场景也可引用并注入文字描述' },
      { type: 'fix', text: '演员库角色/场景/道具新建改为对话框，详情面板名称/类型/性别/年龄可编辑' },
      { type: 'fix', text: '修复新建角色 409 冲突（后端唯一索引 + 默认名重复）' },
    ],
  },
  {
    version: 'v2.4 — 余额提示 & 参考图优化',
    date: '2026-06-03',
    changes: [
      { type: 'fix', text: '生产环境余额不足/鉴权失败等 API 错误不再显示「服务器内部错误」，直接暴露真实原因' },
      { type: 'fix', text: '视频生成失败时打印每个参考图 URL 便于排查，区分本地/公网路径给出明确解决方案' },
      { type: 'docs', text: '.env.example 添加 PUBLIC_URL 配置说明（Seedance 参考图访问）' },
    ],
  },
  {
    version: 'v2.3 — 初始版本',
    date: '2026-06-02',
    changes: [
      { type: 'feat', text: '全自动 AI 短剧生成平台上线：剧本工坊 → 故事板 → 剪辑室完整工作流' },
      { type: 'feat', text: '演员库管理：角色/场景/道具 CRUD + AI 生图 + 参考图上上传' },
      { type: 'feat', text: '故事板分镜：图片/视频提示词编辑器、AI 生图/生视频、@mention 角色引用' },
      { type: 'feat', text: '火山 TTS 配音：批量配音、音色选择、字幕时间戳' },
      { type: 'feat', text: 'LLM 多模型支持：DeepSeek / OpenAI / 豆包' },
      { type: 'feat', text: '存储后端：本地 / 阿里云 OSS / 腾讯云 COS / MinIO' },
    ],
  },
];

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

onMounted(() => { refreshStatus(); fetchTTSConfig(); fetchTTSVoices(); });
// keep-alive 后切换用户需要刷新
import { watch } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
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

onMounted(() => { if (localStorage.getItem('token')) { loadImgCfg(); loadStorCfg(); } });
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
</style>
