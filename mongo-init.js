// 应用数据库用户（仅对 storycine 库有 readWrite 权限，非 root）
// 生产环境请修改此密码，并同步更新 docker-compose.yml 中的 MONGO_URI
db.createUser({
  user: 'storycine_user',
  pwd: 'storycine_pass',
  roles: [{ role: 'readWrite', db: 'storycine' }]
});

db = db.getSiblingDB('storycine');

db.createCollection('projects');
db.createCollection('scripts');
db.createCollection('characters');
db.createCollection('scenes');
db.createCollection('props');
db.createCollection('storyboards');
db.createCollection('compositions');

db.projects.createIndex({ userId: 1 });
db.projects.createIndex({ createdAt: -1 });
db.scripts.createIndex({ projectId: 1 });
db.characters.createIndex({ projectId: 1, name: 1 }, { unique: true });
db.storyboards.createIndex({ scriptId: 1 });
