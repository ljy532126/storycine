const mongoose = require('mongoose');

const apiCallStatsSchema = new mongoose.Schema({
  route: { type: String, required: true, index: true },
  method: { type: String, default: 'POST' },
  statusCode: { type: Number, default: 200 },
  category: { type: String, enum: ['image', 'video', 'llm', 'other'], default: 'other', index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  duration: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

apiCallStatsSchema.index({ createdAt: -1 });
apiCallStatsSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('ApiCallStats', apiCallStatsSchema);
