# 部署教程

StoryCine 支持 **Docker 一键部署** 和 **本地开发** 两种方式。

## Docker 部署（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/ljy532126/storycine.git
cd storycine

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，至少设置 JWT_SECRET

# 3. 设置管理员密码（可选）
# 在 .env 中添加：ADMIN_PASSWORD=你的密码
# 不设置则自动生成随机6位数字

# 4. 一键构建 + 启动
docker compose up -d --build

# 5. 打开浏览器
# http://你的服务器IP:3012
```

## 获取管理员密码

```bash
# 方法一：查看启动日志
docker logs storycine-app 2>&1 | grep -A3 "Password:"

# 方法二：重置密码
# 在 docker-compose.yml 中将 RESET_ADMIN_PWD=false 改为 true
docker compose up -d --build
docker logs storycine-app 2>&1 | grep -A3 "Password:"
# 拿到后改回 false
```

## 本地开发

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 启动数据库
docker compose up -d mongodb redis minio

# 3. 启动开发服务器
# 终端1: 后端 (http://localhost:3012)
cd backend && npm run dev

# 终端2: 前端 (http://localhost:5173)
cd frontend && npm run dev
```

## 环境要求

- Node.js >= 18.x
- MongoDB >= 7.0
- Docker & Docker Compose（Docker 部署方式）
