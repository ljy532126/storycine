/**
 * AI API 调用限流 — 按用户隔离，防止单个用户耗尽 API 配额
 */
const rateLimit = require('express-rate-limit');

function createAILimiter(maxPerHour, msg) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: maxPerHour,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req, res) => {
      if (req.user?._id) return req.user._id.toString();
      // 使用 rate-limit 内置的 ipKeyGenerator 处理 IPv6
      return rateLimit.ipKeyGenerator(req, res);
    },
    message: { message: msg || `请求过于频繁，请稍后再试` },
  });
}

const aiGenerateLimiter       = createAILimiter(100,  '剧本生成频率限制：每小时 100 次');
const aiContinueLimiter       = createAILimiter(100,  '剧本续写频率限制：每小时 100 次');
const aiGenerateImageLimiter  = createAILimiter(200, '图片/视频生成频率限制：每小时 200 次');
const aiGeneratePromptLimiter = createAILimiter(200, '提示词生成频率限制：每小时 200 次');
const aiExtractLimiter        = createAILimiter(200, '资产提取频率限制：每小时 200 次');
const aiCoverLimiter          = createAILimiter(200, '封面生成频率限制：每小时 200 次');

module.exports = {
  aiGenerateLimiter,
  aiContinueLimiter,
  aiGenerateImageLimiter,
  aiGeneratePromptLimiter,
  aiExtractLimiter,
  aiCoverLimiter,
};
