// 清理未被引用的上传文件（软删除后残留的孤儿文件）
// 用法：node cleanup-orphan-uploads.js [--dry-run] [--days 14]
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/storycine';
const DRY_RUN = process.argv.includes('--dry-run');
const DAYS_ARG = process.argv.indexOf('--days');
const MIN_AGE_DAYS = DAYS_ARG > -1 ? parseInt(process.argv[DAYS_ARG + 1]) || 14 : 14;

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DIRS = ['storyboard-images', 'storyboard-videos'];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log(`模式: ${DRY_RUN ? '试运行（不删除）' : '正式清理'}, 最小文件年龄: ${MIN_AGE_DAYS}天`);

  // 1. 收集所有被引用的 URL
  const refs = new Set();
  const sbs = await mongoose.connection.db.collection('storyboards').find({}, { projection: { shots: 1 } }).toArray();
  for (const sb of sbs) {
    for (const shot of (sb.shots || [])) {
      if (shot.renderedImage) refs.add(shot.renderedImage);
      if (shot.renderedVideo) refs.add(shot.renderedVideo);
      for (const m of (shot.materials || [])) {
        if (m.url) refs.add(m.url);
      }
    }
  }
  console.log(`数据库引用文件数: ${refs.size}`);

  // 2. 扫描磁盘
  const cutoff = Date.now() - MIN_AGE_DAYS * 86400 * 1000;
  let totalDeleted = 0, totalSize = 0, totalKept = 0;

  for (const dir of DIRS) {
    const dirPath = path.join(UPLOADS_DIR, dir);
    if (!fs.existsSync(dirPath)) { console.log(`目录不存在: ${dirPath}`); continue; }

    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      const fullPath = path.join(dirPath, f);
      const stat = fs.statSync(fullPath);
      const url = `/uploads/${dir}/${f}`;

      if (refs.has(url)) {
        totalKept++;
        continue;
      }

      if (stat.mtimeMs > cutoff) {
        console.log(`[跳过-未过期] ${url} (${(stat.mtimeMs / 86400000).toFixed(1)}天前)`);
        totalKept++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[将删除] ${url} (${(stat.size / 1024 / 1024).toFixed(1)}MB, ${(stat.mtimeMs / 86400000).toFixed(1)}天前)`);
      } else {
        fs.unlinkSync(fullPath);
        console.log(`[已删除] ${url} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
      }
      totalDeleted++;
      totalSize += stat.size;
    }
  }

  console.log(`\n=== 清理完成 ===`);
  console.log(`删除: ${totalDeleted} 个文件, ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`保留: ${totalKept} 个文件`);

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
