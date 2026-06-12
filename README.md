<p align="center">
  <img src="frontend/public/logo.svg" width="100" alt="StoryCine Logo" />
</p>

<h1 align="center">StoryCine</h1>
<p align="center"><strong>全自动 AI 短剧生成平台</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue" />
  <img src="https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
  <img src="https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs" />
</p>

<p align="center">
  <a href="#-features">功能</a> •
  <a href="#-tech-stack">技术栈</a> •
  <a href="#-quick-start">快速开始</a> •
  <a href="#%EF%B8%8F-project-structure">项目结构</a> •
  <a href="#-deployment">部署</a> •
  <a href="#-contributing">贡献</a> •
  <a href="#-license">许可证</a>
</p>

---

StoryCine 是一款端到端的 AI 短剧创作工具。从灵感到成片，覆盖**剧本生成 → 分镜设计 → AI 生图/生视频 → 成片合成**全流程。无需专业技能，选标签、点生成，即可完成短剧创作。

## ✨ 核心亮点

- **全流程 AI 自动化** — 7 个 AI Agent (LangGraph.js 编排)，从标签到完整剧本一气呵成
- **豆包模型深度集成** — Seedream 4.0 生图、Seedance 2.0 生视频，支持参考图角色一致性约束
- **28 种导演风格预设** — 写实/古风/赛博朋克/水墨风...一键切换全局视觉风格
- **可视化故事板** — 分镜时间线拖拽编辑、批量生成、素材版本管理
- **对象存储双模式** — 本地 / 阿里云 OSS / 腾讯云 COS / MinIO 一键切换，上传失败自动降级
- **用户系统** — JWT 认证、角色权限、登录风控、密码锁定
- **实时数据看板** — 生成量统计、服务器监控、AI 调用追踪

## 📸 截图预览

<details>
<summary>点击展开截图（提交截图后自动显示）</summary>
<br>

| 官网首页 | 故事板 | 角色管理 | 导演台
|:---:|:---:|:---:|:---:|
| ![首页](docs/images/landing.png) | ![故事板](docs/images/storyboard.png) | ![角色](docs/images/assets.png) | ![导演台](docs/images/dashboard.png) |


</details>

## 🎯 功能概览

### 剧本工坊
- 7 Agent 串联工作流：标签解析 → 大纲 → 人物 → 剧情架构 → 撰写 → 校验
- 支持续写（基于前文上下文自动延续）
- **格式导入**：粘贴结构化剧本（场次/时间/地点/人物/台词），自动解析
- **故事转剧本**：粘贴小说/故事片段，AI 改编为标准剧本格式，保持原故事方向
- 导入时可自定义剧集标题，自动递增集号

### 分镜台本
- AI 智能拆镜：根据剧本内容自动推荐景别/运镜/光影/时长
- 可视化编辑，实时参数调整
- 导演全局设定（画质关键词/氛围光影/艺术风格），一键应用到全剧
- 一键推送至镜头板，支持选择目标脚本同步

### 演员库 (角色 & 场景资产管理)
- 角色三视图智能生成（正面/侧面/背面）
- 支持上传参考图，AI 继承面部特征
- 场景、道具跨项目复用

### 镜头板 (故事板工作台)
- 分镜时间线拖拽排序
- 独立编辑图片/视频提示词，AI 辅助优化
- 批量生图/生视频，支持参考角色和场景
- 视频异步生成 + 轮询 + 自动云存储

### 对象存储
- 阿里云 OSS / 腾讯云 COS (18 个地域) / MinIO
- 地域自动映射，Endpoint 自动填充
- 测试连接 + 上传失败自动降级本地

### AI 副导 (生成配置)
- 水印控制 (API 级关闭 + Prompt 级禁止)
- 默认画质/风格参数
- 生图/生视频风格化模式

### 数据看板
- 今日概览、7 天趋势、热门题材 Top5
- 服务器监控 (CPU/内存/运行时长)
- AI 调用统计 (生图/生视频/LLM 成功失败)
- 接口监控 (请求量/健康度)

### 用户系统
- JWT 登录/注册 + 图形验证码
- 登录风控 (连续输错锁定 30 分钟)
- IP 限流 (注册 10次/时，登录 20次/15分)
- 管理员用户管理 (启用/禁用/封禁 + 登录日志)

