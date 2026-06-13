<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" title="导入分镜数据" width="600px" class="export-dialog">
    <div class="export-body">
      <div class="export-section">
        <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 数据格式</div>
        <el-radio-group v-model="importFormat">
          <el-radio value="csv">CSV（逗号分隔）</el-radio>
          <el-radio value="json">JSON（结构化数据）</el-radio>
        </el-radio-group>
        <div style="margin-top:10px">
          <el-upload :auto-upload="false" :show-file-list="false" accept=".csv,.json,.txt" @change="onImportFileChange">
            <el-button size="small">📁 选择文件上传</el-button>
          </el-upload>
        </div>
      </div>
      <div class="export-section">
        <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 粘贴数据</div>
        <el-input v-model="importText" type="textarea" :rows="14" placeholder="粘贴 CSV 或 JSON 数据到此处..." />
      </div>
    </div>
    <el-alert type="info" :closable="false" show-icon style="margin-top:12px">
      <template #title>
        CSV表头：镜头号,场景名称,景别,构图,运镜,灯光,时长,图像描述,角色名,台词,音效,备注,状态
        <br>JSON：数组格式 [{ shotNumber, shotType, imageDescription, ... }]
      </template>
    </el-alert>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!importText.trim()">
        <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 导入数据
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { FolderOpen, Edit, Download } from '@icon-park/vue-next';
import { storyboardAPI } from '../../api';

const props = defineProps({
  modelValue: Boolean,
  storyboardId: String,
  shots: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'imported']);

const importText = ref('');
const importFormat = ref('csv');
const importing = ref(false);

function onImportFileChange(uploadFile) {
  const file = uploadFile && uploadFile.raw;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { importText.value = e.target.result; };
  reader.readAsText(file);
}

async function handleImport() {
  if (!importText.value.trim()) return;
  importing.value = true;
  try {
    const data = importFormat.value === 'json' ? JSON.parse(importText.value) : importText.value;
    await storyboardAPI.importData(props.storyboardId, data, importFormat.value);
    ElMessage.success('导入成功');
    importText.value = '';
    emit('update:modelValue', false);
    emit('imported');
  } catch (e) { ElMessage.error('导入失败: ' + (e.message || '')); }
  finally { importing.value = false; }
}
</script>
