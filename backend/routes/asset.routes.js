const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storageService = require('../services/storage.service');
const { authRequired } = require('../middleware/auth.middleware');
const appConfig = require('../config/app.config');
const { checkDocOwnership } = require('../middleware/ownership.middleware');
const { aiExtractLimiter, aiGeneratePromptLimiter, aiGenerateImageLimiter } = require('../middleware/rate-limiter.middleware');
router.use(authRequired);

/** 校验项目归属 */
async function verifyProjectAccess(projectId, userId, role) {
  if (role === 'admin') return true;
  const Project = require('../models/project.model');
  const project = await Project.findById(projectId);
  return project && project.userId === userId.toString();
}

/** 读取项目的导演设定，返回 { qualityKeywords, artStyleCommands, atmosphereLighting } */
async function readDirectorSettings(projectId) {
  try {
    const Project = require('../models/project.model');
    const proj = await Project.findById(projectId);
    if (proj?.directorSettings) return proj.directorSettings;
  } catch (e) { /* ignore */ }
  return {};
}
const Character = require('../models/character.model');
const SceneAsset = require('../models/scene.model');
const Prop = require('../models/prop.model');

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `char-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  },
});
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) { cb(null, true); }
    else { cb(new Error('仅允许上传 PNG / JPEG / WebP / GIF 格式的图片')); }
  },
});

// 参考图上传专用 multer（保存到 uploads/references/）
const refUploadsDir = path.join(__dirname, '..', 'uploads', 'references');
if (!fs.existsSync(refUploadsDir)) fs.mkdirSync(refUploadsDir, { recursive: true });
const refStorage = multer.diskStorage({
  destination: refUploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `ref-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  },
});
const refUpload = multer({
  storage: refStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) { cb(null, true); }
    else { cb(new Error('仅允许上传 PNG / JPEG / WebP / GIF 格式的图片')); }
  },
});
const THREE_VIEW_SUFFIX = `左区：角色正脸特写，面部占满左区，五官/发型/配饰清晰，无身体入镜、无遮挡变形；右区：标准角色设定三视图，横向依次排列侧视图、正视图和背视图，三个视图严格呈现侧视、正视和背视，从头到脚完整无遮挡；核心约束：特写与三视图为同一角色，五官/服装/配饰/体态100%一致；右区尺寸：三视图角色高度画面高度的80%，三视图高度统一；无多余元素的浅灰色背景，角色无阴影；超高清分辨率，统一85mm焦距，无畸变，角色无动作，平视；中性表情（无喜怒哀乐），眼神平静，自然站立，双手自然下垂，空手（无手持物），身上无任何背负物（无背包/无武器背负）；严禁画面出现不相关的文字；古风/仙侠风格下严禁光腿、严禁腿部裸露、严禁服饰残缺暴露`;

const STYLE_TEXT_IMAGE = `彩铅艺术插画风格，柔和彩铅质感，低饱和古典配色，雅致中高饱和度，组合式画面布局`;
const STYLE_TEXT_VIDEO = `电影级超写实人像摄影风格，自然肤色系色调，低饱和高真实度，保留自然皮肤肌理与微瑕疵光泽感，柔和漫射自然明暗过渡，构图由导演设定自由决定`;

const { buildCharacterMap, buildShotPrompt } = require('../services/asset.service');

// ===== 角色管理 =====

router.post('/characters', async (req, res, next) => {
  try {
    if (!(await verifyProjectAccess(req.body.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权在此项目中创建角色' });
    }
    const character = await Character.create({
      projectId: req.body.projectId,
      name: req.body.name,
      age: req.body.age,
      gender: req.body.gender,
      appearance: req.body.appearance || '',
      personality: req.body.personality || '',
      roleType: req.body.roleType || '配角',
    });
    res.status(201).json({ message: '角色创建成功', data: character });
  } catch (error) { next(error); }
});

router.get('/characters', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: '缺少projectId参数' });
    if (!(await verifyProjectAccess(projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此项目的角色' });
    }
    const characters = await Character.find({ projectId });
    res.json({ data: characters });
  } catch (error) { next(error); }
});

router.get('/characters/:id', async (req, res, next) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ message: '角色不存在' });
    if (!(await verifyProjectAccess(character.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此角色' });
    }
    res.json({ data: character });
  } catch (error) { next(error); }
});

router.put('/characters/:id', async (req, res, next) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ message: '角色不存在' });
    if (!(await verifyProjectAccess(character.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权修改此角色' });
    }
    const allowed = ['name', 'age', 'gender', 'appearance', 'personality', 'roleType', 'morphs', 'referenceImage', 'generatedImage'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    Object.assign(character, update);
    await character.save();
    res.json({ message: '更新成功', data: character });
  } catch (error) { next(error); }
});

router.delete('/characters/:id', async (req, res, next) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ message: '角色不存在' });
    if (!(await verifyProjectAccess(character.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权删除此角色' });
    }
    await Character.findByIdAndDelete(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) { next(error); }
});

router.post('/characters/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '缺少ids' });
    const chars = await Character.find({ _id: { $in: ids } });
    for (const c of chars) {
      if (!(await verifyProjectAccess(c.projectId, req.user._id, req.user.role))) {
        return res.status(403).json({ message: '无权删除部分角色' });
      }
    }
    const r = await Character.deleteMany({ _id: { $in: ids } });
    res.json({ message: `已删除 ${r.deletedCount} 个角色`, data: { deletedCount: r.deletedCount } });
  } catch (error) { next(error); }
});

// ===== 场景资产管理 =====

router.post('/scenes', async (req, res, next) => {
  try {
    if (!(await verifyProjectAccess(req.body.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权在此项目中创建场景' });
    }
    const scene = await SceneAsset.create({
      projectId: req.body.projectId,
      sceneName: req.body.sceneName,
      description: req.body.description || '',
      stylePrompt: req.body.stylePrompt || '',
    });
    res.status(201).json({ message: '场景创建成功', data: scene });
  } catch (error) { next(error); }
});

router.get('/scenes', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: '缺少projectId参数' });
    if (!(await verifyProjectAccess(projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此项目的场景' });
    }
    const scenes = await SceneAsset.find({ projectId });
    res.json({ data: scenes });
  } catch (error) { next(error); }
});

