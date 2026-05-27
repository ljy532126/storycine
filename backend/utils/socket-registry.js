/**
 * Socket.IO 注册表 — 模块级单例，Agent 通过 require 直接获取 io 实例。
 * 避免通过 LangGraph state 或 global 传递导致序列化丢失。
 */
let _io = null;

module.exports = {
  setIO(io) { _io = io; console.log('[socket-registry] IO instance registered'); },
  getIO() { return _io; },

  emitToProject(projectId, event, data) {
    if (_io && projectId) {
      _io.to(`project-${projectId}`).emit(event, data);
      return true;
    }
    console.warn(`[socket-registry] emit failed: io=${!!_io} pid=${!!projectId} event=${event}`);
    return false;
  },
};
