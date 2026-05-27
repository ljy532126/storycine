const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Settings = require('../models/settings.model');

// ===== 地域 → Endpoint 映射表 =====

/**
 * 腾讯云 COS 地域映射
 * 格式: { label: '显示名', endpoint: '完整域名', region: 'SDK region 简称' }
 * region 用于 COS SDK 初始化，endpoint 用于 URL 拼接和用户展示
 */
const COS_REGIONS = [
  { label: '北京',       endpoint: 'cos.ap-beijing.myqcloud.com',       region: 'ap-beijing' },
  { label: '上海',       endpoint: 'cos.ap-shanghai.myqcloud.com',      region: 'ap-shanghai' },
  { label: '广州',       endpoint: 'cos.ap-guangzhou.myqcloud.com',     region: 'ap-guangzhou' },
  { label: '南京',       endpoint: 'cos.ap-nanjing.myqcloud.com',       region: 'ap-nanjing' },
  { label: '成都',       endpoint: 'cos.ap-chengdu.myqcloud.com',       region: 'ap-chengdu' },
  { label: '重庆',       endpoint: 'cos.ap-chongqing.myqcloud.com',     region: 'ap-chongqing' },
  { label: '香港',       endpoint: 'cos.ap-hongkong.myqcloud.com',      region: 'ap-hongkong' },
  { label: '新加坡',     endpoint: 'cos.ap-singapore.myqcloud.com',     region: 'ap-singapore' },
  { label: '东京',       endpoint: 'cos.ap-tokyo.myqcloud.com',         region: 'ap-tokyo' },
  { label: '首尔',       endpoint: 'cos.ap-seoul.myqcloud.com',         region: 'ap-seoul' },
  { label: '曼谷',       endpoint: 'cos.ap-bangkok.myqcloud.com',       region: 'ap-bangkok' },
  { label: '孟买',       endpoint: 'cos.ap-mumbai.myqcloud.com',        region: 'ap-mumbai' },
  { label: '硅谷',       endpoint: 'cos.na-siliconvalley.myqcloud.com', region: 'na-siliconvalley' },
  { label: '弗吉尼亚',   endpoint: 'cos.na-ashburn.myqcloud.com',       region: 'na-ashburn' },
  { label: '多伦多',     endpoint: 'cos.na-toronto.myqcloud.com',       region: 'na-toronto' },
  { label: '法兰克福',   endpoint: 'cos.eu-frankfurt.myqcloud.com',     region: 'eu-frankfurt' },
  { label: '莫斯科',     endpoint: 'cos.eu-moscow.myqcloud.com',        region: 'eu-moscow' },
  { label: '圣保罗',     endpoint: 'cos.sa-saopaulo.myqcloud.com',      region: 'sa-saopaulo' },
];

/**
 * 阿里云 OSS 地域映射
 */
const OSS_REGIONS = [
  { label: '北京',       endpoint: 'oss-cn-beijing.aliyuncs.com',         region: 'cn-beijing' },
  { label: '上海',       endpoint: 'oss-cn-shanghai.aliyuncs.com',        region: 'cn-shanghai' },
  { label: '广州',       endpoint: 'oss-cn-guangzhou.aliyuncs.com',       region: 'cn-guangzhou' },
  { label: '深圳',       endpoint: 'oss-cn-shenzhen.aliyuncs.com',        region: 'cn-shenzhen' },
  { label: '杭州',       endpoint: 'oss-cn-hangzhou.aliyuncs.com',        region: 'cn-hangzhou' },
  { label: '南京',       endpoint: 'oss-cn-nanjing.aliyuncs.com',         region: 'cn-nanjing' },
  { label: '成都',       endpoint: 'oss-cn-chengdu.aliyuncs.com',         region: 'cn-chengdu' },
  { label: '张家口',     endpoint: 'oss-cn-zhangjiakou.aliyuncs.com',     region: 'cn-zhangjiakou' },
  { label: '香港',       endpoint: 'oss-cn-hongkong.aliyuncs.com',        region: 'cn-hongkong' },
  { label: '新加坡',     endpoint: 'oss-ap-southeast-1.aliyuncs.com',     region: 'ap-southeast-1' },
  { label: '东京',       endpoint: 'oss-ap-northeast-1.aliyuncs.com',     region: 'ap-northeast-1' },
  { label: '硅谷',       endpoint: 'oss-us-west-1.aliyuncs.com',          region: 'us-west-1' },
  { label: '法兰克福',   endpoint: 'oss-eu-central-1.aliyuncs.com',       region: 'eu-central-1' },
];

