const mongoose = require('mongoose');

const ttsAudioSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  scriptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Script', index: true },
  storyboardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Storyboard' },
  shotNumber: { type: Number },
  episodeNumber: { type: Number },
  characterName: { type: String, default: '' },
  text: { type: String, required: true },
  audioUrl: { type: String, required: true },
  format: { type: String, default: 'mp3' },
  duration: { type: Number, default: 0 },
  subtitles: [{
    start: Number,
    end: Number,
    text: String,
  }],
  ttsParams: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ttsAudioSchema.index({ projectId: 1, scriptId: 1 });
ttsAudioSchema.index({ storyboardId: 1, shotNumber: 1 });

module.exports = mongoose.model('TtsAudio', ttsAudioSchema);
