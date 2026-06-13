---
layout: home

hero:
  name: "StoryCine"
  text: "全自动 AI 短剧生成平台"
  tagline: 从灵感到成片，覆盖剧本生成 → 分镜设计 → AI 生图/生视频 → 成片合成全流程
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/
    - theme: alt
      text: GitHub
      link: https://github.com/ljy532126/storycine

features:
  - icon: 🎬
    title: 全流程 AI 自动化
    details: 7 个 AI Agent 编排，从标签到完整剧本一气呵成。支持续写、导入、故事转剧本。
  - icon: 🎨
    title: 28 种导演风格预设
    details: 写实/古风/赛博朋克/水墨风...一键切换全局视觉风格，AI 自动优化导演设定。
  - icon: 🤖
    title: 豆包模型深度集成
    details: Seedream 4.0 生图、Seedance 2.0 生视频，支持参考图角色一致性约束。
  - icon: 🎥
    title: 可视化故事板
    details: 分镜时间线拖拽编辑、批量生成、素材版本管理、真实 FFmpeg 合成引擎。
  - icon: 👥
    title: 完整的用户系统
    details: JWT 认证、角色权限、登录风控、密码锁定、管理员用户管理。
  - icon: ☁️
    title: 对象存储双模式
    details: 本地 / 阿里云 OSS / 腾讯云 COS / MinIO 一键切换，上传失败自动降级。
---

## 开始使用

```bash
git clone https://github.com/ljy532126/storycine.git
cd storycine
docker compose up -d --build
```

打开 `http://你的服务器IP:3012`，默认账号 `admin`，密码查看启动日志。

详细教程请查看 [使用教程](/guide/)。
