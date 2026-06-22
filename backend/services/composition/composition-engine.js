const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const axios = require('axios');

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

      // ---- Step 2: concat (55–75 %) ----
      this._report(55, '合成视频...');
      let concatFile;
      if (segments.length === 1) {
        concatFile = segments[0].file;
      } else {
        concatFile = await this._concatFilter(segments);
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

      return { outputPath: saved.outputPath, publicUrl: saved.publicUrl, warnings: this.warnings, duration: this._calcTotalDuration(segments) };
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

  /** 实际合成时长（含转场裁剪），秒 */
  _calcTotalDuration(segments) {
    return segments.reduce((s, seg) => s + (Number(seg.duration) || 0), 0);
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
    const duration = Number(shot.duration) || 3;

    const visualUrl = shot.renderedVideo || shot.renderedImage;
    if (!visualUrl) throw new Error('缺少 renderedImage / renderedVideo');
    const visualFile = await this._resolveAsset(visualUrl, `vis_${index}`);

    const scaleFilter = `scale=${this.width}:${this.height}:force_original_aspect_ratio=decrease,pad=${this.width}:${this.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;

    // Normalise video KEEPING original audio (no -an)
    const vidOnly = path.join(this.workDir, `_v_${index}.mp4`);
    if (shot.renderedVideo) {
      await this._ffmpeg([
        '-i', visualFile,
        '-t', String(duration),
        '-vf', `${scaleFilter},fps=${this.frameRate},setpts=PTS-STARTPTS`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-y', vidOnly,
      ], `normalise-video #${shot.shotNumber}`);
    } else {
      // Image → video + silence
      await this._ffmpeg([
        '-loop', '1', '-i', visualFile,
        '-t', String(duration),
        '-vf', `${scaleFilter},fps=${this.frameRate},setpts=PTS-STARTPTS`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=44100:cl=stereo',
        '-c:a', 'aac',
        '-shortest',
        '-y', vidOnly,
      ], `img→video #${shot.shotNumber}`);
    }

    // Check if vidOnly actually has an audio stream
    const hasAudio = await this._probeHasAudio(vidOnly);

    // Mix TTS dialogue on top if present
    if (shot.dialogue && shot.dialogue.audioUrl) {
      const dialogueFile = await this._resolveAsset(shot.dialogue.audioUrl, `aud_${index}`);

      if (hasAudio) {
        // vidOnly has audio (original or silence) — mix TTS on top
        await this._ffmpeg([
          '-i', vidOnly,
          '-i', dialogueFile,
          '-filter_complex',
          `[1:a]volume=1.5[dial];` +
          `[0:a][dial]amix=inputs=2:duration=first:normalize=0[outa]`,
          '-map', '0:v', '-map', '[outa]',
          '-c:v', 'copy', '-c:a', 'aac',
          '-y', segFile,
        ], `mix-dialogue #${shot.shotNumber}`);
      } else {
        // vidOnly has no audio — add silence base + TTS
        await this._ffmpeg([
          '-i', vidOnly,
          '-i', dialogueFile,
          '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=44100:cl=stereo',
          '-filter_complex',
          `[1:a]volume=1.5[dial];` +
          `[2:a][dial]amix=inputs=2:duration=first:normalize=0[outa]`,
          '-map', '0:v', '-map', '[outa]',
          '-c:v', 'copy', '-c:a', 'aac',
          '-y', segFile,
        ], `mix-dialogue+silence #${shot.shotNumber}`);
      }
      await fsp.unlink(vidOnly).catch(() => {});
      return { file: segFile, duration };
    }

    // No TTS — ensure audio track exists
    if (!hasAudio) {
      await this._ffmpeg([
        '-i', vidOnly,
        '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=r=44100:cl=stereo',
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy', '-c:a', 'aac',
        '-y', segFile,
      ], `add-silence #${shot.shotNumber}`);
      await fsp.unlink(vidOnly).catch(() => {});
      return { file: segFile, duration };
    }

    return { file: vidOnly, duration };
  }

  /** Concat via filter (re-encode) — handles any encoding variance between segments */
  async _concatFilter(segments) {
    const n = segments.length;
    const inputs = segments.flatMap(s => ['-i', s.file]);
    const vIns = segments.map((_, i) => `[${i}:v]`).join('');
    const aIns = segments.map((_, i) => `[${i}:a]`).join('');

    const out = path.join(this.workDir, 'concat.mp4');
    await this._ffmpeg([
      ...inputs,
      '-filter_complex',
      `${vIns}concat=n=${n}:v=1:a=0[vout];` +
      `${aIns}concat=n=${n}:v=0:a=1[aout]`,
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-y', out,
    ], 'concat');
    return out;
  }

  /** Overlay subtitles via ASS */
  async _addSubtitles(videoFile, shots, segments) {
    let cumTime = 0;
    const events = [];

    for (let i = 0; i < segments.length; i++) {
      const shot = shots[i] || shots.find(s => s.shotNumber === i + 1);
      if (!shot) { cumTime += segments[i].duration; continue; }
      const dur = segments[i].duration;

      // Collect all dialogue texts
      const texts = [];
      if (shot.dialogue?.text?.trim()) texts.push(shot.dialogue.text.trim());
      if (Array.isArray(shot._dialogues)) {
        shot._dialogues.forEach(d => { if (d.text?.trim()) texts.push(d.text.trim()); });
      }

      if (texts.length > 0) {
        // Spread each dialogue line evenly across the shot duration
        const slotDur = dur / texts.length;
        for (let t = 0; t < texts.length; t++) {
          const start = this._assTime(cumTime + t * slotDur);
          const end = this._assTime(cumTime + (t + 1) * slotDur);
          const safe = texts[t].replace(/\\/g, '\\\\').replace(/\r/g, '');
          events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${safe}`);
        }
      }
      cumTime += dur;
    }

    if (events.length === 0) return videoFile; // nothing to overlay

    const fontSize = Math.max(18, Math.round(this.height * 0.03));
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
          console.error(`[ffmpeg] ${label} FAILED (exit ${code})\n${stderr.slice(-600)}`);
          reject(new Error(`FFmpeg 失败 (${label}): exit ${code} — ${stderr.slice(-200).replace(/\n/g, ' ')}`));
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

  /** Check if a media file has an audio stream */
  _probeHasAudio(file) {
    return new Promise((resolve) => {
      const proc = spawn('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_type',
        '-of', 'csv=p=0',
        file,
      ]);
      let stdout = '';
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.on('close', () => resolve(stdout.trim() === 'audio'));
      proc.on('error', () => resolve(false));
    });
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
