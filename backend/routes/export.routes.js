const express = require('express');
const router = express.Router();
const Script = require('../models/script.model');
const Project = require('../models/project.model');
const Storyboard = require('../models/storyboard.model');
const { authRequired } = require('../middleware/auth.middleware');
router.use(authRequired);

router.post('/', async (req, res, next) => {
  try {
    const { projectId, episodeIds, types, format } = req.body;
    if (!projectId || !types || types.length === 0) return res.status(400).json({ message: '缺少参数' });

    const project = await Project.findById(projectId);
    const projectName = project?.name || '未命名项目';
    const dateStr = new Date().toLocaleDateString('zh-CN');
    const fmt = format || 'pdf';
    const epLabel = episodeIds?.length ? `${episodeIds.length}集` : '全部';
    const filename = `${projectName}_${types.join('+')}_${epLabel}_${dateStr}`;

    let scripts;
    if (episodeIds && episodeIds.length > 0) {
      scripts = await Script.find({ _id: { $in: episodeIds } }).sort({ episodeNumber: 1 });
    } else {
      scripts = await Script.find({ projectId }).sort({ episodeNumber: 1 });
    }

    const videoConfig = project?.videoConfig || {};
    const directorSettings = project?.directorSettings || {};

    // storyboard 去重
    const storyboards = (episodeIds && episodeIds.length > 0)
      ? await Storyboard.find({ projectId, scriptId: { $in: episodeIds } })
      : await Storyboard.find({ projectId });
    const sbs = [];
    const seenScriptIds = new Set();
    for (const sb of storyboards.sort((a,b) => b.createdAt - a.createdAt)) {
      const sid = sb.scriptId.toString();
      if (!seenScriptIds.has(sid)) { seenScriptIds.add(sid); sbs.push(sb); }
    }

    if (fmt === 'pdf') {
      const html = buildHTML(projectName, dateStr, scripts, sbs, types, videoConfig, directorSettings);
      return res.json({ html, filename });
    }
    if (fmt === 'markdown') {
      const content = buildMarkdown(projectName, dateStr, scripts, sbs, types, videoConfig, directorSettings);
      return res.json({ content, filename });
    }
    if (fmt === 'csv') {
      const content = buildCSV(projectName, scripts, sbs, types, videoConfig, directorSettings);
      return res.json({ content, filename });
    }
    if (fmt === 'word') {
      const content = buildWord(projectName, dateStr, scripts, sbs, types, videoConfig, directorSettings);
      return res.json({ content, filename });
    }
    if (fmt === 'json') {
      const content = buildJSON(projectName, dateStr, scripts, sbs, types, videoConfig, directorSettings);
      return res.json({ content: JSON.stringify(content, null, 2), filename });
    }
    if (fmt === 'html' || fmt === 'png') {
      const html = buildHTML(projectName, dateStr, scripts, sbs, types, videoConfig, directorSettings);
      return res.json({ html, filename });
    }
    res.status(400).json({ message: '不支持的格式' });
  } catch (error) { next(error); }
});

