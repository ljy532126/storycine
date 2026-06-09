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
      <span :class="['st-tab', { active: settingsTab === 'llm' }]" @click="settingsTab = 'llm'">
        <Cpu theme="outline" size="15" fill="currentColor" /> LLM 大模型
      </span>
      <span :class="['st-tab', { active: settingsTab === 'image' }]" @click="settingsTab = 'image'">
        <PictureOne theme="outline" size="15" fill="currentColor" /> 生图 & 风格
      </span>
      <span v-if="isAdmin" :class="['st-tab', { active: settingsTab === 'storage' }]" @click="settingsTab = 'storage'">
        <FolderOpen theme="outline" size="15" fill="currentColor" /> 对象存储
      </span>
      <span :class="['st-tab', { active: settingsTab === 'tts' }]" @click="settingsTab = 'tts'">
        <Voice theme="outline" size="15" fill="currentColor" /> 语音合成
      </span>
      <span :class="['st-tab', { active: settingsTab === 'changelog' }]" @click="settingsTab = 'changelog'">
        <DocDetail theme="outline" size="15" fill="currentColor" /> 更新日志
      </span>
      <span :class="['st-tab', { active: settingsTab === 'profile' }]" @click="settingsTab = 'profile'">
        <User theme="outline" size="15" fill="currentColor" /> 个人中心
      </span>
    </div>

    <!-- ===== LLM 配置 ===== -->
    <div v-show="settingsTab === 'llm'" class="st-section">
      <div class="st-grid">
        <!-- 状态卡片 -->
        <div :class="['st-status-card', { ready: llmStatus.configured }]">
          <div class="st-status-dot"></div>
          <div class="st-status-body">
            <span class="st-status-title">{{ llmStatus.configured ? 'AI 已就绪' : '尚未配置 AI' }}</span>
            <span class="st-status-sub" v-if="llmStatus.configured">当前使用 {{ llmStatus.activeProvider }} · {{ llmStatus.model }} 模型</span>
            <span class="st-status-sub" v-else>配置至少一个大模型提供商的 API Key，即可开始创作</span>
          </div>
          <el-button size="small" @click="refreshStatus" :loading="loading" class="st-status-btn">刷新状态</el-button>
        </div>

        <!-- Provider 选项卡 -->
        <div class="st-card st-providers">
          <el-tabs v-model="activeProvider" class="st-provider-tabs">
            <el-tab-pane v-for="p in providers" :key="p.key" :name="p.key">
              <template #label>
                <span class="st-prov-tab">
                  <span :class="['st-prov-dot', summary[p.key]?.apiKey ? 'ok' : 'off']"></span>
                  {{ p.label }}
                </span>
              </template>
              <p class="st-prov-desc">{{ p.desc }}</p>
              <div class="st-prov-form">
                <div class="st-field">
                  <label class="st-field-label">API Key<span class="st-field-help">此 Key 加密存储于数据库，不会泄露</span></label>
                  <div class="st-field-row"><el-input v-model="form[p.key].apiKey" type="password" show-password :placeholder="p.placeholder" size="default" style="flex:1" /><a :href="p.keyLink" target="_blank" class="st-key-link">获取 →</a></div>
                </div>
                <div class="st-field" v-for="f in p.fields" :key="f.name">
                  <label class="st-field-label">{{ f.label }}<span class="st-field-help">{{ f.help }}</span></label>
                  <el-select v-if="f.options" v-model="form[p.key][f.name]" filterable allow-create style="width:100%"><el-option v-for="m in f.options" :key="(typeof m==='string'?m:m.value)" :label="typeof m==='string'?m:m.label" :value="typeof m==='string'?m:m.value" /></el-select>
                  <el-input v-else v-model="form[p.key][f.name]" :placeholder="f.placeholder" size="default" />
                </div>
                <div class="st-prov-actions">
                  <el-button type="primary" @click="saveConfig(p.key)" :loading="saving">保存</el-button>
                  <el-button @click="testConnection(p.key)" :loading="testing === p.key" :class="'st-test-btn test-' + (testResults[p.key] === true ? 'ok' : testResults[p.key] === false ? 'fail' : '')">{{ testBtnLabel(p.key) }}</el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- Seedance 用量 -->
        <div class="st-card" v-if="activeProvider === 'doubao'">
          <div class="st-card-head">
            <h3 class="st-card-title"><Data theme="outline" size="17" fill="var(--gold)" /> 豆包 Seedance 用量</h3>
            <el-button size="small" @click="fetchUsage" :loading="usageLoading"><el-icon><Refresh /></el-icon> 刷新</el-button>
          </div>
          <el-alert type="warning" :closable="false" show-icon style="margin-bottom:14px">
            <template #title>视频生成后 <b>24 小时内</b>需下载，超时失效。已下载的视频可在 <router-link to="/media-library" style="color:var(--gold);text-decoration:underline">素材库</router-link> 查看。</template>
          </el-alert>
          <div v-if="usageError" class="st-usage-error">{{ usageError }}</div>
          <div v-if="usage" class="st-usage-grid">
            <div class="st-usage-card"><span class="st-usage-num">{{ (usage.totalTokens / 1000).toFixed(0) }}K</span><span class="st-usage-label">总 Token</span></div>
            <div class="st-usage-card"><span class="st-usage-num" style="color:#67c23a">{{ usage.succeededCount }}<small style="color:var(--text-200)">/{{ usage.totalTasks }}</small></span><span class="st-usage-label">成功 / 总任务</span></div>
            <div class="st-usage-card"><span class="st-usage-num" style="color:#e6a23c">~{{ usage.estimatedCost }}</span><span class="st-usage-label">预估费用 (CNY)</span></div>
            <div v-for="(v, k) in usage.byResolution" :key="k" class="st-usage-card"><span class="st-usage-num" style="font-size:16px">{{ (v.tokens/1000).toFixed(0) }}K<small style="color:var(--text-200)"> / {{ v.tasks }}个</small></span><span class="st-usage-label">{{ k }}</span></div>
          </div>
          <div v-if="usage && usage.tasks" class="st-usage-table-wrap">
            <el-table :data="usage.tasks" size="small" stripe max-height="320" style="font-size:12px">
              <el-table-column label="状态" width="70"><template #default="{row}"><el-tag :type="row.status==='succeeded'?'success':row.status==='failed'?'danger':'warning'" size="small">{{ row.status==='succeeded'?'成功':row.status==='failed'?'失败':row.status }}</el-tag></template></el-table-column>
              <el-table-column prop="id" label="任务ID" min-width="120" show-overflow-tooltip />
              <el-table-column label="画质" width="60"><template #default="{row}">{{ row.resolution||'-' }}</template></el-table-column>
              <el-table-column label="时长" width="50"><template #default="{row}">{{ row.duration }}s</template></el-table-column>
              <el-table-column label="Token" width="70"><template #default="{row}">{{ (row.tokens/1000).toFixed(0) }}K</template></el-table-column>
              <el-table-column label="费用" width="60"><template #default="{row}"><span style="color:#e6a23c">¥{{ row.cost }}</span></template></el-table-column>
              <el-table-column label="时间" width="130"><template #default="{row}">{{ row.createdAt ? row.createdAt.slice(5,16).replace('T',' ') : '' }}</template></el-table-column>
              <el-table-column label="操作" width="60"><template #default="{row}"><el-button v-if="row.status==='succeeded' && !row.expired && row.videoUrl" size="small" type="primary" link @click="downloadVideo(row)" :loading="row._downloading">下载</el-button></template></el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 生图设置 ===== -->
    <div v-show="settingsTab === 'image'" class="st-section">
      <div class="st-grid">
        <div class="st-card">
          <h3 class="st-card-title"><SettingTwo theme="outline" size="17" fill="var(--gold)" /> 水印 & 文字限制</h3>
          <p class="st-card-sub">AI 生图偶尔会在画面角落出现乱码文字或水印，开启后自动在所有提示词中追加禁止文字/水印的强约束。</p>
          <div class="st-toggle-row"><div class="st-toggle-info"><span class="st-toggle-label">禁止文字/水印</span><span class="st-toggle-hint">追加「严禁出现任何文字、logo、乱码、水印」约束，同时关闭豆包自带水印</span></div><el-switch v-model="imgCfg.noTextWatermark" @change="saveImgCfg" /></div>
        </div>
        <div class="st-card">
          <h3 class="st-card-title"><PictureOne theme="outline" size="17" fill="var(--gold)" /> 画质 & 风格预设</h3>
          <p class="st-card-sub">生图和生视频时自动使用的默认参数，每个镜头可单独覆盖。</p>
          <div class="st-field-row"><span class="st-field-label">图片默认画质</span><el-select v-model="imgCfg.imageQuality" size="small" @change="saveImgCfg" style="width:160px"><el-option label="8K 极致" value="8K"/><el-option label="4K 高清" value="4K"/><el-option label="2K 标清" value="2K"/></el-select></div>
          <div class="st-field-row"><span class="st-field-label">图片默认风格</span><el-select v-model="imgCfg.imageStyle" size="small" @change="saveImgCfg" style="width:160px"><el-option label="超写实" value="超写实"/><el-option label="古风" value="古风"/><el-option label="动漫" value="动漫"/><el-option label="电影级" value="电影级"/></el-select></div>
          <div class="st-field-row"><span class="st-field-label">角色生图比例</span><el-select v-model="imgCfg.characterRatio" size="small" @change="saveImgCfg" style="width:160px"><el-option label="16:9 横屏" value="16:9"/><el-option label="9:16 竖屏" value="9:16"/><el-option label="4:3 方形" value="4:3"/></el-select></div>
        </div>
        <div class="st-card">
          <h3 class="st-card-title"><Shield theme="outline" size="17" fill="var(--gold)" /> 内容安全</h3>
          <p class="st-card-sub">豆包 Seedance 对真人内容审核较严。开启后自动在视频提示词末尾追加风格化引导，降低被误拦的概率。</p>
          <div class="st-toggle-row"><div class="st-toggle-info"><span class="st-toggle-label">视频风格化模式</span><span class="st-toggle-hint">追加非写实风格标签，减少因"疑似真人"被拒</span></div><el-switch v-model="imgCfg.noRealPerson" @change="saveImgCfg" /></div>
        </div>
        <div class="st-hint-card">配置修改后自动保存，无需手动确认。全局生效，拍摄时可临时覆盖。</div>
      </div>
    </div>

    <!-- ===== 存储设置 ===== -->
    <div v-show="settingsTab === 'storage'" class="st-section">
      <div class="st-grid" v-if="isAdmin">
        <div class="st-card">
          <h3 class="st-card-title"><FolderOpen theme="outline" size="17" fill="var(--gold)" /> 对象存储配置</h3>
          <p class="st-card-sub">生成的图片/视频上传至云存储获取公网 URL，供豆包 API 引用。关闭时存服务器本地磁盘。</p>
          <div class="st-toggle-row"><div class="st-toggle-info"><span class="st-toggle-label">启用云存储</span><span class="st-toggle-hint">{{ stor.enabled ? '当前：图片视频上传至云端，公网可访问' : '当前：文件保存在服务器 uploads/ 目录' }}</span></div><el-switch v-model="stor.enabled"/></div>
          <div class="st-field-row" v-if="stor.enabled"><span class="st-field-label">存储厂商</span><el-select v-model="stor.provider" size="small" style="width:240px" @change="onProviderChange"><el-option label="阿里云 OSS" value="aliyun_oss"/><el-option label="腾讯云 COS" value="tencent_cos"/><el-option label="MinIO (自建)" value="minio"/></el-select></div>
          <div class="st-field-row" v-if="stor.enabled && stor.provider !== 'minio'"><span class="st-field-label">Bucket 地域</span><el-select v-model="selRegion" size="small" style="width:300px" @change="onRegionChange" filterable><el-option v-for="r in storRegions" :key="r.region" :label="`${r.label} — ${r.endpoint}`" :value="r.region"/></el-select></div>
          <div class="st-field-row" v-if="stor.enabled"><span class="st-field-label">Endpoint</span><div style="display:flex;align-items:center;gap:6px"><el-input v-model="stor.endpoint" size="small" style="width:300px" :placeholder="epPlaceholder" :readonly="!customEp && stor.provider !== 'minio'" @change="saveStor"/></div></div>
          <template v-if="stor.enabled">
            <div class="st-field-row"><span class="st-field-label">AccessKey ID</span><el-input v-model="stor.accessKeyId" size="small" style="width:320px" placeholder="阿里云/腾讯云 AccessKey ID" /></div>
            <div class="st-field-row"><span class="st-field-label">AccessKey Secret</span><el-input v-model="stor.accessKeySecret" size="small" style="width:320px" type="password" show-password :placeholder="stor._hasSecret ? '已保存（留空不修改）' : '密钥'" /></div>
            <div class="st-field-row"><span class="st-field-label">Bucket 名称</span><el-input v-model="stor.bucket" size="small" style="width:320px" placeholder="my-bucket" /></div>
            <div class="st-field-row"><span class="st-field-label">存储路径前缀</span><el-input v-model="stor.prefix" size="small" style="width:320px" placeholder="/autodrama/uploads/" /></div>
            <div class="st-prov-actions"><el-button type="primary" size="small" @click="testStorConnection" :loading="storTesting">测试连接</el-button><el-button size="small" @click="saveStor">保存</el-button><span v-if="storResult" :style="{ color: storResult.ok ? '#67C23A' : '#F56C6C', fontSize:'13px', marginLeft:'8px' }">{{ storResult.ok ? '✓' : '✗' }} {{ storResult.message }}</span></div>
          </template>
        </div>
        <div :class="['st-hint-card', stor.enabled ? 'st-hint-ok' : '']">{{ stor.enabled ? '云存储已启用 — 生成素材自动上传至 ' + providerLabel : '本地存储模式 — 素材保存在服务器磁盘，适合单机部署' }}</div>
      </div>
    </div>

    <!-- ===== TTS 配音设置 ===== -->
    <div v-show="settingsTab === 'tts'" class="st-section">
      <div class="st-grid">
        <div class="st-card">
          <h3 class="st-card-title"><Key theme="outline" size="17" fill="var(--gold)" /> 鉴权 & 资源配置</h3>
          <p class="st-card-sub">火山引擎语音合成服务需要 API Key 和 Resource ID，获取地址见下方链接。</p>
          <div class="st-field-row"><span class="st-field-label">API Key<span class="st-field-help">火山控制台「语音合成」→ API 密钥</span></span><el-input v-model="ttsForm.apiKey" size="small" style="width:360px" type="password" show-password placeholder="火山控制台 API 密钥" @change="autoSaveTTS"/></div>
          <div class="st-field-row"><span class="st-field-label">Resource ID<span class="st-field-help">决定可用的音色库范围</span></span><el-select v-model="ttsForm.resourceId" size="small" style="width:260px" @change="autoSaveTTS"><el-option label="seed-tts-2.0 (325官方音色)" value="seed-tts-2.0"/><el-option label="seed-icl-2.0 (自定义复刻)" value="seed-icl-2.0"/><el-option label="seed-tts-1.0 (旧版)" value="seed-tts-1.0"/></el-select></div>
          <div class="st-field-row" v-if="ttsForm.resourceId === 'seed-icl-2.0'"><span class="st-field-label">自定义 Voice ID<span class="st-field-help">ICL 复刻接口返回的 voice_id</span></span><el-input v-model="ttsForm.customVoiceId" size="small" style="width:280px" placeholder="voice_id" @change="autoSaveTTS"/></div>
        </div>
        <div class="st-card">
          <h3 class="st-card-title"><People theme="outline" size="17" fill="var(--gold)" /> 音色 & 音频参数</h3>
          <div class="st-field-row"><span class="st-field-label">默认音色<span class="st-field-help">新生成配音时默认使用的说话人</span></span><el-select v-model="ttsForm.defaultSpeaker" size="small" style="width:260px" filterable><el-option v-for="v in ttsVoiceOptions" :key="v.value" :label="v.label" :value="v.value"/></el-select></div>
          <div class="st-field-row"><span class="st-field-label">音频格式</span><el-select v-model="ttsForm.format" size="small" style="width:160px" @change="autoSaveTTS"><el-option label="MP3 (通用)" value="mp3"/><el-option label="PCM (无损)" value="pcm"/><el-option label="OGG Opus" value="ogg_opus"/></el-select></div>
          <div class="st-field-row"><span class="st-field-label">采样率</span><el-select v-model="ttsForm.sampleRate" size="small" style="width:140px" @change="autoSaveTTS"><el-option :label="'24000 Hz (推荐)'" :value="24000"/><el-option :label="'16000 Hz'" :value="16000"/><el-option :label="'48000 Hz'" :value="48000"/></el-select></div>
          <div class="st-field-row"><span class="st-field-label">语速</span><div style="display:flex;align-items:center;gap:8px"><el-slider v-model="ttsForm.speechRate" :min="-50" :max="100" size="small" style="width:200px" @change="autoSaveTTS"/><code>{{ ttsForm.speechRate }}</code></div></div>
          <div class="st-field-row"><span class="st-field-label">音量</span><div style="display:flex;align-items:center;gap:8px"><el-slider v-model="ttsForm.loudnessRate" :min="-50" :max="100" size="small" style="width:200px" @change="autoSaveTTS"/><code>{{ ttsForm.loudnessRate }}</code></div></div>
        </div>
        <div class="st-card">
          <h3 class="st-card-title"><SettingTwo theme="outline" size="17" fill="var(--gold)" /> 高级选项</h3>
          <div class="st-toggle-row"><div class="st-toggle-info"><span class="st-toggle-label">字幕时间戳</span><span class="st-toggle-hint">生成 SRT 字幕同步数据，短剧必备</span></div><el-switch v-model="ttsForm.enableSubtitle" @change="autoSaveTTS"/></div>
          <div class="st-toggle-row"><div class="st-toggle-info"><span class="st-toggle-label">过滤 Markdown</span><span class="st-toggle-hint">移除台词中 ** 强调等格式标记</span></div><el-switch v-model="ttsForm.disableMarkdownFilter" @change="autoSaveTTS"/></div>
          <div class="st-toggle-row"><div class="st-toggle-info"><span class="st-toggle-label">文本缓存</span><span class="st-toggle-hint">相同台词复用已有音频，节省费用</span></div><el-switch v-model="ttsForm.useCache" @change="autoSaveTTS"/></div>
          <div class="st-field-row"><span class="st-field-label">语种<span class="st-field-help">留空则按文本自动识别</span></span><el-select v-model="ttsForm.explicitLanguage" size="small" style="width:140px" @change="autoSaveTTS"><el-option label="中文" value="zh-cn"/><el-option label="英文" value="en"/><el-option label="日文" value="ja"/><el-option label="自动" value=""/></el-select></div>
        </div>
        <div class="st-hint-card" :class="ttsForm.apiKey ? 'st-hint-ok' : ''">{{ ttsForm.apiKey ? 'TTS 已配置 ✓ 配音功能可用' : '未配置 API Key — 填写火山引擎密钥后开通配音功能' }}</div>
        <div class="st-prov-actions"><el-button type="primary" @click="saveTTS" :loading="ttsSaving">保存 TTS 配置</el-button><el-button @click="testTTS" :loading="ttsTesting">测试发音</el-button><span v-if="ttsTestResult" :style="{ color: ttsTestResult.ok ? '#67C23A' : '#F56C6C', fontSize:'13px' }">{{ ttsTestResult.ok ? '✓' : '✗' }} {{ ttsTestResult.message }}</span></div>
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
              <li v-for="(change, j) in item.changes" :key="j"><span :class="['cl-tag', change.type]">{{ tagLabel(change.type) }}</span>{{ change.text }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 个人中心 ===== -->
    <div v-show="settingsTab === 'profile'" class="st-section">
      <div class="pf-layout">
        <!-- 头像 + 基础信息卡片 -->
        <div class="st-card pf-card-main">
          <div class="pf-hero">
            <div class="pf-avatar-wrap" @click="triggerUpload">
              <div class="pf-avatar" :style="{ background: avatarBg }">
                <img v-if="profileForm.avatar" :src="profileForm.avatar" />
                <span v-else>{{ avatarLetter }}</span>
              </div>
              <div class="pf-avatar-badge"><PictureOne theme="outline" size="14" fill="#fff" /></div>
            </div>
            <input type="file" accept="image/*" ref="fileInput" hidden @change="onFileChange" />
            <div class="pf-hero-info">
              <span class="pf-hero-name">{{ profileUser.nickname || profileUser.username || '未设置' }}</span>
              <span class="pf-hero-role"><span :class="['pf-role-dot', profileUser.role === 'admin' ? 'admin' : 'user']"></span>{{ profileUser.role === 'admin' ? '管理员' : '普通用户' }}</span>
              <span class="pf-hero-sub">{{ profileUser.lastLoginAt ? '最后登录 ' + fmt(profileUser.lastLoginAt) : '' }}</span>
            </div>
          </div>
        </div>

        <!-- 登录信息 -->
        <div class="st-card pf-card-info">
          <h3 class="st-card-title"><IdCard theme="outline" size="17" fill="var(--gold)" /> 账号详情</h3>
          <div class="pf-detail-grid">
            <div class="pf-detail-item"><span class="pf-detail-label">用户 ID</span><span class="pf-detail-val pf-uid" @click="copyUid">{{ profileUser.uid || '-' }}<span v-if="copiedUid" class="pf-copied">✓ 已复制</span></span></div>
            <div class="pf-detail-item"><span class="pf-detail-label">注册时间</span><span class="pf-detail-val">{{ fmt(profileUser.createdAt) }}</span></div>
            <div class="pf-detail-item"><span class="pf-detail-label">最后登录 IP</span><span class="pf-detail-val">{{ profileUser.lastLoginIp || '-' }}</span></div>
          </div>
        </div>

        <!-- 编辑资料 -->
        <div class="st-card pf-card-edit">
          <h3 class="st-card-title"><EditTwo theme="outline" size="17" fill="var(--gold)" /> 编辑资料</h3>
          <div class="st-field"><label class="st-field-label">账号</label><el-input :model-value="profileUser.username" disabled /></div>
          <div class="st-field">
            <label class="st-field-label">昵称</label>
            <div class="input-counter-wrap">
              <el-input v-model="profileForm.nickname" placeholder="给自己取个昵称" maxlength="20" />
              <span v-if="profileForm.nickname" class="input-counter">{{ profileForm.nickname.length }}/20</span>
            </div>
          </div>
          <el-button class="pf-btn" @click="saveProfile" :loading="savingProfile"><CheckOne theme="outline" size="16" fill="currentColor" /> 保存资料</el-button>
        </div>

        <!-- 修改密码 -->
        <div class="st-card pf-card-pwd">
          <h3 class="st-card-title"><Lock theme="outline" size="17" fill="var(--gold)" /> 修改密码</h3>
          <el-form ref="pwdForm" :model="pwd" :rules="pwdRules" label-position="top" size="default">
            <el-form-item label="原密码" prop="oldPassword"><div class="input-counter-wrap"><el-input v-model="pwd.oldPassword" type="password" show-password placeholder="输入当前密码" maxlength="50" /><span v-if="pwd.oldPassword" class="input-counter">{{ pwd.oldPassword.length }}/50</span></div></el-form-item>
            <el-form-item label="新密码" prop="newPassword"><div class="input-counter-wrap"><el-input v-model="pwd.newPassword" type="password" show-password placeholder="至少6位" maxlength="50" /><span v-if="pwd.newPassword" class="input-counter">{{ pwd.newPassword.length }}/50</span></div></el-form-item>
            <el-form-item label="确认新密码" prop="confirmPwd"><div class="input-counter-wrap"><el-input v-model="pwd.confirmPwd" type="password" show-password placeholder="再次输入" maxlength="50" /><span v-if="pwd.confirmPwd" class="input-counter">{{ pwd.confirmPwd.length }}/50</span></div></el-form-item>
            <el-button class="pf-btn pf-btn-primary" @click="changePwd" :loading="changingPwd"><CheckOne theme="outline" size="16" fill="currentColor" /> 更新密码</el-button>
          </el-form>
        </div>

        <!-- 短信配置（仅管理员） -->
        <div class="st-card pf-card-sms" v-if="isAdmin">
          <h3 class="st-card-title"><MessageEmoji theme="outline" size="17" fill="var(--gold)" /> 短信服务配置</h3>
          <p class="st-card-sub">配置阿里云短信服务后，用户可通过手机号注册、短信登录和找回密码。留空则使用降级模式（验证码固定 888888）。</p>
          <div :class="['st-hint-card', smsCfg.enabled && smsCfg.accessKeyId ? 'st-hint-ok' : '']" style="margin-bottom:14px">
            <span v-if="!smsCfg.enabled">短信认证已关闭，登录/注册页面不显示短信入口</span>
            <span v-else-if="!smsCfg.accessKeyId || !smsCfg._hasSecret">⚠️ 当前为降级模式：验证码固定 888888。填写真实的 AccessKey 后自动切换为真实发送。</span>
            <span v-else>✅ 短信服务已就绪，使用真实阿里云通道发送</span>
          </div>
          <div class="st-toggle-row" style="margin-bottom:14px"><div class="st-toggle-info"><span class="st-toggle-label">启用短信认证</span><span class="st-toggle-hint">开启后登录页显示「短信登录」入口，注册可绑定手机号</span></div><el-switch v-model="smsCfg.enabled" @change="saveSmsCfg(false)" /></div>
          <div class="st-field-row"><span class="st-field-label">AccessKey ID</span><el-input v-model="smsCfg.accessKeyId" size="small" style="width:320px" placeholder="阿里云 AccessKey ID" autocomplete="off" name="sms-ak-id" /></div>
          <div class="st-field-row"><span class="st-field-label">AccessKey Secret</span><el-input v-model="smsCfg.accessKeySecret" size="small" style="width:320px" type="password" show-password :placeholder="smsCfg._hasSecret ? '已保存（留空不修改）' : '阿里云 AccessKey Secret'" autocomplete="new-password" name="sms-ak-secret" /></div>
          <div class="st-field-row">
            <span class="st-field-label">短信签名<span class="st-field-help">预设或自定义</span></span>
            <el-select v-model="smsCfg.signName" size="small" style="width:320px" filterable allow-create>
              <el-option v-for="s in smsSignatures" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bg-300)">
            <span style="font-size:12px;font-weight:600;color:var(--text-100);margin-bottom:10px;display:block">各场景模板 CODE</span>
            <div class="st-field-row" v-for="scene in smsSceneList" :key="scene.key">
              <span class="st-field-label">{{ scene.label }}</span>
              <el-select v-model="smsCfg.templateCodes[scene.key]" size="small" style="width:280px" filterable allow-create>
                <el-option v-for="t in smsTemplates" :key="t.code" :label="t.code + ' — ' + t.scene ? '(' + t.scene + ') ' : '' + t.desc" :value="t.code" />
              </el-select>
            </div>
          </div>
          <div class="st-prov-actions">
            <el-button type="primary" size="small" @click="saveSmsCfg(true)" :loading="smsSaving">保存配置</el-button>
            <el-button size="small" @click="testSms" :loading="smsTesting">{{ smsTestMsg }}</el-button>
            <span class="sms-test-dot" :class="smsTestStatus" v-if="smsTestStatus"></span>
            <span v-if="smsSaved" style="color:#67c23a;font-size:12px;margin-left:8px">✓ 已保存</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { Cpu, PictureOne, FolderOpen, Voice, SettingTwo, Data, Key, People, Shield, DocDetail, User, CheckOne, Lock, IdCard, EditTwo, MessageEmoji } from '@icon-park/vue-next';
