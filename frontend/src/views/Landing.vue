<template>
  <div class="landing">
    <!-- Nav -->
    <nav class="l-nav" :class="{ scrolled: scrolled }">
      <div class="l-nav-inner">
        <div class="l-nav-logo">
          <span class="l-nav-diamond">◆</span>
          <div>
            <h1>StoryCine</h1>
            <span class="l-nav-sub">AI 短剧工坊</span>
          </div>
        </div>
        <ul class="l-nav-links" :class="{ open: menuOpen }">
          <li><a href="#" @click.prevent="scrollTo('hero')">首页</a></li>
          <li><a href="#" @click.prevent="scrollTo('features')">功能</a></li>
          <li><a href="#" @click.prevent="scrollTo('workflow')">流程</a></li>
          <li><a href="#" @click.prevent="scrollTo('highlights')">优势</a></li>
          <li><a href="https://github.com/ljy532126/storycine" target="_blank" rel="noopener" class="l-nav-gh" title="GitHub">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        </a></li>
        <li><router-link to="/dashboard" class="l-nav-cta">进入后台 →</router-link></li>
        </ul>
        <div class="l-nav-toggle" @click="menuOpen = !menuOpen"><span></span><span></span><span></span></div>
      </div>
    </nav>

    <!-- Hero -->
    <header class="l-hero" id="hero">
      <div class="l-hero-deco l-hero-deco-l"></div>
      <div class="l-hero-deco l-hero-deco-r"></div>
      <div class="l-hero-badge">AI-POWERED SHORT DRAMA STUDIO</div>
      <h2>从<em>创意</em>到<em>成片</em><br>全自动 AI 短剧工坊</h2>
      <p>7 个 AI Agent 协作，覆盖剧本生成 · 分镜设计 · 角色塑造 · 智能生图 · 视频合成<br>让每个人都能成为短剧导演</p>
      <div class="l-hero-btns">
        <router-link to="/dashboard" class="l-btn-primary">✨ 免费开始创作</router-link>
        <a href="#" class="l-btn-outline" @click.prevent="scrollTo('features')">探索功能 ↓</a>
      </div>
      <div class="l-hero-stats">
        <div class="l-hs-item"><strong>7</strong><span>AI Agent</span></div>
        <div class="l-hs-divider"></div>
        <div class="l-hs-item"><strong>4</strong><span>大模型</span></div>
        <div class="l-hs-divider"></div>
        <div class="l-hs-item"><strong>28</strong><span>导演风格</span></div>
        <div class="l-hs-divider"></div>
        <div class="l-hs-item"><strong>∞</strong><span>创作可能</span></div>
      </div>
    </header>

    <!-- Features -->
    <section class="l-section" id="features">
      <div class="l-section-deco">◆</div>
      <div class="l-section-label">核心功能</div>
      <h2 class="l-section-title">一站式短剧创作工作流</h2>
      <p class="l-section-sub">从灵感迸发到成片输出，每个环节都为你准备好了 AI 助手</p>
      <div class="l-features">
        <div class="l-feat-card" v-for="(f, i) in features" :key="f.title" :style="{ animationDelay: i * 80 + 'ms' }">
          <span class="l-feat-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="l-feat-icon">{{ f.icon }}</span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Workflow -->
    <section class="l-workflow" id="workflow">
      <div class="l-section-deco">◆</div>
      <div class="l-section-label">How It Works</div>
      <h2 class="l-section-title" style="color:#fff">创作流程</h2>
      <p class="l-section-sub" style="color:var(--primary-300)">四步完成一部短剧，像导演一样创作</p>
      <div class="l-steps">
        <div class="l-step" v-for="(s, i) in steps" :key="i">
          <div class="l-step-num">{{ s.num }}</div>
          <div class="l-step-card">
            <h3>{{ s.title }}</h3>
            <p>{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Highlights -->
    <section class="l-section" id="highlights" style="padding-top:100px">
      <div class="l-section-deco">◆</div>
      <div class="l-section-label">Why Choose Us</div>
      <h2 class="l-section-title">产品优势</h2>
      <div class="l-advantages">
        <div class="l-adv-item" v-for="a in advantages" :key="a.title">
          <span class="l-adv-icon">{{ a.icon }}</span>
          <div>
            <strong>{{ a.title }}</strong>
            <p>{{ a.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="l-cta-end">
      <div class="l-section-deco">✦</div>
      <h2 class="l-section-title" style="color:#fff">准备好开始你的导演之旅了吗？</h2>
      <p style="color:var(--primary-300);font-size:16px;margin-bottom:32px">零门槛、全自动，你的第一部 AI 短剧，从这里开机</p>
      <router-link to="/dashboard" class="l-btn-primary" style="font-size:17px;padding:18px 44px">🎬 开拍新短剧</router-link>
    </section>

    <!-- Contribute -->
    <section class="l-section" id="contribute">
      <div class="l-section-deco">◆</div>
      <div class="l-section-label">Open Source</div>
      <h2 class="l-section-title">参与贡献</h2>
      <p class="l-section-sub">StoryCine 是开源项目，欢迎每一位开发者的加入和贡献</p>
      <div class="l-contribute">
        <div class="l-ctb-card">
          <span style="font-size:32px">🍴</span>
          <h4>Fork 仓库</h4>
          <p>Fork 项目到你的 GitHub，自由修改和实验</p>
        </div>
        <div class="l-ctb-card">
          <span style="font-size:32px">🐛</span>
          <h4>提交 Issue</h4>
          <p>发现 Bug 或有功能建议？欢迎提交 Issue</p>
        </div>
        <div class="l-ctb-card">
          <span style="font-size:32px">🎯</span>
          <h4>发起 PR</h4>
          <p>修复问题或新增功能后，发起 Pull Request 合并到主分支</p>
        </div>
        <div class="l-ctb-card">
          <span style="font-size:32px">💬</span>
          <h4>社区讨论</h4>
          <p>加入讨论组，分享你的使用经验和创作故事</p>
        </div>
      </div>
    </section>

    <!-- GitHub -->
    <section class="l-section" style="text-align:center;padding:40px 40px 60px" id="github">
      <a class="l-gh-box" href="https://github.com/ljy532126/storycine" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        <div>
          <strong>StoryCine on GitHub</strong>
          <span>全自动AI短剧生成平台 · 开源项目 · Star &amp; Fork</span>
        </div>
      </a>
    </section>

    <!-- Footer -->
    <footer class="l-footer">
      <div class="l-footer-grid">
        <div class="l-footer-brand">
          <span class="l-nav-diamond" style="font-size:10px">◆</span>
          StoryCine
        </div>
        <div class="l-footer-links">
          <router-link to="/dashboard">进入后台</router-link>
          <a href="#" @click.prevent="scrollTo('features')">功能</a>
          <a href="#" @click.prevent="scrollTo('workflow')">流程</a>
          <a href="https://github.com/ljy532126/storycine" target="_blank">GitHub</a>
        </div>
      </div>
      <div class="l-footer-bottom">
        <p>Copyright &copy; 2026 StoryCine All Rights Reserved.</p>
        <p>Built with Vue 3 · Element Plus · LangGraph.js · 豆包 Seedream 4.0 / Seedance 2.0</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const menuOpen = ref(false);
const scrolled = ref(false);

function onScroll() { scrolled.value = window.scrollY > 60; }
onMounted(() => window.addEventListener('scroll', onScroll));
onUnmounted(() => window.removeEventListener('scroll', onScroll));

const features = [
  { icon: '📝', title: 'AI 剧本生成', desc: '7 个 AI Agent 串联工作流，标签选择 → 完整剧本自动生成，支持续写与智能校验。' },
  { icon: '🎬', title: '智能分镜台本', desc: 'AI 自动拆解剧本为分镜镜头，推荐景别、运镜、时长。可视化编辑，一键同步至镜头板。' },
  { icon: '🎨', title: 'AI 生图 & 生视频', desc: '接入豆包 Seedream 4.0 和 Seedance 2.0。批量生图、视频生成，支持角色参考图约束。' },
  { icon: '👥', title: '演员 & 场景资产库', desc: '角色三视图管理、场景参考图、道具素材。跨项目复用，确保系列短剧视觉统一。' },
  { icon: '☁️', title: '对象存储双模式', desc: '阿里云 OSS / 腾讯云 COS / MinIO 三选一。上传失败自动降级本地，零成本切换。' },
  { icon: '🎥', title: '成片自动合成', desc: '镜头板素材一键合成完整短片，转场、背景音乐、字幕全可控。从剧本到成片全链路。' },
];

const steps = [
  { num: '01', title: '灵感写本', desc: '选题材标签，AI 自动生成完整剧本，含角色对话与场景描述' },
  { num: '02', title: '分镜台本', desc: 'AI 智能拆镜 + 导演风格设定，打造专属视觉风格' },
  { num: '03', title: 'AI 生图 / 生视频', desc: '批量生成分镜图与视频片段，角色一致性自动保持' },
  { num: '04', title: '成片合成', desc: '拼接镜头、添加转场和配乐，导出最终短剧视频' },
];

const advantages = [
  { icon: '🤖', title: '7 Agent 协作', desc: 'LangGraph.js 编排，标签解析到剧本校验一气呵成' },
  { icon: '🎯', title: '角色一致性', desc: '参考图 + 外貌描述双重约束，确保角色面部统一' },
  { icon: '⚡', title: '批量自动化', desc: '一键批量生图/生视频，数百镜头同时处理' },
  { icon: '🔌', title: '多模型可插拔', desc: 'DeepSeek / 豆包 / 通义 / OpenAI 自由切换' },
  { icon: '🛡️', title: '内容安全', desc: '内置水印控制、人脸检测规避、风格化模式' },
  { icon: '📊', title: '数据看板', desc: '实时统计生成量、项目进度、服务器状态监控' },
];

function scrollTo(id) {
  menuOpen.value = false;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
</script>

<style scoped>
.landing { font-family: 'DM Sans', 'Microsoft YaHei', sans-serif; background: var(--bg-100); color: var(--text-200); line-height: 1.7; overflow-x: hidden; }

/* Nav */
.l-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(26,26,46,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid transparent; transition: all 0.3s; }
.l-nav.scrolled { border-bottom-color: var(--gold); box-shadow: 0 2px 20px rgba(0,0,0,0.3); }
.l-nav-inner { display: flex; align-items: center; justify-content: space-between; padding: 0 40px; height: 64px; max-width: 1200px; margin: 0 auto; }
.l-nav-logo { display: flex; align-items: center; gap: 10px; }
.l-nav-diamond { color: var(--gold); font-size: 12px; }
.l-nav-logo h1 { font-family: 'Playfair Display', serif; color: var(--gold); font-size: 18px; letter-spacing: 1px; line-height: 1.2; }
.l-nav-sub { color: var(--primary-300); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
.l-nav-links { display: flex; gap: 32px; list-style: none; align-items: center; }
.l-nav-links a { color: var(--gold-light); text-decoration: none; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; transition: color 0.2s; }
.l-nav-links a:hover { color: var(--gold); }
.l-nav-gh { color: var(--gold-light); padding: 4px; transition: color 0.2s; display: flex; align-items: center; }
.l-nav-gh:hover { color: var(--gold); }
.l-nav-cta { padding: 8px 20px !important; border: 2px solid var(--gold) !important; color: var(--gold) !important; font-weight: 700 !important; }
.l-nav-cta:hover { background: var(--gold) !important; color: var(--navy) !important; }
.l-nav-toggle { display: none; flex-direction: column; gap: 5px; cursor: pointer; }
.l-nav-toggle span { width: 24px; height: 2px; background: var(--gold); }

/* Hero */
.l-hero { padding: 180px 40px 80px; text-align: center; background: linear-gradient(180deg, var(--navy) 0%, #1a1a2e 40%, #1a1f30 70%, var(--bg-100) 100%); position: relative; overflow: hidden; }
.l-hero-deco { position: absolute; pointer-events: none; opacity: 0.06; }
.l-hero-deco-l { left: 5%; top: 20%; font-size: 280px; color: var(--gold); font-family: 'Playfair Display', serif; }
.l-hero-deco-r { right: 5%; bottom: -10%; font-size: 200px; color: var(--gold); font-family: 'Playfair Display', serif; }
.l-hero-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.3); color: var(--gold); font-size: 12px; letter-spacing: 3px; margin-bottom: 32px; }
.l-hero h2 { font-family: 'Playfair Display', serif; font-size: 68px; font-weight: 900; color: #fff; line-height: 1.12; margin-bottom: 24px; letter-spacing: -1.5px; }
.l-hero h2 em { font-style: italic; color: var(--gold); position: relative; }
.l-hero h2 em::after { content: ''; position: absolute; bottom: 4px; left: 0; right: 0; height: 3px; background: var(--gold); opacity: 0.3; }
.l-hero p { font-size: 17px; color: var(--primary-300); max-width: 680px; margin: 0 auto 36px; line-height: 1.8; }
.l-hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 60px; }
.l-btn-primary { padding: 16px 36px; border: none; background: var(--gold); color: var(--navy); font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; letter-spacing: 1px; transition: all 0.25s; display: inline-flex; align-items: center; gap: 8px; }
.l-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(201,168,76,0.35); }
.l-btn-outline { padding: 16px 36px; border: 2px solid rgba(201,168,76,0.4); color: var(--gold); font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; letter-spacing: 1px; transition: all 0.25s; background: transparent; }
.l-btn-outline:hover { border-color: var(--gold); background: rgba(201,168,76,0.1); }
.l-hero-stats { display: flex; justify-content: center; align-items: center; gap: 32px; padding: 24px 40px; max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.03); border: 1px solid rgba(201,168,76,0.15); }
.l-hs-item strong { display: block; font-family: 'Playfair Display', serif; font-size: 28px; color: var(--gold); }
.l-hs-item span { font-size: 11px; color: var(--primary-300); letter-spacing: 2px; }
.l-hs-divider { width: 1px; height: 32px; background: rgba(201,168,76,0.2); }

/* Section */
.l-section { padding: 100px 40px; max-width: 1100px; margin: 0 auto; }
.l-section-deco { text-align: center; color: var(--gold); font-size: 14px; margin-bottom: 16px; opacity: 0.6; }
.l-section-label { text-align: center; font-size: 12px; letter-spacing: 4px; color: var(--gold-dark); font-weight: 600; margin-bottom: 12px; text-transform: uppercase; }
.l-section-title { text-align: center; font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 700; color: var(--text-100); margin-bottom: 16px; }
.l-section-sub { text-align: center; font-size: 15px; color: var(--text-200); max-width: 600px; margin: 0 auto 56px; }

/* Features */
.l-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.l-feat-card { background: var(--bg-200); border: 1px solid var(--bg-300); padding: 40px 28px 28px; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); position: relative; animation: featIn 0.5s ease-out both; }
.l-feat-card:hover { border-color: var(--gold); transform: translateY(-6px); box-shadow: 0 16px 48px rgba(139,105,20,0.1); }
.l-feat-num { position: absolute; top: 14px; right: 18px; font-family: 'Playfair Display', serif; font-size: 11px; font-weight: 700; color: var(--primary-300); letter-spacing: 2px; }
.l-feat-icon { font-size: 36px; margin-bottom: 16px; display: block; }
.l-feat-card h3 { font-family: 'Playfair Display', serif; font-size: 18px; color: var(--text-100); margin-bottom: 10px; }
.l-feat-card p { font-size: 13px; color: var(--text-200); line-height: 1.8; }
@keyframes featIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

/* Workflow */
.l-workflow { padding: 100px 40px; background: var(--navy); border-top: 2px solid var(--gold); border-bottom: 2px solid var(--gold); position: relative; overflow: hidden; }
.l-workflow::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(201,168,76,0.02) 40px, rgba(201,168,76,0.02) 42px); pointer-events: none; }
.l-steps { display: flex; gap: 20px; max-width: 1000px; margin: 48px auto 0; position: relative; }
.l-step { flex: 1; text-align: center; position: relative; }
.l-step::after { content: ''; position: absolute; top: 36px; left: 60%; right: -10%; height: 1px; background: var(--gold); opacity: 0.3; }
.l-step:last-child::after { display: none; }
.l-step-num { width: 72px; height: 72px; border-radius: 50%; background: var(--navy); border: 2px solid var(--gold); color: var(--gold); font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; position: relative; z-index: 1; }
.l-step-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(201,168,76,0.15); padding: 20px 16px; }
.l-step-card h3 { font-family: 'Playfair Display', serif; color: var(--gold); font-size: 16px; margin-bottom: 6px; }
.l-step-card p { color: var(--primary-300); font-size: 12px; line-height: 1.7; }

