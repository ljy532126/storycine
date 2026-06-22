const mongoose = require('mongoose');

const compositionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  storyboardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Storyboard', required: true },
  name: { type: String, default: '' },
  outputFormat: { type: String, enum: ['mp4', 'mov', 'avi'], default: 'mp4' },
  resolution: { type: String, default: '1080x1920' },
  frameRate: { type: Number, default: 24 },
  totalDuration: { type: Number, default: 0 },
  outputUrl: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  backgroundMusic: { type: String, default: '' },
  subtitlesEnabled: { type: Boolean, default: true },
  transitions: { type: String, default: 'fade' },
  status: { type: String, enum: ['pending', 'rendering', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0 },
  errorMessage: { type: String, default: '' },
  warnings: { type: [String], default: [] },
}, { timestamps: true });

compositionSchema.index({ storyboardId: 1 });
compositionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Composition', compositionSchema);
