/**
 * GeoJSON 代理中间件（Express）
 *
 * 阿里 DataV GeoJSON 接口在国内部分网络环境会被墙或返回 403，
 * 后端代理中转可解决此问题。
 *
 * 挂载方式：
 *   const geojsonProxy = require('./geojson-proxy');
 *   app.get('/api/geojson', geojsonProxy);
 *
 * code 规则（该端点接收的 query 参数含义见主文档）：
 *   /api/geojson?code=440000   → 广东省各城市边界
 *   /api/geojson?code=440100   → 广州市各区县边界
 */

const axios = require('axios');

module.exports = async function geojsonProxy(req, res) {
  const code = req.query.code;
  if (!code || !/^\d{1,12}$/.test(code)) {
    return res.status(400).json({ error: '缺少 code 参数或格式不正确' });
  }
  try {
    const url = `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    res.json(resp.data);
  } catch (e) {
    res.status(502).json({ error: '获取地图数据失败' });
  }
};
