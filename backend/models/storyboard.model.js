const mongoose = require('mongoose');

const shotSchema = new mongoose.Schema({
  shotNumber: { type: Number, required: true },
  sceneName: { type: String, default: '' },
  shotType: { type: String, enum: ['远景', '全景', '中景', '近景', '特写', '大特写', '微距'], default: '中景' },
  cameraAngle: { type: String, enum: ['平视', '俯拍', '仰拍', '顶拍', '荷兰角'], default: '平视' },
  composition: { type: String, default: '' },
  cameraMovement: { type: String, enum: ['固定', '推镜', '拉镜', '平移', '摇镜', '跟镜', '升降', '希区柯克变焦', '变速推近'], default: '固定' },
  lighting: { type: String, default: '' },
  characterEmotion: { type: String, default: '' },
  duration: { type: Number, default: 3 },
  imageDescription: { type: String, default: '' },
  renderedImage: { type: String, default: '' },
  renderedVideo: { type: String, default: '' },
  materials: [{
    version: { type: Number, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    url: { type: String, default: '' },
    prompt: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
  dialogue: {
    characterName: { type: String, default: '' },
    text: { type: String, default: '' },
    audioUrl: { type: String, default: '' },
    actionHint: { type: String, default: '' },
    cameraHint: { type: String, default: '' },
    innerThought: { type: String, default: '' },
  },
  soundEffect: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'generating_image', 'generating_video', 'completed', 'failed'], default: 'pending' },
  _imagePrompt: { type: String, default: '' },
  _videoPrompt: { type: String, default: '' },
  _dialogues: [{
    characterName: { type: String, default: '' },
    text: { type: String, default: '' },
    actionHint: { type: String, default: '' },
    innerThought: { type: String, default: '' },
    cameraHint: { type: String, default: '' },
  }],
  _refImages: { type: [String], default: [] },
});

const storyboardSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  scriptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Script', required: true },
  shots: [shotSchema],
  totalShots: { type: Number, default: 0 },
  totalDuration: { type: Number, default: 0 },
  progress: {
    renderedShots: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
}, { timestamps: true });

storyboardSchema.pre('save', function(next) {
  if (!this.isModified('shots') && !this.isNew) return next();
  this.totalShots = this.shots.length;
  this.totalDuration = this.shots.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  this.progress.renderedShots = this.shots.filter(s => s.status === 'completed').length;
  this.progress.percentage = this.totalShots > 0 ? Math.round(this.progress.renderedShots / this.totalShots * 100) : 0;
  next();
});

storyboardSchema.index({ scriptId: 1 });

module.exports = mongoose.model('Storyboard', storyboardSchema);