function css() {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Serif SC', Georgia, serif;
  max-width: 820px; margin: 0 auto; padding: 32px 28px 40px;
  color: #2D2318;
  background: linear-gradient(180deg, #FBF7F0 0%, #FFFDF9 30%, #FBF7F0 100%);
  min-height: 100vh;
}
/* ---- Page header ---- */
.page-header {
  text-align: center; padding: 28px 20px 22px; margin-bottom: 28px;
  border-bottom: 2px solid #C9A84C;
  background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%);
  position: relative;
}
.page-header::after {
  content: ''; position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);
  width: 80px; height: 3px; background: linear-gradient(90deg, transparent, #C9A84C, transparent);
}
.page-header h1 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 26px; font-weight: 700; color: #1A1A2E;
  letter-spacing: 3px; text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(201,168,76,0.15);
}
.page-header .sub {
  margin-top: 6px; font-size: 13px; color: #8B7355; letter-spacing: 1.5px;
}
/* ---- Section headings ---- */
h2 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 18px; font-weight: 700; color: #1A1A2E;
  margin: 32px 0 16px; padding-bottom: 8px;
  border-bottom: 1.5px solid rgba(201,168,76,0.35);
  letter-spacing: 2px;
  display: flex; align-items: center; gap: 8px;
}
h2::before {
  content: ''; display: inline-block; width: 4px; height: 20px;
  background: linear-gradient(180deg, #C9A84C, #8B6914);
  border-radius: 2px;
}
h3 {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 15px; font-weight: 700; color: #8B6914;
  margin: 20px 0 10px; letter-spacing: 1px;
}
h3::before { content: '▸ '; color: #C9A84C; }
/* ---- Cards ---- */
.card {
  border: 1px solid rgba(201,168,76,0.18);
  border-radius: 10px; padding: 16px 18px; margin: 10px 0;
  background: linear-gradient(135deg, rgba(255,253,249,0.9) 0%, rgba(251,247,240,0.85) 100%);
  box-shadow: 0 2px 12px rgba(139,105,20,0.06);
  position: relative; overflow: hidden;
  transition: all 0.2s;
}
.card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px; background: linear-gradient(180deg, #C9A84C, rgba(201,168,76,0.2));
  border-radius: 3px 0 0 3px;
}
/* ---- Tags ---- */
.tag {
  display: inline-block;
  background: linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.06) 100%);
  color: #8B6914; padding: 2px 10px; border-radius: 4px;
  font-size: 11px; font-weight: 600; letter-spacing: 1px;
  border: 1px solid rgba(201,168,76,0.25);
  margin-right: 4px;
}
.tag-dur {
  background: linear-gradient(135deg, rgba(26,26,46,0.08) 0%, rgba(26,26,46,0.03) 100%);
  color: #1A1A2E; border-color: rgba(26,26,46,0.15);
}
/* ---- Shot header ---- */
.shot-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
  flex-wrap: wrap;
}
.shot-num {
  font-size: 14px; font-weight: 800; color: #1A1A2E;
  letter-spacing: 0.5px; margin-right: 6px;
}
/* ---- Info rows ---- */
.info-row {
  font-size: 13px; color: #6B5E47; line-height: 1.8;
  padding-left: 2px;
}
.info-row strong { color: #8B6914; font-weight: 600; }
.info-label {
  display: inline-block; min-width: 52px; color: #8B7355;
  font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
}
/* ---- Dialogue ---- */
.dialogue-block {
  margin: 6px 0 2px 12px; padding: 8px 14px;
  background: rgba(201,168,76,0.05);
  border-left: 2px solid rgba(201,168,76,0.3);
  border-radius: 0 6px 6px 0;
  font-size: 13px; line-height: 1.7;
}
.dialogue-block .char {
  color: #1A1A2E; font-weight: 700; font-size: 12px;
}
.dialogue-block .line { color: #4A3F2E; margin-top: 2px; }
.dialogue-block .hints {
  margin-top: 3px; font-size: 11px; color: #8B7355;
  display: flex; gap: 10px; flex-wrap: wrap;
}
/* ---- Prompt blocks (storyboard export) ---- */
.prompt-block {
  margin: 8px 0; padding: 10px 14px;
  background: rgba(26,26,46,0.03);
  border: 1px solid rgba(26,26,46,0.08);
  border-radius: 6px; font-size: 12px; line-height: 1.6;
}
.prompt-block strong {
  display: block; margin-bottom: 4px;
  font-size: 11px; color: #8B6914; letter-spacing: 1px;
}
.prompt-block pre {
  white-space: pre-wrap; font-family: 'Consolas', 'Courier New', monospace;
  color: #4A3F2E; font-size: 11px; line-height: 1.6;
}
/* ---- Status badge ---- */
.status-badge {
  display: inline-block; padding: 2px 10px; border-radius: 4px;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
}
.status-done { background: rgba(76,175,80,0.12); color: #2E7D32; }
.status-pending { background: rgba(201,168,76,0.12); color: #8B6914; }
.status-failed { background: rgba(229,57,53,0.08); color: #C62828; }
/* ---- Image / Video links ---- */
.media-link {
  display: inline-block; margin-right: 12px; font-size: 12px;
  color: #8B6914; text-decoration: none; font-weight: 600;
}
.media-link:hover { text-decoration: underline; }
/* ---- Empty state ---- */
.empty-hint {
  text-align: center; color: #8B7355; font-size: 13px;
  padding: 20px; font-style: italic; opacity: 0.6;
}
/* ---- Footer ---- */
.footer {
  text-align: center; color: #8B7355; font-size: 11px;
  margin-top: 40px; padding-top: 20px;
  border-top: 1px solid rgba(201,168,76,0.25);
  letter-spacing: 2px;
}
@media print {
  body { background: #fff; }
  .card { break-inside: avoid; }
  h2 { break-before: page; }
  h2:first-of-type { break-before: avoid; }
}
`.replace(/\n\s*/g, '').trim();
}

function findSB(scriptId, sbs) {
  return (sbs || []).find(sb => sb.scriptId && sb.scriptId.toString() === scriptId.toString());
}

// ===== Shot render helpers (Storyboard shot schema) =====

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function shotFields(s) {
  return {
    num: s.shotNumber || s.sceneNumber || 0,
    loc: s.location || s.sceneName || '',
    tod: s.timeOfDay || '',
    shotType: s.shotType || '中景',
    camMove: s.cameraMovement || '固定',
    dur: s.duration || 3,
    light: s.lighting || '',
    desc: s.imageDescription || s.sceneDescription || '',
    notes: s.notes || '',
    atmosphere: s.atmosphere || '',
    dialogues: s.dialogues || (s.dialogue ? [s.dialogue] : []),
    imgPrompt: s._imagePrompt || '',
    vidPrompt: s._videoPrompt || '',
    renderedImage: s.renderedImage || '',
    renderedVideo: s.renderedVideo || '',
    soundEffect: s.soundEffect || '',
    status: s.status || 'pending',
    characterEmotion: s.characterEmotion || '',
    composition: s.composition || '',
    cameraAngle: s.cameraAngle || '平视',
  };
}

function htmlShotCard(s) {
  const f = shotFields(s);
  let h = `<div class="card"><div class="shot-header"><span class="shot-num">镜号 ${f.num}</span><span class="tag">${esc(f.shotType)}</span><span class="tag">${esc(f.camMove)}</span><span class="tag tag-dur">${f.dur}s</span></div>`;
  h += '<div class="info-row">';
  if (f.loc || f.tod) h += `<span class="info-label">📍 场景</span> ${esc(f.loc)}${f.tod ? ' · ' + esc(f.tod) : ''}<br>`;
  if (f.light) h += `<span class="info-label">💡 光影</span> ${esc(f.light)}<br>`;
  if (f.atmosphere) h += `<span class="info-label">🌫 氛围</span> ${esc(f.atmosphere)}<br>`;
  if (f.characterEmotion) h += `<span class="info-label">🎭 情绪</span> ${esc(f.characterEmotion)}<br>`;
  if (f.composition) h += `<span class="info-label">📐 构图</span> ${esc(f.composition)}${f.cameraAngle ? ' · ' + esc(f.cameraAngle) : ''}<br>`;
  if (f.desc) h += `<span class="info-label">📝 描述</span> ${esc(f.desc)}<br>`;
  if (f.notes) h += `<span class="info-label">📌 备注</span> ${esc(f.notes)}<br>`;
  if (f.soundEffect) h += `<span class="info-label">🔊 音效</span> ${esc(f.soundEffect)}<br>`;
  h += '</div>';
  f.dialogues.forEach(d => {
    const name = d.characterName || '';
    const txt = d.text || '';
    let hints = '';
    if (d.actionHint) hints += `<span>🎭 ${esc(d.actionHint)}</span>`;
    if (d.cameraHint) hints += `<span>🎥 ${esc(d.cameraHint)}</span>`;
    if (d.innerThought) hints += `<span>💭 ${esc(d.innerThought)}</span>`;
    if (name || txt) h += `<div class="dialogue-block"><span class="char">${esc(name)}</span><div class="line">"${esc(txt)}"</div>${hints ? '<div class="hints">'+hints+'</div>' : ''}</div>`;
  });
  if (f.renderedImage) h += `<br><a class="media-link" href="${esc(f.renderedImage)}">🖼 查看生成图片</a>`;
  if (f.renderedVideo) h += `<a class="media-link" href="${esc(f.renderedVideo)}">🎥 查看生成视频</a>`;
  h += '</div>';
  return h;
}

function htmlShotCardFull(s) {
  const f = shotFields(s);
  let h = htmlShotCard(s).replace('</div>', '');
  const imgP = f.imgPrompt || '';
  const vidP = f.vidPrompt || '';
  if (imgP) h += `<div class="prompt-block"><strong>🖼 图片提示词</strong><pre>${esc(imgP)}</pre></div>`;
  if (vidP) h += `<div class="prompt-block"><strong>🎥 视频提示词</strong><pre>${esc(vidP)}</pre></div>`;
  h += `<span class="status-badge ${f.status === 'completed' ? 'status-done' : f.status === 'failed' ? 'status-failed' : 'status-pending'}">${f.status === 'completed' ? '✓ 已完成' : f.status === 'failed' ? '✗ 失败' : '○ 待处理'}</span>`;
  h += '</div>';
  return h;
}

function mdShotCard(s) {
  const f = shotFields(s);
  let m = `- **镜号${f.num}** | ${esc(f.shotType)} | ${esc(f.camMove)} | ${f.dur}s\n`;
  m += `  - 场景：${esc(f.loc)} | 时间：${esc(f.tod)}${f.light ? ` | 光影：${esc(f.light)}` : ''}${f.atmosphere ? ` | 氛围：${esc(f.atmosphere)}` : ''}\n`;
  if (f.characterEmotion) m += `  - 情绪：${esc(f.characterEmotion)}\n`;
  if (f.composition) m += `  - 构图：${esc(f.composition)} ${f.cameraAngle ? '· ' + esc(f.cameraAngle) : ''}\n`;
  if (f.desc) m += `  - 描述：${esc(f.desc)}\n`;
  if (f.notes) m += `  - 备注：${esc(f.notes)}\n`;
  if (f.soundEffect) m += `  - 音效：${esc(f.soundEffect)}\n`;
  f.dialogues.forEach(d => {
    const name = d.characterName || '';
    const txt = d.text || '';
    if (name || txt) m += `  - **${esc(name)}**："${esc(txt)}"${d.actionHint ? ` _(${esc(d.actionHint)})_` : ''}${d.cameraHint ? ` 【${esc(d.cameraHint)}】` : ''}${d.innerThought ? ` 💭 ${esc(d.innerThought)}` : ''}\n`;
  });
  if (f.renderedImage) m += `  - 🖼 图片：[${esc(f.renderedImage)}](${esc(f.renderedImage)})\n`;
  if (f.renderedVideo) m += `  - 🎥 视频：[${esc(f.renderedVideo)}](${esc(f.renderedVideo)})\n`;
  return m;
}

function mdShotCardFull(s) {
  const f = shotFields(s);
  let m = mdShotCard(s);
  if (f.imgPrompt) m += `\n  🖼 图片提示词：\n  \`\`\`\n  ${f.imgPrompt}\n  \`\`\`\n`;
  if (f.vidPrompt) m += `\n  🎥 视频提示词：\n  \`\`\`\n  ${f.vidPrompt}\n  \`\`\`\n`;
  m += `  - 状态：${f.status === 'completed' ? '完成' : f.status === 'failed' ? '失败' : '待处理'}\n`;
  return m;
}

// Legacy: scene-based render for "script" export type
function htmlSceneBlock(s) {
  let h = `<div class="card"><div class="shot-header"><span class="shot-num">场次 ${s.sceneNumber || ''}</span> <span class="tag">${esc(s.location||'')}</span> <span class="tag tag-dur">${esc(s.timeOfDay||'')}</span>${s.atmosphere ? ' <span class="tag">'+esc(s.atmosphere)+'</span>' : ''}</div>`;
  if (s.sceneDescription) h += `<div class="info-row"><span class="info-label">📝 描述</span> ${esc(s.sceneDescription)}</div>`;
  if (s.notes) h += `<div class="info-row"><span class="info-label">📌 备注</span> ${esc(s.notes)}</div>`;
  (s.dialogues || []).forEach(d => {
    let hints = '';
    if (d.actionHint) hints += `<span>🎭 ${esc(d.actionHint)}</span>`;
    if (d.cameraHint) hints += `<span>🎥 ${esc(d.cameraHint)}</span>`;
    if (d.innerThought) hints += `<span>💭 ${esc(d.innerThought)}</span>`;
    h += `<div class="dialogue-block"><span class="char">${esc(d.characterName||'')}</span><div class="line">"${esc(d.text||'')}"</div>${hints ? '<div class="hints">'+hints+'</div>' : ''}</div>`;
  });
  h += '</div>';
  return h;
}

function mdSceneBlock(s) {
  let m = `**场次${s.sceneNumber || ''}** — ${esc(s.location||'')} · ${esc(s.timeOfDay||'')}${s.atmosphere?'（'+esc(s.atmosphere)+'）':''}\n`;
  if (s.sceneDescription) m += `> 描述：${esc(s.sceneDescription)}\n`;
  if (s.notes) m += `> 备注：${esc(s.notes)}\n`;
  (s.dialogues || []).forEach(d => {
    m += `- **${esc(d.characterName||'')}**：${esc(d.text||'')} ${d.actionHint?`_(${esc(d.actionHint)})_`:''}${d.cameraHint?`\n  ↳ 镜头：${esc(d.cameraHint)}`:''}${d.innerThought?`\n  ↳ 内心：${esc(d.innerThought)}`:''}\n`;
  });
  m += '\n';
  return m;
}

// ========== HTML / Word ==========
function buildHTML(name, date, scripts, sbs, types, videoConfig, directorSettings) {
  let h = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(name)}</title><style>${css()}</style></head><body>`;
  h += `<div class="page-header"><h1>${esc(name)}</h1><div class="sub">StoryCine 全自动AI短剧生成平台 · 导出日期 ${date}</div></div>`;
  if (types.includes('script')) {
    h += '<h2>📝 剧本全文</h2>';
    scripts.forEach(ep => {
      h += `<h3>第${ep.episodeNumber}集 ${esc(ep.episodeTitle||'')}</h3>${ep.summary ? `<p style="color:#8B7355;font-size:13px;margin-bottom:10px;font-style:italic">${esc(ep.summary)}</p>` : ''}`;
      (ep.scenes || []).forEach(s => { h += htmlSceneBlock(s); });
    });
  }
  if (types.includes('shots')) {
    h += '<h2>🎬 分镜全文</h2>';
    scripts.forEach(ep => {
      h += `<h3>第${ep.episodeNumber}集</h3>`;
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots && sb.shots.length > 0) {
        sb.shots.forEach(s => { h += htmlShotCard(s); });
      } else {
        h += '<div class="empty-hint">暂无分镜数据，请先生成提示词</div>';
      }
    });
  }
  if (types.includes('full_storyboard')) {
    h += '<h2>🎞️ 故事板（含提示词）</h2>';
    scripts.forEach(ep => {
      h += `<h3>第${ep.episodeNumber}集</h3>`;
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots && sb.shots.length > 0) {
        sb.shots.forEach(s => { h += htmlShotCardFull(s); });
      } else {
        h += '<div class="empty-hint">暂无故事板数据，请先生成提示词</div>';
      }
    });
  }
  return h + `<div class="footer">StoryCine · ${esc(name)} · ${date}</div></body></html>`;
}

// ========== Markdown ==========
function buildMarkdown(name, date, scripts, sbs, types, videoConfig, directorSettings) {
  let md = `# ${esc(name)}\n导出日期：${date}\n\n`;
  if (types.includes('script')) {
    md += '## 📝 剧本全文\n\n';
    scripts.forEach(ep => {
      md += `### 第${ep.episodeNumber}集 ${esc(ep.episodeTitle||'')}\n${ep.summary ? ep.summary + '\n\n' : '\n'}`;
      (ep.scenes || []).forEach(s => { md += mdSceneBlock(s); });
    });
  }
  if (types.includes('shots')) {
    md += '## 🎬 分镜全文\n\n';
    scripts.forEach(ep => {
      md += `### 第${ep.episodeNumber}集\n\n`;
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots && sb.shots.length > 0) {
        sb.shots.forEach(s => { md += mdShotCard(s) + '\n'; });
      } else {
        md += '_暂无分镜数据_\n\n';
      }
    });
  }
  if (types.includes('full_storyboard')) {
    md += '## 🎞️ 故事板（含提示词）\n\n';
    scripts.forEach(ep => {
      md += `### 第${ep.episodeNumber}集\n\n`;
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots && sb.shots.length > 0) {
        sb.shots.forEach(s => { md += mdShotCardFull(s) + '\n'; });
      } else {
        md += '_暂无故事板数据_\n\n';
      }
    });
  }
  return md + `\n---\nStoryCine · ${esc(name)} · ${date}`;
}

// ========== CSV ==========
function buildCSV(name, scripts, sbs, types, videoConfig, directorSettings) {
  let csv = '﻿';
  if (types.includes('script')) {
    csv += '集数,标题,场次,地点,时间,角色,台词,动作/表情,镜头提示,内心独白\n';
    scripts.forEach(ep => {
      (ep.scenes || []).forEach(s => {
        if ((s.dialogues || []).length > 0) {
          s.dialogues.forEach(d => csv += `${ep.episodeNumber},"${esc(ep.episodeTitle||'')}",${s.sceneNumber},"${esc(s.location||'')}","${esc(s.timeOfDay||'')}","${esc(d.characterName||'')}","${esc(d.text||'')}","${esc(d.actionHint||'')}","${esc(d.cameraHint||'')}","${esc(d.innerThought||'')}"\n`);
        } else {
          csv += `${ep.episodeNumber},"${esc(ep.episodeTitle||'')}",${s.sceneNumber},"${esc(s.location||'')}","${esc(s.timeOfDay||'')}",,,,,,\n`;
        }
      });
    });
  }
  if (types.includes('shots')) {
    csv += '集数,镜号,场景名称,景别,构图,镜头角度,运镜,光影,时长(s),图像描述,角色,台词,动作/表情,镜头提示,内心独白,音效,备注,状态,生成图片,生成视频\n';
    scripts.forEach(ep => {
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots && sb.shots.length > 0) {
        sb.shots.forEach(s => {
          const f = shotFields(s);
          if (f.dialogues.length > 0) {
            f.dialogues.forEach(d => csv += `${ep.episodeNumber},${f.num},"${esc(f.loc)}",${esc(f.shotType)},${esc(f.composition)},${esc(f.cameraAngle)},${esc(f.camMove)},${esc(f.light)},${f.dur},"${esc(f.desc)}","${esc(d.characterName||'')}","${esc(d.text||'')}","${esc(d.actionHint||'')}","${esc(d.cameraHint||'')}","${esc(d.innerThought||'')}","${esc(f.soundEffect)}","${esc(f.notes)}",${f.status},"${esc(f.renderedImage)}","${esc(f.renderedVideo)}"\n`);
          } else {
            csv += `${ep.episodeNumber},${f.num},"${esc(f.loc)}",${esc(f.shotType)},${esc(f.composition)},${esc(f.cameraAngle)},${esc(f.camMove)},${esc(f.light)},${f.dur},"${esc(f.desc)}",,,,,,,,"${esc(f.soundEffect)}","${esc(f.notes)}",${f.status},"${esc(f.renderedImage)}","${esc(f.renderedVideo)}"\n`;
          }
        });
      }
    });
  }
  if (types.includes('full_storyboard')) {
    csv += '集数,镜号,场景名称,景别,运镜,时长(s),图像描述,角色,台词,动作/表情,镜头提示,内心独白,图片提示词,视频提示词,生成图片,生成视频,状态\n';
    scripts.forEach(ep => {
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots && sb.shots.length > 0) {
        sb.shots.forEach(s => {
          const f = shotFields(s);
          if (f.dialogues.length > 0) {
            f.dialogues.forEach(d => csv += `${ep.episodeNumber},${f.num},"${esc(f.loc)}",${esc(f.shotType)},${esc(f.camMove)},${f.dur},"${esc(f.desc)}","${esc(d.characterName||'')}","${esc(d.text||'')}","${esc(d.actionHint||'')}","${esc(d.cameraHint||'')}","${esc(d.innerThought||'')}","${esc(f.imgPrompt)}","${esc(f.vidPrompt)}","${esc(f.renderedImage)}","${esc(f.renderedVideo)}",${f.status}\n`);
          } else {
            csv += `${ep.episodeNumber},${f.num},"${esc(f.loc)}",${esc(f.shotType)},${esc(f.camMove)},${f.dur},"${esc(f.desc)}",,,,,,,,"${esc(f.imgPrompt)}","${esc(f.vidPrompt)}","${esc(f.renderedImage)}","${esc(f.renderedVideo)}",${f.status}\n`;
          }
        });
      }
    });
  }
  return csv;
}

