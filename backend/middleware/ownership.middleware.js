/**
 * 资源归属校验中间件
 * 确保用户只能操作属于自己的资源
 */
const Project = require('../models/project.model');

/** 校验请求的操作对象是否属于当前用户 */
async function assertOwnership(req, res, next) {
  const projectId = req.params.id || req.params.projectId || req.body.projectId;
  if (!projectId) return res.status(400).json({ message: '缺少 projectId' });

  if (req.user.role === 'admin') return next(); // admin 不受限

  const project = await Project.findById(projectId);
  if (!project) return res.status(404).json({ message: '项目不存在' });
  if (project.userId !== req.user._id.toString()) {
    return res.status(403).json({ message: '无权操作此资源' });
  }
  next();
}

/** 从 Mongoose 文档校验归属 */
function checkDocOwnership(doc, userId) {
  if (!doc) return false;
  const ownerId = doc.userId ? doc.userId.toString() : null;
  return ownerId === userId.toString();
}

module.exports = { assertOwnership, checkDocOwnership };