router.get('/scenes/:id', async (req, res, next) => {
  try {
    const scene = await SceneAsset.findById(req.params.id);
    if (!scene) return res.status(404).json({ message: '场景不存在' });
    if (!(await verifyProjectAccess(scene.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此场景' });
    }
    res.json({ data: scene });
  } catch (error) { next(error); }
});

router.put('/scenes/:id', async (req, res, next) => {
  try {
    const scene = await SceneAsset.findById(req.params.id);
    if (!scene) return res.status(404).json({ message: '场景不存在' });
    if (!(await verifyProjectAccess(scene.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权修改此场景' });
    }
    const allowed = ['sceneName', 'description', 'stylePrompt', 'referenceImage', 'generatedImage'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    Object.assign(scene, update);
    await scene.save();
    res.json({ message: '更新成功', data: scene });
  } catch (error) { next(error); }
});

router.delete('/scenes/:id', async (req, res, next) => {
  try {
    const scene = await SceneAsset.findById(req.params.id);
    if (!scene) return res.status(404).json({ message: '场景不存在' });
    if (!(await verifyProjectAccess(scene.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权删除此场景' });
    }
    await SceneAsset.findByIdAndDelete(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) { next(error); }
});

router.post('/scenes/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '缺少ids' });
    const scenes = await SceneAsset.find({ _id: { $in: ids } });
    for (const s of scenes) {
      if (!(await verifyProjectAccess(s.projectId, req.user._id, req.user.role))) {
        return res.status(403).json({ message: '无权删除部分场景' });
      }
    }
    const r = await SceneAsset.deleteMany({ _id: { $in: ids } });
    res.json({ message: `已删除 ${r.deletedCount} 个场景`, data: { deletedCount: r.deletedCount } });
  } catch (error) { next(error); }
});

// ===== 道具管理 =====

router.post('/props', async (req, res, next) => {
  try {
    if (!(await verifyProjectAccess(req.body.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权在此项目中创建道具' });
    }
    const prop = await Prop.create({
      projectId: req.body.projectId,
      propName: req.body.propName,
      description: req.body.description || '',
      category: req.body.category || '',
    });
    res.status(201).json({ message: '道具创建成功', data: prop });
  } catch (error) { next(error); }
});

router.get('/props', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: '缺少projectId参数' });
    if (!(await verifyProjectAccess(projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此项目的道具' });
    }
    const props = await Prop.find({ projectId });
    res.json({ data: props });
  } catch (error) { next(error); }
});

router.get('/props/:id', async (req, res, next) => {
  try {
    const prop = await Prop.findById(req.params.id);
    if (!prop) return res.status(404).json({ message: '道具不存在' });
    if (!(await verifyProjectAccess(prop.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权查看此道具' });
    }
    res.json({ data: prop });
  } catch (error) { next(error); }
});

router.put('/props/:id', async (req, res, next) => {
  try {
    const prop = await Prop.findById(req.params.id);
    if (!prop) return res.status(404).json({ message: '道具不存在' });
    if (!(await verifyProjectAccess(prop.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权修改此道具' });
    }
    const allowed = ['propName', 'description', 'category', 'referenceImage', 'generatedImage'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    Object.assign(prop, update);
    await prop.save();
    res.json({ message: '更新成功', data: prop });
  } catch (error) { next(error); }
});

router.delete('/props/:id', async (req, res, next) => {
  try {
    const prop = await Prop.findById(req.params.id);
    if (!prop) return res.status(404).json({ message: '道具不存在' });
    if (!(await verifyProjectAccess(prop.projectId, req.user._id, req.user.role))) {
      return res.status(403).json({ message: '无权删除此道具' });
    }
    await Prop.findByIdAndDelete(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) { next(error); }
});

router.post('/props/batch-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '缺少ids' });
    const props = await Prop.find({ _id: { $in: ids } });
    for (const p of props) {
      if (!(await verifyProjectAccess(p.projectId, req.user._id, req.user.role))) {
        return res.status(403).json({ message: '无权删除部分道具' });
      }
    }
    const r = await Prop.deleteMany({ _id: { $in: ids } });
    res.json({ message: `已删除 ${r.deletedCount} 个道具`, data: { deletedCount: r.deletedCount } });
  } catch (error) { next(error); }
});

// ===== 工具接口 =====

// 获取角色外貌映射表（用于生图prompt增强）
router.get('/character-map', async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: '缺少projectId参数' });
    const charMap = await buildCharacterMap(projectId);
    res.json({ data: charMap });
  } catch (error) { next(error); }
});

// 构建增强后的shot prompt
router.post('/build-shot-prompt', async (req, res, next) => {
  try {
    const { prompt, projectId } = req.body;
    if (!prompt || !projectId) {
      return res.status(400).json({ message: '缺少参数: prompt, projectId' });
    }
    const charMap = await buildCharacterMap(projectId);
    const enhancedPrompt = buildShotPrompt(prompt, charMap);
    res.json({ data: { originalPrompt: prompt, enhancedPrompt } });
  } catch (error) { next(error); }
});

// ===== 角色图片上传 =====
router.post('/characters/:id/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: '未选择文件' });
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ message: '角色不存在' });

    const imageUrl = `/uploads/${req.file.filename}`;
    if (!character.morphs || character.morphs.length === 0) {
      character.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
    }
    character.morphs[0].referenceImage = imageUrl;
    character.morphs[0].generatedImages.front = imageUrl;
    character.referenceImage = imageUrl;
    await character.save();

    res.json({ message: '上传成功', data: { imageUrl } });
  } catch (error) { next(error); }
});

// ===== 批量主体提取（角色 + 场景 + 道具） =====
router.post('/extract-all', aiExtractLimiter, async (req, res, next) => {
  try {
    const { scriptId, projectId } = req.body;
    if (!scriptId || !projectId) {
      return res.status(400).json({ message: '缺少参数: scriptId, projectId' });
    }

    const Script = require('../models/script.model');
    const script = await Script.findById(scriptId);
    if (!script) return res.status(404).json({ message: '剧本不存在' });

    const result = { characters: [], scenes: [], props: [] };

    // 1. 提取角色 + AI 生成详细信息
    const charNames = new Set();
    const charContext = {}; // 收集每个角色的上下文
    script.scenes.forEach(s => {
      (s.characters || []).forEach(c => { if (c && c.trim()) { charNames.add(c.trim()); if (!charContext[c.trim()]) charContext[c.trim()] = []; charContext[c.trim()].push(`出场: ${s.location}，${s.atmosphere || ''}`); } });
      (s.dialogues || []).forEach(d => {
        if (d.characterName && d.characterName.trim()) {
          charNames.add(d.characterName.trim());
          if (!charContext[d.characterName.trim()]) charContext[d.characterName.trim()] = [];
          charContext[d.characterName.trim()].push(`台词: "${d.text}"`);
        }
      });
    });

    // 筛选出新角色
    const newChars = [];
    for (const name of charNames) {
      const exists = await Character.findOne({ projectId, name });
      if (!exists) {
        newChars.push({ name, context: (charContext[name] || []).slice(0, 5).join('; ') });
      } else {
        result.characters.push({ _id: exists._id, name, existed: true });
      }
    }

    // 用 AI 批量生成新角色的详细信息
    if (newChars.length > 0) {
      const { callLLM } = require('../utils/llm-client');
      const charListText = newChars.map(c => `- ${c.name}：${c.context || '暂无具体上下文'}`).join('\n');
      const systemPrompt = `你是影视角色设计师。根据剧本上下文，为每个角色生成详细的长相和外形信息。必须包含：年龄、性别、身份、身高体型、脸型、五官细节、肤色、发型发色、服饰鞋履。所有描述必须具体，便于AI绘图。输出JSON数组。`;
      const userPrompt = `剧本概要：${script.summary || '无概要'}

角色列表及上下文：
${charListText}

请为每个角色输出JSON（只输出JSON数组）：
[{
  "name": "角色名",
  "age": 推测年龄数字,
  "gender": "男/女/其他",
  "roleType": "主角/配角/反派/龙套",
  "appearance": "详细外貌描述：身高范围如中等身材/高挑/娇小，体型如匀称/微胖/纤细/魁梧，脸型如鹅蛋脸/瓜子脸/方脸，五官特征如剑眉星目/桃花眼/薄唇/高鼻梁",
  "personality": "从台词推测的性格关键词",
  "outfit": "完整服饰描述：上衣+下装+鞋子+配饰的颜色、材质、款式，如'白色真丝衬衫，黑色西装裤，黑色皮鞋，银色腕表'",
  "hairStyle": "发型发色，如'黑色长发披散'、'棕色短发'",
  "skinTone": "肤色，如'自然肤色'、'偏黄'、'白皙'、'小麦色'"
}]`;

      try {
        const llmRes = await callLLM(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 4096, responseFormat: 'json' });
        const details = JSON.parse(llmRes);

        for (const detail of details) {
          const charName = detail.name;
          // 构建个性化三视图提示词
          const descParts = [];
          if (detail.age) descParts.push(`${detail.age}岁`);
          if (detail.gender) descParts.push(detail.gender);
          if (detail.roleType) descParts.push(detail.roleType);
          descParts.push(charName);
          descParts.push('中国人');
          if (detail.appearance) descParts.push(detail.appearance);
          if (detail.skinTone) descParts.push(`${detail.skinTone}肤色`);
          if (detail.hairStyle) descParts.push(detail.hairStyle);
          if (detail.outfit) descParts.push(`身穿${detail.outfit}`);

          const promptBody = descParts.join('，');
          const fullPrompt = `8K画质，真实皮肤质感，超写实，电影级摄影，超写实真人风格，电影级画质；${promptBody}；${THREE_VIEW_SUFFIX}`;

          const created = await Character.create({
            projectId,
            name: charName,
            age: detail.age || 0,
            gender: detail.gender || '其他',
            appearance: detail.appearance || '',
            personality: detail.personality || '',
            roleType: detail.roleType || '配角',
            morphs: [{
              morphName: '默认',
              appearancePrompt: fullPrompt,
              referenceImage: '',
              generatedImages: { front: '', side: '', back: '' },
              outfitDescription: detail.outfit || '',
              expressionSet: [],
            }],
          });
          result.characters.push({ _id: created._id, name: charName });
        }
      } catch (e) {
        // AI 失败则回退基础模板
        console.error('AI character detail generation failed:', e.message);
        for (const nc of newChars) {
          const basePrompt = `8K画质，超写实真人风格，电影级摄影；${nc.name}，中国人；${THREE_VIEW_SUFFIX}`;
          const created = await Character.create({
            projectId, name: nc.name,
            appearance: '', personality: '', roleType: '配角',
            morphs: [{
              morphName: '默认', appearancePrompt: basePrompt,
              referenceImage: '', generatedImages: { front: '', side: '', back: '' },
              outfitDescription: '', expressionSet: [],
            }],
          });
          result.characters.push({ _id: created._id, name: nc.name });
        }
      }
    }

    // 2. 提取场景：从每个场次的 location 字段
    const locSet = new Set();
    script.scenes.forEach(s => {
      if (s.location && s.location.trim()) locSet.add(s.location.trim());
    });

    for (const loc of locSet) {
      const exists = await SceneAsset.findOne({ projectId, sceneName: loc });
      if (!exists) {
        const { callLLM } = require('../utils/llm-client');
        const scenesWithLoc = script.scenes.filter(s => s.location?.trim() === loc);
        const contextTexts = scenesWithLoc.map(s => {
          const parts = [];
          if (s.timeOfDay) parts.push(s.timeOfDay);
          if (s.atmosphere) parts.push(s.atmosphere);
          if (s.sceneDescription) parts.push(s.sceneDescription);
          return parts.join('，');
        }).filter(Boolean);
        const context = contextTexts.join('；').substring(0, 300) || loc;

        let sceneDesc = '';
        let stylePrompt = `8K画质，电影级广角摄影，${loc}，超写实风格`;
        try {
          const sp = `你是场景设计师。根据场景名和上下文，为场景生成中文环境描述（30-60字）和图片提示词（50-100字）。只输出JSON：{"description":"...","stylePrompt":"..."}`;
          const up = `场景名：${loc}\n上下文：${context}`;
          const r = await callLLM(sp, up, { temperature: 0.7, maxTokens: 600, responseFormat: 'json' });
          const parsed = JSON.parse(r);
          if (parsed.description) sceneDesc = parsed.description.substring(0, 200);
          if (parsed.stylePrompt) stylePrompt = parsed.stylePrompt.substring(0, 500);
        } catch (e) {
          sceneDesc = context ? context.substring(0, 200) : loc;
        }

        const created = await SceneAsset.create({
          projectId, sceneName: loc,
          description: sceneDesc,
          stylePrompt,
        });
        result.scenes.push({ _id: created._id, sceneName: loc });
      } else {
        result.scenes.push({ _id: exists._id, sceneName: loc, existed: true });
      }
    }

    // 3. 提取道具：从场景描述中检测常见道具关键词
    const propKeywords = [
      '手机', '电话', '电脑', '笔记本', '书', '报纸', '杂志',
      '杯子', '咖啡', '茶', '酒', '酒杯', '水', '饮料',
      '刀', '剑', '枪', '武器', '棍', '棒',
      '钥匙', '钱包', '包', '行李', '箱子',
      '花', '玫瑰', '戒指', '项链', '礼物', '盒子',
      '照片', '相框', '画', '镜子',
      '车', '汽车', '自行车', '摩托车',
      '桌子', '椅子', '沙发', '床', '灯', '窗帘', '门', '窗户',
      '笔', '纸', '文件', '合同', '证件', '身份证',
      '药', '药瓶', '针', '绷带', '纱布',
      '伞', '雨伞', '眼镜', '墨镜', '手表', '围巾', '帽子',
      '信', '信封', '卡片', '纸条',
      '食物', '饭菜', '面包', '蛋糕',
    ];

    const allText = script.scenes.map(s =>
      (s.sceneDescription || '') + ' ' +
      (s.dialogues || []).map(d => (d.text || '') + ' ' + (d.actionHint || '')).join(' ')
    ).join(' ');

    const foundProps = new Set();
    propKeywords.forEach(kw => {
      if (allText.includes(kw)) foundProps.add(kw);
    });

    // 也扫描台词中的道具提示
    script.scenes.forEach(s => {
      (s.dialogues || []).forEach(d => {
        const hint = d.actionHint || '';
        // 匹配 "拿出X" "放下X" "递给X" 等中的 X
        const actionMatch = hint.match(/(?:拿出|放下|递给|举起|打开|关上|拿起|握着|掏出)([一-龥]+)/);
        if (actionMatch && actionMatch[1].length <= 4) foundProps.add(actionMatch[1]);
      });
    });

    for (const propName of foundProps) {
      const exists = await Prop.findOne({ projectId, propName });
      if (!exists) {
        const { callLLM } = require('../utils/llm-client');
        let propDesc = '';
        let propCat = '';
        try {
          const sp = `你是道具设计师。根据道具名推测类别和外观。只输出JSON：{"description":"一句话外观描述（15-30字）","category":"类别（武器/饰品/书籍/食物/药品/工具/衣物/电子/其他）"}`;
          const up = `道具名：${propName}`;
          const r = await callLLM(sp, up, { temperature: 0.5, maxTokens: 200, responseFormat: 'json' });
          const parsed = JSON.parse(r);
          if (parsed.description) propDesc = parsed.description.substring(0, 100);
          if (parsed.category) propCat = parsed.category;
        } catch (e) { /* use empty defaults */ }

        const created = await Prop.create({
          projectId, propName,
          description: propDesc,
          category: propCat,
        });
        result.props.push({ _id: created._id, propName });
      } else {
        result.props.push({ _id: exists._id, propName, existed: true });
      }
    }

    const totalNew = ['characters', 'scenes', 'props'].reduce((sum, k) =>
      sum + result[k].filter(i => !i.existed).length, 0);
    const totalExist = ['characters', 'scenes', 'props'].reduce((sum, k) =>
      sum + result[k].filter(i => i.existed).length, 0);

    res.json({
      message: `提取完成：新增 ${totalNew} 项，已存在 ${totalExist} 项`,
      data: result,
    });
  } catch (error) { next(error); }
});

// ===== AI 生成提示词 =====
router.post('/generate-prompt', aiGeneratePromptLimiter, async (req, res, next) => {
  try {
    await appConfig.loadUserConfig(req.user._id);
    const { projectId, assetId, assetType, existingPrompt } = req.body;
    if (!assetId || !assetType) {
      return res.status(400).json({ message: '缺少参数: assetId, assetType' });
    }

    const { callLLM } = require('../utils/llm-client');
    let asset;

    if (assetType === 'character') {
      asset = await Character.findById(assetId);
      if (!asset) return res.status(404).json({ message: '角色不存在' });
      const morphPrompt = asset.morphs?.[0]?.appearancePrompt || '';
      const basePrompt = existingPrompt || morphPrompt || '';
      const hasRefImage = !!(asset.morphs?.[0]?.referenceImage || asset.referenceImage);

      // 读取项目画质关键词
      let styleQ = '8K画质，超写实，电影级摄影，电影级画质';
      try {
        const Project = require('../models/project.model');
        const proj = await Project.findById(asset.projectId || projectId);
        if (proj?.directorSettings?.qualityKeywords) styleQ = proj.directorSettings.qualityKeywords;
      } catch (e) { /* ignore */ }

      // 提取角色变量
      const vars = {
        age: asset.age || '?',
        gender: asset.gender || '其他',
        height: asset.appearance?.match(/身高(\d+)/)?.[1] || '?',
        personality: asset.personality || asset.roleType || '',
        outfit: asset.appearance?.match(/身穿[^，。；]+/)?.[0] || (asset.appearance || ''),
        name: asset.name || '',
        roleType: asset.roleType || '',
      };

      // 通用三视图模板（有参考图时追加参考图优先约束）
      const refConstraint = hasRefImage
        ? '【参考图优先】以上传的参考图为唯一标准，100%继承原图的面部特征、五官细节、脸型、肤色、发型、神态，禁止修改面部，禁止添加任何参考图中不存在的眼镜、帽子、饰品；'
        : '';

      const systemPrompt = `你是AI绘图提示词专家。根据角色信息生成横屏四格角色设定卡中文提示词。必须严格填充下方模板的所有变量，用角色实际信息替换{{...}}占位符。只输出完整提示词文本，不要JSON，不要保留{{}}占位符。

模板：
【强约束】画面中严禁出现任何文字、字母、乱码、logo、水印、标题、字幕、签名、符号、海报元素、排版文字，仅保留角色与背景，纯画面，无任何额外元素
${refConstraint}【画质/风格】${styleQ}，角色设定卡风格，纯白色背景，工作室柔光，85mm镜头无畸变；
【角色设定】${vars.age}岁${vars.gender}，身高${vars.height}cm，${vars.personality || '根据角色信息推断'}/${vars.roleType}；
【服装配饰】根据角色信息描述服装和配饰，无任何参考图中不存在的额外配饰；
【画面布局—4格角色设定卡】左区（占画面约35%宽度）：角色头部到胸部近景特写，脸部占左区70%面积，五官纹理清晰，中性表情，发丝细节丰富；右区（占画面约65%宽度）：横排三等分——正视图/左侧视图/后视图，三个视图角色高度统一为画面高度的75%，从头到脚完整可见；
【一致性约束】特写与三视图为同一角色，五官、发型、服装、体态100%一致；
【禁止项】纯白色背景，无阴影，角色直立无动作，双手自然垂放空手，中性表情，不戴墨镜/帽子等额外配饰，不露腿，服装完整无破损，平视正面光。`;

      const userPrompt = `角色信息：
名称：${asset.name}
年龄：${asset.age}岁
性别：${asset.gender}
身份：${asset.roleType}
外貌：${asset.appearance || '未填写'}
性格：${asset.personality || '未填写'}
${hasRefImage ? '⚠️ 该角色已上传参考图，必须100%继承参考图的面部特征、五官、脸型、肤色、发型、神态，严禁修改面部。' : ''}

当前提示词：${basePrompt || '无'}

请按模板生成完整的横屏四格角色设定卡提示词，用角色实际信息替换所有占位符。`;
      const prompt = await callLLM(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 3000 });
      return res.json({ data: { prompt: prompt.trim() } });
    }

    if (assetType === 'scene') {
      asset = await SceneAsset.findById(assetId);
      if (!asset) return res.status(404).json({ message: '场景不存在' });
      const basePrompt = existingPrompt || asset.stylePrompt || asset.description || '';
      const ds2 = await readDirectorSettings(asset.projectId || projectId);
      const styleQ = ds2.qualityKeywords || '8K画质，电影级广角';
      const styleA = ds2.artStyleCommands ? '，' + ds2.artStyleCommands : '';
      const systemPrompt = `你是AI绘图提示词润色专家。在现有场景提示词基础上润色优化：补充环境细节、灯光氛围、构图视角，保持${styleQ}${styleA}风格。必须使用中文。只输出完整的提示词文本。`;
      const userPrompt = `场景：${asset.sceneName}。${asset.description ? '描述：' + asset.description + '。' : ''}
当前提示词：${basePrompt}
请润色优化，使场景描述更生动具体。`;
      const prompt = await callLLM(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000 });
      return res.json({ data: { prompt: prompt.trim() } });
    }

    if (assetType === 'video') {
      const ds3 = await readDirectorSettings(projectId);
      const styleQ = ds3.qualityKeywords || '电影级画质，8K高清';
      const styleA = ds3.artStyleCommands ? '，' + ds3.artStyleCommands : '';
      const systemPrompt = `你是AI视频提示词专家。根据基础描述生成短视频的动态提示词：包含运镜方式（推/拉/摇/移/跟）、画面变化节奏、光影过渡、适合短视频平台（竖屏9:16）。画质风格：${styleQ}${styleA}。必须使用中文。只输出提示词文本。`;
      const userPrompt = existingPrompt || '请生成一段短视频的动态描述';
      const prompt = await callLLM(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000 });
      return res.json({ data: { prompt: prompt.trim() } });
    }

    if (assetType === 'prop') {
      asset = await Prop.findById(assetId);
      if (!asset) return res.status(404).json({ message: '道具不存在' });
      const basePrompt = existingPrompt || asset.description || '';
      const ds4 = await readDirectorSettings(asset.projectId || projectId);
      const styleQ = ds4.qualityKeywords || '8K画质，产品摄影';
      const styleA = ds4.artStyleCommands ? '，' + ds4.artStyleCommands : '';
      const systemPrompt = `你是AI绘图提示词润色专家。在现有道具提示词基础上润色优化：补充材质、纹理、光影细节，保持${styleQ}${styleA}白底产品摄影风格。必须使用中文。只输出完整的提示词文本。`;
      const userPrompt = `道具：${asset.propName}。${asset.description ? '描述：' + asset.description + '。' : ''}
当前提示词：${basePrompt}
请润色优化，使道具描述更精细。`;
      const prompt = await callLLM(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000 });
      return res.json({ data: { prompt: prompt.trim() } });
    }

    // director / storyboard 等通用类型：直接透传 prompt 给 LLM
    if (assetType === 'director' || assetType === 'storyboard' || assetType === 'video') {
      console.log('[generate-prompt] type=' + assetType + ', promptLen:', (existingPrompt || '').length);
      const prompt = await callLLM('你是一个有帮助的AI助手。只输出请求的内容，不要额外解释。', existingPrompt || '', { temperature: 0.7, maxTokens: 2000 });
      return res.json({ data: { prompt: (prompt || '').trim() } });
    }

    res.status(400).json({ message: '未知资产类型: ' + assetType });
  } catch (error) { next(error); }
});

