<template>
  <div class="landing">
    <!-- Nav -->
    <nav class="nav" :class="{ scrolled }">
      <div class="nav-inner">
        <div class="nav-brand" @click="scrollTo('hero')">
          <span class="brand-icon">◆</span>
          <span class="brand-text">StoryCine</span>
        </div>
        <div class="nav-links" :class="{ open: menuOpen }">
          <a href="#" @click.prevent="scrollTo('features')">功能</a>
          <a href="#" @click.prevent="scrollTo('workflow')">流程</a>
          <a href="https://ljy532126.github.io/storycine/" target="_blank" rel="noopener">📖 教程</a>
          <a href="#" @click.prevent="scrollTo('highlights')">优势</a>
          <a href="https://github.com/ljy532126/storycine" target="_blank" rel="noopener" class="nav-gh" title="GitHub">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <router-link to="/dashboard" class="nav-cta">进入后台</router-link>
        </div>
        <button class="nav-toggle" @click="menuOpen=!menuOpen" :aria-label="menuOpen?'关闭菜单':'打开菜单'">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>

    <!-- Hero -->
    <header class="hero" id="hero">
      <div class="hero-bg">
        <div class="hero-glow hero-glow-1"></div>
        <div class="hero-glow hero-glow-2"></div>
      </div>
      <div class="hero-content">
        <div class="hero-badge">AI-POWERED SHORT DRAMA STUDIO</div>
        <h1>从<span class="hero-em">创意</span>到<span class="hero-em">成片</span><br>全自动 AI 短剧工坊</h1>
        <p class="hero-desc">7 个 AI Agent 协作，覆盖剧本生成 · 分镜设计 · 角色塑造 · 智能生图 · 视频合成，让每个人都能成为短剧导演</p>
        <div class="hero-actions">
          <router-link to="/dashboard" class="btn-primary">✨ 免费开始创作</router-link>
          <a href="https://ljy532126.github.io/storycine/" target="_blank" rel="noopener" class="btn-outline">📖 查看教程</a>
        </div>
        <div class="hero-stats">
          <div class="stat"><strong>7</strong><span>AI Agent</span></div>
          <div class="stat"><strong>4</strong><span>大模型</span></div>
          <div class="stat"><strong>28</strong><span>导演风格</span></div>
          <div class="stat"><strong>∞</strong><span>创作可能</span></div>
        </div>
      </div>
    </header>

    <!-- Features -->
    <section class="section" id="features">
      <div class="section-head">
        <span class="section-tag">核心功能</span>
        <h2>一站式短剧创作工作流</h2>
        <p>从灵感迸发到成片输出，每个环节都有 AI 助手</p>
      </div>
      <div class="features-grid">
        <div class="feature-card" v-for="(f, i) in features" :key="i">
          <span class="f-icon">{{ f.icon }}</span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Tutorial -->
    <section class="tutorial" id="tutorial">
      <div class="tutorial-inner">
        <div class="tutorial-text">
          <span class="section-tag" style="background:rgba(255,255,255,0.1);color:#fff">官方教程</span>
          <h2>快速上手指南</h2>
          <p>从零开始学习使用 StoryCine，完整的文档和视频教程助你快速成为 AI 短剧导演</p>
          <ul class="tutorial-list">
            <li>🎬 项目创建与剧本生成</li>
            <li>🎨 角色设计与分镜编辑</li>
            <li>🤖 AI 生图与视频生成</li>
            <li>🎥 剪辑室合成与导出</li>
          </ul>
          <a href="https://ljy532126.github.io/storycine/" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;margin-top:16px">前往教程文档 →</a>
        </div>
        <div class="tutorial-visual">
          <div class="tutorial-card">
            <span class="tutorial-icon">📚</span>
            <h3>StoryCine 官方文档</h3>
            <p>ljy532126.github.io/storycine</p>
            <span class="tutorial-arrow">→</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Workflow -->
    <section class="workflow" id="workflow">
      <div class="section-head">
        <span class="section-tag" style="background:rgba(201,168,76,0.15);color:var(--gold)">创作流程</span>
        <h2 style="color:#fff">四步完成一部短剧</h2>
        <p style="color:rgba(255,255,255,0.6)">像导演一样创作，AI 为你处理繁琐细节</p>
      </div>
      <div class="steps">
        <div class="step" v-for="(s, i) in steps" :key="i">
          <div class="step-num">{{ s.num }}</div>
          <h3>{{ s.title }}</h3>
          <p>{{ s.desc }}</p>
          <div class="step-line" v-if="i < steps.length-1"></div>
        </div>
      </div>
    </section>

    <!-- Highlights -->
    <section class="section" id="highlights">
      <div class="section-head">
        <span class="section-tag">产品优势</span>
        <h2>为什么选择 StoryCine</h2>
      </div>
      <div class="adv-grid">
        <div class="adv-item" v-for="a in advantages" :key="a.title">
          <span class="adv-icon">{{ a.icon }}</span>
          <strong>{{ a.title }}</strong>
          <p>{{ a.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Contribute -->
    <section class="section">
      <div class="section-head">
        <span class="section-tag">开源社区</span>
        <h2>参与贡献</h2>
        <p>StoryCine 是开源项目，欢迎每一位开发者</p>
      </div>
      <div class="contrib-grid">
        <div class="contrib-card" v-for="c in contributes" :key="c.title">
          <span>{{ c.icon }}</span>
          <h4>{{ c.title }}</h4>
          <p>{{ c.desc }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <h2>准备好开始你的导演之旅了吗？</h2>
      <p>零门槛、全自动，你的第一部 AI 短剧从这里开机</p>
      <router-link to="/dashboard" class="btn-primary" style="font-size:18px;padding:18px 48px">🎬 开拍新短剧</router-link>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-top">
        <div class="footer-brand">
          <span>◆</span> StoryCine
          <small>全自动 AI 短剧生成平台</small>
        </div>
        <div class="footer-nav">
          <strong>导航</strong>
          <a href="#" @click.prevent="scrollTo('features')">功能</a>
          <a href="#" @click.prevent="scrollTo('workflow')">流程</a>
          <a href="https://ljy532126.github.io/storycine/" target="_blank" rel="noopener">教程</a>
          <router-link to="/dashboard">后台</router-link>
        </div>
        <div class="footer-nav">
          <strong>链接</strong>
          <a href="https://github.com/ljy532126/storycine" target="_blank" rel="noopener">GitHub</a>
          <a href="https://ljy532126.github.io/storycine/" target="_blank" rel="noopener">文档</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 StoryCine · Built with Vue 3 · Element Plus · LangGraph.js · 豆包 Seedream 4.0 / Seedance 2.0</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const menuOpen = ref(false)
const scrolled = ref(false)

function onScroll() { scrolled.value = window.scrollY > 60 }
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

const features = [
  { icon: '📝', title: 'AI 剧本生成', desc: '7 个 AI Agent 串联工作流，标签选择到完整剧本自动生成，支持续写与智能校验。' },
  { icon: '🎬', title: '智能分镜台本', desc: 'AI 自动拆解剧本为分镜镜头，推荐景别、运镜、时长。可视化编辑，一键同步至镜头板。' },
  { icon: '🎨', title: 'AI 生图 & 生视频', desc: '接入豆包 Seedream 4.0 和 Seedance 2.0。批量生图、视频生成，支持角色参考图约束。' },
  { icon: '👥', title: '演员 & 场景资产库', desc: '角色三视图管理、场景参考图、道具素材。跨项目复用，确保系列短剧视觉统一。' },
  { icon: '☁️', title: '对象存储双模式', desc: '阿里云 OSS / 腾讯云 COS / MinIO 三选一。上传失败自动降级本地，零成本切换。' },
  { icon: '🎥', title: '成片自动合成', desc: '镜头板素材一键合成完整短片，转场、背景音乐、字幕全可控。从剧本到成片全链路。' },
]

const steps = [
  { num: '01', title: '灵感写本', desc: '选题材标签，AI 自动生成完整剧本，含角色对话与场景描述' },
  { num: '02', title: '分镜台本', desc: 'AI 智能拆镜 + 导演风格设定，打造专属视觉风格' },
  { num: '03', title: 'AI 生图 / 生视频', desc: '批量生成分镜图与视频片段，角色一致性自动保持' },
  { num: '04', title: '成片合成', desc: '拼接镜头、添加转场和配乐，导出最终短剧视频' },
]

const advantages = [
  { icon: '🤖', title: '7 Agent 协作', desc: 'LangGraph.js 编排，标签解析到剧本校验一气呵成' },
  { icon: '🎯', title: '角色一致性', desc: '参考图 + 外貌描述双重约束，确保角色面部统一' },
  { icon: '⚡', title: '批量自动化', desc: '一键批量生图/生视频，数百镜头同时处理' },
  { icon: '🔌', title: '多模型可插拔', desc: 'DeepSeek / 豆包 / 通义 / OpenAI 自由切换' },
  { icon: '🛡️', title: '内容安全', desc: '内置水印控制、人脸检测规避、风格化模式' },
  { icon: '📊', title: '数据看板', desc: '实时统计生成量、项目进度、服务器状态监控' },
]

const contributes = [
  { icon: '🍴', title: 'Fork 仓库', desc: 'Fork 项目到你的 GitHub，自由修改和实验' },
  { icon: '🐛', title: '提交 Issue', desc: '发现 Bug 或有功能建议？欢迎提交 Issue' },
  { icon: '🎯', title: '发起 PR', desc: '修复问题或新增功能后，发起 Pull Request 合并' },
  { icon: '💬', title: '社区讨论', desc: '加入讨论组，分享你的使用经验和创作故事' },
]

function scrollTo(id) {
  menuOpen.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<style scoped>
/* ===== Reset & Vars ===== */
.landing {
  --gold: #c9a84c;
  --gold-light: #d4b85e;
  --navy: #0d1117;
  --bg: #0d1117;
  --bg-card: #161b22;
  --border: #21262d;
  --text: #e6edf3;
  --text-dim: #8b949e;
  font-family: 'Inter', 'Microsoft YaHei', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  overflow-x: hidden;
}

/* ===== Nav ===== */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(13,17,23,0.92); backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: all .3s;
}
.nav.scrolled { border-bottom-color: rgba(201,168,76,.25); box-shadow: 0 1px 24px rgba(0,0,0,.4); }
.nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px;
}
.nav-brand { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.brand-icon { color: var(--gold); font-size: 14px; }
.brand-text { font-size: 18px; font-weight: 700; letter-spacing: .5px; color: var(--gold); }
.nav-links { display: flex; align-items: center; gap: 28px; }
.nav-links a {
  color: var(--text-dim); text-decoration: none; font-size: 14px; font-weight: 500;
  transition: color .2s;
}
.nav-links a:hover { color: var(--gold); }
.nav-gh { display: flex; align-items: center; padding: 4px; }
.nav-cta {
  padding: 8px 20px !important; border: 2px solid var(--gold) !important;
  color: var(--gold) !important; font-weight: 700 !important; font-size: 13px !important;
  transition: all .2s !important;
}
.nav-cta:hover { background: var(--gold) !important; color: var(--navy) !important; }
.nav-toggle { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 4px; }
.nav-toggle span { width: 24px; height: 2px; background: var(--gold); border-radius: 2px; transition: all .3s; }

/* ===== Hero ===== */
.hero {
  position: relative; min-height: 100vh; display: flex; align-items: center;
  justify-content: center; text-align: center; padding: 120px 24px 80px;
  overflow: hidden;
}
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.hero-glow {
  position: absolute; border-radius: 50%; filter: blur(120px); opacity: .15;
}
.hero-glow-1 { width: 600px; height: 600px; background: var(--gold); top: -100px; left: -100px; }
.hero-glow-2 { width: 500px; height: 500px; background: #58a6ff; bottom: -100px; right: -80px; opacity: .08; }
.hero-content { position: relative; z-index: 1; max-width: 800px; }
.hero-badge {
  display: inline-block; padding: 5px 16px; border-radius: 20px;
  background: rgba(201,168,76,.1); border: 1px solid rgba(201,168,76,.25);
  color: var(--gold); font-size: 11px; letter-spacing: 3px; margin-bottom: 28px;
}
.hero h1 {
  font-size: clamp(36px, 7vw, 72px); font-weight: 800; color: #fff;
  line-height: 1.1; letter-spacing: -1.5px; margin-bottom: 24px;
}
.hero-em { color: var(--gold); font-style: italic; position: relative; }
.hero-em::after { content:''; position:absolute; bottom:2px; left:0;right:0; height:3px; background:var(--gold); opacity:.3; }
.hero-desc { font-size: clamp(15px, 2vw, 18px); color: var(--text-dim); max-width: 600px; margin: 0 auto 36px; line-height: 1.9; }
.hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-bottom: 56px; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 15px 34px; background: var(--gold); color: var(--navy);
  font-size: 15px; font-weight: 700; border: none; cursor: pointer;
  text-decoration: none; letter-spacing: .5px; transition: all .25s;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(201,168,76,.35); }
.btn-outline {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 15px 34px; border: 2px solid rgba(201,168,76,.4); color: var(--gold);
  font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none;
  background: transparent; transition: all .25s;
}
.btn-outline:hover { border-color: var(--gold); background: rgba(201,168,76,.08); }

.hero-stats {
  display: flex; justify-content: center; gap: 40px;
  padding: 20px 36px; max-width: 520px; margin: 0 auto;
  background: rgba(255,255,255,.02); border: 1px solid rgba(201,168,76,.12);
}
.stat strong { display: block; font-size: 26px; color: var(--gold); font-weight: 800; }
.stat span { font-size: 11px; color: var(--text-dim); letter-spacing: 2px; }

/* ===== Section ===== */
.section { padding: 100px 24px; max-width: 1100px; margin: 0 auto; }
.section-head { text-align: center; margin-bottom: 56px; }
.section-tag {
  display: inline-block; padding: 4px 14px; border-radius: 20px;
  background: rgba(201,168,76,.1); color: var(--gold);
  font-size: 12px; letter-spacing: 2px; font-weight: 600; margin-bottom: 16px;
}
.section-head h2 { font-size: clamp(28px, 5vw, 40px); font-weight: 700; color: #fff; margin-bottom: 12px; }
.section-head p { font-size: 16px; color: var(--text-dim); }

/* ===== Features ===== */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.feature-card {
  background: var(--bg-card); border: 1px solid var(--border);
  padding: 36px 28px; transition: all .3s; position: relative; overflow: hidden;
}
.feature-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  opacity: 0; transition: opacity .3s;
}
.feature-card:hover { border-color: var(--gold); transform: translateY(-4px); }
.feature-card:hover::before { opacity: 1; }
.f-icon { font-size: 38px; margin-bottom: 14px; display: block; }
.feature-card h3 { font-size: 18px; color: #fff; margin-bottom: 8px; font-weight: 600; }
.feature-card p { font-size: 14px; color: var(--text-dim); line-height: 1.8; }

/* ===== Tutorial ===== */
.tutorial {
  background: linear-gradient(135deg, #1a1f35 0%, #0d1117 100%);
  border-top: 1px solid rgba(201,168,76,.2);
  border-bottom: 1px solid rgba(201,168,76,.2);
  padding: 80px 24px;
}
.tutorial-inner {
  max-width: 1000px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
}
.tutorial-text h2 { font-size: clamp(28px, 4vw, 38px); color: #fff; font-weight: 700; margin: 12px 0 16px; }
.tutorial-text p { font-size: 15px; color: var(--text-dim); line-height: 1.8; }
.tutorial-list { list-style: none; margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tutorial-list li { color: rgba(255,255,255,.75); font-size: 14px; }
.tutorial-visual { display: flex; justify-content: center; }
.tutorial-card {
  background: rgba(255,255,255,.04); border: 1px solid rgba(201,168,76,.2);
  padding: 40px; text-align: center; width: 100%; max-width: 360px;
  transition: all .3s; cursor: pointer; text-decoration: none; color: inherit;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.tutorial-card:hover { border-color: var(--gold); transform: translateY(-4px); box-shadow: 0 16px 48px rgba(201,168,76,.1); }
.tutorial-icon { font-size: 48px; }
.tutorial-card h3 { font-size: 18px; color: #fff; }
.tutorial-card p { font-size: 13px; color: var(--gold); }
.tutorial-arrow { font-size: 28px; color: var(--gold); opacity: 0; transition: all .3s; }
.tutorial-card:hover .tutorial-arrow { opacity: 1; }

/* ===== Workflow ===== */
.workflow {
  padding: 100px 24px;
  background: linear-gradient(180deg, #0d1117 0%, #111820 100%);
  border-top: 1px solid rgba(201,168,76,.2);
}
.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px; max-width: 1000px; margin: 56px auto 0;
}
.step {
  text-align: center; position: relative; padding: 32px 20px;
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  transition: all .3s;
}
.step:hover { border-color: var(--gold); }
.step-num {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--navy); border: 2px solid var(--gold); color: var(--gold);
  font-size: 20px; font-weight: 800; display: flex; align-items: center;
  justify-content: center; margin: 0 auto 16px;
}
.step h3 { font-size: 17px; color: var(--gold); margin-bottom: 8px; font-weight: 600; }
.step p { font-size: 13px; color: var(--text-dim); line-height: 1.7; }

/* ===== Advantages ===== */
.adv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px; max-width: 900px; margin: 0 auto;
}
.adv-item {
  display: flex; gap: 14px; align-items: flex-start; padding: 20px;
  background: var(--bg-card); border: 1px solid var(--border);
  transition: all .2s;
}
.adv-item:hover { border-color: var(--gold); }
.adv-icon { font-size: 28px; flex-shrink: 0; }
.adv-item strong { display: block; font-size: 15px; color: #fff; margin-bottom: 4px; }
.adv-item p { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin: 0; }

/* ===== Contribute ===== */
.contrib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 18px; max-width: 900px; margin: 0 auto;
}
.contrib-card {
  text-align: center; padding: 28px 16px;
  background: var(--bg-card); border: 1px solid var(--border);
  transition: all .2s;
}
.contrib-card:hover { border-color: var(--gold); transform: translateY(-2px); }
.contrib-card span { font-size: 34px; display: block; margin-bottom: 10px; }
.contrib-card h4 { font-size: 16px; color: #fff; margin-bottom: 6px; }
.contrib-card p { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin: 0; }

/* ===== CTA ===== */
.cta {
  padding: 100px 24px; text-align: center;
  background: linear-gradient(180deg, var(--bg-card) 0%, var(--navy) 100%);
  border-top: 1px solid rgba(201,168,76,.2);
}
.cta h2 { font-size: clamp(24px, 5vw, 36px); color: #fff; font-weight: 700; margin-bottom: 12px; }
.cta p { font-size: 16px; color: var(--text-dim); margin-bottom: 32px; }

/* ===== Footer ===== */
.footer {
  background: var(--navy); border-top: 2px solid var(--gold);
  padding: 48px 24px 24px;
}
.footer-top {
  max-width: 1100px; margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 40px; padding-bottom: 32px;
}
.footer-brand { color: var(--gold); font-size: 16px; font-weight: 700; letter-spacing: .5px; display: flex; flex-direction: column; gap: 4px; }
.footer-brand small { color: var(--text-dim); font-size: 12px; font-weight: 400; }
.footer-nav { display: flex; flex-direction: column; gap: 10px; }
.footer-nav strong { color: #fff; font-size: 13px; margin-bottom: 4px; }
.footer-nav a { color: var(--text-dim); text-decoration: none; font-size: 13px; transition: color .2s; }
.footer-nav a:hover { color: var(--gold); }
.footer-bottom {
  max-width: 1100px; margin: 0 auto; padding-top: 20px;
  border-top: 1px solid rgba(201,168,76,.15);
  text-align: center; color: var(--text-dim); font-size: 12px;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .nav-links.open {
    display: flex; flex-direction: column; position: absolute;
    top: 64px; left: 0; right: 0; background: rgba(13,17,23,.98);
    padding: 24px; gap: 16px; border-bottom: 2px solid var(--gold);
  }
  .nav-toggle { display: flex; }
  .hero { padding: 100px 20px 60px; min-height: auto; }
  .hero-stats { gap: 20px; padding: 16px 20px; }
  .section { padding: 60px 20px; }
  .tutorial-inner { grid-template-columns: 1fr; gap: 32px; }
  .tutorial-list { grid-template-columns: 1fr; }
  .steps { grid-template-columns: 1fr 1fr; }
  .footer-top { grid-template-columns: 1fr; gap: 24px; }
}

@media (max-width: 480px) {
  .steps { grid-template-columns: 1fr; }
  .features-grid { grid-template-columns: 1fr; }
  .adv-grid { grid-template-columns: 1fr; }
  .contrib-grid { grid-template-columns: 1fr 1fr; }
  .hero-actions { flex-direction: column; align-items: center; }
}
</style>