/**
 * MinIO 无需内置地域表，但保留结构用于前端展示一致性
 */
const MINIO_REGIONS = []; // MinIO endpoint 由用户自定义输入

/** 根据厂商获取地域列表 */
function getRegionsForProvider(provider) {
  switch (provider) {
    case 'tencent_cos': return COS_REGIONS;
    case 'aliyun_oss': return OSS_REGIONS;
    case 'minio': return MINIO_REGIONS;
    default: return [];
  }
}

/**
 * 根据 endpoint 查找对应的地域信息
 * @returns {{ label, endpoint, region }} | null
 */
function matchRegionByEndpoint(provider, endpoint) {
  if (!endpoint) return null;
  const regions = getRegionsForProvider(provider);
  return regions.find(r => r.endpoint === endpoint) || null;
}

/**
 * 从 endpoint 提取 SDK 用的 region 简称
 * 优先查内置映射表，命中则返回表中 region；否则用正则降级
 */
function extractRegion(provider, endpoint) {
  const matched = matchRegionByEndpoint(provider, endpoint);
  if (matched) return matched.region;

  // 降级：正则提取
  if (!endpoint) return '';
  // OSS: oss-cn-beijing.aliyuncs.com → cn-beijing
  const ossM = endpoint.match(/oss-([a-z]+-[a-z0-9-]+)\.aliyuncs/);
  if (ossM) return ossM[1];
  // COS: cos.ap-beijing.myqcloud.com → ap-beijing
  const cosM = endpoint.match(/cos\.([a-z]+-[a-z0-9-]+)\.myqcloud/);
  if (cosM) return cosM[1];
  return endpoint;
}

// ===== 核心存储逻辑 =====

async function getStorageConfig() {
  const s = await Settings.getSettings();
  return s.storageConfig || Settings.schema.paths['storageConfig']?.defaultValue || {};
}

function getBaseUrl() {
  const env = process.env;
  return env.PUBLIC_URL || env.BASE_URL || `http://localhost:${env.PORT || 3000}`;
}

async function upload(input, filename, category) {
  const config = await getStorageConfig();
  if (!config.enabled) return uploadLocal(input, filename, category);
  try {
    return await uploadToCloud(config, input, filename, category);
  } catch (err) {
    console.error(`[storage] 对象存储上传失败，降级到本地: ${err.message}`);
    return uploadLocal(input, filename, category);
  }
}

async function uploadFromUrl(remoteUrl, filename, category) {
  const resp = await axios({ url: remoteUrl, method: 'GET', responseType: 'arraybuffer', timeout: 30000 });
  return upload(Buffer.from(resp.data), filename, category || "");
}

async function uploadLocal(input, filename, category) {
  const uploadsDir = path.join(__dirname, '..', 'uploads', category || '');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filepath = path.join(uploadsDir, filename);
  if (Buffer.isBuffer(input)) {
    fs.writeFileSync(filepath, input);
  } else if (typeof input === 'string' && fs.existsSync(input)) {
    fs.copyFileSync(input, filepath);
  }
  console.log(`[storage:local] 已保存: ${filename}`);
  return `/uploads/${filename}`;
}

async function uploadToCloud(config, input, filename, category) {
  const fullKey = path.posix.join(config.prefix || '/autodrama/uploads/', filename).replace(/\\/g, '/').replace(/^\/+/, '');
  const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);

  switch (config.provider) {
    case 'aliyun_oss': return uploadToOSS(config, buffer, fullKey);
    case 'tencent_cos': return uploadToCOS(config, buffer, fullKey);
    case 'minio': return uploadToMinIO(config, buffer, fullKey);
    default: throw new Error(`不支持的对象存储厂商: ${config.provider}`);
  }
}

// ===== 阿里云 OSS =====
function buildOSSClient(config) {
  const OSS = require('ali-oss');
  const region = extractRegion('aliyun_oss', config.endpoint);
  return new OSS({
    region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    endpoint: config.endpoint,
  });
}

async function uploadToOSS(config, buffer, key) {
  const client = buildOSSClient(config);
  const result = await client.put(key, buffer);
  console.log(`[storage:oss] 上传成功: ${result.url}`);
  return result.url;
}

// ===== 腾讯云 COS =====
function buildCOSClient(config) {
  const COS = require('cos-nodejs-sdk-v5');
  return new COS({
    SecretId: config.accessKeyId,
    SecretKey: config.accessKeySecret,
  });
}

