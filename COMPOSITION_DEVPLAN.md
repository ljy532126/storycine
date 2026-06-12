# 剪辑室 — 真实合成开发清单

## 当前状态
- ✅ 前端 UI 参数全部保存到数据库（格式/分辨率/帧率/转场/BGM/字幕）
- ✅ WebSocket 进度推送框架已就绪
- ❌ 后端合成逻辑 100% 模拟，输出假文件

---

## 待开发

### 1. FFmpeg 环境
- [ ] 服务器安装 FFmpeg（`apt install ffmpeg` / Docker 镜像内嵌）
- [ ] 验证 `ffmpeg -version` 可用
- [ ] 准备测试素材（2-3 个镜头 + 1 条音频）

### 2. 真实合成引擎（backend/services/composition.service.js）
- [ ] 读取 Storyboard 所有 shot，按 shotNumber 排序
- [ ] 收集每镜的 `renderedImage` 和 `renderedVideo`（无视频用图片+时长补帧）
- [ ] 收集每镜 `dialogue.audioUrl`（TTS 配音）
- [ ] **帧率处理** — 统一素材帧率到 `frameRate` 参数
- [ ] **分辨率处理** — 所有素材统一缩放/裁剪到 `resolution`
- [ ] **转场效果** — fade/cut/slide/dissolve 四种转场滤镜
- [ ] **字幕叠加** — 读取每镜 dialogue.text，用 drawtext 滤镜叠加
- [ ] **背景音乐** — 混入 `backgroundMusic` 音频轨，音量降至 30%
- [ ] 最终输出为 `outputFormat` 格式文件
- [ ] 真实百分比进度推送（已处理镜头数 / 总镜头数）

### 3. 输出存储
- [ ] 合成完成后上传到对象存储（如已配置）或 `uploads/` 目录
- [ ] 返回真实公网 URL 写入 `outputUrl` 字段
- [ ] 支持下载/在线预览

### 4. 错误处理
- [ ] 素材缺失时跳过该镜，记录到 `errorMessage`
- [ ] FFmpeg 进程超时（单次 5 分钟上限）
- [ ] 合成失败状态回写 + Socket 通知

### 5. 前端增强（可选）
- [ ] 合成按钮加预估耗时提示
- [ ] 进度条显示实时百分比 + 当前处理镜头
- [ ] 合成完成弹窗预览前 5 秒
- [ ] 支持一键重试失败任务

---

## 预估工作量
| 阶段 | 时间 |
|------|------|
| FFmpeg 环境搭建 | 0.5 天 |
| 核心合成引擎（帧率/分辨率/转场/字幕/BGM） | 2 天 |
| 输出存储 + 错误处理 | 0.5 天 |
| 前后端联调 + 测试 | 1 天 |
| **合计** | **4 天** |

---

## 依赖
- FFmpeg ≥ 5.0
- 每个 Storyboard Shot 必须有 `renderedImage` 或 `renderedVideo`
- 字幕需要 TTS 生成 `dialogue.audioUrl`
- 对象存储建议先配置好（避免本地磁盘爆满）