// ===== 图片/视频生成 =====
router.post('/generate-image', aiGenerateImageLimiter, async (req, res, next) => {
  try {
    await appConfig.loadUserConfig(req.user._id);
    const { projectId, assetId, assetType, prompt, model, referenceImages, inputImage } = req.body;
    if (!prompt) return res.status(400).json({ message: '缺少提示词' });

    // 防御清洗：referenceImages 可能为对象数组 [{name,url}] 或字符串数组
    const rawRefs = Array.isArray(referenceImages) ? referenceImages : [];
    const cleanRefs = rawRefs.map(r => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object' && r.url) return r.url;
      return '';
    }).filter(url => {
      // 过滤空字符串 / data: base64 URI（Seedance 无法下载 base64）
      if (!url || url.startsWith('data:')) return false;
      return true;
    });

    // 将相对路径解析为公网可访问的完整 URL
    const resolvedRefs = storageService.resolvePublicUrls(cleanRefs);
    const resolvedInput = storageService.resolvePublicUrl(inputImage || '');

    const { callImageGen, callVideoGen } = require('../utils/llm-client');

    // 读取比例：优先请求参数，fallback 项目配置，最后默认 9:16
    let ratio = req.body.ratio || '9:16';
    if (!req.body.ratio && projectId) {
      const Project = require('../models/project.model');
      const proj = await Project.findById(projectId);
      ratio = proj?.videoConfig?.aspectRatio || '9:16';
    }

    // ===== 视频生成（走 Seedance 接口） =====
    if (assetType === 'video') {
      let provider = 'wan27';
      if (model === 'doubao_video') provider = 'doubao';
      else if (model === 'doubao_video_fast') provider = 'doubao_fast';
      else if (model === 'jimeng_video') provider = 'jimeng';

      let videoModel;
      if (provider === 'doubao') videoModel = appConfig.llm.doubao.model || 'doubao-seedance-2-0-260128';
      else if (provider === 'doubao_fast') videoModel = 'doubao-seedance-2-0-fast-260128';
      else videoModel = undefined;

      // 合并前端传来的参考图列表 + 主图(inputImage)，去重
      // 只有用户明确选了参考图时才把主图也加入，避免无意中触发 Seedance 人脸审核
      const refs = [...resolvedRefs];
      if (resolvedInput && resolvedRefs.length > 0 && !refs.includes(resolvedInput)) refs.push(resolvedInput);
      console.log(`[video-gen] 参考图数量: ${refs.length}`, refs.map((u, i) => `[${i + 1}] ${u.substring(0, 100)}`));

      // 风格化模式：写实风格注入样铅艺术插画提示词（动漫风格跳过）
      let videoPrompt = prompt;
      try {
        const Settings = require('../models/settings.model');
        const settings = await Settings.getSettings(req.user._id);
        if (settings.aiConfig?.characterStyleMode && projectId) {
          const Project = require('../models/project.model');
          const proj = await Project.findById(projectId);
          const vs = proj?.videoConfig?.visualStyle || '写实';
          if (vs !== '动漫') {
            videoPrompt = `【${STYLE_TEXT_VIDEO}】 ` + prompt;
            console.log('[video-gen] 风格化模式：已注入写实质感提示词');
          }
        }
      } catch (e) { /* ignore */ }
      // 检测 localhost/内网 URL，提前警告
      if (refs.some(u => u.includes('localhost') || u.includes('127.0.0.1') || (u.startsWith('/uploads/') && !u.includes('://')))) {
        console.warn('[video-gen] ⚠️ 参考图中含本地路径！Seedance 服务器无法访问 localhost。请设置 PUBLIC_URL 环境变量，或启用对象存储。');
      }

      const videoUrl = await callVideoGen(videoPrompt, {
        provider,
        model: videoModel,
        ratio,
        duration: req.body.duration || 5,
        resolution: req.body.resolution || '720p',
        referenceImages: refs,
        watermark: req.body.watermark !== undefined ? req.body.watermark : false,
        generateAudio: req.body.generateAudio || false,
        safetyId: projectId ? String(projectId).substring(0, 16) : 'autodrama_user',
      });
      console.log(`[video-gen] 任务ID: ${videoUrl}`);
      return res.json({ data: { imageUrl: videoUrl } });
    }

    // ===== 图片生成 =====
    let provider = 'wan27';
    if (model === 'doubao_image' || model === 'doubao_image_4k') provider = 'doubao';
    else if (model === 'jimeng' || model === 'jimeng_4k') provider = 'jimeng';
    else if (model === 'openai_image' || model?.includes('dall-e') || model?.includes('gpt-image')) provider = 'openai';

    const sizeMap = { '9:16': '1280x2880', '16:9': '2880x1280', '4:3': '1920x1920', '3:4': '1440x2560' };
    let size = sizeMap[ratio] || '1280x2880';
    if (model === 'doubao_image_4k' || model === 'jimeng_4k') size = '1920x2880';

    // 从运行时配置读取用户设置的生图模型
    const llmCfg = appConfig.llm[provider] || {};
    const imageModel = llmCfg.imageModel
      || (provider === 'openai' ? 'gpt-image-2' : null)
      || llmCfg.model
      || 'doubao-seedream-4-5-251128';
    console.log(`[generate-image] provider=${provider}, model=${imageModel}`);
    const genParams = { provider, size, model: imageModel };
    if (resolvedRefs && resolvedRefs.length > 0) genParams.referenceImages = resolvedRefs;
    if (resolvedInput) genParams.inputImage = resolvedInput;

    // 读取 AI 生成配置
    let finalPrompt = prompt;
    try {
      const Settings = require('../models/settings.model');
      const settings = await Settings.getSettings(req.user._id);
      if (settings.aiConfig?.noTextWatermark !== false) {
        genParams.watermark = false;
      }
      // 风格化模式：写实风格注入样铅艺术插画提示词（动漫风格跳过）
      if (settings.aiConfig?.characterStyleMode && projectId) {
        const Project = require('../models/project.model');
        const proj = await Project.findById(projectId);
        const vs = proj?.videoConfig?.visualStyle || '写实';
        if (vs !== '动漫') {
          finalPrompt = `【${STYLE_TEXT_IMAGE}】 ` + prompt;
          console.log('[generate-image] 风格化模式：已注入彩铅艺术提示词');
        }
      }
    } catch (e) { /* ignore, keep default */ }

    const remoteUrl = await callImageGen(finalPrompt, genParams);

    // 通过存储服务持久化（本地模式 / 对象存储模式）
    let imageUrl = remoteUrl;
    const catMap = { character: 'characters', scene: 'scenes', prop: 'props' };
    const category = catMap[assetType] || 'storyboard';
    // 按用户 ID 分目录：autodrama/uploads/US-XXXX/characters/...
    const userDir = (req.user?.uid || req.user?._id?.toString()?.substring(0,8) || 'anonymous');
    const userCategory = path.posix.join(userDir, category);
    const filename = `gen-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;

    if (remoteUrl && !remoteUrl.startsWith('/uploads/')) {
      try {
        // 判断是 base64 数据还是远程 URL
        const isBase64 = remoteUrl.startsWith('data:') || !remoteUrl.startsWith('http');
        if (isBase64) {
          let buf, ext = 'png';
          if (remoteUrl.startsWith('data:')) {
            const [meta, b64] = remoteUrl.split(',');
            const mimeMatch = meta.match(/data:(image\/\w+);/);
            if (mimeMatch) ext = mimeMatch[1].split('/')[1];
            buf = Buffer.from(b64, 'base64');
          } else {
            // 原始 base64（无 data: 前缀）
            buf = Buffer.from(remoteUrl, 'base64');
          }
          const finalFilename = filename.replace('.png', `.${ext}`);
          imageUrl = await storageService.upload(buf, finalFilename, userCategory);
          console.log(`[generate-image] base64 存储完成 (${(buf.length/1024).toFixed(1)}KB): ${imageUrl}`);
        } else {
          imageUrl = await storageService.uploadFromUrl(remoteUrl, filename, userCategory);
          const mode = imageUrl.startsWith('https://') || imageUrl.startsWith('http://') ? '云端 ☁️' : '本地 💾';
          console.log(`[generate-image] 存储完成 [${mode}]: ${remoteUrl.substring(0,40)}... → ${imageUrl}`);
        }
      } catch (e) { console.warn('[generate-image] 存储失败，使用原始URL:', e.message); }
    }

    // 更新资产图片
    if (assetType === 'character' && assetId) {
      const character = await Character.findById(assetId);
      if (character) {
        if (!character.morphs || character.morphs.length === 0) {
          character.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
        }
        character.morphs[0].generatedImages.front = imageUrl;
        character.morphs[0].appearancePrompt = prompt;
        await character.save();
      }
    } else if (assetType === 'scene' && assetId) {
      await SceneAsset.findByIdAndUpdate(assetId, { generatedImage: imageUrl, stylePrompt: prompt });
    } else if (assetType === 'prop' && assetId) {
      await Prop.findByIdAndUpdate(assetId, { generatedImage: imageUrl });
    }

    res.json({ data: { imageUrl } });
  } catch (error) { next(error); }
});

// ===== 视频任务轮询 + 下载到存储 =====
router.get('/video-task/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { provider = 'doubao' } = req.query;
    const { callVideoTaskQuery } = require('../utils/llm-client');

    const result = await callVideoTaskQuery(taskId, { provider });
    const { status, videoUrl } = result;

    // 任务还在进行中 — 透传 Seedance 真实状态
    if ((status === 'running' || status === 'pending' || status === 'queued' || status === 'processing' || status === 'submitted') && !videoUrl) {
      const createdAt = result.created_at ? new Date(result.created_at * 1000).toISOString() : null;
      return res.json({ data: { status, createdAt, taskId } });
    }

    // 失败 — 透传 Seedance 原始错误消息
    if ((status === 'failed' || status === 'error' || status === 'expired' || status === 'cancelled') && !videoUrl) {
      let errMsg = (result.raw && (result.raw.error && result.raw.error.message || result.raw.message)) || '';
      if (!errMsg && result.raw && result.raw.data && result.raw.data.error) errMsg = result.raw.data.error.message || '';
      return res.json({ data: { status, taskId, message: errMsg || `任务${status}：Seedance 未返回具体原因` } });
    }

    // 成功 — 下载视频并上传到对象存储
    if (videoUrl) {
      const axios = require('axios');
      const filename = `video-${Date.now()}-${Math.random().toString(36).slice(2,8)}.mp4`;
      console.log(`[video-task] 下载视频: ${videoUrl.substring(0, 80)}...`);
      const resp = await axios({ url: videoUrl, method: 'GET', responseType: 'arraybuffer', timeout: 120000 });
      const storedUrl = await storageService.upload(Buffer.from(resp.data), filename, (req.user?.uid || 'anonymous') + '/videos');
      console.log(`[video-task] 已存储: ${storedUrl}`);
      return res.json({ data: { status: 'completed', videoUrl: storedUrl } });
    }

    res.json({ data: { status: status || 'unknown' } });
  } catch (e) { next(e); }
});

// ===== 批量查询视频任务（用于恢复） =====
router.post('/video-tasks/recover', async (req, res, next) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: '请提供 taskIds 数组' });
    }
    if (taskIds.length > 20) return res.status(400).json({ message: '每次最多恢复20个任务' });
    const { callVideoTaskQuery } = require('../utils/llm-client');
    const axios = require('axios');

    const results = [];
    for (const taskId of taskIds) {
      try {
        const result = await callVideoTaskQuery(taskId, { provider: 'doubao' });
        if (result.videoUrl) {
          // 下载视频并上传到存储
          const filename = `video-${Date.now()}-${Math.random().toString(36).slice(2,8)}.mp4`;
          console.log(`[video-recover] 下载视频: ${result.videoUrl.substring(0, 80)}...`);
          const resp = await axios({ url: result.videoUrl, method: 'GET', responseType: 'arraybuffer', timeout: 120000 });
          const storedUrl = await storageService.upload(Buffer.from(resp.data), filename, (req.user?.uid || 'anonymous') + '/videos');
          results.push({ taskId, status: 'completed', videoUrl: storedUrl });
        } else {
          results.push({ taskId, status: result.status });
        }
      } catch (e) {
        results.push({ taskId, status: 'error', message: e.message });
      }
    }
    res.json({ data: results });
  } catch (e) { next(e); }
});

// ===== 批量迁移已有远程图片到本地 =====
router.post('/migrate-images', async (req, res, next) => {
  try {
    let total = 0, downloaded = 0, skipped = 0;

    async function migrateField(model, id, field, subField) {
      const doc = await model.findById(id);
      if (!doc) return;
      let url = subField ? (doc[field]?.[subField] || '') : (doc[field] || '');
      if (!url || url.startsWith('/uploads/') || url.startsWith('data:')) return;
      total++;
      try {
        const filename = `migrate-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
        const newUrl = await storageService.uploadFromUrl(url, filename);
        if (subField) { doc[field][subField] = newUrl; } else { doc[field] = newUrl; }
        await doc.save();
        downloaded++;
        console.log(`[migrate] ${model.modelName}:${id} → ${newUrl}`);
      } catch (e) { skipped++; console.warn(`[migrate] skip ${url.substring(0,40)}: ${e.message}`); }
    }

    // 角色
    const Character = require('../models/character.model');
    const chars = await Character.find();
    for (const c of chars) {
      if (c.referenceImage) await migrateField(Character, c._id, 'referenceImage');
      if (c.generatedImage) await migrateField(Character, c._id, 'generatedImage');
      if (c.morphs?.length) {
        for (let i = 0; i < c.morphs.length; i++) {
          if (c.morphs[i].referenceImage) c.referenceImage = c.morphs[i].referenceImage; // copy to top level for migration
          // Also migrate morphs directly
          if (c.morphs[i].generatedImages?.front) {
            const url = c.morphs[i].generatedImages.front;
            if (url && !url.startsWith('/uploads/') && !url.startsWith('data:')) {
              total++;
              try {
                const filename = `migrate-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
                c.morphs[i].generatedImages.front = await storageService.uploadFromUrl(url, filename);
                await c.save();
                downloaded++;
              } catch (e) { skipped++; }
            }
          }
        }
      }
    }

    // 场景
    const SceneAsset = require('../models/scene.model');
    const scenes = await SceneAsset.find();
    for (const s of scenes) {
      await migrateField(SceneAsset, s._id, 'generatedImage');
      await migrateField(SceneAsset, s._id, 'referenceImage');
    }

    // 道具
    const Prop = require('../models/prop.model');
    const props = await Prop.find();
    for (const p of props) {
      await migrateField(Prop, p._id, 'generatedImage');
      await migrateField(Prop, p._id, 'referenceImage');
    }

    // 故事板镜头
    const Storyboard = require('../models/storyboard.model');
    const sbs = await Storyboard.find();
    for (const sb of sbs) {
      for (const shot of sb.shots || []) {
        if (shot.renderedImage && !shot.renderedImage.startsWith('/uploads/') && !shot.renderedImage.startsWith('data:')) {
          total++;
          try {
            const filename = `migrate-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
            shot.renderedImage = await storageService.uploadFromUrl(shot.renderedImage, filename);
            downloaded++;
          } catch (e) { skipped++; }
        }
      }
      await sb.save();
    }

    res.json({ message: `迁移完成：总计 ${total} 个远程URL，下载 ${downloaded} 个，跳过 ${skipped} 个`, data: { total, downloaded, skipped } });
  } catch (error) { next(error); }
});