async function uploadToCOS(config, buffer, key) {
  const cos = buildCOSClient(config);
  const region = extractRegion('tencent_cos', config.endpoint);
  const endpoint = config.endpoint || 'cos.ap-beijing.myqcloud.com';

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: config.bucket,
      Region: region,
      Key: key,
      Body: buffer,
    }, (err) => {
      if (err) return reject(err);
      // 拼接公网 URL：https://{bucket}.{endpoint}/{key}
      const url = `https://${config.bucket}.${endpoint}/${key}`;
      console.log(`[storage:cos] 上传成功 (region=${region}): ${url}`);
      resolve(url);
    });
  });
}

// ===== MinIO =====
async function uploadToMinIO(config, buffer, key) {
  const Minio = require('minio');
  const endpoint = config.endpoint.replace(/^https?:\/\//, '');
  const useSSL = config.endpoint.startsWith('https://');
  const mc = new Minio.Client({
    endPoint: endpoint,
    port: useSSL ? 443 : 9000,
    useSSL,
    accessKey: config.accessKeyId,
    secretKey: config.accessKeySecret,
  });

  const exists = await mc.bucketExists(config.bucket);
  if (!exists) await mc.makeBucket(config.bucket);

  await mc.putObject(config.bucket, key, buffer);
  const url = `${useSSL ? 'https' : 'http'}://${endpoint}/${config.bucket}/${key}`;
  console.log(`[storage:minio] 上传成功: ${url}`);
  return url;
}

// ===== 测试连接 =====

async function testConnection(config) {
  const { provider, endpoint, accessKeyId, accessKeySecret, bucket } = config;

  if (!accessKeyId || !accessKeySecret) {
    return { ok: false, message: '请填写 AccessKey ID 和 AccessKey Secret' };
  }
  if (!bucket) {
    return { ok: false, message: '请填写 Bucket 名称' };
  }

  try {
    switch (provider) {
      case 'aliyun_oss': return await testOSSConnection(config);
      case 'tencent_cos': return await testCOSConnection(config);
      case 'minio': return await testMinIOConnection(config);
      default:
        return { ok: false, message: `不支持的厂商: ${provider}` };
    }
  } catch (err) {
    return formatError(err, config);
  }
}

async function testOSSConnection(config) {
  const OSS = require('ali-oss');
  const endpoint = config.endpoint || 'oss-cn-hangzhou.aliyuncs.com';
  const region = extractRegion('aliyun_oss', endpoint);
  console.log(`[storage:test:oss] 测试参数 → region=${region}, endpoint=${endpoint}, bucket=${config.bucket}`);

  const client = new OSS({
    region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    endpoint,
    timeout: 10000,
  });
  const info = await client.getBucketInfo(config.bucket);
  const bucketRegion = info.bucket?.Region || region;
  if (bucketRegion && bucketRegion !== region) {
    const matched = getRegionsForProvider('aliyun_oss').find(r => r.region === bucketRegion);
    return {
      ok: false,
      message: `Bucket 实际地域为 ${bucketRegion}${matched ? ` (${matched.label})` : ''}，请选择对应地域并使用 Endpoint: ${matched ? matched.endpoint : '未知'}。当前 Endpoint 地域为 ${region}，不匹配。`,
    };
  }
  return { ok: true, message: `连接成功：阿里云 OSS 配置正确，Bucket "${config.bucket}" 位于 ${matched ? matched.label : bucketRegion || region}` };
}

async function testCOSConnection(config) {
  const COS = require('cos-nodejs-sdk-v5');
  const endpoint = config.endpoint || 'cos.ap-beijing.myqcloud.com';
  const region = extractRegion('tencent_cos', endpoint);
  console.log(`[storage:test:cos] 测试参数 → region=${region}, endpoint=${endpoint}, bucket=${config.bucket}`);

  const cos = new COS({
    SecretId: config.accessKeyId,
    SecretKey: config.accessKeySecret,
  });

  // 先探测 Bucket 实际地域
  return new Promise(resolve => {
    cos.headBucket({ Bucket: config.bucket, Region: region }, (err, data) => {
      if (err) {
        // 如果是地域不匹配错误，尝试探测正确地域
        if (err.code === 'PermanentRedirect' || err.code === 'NoSuchBucket' || (err.statusCode === 301)) {
          // 尝试从错误消息或重定向中提取正确地域
          const redirectRegion = extractRegionFromCOSError(err);
          if (redirectRegion && redirectRegion !== region) {
            const matched = getRegionsForProvider('tencent_cos').find(r => r.region === redirectRegion);
            resolve({
              ok: false,
              message: `Bucket 实际地域为 ${redirectRegion}${matched ? ` (${matched.label})` : ''}，请选择对应地域并使用 Endpoint: ${matched ? matched.endpoint : `cos.${redirectRegion}.myqcloud.com`}。当前配置地域为 ${region}，不匹配。`,
            });
            return;
          }
        }
        resolve(formatCOSError(err, config));
        return;
      }
      const matched = getRegionsForProvider('tencent_cos').find(r => r.region === region);
      resolve({
        ok: true,
        message: `连接成功：腾讯云 COS 配置正确，Bucket "${config.bucket}" 位于 ${matched ? matched.label : region} (${region})，Endpoint: ${endpoint}`,
      });
    });
  });
}

/** 从 COS 错误响应中提取正确的地域 */
function extractRegionFromCOSError(err) {
  if (!err) return null;
  // PermanentRedirect 错误通常在 headers.location 或 body 中
  if (err.headers?.location) {
    const loc = err.headers.location;
    // 从 URL 提取 region: https://bucket.cos.ap-shanghai.myqcloud.com/
    const m = loc.match(/cos\.([a-z]+-[a-z0-9-]+)\.myqcloud/);
    if (m) return m[1];
  }
  // 也可能在错误消息中
  if (err.message) {
    const m = err.message.match(/([a-z]+-[a-z0-9-]+)/);
    if (m) return m[1];
  }
  // 对于 301，尝试用常见地域重试（按顺序探测）
  // 这里返回 null，由调用方处理
  return null;
}

function formatCOSError(err, config) {
  const code = err.code || err.statusCode || '';
  const msg = err.message || '';
  if (code === 'AccessDenied' || msg.includes('AccessDenied')) {
    return { ok: false, message: '密钥验证失败：SecretId 或 SecretKey 无效' };
  }
  if (code === 'InvalidAccessKeyId') {
    return { ok: false, message: 'SecretId 无效，请检查 AccessKey ID' };
  }
  if (code === 'SignatureDoesNotMatch') {
    return { ok: false, message: 'SecretKey 不正确，签名验证失败' };
  }
  if (code === 'NoSuchBucket') {
    return { ok: false, message: `Bucket "${config.bucket}" 在 ${config.endpoint} 地域不存在，请检查 Bucket 名称和地域` };
  }
  return { ok: false, message: `连接失败 (${code}): ${msg}` };
}

async function testMinIOConnection(config) {
  const Minio = require('minio');
  const ep = (config.endpoint || '127.0.0.1:9000').replace(/^https?:\/\//, '');
  const useSSL = config.endpoint && config.endpoint.startsWith('https://');
  console.log(`[storage:test:minio] 测试参数 → endpoint=${ep}, useSSL=${useSSL}, bucket=${config.bucket}`);

  const mc = new Minio.Client({
    endPoint: ep, port: useSSL ? 443 : 9000, useSSL,
    accessKey: config.accessKeyId, secretKey: config.accessKeySecret,
  });
  const exists = await mc.bucketExists(config.bucket);
  if (exists) return { ok: true, message: `连接成功：MinIO 配置正确，Bucket "${config.bucket}" 存在` };
  return { ok: false, message: `Bucket "${config.bucket}" 不存在，请先在 MinIO 中创建` };
}

function formatError(err, config) {
  const msg = err.message || String(err);
  if (msg.includes('InvalidAccessKeyId') || msg.includes('AccessDenied')) {
    return { ok: false, message: '密钥验证失败：AccessKey ID 无效或已禁用' };
  }
  if (msg.includes('SignatureDoesNotMatch')) {
    return { ok: false, message: '密钥验证失败：AccessKey Secret 不正确' };
  }
  if (msg.includes('NoSuchBucket') || msg.includes('NotFound')) {
    return { ok: false, message: `Bucket "${config.bucket}" 不存在，请检查名称和区域` };
  }
  if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
    return { ok: false, message: `无法连接 ${config.endpoint}，请检查 Endpoint 和网络` };
  }
  return { ok: false, message: `连接失败: ${msg}` };
}

// ===== URL 解析 =====

function resolvePublicUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  if (!pathOrUrl.startsWith('/uploads/')) return pathOrUrl;
  const base = getBaseUrl().replace(/\/+$/, '');
  return `${base}${pathOrUrl}`;
}

function resolvePublicUrls(urls) {
  if (!urls || !Array.isArray(urls)) return [];
  return urls.map(resolvePublicUrl);
}

module.exports = {
  getStorageConfig,
  upload,
  uploadFromUrl,
  testConnection,
  getBaseUrl,
  resolvePublicUrl,
  resolvePublicUrls,
  getRegionsForProvider,
  matchRegionByEndpoint,
  extractRegion,
  COS_REGIONS,
  OSS_REGIONS,
};
