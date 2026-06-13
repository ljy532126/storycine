<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :width="screenWidth < 768 ? '94%' : '520px'" destroy-on-close class="export-dialog">
    <template #header>
      <div style="display:flex;align-items:center;gap:8px">
        <Download size="20" fill="var(--gold)"/>
        <span style="font-size:17px;font-weight:700;color:var(--text-100)">导出分镜</span>
      </div>
    </template>
    <div class="export-body">
      <div class="export-section">
        <div class="export-section-title"><Film size="14" fill="var(--navy)"/> 选择剧集</div>
        <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="全部剧集（不选=导出全部）">
          <el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" />
        </el-select>
        <div style="display:flex;gap:8px;margin-top:6px">
          <el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">全选</el-button>
          <el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">当前集</el-button>
          <el-button size="small" link @click="exportEpisodes = []">清空</el-button>
        </div>
      </div>
      <div class="export-section">
        <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 导出内容</div>
        <el-checkbox-group v-model="exportTypes">
          <el-checkbox value="script">剧本全文</el-checkbox>
          <el-checkbox value="shots">分镜全文</el-checkbox>
          <el-checkbox value="full_storyboard">故事板全文</el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="export-section">
        <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 导出格式</div>
        <div class="export-format-cards">
          <div v-for="f in formatOptions" :key="f.value" :class="['ef-card',{active:exportFormat===f.value}]" @click="exportFormat=f.value">
            <div class="ef-card-icon" v-html="f.icon"></div>
            <div class="ef-card-label">{{ f.label }}</div>
            <div class="ef-card-hint">{{ f.hint }}</div>
          </div>
        </div>
      </div>
    </div>
    <el-alert type="info" :closable="false" show-icon style="margin-top:12px"><template #title>{{ formatHint }}</template></el-alert>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0">
        <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 导出文件
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Film, FolderOpen, Edit, Download } from '@icon-park/vue-next';

const props = defineProps({
  modelValue: Boolean,
  projectId: String,
  scripts: { type: Array, default: () => [] },
  currentScriptId: String,
  screenWidth: { type: Number, default: 1024 },
});

const emit = defineEmits(['update:modelValue']);

const exportEpisodes = ref([]);
const exportTypes = ref(['script', 'shots', 'full_storyboard']);
const exportFormat = ref('pdf');

const formatOptions = [
  { value:'pdf', label:'PDF', hint:'打印预览保存', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e74c3c"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zM16.5 13H15v-2h-1.5V7H15v2h1.5v1.5H15V13zM19 13h-1.5V7H19v6zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>' },
  { value:'markdown', label:'Markdown', hint:'Typora/VS Code', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#3498db"><path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19v-4.69l1.88 2.35 1.88-2.35v4.69h1.13V8.81h-1.13l-1.88 2.35-1.88-2.35H5.69v6.38h1.12zM15.73 15.19l2.62-3.19-2.62-3.19h1.51l1.87 2.31 1.87-2.31h1.51l-2.62 3.19 2.62 3.19h-1.51l-1.87-2.31-1.87 2.31h-1.51z"/></svg>' },
  { value:'csv', label:'CSV Excel', hint:'Excel/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#27ae60"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v-2H8v2zm0-4h2V8H8v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2z"/></svg>' },
  { value:'word', label:'Word', hint:'Word/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#2980b9"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2.5-4.5L10 13l1.5 2.5H13l-2-3 2-3h-1.5L10 11.5 8.5 9.5H7l2 3-2 3h1.5z"/></svg>' },
  { value:'json', label:'JSON', hint:'结构化数据', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#8e44ad"><path d="M5 3h2v2H5v5c0 1.1-.9 2-2 2v1c1.1 0 2 .9 2 2v5h2v2H5c-1.07 0-2-.94-2-2.03V17c0-1.1-.9-2-2-2v-1c1.1 0 2-.9 2-2V7c0-1.08.93-2 2-2zm14 0c1.07 0 2 .94 2 2.03V7c0 1.1.9 2 2 2v1c-1.1 0-2 .9-2 2v5.03c0 1.09-.93 2-2 2h-2v-2h2v-5c0-1.1.9-2 2-2V7c0-1.1-.9-2-2-2h-2V3h2z"/></svg>' },
  { value:'html', label:'HTML', hint:'浏览器打开', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e67e22"><path d="M12 18.177l-6.72-3.878-.9-8.12L12 2l7.62 4.179-.9 8.12L12 18.177zM4.86 6.556l.72 6.482L12 16.545l6.42-3.507.72-6.482L12 3.455 4.86 6.556zM11 13h2l-.3 3.5-1 .5-1-.5L11 13zm0-6h2l-.2 5H11.2L11 7z"/></svg>' },
  { value:'png', label:'PNG 图片', hint:'截图导出', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#16a085"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' },
];

const formatHint = computed(() => {
  const m = { pdf: 'PDF：打开打印预览，浏览器「另存为 PDF」保存', markdown: 'Markdown：下载 .md 文件，可用 Typora/VS Code 打开', csv: 'Excel/CSV：下载 .csv 文件，用 Excel/WPS 打开编辑', word: 'Word：下载 .doc 文件，用 Word/WPS 打开编辑', json: 'JSON：下载 .json 文件，结构化数据，可程序化处理', html: 'HTML：下载 .html 文件，浏览器直接打开查看', png: 'PNG：将导出内容渲染为高清截图下载，多集全选时可能需几秒' };
  return m[exportFormat.value] || '';
});

function formatEpLabel(ep) {
  const title = (ep.episodeTitle || '').replace(/^第\d+集[：:]*\s*/, '').trim();
  return title ? `第${ep.episodeNumber}集：${title}` : `第${ep.episodeNumber}集`;
}

async function handleExport() {
  if (exportTypes.value.length === 0) return;
  const fmt = exportFormat.value;
  emit('update:modelValue', false);
  try {
    const res = await fetch('/api/v1/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({
        projectId: props.projectId,
        episodeIds: exportEpisodes.value,
        types: exportTypes.value,
        format: fmt === 'png' ? 'html' : fmt,
      }),
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '导出失败'); return; }

    if (fmt === 'pdf') {
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(data.html); w.document.close(); setTimeout(() => w.print(), 500); }
    } else if (fmt === 'html') {
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename + '.html';
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('下载完成');
    } else if (fmt === 'png') {
      await exportAsPng(data.html, data.filename);
    } else {
      const ext = { markdown: 'md', csv: 'csv', word: 'doc', json: 'json' }[fmt] || 'txt';
      const mime = { markdown: 'text/markdown', csv: 'text/csv', word: 'application/msword', json: 'application/json' }[fmt] || 'text/plain';
      const blob = new Blob([data.content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename + '.' + ext;
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('下载完成');
    }
  } catch (e) { ElMessage.error('导出失败'); }
}

async function exportAsPng(html, filename) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:820px;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  await new Promise(r => setTimeout(r, 600));
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(doc.body, {
      scale: 2, useCORS: true, backgroundColor: '#FBF7F0',
      windowWidth: 820, windowHeight: doc.body.scrollHeight,
    });
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename + '.png';
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('PNG 导出完成');
    }, 'image/png');
  } catch (e) { ElMessage.error('PNG 截图失败'); }
  finally { document.body.removeChild(iframe); }
}

function initEpisodes() {
  exportEpisodes.value = props.currentScriptId ? [props.currentScriptId] : props.scripts.map(e => e._id);
}
defineExpose({ initEpisodes });
</script>
