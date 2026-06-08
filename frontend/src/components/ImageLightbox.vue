<template>
  <Teleport to="body">
    <div v-if="visible" class="il-overlay" @click.self="close" @keydown.escape="close">
      <!-- 顶部栏 -->
      <div class="il-topbar">
        <div class="il-top-left">
          <span class="il-title">{{ title }}</span>
          <div class="il-tags" v-if="tags.length">
            <span v-for="(t, i) in tags" :key="i" class="il-tag" :class="'il-tag-' + (t.type || 'default')">{{ t.label }}</span>
          </div>
        </div>
        <div class="il-top-right">
          <slot name="actions">
            <button class="il-btn" @click="download" title="下载">
              <DownloadTwo theme="outline" size="22" fill="#fff" />
            </button>
          </slot>
          <button class="il-btn" @click="close" title="关闭">
            <CloseOne theme="outline" size="24" fill="#fff" />
          </button>
        </div>
      </div>

      <!-- 主舞台 -->
      <div
        class="il-stage"
        @wheel.prevent="onWheel"
        @mousedown="onDragStart"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
        @mouseleave="onDragEnd"
        @dblclick="resetZoom"
      >
        <div class="il-frame" :class="{ portrait: isPortrait }" :style="frameStyle">
          <video v-if="isVideo" :src="url" controls autoplay class="il-media" />
          <img v-else :src="url" class="il-media" @load="onLoad" />
        </div>
      </div>

      <!-- 底部信息条 -->
      <div class="il-bottombar" v-if="url">
        <span class="il-url" :title="url">{{ url }}</span>
        <span class="il-ratio" v-if="ratio">{{ ratio }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { DownloadTwo, CloseOne } from '@icon-park/vue-next';

const props = defineProps({
  visible: { type: Boolean, default: false },
  url: { type: String, default: '' },
  title: { type: String, default: '' },
  isVideo: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },
  downloadable: { type: Boolean, default: true },
});

const emit = defineEmits(['update:visible', 'download']);

const isPortrait = ref(false);
const ratio = ref('');

const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);
const dragging = ref(false);
let dsx = 0, dsy = 0, psx = 0, psy = 0;

const frameStyle = computed(() => ({
  transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value}px)`,
  cursor: zoom.value > 1 ? (dragging.value ? 'grabbing' : 'grab') : 'default',
  transition: dragging.value ? 'none' : 'transform 0.2s ease-out',
}));

function close() { emit('update:visible', false); }
function download() { emit('download'); if (props.downloadable) { const a = document.createElement('a'); a.href = props.url; a.download = (props.title || 'file') + (props.isVideo ? '.mp4' : '.png'); a.target = '_blank'; a.click(); } }

function onLoad(e) {
  const w = e.target.naturalWidth || e.target.videoWidth || 0;
  const h = e.target.naturalHeight || e.target.videoHeight || 0;
  if (w && h) {
    isPortrait.value = h > w;
    const r = w / h;
    if (r > 1.7) ratio.value = '超宽 ' + w + '×' + h;
    else if (r > 1.3) ratio.value = '16:9';
    else if (r > 0.7) ratio.value = '1:1';
    else ratio.value = '9:16 竖屏';
  }
}

function onWheel(e) {
  const delta = e.deltaY > 0 ? -0.15 : 0.15;
  const newZoom = Math.min(5, Math.max(0.3, zoom.value + delta));
  zoom.value = newZoom;
  if (newZoom <= 1) { panX.value = 0; panY.value = 0; }
}
function onDragStart(e) { if (zoom.value <= 1 || e.button !== 0) return; dragging.value = true; dsx = e.clientX; dsy = e.clientY; psx = panX.value; psy = panY.value; }
function onDragMove(e) { if (!dragging.value) return; panX.value = psx + (e.clientX - dsx); panY.value = psy + (e.clientY - dsy); }
function onDragEnd() { dragging.value = false; }
function resetZoom() { zoom.value = 1; panX.value = 0; panY.value = 0; }

watch(() => props.visible, (v) => { if (!v) { zoom.value = 1; panX.value = 0; panY.value = 0; } });
</script>

<style scoped>
.il-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(8,10,16,0.96); backdrop-filter: blur(20px);
  display: flex; flex-direction: column;
  animation: il-in 0.2s ease-out;
}
@keyframes il-in { from { opacity: 0; } to { opacity: 1; } }

.il-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.il-top-left { display: flex; align-items: center; gap: 14px; }
.il-title { font-size: 15px; font-weight: 700; color: #e0d6c2; }
.il-tags { display: flex; gap: 6px; }
.il-tag { font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px; }
.il-tag-default { background: rgba(255,255,255,0.08); color: #aaa; }
.il-tag-success { background: rgba(103,194,58,0.15); color: #67c23a; }
.il-tag-danger { background: rgba(245,108,108,0.15); color: #f56c6c; }
.il-tag-warning { background: rgba(230,162,60,0.15); color: #e6a23c; }
.il-tag-info { background: rgba(64,158,255,0.15); color: #409eff; }
.il-top-right { display: flex; gap: 4px; }
.il-btn {
  width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  border: none; background: none; cursor: pointer; padding: 0; opacity: 0.7; transition: opacity 0.15s;
}
.il-btn:hover { opacity: 1; }

.il-stage { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; min-height: 0; overflow: hidden; }
.il-frame {
  display: flex; align-items: center; justify-content: center;
  max-width: 90vw; max-height: calc(100vh - 150px);
  border-radius: 8px; overflow: hidden;
  box-shadow: 0 0 80px rgba(0,0,0,0.5); background: #0a0a0a;
  transform-origin: center center;
}
.il-frame.portrait { max-width: min(50vw, 500px); }
.il-media { display: block; max-width: 100%; max-height: calc(100vh - 150px); object-fit: contain; border-radius: 6px; }

.il-bottombar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 11px; color: rgba(255,255,255,0.3);
}
.il-url { max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
.il-ratio { color: rgba(255,255,255,0.2); font-weight: 600; }

@media (max-width: 700px) {
  .il-title { font-size: 13px; }
  .il-tags { display: none; }
  .il-topbar { padding: 10px 14px; }
  .il-stage { padding: 10px; }
}
</style>
