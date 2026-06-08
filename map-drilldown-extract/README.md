# 中国地图三级下钻 — 可复用代码包

## 功能

全国 → 省份 → 城市 三级地图下钻，基于 ECharts + GeoJSON，带粒子发光效果。

## 文件说明

```
map-drilldown-extract/
├── README.md                  ← 本文件（给 AI 看的集成指南）
├── MapDrilldown.vue           ← 核心 Vue 3 组件（可直接复用）
├── geojson-proxy.js           ← 后端 GeoJSON 代理中间件（Express）
├── map-drilldown.css          ← 地图相关样式
└── public/
    └── china_cities.json      ← 全国城市级 GeoJSON（1.2MB，必须放前端 public 目录）
```

## 前端依赖

```json
{
  "echarts": "^5.0.0 或 ^6.0.0",
  "vue": "^3.0.0"
}
```

## 后端依赖（如果用 geojson-proxy.js）

```json
{
  "axios": "^1.0.0",
  "express": "^4.0.0"
}
```

## 集成步骤

### 1. 复制文件

- `public/china_cities.json` → 你项目的 `public/` 或 `static/` 目录
- `MapDrilldown.vue` → 你项目的 `src/components/` 目录
- `map-drilldown.css` → 你项目的 `src/assets/` 目录
- `geojson-proxy.js` → 你项目的 `server/routes/` 或 `server/middleware/` 目录

### 2. 后端：挂载 GeoJSON 代理

你的后端必须提供一个 `/api/geojson?code=XXX` 端点，用于获取省份/城市的 GeoJSON 数据。
数据源是阿里 DataV：`https://geo.datav.aliyun.com/areas_v3/bound/{code}_full.json`

**如果后端是 Express**，直接把 `geojson-proxy.js` 挂进去：

```js
// server/index.js 或 app.js
const geojsonProxy = require('./routes/geojson-proxy');
app.use('/api/geojson', geojsonProxy);
```

**如果后端是其他框架**（Spring Boot / Go / Python 等），请实现一个等价的代理端点：
- GET `/api/geojson?code=XXX`
- 请求 `https://geo.datav.aliyun.com/areas_v3/bound/{code}_full.json`
- 设置 User-Agent 为 `Mozilla/5.0`
- 返回 JSON

**为什么需要代理**：DataV 在国内部分网络环境会被墙或返回 403，后端中转可解决。

### 3. 前端：使用组件

```vue
<template>
  <MapDrilldown :data="regionData" />
</template>

<script setup>
import MapDrilldown from '@/components/MapDrilldown.vue';

// regionData 格式（与组件内部 API 调用的返回值一致）：
const regionData = {
  provinces: [
    { name: '广东省', value: 1523 },
    { name: '北京市', value: 1200 },
    // ...
  ]
};
</script>
```

### 4. 数据接口格式

组件需要的数据由外部传入（props），你需要在父组件中调 API 获取并传入。

**组件 Props：**

| Prop | 类型 | 说明 |
|------|------|------|
| `data` | `Object` | `{ provinces: [{name, value}, ...] }` |

**你后端需要提供的 API（与组件无关，是你的业务接口）：**

返回格式示例：
```json
{
  "provinces": [
    { "name": "广东省", "value": 1523 },
    { "name": "北京市", "value": 1200 }
  ]
}
```

### 5. 下钻流程说明

1. **全国层**：使用 `china_cities.json`（ECharts 注册名为 `china_city`），点击省份 → 下钻到省
2. **省份层**：请求 `/api/geojson?code=440000`（广东省），GeoJSON 包含各城市边界，点击城市 → 下钻到市
3. **城市层**：请求 `/api/geojson?code=440100`（广州市），GeoJSON 包含各区县边界

code 规则：
- 省份：取 `china_cities.json` 中 feature 的 `id` 前 2 位 + `0000`（如 `440000` = 广东）
- 城市：feature 的完整 `id`（如 `440100` = 广州）

### 6. 注意事项

- `china_cities.json` 约 1.2MB，建议开启 gzip 压缩
- 地图粒子发光效果依赖 CSS `position: relative` 的父容器
- 组件自带了 "返回上级" 按钮和加载状态
- 组件是 Vue 3 Composition API（`<script setup>`），不兼容 Vue 2