import { useRoute } from 'vue-router';
import { configAPI } from '../api';

const route = useRoute();
const settingsTab = ref('llm');
const saving = ref(false); const loading = ref(false); const testing = ref(''); const testResults = reactive({});

// ===== 更新日志 =====
function tagLabel(t) { const m = { feat: '新功能', fix: '修复', style: '样式', refactor: '优化', docs: '文档', perf: '性能' }; return m[t] || t; }
const changelog = ref([]);
async function loadChangelog() { try { const res = await fetch('/changelog.json'); if (res.ok) changelog.value = await res.json(); } catch {} }

// ===== 个人中心 =====
const profileUser = reactive({ username: '', nickname: '', avatar: '', uid: '', role: '', createdAt: '', lastLoginAt: '', lastLoginIp: '' });
const profileForm = reactive({ nickname: '', avatar: '' });
const savingProfile = ref(false); const changingPwd = ref(false); const copiedUid = ref(false); const fileInput = ref(null); const pwdForm = ref(null);
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
function onFileChange(e) { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2*1024*1024) { ElMessage.warning('图片不能超过2MB'); return; } const reader = new FileReader(); reader.onload = ev => { profileForm.avatar = ev.target.result; }; reader.readAsDataURL(file); e.target.value = ''; }

async function loadProfileData() {
  try { const res = await fetch('/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }); const d = (await res.json()).data; if (d) { Object.assign(profileUser, d); profileForm.nickname = d.nickname || ''; profileForm.avatar = d.avatar || ''; localStorage.setItem('user', JSON.stringify(d)); } } catch {}
}
async function saveProfile() {
  savingProfile.value = true;
  try { const res = await fetch('/api/v1/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ nickname: profileForm.nickname, avatar: profileForm.avatar }) }); const data = await res.json(); if (res.ok) { profileUser.nickname = profileForm.nickname; profileUser.avatar = profileForm.avatar; localStorage.setItem('user', JSON.stringify(profileUser)); ElMessage.success('已保存'); } else ElMessage.error(data.message); } catch { ElMessage.error('保存失败'); } finally { savingProfile.value = false; }
}
async function changePwd() { const valid = await pwdForm.value?.validate().catch(() => false); if (!valid) return; changingPwd.value = true; try { const res = await fetch('/api/v1/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword }) }); const data = await res.json(); if (res.ok) { Object.assign(pwd, { oldPassword: '', newPassword: '', confirmPwd: '' }); ElMessage.success('密码已修改'); } else ElMessage.error(data.message); } catch { ElMessage.error('修改失败'); } finally { changingPwd.value = false; } }
async function copyUid() { if (!profileUser.uid) return; try { await navigator.clipboard.writeText(profileUser.uid); copiedUid.value = true; setTimeout(() => copiedUid.value = false, 2000); } catch {} }

// ===== LLM 配置 =====
const activeProvider = ref('deepseek');
const llmStatus = reactive({ configured: false, activeProvider: '', model: '' });
const summary = reactive({ deepseek: { apiKey: '' }, doubao: { apiKey: '' }, tongyi: { apiKey: '' }, openai: { apiKey: '' } });
const form = reactive({
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro' },
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', imageModel: '' },
  doubao: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seedance-2-0-260128', imageModel: '' },
  tongyi: { apiKey: '', baseUrl: '', model: '' },
});

const providers = [
  { key: 'deepseek', label: 'DeepSeek', desc: '国产高性价比大模型，剧本生成和文本推理首选。', placeholder: 'sk-...', keyLink: 'https://platform.deepseek.com/api_keys', fields: [{ name: 'baseUrl', label: 'Base URL', help: 'API 服务地址，通常不需要修改', placeholder: 'https://api.deepseek.com/v1' }, { name: 'model', label: '对话模型', help: '用于剧本生成、角色对话等文本任务', options: ['deepseek-v4-pro', 'deepseek-v4-flash'] }] },
  { key: 'doubao', label: '豆包 / Seedance', desc: '字节跳动火山引擎，专业视频生成和图片生成模型。', placeholder: '火山方舟 API Key', keyLink: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', fields: [{ name: 'baseUrl', label: 'Base URL', help: '火山方舟 Ark API 入口', placeholder: 'https://ark.cn-beijing.volces.com/api/v3' }, { name: 'model', label: '视频 / 对话模型', help: 'Seedance 视频生成或豆包对话', options: ['doubao-seedance-2-0-260128', 'doubao-seedance-2-0-fast-260128', 'doubao-pro-32k', 'doubao-lite-32k'] }, { name: 'imageModel', label: '生图模型', help: 'Seedream 图片生成', options: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] }] },
  { key: 'openai', label: 'OpenAI', desc: 'GPT-4o 系列，多模态理解能力业界领先。', placeholder: 'sk-...', keyLink: 'https://platform.openai.com/api-keys', fields: [{ name: 'baseUrl', label: 'Base URL', help: '可使用官方或第三方代理地址', placeholder: 'https://api.openai.com/v1' }, { name: 'model', label: '对话模型', help: 'Chat 推理模型', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] }, { name: 'imageModel', label: '生图模型', help: 'DALL-E 或 GPT Image', options: ['gpt-image-2', 'dall-e-3', 'dall-e-2'] }] },
  { key: 'tongyi', label: '通义千问', desc: '阿里云自研大语言模型，中文理解能力强。', placeholder: '通义 API Key', keyLink: 'https://dashscope.console.aliyun.com/apiKey', fields: [{ name: 'baseUrl', label: 'Base URL', help: '阿里云 DashScope 服务地址', placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }, { name: 'model', label: '模型', help: '通义提供了多个版本可选', options: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen2.5-72b-instruct'] }] },
];

function testBtnLabel(p) { if (testing.value === p) return '测试中...'; if (testResults[p] === true) return '✓ 已连通'; if (testResults[p] === false) return '✗ 连接失败'; return '测试连接'; }

async function testConnection(provider) { const cfg = form[provider]; if (!cfg.apiKey) { ElMessage.warning('请先填写 API Key'); return; } testing.value = provider; try { const res = await configAPI.testLLMConnection({ provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model }); testResults[provider] = res.data?.ok; ElMessage.success(res.message || (res.data?.ok ? '连接成功' : '连接失败')); } catch (e) { testResults[provider] = false; ElMessage.error('测试失败: ' + (e.response?.data?.message || e.message)); } finally { testing.value = ''; } }

async function refreshStatus() { loading.value = true; try { const [cfgRes, statusRes] = await Promise.all([configAPI.getLLMConfig(), configAPI.getLLMStatus()]); Object.assign(summary, cfgRes.data); Object.assign(llmStatus, statusRes.data); } catch {} finally { loading.value = false; } }

async function saveConfig(provider) { saving.value = true; try { const cfg = form[provider]; await configAPI.updateLLMConfig({ provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, imageModel: cfg.imageModel || '' }); ElMessage.success('已保存'); await refreshStatus(); } catch (e) { ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message)); } finally { saving.value = false; } }

// ===== 生图设置 =====
const imgCfg = reactive({ noTextWatermark: true, imageQuality: '8K', imageStyle: '超写实', characterRatio: '16:9', noRealPerson: true });
const tokenHdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });
async function loadImgCfg() { try { const r = await fetch('/api/v1/config/all', { headers: tokenHdr() }); const d = await r.json(); if (d.data?.aiConfig) Object.assign(imgCfg, d.data.aiConfig); window.__aiConfig = imgCfg; } catch {} }
async function saveImgCfg() { try { await fetch('/api/v1/config/ai', { method: 'PUT', headers: tokenHdr(), body: JSON.stringify(imgCfg) }); window.__aiConfig = imgCfg; } catch {} }

// ===== Seedance 用量 =====
const usage = ref(null); const usageLoading = ref(false); const usageError = ref('');
async function fetchUsage() { usageLoading.value = true; usageError.value = ''; try { const r = await fetch('/api/v1/config/llm/usage', { headers: tokenHdr() }); const d = await r.json(); if (d.data?.error) { usageError.value = d.data.error; usage.value = null; } else { usage.value = d.data; } } catch (e) { usageError.value = e.message || '查询失败'; } finally { usageLoading.value = false; } }
async function downloadVideo(task) { task._downloading = true; try { const r = await fetch('/api/v1/config/llm/download-video', { method: 'POST', headers: tokenHdr(), body: JSON.stringify({ taskId: task.id, uid: '' }) }); const d = await r.json(); if (d.data?.ok) { ElMessage.success('已下载到素材库'); fetchUsage(); } else { ElMessage.error(d.data?.message || d.message || '下载失败'); } } catch (e) { ElMessage.error('下载失败'); } finally { task._downloading = false; } }

// ===== 存储设置 =====
const stor = reactive({ enabled: false, provider: 'minio', endpoint: '', accessKeyId: '', accessKeySecret: '', bucket: '', prefix: '/autodrama/uploads/', _hasSecret: false });
const storTesting = ref(false); const storResult = ref(null); const storRegions = ref([]); const selRegion = ref(''); const customEp = ref(false);
const epPlaceholder = computed(() => ({ aliyun_oss: 'oss-cn-beijing.aliyuncs.com', tencent_cos: 'cos.ap-beijing.myqcloud.com', minio: '127.0.0.1:9000' }[stor.provider] || ''));
const providerLabel = computed(() => ({ aliyun_oss: '阿里云 OSS', tencent_cos: '腾讯云 COS', minio: 'MinIO' }[stor.provider] || ''));
function getEpFromRegion(r) { const f = storRegions.value.find(x => x.region === r); return f ? f.endpoint : ''; }
async function onProviderChange() { storResult.value = null; customEp.value = false; selRegion.value = ''; stor.endpoint = ''; await loadRegions(); if (storRegions.value.length > 0) { selRegion.value = storRegions.value[0].region; stor.endpoint = storRegions.value[0].endpoint; } saveStor(); }
function onRegionChange(r) { storResult.value = null; stor.endpoint = getEpFromRegion(r); saveStor(); }
async function loadRegions() { if (stor.provider === 'minio') { storRegions.value = []; return; } try { const r = await fetch(`/api/v1/config/storage/regions?provider=${stor.provider}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); const d = await r.json(); storRegions.value = d.data || []; } catch {} }
async function loadStorCfg() { try { const r = await fetch('/api/v1/config/all', { headers: tokenHdr() }); const d = await r.json(); if (d.data?.storageConfig) { Object.assign(stor, d.data.storageConfig); stor._hasSecret = !!d.data.storageConfig.accessKeySecret; } await loadRegions(); if (stor.endpoint && stor.provider !== 'minio') { const m = storRegions.value.find(x => x.endpoint === stor.endpoint); if (m) selRegion.value = m.region; else customEp.value = true; } } catch {} }
async function saveStor() { try { const b = { ...stor }; delete b._hasSecret; await fetch('/api/v1/config/storage', { method: 'PUT', headers: tokenHdr(), body: JSON.stringify(b) }); } catch {} }
async function testStorConnection() { storTesting.value = true; storResult.value = null; try { const r = await fetch('/api/v1/config/storage/test', { method: 'POST', headers: tokenHdr(), body: JSON.stringify({ ...stor }) }); storResult.value = await r.json(); } catch {} finally { storTesting.value = false; } }

// ===== TTS =====
const ttsForm = reactive({ apiKey: '', resourceId: 'seed-tts-2.0', defaultSpeaker: 'zh_female_vv_uranus_bigtts', customVoiceId: '', format: 'mp3', sampleRate: 24000, speechRate: 0, loudnessRate: 0, enableSubtitle: true, disableMarkdownFilter: true, useCache: true, explicitLanguage: 'zh-cn' });
const ttsVoiceOptions = ref([{ label: '加载中...', value: '' }]);

async function fetchTTSVoices() { try { const { data } = await configAPI.getTTSVoices(); if (data && data.length > 0) { const opts = [{ label: '🤖 自定义音色ID...', value: '__custom__' }]; const byGender = {}; data.forEach(v => { const g = v.gender || '其他'; if (!byGender[g]) byGender[g] = []; byGender[g].push({ label: `${v.name} (${v.id.split('_').slice(0,3).join('_')})`, value: v.id }); }); Object.entries(byGender).forEach(([gender, voices]) => { const icon = { '女': '👩', '男': '👨' }[gender] || '🎤'; opts.push({ label: `──────── ${icon} ${gender}声 ────────`, value: '__group_' + gender, disabled: true }); opts.push(...voices); }); ttsVoiceOptions.value = opts; } } catch {} }
const ttsSaving = ref(false); const ttsTesting = ref(false); const ttsTestResult = ref(null);

async function fetchTTSConfig() { try { const { data } = await configAPI.getTTSConfig(); if (data) Object.keys(ttsForm).forEach(k => { if (data[k] !== undefined && data[k] !== null) ttsForm[k] = data[k]; }); } catch {} }
async function saveTTS() { ttsSaving.value = true; try { await configAPI.updateTTSConfig({ ...ttsForm }); ElMessage.success('已保存'); } catch { ElMessage.error('保存失败'); } finally { ttsSaving.value = false; } }
function autoSaveTTS() {}
async function testTTS() { if (!ttsForm.apiKey) { ElMessage.warning('请先填写 API Key'); return; } ttsTesting.value = true; ttsTestResult.value = null; try { await configAPI.updateTTSConfig({ ...ttsForm }); const res = await configAPI.testTTSConnection({}); ttsTestResult.value = res.data || res; if (res.data?.ok) ElMessage.success('TTS 连接成功'); else ElMessage.error(res.data?.message || '测试失败'); } catch (e) { ttsTestResult.value = { ok: false, message: e.response?.data?.message || e.message }; } finally { ttsTesting.value = false; } }

// ===== 管理员 =====
const isAdmin = computed(() => { try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'admin'; } catch { return false; } });

// ===== 短信配置（仅管理员） =====
const smsCfg = reactive({ accessKeyId: '', accessKeySecret: '', signName: '', templateCode: '', templateCodes: { login: '100001', changePhone: '100002', resetPwd: '100003', bindPhone: '100004', verifyPhone: '100005' }, _hasSecret: false, enabled: true });
const smsTemplates = ref([]);
const smsSignatures = ref([]);
const smsSceneList = [
  { key: 'login', label: '登录/注册' },
  { key: 'changePhone', label: '修改手机号' },
  { key: 'resetPwd', label: '重置密码' },
  { key: 'bindPhone', label: '绑定手机号' },
  { key: 'verifyPhone', label: '验证手机号' },
];
const smsSaving = ref(false);
const smsSaved = ref(false);
const smsTesting = ref(false);
const smsTestStatus = ref('');
const smsTestMsg = ref('测试连接');

async function loadSmsCfg() {
  try {
    const r = await fetch('/api/v1/config/sms', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    const d = await r.json();
    if (d.data) { Object.assign(smsCfg, d.data); smsCfg._hasSecret = !!d.data.accessKeySecret; if (!smsCfg.templateCodes || Object.keys(smsCfg.templateCodes).length === 0) smsCfg.templateCodes = { login: '100001', changePhone: '100002', resetPwd: '100003', bindPhone: '100004', verifyPhone: '100005' }; }
    if (d.templates) smsTemplates.value = d.templates;
    if (d.signatures) smsSignatures.value = d.signatures;
  } catch {}
}
async function saveSmsCfg(showMsg = true) {
  smsSaving.value = true;
  try {
    await fetch('/api/v1/config/sms', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ accessKeyId: smsCfg.accessKeyId, accessKeySecret: smsCfg.accessKeySecret, signName: smsCfg.signName, templateCode: smsCfg.templateCode, templateCodes: smsCfg.templateCodes, enabled: smsCfg.enabled }) });
    if (showMsg) { smsSaved.value = true; setTimeout(() => smsSaved.value = false, 3000); ElMessage.success('短信配置已保存'); }
  } catch { ElMessage.error('保存失败'); }
  finally { smsSaving.value = false; }
}
async function testSms() {
  if (smsTesting.value) return; // 防重复点击
  smsTesting.value = true; smsTestStatus.value = ''; smsTestMsg.value = '测试中...';
  try {
    const r = await fetch('/api/v1/config/sms/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ accessKeyId: smsCfg.accessKeyId, accessKeySecret: smsCfg.accessKeySecret, signName: smsCfg.signName, templateCode: smsCfg.templateCode }),
    });
    const d = await r.json();
    if (d.ok) { smsTestStatus.value = 'ok'; smsTestMsg.value = '已连通'; ElMessage.success(d.message || '连接成功'); }
    else { smsTestStatus.value = 'fail'; smsTestMsg.value = '连接失败'; ElMessage.error(d.message || '连接失败'); }
  } catch { smsTestStatus.value = 'fail'; smsTestMsg.value = '请求失败'; }
  finally { smsTesting.value = false; }
}

watch(() => settingsTab.value, v => { if (v === 'profile') { loadProfileData(); if (isAdmin.value) loadSmsCfg(); } });
watch(() => route.path, p => { if (p === '/settings') refreshStatus(); });

onMounted(() => { refreshStatus(); fetchTTSConfig(); fetchTTSVoices(); loadChangelog(); if (localStorage.getItem('token')) { loadImgCfg(); if (isAdmin.value) loadStorCfg(); } });
</script>

<style scoped>
.page { padding: 0; }
.page-header { margin-bottom: 20px; }
.settings-tabs { display: flex; gap: 2px; margin-bottom: 22px; background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 4px; }
.st-tab { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 8px 16px; cursor: pointer; color: var(--text-200); border-radius: 7px; transition: all 0.15s; user-select: none; font-weight: 500; }
.st-tab:hover { color: var(--text-100); background: var(--bg-100); }
.st-tab.active { background: var(--navy); color: var(--gold); font-weight: 700; }
.st-section { margin-top: 0; }
.st-grid { display: flex; flex-direction: column; gap: 14px; }

/* ===== 状态卡 ===== */
.st-status-card { display: flex; align-items: center; gap: 16px; padding: 18px 22px; border-radius: 12px; background: var(--bg-200); border: 1px solid var(--bg-300); border-left: 4px solid var(--bg-300); transition: all 0.3s; }
.st-status-card.ready { border-left-color: #67c23a; background: rgba(103,194,58,0.03); }
.st-status-dot { width: 10px; height: 10px; border-radius: 50%; background: #aaa; flex-shrink: 0; }
.st-status-card.ready .st-status-dot { background: #67c23a; box-shadow: 0 0 12px rgba(103,194,58,0.5); animation: dotPulse 2s ease-in-out infinite; }
@keyframes dotPulse { 0%, 100% { box-shadow: 0 0 6px rgba(103,194,58,0.4); } 50% { box-shadow: 0 0 20px rgba(103,194,58,0.8); } }
.st-status-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.st-status-title { font-size: 15px; font-weight: 700; color: var(--text-100); }
.st-status-sub { font-size: 12px; color: var(--text-200); }
.st-status-btn { flex-shrink: 0; }

/* ===== 通用卡片 ===== */
.st-card { background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px; padding: 20px 22px; transition: border-color 0.2s; }
.st-card:hover { border-color: var(--gold); }
.st-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.st-card-title { font-size: 15px; font-weight: 700; color: var(--text-100); margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
.st-card-sub { font-size: 12px; color: var(--text-200); margin: 0 0 14px; line-height: 1.6; }

/* ===== Provider Tabs ===== */
.st-provider-tabs { margin: 0; }
.st-prov-tab { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.st-prov-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.st-prov-dot.ok { background: #67c23a; box-shadow: 0 0 6px rgba(103,194,58,0.5); }
.st-prov-dot.off { background: var(--bg-300); }
.st-prov-desc { font-size: 12px; color: var(--text-200); margin: 6px 0 14px; line-height: 1.6; padding: 10px 14px; background: var(--bg-100); border-radius: 8px; border-left: 3px solid var(--gold); }
.st-prov-form { display: flex; flex-direction: column; gap: 12px; max-width: 520px; }
.st-prov-actions { display: flex; gap: 10px; align-items: center; margin-top: 4px; }

/* ===== 字段 ===== */
.st-field { display: flex; flex-direction: column; gap: 4px; }
.st-field-label { font-size: 13px; font-weight: 600; color: var(--text-100); }
.st-field-help { font-weight: 400; color: var(--text-200); font-size: 11px; margin-left: 8px; }
.st-field-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--bg-300); }
.st-field-row:last-child { border-bottom: none; }
.st-key-link { font-size: 12px; color: #409eff; text-decoration: none; font-weight: 600; white-space: nowrap; }
.st-key-link:hover { text-decoration: underline; }

/* ===== 开关行 ===== */
.st-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--bg-300); }
.st-toggle-row:last-child { border-bottom: none; }
.st-toggle-info { display: flex; flex-direction: column; gap: 2px; }
.st-toggle-label { font-size: 13px; font-weight: 600; color: var(--text-100); }
.st-toggle-hint { font-size: 11px; color: var(--text-200); }

/* ===== 提示条 ===== */
.st-hint-card { padding: 12px 18px; border-radius: 10px; font-size: 13px; color: var(--text-100); background: var(--bg-100); border: 1px solid var(--bg-300); display: flex; align-items: center; gap: 8px; }
.st-hint-ok { background: rgba(103,194,58,0.05); border-color: rgba(103,194,58,0.2); color: #4a8c2c; }

/* ===== 测试按钮 ===== */
.st-test-btn { border: 2px solid var(--bg-300) !important; background: var(--bg-100) !important; color: var(--text-100) !important; border-radius: 8px !important; font-weight: 600 !important; }
.st-test-btn:hover { border-color: var(--gold) !important; }
.st-test-btn.test-ok { border-color: #67c23a !important; color: #67c23a !important; background: rgba(103,194,58,0.05) !important; }
.st-test-btn.test-fail { border-color: #f56c6c !important; color: #f56c6c !important; background: rgba(245,108,108,0.05) !important; }

/* ===== 用量 ===== */
.st-usage-error { color: #f56c6c; margin-bottom: 8px; font-size: 12px; }
.st-usage-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px; }
.st-usage-card { background: var(--bg-100); border: 1px solid var(--bg-300); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.st-usage-num { font-size: 22px; font-weight: 900; color: var(--text-100); font-family: 'Playfair Display', serif; }
.st-usage-num small { font-size: 12px; }
.st-usage-label { font-size: 11px; color: var(--text-200); }
.st-usage-table-wrap { margin-top: 12px; }

/* ===== 更新日志 ===== */
.changelog-timeline { padding: 10px 0; max-width: 720px; }
.cl-item { display: flex; gap: 16px; position: relative; padding-bottom: 20px; }
.cl-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--bg-300); border: 2px solid var(--primary-300); flex-shrink: 0; margin-top: 4px; position: relative; z-index: 1; }
.cl-dot-latest { background: var(--gold); border-color: var(--gold); box-shadow: 0 0 0 4px rgba(201,168,76,0.2); animation: dotPulse 2s ease-in-out infinite; }
.cl-line { position: absolute; left: 6px; top: 22px; bottom: 0; width: 2px; background: var(--bg-300); }
.cl-body { flex: 1; min-width: 0; }
.cl-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.cl-version { font-size: 16px; font-weight: 700; color: var(--text-100); }
.cl-date { font-size: 12px; color: var(--primary-300); }
.cl-latest-tag { margin-left: 2px; }
.cl-changes { list-style: none; padding: 0; margin: 0; }
.cl-changes li { font-size: 13px; color: var(--text-200); padding: 4px 0; line-height: 1.6; display: flex; align-items: flex-start; gap: 8px; }
.cl-tag { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
.cl-tag.feat { background: #e1f3d8; color: #67c23a; }
.cl-tag.fix { background: #fef0f0; color: #f56c6c; }
.cl-tag.style { background: #f5e6c8; color: #c9a84c; }
.cl-tag.refactor { background: #e2f3f5; color: #02adb5; }
.cl-tag.docs { background: #ecf5ff; color: #409eff; }
.cl-tag.perf { background: #f0e6f6; color: #9b59b6; }

/* ===== 个人中心 ===== */
.pf-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 860px; }
.pf-card-main { grid-column: span 2; }
.pf-card-info { grid-column: span 2; }
.pf-hero { display: flex; align-items: center; gap: 24px; }
.pf-avatar-wrap { position: relative; cursor: pointer; flex-shrink: 0; }
.pf-avatar { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; font-size: 32px; font-weight: 700; color: var(--navy); border: 3px solid var(--bg-300); transition: border-color 0.2s; }
.pf-avatar-wrap:hover .pf-avatar { border-color: var(--gold); }
.pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
.pf-avatar-badge { position: absolute; bottom: 2px; right: 2px; width: 28px; height: 28px; border-radius: 50%; background: var(--gold); display: flex; align-items: center; justify-content: center; border: 2px solid var(--bg-200); }
.pf-hero-info { display: flex; flex-direction: column; gap: 4px; }
.pf-hero-name { font-size: 20px; font-weight: 700; color: var(--text-100); }
.pf-hero-role { font-size: 13px; color: var(--text-200); display: flex; align-items: center; gap: 6px; }
.pf-role-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pf-role-dot.admin { background: #f56c6c; box-shadow: 0 0 6px rgba(245,108,108,0.5); }
.pf-role-dot.user { background: #409eff; }
.pf-hero-sub { font-size: 12px; color: var(--text-200); opacity: 0.7; }

.pf-detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.pf-detail-item { padding: 12px 14px; border-radius: 8px; background: var(--bg-100); display: flex; flex-direction: column; gap: 4px; }
.pf-detail-label { font-size: 11px; color: var(--text-200); text-transform: uppercase; letter-spacing: 0.5px; }
.pf-detail-val { font-size: 13px; font-weight: 600; color: var(--text-100); }
.pf-uid { cursor: pointer; font-family: 'Courier New', monospace; position: relative; user-select: all; }
.pf-uid:hover { color: var(--gold); }
.pf-copied { font-size: 10px; color: #67c23a; margin-left: 6px; font-family: inherit; }

/* 个人中心按钮 */
.pf-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; border: 1px solid var(--bg-300); background: var(--bg-100); color: var(--text-100); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
.pf-btn:hover { border-color: var(--gold); color: var(--gold-dark); background: var(--bg-200); transform: translateY(-1px); }
.pf-btn-primary { background: var(--gold); border-color: var(--gold); color: var(--navy); }
.pf-btn-primary:hover { background: var(--gold-dark); border-color: var(--gold-dark); color: #fff; }

@media (max-width: 700px) {
  .pf-layout { grid-template-columns: 1fr; max-width: 100%; }
  .pf-card-main, .pf-card-info { grid-column: span 1; }
  .pf-detail-grid { grid-template-columns: 1fr 1fr; }
  .settings-tabs { flex-wrap: wrap; }
}

/* 输入框字符计数 */
.input-counter-wrap { position: relative; width: 100%; }
.input-counter {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  font-size: 11px; color: var(--text-200); background: var(--bg-100);
  padding: 1px 8px; border-radius: 4px; pointer-events: none;
  font-weight: 600; z-index: 2; font-family: 'DM Sans', sans-serif;
  transition: color 0.2s;
}

/* 短信连通性测试圆点（呼吸灯） */
.sms-test-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-left: 4px; }
.sms-test-dot.ok { background: #67c23a; box-shadow: 0 0 6px rgba(103,194,58,0.5); animation: smsBreathe 2s ease-in-out infinite; }
.sms-test-dot.fail { background: #f56c6c; box-shadow: 0 0 4px rgba(245,108,108,0.4); }
@keyframes smsBreathe { 0%, 100% { box-shadow: 0 0 4px rgba(103,194,58,0.3); } 50% { box-shadow: 0 0 16px rgba(103,194,58,0.7); } }
</style>
