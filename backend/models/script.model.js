const mongoose = require('mongoose');

const sceneSchema = new mongoose.Schema({
  // strict: false 允许 AI 生成的额外字段透传，不会被 Mongoose 丢弃
}, { strict: false });
// legacy — 以下字段定义保留作为文档参考（strict:false 模式下实际不做校验）
sceneSchema.add({
  sceneNumber: { type: Number, required: true },
  timeOfDay: { type: String, default: '白天' },
  location: { type: String, default: '' },
  shotType: { type: String, default: '中景' },
  composition: { type: String, default: '' },
  cameraMovement: { type: String, default: '固定' },
  cameraAngle: { type: String, default: '平视' },
  lighting: { type: String, default: '' },
  soundEffect: { type: String, default: '' },
  duration: { type: Number, default: 3 },
  characters: [{ type: String }],
  atmosphere: { type: String, default: '' },
  sceneDescription: { type: String, default: '' },
  dialogues: [{
    characterName: { type: String, default: '' },
    text: { type: String, default: '' },
    actionHint: { type: String, default: '' },
    innerThought: { type: String, default: '' },
    cameraHint: { type: String, default: '' },
  }],
  notes: { type: String, default: '' },
});

const scriptSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  episodeNumber: { type: Number, required: true },
  episodeTitle: { type: String, default: '' },
  source: { type: String, enum: ['ai_generated', 'manual_import', 'ai_continue'], default: 'ai_generated' },
  summary: { type: String, default: '' },
  scenes: [sceneSchema],
  wordCount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'editing', 'locked', 'approved'], default: 'draft' },
  continueFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Script', default: null },
}, { timestamps: true });

scriptSchema.pre('save', function(next) {
  let total = 0;
  this.scenes.forEach(s => {
    total += (s.sceneDescription || '').length;
    s.dialogues.forEach(d => {
      total += (d.text || '').length + (d.innerThought || '').length;
    });
  });
  this.wordCount = total;
  next();
});

module.exports = mongoose.model('Script', scriptSchema);
