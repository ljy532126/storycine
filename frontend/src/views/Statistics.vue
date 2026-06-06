<template>
  <div class="st-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">数据看板</span>
    </div>

    <!-- 工具栏 -->
    <div class="st-toolbar">
      <div class="st-toolbar-left">
        <span :class="{ 'st-status': true, loading: loading }">{{ loading ? '加载中' : '已更新' }}</span>
        <span class="st-updated" v-if="lastUpdated">{{ lastUpdated }}</span>
        <span class="st-updated" v-if="fetchError" style="color:#F56C6C">{{ fetchError }}</span>
      </div>
      <div class="st-toolbar-right">
        <el-tooltip content="自动刷新（每5分钟）" placement="top">
          <el-switch v-model="autoRefresh" size="small" @change="toggleAutoRefresh" />
        </el-tooltip>
        <span style="font-size:12px;color:var(--text-200);margin:0 6px 0 2px">自动</span>
        <el-button size="small" @click="refreshAll" :loading="loading">
          <Refresh theme="outline" size="14" fill="currentColor" /> 刷新
        </el-button>
        <el-dropdown @command="handleExport" trigger="click">
          <el-button size="small">导出 ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="overview">📊 今日概览 CSV</el-dropdown-item>
              <el-dropdown-item command="weekly">📈 近7天趋势 CSV</el-dropdown-item>
              <el-dropdown-item command="genres">🔥 热门题材 CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Tab 导航 -->
    <div class="st-tabs">
      <span :class="['st-tab', { active: statTab === 'overview' }]" @click="statTab = 'overview'">今日概览</span>
      <span :class="['st-tab', { active: statTab === 'trend' }]" @click="statTab = 'trend'">趋势 & 排行</span>
      <span :class="['st-tab', { active: statTab === 'ai' }]" @click="statTab = 'ai'">AI 调用</span>
      <span :class="['st-tab', { active: statTab === 'endpoints' }]" @click="statTab = 'endpoints'">接口监控</span>
      <span :class="['st-tab', { active: statTab === 'users' }]" @click="statTab = 'users'">用户分析</span>
    </div>

    <!-- 今日概览 -->
    <section class="st-section" v-show="statTab === 'overview'">
      <div class="st-overview-cards">
        <div v-for="(c, idx) in overviewCards" :key="c.label" class="st-ov-card" :style="{ animationDelay: idx * 80 + 'ms' }">
          <div class="ov-icon" :style="{ background: c.gradient }">
            <component :is="c.icon" theme="outline" size="22" :fill="c.iconFill" />
          </div>
          <div class="ov-body">
            <span class="ov-value">{{ c.value }}</span>
            <span class="ov-label">{{ c.label }}</span>
          </div>
          <div class="ov-change" :class="{ 'ov-up': c.up, 'ov-down': !c.up }" v-if="c.changeText">
            <span class="ov-change-arrow">{{ c.up ? '↑' : '↓' }}</span>
            {{ c.changeText.replace(/[↑↓]\s*/, '') }}
          </div>
          <div class="ov-bg-icon">{{ c.pattern }}</div>
        </div>
      </div>

      <!-- 实时数据流 -->
      <div class="ov-live-row">
        <div class="ov-live-card">
          <div class="ov-live-head">
            <Time theme="outline" size="16" fill="var(--gold)" />
            <span>实时调用</span>
            <span class="ov-live-dot"></span>
          </div>
          <div class="ov-live-items">
            <div class="ov-live-item">
              <span class="ov-li-label">AI 生图</span>
              <span class="ov-li-bar"><span class="ov-li-fill" :style="{ width: endpoints.ai?.image ? Math.min((endpoints.ai.image.success / Math.max(endpoints.ai.image.total, 1)) * 100, 100) + '%' : '0%' }"></span></span>
              <span class="ov-li-num">{{ endpoints.ai?.image?.total || 0 }}</span>
            </div>
            <div class="ov-live-item">
              <span class="ov-li-label">AI 生视频</span>
              <span class="ov-li-bar"><span class="ov-li-fill ov-li-fill-video" :style="{ width: endpoints.ai?.video ? Math.min((endpoints.ai.video.success / Math.max(endpoints.ai.video.total, 1)) * 100, 100) + '%' : '0%' }"></span></span>
              <span class="ov-li-num">{{ endpoints.ai?.video?.total || 0 }}</span>
            </div>
            <div class="ov-live-item">
              <span class="ov-li-label">LLM 文本</span>
              <span class="ov-li-bar"><span class="ov-li-fill ov-li-fill-llm" :style="{ width: endpoints.ai?.llm ? Math.min((endpoints.ai.llm.success / Math.max(endpoints.ai.llm.total, 1)) * 100, 100) + '%' : '0%' }"></span></span>
              <span class="ov-li-num">{{ endpoints.ai?.llm?.total || 0 }}</span>
            </div>
          </div>
        </div>
        <div class="ov-live-card">
          <div class="ov-live-head">
            <Data theme="outline" size="16" fill="var(--gold)" />
            <span>接口健康</span>
          </div>
          <div class="ov-health-ring">
            <svg viewBox="0 0 100 100" width="90" height="90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-300)" stroke-width="8" />
              <circle cx="50" cy="50" r="40" fill="none" :stroke="endpoints.health > 90 ? '#67c23a' : endpoints.health > 70 ? '#e6a23c' : '#f56c6c'" stroke-width="8"
                stroke-dasharray="251.2" :stroke-dashoffset="251.2 - (251.2 * (endpoints.health || 100) / 100)"
                stroke-linecap="round" transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 0.8s" />
            </svg>
            <div class="ov-health-text">
              <span class="ov-health-pct">{{ endpoints.health || 100 }}%</span>
              <span class="ov-health-sub">健康度</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 服务器监控 -->
      <div class="ov-live-row" style="margin-top:14px">
        <div class="ov-live-card" style="grid-column: span 2">
          <div class="ov-live-head">
            <Cpu theme="outline" size="16" fill="var(--gold)" />
            <span>服务器状态</span>
            <span class="ov-live-dot"></span>
          </div>
          <div class="st-monitor-grid" v-if="serverData">
            <div class="st-mon-block">
              <div class="st-mon-block-head">
                <span class="st-mon-block-icon" style="background:rgba(64,158,255,0.1)"><Cpu theme="outline" size="20" fill="#409eff" /></span>
                <div>
                  <span class="st-mon-block-title">CPU</span>
                  <span class="st-mon-block-sub">{{ serverData.cpu.model }}</span>
                </div>
                <span class="st-mon-block-pct" :style="{ color: serverData.cpu.usagePct > 80 ? '#f56c6c' : '#409eff' }">{{ serverData.cpu.usagePct }}%</span>
              </div>
              <el-progress :percentage="serverData.cpu.usagePct" :stroke-width="8" :color="serverData.cpu.usagePct > 80 ? '#f56c6c' : '#409eff'" style="margin:12px 0 8px" />
              <div class="st-mon-block-info">{{ serverData.cpu.cores }} 核心 · 负载 {{ serverData.cpu.loadAvg?.[0] || '-' }}</div>
            </div>
            <div class="st-mon-block">
              <div class="st-mon-block-head">
                <span class="st-mon-block-icon" style="background:rgba(201,168,76,0.1)"><Memory theme="outline" size="20" fill="var(--gold)" /></span>
                <div>
                  <span class="st-mon-block-title">内存</span>
                  <span class="st-mon-block-sub">{{ serverData.memory.used }} / {{ serverData.memory.total }} GB</span>
                </div>
                <span class="st-mon-block-pct" :style="{ color: serverData.memory.usagePct > 80 ? '#f56c6c' : 'var(--gold)' }">{{ serverData.memory.usagePct }}%</span>
              </div>
              <el-progress :percentage="serverData.memory.usagePct" :stroke-width="8" :color="serverData.memory.usagePct > 80 ? '#f56c6c' : 'var(--gold)'" style="margin:12px 0 8px" />
              <div class="st-mon-block-info">{{ serverData.memory.free || '-' }} GB 可用</div>
            </div>
            <div class="st-mon-block">
              <div class="st-mon-block-head">
                <span class="st-mon-block-icon" style="background:rgba(103,194,58,0.1)"><Timer theme="outline" size="20" fill="#67c23a" /></span>
                <div>
                  <span class="st-mon-block-title">运行时长</span>
                  <span class="st-mon-block-sub">持续运行</span>
                </div>
              </div>
              <div class="st-mon-uptime">{{ serverData.uptimeFormatted || '-' }}</div>
            </div>
            <div class="st-mon-block">
              <div class="st-mon-block-head">
                <span class="st-mon-block-icon" style="background:rgba(139,115,85,0.1)"><SettingTwo theme="outline" size="20" fill="var(--primary-100)" /></span>
                <div>
                  <span class="st-mon-block-title">系统</span>
                  <span class="st-mon-block-sub">平台 & 架构</span>
                </div>
              </div>
              <div class="st-mon-uptime" style="font-size:15px">{{ serverData.platform }} {{ serverData.arch }}</div>
            </div>
          </div>
          <div class="st-empty-hint" v-else>暂无服务器数据</div>
        </div>
      </div>
    </section>

    <!-- 趋势 -->
    <section class="st-section" v-show="statTab === 'trend'">
      <div class="st-card st-trend-card">
        <div class="st-card-head">
          <h2 class="st-section-title"><Trend theme="outline" size="18" fill="var(--gold)" /> 近7天趋势</h2>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot" style="background:var(--gold)"></span> 剧本生成</span>
            <span class="legend-item"><span class="legend-dot" style="background:var(--primary-100)"></span> 成片合成</span>
          </div>
        </div>
        <div class="st-chart-container" style="position:relative">
          <canvas ref="trendCanvas" width="900" height="240" @mousemove="onChartHover" @mouseleave="chartTooltip.show = false"></canvas>
          <div v-if="chartTooltip.show" class="chart-tooltip" :style="{ left: chartTooltip.x + 'px', top: chartTooltip.y + 'px' }">
            <div class="ct-date">{{ chartTooltip.label }}</div>
            <div><span class="ct-dot" style="background:var(--gold)"></span> 剧本: {{ chartTooltip.script }}</div>
            <div><span class="ct-dot" style="background:var(--primary-100)"></span> 成片: {{ chartTooltip.comp }}</div>
          </div>
        </div>
        <div class="st-chart-empty" v-if="!trendData.labels || trendData.labels.length === 0">暂无趋势数据</div>
      </div>
    </section>

    <!-- 排行 + 活跃 -->
    <div class="st-grid-2" v-show="statTab === 'trend'">
      <!-- 热门题材 Top5 -->
      <div class="st-card st-rank-card">
        <div class="st-card-head">
          <h3 class="st-card-title"><Fire theme="outline" size="18" fill="#e6a23c" /> 热门题材 Top5</h3>
        </div>
        <div class="st-rank-list">
          <div v-if="topGenres.length === 0" class="st-empty-hint">暂无数据</div>
          <div v-for="(g, i) in topGenres" :key="g.name" class="rank-item" :style="{ animationDelay: (i*80)+'ms' }">
            <span :class="['rank-num', { 'rank-top': i < 3 }]">{{ i+1 }}</span>
            <span class="rank-name">{{ g.name }}</span>
            <div class="rank-bar-wrap"><div class="rank-bar" :style="{ width: g.pct+'%', background: g.color }"></div></div>
            <span class="rank-val">{{ g.count }}次</span>
          </div>
        </div>
      </div>

      <!-- 用户活跃 -->
      <div class="st-card st-user-card">
        <div class="st-card-head">
          <h3 class="st-card-title"><People theme="outline" size="18" fill="var(--gold)" /> 用户活跃</h3>
        </div>
        <div class="st-user-stats">
          <div class="user-stat-row">
            <span class="usr-icon" style="background:rgba(201,168,76,0.12)"><People theme="outline" size="16" fill="var(--gold)" /></span>
            <span class="usr-label">日活跃 (DAU)</span>
            <strong class="usr-val" style="color:var(--gold)">{{ userActivity.dau }}</strong>
          </div>
          <div class="user-stat-row">
            <span class="usr-icon" style="background:rgba(139,115,85,0.12)"><EditTwo theme="outline" size="16" fill="var(--primary-100)" /></span>
            <span class="usr-label">人均生成</span>
            <strong class="usr-val" style="color:var(--primary-100)">{{ userActivity.avgGenerations }}</strong>
          </div>
          <div class="user-stat-row">
            <span class="usr-icon" style="background:rgba(103,194,58,0.12)"><AddUser theme="outline" size="16" fill="#67c23a" /></span>
            <span class="usr-label">本周新用户</span>
            <strong class="usr-val" style="color:var(--text-100)">{{ userActivity.newActive }}</strong>
          </div>
          <div class="user-stat-row">
            <span class="usr-icon" style="background:rgba(64,158,255,0.1)"><Data theme="outline" size="16" fill="#409eff" /></span>
            <span class="usr-label">7日留存率</span>
            <strong class="usr-val" style="color:#409eff">{{ userActivity.retentionRate }}%</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 调用统计 -->
    <section class="st-section" v-show="statTab === 'ai'">
      <div class="st-grid-2">
        <div class="st-card">
          <div class="st-card-head">
            <h2 class="st-section-title"><Trend theme="outline" size="18" fill="var(--gold)" /> AI 调用统计</h2>
            <span class="st-card-badge" v-if="endpoints.ai">{{ (endpoints.ai.image?.total || 0) + (endpoints.ai.video?.total || 0) + (endpoints.ai.llm?.total || 0) }} 次</span>
          </div>
          <div class="st-chart-container" style="position:relative">
            <canvas ref="aiBarCanvas" width="500" height="260" @mousemove="onAiBarHover" @mouseleave="aiBarTooltip.show = false"></canvas>
            <div v-if="aiBarTooltip.show" class="chart-tooltip" :style="{ left: aiBarTooltip.x + 'px', top: aiBarTooltip.y + 'px' }">
              <div class="ct-date">{{ aiBarTooltip.category }}</div>
              <div><span class="ct-dot" style="background:#67c23a"></span> 成功: {{ aiBarTooltip.success }}</div>
              <div><span class="ct-dot" style="background:#f56c6c"></span> 失败: {{ aiBarTooltip.fail }}</div>
            </div>
          </div>
          <div class="chart-legend" style="margin-top:4px">
            <span class="legend-item"><span class="legend-dot" style="background:#67c23a"></span> 成功</span>
            <span class="legend-item"><span class="legend-dot" style="background:#f56c6c"></span> 失败</span>
          </div>
        </div>
        <div class="st-card">
          <div class="st-card-head">
            <h2 class="st-section-title"><Data theme="outline" size="18" fill="var(--gold)" /> 调用分布</h2>
          </div>
          <div class="st-chart-container" style="position:relative;display:flex;justify-content:center">
            <canvas ref="aiPieCanvas" width="300" height="240" @mousemove="onAiPieHover" @mouseleave="aiPieTooltip.show = false"></canvas>
            <div v-if="aiPieTooltip.show" class="chart-tooltip" :style="{ left: aiPieTooltip.x + 'px', top: aiPieTooltip.y + 'px' }">
              <div class="ct-date">{{ aiPieTooltip.category }}</div>
              <div><span class="ct-dot" :style="{ background: aiPieTooltip.color }"></span> {{ aiPieTooltip.value }} 次 ({{ aiPieTooltip.pct }}%)</div>
            </div>
          </div>
          <div class="chart-legend" style="justify-content:center;margin-top:4px">
            <span class="legend-item"><span class="legend-dot" style="background:var(--gold)"></span> 生图</span>
            <span class="legend-item"><span class="legend-dot" style="background:#6b8fa3"></span> 生视频</span>
            <span class="legend-item"><span class="legend-dot" style="background:#409eff"></span> LLM</span>
          </div>
        </div>
      </div>
      <!-- 成功率概况 -->
      <div class="st-grid-3" style="margin-top:14px">
        <div class="st-ai-card">
          <div class="st-ai-icon-wrap" style="background:rgba(201,168,76,0.1)"><PictureOne theme="outline" size="24" fill="var(--gold)" /></div>
          <div>
            <div class="st-ai-num" style="font-size:22px">{{ endpoints.ai?.image?.total || 0 }}</div>
            <div class="st-ai-label">生图</div>
          </div>
          <div class="st-ai-rate" :style="{ color: rateColor(endpoints.ai?.image) }">{{ ratePct(endpoints.ai?.image) }}%</div>
        </div>
        <div class="st-ai-card">
          <div class="st-ai-icon-wrap" style="background:rgba(107,143,163,0.1)"><PlayTwo theme="outline" size="24" fill="#6b8fa3" /></div>
          <div>
            <div class="st-ai-num" style="font-size:22px">{{ endpoints.ai?.video?.total || 0 }}</div>
            <div class="st-ai-label">生视频</div>
          </div>
          <div class="st-ai-rate" :style="{ color: rateColor(endpoints.ai?.video) }">{{ ratePct(endpoints.ai?.video) }}%</div>
        </div>
        <div class="st-ai-card">
          <div class="st-ai-icon-wrap" style="background:rgba(64,158,255,0.1)"><EditTwo theme="outline" size="24" fill="#409eff" /></div>
          <div>
            <div class="st-ai-num" style="font-size:22px">{{ endpoints.ai?.llm?.total || 0 }}</div>
            <div class="st-ai-label">LLM 文本</div>
          </div>
          <div class="st-ai-rate" :style="{ color: rateColor(endpoints.ai?.llm) }">{{ ratePct(endpoints.ai?.llm) }}%</div>
        </div>
      </div>
    </section>

    <!-- 接口监控 -->
    <section class="st-section" v-show="statTab === 'endpoints'">
      <div class="st-card">
        <div class="st-card-head">
          <h2 class="st-section-title"><Data theme="outline" size="18" fill="var(--gold)" /> 接口监控</h2>
          <el-button size="small" @click="fetchEndpoints" :loading="endpointsLoading">刷新</el-button>
        </div>
        <div class="st-endpoint-header">
          <span>总请求: <strong>{{ endpoints.total }}</strong></span>
          <span>健康度: <strong :style="{ color: endpoints.health > 90 ? '#67C23A' : endpoints.health > 70 ? '#E6A23C' : '#F56C6C' }">{{ endpoints.health }}%</strong></span>
        </div>
        <div class="st-endpoint-list">
          <div v-for="ep in endpoints.routes.slice(0, 12)" :key="ep.route" class="st-ep-row">
            <span class="st-ep-method" :class="ep.route.split(' ')[0].toLowerCase()">{{ ep.route.split(' ')[0] }}</span>
            <span class="st-ep-path">{{ ep.route.split(' ')[1] }}</span>
            <span class="st-ep-count">{{ ep.count }}次</span>
            <span class="st-ep-last" :title="ep.last">{{ timeAgo(ep.last) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 用户分析 -->
    <section class="st-section" v-show="statTab === 'users'">
      <!-- 顶部数据卡片 -->
      <div class="st-grid-4" style="margin-bottom:14px">
        <div class="st-card ua-stat-card">
          <div class="ua-stat-icon" style="background:rgba(201,168,76,0.12)"><People theme="outline" size="22" fill="var(--gold)" /></div>
          <div class="ua-stat-body">
            <span class="ua-stat-num">{{ userRegion.totalIps }}</span>
            <span class="ua-stat-label">总访问 IP</span>
            <span class="ua-stat-sub" style="color:#67c23a">↑ 近7日 {{ userRegion.weekIps }}</span>
          </div>
        </div>
        <div class="st-card ua-stat-card">
          <div class="ua-stat-icon" style="background:rgba(64,158,255,0.12)"><FolderOpen theme="outline" size="22" fill="#409eff" /></div>
          <div class="ua-stat-body">
            <span class="ua-stat-num">{{ userRegion.coveredProvinces }}</span>
            <span class="ua-stat-label">覆盖省份</span>
            <span class="ua-stat-sub" style="color:var(--text-200)">今日 {{ userRegion.todayIps }} IP</span>
          </div>
        </div>
        <div class="st-card ua-stat-card">
          <div class="ua-stat-icon" style="background:rgba(230,162,60,0.12)"><Fire theme="outline" size="22" fill="#e6a23c" /></div>
          <div class="ua-stat-body">
            <span class="ua-stat-num">{{ userRegion.topProvince?.value || 0 }}</span>
            <span class="ua-stat-label">TOP {{ userRegion.topProvince?.name || '--' }}</span>
            <span class="ua-stat-sub" style="color:#e6a23c" v-if="userRegion.topProvince">占比 {{ userRegion.topProvince.pct }}%</span>
          </div>
        </div>
        <div class="st-card ua-stat-card">
          <div class="ua-stat-icon" style="background:rgba(196,69,69,0.1)"><People theme="outline" size="22" fill="#c44545" /></div>
          <div class="ua-stat-body">
            <span class="ua-stat-num">{{ userRegion.overseasCount }}</span>
            <span class="ua-stat-label">境外 IP</span>
            <span class="ua-stat-sub" style="color:#c44545" v-if="userRegion.totalIps">占比 {{ (userRegion.overseasCount / userRegion.totalIps * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- 地图 + 柱状图 -->
      <div class="st-grid-ua-map">
        <div class="st-card st-ua-map-card">
          <div class="st-card-head">
            <h2 class="st-section-title"><Data theme="outline" size="18" fill="var(--gold)" /> 全国省份IP热力分布图</h2>
          </div>
          <div ref="uaMapChart" class="ua-chart ua-chart-map"></div>
        </div>
        <div class="st-card">
          <div class="st-card-head">
            <h2 class="st-section-title"><Trend theme="outline" size="18" fill="var(--gold)" /> 省份 TOP10 排行</h2>
          </div>
          <div ref="uaBarChart" class="ua-chart ua-chart-bar"></div>
        </div>
      </div>

      <!-- IP 明细表 -->
      <div class="st-card">
        <div class="st-card-head">
          <h2 class="st-section-title"><Time theme="outline" size="18" fill="var(--gold)" /> 最近访问记录</h2>
          <span style="font-size:11px;color:var(--text-200)">{{ userRegion.recentRecords?.length || 0 }} 条</span>
        </div>
        <div class="ua-table-wrap">
          <table class="ua-table" v-if="userRegion.recentRecords?.length">
            <thead>
              <tr>
                <th>IP 地址</th>
                <th>用户</th>
                <th>国家</th>
                <th>省份/城市</th>
                <th>运营商</th>
                <th>访问时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in userRegion.recentRecords.slice(0, 20)" :key="i">
                <td class="ua-td-ip">{{ r.ip }}</td>
                <td>{{ r.username }}</td>
                <td :style="{ color: r.country !== '中国' ? 'var(--gold)' : 'var(--text-200)' }">{{ r.country || '—' }}</td>
                <td :style="{ color: r.province ? 'var(--text-100)' : 'var(--text-200)' }">{{ r.province }}{{ r.city ? ' ' + r.city : '' }}{{ r.district ? ' ' + r.district : '' }}{{ !r.province && !r.city ? '—' : '' }}</td>
                <td :style="{ color: r.isp ? 'var(--text-100)' : 'var(--text-200)' }">{{ r.isp || '—' }}</td>
                <td style="color:var(--text-200);font-size:11px">{{ formatDate(r.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="st-empty-hint">暂无访问记录</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { People, FolderOpen, EditTwo, PlayTwo, CheckOne, Time, Data, Trend, Fire, AddUser, Cpu, Memory, Timer, SettingTwo, PictureOne, Refresh } from '@icon-park/vue-next';
import * as echarts from 'echarts';
const route = useRoute();

// ===== 响应式数据 =====
const statTab = ref('overview');
const loading = ref(false);
const fetchError = ref('');
const lastUpdated = ref('');
const autoRefresh = ref(false);
let refreshTimer = null;

const overviewCards = ref([
  { label: '新增用户', value: '-', icon: People, iconFill: '#fff', gradient: 'linear-gradient(135deg, #c9a84c, #e0b860)', pattern: '👤', delay: '0ms' },
  { label: '新增项目', value: '-', icon: FolderOpen, iconFill: '#fff', gradient: 'linear-gradient(135deg, #1A1A2E, #2d2d4a)', pattern: '📁', delay: '80ms' },
  { label: '剧本生成', value: '-', icon: EditTwo, iconFill: '#fff', gradient: 'linear-gradient(135deg, #8B7355, #a89070)', pattern: '📝', delay: '160ms' },
  { label: '成片合成', value: '-', icon: PlayTwo, iconFill: '#fff', gradient: 'linear-gradient(135deg, #6b8fa3, #8aafc2)', pattern: '🎥', delay: '240ms' },
  { label: '成功率', value: '-', icon: CheckOne, iconFill: '#fff', gradient: 'linear-gradient(135deg, #67a35c, #7bc06e)', pattern: '✅', delay: '320ms' },
]);

const topGenres = ref([]);
const trendData = reactive({ labels: [], scripts: [], compositions: [] });
const serverData = ref(null);
const userActivity = reactive({ dau: '-', avgGenerations: '-', newActive: '-', retentionRate: '-' });
const distribution = reactive({ regions: [], platforms: [], browsers: [] });

const trendCanvas = ref(null);
const aiBarCanvas = ref(null);
const aiPieCanvas = ref(null);

const chartTooltip = reactive({ show: false, x: 0, y: 0, label: '', script: 0, comp: 0 });
const aiBarTooltip = reactive({ show: false, x: 0, y: 0, category: '', success: 0, fail: 0 });
const aiPieTooltip = reactive({ show: false, x: 0, y: 0, category: '', value: 0, pct: 0, color: '' });

// ===== 用户分析 =====
const userRegion = reactive({
  totalIps: 0, todayIps: 0, weekIps: 0, coveredProvinces: 0,
  provinces: [], topProvince: null, overseasCount: 0, recentRecords: [],
});
const uaMapChart = ref(null);
const uaBarChart = ref(null);
let uaMapInstance = null, uaBarInstance = null;

async function fetchUserRegions() {
  try {
    const res = await fetch('/api/v1/statistics/user-regions', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const json = await res.json();
    if (json.data) {
      Object.assign(userRegion, json.data);
      console.log('[用户分析] provinces=' + (json.data.provinces?.length || 0) + ' first=' + (json.data.provinces?.[0]?.name || 'none') + '=' + (json.data.provinces?.[0]?.value || 0));
      nextTick(() => { drawUserCharts(); });
    }
  } catch { /* ignore */ }
}

async function drawUserCharts() {
  const mapDom = uaMapChart.value;
  const barDom = uaBarChart.value;
  if (!mapDom || !barDom) return;
  const ready = await ensureEcharts();
  if (!ready) return;

  if (uaMapInstance) uaMapInstance.dispose();
  if (uaBarInstance) uaBarInstance.dispose();

  const provinces = userRegion.provinces || [];
  if (provinces.length === 0) return; // 等后端返回数据再渲染
  const maxVal = Math.max(...provinces.map(p => p.value), 1);

  // 中国城市地图（GeoJSON 用 "合肥" 等短名，后端返回匹配）
  uaMapInstance = echarts.init(mapDom);
  uaMapInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: function(p) { return (p.name||'') + '<br/>访问IP：' + (p.value||0) + '个'; } },
    visualMap: {
      min: 0, max: maxVal, left: 8, bottom: 20,
      text: ['高', '低'], calculable: true,
      textStyle: { color: '#8B7355' },
      inRange: { color: ['#bfdbfe', '#6b8fa3', '#8B7355', '#c9a84c', '#e6a23c'] },
    },
    geo: {
      map: MAP_NAME, zoom: 1.8, center: [104.5, 36],
      roam: true,
      label: { show: false },
      emphasis: {
        label: { color: '#1A1A2E', fontSize: 11, fontWeight: 'bold', show: true },
        itemStyle: { areaColor: '#f5e6c8' },
      },
    },
    series: [{
      name: 'IP数量', type: 'map', map: MAP_NAME, geoIndex: 0,
      data: provinces.map(p => ({ name: p.name, value: p.value })),
      itemStyle: { borderColor: '#d4c5c0', borderWidth: 1 },
    }],
  });

  // TOP10 柱状图
  uaBarInstance = echarts.init(barDom);
  const top10 = [...provinces].sort((a, b) => b.value - a.value).slice(0, 10);
  uaBarInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: function(p) { return p[0].name + '<br/>访问IP：' + p[0].value + '个'; } },
    grid: { left: '2%', right: '14%', top: '5%', bottom: '8%', containLabel: true },
    xAxis: { type: 'value', axisLine: { lineStyle: { color: '#d4c5c0' } }, splitLine: { lineStyle: { color: '#f0ebe3' } }, axisLabel: { color: '#8B7355', fontSize: 10 } },
    yAxis: { type: 'category', data: top10.map(i => i.name).reverse(), inverse: true, axisLine: { lineStyle: { color: '#d4c5c0' } }, axisLabel: { color: '#1A1A2E', fontSize: 11, fontWeight: 600 }, axisTick: { show: false } },
    series: [{ type: 'bar', data: top10.map(i => i.value).reverse(), itemStyle: { borderRadius: [0, 4, 4, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#c9a84c' }, { offset: 1, color: '#f5e6c8' }] } }, barWidth: '50%', label: { show: true, position: 'right', color: '#8B7355', fontSize: 11, fontWeight: 700 } }],
  });
}

let mapReady = false;
let mapLoadPromise = null;
const MAP_FILE = '/china_cities.json';
const MAP_NAME = 'china';
function ensureEcharts() {
  if (mapReady) return Promise.resolve(true);
  if (mapLoadPromise) return mapLoadPromise;
  mapLoadPromise = fetch(MAP_FILE)
    .then(r => r.json())
    .then(geoJson => {
      echarts.registerMap(MAP_NAME, geoJson);
      mapReady = true;
      // 地图加载完成后立即渲染（如果数据已就绪）
      if (userRegion.provinces?.length) nextTick(() => drawUserCharts());
      return true;
    })
    .catch((e) => {
      console.error('[CityMap] 加载失败:', e);
      return false;
    });
  return mapLoadPromise;
}

function onResize() {
  if (uaMapInstance) uaMapInstance.resize();
  if (uaBarInstance) uaBarInstance.resize();
}

// Tab switch
watch(() => statTab.value, (v) => {
  if (v === 'users') { fetchUserRegions(); }
  if (v === 'ai') { nextTick(() => { drawAiBarChart(); drawAiPieChart(); }); }
});

// Chart hover handler
function onChartHover(e) {
  const canvas = trendCanvas.value;
  if (!canvas || !trendData.labels.length) { chartTooltip.show = false; return; }
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const scaleX = 900 / rect.width;

  const labels = trendData.labels;
  const pad = { left: 40, right: 24, top: 24, bottom: 32 };
  const pw = 900 - pad.left - pad.right;
  const idx = Math.round(((mx * scaleX) - pad.left) / pw * (labels.length - 1));
  if (idx < 0 || idx >= labels.length) { chartTooltip.show = false; return; }

  chartTooltip.show = true;
  chartTooltip.label = labels[idx];
  chartTooltip.script = trendData.scripts[idx] || 0;
  chartTooltip.comp = trendData.compositions[idx] || 0;
  chartTooltip.x = mx + 12;
  chartTooltip.y = Math.max(0, my - 60);
}
const migrating = ref(false);
const migrateResult = ref('');
const endpoints = reactive({ total: 0, routes: [], recent: [], health: 100 });
const endpointsLoading = ref(false);
async function fetchEndpoints() { endpointsLoading.value = true; try { const r = await fetch('/api/v1/monitor/endpoints', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); const d = await r.json(); Object.assign(endpoints, d.data); } catch {} finally { endpointsLoading.value = false; } }
function timeAgo(t) { if (!t) return ''; const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000); if (s < 60) return s + '秒前'; if (s < 3600) return Math.floor(s / 60) + '分钟前'; return Math.floor(s / 3600) + '小时前'; }

function formatDate(d) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }

function ratePct(d) {
  if (!d || !d.total) return 0;
  return Math.round((d.success || 0) / d.total * 100);
}
function rateColor(d) {
  const r = ratePct(d);
  return r >= 90 ? '#67c23a' : r >= 70 ? '#e6a23c' : '#f56c6c';
}

function onAiBarHover(e) {
  const canvas = aiBarCanvas.value;
  if (!canvas || !endpoints.ai) { aiBarTooltip.show = false; return; }
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (500 / rect.width);
  const cats = [
    { label: '生图', data: endpoints.ai.image, color: 'var(--gold)' },
    { label: '生视频', data: endpoints.ai.video, color: '#6b8fa3' },
    { label: 'LLM', data: endpoints.ai.llm, color: '#409eff' },
  ];
  const barW = 36, barGap = 4, groupGap = 60, startX = 58;
  for (let i = 0; i < 3; i++) {
    const gx = startX + i * (barW * 2 + barGap + groupGap) + barW + barGap;
    if (mx >= gx && mx <= gx + barW) {
      const d = cats[i].data || {};
      aiBarTooltip.show = true;
      aiBarTooltip.category = cats[i].label;
      aiBarTooltip.fail = d.fail || 0;
      aiBarTooltip.success = d.success || 0;
      aiBarTooltip.x = mx + 10;
      aiBarTooltip.y = Math.max(0, (e.clientY - rect.top) - 55);
      return;
    }
  }
  aiBarTooltip.show = false;
}

function formatChange(change) {
  if (change === 0) return '持平';
  const arrow = change > 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(change)}%`;
}

// ===== API 调用 =====
const API = (path) => fetch(`/api/v1/statistics${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());

async function fetchOverview() {
  try {
    const { data } = await API('/daily-overview');
    if (!data) return;
    const cards = overviewCards.value;
    const sets = [
      { key: 'newUsers', idx: 0 },
      { key: 'newProjects', idx: 1 },
      { key: 'scriptsGenerated', idx: 2 },
      { key: 'compositions', idx: 3 },
      { key: 'successRate', idx: 4 },
    ];
    sets.forEach(({ key, idx }) => {
      const d = data[key];
      cards[idx].value = key === 'successRate' ? `${d.value}%` : String(d.value);
      cards[idx].change = d.change;
      cards[idx].up = d.change >= 0;
      cards[idx].changeText = formatChange(d.change);
    });
  } catch (e) { /* keep previous */ }
}

async function fetchWeeklyTrend() {
  try {
    const { data } = await API('/weekly-trend');
    if (!data) return;
    trendData.labels = data.labels || [];
    trendData.scripts = data.scripts || [];
    trendData.compositions = data.compositions || [];
    nextTick(() => drawTrendChart());
  } catch (e) { /* keep previous */ }
}

async function fetchTopGenres() {
  try {
    const { data } = await API('/top-genres');
    if (!data) return;
    topGenres.value = data;
  } catch (e) { /* keep previous */ }
}

async function fetchServerMonitor() {
  try {
    const { data } = await API('/server-monitor');
    if (data) serverData.value = data;
  } catch (e) { /* keep previous */ }
}

async function fetchUserActivity() {
  try {
    const { data } = await API('/user-activity');
    if (!data) return;
    Object.assign(userActivity, data);
  } catch (e) { /* keep previous */ }
}

async function fetchDistribution() {
  try {
    const { data } = await API('/user-distribution');
    if (!data) return;
    distribution.regions = data.regions || [];
    distribution.platforms = data.platforms || [];
    distribution.browsers = data.browsers || [];
  } catch (e) { /* keep previous */ }
}

async function refreshAll() {
  loading.value = true;
  fetchError.value = '';
  try {
    await Promise.all([
      fetchOverview(),
      fetchWeeklyTrend(),
      fetchTopGenres(),
      fetchServerMonitor(),
      fetchUserActivity(),
      fetchDistribution(),
      fetchEndpoints(),
      fetchUserRegions(),
    ]);
    lastUpdated.value = new Date().toLocaleTimeString();
  } catch (e) {
    fetchError.value = '部分数据加载失败，请检查网络连接';
  } finally {
    loading.value = false;
  }
}

function toggleAutoRefresh(val) {
  if (val) {
    refreshTimer = setInterval(refreshAll, 5 * 60 * 1000);
    ElMessage.success('已开启自动刷新（每5分钟）');
  } else {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ===== CSV 导出 =====
function handleExport(type) {
  const token = localStorage.getItem('token');
  const url = `/api/v1/statistics/export-csv?type=${type}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `storycine_${type}_${new Date().toISOString().substring(0, 10)}.csv`;
  // 通过 fetch 带 token 下载（解决 401 无权限问题），失败则直接 a 标签兜底
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = a.download;
      link.click();
      URL.revokeObjectURL(blobUrl);
      ElMessage.success('导出完成');
    })
    .catch(() => { a.click(); });
}

// ===== 图片迁移 =====
async function migrateImages() {
  try { await ElMessageBox.confirm('将把所有已生成的远程图片下载到本地 uploads/ 目录。此操作不会重复下载已有本地图片。确认开始？', '图片迁移', { type: 'info' }); } catch { return; }
  migrating.value = true;
  migrateResult.value = '';
  try {
    const res = await fetch('/api/v1/assets/migrate-images', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const data = await res.json();
    migrateResult.value = data.message;
    ElMessage.success(data.message);
  } catch (e) { ElMessage.error('迁移失败'); }
  finally { migrating.value = false; }
}

// ===== 埋点上报 =====
function trackEvent(event, extra = {}) {
  try {
    const ua = navigator.userAgent || '';
    const platform = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iOS') ? 'iOS' : '其他';
    const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : ua.includes('Firefox') ? 'Firefox' : '其他';
    // 尝试从 Intl 获取地区
    const region = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '';
    fetch('/api/v1/analytics/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, metadata: { platform, browser, region, page: 'statistics', ...extra } }),
    }).catch(() => {});
  } catch {}
}

// ===== Canvas 趋势图 =====
function drawTrendChart() {
  const canvas = trendCanvas.value;
  if (!canvas || !trendData.labels.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width = 900 * dpr, H = canvas.height = 240 * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '240px';
  ctx.scale(dpr, dpr);

  const labels = trendData.labels;
  const scripts = trendData.scripts;
  const comps = trendData.compositions;
  const maxVal = Math.max(...scripts, ...comps, 1);
  const yMax = Math.ceil(maxVal * 1.2);

  const pad = { top: 24, right: 24, bottom: 32, left: 40 };
  const pw = 900 - pad.left - pad.right;
  const ph = 240 - pad.top - pad.bottom;

  function x(i) { return pad.left + (pw / (labels.length - 1 || 1)) * i; }
  function y(v) { return pad.top + ph - (v / yMax) * ph; }

  // Background
  ctx.fillStyle = 'rgba(26,26,46,0.06)';
  ctx.fillRect(pad.left - 4, pad.top - 4, pw + 8, ph + 8);

  // Grid lines
  ctx.strokeStyle = '#E8D5C480';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const gy = pad.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(900 - pad.right, gy); ctx.stroke();
    ctx.fillStyle = '#8B7355'; ctx.font = '10px "DM Sans", sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(yMax - (yMax / 4) * i), pad.left - 8, gy + 4);
  }

  // X labels
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8B7355'; ctx.font = '11px "DM Sans", sans-serif';
  labels.forEach((d, i) => ctx.fillText(d, x(i), 240 - 10));

  // Draw series with area fill
  const series = [
    { data: scripts, color: '#c9a84c', glow: '#c9a84c60', label: '剧本生成' },
    { data: comps, color: '#8B7355', glow: '#8B735540', label: '成片合成' },
  ];

  series.forEach((ser) => {
    // Area fill
    ctx.beginPath();
    ser.data.forEach((v, i) => {
      i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v));
    });
    ctx.lineTo(x(ser.data.length - 1), pad.top + ph);
    ctx.lineTo(x(0), pad.top + ph);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
    grad.addColorStop(0, ser.glow);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ser.data.forEach((v, i) => {
      i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v));
    });
    ctx.strokeStyle = ser.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();

    // Data points
    ser.data.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(x(i), y(v), 4, 0, Math.PI * 2);
      ctx.fillStyle = ser.color; ctx.fill();
      ctx.beginPath(); ctx.arc(x(i), y(v), 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });
  });
}

// AI bar chart
function drawAiBarChart() {
  const canvas = aiBarCanvas.value;
  if (!canvas || !endpoints.ai) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width = 500 * dpr, H = canvas.height = 260 * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '260px';
  ctx.scale(dpr, dpr);

  const img = endpoints.ai.image || {}, vid = endpoints.ai.video || {}, llm = endpoints.ai.llm || {};
  const maxVal = Math.max(
    (img.success || 0) + (img.fail || 0),
    (vid.success || 0) + (vid.fail || 0),
    (llm.success || 0) + (llm.fail || 0),
    1
  );
  const yMax = Math.ceil(maxVal * 1.3);

  const pad = { top: 16, right: 24, bottom: 38, left: 48 };
  const pw = 500 - pad.left - pad.right;
  const ph = 260 - pad.top - pad.bottom;

  // Background
  ctx.fillStyle = 'rgba(26,26,46,0.06)';
  ctx.fillRect(pad.left - 4, pad.top - 4, pw + 8, ph + 8);

  // Grid
  ctx.strokeStyle = '#E8D5C480';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const gy = pad.top + (ph / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(500 - pad.right, gy); ctx.stroke();
    ctx.fillStyle = '#8B7355'; ctx.font = '10px "DM Sans", sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(yMax - (yMax / 4) * i), pad.left - 8, gy + 4);
  }

  const categories = [
    { label: '生图', data: img, colors: ['#67c23a', '#f56c6c'] },
    { label: '生视频', data: vid, colors: ['#67c23a', '#f56c6c'] },
    { label: 'LLM', data: llm, colors: ['#67c23a', '#f56c6c'] },
  ];
  const barW = 36, barGap = 4, groupGap = 60, startX = 58;

  categories.forEach((cat, i) => {
    const gx = startX + i * (barW * 2 + barGap + groupGap);
    const success = cat.data.success || 0, fail = cat.data.fail || 0;

    // Fail bar (behind)
    const failH = (fail / yMax) * ph;
    ctx.fillStyle = '#f56c6c60';
    ctx.fillRect(gx + barW + barGap, pad.top + ph - failH, barW, failH);
    // Fail top
    ctx.fillStyle = '#f56c6c';
    ctx.fillRect(gx + barW + barGap, pad.top + ph - failH, barW, 3);
    if (fail > 0) {
      ctx.fillStyle = '#f56c6c'; ctx.font = '11px "DM Sans", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(fail, gx + barW + barGap + barW / 2, pad.top + ph - failH - 6);
    }

    // Success bar
    const succH = (success / yMax) * ph;
    const grad = ctx.createLinearGradient(0, pad.top + ph - succH, 0, pad.top + ph);
    grad.addColorStop(0, '#67c23a');
    grad.addColorStop(1, '#67c23a40');
    ctx.fillStyle = grad;
    ctx.fillRect(gx, pad.top + ph - succH, barW, succH);
    ctx.fillStyle = '#67c23a';
    ctx.fillRect(gx, pad.top + ph - succH, barW, 3);
    if (success > 0) {
      ctx.fillStyle = '#67c23a'; ctx.font = '11px "DM Sans", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(success, gx + barW / 2, pad.top + ph - succH - 6);
    }

    // Label
    ctx.fillStyle = '#8B7355'; ctx.font = '11px "DM Sans", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(cat.label, gx + barW + barGap / 2, 260 - 10);
  });
}

// AI donut chart
function drawAiPieChart() {
  const canvas = aiPieCanvas.value;
  if (!canvas || !endpoints.ai) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 300 * dpr; canvas.height = 240 * dpr;
  canvas.style.width = '300px'; canvas.style.height = '240px';
  ctx.scale(dpr, dpr);

  const cx = 120, cy = 120, outerR = 88, innerR = 52;
  const img = endpoints.ai.image?.total || 0;
  const vid = endpoints.ai.video?.total || 0;
  const llm = endpoints.ai.llm?.total || 0;
  const total = img + vid + llm || 1;

  const slices = [
    { value: img, color: '#c9a84c', label: '生图' },
    { value: vid, color: '#6b8fa3', label: '生视频' },
    { value: llm, color: '#409eff', label: 'LLM' },
  ];

  // Draw slices
  let startAngle = -Math.PI / 2;
  slices.forEach(slice => {
    const angle = (slice.value / total) * Math.PI * 2;
    if (angle <= 0.01) { startAngle += angle; return; }
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
    ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += angle;
  });

  // Center text - drawn LAST so it's always on top
  ctx.fillStyle = 'rgba(26,26,46,0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '900 26px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.fillStyle = '#8B7355';
  ctx.font = '11px "DM Sans", sans-serif';
  ctx.fillText('总调用', cx, cy + 16);

  // Labels on the right side
  slices.forEach((slice, i) => {
    const pct = Math.round((slice.value / total) * 100);
    const lx = 220;
    const ly = 100 + i * 28;
    ctx.fillStyle = slice.color;
    ctx.fillRect(lx, ly - 4, 10, 10);
    ctx.fillStyle = '#8B7355';
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'middle';
    ctx.fillText(slice.label + '  ' + slice.value + ' (' + pct + '%)', lx + 16, ly);
  });
}

// Pie hover
function onAiPieHover(e) {
  const canvas = aiPieCanvas.value;
  if (!canvas || !endpoints.ai) { aiPieTooltip.show = false; return; }
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (300 / rect.width);
  const my = (e.clientY - rect.top) * (240 / rect.height);

  const cx = 120, cy = 120, outerR = 88, innerR = 52;
  const dx = mx - cx, dy = my - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Only inside ring
  if (dist < innerR - 4 || dist > outerR + 2) { aiPieTooltip.show = false; return; }

  const img = endpoints.ai.image?.total || 0;
  const vid = endpoints.ai.video?.total || 0;
  const llm = endpoints.ai.llm?.total || 0;
  const total = img + vid + llm || 1;
  const slices = [
    { value: img, color: '#c9a84c', label: '生图' },
    { value: vid, color: '#6b8fa3', label: '生视频' },
    { value: llm, color: '#409eff', label: 'LLM' },
  ];

  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  let startAngle = -Math.PI / 2;
  for (const slice of slices) {
    const sweep = (slice.value / total) * Math.PI * 2;
    if (sweep > 0.01 && angle >= startAngle && angle < startAngle + sweep) {
      aiPieTooltip.show = true;
      aiPieTooltip.category = slice.label;
      aiPieTooltip.value = slice.value;
      aiPieTooltip.pct = Math.round((slice.value / total) * 100);
      aiPieTooltip.color = slice.color;
      aiPieTooltip.x = mx + 14;
      aiPieTooltip.y = Math.max(0, my - 40);
      return;
    }
    startAngle += sweep;
  }
  aiPieTooltip.show = false;
}

// ===== 生命周期 =====
watch(() => route.path, (p) => { if (p === '/statistics') refreshAll(); });
// 组件挂载时立即预加载 china.json
onMounted(async () => {
  await refreshAll();
  window.addEventListener('resize', onResize);
  trackEvent('page_view');
  // 预加载地图 GeoJSON
  ensureEcharts();
});

onUnmounted(() => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  window.removeEventListener('resize', onResize);
  if (uaMapInstance) uaMapInstance.dispose();
  if (uaBarInstance) uaBarInstance.dispose();
});
</script>

<style scoped>
.st-root { padding: 0; animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.st-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; margin-bottom: 20px;
  border-bottom: 2px solid var(--bg-300);
}
.st-toolbar-left { display: flex; align-items: center; gap: 10px; }
.st-toolbar-right { display: flex; align-items: center; gap: 8px; }
.st-status { font-size: 12px; color: #67C23A; font-weight: 600; }
.st-status.loading { color: var(--gold-dark); }
.st-updated { font-size: 11px; color: var(--text-200); }
.st-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 2px solid var(--bg-300); padding-bottom: 0; }
.st-tab { font-size: 14px; padding: 10px 20px; cursor: pointer; color: var(--text-200); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; user-select: none; font-weight: 500; }
.st-tab:hover { color: var(--text-100); }
.st-tab.active { color: var(--text-100); font-weight: 700; border-bottom-color: var(--gold); }

.st-section { margin-bottom: 24px; }

/* 概览卡片 */
.st-overview-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 16px; }
.st-ov-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 18px 20px; display: flex; gap: 14px; align-items: center;
  position: relative; overflow: hidden;
  animation: fadeIn 0.4s ease-out both; transition: all 0.25s;
}
.st-ov-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(139,105,20,0.08); }
.ov-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ov-body { display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
.ov-value { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 900; color: var(--text-100); line-height: 1; }
.ov-label { font-size: 11px; color: var(--text-200); letter-spacing: 0.5px; text-transform: uppercase; }
.ov-change {
  position: absolute; top: 12px; right: 14px;
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
}
.ov-up { background: rgba(103,194,58,0.1); color: #67c23a; }
.ov-down { background: rgba(196,69,69,0.08); color: #C44545; }
.ov-change-arrow { margin-right: 1px; }
.ov-bg-icon {
  position: absolute; right: -6px; bottom: -10px; font-size: 44px; opacity: 0.04;
  pointer-events: none; user-select: none;
}

/* 实时数据流 */
.ov-live-row { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.ov-live-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 18px 20px;
}
.ov-live-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-100); margin-bottom: 14px;
  padding-bottom: 10px; border-bottom: 2px solid rgba(201,168,76,0.2);
}
.ov-live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #67c23a;
  margin-left: auto; animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.ov-live-items { display: flex; flex-direction: column; gap: 10px; }
.ov-live-item { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-200); }
.ov-li-label { width: 62px; flex-shrink: 0; font-weight: 500; color: var(--text-100); }
.ov-li-bar { flex: 1; height: 6px; background: var(--bg-300); border-radius: 3px; overflow: hidden; }
.ov-li-fill { display: block; height: 100%; border-radius: 3px; background: #67c23a; transition: width 0.5s; }
.ov-li-fill-video { background: var(--gold); }
.ov-li-fill-llm { background: #409eff; }
.ov-li-num { width: 32px; text-align: right; font-weight: 700; font-size: 13px; color: var(--text-100); flex-shrink: 0; }

/* 健康度环形图 */
.ov-health-ring { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 10px 0; }
.ov-health-text { display: flex; flex-direction: column; align-items: center; }
.ov-health-pct { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 900; color: var(--text-100); }
.ov-health-sub { font-size: 11px; color: var(--text-200); letter-spacing: 1px; text-transform: uppercase; }

/* 双栏网格 */
.st-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
.st-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.st-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

.st-card {
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 20px; transition: all 0.25s;
}
.st-card:hover { border-color: rgba(201,168,76,0.3); }
.st-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 12px; margin-bottom: 14px; border-bottom: 2px solid rgba(201,168,76,0.2);
}
.st-card-title {
  font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700;
  color: var(--text-100); margin: 0; display: flex; align-items: center; gap: 8px;
}
.st-section-title {
  font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 700;
  color: var(--text-100); margin: 0; display: flex; align-items: center; gap: 8px;
}

/* 图表 */
.st-chart-container { margin: 8px 0; }
.st-chart-container canvas { width: 100%; height: auto; }
.st-chart-empty { text-align: center; padding: 20px; color: var(--text-200); font-size: 12px; }

/* 图表悬停提示 */
.chart-tooltip {
  position: absolute; z-index: 100; pointer-events: none;
  background: var(--navy); color: #fff; padding: 8px 12px;
  border-radius: 6px; font-size: 11px; line-height: 1.6;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); white-space: nowrap;
}
.ct-date { font-weight: 700; margin-bottom: 2px; color: var(--gold); }
.ct-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 2px; }

/* 趋势 */
.st-trend-card { margin-bottom: 20px; }
.chart-legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-200); align-items: center; }
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }

/* 排行 */
.st-rank-list { display: flex; flex-direction: column; gap: 8px; }
.rank-item {
  display: flex; align-items: center; gap: 10px; padding: 7px 8px;
  border-radius: 8px; animation: fadeIn 0.3s ease-out both; font-size: 13px;
  transition: background 0.15s;
}
.rank-item:hover { background: var(--bg-100); }
.rank-num { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 900; color: var(--text-200); width: 22px; text-align: center; flex-shrink: 0; }
.rank-top { color: var(--gold) !important; font-size: 18px !important; }
.rank-name { width: 72px; font-weight: 600; color: var(--text-100); flex-shrink: 0; }
.rank-bar-wrap { flex: 1; height: 10px; background: var(--bg-300); border-radius: 5px; overflow: hidden; }
.rank-bar { height: 100%; border-radius: 5px; transition: width 0.6s ease; }
.rank-val { font-size: 11px; color: var(--text-200); width: 36px; text-align: right; flex-shrink: 0; }

/* 用户活跃 */
.st-user-stats { display: flex; flex-direction: column; gap: 8px; }
.user-stat-row {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-radius: 10px; background: var(--bg-100); font-size: 13px;
}
.usr-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.usr-label { flex: 1; font-weight: 500; color: var(--text-100); }
.usr-val { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900; flex-shrink: 0; }

/* 服务器监控 */
.st-monitor-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.st-mon-block { padding: 0; }
.st-mon-block-head {
  display: flex; align-items: center; gap: 10px;
}
.st-mon-block-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.st-mon-block-title { font-size: 14px; font-weight: 700; color: var(--text-100); display: block; }
.st-mon-block-sub { font-size: 11px; color: var(--text-200); display: block; margin-top: 1px; }
.st-mon-block-pct { font-size: 22px; font-weight: 900; font-family: 'Playfair Display', serif; margin-left: auto; }
.st-mon-block-info { font-size: 11px; color: var(--text-200); }
.st-mon-uptime {
  font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900;
  color: var(--text-100); margin-top: 6px;
}

/* AI 调用卡片（横向） */
.st-ai-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 16px 18px; transition: all 0.25s;
}
.st-ai-card:hover { border-color: rgba(201,168,76,0.3); }
.st-ai-icon-wrap {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.st-ai-num {
  font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 900;
  color: var(--text-100); line-height: 1;
}
.st-ai-label { font-size: 12px; color: var(--text-200); }
.st-ai-rate { font-size: 18px; font-weight: 900; font-family: 'Playfair Display', serif; margin-left: auto; }
.st-ai-stat { font-size: 11px; margin-top: 8px; }
.ai-ok { color: #67c23a; font-weight: 600; }
.ai-fail { color: #f56c6c; }

/* 接口监控 */
.st-endpoint-header { display: flex; gap: 24px; padding: 6px 0 14px; border-bottom: 2px solid rgba(201,168,76,0.2); margin-bottom: 8px; font-size: 13px; color: var(--text-200); margin-top: -8px; }
.st-endpoint-header strong { color: var(--text-100); font-size: 20px; font-family: 'Playfair Display', serif; }
.st-endpoint-list { display: flex; flex-direction: column; }
.st-ep-row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 6px; font-size: 12px; transition: background 0.1s; }
.st-ep-row:hover { background: var(--bg-100); }
.st-ep-method { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; min-width: 44px; text-align: center; }
.st-ep-method.get { background: #E8F5E9; color: #2E7D32; }
.st-ep-method.post { background: #E3F2FD; color: #1565C0; }
.st-ep-method.put { background: #FFF3E0; color: #E65100; }
.st-ep-method.delete { background: #FFEBEE; color: #C62828; }
.st-ep-path { flex: 1; color: var(--text-100); font-family: 'Courier New', monospace; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-ep-count { color: var(--text-200); min-width: 40px; text-align: right; font-weight: 600; }
.st-ep-last { color: var(--text-200); font-size: 10px; min-width: 60px; text-align: right; }

/* ===== 用户分析 ===== */
.ua-stat-card { display: flex; align-items: center; gap: 12px; padding: 16px 18px !important; }
.ua-stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ua-stat-body { display: flex; flex-direction: column; gap: 1px; }
.ua-stat-num { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; color: var(--text-100); line-height: 1; }
.ua-stat-label { font-size: 11px; color: var(--text-200); text-transform: uppercase; letter-spacing: 0.5px; }
.ua-stat-sub { font-size: 10px; margin-top: 2px; }
.ua-chart { width: 100%; }
.ua-chart-map { height: 420px; }
.ua-chart-bar { height: 420px; }
.st-grid-ua-map { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px; }
.st-ua-map-card { min-width: 0; padding: 14px 16px !important; }
.ua-table-wrap { max-height: 400px; overflow-y: auto; }
.ua-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ua-table th { padding: 10px 12px; text-align: left; font-weight: 600; color: var(--text-200); border-bottom: 2px solid rgba(201,168,76,0.2); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.ua-table td { padding: 9px 12px; border-bottom: 1px solid var(--bg-300); color: var(--text-100); }
.ua-table tbody tr:hover { background: var(--bg-100); }
.ua-td-ip { font-family: 'Courier New', monospace; font-size: 11px; color: var(--gold-dark); }

@media (max-width: 768px) {
  .st-overview-cards { grid-template-columns: repeat(2, 1fr); }
  .st-grid-2, .st-grid-3, .st-grid-4 { grid-template-columns: 1fr; }
  .st-monitor-grid { grid-template-columns: repeat(2, 1fr); }
  .ov-live-row { grid-template-columns: 1fr; }
  .st-grid-ua-map { grid-template-columns: 1fr; }
  .ua-chart-map, .ua-chart-bar { height: 320px; }
}
</style>