## 🛠 技术栈

| 层级 | 技术 |
|---|---|
| **前端** | Vue 3 + Vite + Pinia + Element Plus + Vue Router |
| **后端** | Node.js + Express + Socket.IO |
| **AI 编排** | LangGraph.js (7 Agent 状态图工作流) |
| **数据库** | MongoDB 7.0 + Mongoose ODM |
| **缓存** | Redis (可选) |
| **对象存储** | 阿里云 OSS / 腾讯云 COS / MinIO |
| **AI 模型** | DeepSeek / 豆包 Seedance / 豆包 Seedream / OpenAI / 通义 |
| **部署** | Docker + Docker Compose（含 MongoDB/Redis/MinIO 全套） |

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.x
- **MongoDB** >= 7.0
- **Redis** >= 7.x (可选)

### 方式一：本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/ljy532126/storycine.git
cd storycine

# 2. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 3. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，至少填入一个 LLM 的 API Key

# 4. 启动数据库（选一种）
# 选项A: Docker 只启动数据库
docker compose up -d mongodb redis minio
# 选项B: 本地已安装 MongoDB/Redis，修改 .env 中的连接地址

# 5. 启动开发服务器
# 终端1: 后端 (http://localhost:3012)
cd backend && npm run dev

# 终端2: 前端 (http://localhost:5173)
cd frontend && npm run dev
```

### 方式二：Docker 一键部署

> 前提：服务器需安装 **git**、**docker**、**docker-compose**

```bash
# 1. 克隆仓库
git clone https://github.com/ljy532126/storycine.git
cd storycine

# 2. 配置环境变量（重要！）
cp backend/.env.example backend/.env
# 编辑 backend/.env，必须设置 JWT_SECRET 和至少一个 LLM API Key

# 3. 一键构建 + 启动
docker compose up -d --build

# 4. 打开浏览器 http://你的服务器IP:3012
```

### 方式三：服务器无法访问 GitHub（国内常见）

> 在本机下载代码后通过 SCP 上传到服务器

```bash
# === 本机执行（Windows PowerShell / macOS Terminal）===

# 1. 打包代码（排除 node_modules 和 .git）
cd 项目目录
tar --exclude=node_modules --exclude=.git --exclude=frontend/node_modules -czf storycine.tar.gz .

# 2. 上传到服务器
scp storycine.tar.gz root@你的服务器IP:/www/wwwroot/

# === 服务器执行 ===
cd /www/wwwroot
mkdir -p storycine && cd storycine
tar -xzf ../storycine.tar.gz

# 3. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env：必须设置 JWT_SECRET！

