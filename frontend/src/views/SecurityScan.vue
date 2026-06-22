<template>
  <div class="ss-root">
    <div class="ss-card">
      <h2>🛡️ 安全扫描</h2>
      <p class="ss-desc">基于 Nuclei 引擎，检测常见 Web 漏洞（仅限扫描本服务地址）</p>

      <div class="ss-form">
        <span class="ss-label">目标 URL</span>
        <el-input v-model="targetUrl" placeholder="https://storycine.agety.cn/" size="small" style="width:360px" />
        <span class="ss-label" style="margin-left:16px">严重级别</span>
        <el-select v-model="severity" size="small" style="width:200px">
          <el-option label="中危 + 高危 + 严重" value="medium,high,critical" />
          <el-option label="高危 + 严重" value="high,critical" />
          <el-option label="仅严重" value="critical" />
          <el-option label="全部" value="low,medium,high,critical" />
        </el-select>
        <el-button type="primary" size="small" @click="startScan" :loading="scanning" style="margin-left:12px">
          {{ scanning ? '扫描中...' : '开始扫描' }}
        </el-button>
      </div>
    </div>

    <div v-if="findings.length > 0" class="ss-card" style="margin-top:16px">
      <h3>扫描结果（{{ findings.length }} 条）</h3>
      <div class="ss-summary">
        <span class="ss-badge critical">严重 {{ countBy('critical') }}</span>
        <span class="ss-badge high">高危 {{ countBy('high') }}</span>
        <span class="ss-badge medium">中危 {{ countBy('medium') }}</span>
        <span class="ss-badge low">低危 {{ countBy('low') }}</span>
      </div>
      <el-table :data="findings" size="small" style="margin-top:12px">
        <el-table-column label="级别" width="80">
          <template #default="{ row }">
            <span :class="'ss-sev ' + (row.info?.severity || row.severity || 'info')">{{ sevLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="info.name" min-width="250" show-overflow-tooltip />
        <el-table-column label="位置" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.info?.matched || row.matched || '-' }}</template>
        </el-table-column>
        <el-table-column label="描述" prop="info.description" min-width="300" show-overflow-tooltip />
      </el-table>
    </div>

    <div v-if="logs.length > 0" class="ss-card ss-log" style="margin-top:16px">
      <h3>扫描日志</h3>
      <pre>{{ logs.join('\n') }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const targetUrl = ref('https://storycine.agety.cn/');
const severity = ref('medium,high,critical');
const scanning = ref(false);
const findings = ref([]);
const logs = ref([]);

function sevLabel(row) {
  const s = row.info?.severity || row.severity || 'info';
  const m = { critical: '严重', high: '高危', medium: '中危', low: '低危', info: '信息' };
  return m[s] || s;
}
function countBy(level) {
  return findings.value.filter(f => (f.info?.severity || f.severity) === level).length;
}

async function startScan() {
  scanning.value = true;
  findings.value = [];
  logs.value = [];
  try {
    const token = localStorage.getItem('token');
    const url = `/api/v1/security-scan/run?target=${encodeURIComponent(targetUrl.value)}&severity=${encodeURIComponent(severity.value)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'finding') {
            findings.value.push(data.data);
          } else if (data.type === 'raw') {
            logs.value.push(data.text);
          } else if (data.type === 'error') {
            logs.value.push('[错误] ' + data.message);
          } else if (data.type === 'done') {
            logs.value.push('--- 扫描完成 ---');
          } else if (data.type === 'start') {
            logs.value.push(`开始扫描: ${data.target} (${data.severity})`);
          }
        } catch {}
      }
    }
  } catch (e) {
    logs.value.push('请求失败: ' + e.message);
  } finally {
    scanning.value = false;
  }
}
</script>

<style scoped>
.ss-root { padding: 0; max-width: 960px; }
.ss-card { background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px; padding: 20px 24px; }
.ss-card h2 { font-family: 'Playfair Display', serif; font-size: 20px; color: var(--text-100); margin: 0 0 4px; }
.ss-card h3 { font-size: 15px; color: var(--text-100); margin: 0 0 10px; }
.ss-desc { font-size: 12px; color: var(--text-200); margin: 0 0 16px; }
.ss-form { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ss-label { font-size: 12px; color: var(--text-100); font-weight: 600; white-space: nowrap; }
.ss-summary { display: flex; gap: 8px; margin-bottom: 4px; }
.ss-badge { font-size: 12px; padding: 2px 10px; border-radius: 4px; font-weight: 700; }
.ss-badge.critical { background: #fef0f0; color: #f56c6c; }
.ss-badge.high { background: #fdf6ec; color: #e6a23c; }
.ss-badge.medium { background: #ecf5ff; color: #409eff; }
.ss-badge.low { background: #f0f9eb; color: #67c23a; }
.ss-sev { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
.ss-sev.critical { background: #f56c6c; color: #fff; }
.ss-sev.high { background: #e6a23c; color: #fff; }
.ss-sev.medium { background: #409eff; color: #fff; }
.ss-sev.low { background: #67c23a; color: #fff; }
.ss-sev.info { background: var(--bg-300); color: var(--text-200); }
.ss-log pre { font-size: 11px; font-family: ui-monospace, monospace; color: var(--text-200); max-height: 200px; overflow-y: auto; line-height: 1.5; margin: 0; }
</style>
