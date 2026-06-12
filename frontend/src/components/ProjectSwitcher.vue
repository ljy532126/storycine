<template>
  <div class="ps-root">
    <span class="ps-label">片场</span>
    <el-select
      :model-value="modelValue"
      @update:model-value="onSelect"
      size="small"
      class="ps-select"
      placeholder="选择片场"
    >
      <el-option
        v-for="p in projectStore.projects"
        :key="p._id"
        :label="p.name"
        :value="p._id"
      />
    </el-select>
  </div>
</template>

<script setup>
import { useProjectStore } from '../stores/project';

const props = defineProps({
  modelValue: String,
  autoReset: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue']);

const projectStore = useProjectStore();

function onSelect(id) {
  if (id !== props.modelValue) {
    if (props.autoReset) {
      // 切换片场时回到剧本工坊
      projectStore.currentProject = { _id: id, name: '...' };
      projectStore.lastProjectId = id;
      try { localStorage.setItem('autodrama_last_project', id); } catch {}
    }
  }
  emit('update:modelValue', id);
}
</script>

<style scoped>
.ps-root {
  display: inline-flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
.ps-label {
  font-size: 11px; color: var(--text-200); font-weight: 600;
  text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
}
.ps-select { width: 160px; }
.ps-select :deep(.el-input__wrapper) {
  background: var(--bg-200); border-color: var(--bg-300);
  box-shadow: none !important; border-radius: 6px;
}
</style>