/* Advantages */
.l-advantages { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 900px; margin: 0 auto; }
.l-adv-item { display: flex; gap: 16px; align-items: flex-start; padding: 20px; background: var(--bg-200); border: 1px solid var(--bg-300); transition: all 0.2s; }
.l-adv-item:hover { border-color: var(--gold); }
.l-adv-icon { font-size: 28px; flex-shrink: 0; }
.l-adv-item strong { display: block; font-size: 14px; color: var(--text-100); margin-bottom: 4px; }
.l-adv-item p { font-size: 12px; color: var(--text-200); line-height: 1.6; }

/* CTA End */
.l-cta-end { padding: 100px 40px; text-align: center; background: linear-gradient(180deg, var(--bg-100) 0%, var(--navy) 40%, var(--navy) 100%); border-top: 2px solid var(--gold); }

/* Contribute */
.l-contribute { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; max-width: 1000px; margin: 0 auto; }
.l-ctb-card { text-align: center; padding: 28px 16px; background: var(--bg-200); border: 1px solid var(--bg-300); transition: all 0.2s; }
.l-ctb-card:hover { border-color: var(--gold); transform: translateY(-2px); }
.l-ctb-card h4 { font-family: 'Playfair Display', serif; font-size: 16px; color: var(--text-100); margin: 10px 0 6px; }
.l-ctb-card p { font-size: 12px; color: var(--text-200); line-height: 1.6; }