// ===== 下载远程图片到本地 =====
router.post('/download-image', async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: '缺少 imageUrl' });

    // 防御 SSRF：只允许 HTTPS URL，阻止内网/本地地址
    let url;
    try { url = new URL(imageUrl); } catch { return res.status(400).json({ message: '无效的 URL' }); }
    if (url.protocol !== 'https:') return res.status(400).json({ message: '仅支持 HTTPS 链接' });
    const hostname = url.hostname;
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]',
      '169.254.169.254', 'metadata.google.internal'];
    if (blocked.includes(hostname) || hostname.match(/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/)) {
      return res.status(400).json({ message: '不允许访问内网地址' });
    }

    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = '.png';
    const filename = `ref-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    const response = await axios({ url: imageUrl, method: 'GET', responseType: 'stream', timeout: 30000 });
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

    const localUrl = `/uploads/${filename}`;
    console.log(`[download-image] 已下载: ${imageUrl.substring(0,60)}... → ${localUrl}`);
    res.json({ data: { localUrl } });
  } catch (error) { next(error); }
});

// ===== 上传参考图（简化版，存URL） =====
router.post('/upload-reference', async (req, res, next) => {
  try {
    const { imageUrl, assetId } = req.body;
    if (!imageUrl) return res.status(400).json({ message: '缺少图片URL' });

    if (assetId) {
      // 尝试更新角色参考图
      const character = await Character.findById(assetId);
      if (character) {
        if (!character.morphs || character.morphs.length === 0) {
          character.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
        }
        character.morphs[0].referenceImage = imageUrl;
        await character.save();
      }
    }

    res.json({ data: { url: imageUrl } });
  } catch (error) { next(error); }
});

// ===== 上传参考图文件（multipart，存服务器本地） =====
router.post('/upload-reference-file', refUpload.array('images', 9), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: '请选择至少一张图片' });
    }
    const urls = req.files.map(f => `/uploads/references/${f.filename}`);
    res.json({ data: { urls } });
  } catch (error) { next(error); }
});

// ===== 删除参考图文件 =====
router.delete('/reference-file/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    // 防止目录穿越
    if (!/^ref-[\w-]+\.(png|jpe?g|webp|gif)$/i.test(filename)) {
      return res.status(400).json({ message: '无效的文件名' });
    }
    const filepath = path.join(refUploadsDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`[reference-file] 已删除: ${filename}`);
    }
    res.json({ data: { ok: true } });
  } catch (error) { next(error); }
});

module.exports = router;