# 4. 构建 + 启动
sh deploy.sh
```

### ⚠️ 首次部署必读

1. **JWT_SECRET**：在 `backend/.env` 中设置 `JWT_SECRET=你的随机字符串`（至少 32 位），不设置则服务无法启动
2. **管理员密码**：首次启动时系统自动创建 `admin` 账号
   - **推荐**：在 `backend/.env` 中设置 `ADMIN_PASSWORD=你的密码`，首次启动即用此密码
   - **没设置**：系统自动生成随机 6 位数字密码，启动日志会打印 `Password: XXXXXX`
   - 查看密码：`docker logs storycine-app 2>&1 | grep -A3 "Password:"`
   - 如果命令无输出：说明 admin 已存在（不是首次启动），用下面「忘记密码」方法重置
   - 登录后**请立即修改密码**
3. **LLM API Key**：登录后在「系统设置」页面配置 DeepSeek / 豆包 等 API Key，每个用户独立配置

### 🔑 忘记管理员密码怎么办

**方法一：通过环境变量重置（推荐）**
在 `docker-compose.yml` 中找到 `RESET_ADMIN_PWD=false`，改为 `true`，然后重建容器：
```bash
docker compose up -d --build
```
查看新密码：
```bash
docker logs storycine-app 2>&1 | grep -A3 "Password:"
```
重置完成后**改回 `false`**，否则每次启动都会换一个新密码。

**方法二：进入 MongoDB 直接修改**
```bash
docker exec -it storycine-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin
use storycine
db.users.updateOne({ username: "admin" }, { $set: { password: ... } })
```
注意：密码需用 bcrypt 加密，推荐用方法一。

```bash
# 后续更新
cd /path/to/storycine && git pull && docker compose up -d --build
```

> 数据持久化：MongoDB、Redis、MinIO、uploads 均使用 Docker 命名卷，重建容器不会丢失数据。

## 🏗️ 项目结构

```
├── backend/
│   ├── server.js                    # Express 入口 + Socket.IO
│   ├── config/
│   │   ├── app.config.js            # 应用配置 (LLM 运行时管理)
│   │   └── database.js              # MongoDB 连接
│   ├── middleware/
│   │   ├── auth.middleware.js        # JWT 认证 + tokenVersion 安全校验
│   │   ├── ownership.middleware.js    # 资源所有权校验
│   │   ├── rate-limiter.middleware.js # AI 接口限流
│   │   └── error-handler.js         # 全局错误处理
│   ├── models/                      # Mongoose 模型 (11 个)
│   │   ├── user.model.js            # 用户 (bcrypt 加密)
│   │   ├── login-log.model.js       # 登录日志
│   │   ├── project.model.js         # 项目
│   │   ├── script.model.js          # 剧本 (核心，嵌套 scenes/dialogues)
│   │   ├── character.model.js       # 角色 (多形态 morphs)
│   │   ├── scene.model.js           # 场景资产
│   │   ├── prop.model.js            # 道具
│   │   ├── storyboard.model.js      # 分镜表 (shots/materials)
│   │   ├── composition.model.js     # 成片合成
│   │   └── settings.model.js        # 配置持久化
│   ├── routes/                      # API 路由 (10 组)
│   ├── services/
│   │   ├── ai/
│   │   │   ├── langgraph.engine.js  # 工作流编排
│   │   │   └── agents/              # 7 个 AI Agent
│   │   └── storage.service.js       # 对象存储服务
│   └── utils/
│       ├── llm-client.js            # LLM 调用封装
│       └── prompt-templates.js      # Prompt 模板库
├── frontend/
│   ├── src/
│   │   ├── views/                   # 页面组件
│   │   ├── stores/                  # Pinia 状态管理
│   │   ├── components/              # 共享组件
│   │   ├── api/                     # Axios 封装 + 接口定义
│   │   └── router/                  # 路由 + Auth Guard
│   └── public/
│       └── logo.svg
├── docs/
│   ├── images/                      # 截图
│   └── 风格.md                       # 设计规范
├── docker-compose.yml
├── start.bat                        # Windows 一键启动
├── start.sh                         # Linux/macOS 一键启动
├── Dockerfile
└── README.md
```

## ☁️ 配置 LLM

支持 4 个 provider：**DeepSeek**、**豆包 (Doubao)**、**通义 (Tongyi)**、**OpenAI**。

两种配置方式：

1. **界面配置**（推荐）：打开后台 → 系统设置 → 选择 provider → 填写 API Key → 保存（持久化到 MongoDB）
2. **环境变量**：编辑 `backend/.env`，填入 `DEEPSEEK_API_KEY` / `DOUBAO_API_KEY` 等

同时配置多个时优先级：DeepSeek > 豆包 > 通义 > OpenAI

## 🤝 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交代码：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

提交前请确保：
- 前端 `npm run build` 通过
- 后端 `node -e "require('./server')"` 语法检测通过
- 新增功能有必要的错误处理

### 开发建议

- **新增 AI 模型**：在 `config/app.config.js` 添加 provider → `llm-client.js` 适配 → `settings.model.js` 持久化字段
- **新增对象存储**：在 `storage.service.js` 添加地域映射表 + upload/测试函数 → `models/settings.model.js` 添加 enum
- **新增统计指标**：在 `statistics.routes.js` 添加路由 → 前端 `Statistics.vue` 添加卡片

## 📄 许可证

MIT License — 详见 [LICENSE](LICENSE)

## 🙏 致谢

本项目使用了以下优秀开源项目：

- [Vue.js](https://vuejs.org/) — 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) — Vue 3 UI 组件库
- [Express](https://expressjs.com/) — Node.js Web 框架
- [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) — AI Agent 工作流编排
- [Mongoose](https://mongoosejs.com/) — MongoDB ODM
- [Socket.IO](https://socket.io/) — 实时通信
- [MinIO](https://min.io/) — 高性能对象存储
- [svg-captcha](https://github.com/produck/svg-captcha) — 图形验证码
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — 密码哈希
