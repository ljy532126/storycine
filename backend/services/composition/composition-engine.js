const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const axios = require('axios');

const XFADE_MAP = { fade: 'fade', dissolve: 'dissolve', slide: 'slideright', cut: null };
const XFADE_DURATION = 0.5;

class CompositionEngine {
  /**
   * @param {Object} opts
   * @param {string}  opts.resolution       - "WxH"
   * @param {number}  opts.frameRate        - e.g. 24
   * @param {string}  opts.outputFormat     - "mp4"
   * @param {string}  opts.transition       - fade|cut|slide|dissolve
   * @param {boolean} opts.subtitlesEnabled
   * @param {string}  opts.backgroundMusic  - URL or local path
   * @param {Function} opts.onProgress      - (pct:number, stage:string) => void
   */
  constructor(opts = {}) {
    const [w, h] = (opts.resolution || '1080x1920').split('x').map(Number);
    this.width = w;
    this.height = h;
    this.frameRate = opts.frameRate || 24;
    this.outputFormat = opts.outputFormat || 'mp4';
    this.transition = opts.transition || 'fade';
    this.subtitlesEnabled = opts.subtitlesEnabled !== false;
    this.backgroundMusic = opts.backgroundMusic || '';
    this.onProgress = opts.onProgress || (() => {});
    this.workDir = null;
    this.aborted = false;
    this._currentProc = null;
    this.warnings = [];
  }

  /** Request cancellation — kills the running FFmpeg process */
  abort() {
    this.aborted = true;
    if (this._currentProc) {
      try { this._currentProc.kill('SIGKILL'); } catch (_) {}
    }
  }

  /**
   * Main entry-point.  Returns { outputPath, warnings }.
   * @param {Array} shots — sorted storyboard shots
   */
  async compose(shots) {
    this.workDir = path.join(os.tmpdir(), `comp_${Date.now()}`);
    await fsp.mkdir(this.workDir, { recursive: true });

    try {
      const sorted = [...shots].sort((a, b) => a.shotNumber - b.shotNumber);

      // ----  Step 1: prepare normalised segments (0–55 %) ----
      this._report(0, '准备素材...');
      const segments = [];

      for (let i = 0; i < sorted.length; i++) {
        if (this.aborted) throw Object.assign(new Error('任务已取消'), { code: 'ABORTED' });
        try {
          const seg = await this._prepareSegment(sorted[i], i);
          segments.push(seg);
        } catch (err) {
          this.warnings.push(`镜头${sorted[i].shotNumber}: ${err.message}`);
          // skip this shot, continue with others
        }
        this._report(5 + Math.round((i + 1) / sorted.length * 50), `镜头 ${i + 1}/${sorted.length}`);
      }

      if (segments.length === 0) {
        throw new Error('所有镜头素材均缺失，无法合成');
      }

      // ---- Step 2: concat / xfade (55–75 %) ----
      this._report(55, '合成视频...');
      let concatFile;
      if (segments.length === 1) {
        concatFile = segments[0].file;
      } else if (this.transition === 'cut') {
        concatFile = await this._concatDemux(segments);
      } else {
        concatFile = await this._xfadeConcat(segments);
      }

      // ---- Step 3: subtitles (75–88 %) ----
      let subtitledFile = concatFile;
      if (this.subtitlesEnabled) {
        this._report(75, '叠加字幕...');
        subtitledFile = await this._addSubtitles(concatFile, sorted, segments);
      }

      // ---- Step 4: BGM (88–96 %) ----
      let finalFile = subtitledFile;
      if (this.backgroundMusic) {
        this._report(88, '混入背景音乐...');
        try {
          finalFile = await this._mixBgMusic(subtitledFile);
        } catch (err) {
          this.warnings.push(`背景音乐: ${err.message}`);
        }
      }

      // ---- Step 5: copy to output ----
      this._report(96, '保存输出...');
      const saved = await this._saveOutput(finalFile);
      this._report(100, '完成');

      return { outputPath: saved.outputPath, publicUrl: saved.publicUrl, warnings: this.warnings };
    } catch (err) {
      // clean up workDir on failure (caller may keep it for debugging)
      throw err;
    }
  }

