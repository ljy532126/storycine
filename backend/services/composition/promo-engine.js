const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const axios = require('axios');

/** 自动探测系统可用的中文字体 */
function detectChineseFont() {
  let candidates;
  if (os.platform() === 'win32') {
    candidates = ['C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simsun.ttc'];
  } else {
    candidates = ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'];
  }
  for (const fp of candidates) { if (fs.existsSync(fp)) return fp; }
  return candidates[0];
}
const FONT_PATH = detectChineseFont();

class PromoEngine {
  constructor(opts = {}) {
    const [w, h] = (opts.resolution || '1080x1920').split('x').map(Number);
    this.width = w;
    this.height = h;
    this.frameRate = opts.frameRate || 24;
    this.outputFormat = opts.outputFormat || 'mp4';
    this.backgroundMusic = opts.backgroundMusic || '';
    this.workDirs = []; // track for cleanup
    this.aborted = false;
    this.warnings = [];
  }

  abort() { this.aborted = true; }

  async generate(shots, options = {}) {
    const mode = options.mode || 'simple';
    const maxDuration = options.maxDuration || 60;
    const tags = options.projectTags || [];
    return mode === 'complete'
      ? this._generateComplete(shots, maxDuration, tags)
      : this._generateSimple(shots, maxDuration, tags);
  }

  // ======================== Simple ========================
  async _generateSimple(shots, maxDur, tags) {
    const hook = this._pickStrongestDialogue(shots);
    const hl = this._pickHighlightShots(shots, 3, 5, maxDur - 7);
    const cta = this._buildCTA(tags, 'simple');
    const r = await this._buildSingleClip(hook, hl, cta, 'simple');
    return r ? [r] : [];
  }

  // ======================== Complete ========================
  async _generateComplete(shots, maxDur, tags) {
    const styles = [
      { key: 'conflict', label: '冲突向' },
      { key: 'sweet', label: '甜宠向' },
      { key: 'suspense', label: '悬念向' },
    ];
    const clips = [];
    for (const s of styles) {
      if (this.aborted) break;
      const hook = this._pickDialogueByStyle(shots, s.key);
      const hl = this._pickShotsByStyle(shots, s.key, 3, 5, maxDur - 7);
      const cta = this._buildCTA(tags, s.key);
      const r = await this._buildSingleClip(hook, hl, cta, s.key);
      if (r) clips.push(r);
    }
    return clips;
  }

  // ======================== Dialogue scoring ========================
  _conflictScore(text) {
    const kw = { 杀:5, 死:5, 滚:4, 你敢:5, 休想:4, 前世:3, 毒:4, 恨:4, 报复:5, 休怪我:5, 不配:3, 休书:4, 纳命:5 };
    let s = 0;
    for (const [k, v] of Object.entries(kw)) { if (text.includes(k)) s += v; }
    return s;
  }

  _pickStrongestDialogue(shots) {
    let best = null, bestS = -1;
    for (const shot of shots) {
      for (const d of this._getDialogues(shot)) {
        const sc = this._conflictScore(d.text || '');
        if (sc > bestS) { bestS = sc; best = { ...d, shot }; }
      }
    }
    return best || { characterName: '旁白', text: '精彩剧情，马上揭晓' };
  }

  _pickDialogueByStyle(shots, style) {
    if (style === 'sweet') {
      const sweet = ['爱','心','宠','护','疼','嫁','娶','抱','吻','暖','温柔','守护'];
      for (const shot of shots) for (const d of this._getDialogues(shot)) if (sweet.some(w => (d.text||'').includes(w))) return { ...d, shot };
    }
    if (style === 'suspense') {
      const sus = ['谁','怎么','为什么','难道','莫非','竟然','原来','秘密','真相','阴谋'];
      for (const shot of shots) for (const d of this._getDialogues(shot)) if (sus.some(w => (d.text||'').includes(w))) return { ...d, shot };
    }
    return this._pickStrongestDialogue(shots);
  }

  _getDialogues(shot) {
    const list = [...(shot._dialogues || [])];
    if (shot.dialogue?.text) list.push(shot.dialogue);
    return list;
  }

  // ======================== Shot selection ========================
  _pickHighlightShots(shots, minN, maxN, maxDur) {
    const valid = shots.filter(s => s.renderedVideo && !/^cgt-/.test(s.renderedVideo));
    const withD = valid.filter(s => (s._dialogues||[]).length || s.dialogue?.text);
    return this._trimByDuration(withD.length >= minN ? withD : valid, minN, maxN, maxDur);
  }

  _pickShotsByStyle(shots, style, minN, maxN, maxDur) {
    const valid = shots.filter(s => s.renderedVideo && !/^cgt-/.test(s.renderedVideo));
    if (style === 'sweet') {
      const sweet = valid.filter(s => /(笑|抱|吻|牵手|对视|温柔|甜蜜)/.test(s.imageDescription||''));
      if (sweet.length >= minN) return this._trimByDuration(sweet, minN, maxN, maxDur);
    }
    if (style === 'suspense') {
      const sus = valid.filter(s => /(转身|回头|秘密|黑影|暗处|门|忽然|突然|竟然)/.test(s.imageDescription||''));
      if (sus.length >= minN) return this._trimByDuration(sus, minN, maxN, maxDur);
    }
    return this._pickHighlightShots(shots, minN, maxN, maxDur);
  }

  _trimByDuration(shots, minN, maxN, maxDur) {
    let t = 0; const r = [];
    for (const s of shots) {
      if (t + (s.duration||3) > maxDur && r.length >= minN) break;
      if (r.length >= maxN) break;
      r.push(s); t += s.duration||3;
    }
    return r;
  }

