// 一次性迁移：将数据库中所有 cameraMovement: '静止' 改为 '固定'
// 用法：node migrate-camera-movement.js
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/storycine';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('已连接 MongoDB');

  // 1. scripts.scenes
  const scripts = await mongoose.connection.db.collection('scripts').find({}).toArray();
  let scriptCnt = 0;
  for (const s of scripts) {
    let changed = false;
    (s.scenes || []).forEach(sc => {
      if (sc.cameraMovement === '静止') { sc.cameraMovement = '固定'; changed = true; }
    });
    if (changed) {
      await mongoose.connection.db.collection('scripts').updateOne({ _id: s._id }, { $set: { scenes: s.scenes } });
      scriptCnt++;
    }
  }
  console.log(`scripts: ${scriptCnt} 条更新`);

  // 2. storyboards.shots
  const sbs = await mongoose.connection.db.collection('storyboards').find({}).toArray();
  let sbCnt = 0;
  for (const sb of sbs) {
    let changed = false;
    (sb.shots || []).forEach(sh => {
      if (sh.cameraMovement === '静止') { sh.cameraMovement = '固定'; changed = true; }
    });
    if (changed) {
      await mongoose.connection.db.collection('storyboards').updateOne({ _id: sb._id }, { $set: { shots: sb.shots } });
      sbCnt++;
    }
  }
  console.log(`storyboards: ${sbCnt} 条更新`);

  console.log('迁移完成');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
