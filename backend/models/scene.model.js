const mongoose = require('mongoose');

const sceneAssetSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  sceneName: { type: String, required: true },
  description: { type: String, default: '' },
  stylePrompt: { type: String, default: '' },
  referenceImage: { type: String, default: '' },
  generatedImage: { type: String, default: '' },
  appearances: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('SceneAsset', sceneAssetSchema);
