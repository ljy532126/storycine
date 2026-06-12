const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'in_progress', 'completed', 'archived'], default: 'draft' },
  scriptSource: { type: String, enum: ['ai_generated', 'manual_import', 'none'], default: 'none' },
  totalEpisodes: { type: Number, default: 15 },
  copyrightDeclaration: { type: String, default: '本作品由 StoryCine AI 辅助生成，用户拥有二次创作版权，请遵守平台内容规范' },
  videoConfig: {
    aspectRatio: { type: String, default: '9:16', enum: ['9:16', '16:9', '4:3', '3:4'] },
    visualStyle: { type: String, default: '写实', enum: ['写实', '动漫', '真人', '古风', '电影感'] },
    subStyle: { type: String, default: '' },
  },
  directorSettings: {
    qualityKeywords: { type: String, default: '8K, 超写实, 电影级摄影, 高细节' },
    atmosphereLighting: { type: String, default: '' },
    artStyleCommands: { type: String, default: '' },
    aiOptimized: { type: Boolean, default: false },
  },
  userId: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