  // ======================== CTA ========================
  _buildCTA(tags = [], theme = '') {
    const tagStr = (tags||[]).slice(0,3).map(t=>'#'+t).join(' ');
    const tpl = { simple:'点击看全集 👇👇👇', conflict:'前世你负我，今生我让你高攀不起 👇', sweet:'他宠她入骨，她为他倾尽天下 ❤️👇', suspense:'真相到底是什么？点击看全集 👇' };
    return { text: (tpl[theme]||tpl.simple)+' '+tagStr, duration: 3 };
  }

  // ======================== Build single clip ========================
  async _buildSingleClip(hook, shots, cta, styleKey) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'+styleKey+'-'));
    this.workDirs.push(workDir);
    try {
      const hf = await this._createTextFrame(workDir, 'hook', hook.characterName+'："'+(hook.text||'').substring(0,60)+'"', 48, 4);
      const segs = [hf];
      for (const shot of shots) {
        const lp = await this._downloadVideo(shot.renderedVideo, shot.shotNumber, workDir);
        segs.push({ file: lp, duration: shot.duration||3 });
      }
      const cf = await this._createTextFrame(workDir, 'cta', cta.text, 36, cta.duration||3);
      segs.push(cf);
      const out = path.join(workDir, `promo_${styleKey}.${this.outputFormat}`);
      await this._filterConcat(segs, out);
      let finalPath = out;
      if (this.backgroundMusic) finalPath = await this._mixBgMusic(out, workDir);
      return { style: styleKey, outputPath: finalPath, shots: shots.length, hookText: hook.text };
    } catch (e) {
      this.warnings.push(`${styleKey}: ${e.message}`);
      return null;
    }
  }

  // ======================== FFmpeg helpers ========================
  async _createTextFrame(wd, label, text, fontSize, duration) {
    const outFile = path.join(wd, `${label}.mp4`);
    const esc = text.replace(/\\/g,'\\\\').replace(/:/g,'\\:').replace(/'/g,"'\\\\''").replace(/"/g,'\\"').replace(/\n/g,' ');
    const vf = `drawtext=fontfile='${FONT_PATH.replace(/'/g,"'\\''")}':text='${esc}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.6:boxborderw=20`;
    await this._ffmpeg([
      '-f','lavfi','-i',`color=c=#1a1a2e:size=${this.width}x${this.height}:duration=${duration}:rate=${this.frameRate}`,
      '-vf',vf,'-c:v','libx264','-preset','ultrafast','-crf','18','-an','-y',outFile
    ],`text:${label}`);
    return { file: outFile, duration };
  }

  async _downloadVideo(url, shotNum, wd) {
    // 支持本地绝对路径
    if (fs.existsSync(url)) return url;
    // 解析 `/uploads/...` 相对路径
    const localAbsPath = path.join(__dirname, '..', '..', url.replace(/^\//, ''));
    if (fs.existsSync(localAbsPath)) return localAbsPath;
    // HTTP 下载
    const localPath = path.join(wd, `shot_${shotNum}.mp4`);
    const writer = fs.createWriteStream(localPath);
    const resp = await axios({ url, method:'GET', responseType:'stream', timeout:120000 });
    resp.data.pipe(writer);
    await new Promise((resolve, reject) => { writer.on('finish',resolve); writer.on('error',reject); });
    return localPath;
  }

  /** filter-based concat that handles mismatched formats */
  async _filterConcat(segs, outputPath) {
    const inputs = segs.map(s => ['-i', s.file]).flat();
    const filters = [];
    const label = (i, kind) => `[${i}:${kind}]`;
    let lastV = label(0, 'v'), lastA = label(0, 'a');
    filters.push(`${lastV}${lastA}`);
    for (let i = 1; i < segs.length; i++) {
      const iv = label(i, 'v'), ia = label(i, 'a');
      const vOut = `[vout${i}]`, aOut = `[aout${i}]`;
      filters.push(`${lastV}${iv}concat=n=2:v=1:a=0${vOut};${lastA}${ia}concat=n=2:v=0:a=1${aOut}`);
      lastV = vOut; lastA = aOut;
    }
    const args = [...inputs, '-filter_complex', filters.join(';'), '-map', lastV, '-map', lastA, '-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-y',outputPath];
    await this._ffmpeg(args, 'filter concat');
    return outputPath;
  }

  async _mixBgMusic(inputPath, wd) {
    const out = path.join(wd, 'promo_bgm.mp4');
    await this._ffmpeg([
      '-i',inputPath,'-i',this.backgroundMusic,
      '-filter_complex','[1:a]volume=0.25[bgm];[0:a][bgm]amix=inputs=2:duration=first:normalize=0[outa]',
      '-map','0:v','-map','[outa]','-c:v','copy','-c:a','aac','-y',out
    ], 'mix BGM');
    return out;
  }

  _ffmpeg(args, label = '') {
    return new Promise((resolve, reject) => {
      if (this.aborted) return reject(Object.assign(new Error('aborted'), { code: 'ABORTED' }));
      const proc = spawn('ffmpeg', args, { windowsHide: true });
      proc.stderr.resume();
      proc.on('close', code => code===0 ? resolve() : reject(new Error(`ffmpeg ${label} exit ${code}`)));
      proc.on('error', reject);
    });
  }

  async cleanup() {
    for (const wd of this.workDirs) {
      await fsp.rm(wd, { recursive: true, force: true }).catch(() => {});
    }
    this.workDirs = [];
  }
}

module.exports = PromoEngine;
