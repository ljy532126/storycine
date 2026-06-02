/**
 * 火山引擎 API v4 签名工具 (HMAC-SHA256)
 * 用于调用 open.volcengineapi.com / speech-saas-prod.volcengineapi.com
 */
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function hmacSha256Hex(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * 为火山引擎 API v4 请求生成签名头
 * @param {string} accessKey - Access Key ID
 * @param {string} secretKey - Secret Access Key
 * @param {string} service - 服务名 (e.g. 'speech_saas_prod')
 * @param {string} region - 地域 (e.g. 'cn-beijing')
 * @param {string} method - HTTP 方法
 * @param {string} path - 请求路径
 * @param {string} query - 查询字符串 (不含 ?)
 * @param {object|string} body - 请求体
 * @returns {object} 需要附加的请求头
 */
function signRequest(accessKey, secretKey, service, region, method, path, query, body) {
  const now = new Date();
  const xDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').substring(0, 15) + 'Z';

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {});
  const contentHash = sha256(bodyStr);

  // Step 1: Canonical Request
  const canonicalQuery = query || '';
  const canonicalHeaders = `content-type:application/json\nhost:${service}.volcengineapi.com\nx-date:${xDate}\n`;
  const signedHeaders = 'content-type;host;x-date';
  const canonicalRequest = `${method}\n${path}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${contentHash}`;

  // Step 2: String to Sign
  const dateStamp = xDate.substring(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/request`;
  const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;

  // Step 3: Signing Key
  const kDate = hmacSha256(secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'request');

  // Step 4: Signature
  const signature = hmacSha256Hex(kSigning, stringToSign);
  const auth = `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Content-Type': 'application/json',
    'X-Date': xDate,
    'Authorization': auth,
  };
}

module.exports = { signRequest, sha256 };