// ========== JSON ==========
function buildJSON(name, date, scripts, sbs, types, videoConfig, directorSettings) {
  const result = { name, date, exportedAt: new Date().toISOString(), episodes: [] };
  scripts.forEach(ep => {
    const entry = { episodeNumber: ep.episodeNumber, episodeTitle: ep.episodeTitle || '', summary: ep.summary || '' };
    if (types.includes('script')) {
      entry.scenes = (ep.scenes || []).map(s => ({
        sceneNumber: s.sceneNumber,
        location: s.location || '',
        timeOfDay: s.timeOfDay || '',
        atmosphere: s.atmosphere || '',
        sceneDescription: s.sceneDescription || '',
        notes: s.notes || '',
        dialogues: (s.dialogues || []).map(d => ({
          characterName: d.characterName || '',
          text: d.text || '',
          actionHint: d.actionHint || '',
          innerThought: d.innerThought || '',
          cameraHint: d.cameraHint || '',
        })),
      }));
    }
    if (types.includes('shots') || types.includes('full_storyboard')) {
      const sb = findSB(ep._id, sbs);
      if (sb && sb.shots) {
        entry.shots = sb.shots.map(s => {
          const shot = {
            shotNumber: s.shotNumber,
            sceneName: s.sceneName || '',
            shotType: s.shotType,
            cameraAngle: s.cameraAngle,
            composition: s.composition || '',
            cameraMovement: s.cameraMovement,
            lighting: s.lighting || '',
            characterEmotion: s.characterEmotion || '',
            duration: s.duration,
            imageDescription: s.imageDescription || '',
            renderedImage: s.renderedImage || '',
            renderedVideo: s.renderedVideo || '',
            dialogue: s.dialogue || { characterName: '', text: '', audioUrl: '', actionHint: '', cameraHint: '', innerThought: '' },
            soundEffect: s.soundEffect || '',
            notes: s.notes || '',
            status: s.status,
            materials: s.materials || [],
          };
          if (types.includes('full_storyboard')) {
            shot.imagePrompt = s._imagePrompt || '';
            shot.videoPrompt = s._videoPrompt || '';
            shot.refImages = s._refImages || [];
          }
          return shot;
        });
      } else {
        entry.shots = [];
      }
    }
    result.episodes.push(entry);
  });
  return result;
}

function buildWord(name, date, scripts, sbs, types, videoConfig, directorSettings) {
  const html = buildHTML(name, date, scripts, sbs, types, videoConfig, directorSettings);
  return html.replace('</body>','').replace('</html>','');
}

module.exports = router;
