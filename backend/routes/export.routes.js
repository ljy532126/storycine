const express = require('express');
const router = express.Router();
const Script = require('../models/script.model');
const Project = require('../models/project.model');
const Storyboard = require('../models/storyboard.model');

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

    // 收集数据
    let scripts;
    if (episodeIds && episodeIds.length > 0) {
      scripts = await Script.find({ _id: { $in: episodeIds } }).sort({ episodeNumber: 1 });
    } else {
      scripts = await Script.find({ projectId }).sort({ episodeNumber: 1 });
    }

    const storyboards = (episodeIds && episodeIds.length > 0)
      ? await Storyboard.find({ projectId, scriptId: { $in: episodeIds } })
      : await Storyboard.find({ projectId });

    if (fmt === 'pdf') {
      const html = buildHTML(projectName, dateStr, scripts, storyboards, types);
      return res.json({ html, filename });
    }
    if (fmt === 'markdown') {
      const content = buildMarkdown(projectName, dateStr, scripts, storyboards, types);
      return res.json({ content, filename });
    }
    if (fmt === 'csv') {
      const content = buildCSV(projectName, scripts, storyboards, types);
      return res.json({ content, filename });
    }
    if (fmt === 'word') {
      const content = buildWord(projectName, dateStr, scripts, storyboards, types);
      return res.json({ content, filename });
    }
    res.status(400).json({ message: '不支持的格式' });
  } catch (error) { next(error); }
});

function css() { return 'body{font-family:\'Microsoft YaHei\',sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}h1{font-size:22px;border-bottom:2px solid #409EFF;padding-bottom:8px}h2{font-size:17px;color:#409EFF;margin-top:24px}h3{font-size:15px}.card{border:1px solid #e4e7ed;border-radius:6px;padding:12px;margin:8px 0;background:#fafafa}.tag{background:#ecf5ff;color:#409EFF;padding:1px 6px;border-radius:3px;font-size:12px}.footer{text-align:center;color:#999;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:16px}'; }

function buildHTML(name, date, scripts, sbs, types) {
  let h = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title><style>${css()}</style></head><body><h1>${name}</h1><p>导出日期：${date}</p>`;
  if (types.includes('script')) { h += '<h2>📝 剧本全文</h2>'; scripts.forEach(ep => { h += `<h3>第${ep.episodeNumber}集 ${ep.episodeTitle||''}</h3>${ep.summary?`<p>${ep.summary}</p>`:''}`; (ep.scenes||[]).forEach(s => { h += `<div class="card"><strong>场次${s.sceneNumber} — ${s.location||''} · ${s.timeOfDay||''}</strong>${s.sceneDescription?`<p>${s.sceneDescription}</p>`:''}`; (s.dialogues||[]).forEach(d => h += `<p style="margin-left:16px"><strong>${d.characterName}</strong>：${d.text}${d.actionHint?'('+d.actionHint+')':''}</p>`); h += '</div>'; }); }); }
  if (types.includes('shots')) { h += '<h2>🎬 分镜全文</h2>'; scripts.forEach(ep => { h += `<h3>第${ep.episodeNumber}集</h3>`; (ep.scenes||[]).forEach(s => { h += `<div class="card"><strong>镜号${s.sceneNumber}</strong> <span class="tag">${s.shotType||'中景'}</span> <span class="tag">${s.cameraMovement||''}</span> <span class="tag">${s.duration||3}s</span><br>场景：${s.location||''} · ${s.timeOfDay||''}${s.lighting?`<br>光影：${s.lighting}`:''}${s.sceneDescription?`<br>${s.sceneDescription}`:''}`; (s.dialogues||[]).forEach(d => h += `<br><strong>${d.characterName}</strong>："${d.text}"`); h += '</div>'; }); }); }
  if (types.includes('full_storyboard')) { h += '<h2>🎞️ 故事板</h2>'; sbs.forEach(sb => { h += `<h3>${sb.totalShots}镜头 · ${sb.totalDuration}s</h3>`; (sb.shots||[]).forEach(s => h += `<div class="card"><strong>镜头${s.shotNumber}</strong> <span class="tag">${s.shotType}</span> <span class="tag">${s.cameraMovement}</span> <span class="tag">${s.duration}s</span><br>${s.imageDescription||''}${s.dialogue?.text?`<br><strong>${s.dialogue.characterName}</strong>："${s.dialogue.text}"`:''}</div>`); }); }
  return h + `<div class="footer">StoryCine · ${name} · ${date}</div></body></html>`;
}

function buildMarkdown(name, date, scripts, sbs, types) {
  let md = `# ${name}\n导出日期：${date}\n\n`;
  if (types.includes('script')) { md += '## 📝 剧本全文\n\n'; scripts.forEach(ep => { md += `### 第${ep.episodeNumber}集 ${ep.episodeTitle||''}\n${ep.summary?ep.summary+'\n\n':'\n'}`; (ep.scenes||[]).forEach(s => { md += `**场次${s.sceneNumber}** — ${s.location||''} · ${s.timeOfDay||''}\n${s.sceneDescription?'> '+s.sceneDescription+'\n\n':'\n'}`; (s.dialogues||[]).forEach(d => md += `- **${d.characterName}**：${d.text} ${d.actionHint?`_(${d.actionHint})_`:''}\n`); md += '\n'; }); }); }
  if (types.includes('shots')) { md += '## 🎬 分镜全文\n\n'; scripts.forEach(ep => { md += `### 第${ep.episodeNumber}集\n\n`; (ep.scenes||[]).forEach(s => md += `| 镜号${s.sceneNumber} | ${s.shotType||'中景'} | ${s.cameraMovement||'静止'} | ${s.duration||3}s | ${s.location||''} | ${s.sceneDescription?.substring(0,60)||''} |\n`); md += '\n'; }); }
  if (types.includes('full_storyboard')) { md += '## 🎞️ 故事板\n\n'; sbs.forEach(sb => { md += `### ${sb.totalShots}镜头 · ${sb.totalDuration}s\n\n`; (sb.shots||[]).forEach(s => md += `- **镜头${s.shotNumber}** ${s.shotType} ${s.cameraMovement} ${s.duration}s — ${s.imageDescription||''}\n`); }); }
  return md + `\n---\nStoryCine · ${name} · ${date}`;
}

