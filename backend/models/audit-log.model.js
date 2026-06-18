const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, enum: ['backup.create', 'backup.delete', 'backup.import', 'backup.export', 'backup.download', 'backup.config', 'backup.cold_sync'] },
  operator: { type: String, required: true },    // username
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  detail: { type: String, default: '' },         // filename / config changes
  ip: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ operator: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
