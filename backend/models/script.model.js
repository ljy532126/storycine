const mongoose = require('mongoose');

const sceneSchema = new mongoose.Schema({
  sceneNumber: { type: Number, required: true },
  timeOfDay: { type: String, enum: ['白天', '夜晚', '黄昏', '傍晚', '清晨', '黎明', '正午', '深夜', '雨天', '雪天', '不限'], default: '白天' },
  location: { type: String, required: true },
  shotType: { type: String, enum: ['远景', '中景', '近景', '特写', '大特写', '全景', '中近景'], default: '中景' },
  composition: { type: String, default: '' },
  cameraMovement: { type: String, enum: ['推', '拉', '摇', '移', '跟', '静止', '升', '降', '晃动'], default: '静止' },
  lighting: { type: String, default: '' },
  soundEffect: { type: String, default: '' },
  duration: { type: Number, default: 3 },
  characters: [{ type: String }],
  atmosphere: { type: String, default: '' },
  sceneDescription: { type: String, default: '' },
  dialogues: [{
    characterName: { type: String, required: true },
    text: { type: String, required: true },
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
