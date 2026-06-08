<template>
  <div class="map-drilldown-container">
    <div class="map-card">
      <div class="map-card-title">
        {{ drillTitle }}
        <button v-if="drillCode" class="map-btn-back" @click="backUp">返回上级</button>
      </div>
      <div class="map-wrap">
        <div ref="mapDom" class="map-box"></div>
        <canvas ref="glowCanvas" class="glow-canvas"></canvas>
      </div>
      <div v-if="mapLoading" class="map-loading">加载地图中...</div>
    </div>
  </div>
</template>

<script setup>
/**
 * 中国地图三级下钻组件
 * Props: data — { provinces: [{ name: string, value: number }, ...] }
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  data: { type: Object, default: () => ({ provinces: [] }) },
  theme: { type: String, default: 'gold' },
});

// ===== 内置颜色主题 =====
const THEMES = {
  gold:     { colors: ['#bfdbfe', '#6b8fa3', '#8B7355', '#c9a84c', '#e6a23c'], text: '#8B7355', area: '#faf7f0', border: '#d4c5c0', emphasis: '#f5e6c8', tooltipBg: 'rgba(26,26,46,0.95)', tooltipBorder: '#c9a84c', glowLow: [[120,180,255],[80,140,220],[180,220,255]], glowMid: [[245,210,150],[212,168,83],[255,240,200]], glowHigh: [[255,200,100],[240,160,40],[255,245,200]] },
  emerald:  { colors: ['#e8f5e9', '#81c784', '#43a047', '#2e7d32', '#1b5e20'], text: '#2e7d32', area: '#f5faf5', border: '#c8e6c9', emphasis: '#a5d6a7', tooltipBg: 'rgba(20,40,20,0.95)', tooltipBorder: '#4caf50', glowLow: [[129,199,132],[76,175,80],[200,230,201]], glowMid: [[56,142,60],[46,125,50],[165,214,167]], glowHigh: [[27,94,32],[27,94,32],[129,199,132]] },
  purple:   { colors: ['#f3e5f5', '#ce93d8', '#ab47bc', '#7b1fa2', '#4a148c'], text: '#7b1fa2', area: '#faf5fb', border: '#e1bee7', emphasis: '#ce93d8', tooltipBg: 'rgba(30,10,40,0.95)', tooltipBorder: '#ab47bc', glowLow: [[206,147,216],[171,71,188],[225,190,231]], glowMid: [[142,36,170],[123,31,162],[186,104,200]], glowHigh: [[74,20,140],[74,20,140],[156,39,176]] },
  sunset:   { colors: ['#fff3e0', '#ffcc80', '#ff9800', '#f4511e', '#b71c1c'], text: '#d84315', area: '#fffaf5', border: '#ffe0b2', emphasis: '#ffcc80', tooltipBg: 'rgba(40,15,5,0.95)', tooltipBorder: '#ff9800', glowLow: [[255,204,128],[255,167,38],[255,224,178]], glowMid: [[244,81,30],[230,74,25],[255,138,101]], glowHigh: [[183,28,28],[183,28,28],[239,83,80]] },
  ocean:    { colors: ['#e3f2fd', '#64b5f6', '#1e88e5', '#0d47a1', '#01579b'], text: '#1565c0', area: '#f5f9fd', border: '#bbdefb', emphasis: '#90caf9', tooltipBg: 'rgba(5,15,35,0.95)', tooltipBorder: '#42a5f5', glowLow: [[100,181,246],[30,136,229],[187,222,251]], glowMid: [[33,150,243],[21,101,192],[144,202,249]], glowHigh: [[1,87,155],[1,87,155],[66,165,245]] },
  warm:     { colors: ['#fbf7f0', '#e8d5c4', '#c9a84c', '#8b6914', '#5c3d0e'], text: '#6d4c0a', area: '#fdfaf5', border: '#e0d0b8', emphasis: '#d4b896', tooltipBg: 'rgba(35,25,10,0.95)', tooltipBorder: '#b8943c', glowLow: [[232,213,196],[201,168,76],[245,235,210]], glowMid: [[180,140,50],[139,105,20],[220,200,160]], glowHigh: [[92,61,14],[92,61,14],[180,140,50]] },
  cyber:    { colors: ['#1a1a2e', '#2d5a3d', '#4caf50', '#e040fb', '#7c4dff'], text: '#b0bec5', area: '#0d1117', border: '#21262d', emphasis: '#4caf50', tooltipBg: 'rgba(8,10,15,0.95)', tooltipBorder: '#7c4dff', glowLow: [[45,90,61],[76,175,80],[129,199,132]], glowMid: [[100,180,60],[200,80,250],[170,130,255]], glowHigh: [[224,64,251],[124,77,255],[200,150,255]] },
};

const activeTheme = computed(() => THEMES[props.theme] || THEMES.gold);

const mapDom = ref(null);
const glowCanvas = ref(null);
const mapLoading = ref(false);
const drillCode = ref('');
const drillTitle = ref('全国城市 IP 热力分布');

let mapInst = null;
let nationalGeo = null;
const geoCache = {};
let glowAF = null;
let glowData = [];
let currentMapName = 'china_city';

const PM = {
  '11000000': '北京市', '12000000': '天津市', '13000000': '河北省',
  '14000000': '山西省', '15000000': '内蒙古', '21000000': '辽宁省',
  '22000000': '吉林省', '23000000': '黑龙江省', '31000000': '上海市',
  '32000000': '江苏省', '33000000': '浙江省', '34000000': '安徽省',
  '35000000': '福建省', '36000000': '江西省', '37000000': '山东省',
  '41000000': '河南省', '42000000': '湖北省', '43000000': '湖南省',
  '44000000': '广东省', '45000000': '广西', '46000000': '海南省',
  '50000000': '重庆市', '51000000': '四川省', '52000000': '贵州省',
  '53000000': '云南省', '54000000': '西藏', '61000000': '陕西省',
  '62000000': '甘肃省', '63000000': '青海省', '64000000': '宁夏',
  '65000000': '新疆', '71000000': '台湾', '81000000': '香港',
  '82000000': '澳门',
};

async function loadNational() {
  try {
    const r = await fetch('/china_cities.json');
    nationalGeo = await r.json();
    echarts.registerMap('china_city', nationalGeo);
  } catch (e) { console.error('china_cities.json 加载失败:', e); }
}

async function drillTo(code) {
  const len = code.length;
  const pp = code.substring(0, 2);
  let url, mapKey;
  if (len === 2) { url = `/api/geojson?code=${code}0000`; mapKey = 'prov_' + code; }
  else if (len >= 4) { url = `/api/geojson?code=${code}`; mapKey = 'city_' + code; }
  else return;

  mapLoading.value = true;
  try {
    if (!geoCache[mapKey]) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      geoCache[mapKey] = await r.json();
    }
    echarts.registerMap(mapKey, geoCache[mapKey]);
    drillCode.value = code;
    if (len === 2) { drillTitle.value = PM[code + '000000'] || ''; }
    else {
      const pn = PM[pp + '000000'] || '';
      const c = nationalGeo?.features.find(f => String(f.id) === String(code));
      drillTitle.value = (pn ? pn + ' — ' : '') + (c?.properties.name || '');
    }
    await nextTick(); drawMap(mapKey);
  } catch (e) { console.error('下钻失败:', e); }
  finally { mapLoading.value = false; }
}

function backUp() {
  const c = drillCode.value;
  if (!c) return;
  if (c.length <= 2) { drillCode.value = ''; drillTitle.value = '全国城市 IP 热力分布'; drawMap('china_city'); }
  else drillTo(c.substring(0, 2));
}

function drawMap(mapName) {
  const el = mapDom.value;
  if (!el) return;
  if (mapInst) mapInst.dispose();

  const isNation = !drillCode.value;
  const isCity = drillCode.value && drillCode.value.length >= 4;
  const rawData = isCity ? (props.data.districts || props.data.provinces || []) : (props.data.provinces || []);
  if (!rawData.length) return;

  const geo = isNation ? nationalGeo : geoCache[mapName];
  const gSet = geo ? new Set(geo.features.map(f => f.properties.name)) : new Set();
  const matchName = n => gSet.has(n) ? n : gSet.has(n + '市') ? n + '市' : gSet.has(n + '区') ? n + '区' : gSet.has(n + '县') ? n + '县' : n;

  const mapData = rawData.map(p => ({ name: matchName(p.name), value: p.value }));
  const maxVal = Math.max(...rawData.map(p => p.value), 1);

  mapInst = echarts.init(el);
  const t = activeTheme.value;
  mapInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item', backgroundColor: t.tooltipBg, borderColor: t.tooltipBorder,
      textStyle: { color: t.emphasis, fontSize: 14 },
      formatter: p => !p.value ? p.name : `<strong style="color:${t.emphasis};font-size:16px">${p.name}</strong><br/>访问：<span style="color:${t.tooltipBorder};font-size:18px;font-weight:700">${p.value}</span> 次`,
    },
    visualMap: {
      min: 0, max: maxVal, left: 10, bottom: 20,
      text: ['高', '低'], calculable: true,
      textStyle: { color: t.text, fontSize: 13 },
      inRange: { color: t.colors },
    },
    geo: {
      map: mapName, zoom: isNation ? 1.15 : 2.5, roam: true,
      center: isNation ? [104.5, 36] : undefined,
      label: { show: false },
      emphasis: {
        label: { color: '#1A1A2E', fontSize: 12, fontWeight: 'bold', show: true },
        itemStyle: { areaColor: t.emphasis },
      },
      itemStyle: { areaColor: t.area, borderColor: t.border, borderWidth: isNation ? 0.5 : 0.8 },
    },
    series: [{ name: '访问次数', type: 'map', map: mapName, geoIndex: 0, data: mapData }],
  });

  currentMapName = mapName;
  setTimeout(glowRefresh, 500);

  const cGeo = isNation ? nationalGeo : geoCache[mapName];
  const level = isNation ? 'nation' : (drillCode.value.length <= 2 ? 'province' : 'city');
  mapInst.off('click');
  mapInst.on('click', p => {
    if (!p.name || !cGeo) return;
    const f = cGeo.features.find(fe => fe.properties.name === p.name);
    if (!f) return;
    if (level === 'nation') { if (f.id) drillTo(String(f.id).substring(0, 2)); }
    else if (level === 'province') {
      const cn = p.name.replace(/市$/, '');
      const cf = nationalGeo?.features.find(fe => fe.properties.name === p.name || fe.properties.name === cn);
      if (cf?.id) drillTo(String(cf.id));
    }
  });
}

// ===== 粒子发光 =====
function glowRefresh() {
  if (!mapInst || !glowCanvas.value) return;
  const curMap = currentMapName;
  const isN = !drillCode.value;
  const geo = isN ? nationalGeo : geoCache[curMap];
  if (!geo) return;

  const raw = props.data.provinces || [];
  const pts = [];
  geo.features.forEach(f => {
    const cp = f.properties?.cp || f.properties?.center;
    if (!cp || cp.length < 2) return;
    const match = raw.find(p => {
      const nm = f.properties.name;
      return p.name === nm || p.name === nm.replace(/市|区|县$/, '') || nm === p.name + '市' || nm === p.name + '区' || nm === p.name + '县';
    });
    if (match) pts.push({ lon: cp[0], lat: cp[1], v: match.value });
  });
  glowData = pts;
  if (!glowAF) glowLoop();
}

let glowT = 0;
function glowLoop() {
  const cv = glowCanvas.value;
  if (!cv || !mapInst) return;
  const mapEl = mapDom.value;
  if (!mapEl) return;
  const rect = mapEl.getBoundingClientRect();
  cv.width = rect.width * window.devicePixelRatio;
  cv.height = rect.height * window.devicePixelRatio;
  cv.style.width = rect.width + 'px';
  cv.style.height = rect.height + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const maxV = Math.max(...glowData.map(d => d.v), 1);
  glowT += 0.03;
  glowData.forEach(d => {
    try {
      const px = mapInst.convertToPixel({ geoIndex: 0 }, [d.lon, d.lat]);
      if (!px || isNaN(px[0])) return;
      const x = px[0], y = px[1];
      const ratio = d.v / maxV;
      const r = 4 + ratio * 20;
      const breathe = 0.4 + 0.6 * Math.sin(glowT * 2.5 + d.lat * 0.3 + d.lon * 0.2);
      const a = (0.12 + ratio * 0.4) * breathe;

      const t = activeTheme.value;
      let ic, mc, cc;
      if (ratio < 0.3) { [ic, mc, cc] = t.glowLow; }
      else if (ratio < 0.7) { [ic, mc, cc] = t.glowMid; }
      else { [ic, mc, cc] = t.glowHigh; }

      const grd = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      grd.addColorStop(0, `rgba(${ic[0]},${ic[1]},${ic[2]},${a})`);
      grd.addColorStop(0.5, `rgba(${mc[0]},${mc[1]},${mc[2]},${a * 0.7})`);
      grd.addColorStop(0.85, `rgba(${mc[0]},${mc[1]},${mc[2]},0.03)`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      const cr = r * 0.12;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, cr);
      cg.addColorStop(0, `rgba(${cc[0]},${cc[1]},${cc[2]},${a * 1.2})`);
      cg.addColorStop(0.6, `rgba(${cc[0]},${cc[1]},${cc[2]},${a * 0.5})`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2);
      ctx.fillStyle = cg; ctx.fill();
    } catch {}
  });
  glowAF = requestAnimationFrame(glowLoop);
}

function stopGlow() { if (glowAF) { cancelAnimationFrame(glowAF); glowAF = null; } }

function onResize() { if (mapInst) mapInst.resize(); glowRefresh(); }

watch(() => props.data, () => {
  if (nationalGeo) { drillCode.value = ''; drillTitle.value = '全国城市 IP 热力分布'; nextTick(() => drawMap('china_city')); setTimeout(glowRefresh, 600); }
}, { deep: true });

watch(() => props.theme, () => {
  if (nationalGeo) { nextTick(() => drawMap(currentMapName)); setTimeout(glowRefresh, 600); }
});

onMounted(async () => {
  await loadNational(); await nextTick();
  currentMapName = 'china_city'; drawMap('china_city');
  setTimeout(glowRefresh, 600);
  window.addEventListener('resize', onResize);
});

onUnmounted(() => { window.removeEventListener('resize', onResize); if (mapInst) mapInst.dispose(); stopGlow(); });
</script>

<style scoped>
.map-drilldown-container { width: 100%; }
.map-card { background: var(--bg-200, #FFFDF9); border: 1px solid var(--bg-300, #E8D5C4); border-radius: 12px; padding: 20px; margin-bottom: 14px; }
.map-card-title { font-size: 16px; font-weight: 700; color: var(--text-100, #2C1810); margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid rgba(201,168,76,0.2); display: flex; align-items: center; gap: 8px; font-family: 'Playfair Display', serif; }
.map-btn-back { padding: 5px 12px; font-size: 12px; background: var(--bg-100, #FBF7F0); border: 1px solid var(--bg-300, #E8D5C4); color: var(--text-200, #8B7355); border-radius: 6px; cursor: pointer; margin-left: 12px; font-family: inherit; transition: all 0.15s; }
.map-btn-back:hover { border-color: var(--gold, #c9a84c); color: var(--gold-dark, #8B6914); background: rgba(201,168,76,0.06); }
.map-wrap { position: relative; }
.map-box { width: 100%; height: 420px; }
.glow-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
.map-loading { text-align: center; padding: 40px; color: var(--text-200, #8B7355); font-size: 13px; }

@media (max-width: 768px) {
  .map-card { padding: 14px; }
  .map-box { height: 320px; }
}
</style>
