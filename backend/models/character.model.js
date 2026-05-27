const mongoose = require('mongoose');

const morphSchema = new mongoose.Schema({
  morphName: { type: String, required: true },
  appearancePrompt: { type: String, default: '' },
  referenceImage: { type: String, default: '' },
  generatedImages: {
    front: { type: String, default: '' },
    side: { type: String, default: '' },
    back: { type: String, default: '' },
  },
  outfitDescription: { type: String, default: '' },
  expressionSet: [{ type: String }],
});

const characterSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  age: { type: Number, default: 0 },
  gender: { type: String, enum: ['男', '女', '其他'], default: '其他' },
  appearance: { type: String, default: '' },
  personality: { type: String, default: '' },
  background: { type: String, default: '' },
  relationships: { type: String, default: '' },
  weakness: { type: String, default: '' },
  goal: { type: String, default: '' },
  tags: [{ type: String }],
  roleType: { type: String, enum: ['主角', '配角', '反派', '龙套'], default: '配角' },
  morphs: [morphSchema],
  voiceConfig: {
    voiceId: { type: String, default: '' },
    voiceName: { type: String, default: '' },
    speed: { type: Number, default: 1.0 },
    pitch: { type: Number, default: 1.0 },
  },
  isLocked: { type: Boolean, default: false },
}, { timestamps: true });

characterSchema.index({ projectId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Character', characterSchema);
