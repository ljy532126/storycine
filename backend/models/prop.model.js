const mongoose = require('mongoose');

const propSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  propName: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  referenceImage: { type: String, default: '' },
  generatedImage: { type: String, default: '' },
  keyPlotPoints: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Prop', propSchema);