/* GitHub */
.l-gh-box { display: inline-flex; align-items: center; gap: 20px; padding: 24px 40px; background: var(--bg-200); border: 1px solid var(--bg-300); text-decoration: none; transition: all 0.25s; color: var(--text-100); }
.l-gh-box:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(139,105,20,0.1); }
.l-gh-box svg { fill: var(--text-100); }
.l-gh-box:hover svg { fill: var(--gold-dark); }
.l-gh-box strong { display: block; font-size: 16px; }
.l-gh-box span { font-size: 12px; color: var(--text-200); }

/* Footer */
.l-footer { background: var(--navy); border-top: 2px solid var(--gold); padding: 40px; }
.l-footer-grid { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; max-width: 1100px; margin: 0 auto; }
.l-footer-brand { font-family: 'Playfair Display', serif; color: var(--gold); font-size: 16px; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; }
.l-footer-links { display: flex; gap: 24px; }
.l-footer-links a { color: var(--primary-300); text-decoration: none; font-size: 13px; transition: color 0.2s; }
.l-footer-links a:hover { color: var(--gold); }
.l-footer-bottom { text-align: center; padding-top: 24px; margin-top: 24px; border-top: 1px solid rgba(201,168,76,0.15); color: var(--primary-300); font-size: 12px; max-width: 1100px; margin-left: auto; margin-right: auto; }
.l-footer-bottom p { margin: 4px 0; }

@media (max-width: 900px) {
  .l-nav-links { display: none; }
  .l-nav-links.open { display: flex; flex-direction: column; position: absolute; top: 64px; left: 0; right: 0; background: rgba(26,26,46,0.98); padding: 24px 40px; gap: 16px; border-bottom: 2px solid var(--gold); }
  .l-nav-toggle { display: flex; }
  .l-hero h2 { font-size: 36px; }
  .l-hero-deco { display: none; }
  .l-hero-stats { flex-wrap: wrap; gap: 16px; }
  .l-hs-divider { display: none; }
  .l-features { grid-template-columns: 1fr; }
  .l-advantages { grid-template-columns: 1fr; }
  .l-steps { flex-direction: column; }
  .l-step::after { display: none; }
  .l-section { padding: 60px 20px; }
  .l-hero { padding: 140px 20px 60px; }
  .l-workflow { padding: 60px 20px; }
  .l-contribute { grid-template-columns: repeat(2, 1fr); }
}
</style>