  /** Clean up the temporary work directory */
  async cleanup() {
    if (this.workDir && fs.existsSync(this.workDir)) {
      await fsp.rm(this.workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ------------------------------------------------------------------
  //  Internal helpers
  // ------------------------------------------------------------------

  /**
   * Create a normalised video segment from one shot.
   * Always produces a file with a video stream + an audio stream.
   */
  async _prepareSegment(shot, index) {
    const segFile = path.join(this.workDir, `seg_${index}.mp4`);
    const duration = shot.duration || 3;

    // ---- resolve visual source ----
    const visualUrl = shot.renderedVideo || shot.renderedImage;
    if (!visualUrl) throw new Error('缺少 renderedImage / renderedVideo');
    const visualFile = await this._resolveAsset(visualUrl, `vis_${index}`);

    const scaleFilter = `scale=${this.width}:${this.height}:force_original_aspect_ratio=decrease,pad=${this.width}:${this.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;

    // Create normalised video-only intermediate
    const vidOnly = path.join(this.workDir, `_v_${index}.mp4`);
    if (shot.renderedVideo) {
      await this._ffmpeg([
        '-i', visualFile,
        '-t', String(duration),
        '-vf', `${scaleFilter},fps=${this.frameRate},setpts=PTS-STARTPTS`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-an',
        '-y', vidOnly,
      ], `normalise-video #${shot.shotNumber}`);
    } else {
      await this._ffmpeg([
        '-loop', '1', '-i', visualFile,
        '-t', String(duration),
        '-vf', `${scaleFilter},fps=${this.frameRate}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-y', vidOnly,
      ], `img→video #${shot.shotNumber}`);
    }

    // ---- mix audio ----
    if (shot.dialogue && shot.dialogue.audioUrl) {
      const audioFile = await this._resolveAsset(shot.dialogue.audioUrl, `aud_${index}`);
      await this._ffmpeg([
        '-i', vidOnly,
        '-i', audioFile,
        '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=44100:cl=stereo',
        '-filter_complex',
        `[1:a]volume=1.5[a1];` +
        `[2:a][a1]amix=inputs=2:duration=first:normalize=0[outa]`,
        '-map', '0:v', '-map', '[outa]',
        '-c:v', 'copy', '-c:a', 'aac',
        '-y', segFile,
      ], `mix-dialogue #${shot.shotNumber}`);
    } else {
      await this._ffmpeg([
        '-i', vidOnly,
        '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=44100:cl=stereo',
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy', '-c:a', 'aac',
        '-y', segFile,
      ], `add-silence #${shot.shotNumber}`);
    }

    // Clean up intermediate
    await fsp.unlink(vidOnly).catch(() => {});
    return { file: segFile, duration };
  }

  /** Simple concat demuxer (no transitions) */
  async _concatDemux(segments) {
    const listFile = path.join(this.workDir, 'list.txt');
    const content = segments.map(s => {
      const p = s.file.replace(/\\/g, '/');
      return `file '${p}'`;
    }).join('\n');
    await fsp.writeFile(listFile, content);

    const out = path.join(this.workDir, 'concat.mp4');
    await this._ffmpeg([
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c', 'copy', '-y', out,
    ], 'concat (cut)');
    return out;
  }

  /** xfade transition chain */
  async _xfadeConcat(segments) {
    const td = XFADE_DURATION;
    const xfadeType = XFADE_MAP[this.transition] || 'fade';

    // cumulative offsets for each xfade
    // offset_i = sum(seg[0..i].dur) - (i+1)*td
    let cumDur = 0;
    const offsets = [];
    for (let i = 0; i < segments.length - 1; i++) {
      cumDur += segments[i].duration;
      offsets.push(cumDur - (i + 1) * td);
    }

    const inputs = segments.flatMap(s => ['-i', s.file]);

    // Build filter graph: video chain + audio chain
    let lastV = '[0:v]';
    let lastA = '[0:a]';
    const filters = [];

    for (let i = 1; i < segments.length; i++) {
      const vOut = `v${i}`;
      const aOut = `a${i}`;
      filters.push(
        `${lastV}[${i}:v]xfade=transition=${xfadeType}:duration=${td}:offset=${offsets[i - 1].toFixed(3)}[${vOut}]`
      );
      filters.push(
        `${lastA}[${i}:a]acrossfade=d=${td}:c1=tri:c2=tri[${aOut}]`
      );
      lastV = `[${vOut}]`;
      lastA = `[${aOut}]`;
    }

    const filterComplex = filters.join(';');

    const out = path.join(this.workDir, 'xfade.mp4');
    await this._ffmpeg([
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', lastV, '-map', lastA,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
      '-c:a', 'aac',
      '-y', out,
    ], `xfade (${xfadeType})`);
    return out;
  }

  /** Overlay subtitles via ASS */
  async _addSubtitles(videoFile, shots, segments) {
    // Build cumulative timeline — note xfade shortens total duration
    const td = this.transition === 'cut' ? 0 : XFADE_DURATION;
    let cumTime = 0;
    const events = [];

    for (let i = 0; i < segments.length; i++) {
      const shot = shots.find(s => s.shotNumber === i + 1) || shots[i];
      const dur = segments[i].duration;
      const text = (shot && shot.dialogue && shot.dialogue.text) ? shot.dialogue.text : '';

      if (text && text.trim()) {
        const start = this._assTime(cumTime);
        const end = this._assTime(cumTime + dur);
        // Escape commas and newlines for ASS
        const safe = text.replace(/\\/g, '\\\\').replace(/\n/g, '\\N').replace(/\r/g, '');
        events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${safe}`);
      }
      cumTime += dur - (i < segments.length - 1 ? td : 0);
    }

    if (events.length === 0) return videoFile; // nothing to overlay

    const fontSize = Math.max(24, Math.round(this.height * 0.045));
    const marginV = Math.round(this.height * 0.06);

    const ass = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: ${this.width}
PlayResY: ${this.height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,${fontSize},&H00FFFFFF,&H00000000,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2.5,1.5,2,20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}`;

    const assPath = path.join(this.workDir, 'subs.ass');
    await fsp.writeFile(assPath, ass, 'utf-8');

    const out = path.join(this.workDir, 'subtitled.mp4');
    const escapedPath = this._escapeFilterPath(assPath);

    await this._ffmpeg([
      '-i', videoFile,
      '-vf', `ass='${escapedPath}'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
      '-c:a', 'copy',
      '-y', out,
    ], 'subtitles');

    return out;
  }

  /** Mix background music at 30 % volume, loop if needed */
  async _mixBgMusic(inputFile) {
    const bgmFile = await this._resolveAsset(this.backgroundMusic, 'bgm');
    const out = path.join(this.workDir, 'with_bgm.mp4');

    await this._ffmpeg([
      '-i', inputFile,
      '-stream_loop', '-1', '-i', bgmFile,
      '-filter_complex', '[1:a]volume=0.3[bgm];[0:a][bgm]amix=inputs=2:duration=first:normalize=0[outa]',
      '-map', '0:v', '-map', '[outa]',
      '-c:v', 'copy', '-c:a', 'aac',
      '-shortest', '-y', out,
    ], 'mix BGM');

    return out;
  }

  /** Copy final file to output/ directory and return the path */
  async _saveOutput(inputFile) {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      await fsp.mkdir(outputDir, { recursive: true });
    }
    const filename = `comp_${Date.now()}.${this.outputFormat}`;
    const dest = path.join(outputDir, filename);
    await fsp.copyFile(inputFile, dest);
    // Also copy to uploads so it's served statically
    const uploadsDir = path.join(process.cwd(), 'uploads', 'compositions');
    if (!fs.existsSync(uploadsDir)) {
      await fsp.mkdir(uploadsDir, { recursive: true });
    }
    const uploadDest = path.join(uploadsDir, filename);
    await fsp.copyFile(inputFile, uploadDest);
    return { outputPath: dest, publicUrl: `/uploads/compositions/${filename}` };
  }

  // ------------------------------------------------------------------
  //  Asset resolution
  // ------------------------------------------------------------------

  /**
   * Turn a URL or relative path into a local file path that FFmpeg can read.
   * Downloads HTTP resources into the work directory.
   */
  async _resolveAsset(urlOrPath, label) {
    if (!urlOrPath) throw new Error('empty asset path');

    // Already absolute and exists
    if (path.isAbsolute(urlOrPath) && fs.existsSync(urlOrPath)) return urlOrPath;

    // In workDir (from previous step)
    const inWork = path.join(this.workDir, path.basename(urlOrPath));
    if (fs.existsSync(inWork)) return inWork;

    // HTTP(S) — download
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      return await this._download(urlOrPath, label);
    }

    // Relative — try against cwd
    const cwdPath = path.resolve(process.cwd(), urlOrPath.replace(/^\/+/, ''));
    if (fs.existsSync(cwdPath)) return cwdPath;

    // Try backend/uploads
    const upPath = path.resolve(process.cwd(), 'uploads', urlOrPath.replace(/^\/+/, '').replace(/^uploads\//, ''));
    if (fs.existsSync(upPath)) return upPath;

    // Try backend/output
    const outPath = path.resolve(process.cwd(), 'output', urlOrPath.replace(/^\/+/, '').replace(/^output\//, ''));
    if (fs.existsSync(outPath)) return outPath;

    throw new Error(`找不到文件: ${urlOrPath}`);
  }

  async _download(url, label) {
    const ext = path.extname(new URL(url).pathname) || '.bin';
    const dest = path.join(this.workDir, `${label}${ext}`);

    const resp = await axios({ url, method: 'GET', responseType: 'arraybuffer', timeout: 120000 });
    await fsp.writeFile(dest, Buffer.from(resp.data));
    return dest;
  }

  // ------------------------------------------------------------------
  //  FFmpeg runner
  // ------------------------------------------------------------------

  _ffmpeg(args, label) {
    return new Promise((resolve, reject) => {
      console.log(`[ffmpeg] ${label}`);
      console.log(`[ffmpeg]   ffmpeg ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`);

      const proc = spawn('ffmpeg', args, {
        cwd: this.workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this._currentProc = proc;

      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.on('close', code => {
        this._currentProc = null;
        if (this.aborted) {
          return reject(Object.assign(new Error('任务已取消'), { code: 'ABORTED' }));
        }
        if (code === 0) {
          resolve();
        } else {
          const tail = stderr.slice(-600);
          console.error(`[ffmpeg] ${label} FAILED (exit ${code})\n${tail}`);
          reject(new Error(`FFmpeg 失败 (${label}): exit ${code}`));
        }
      });

      proc.on('error', err => {
        this._currentProc = null;
        reject(new Error(`无法启动 FFmpeg: ${err.message}`));
      });
    });
  }

  // ------------------------------------------------------------------
  //  Helpers
  // ------------------------------------------------------------------

  /** Escape a path for use inside FFmpeg filter arguments (:, \, ') */
  _escapeFilterPath(p) {
    return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
  }

  _report(pct, stage) {
    try { this.onProgress(Math.min(100, Math.round(pct)), stage); } catch (_) {}
  }

  _assTime(totalSec) {
    const neg = totalSec < 0;
    const abs = Math.abs(totalSec);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = (abs % 60).toFixed(2);
    return `${neg ? '-' : ''}${h}:${String(m).padStart(2, '0')}:${s.padStart(5, '0')}`;
  }
}

module.exports = CompositionEngine;