function buildCSV(name, scripts, sbs, types) {
  let csv = '﻿'; // BOM for Excel
  if (types.includes('shots')) {
    csv += '集数,镜号,场景,景别,构图,运镜,光影,时长(s),分镜描述,角色,台词,动作提示\n';
    scripts.forEach(ep => { (ep.scenes||[]).forEach(s => { (s.dialogues||[]).length > 0 ? s.dialogues.forEach(d => csv += `${ep.episodeNumber},${s.sceneNumber},${s.location||''},${s.shotType||''},${s.composition||''},${s.cameraMovement||''},${s.lighting||''},${s.duration||''},"${(s.sceneDescription||'').replace(/"/g,'""')}","${d.characterName||''}","${(d.text||'').replace(/"/g,'""')}","${d.actionHint||''}"\n`) : csv += `${ep.episodeNumber},${s.sceneNumber},${s.location||''},${s.shotType||''},${s.composition||''},${s.cameraMovement||''},${s.lighting||''},${s.duration||''},"${(s.sceneDescription||'').replace(/"/g,'""')}","","",""\n`; }); });
  }
  if (types.includes('full_storyboard')) {
    csv += '镜头号,场景,景别,运镜,时长(s),描述,角色,台词,图片提示词,视频提示词\n';
    sbs.forEach(sb => { (sb.shots||[]).forEach(s => csv += `${s.shotNumber},${s.sceneName||''},${s.shotType},${s.cameraMovement},${s.duration},"${(s.imageDescription||'').replace(/"/g,'""')}","${s.dialogue?.characterName||''}","${(s.dialogue?.text||'').replace(/"/g,'""')}","${(s._imagePrompt||'').replace(/"/g,'""')}","${(s._videoPrompt||'').replace(/"/g,'""')}"\n`); });
  }
  if (types.includes('script')) {
    if (!types.includes('shots')) { csv += '集数,标题,场次,地点,时间,角色,台词\n'; scripts.forEach(ep => { (ep.scenes||[]).forEach(s => { (s.dialogues||[]).length > 0 ? s.dialogues.forEach(d => csv += `${ep.episodeNumber},${ep.episodeTitle||''},${s.sceneNumber},${s.location||''},${s.timeOfDay||''},${d.characterName||''},"${(d.text||'').replace(/"/g,'""')}"\n`) : csv += `${ep.episodeNumber},${ep.episodeTitle||''},${s.sceneNumber},${s.location||''},${s.timeOfDay||''},,\n`; }); }); }
    csv += '\n'; // already covered by shots
  }
  return csv;
}

function buildWord(name, date, scripts, sbs, types) {
  const html = buildHTML(name, date, scripts, sbs, types);
  return html.replace('</body>','').replace('</html>','');
}

module.exports = router;
