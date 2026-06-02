<template>
  <div id="app-container">
    <!-- 移动端汉堡菜单按钮（仅后台页面，Landing/Login/Register 有自己的导航） -->
    <div v-if="!['Landing','Login','Register'].includes($route.name)" class="mobile-nav-bar" @click="mobileMenuOpen = !mobileMenuOpen">
      <span class="mobile-logo">StoryCine</span>
      <el-icon :size="22"><component :is="mobileMenuOpen ? Close : MenuIcon" /></el-icon>
    </div>
    <!-- 移动端遮罩 -->
    <div v-if="!['Landing','Login','Register'].includes($route.name) && mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false"></div>
    <el-container>
      <el-aside v-if="!['Landing','Login','Register'].includes($route.name)" :width="collapsed ? '64px' : '220px'" :class="['app-sidebar', { 'mobile-open': mobileMenuOpen }]">
        <div class="logo">
          <div v-show="!collapsed" class="logo-full">
            <h2>StoryCine</h2>
            <p>全自动AI短剧生成</p>
          </div>
          <div class="collapse-btn" @click="collapsed = !collapsed" :title="collapsed ? '展开导航' : '收缩导航'">
            <el-icon :size="18"><component :is="collapsed ? ArrowRight : ArrowLeft" /></el-icon>
          </div>
        </div>
        <el-menu
          :default-active="activeMenu"
          router
          :collapse="collapsed"
        >
          <el-menu-item index="/dashboard">
            <el-icon><HomeFilled /></el-icon>
            <template #title>导演台</template>
          </el-menu-item>
          <el-menu-item index="/statistics">
            <el-icon><TrendCharts /></el-icon>
            <template #title>数据看板</template>
          </el-menu-item>
          <el-menu-item index="/projects">
            <el-icon><Folder /></el-icon>
            <template #title>片场管理</template>
          </el-menu-item>
          <el-menu-item index="/script-generate">
            <el-icon><MagicStick /></el-icon>
            <template #title>剧本工坊</template>
          </el-menu-item>
          <el-menu-item index="/script-edit">
            <el-icon><Edit /></el-icon>
            <template #title>分镜台本</template>
          </el-menu-item>
          <el-menu-item index="/assets">
            <el-icon><UserFilled /></el-icon>
            <template #title>演员库</template>
          </el-menu-item>
          <el-menu-item index="/storyboard">
            <el-icon><Film /></el-icon>
            <template #title>镜头板</template>
          </el-menu-item>
          <el-menu-item index="/composition">
            <el-icon><VideoCameraFilled /></el-icon>
            <template #title>剪辑室</template>
          </el-menu-item>
          <el-menu-item index="/media-library">
            <el-icon><PictureFilled /></el-icon>
            <template #title>素材库</template>
          </el-menu-item>
          <el-menu-item index="/tts-library">
            <el-icon><Headset /></el-icon>
            <template #title>配音素材库</template>
          </el-menu-item>
<el-menu-item index="/users" v-if="isAdmin">
            <el-icon><UserFilled /></el-icon>
            <template #title>用户管理</template>
          </el-menu-item>
          <el-menu-item index="/profile">
            <el-icon><UserFilled /></el-icon>
            <template #title>个人中心</template>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <template #title>系统设置</template>
          </el-menu-item>
        </el-menu>

        <!-- 侧边栏底部 -->
        <div class="sidebar-footer">
          <!-- 当前用户 -->
          <div class="sidebar-user-row" v-if="currentUser.username">
            <div class="sidebar-user" @click="$router.push('/profile')" title="点击进入个人中心">
              <div class="sidebar-avatar" :style="{ backgroundImage: currentUser.avatar ? 'url(' + currentUser.avatar + ')' : '' }">
                <span v-if="!currentUser.avatar">{{ avatarLetter }}</span>
              </div>
              <div class="sidebar-user-info" v-show="!collapsed">
                <span class="sidebar-user-name">{{ currentUser.nickname || currentUser.username }}</span>
                <span class="sidebar-user-role">{{ currentUser.role === 'admin' ? '管理员' : '用户' }}</span>
              </div>
            </div>
            <span class="sidebar-logout" @click="handleLogout" title="退出登录" v-show="!collapsed">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
          </div>
          <a href="https://github.com/ljy532126/storycine" target="_blank" rel="noopener" class="github-link">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="flex-shrink:0">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span v-show="!collapsed">GitHub</span>
          </a>
          <div class="copyright" v-show="!collapsed">
            <p>&copy; {{ new Date().getFullYear() }} StoryCine</p>
            <p>MIT License · 开源项目</p>
          </div>
        </div>
      </el-aside>
      <el-main :class="['Landing','Login','Register'].includes($route.name) ? 'app-main-landing' : 'app-main'">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <keep-alive exclude="Landing,Login,Register">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>

  <!-- 全局加载条 -->
  <div class="global-loading-bar" :class="{ 'loading-active': isLoading }"></div>

  <!-- 全局搜索弹窗 -->
  <el-dialog v-model="searchVisible" title="全局搜索" width="550px" :close-on-click-modal="false">
    <el-input v-model="searchQuery" placeholder="搜索项目、剧本、角色..." size="large" clearable @keyup.enter="doSearch" ref="searchInput">
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>
    <div v-if="searchResults.length > 0" style="margin-top:16px;max-height:360px;overflow-y:auto">
      <div v-for="r in searchResults" :key="r.id" class="search-result-item" @click="goToResult(r)">
        <span class="sr-icon">{{ r.icon }}</span>
        <div class="sr-body">
          <span class="sr-name">{{ r.name }}</span>
          <span class="sr-type">{{ r.type }}</span>
        </div>
        <span class="sr-arrow">→</span>
      </div>
    </div>
    <div v-else-if="searchQuery && searched" style="text-align:center;padding:30px;color:var(--text-200)">未找到匹配结果</div>
  </el-dialog>

  <!-- 通知中心 -->
  <div class="notification-stack">
    <transition-group name="notif-slide">
      <div v-for="n in notifications" :key="n.id" :class="['notification-toast', 'notif-'+n.type]" @click="removeNotification(n.id)">
        <span class="notif-icon">{{ n.icon }}</span>
        <span class="notif-msg">{{ n.msg }}</span>
      </div>
    </transition-group>
  </div>

  <!-- 新手引导 -->
  <div v-if="showOnboarding" class="onboarding-overlay" @click="dismissOnboarding">
    <div class="onboarding-card" @click.stop>
      <h2>🎬 欢迎来到 StoryCine</h2>
      <div class="onboard-steps">
        <div class="on-step" :class="{ done: onboardStep > 1 }">
          <span class="on-num">1</span>
          <div><strong>开拍新短剧</strong><p>在短剧片场页面创建你的第一部作品</p></div>
        </div>
        <div class="on-step" :class="{ done: onboardStep > 2 }">
          <span class="on-num">2</span>
          <div><strong>生成剧本</strong><p>选择题材标签，AI 自动创作剧本</p></div>
        </div>
        <div class="on-step" :class="{ done: onboardStep > 3 }">
          <span class="on-num">3</span>
          <div><strong>故事板制作</strong><p>一键同步分镜，自动生成提示词</p></div>
        </div>
      </div>
      <el-button type="primary" size="large" style="width:100%;margin-top:20px" @click="dismissOnboarding">开始创作</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  HomeFilled, MagicStick, Edit, UserFilled, Film, VideoCameraFilled, PictureFilled, Setting, Folder, TrendCharts, Search, Headset,
  ArrowLeft, ArrowRight, Menu as MenuIcon, Close,
} from '@element-plus/icons-vue';
import { useProjectStore } from './stores/project';
import { useScriptStore } from './stores/script';
import { useAssetStore } from './stores/asset';

const route = useRoute();
const router = useRouter();
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  userRole.value = '';
  currentUser.value = {};
  router.push('/');
}
const collapsed = ref(false);
const mobileMenuOpen = ref(false);
const userRole = ref((() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { return ''; }
})());

// 从 localStorage 初始化（快速首屏渲染）
const currentUser = ref((() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
})());

// 从 API 验证当前用户角色（不信任 localStorage）
async function refreshUser() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      const user = data.data || {};
      userRole.value = user.role || '';
      currentUser.value = user;
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch { /* ignore */ }
}

const avatarLetter = computed(() => (currentUser.value.nickname || currentUser.value.username || '?')[0]?.toUpperCase());
const isAdmin = computed(() => userRole.value === 'admin');

const activeMenu = computed(() => {
  mobileMenuOpen.value = false;
  return route.path;
});

// === 通知中心 ===
const notifications = ref([]);
let notifId = 0;
function addNotification(msg, type = 'info', icon = '📢') {
  const id = ++notifId;
  notifications.value.push({ id, msg, type, icon });
  setTimeout(() => { notifications.value = notifications.value.filter(n => n.id !== id); }, 4000);
}
// 暴露到全局供其他组件调用
window.__addNotification = addNotification;
const isLoading = ref(false);
window.__setLoading = (v) => { isLoading.value = v; };

// === 全局搜索 ===
const searchVisible = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const searched = ref(false);
const searchInput = ref(null);

function doSearch() {
  searched.value = true;
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) { searchResults.value = []; return; }
  const results = [];
  const pStore = useProjectStore();
  const sStore = useScriptStore();
  const aStore = useAssetStore();
  pStore.projects?.forEach(p => {
    if (p.name?.toLowerCase().includes(q)) results.push({ id: p._id, name: p.name, type: '项目', icon: '📁', route: '/projects' });
  });
  aStore.characters?.forEach(c => {
    if (c.name?.toLowerCase().includes(q)) results.push({ id: c._id, name: c.name, type: '角色', icon: '🎭', route: '/assets' });
  });
  aStore.scenes?.forEach(s => {
    if (s.sceneName?.toLowerCase().includes(q)) results.push({ id: s._id, name: s.sceneName, type: '场景', icon: '🏠', route: '/assets' });
  });
  searchResults.value = results.slice(0, 10);
}
function goToResult(r) {
  searchVisible.value = false;
  router.push(r.route);
}

// === 新手引导 ===
const showOnboarding = ref(!localStorage.getItem('ad_onboarded'));
function dismissOnboarding() {
  showOnboarding.value = false;
  try { localStorage.setItem('ad_onboarded', '1'); } catch {}
}
const onboardStep = ref(1);

// === 键盘快捷键 ===
function onKeydown(e) {
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); searchVisible.value = true; return; }
  if (e.ctrlKey && e.key === 'Enter') { window.__triggerGenerate?.(); return; }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); window.__triggerSave?.(); return; }
}

// 路由变化时刷新用户信息（解决登录后 App 不重载的问题）
watch(() => route.path, () => { if (localStorage.getItem('token')) refreshUser(); });

onMounted(() => {
  refreshUser();
  document.addEventListener('keydown', onKeydown);
  nextTick(() => { if (searchInput.value) searchInput.value.focus(); });
});
</script>

<style>
:root {
  --primary-100: #8B7355; --primary-200: #D4C5C0; --primary-300: #E8D5C4;
  --accent-100: #C9A84C; --accent-200: #F5E6C8;
  --text-100: #2C1810; --text-200: #8B7355;
  --bg-100: #FBF7F0; --bg-200: #FFFDF9; --bg-300: #E8D5C4;
  --gold: #C9A84C; --gold-light: #F5E6C8; --gold-dark: #8B6914;
  --navy: #1A1A2E;
}
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DM Sans', 'Microsoft YaHei', sans-serif; background: var(--bg-100); color: var(--text-200); }
#app-container { height: 100vh; background: var(--bg-100); }
#app-container { height: 100vh; }
.app-sidebar {
  background: var(--navy); min-height: 100vh; overflow-y: auto; overflow-x: hidden;
  border-right: 2px solid var(--gold); transition: width 0.4s cubic-bezier(0.22,0.61,0.36,1);
  display: flex; flex-direction: column;
}
.el-menu { border-right: none !important; flex: 1; background: var(--navy) !important; padding: 8px 0 !important; }
.el-menu-vertical:not(.el-menu--collapse) { width: 100%; }

/* 展开态菜单项 */
.el-menu-item {
  display: flex !important; align-items: center !important;
  height: 44px !important; line-height: 44px !important;
  padding: 0 16px !important; margin: 4px 10px !important; border-radius: 6px !important;
  color: var(--gold-light) !important; font-family: 'DM Sans', sans-serif !important; letter-spacing: 0.5px;
}
.el-menu-item .el-icon {
  margin-right: 12px !important; flex-shrink: 0 !important;
  font-size: 18px !important; width: 20px !important; text-align: center !important;
}
.el-menu-item.is-active { background: var(--gold) !important; color: var(--navy) !important; font-weight: 700; }
.el-menu-item:hover { background: rgba(201,168,76,0.2) !important; color: var(--gold-light) !important; }

/* ===== 二级子菜单样式 ===== */
.el-sub-menu { margin: 4px 10px !important; }
.el-sub-menu__title {
  display: flex !important; align-items: center !important;
  height: 44px !important; line-height: 44px !important;
  padding: 0 16px !important; border-radius: 6px !important;
  color: var(--gold-light) !important; font-family: 'DM Sans', sans-serif !important;
  letter-spacing: 0.5px; transition: all 0.3s;
}
.el-sub-menu__title:hover { background: rgba(201,168,76,0.2) !important; color: var(--gold-light) !important; }
.el-sub-menu.is-opened .el-sub-menu__title { color: var(--gold) !important; }
.el-sub-menu__icon-arrow { color: var(--gold-light) !important; font-size: 12px !important; margin-top: 0 !important; }
/* 子菜单展开区域 */
.el-sub-menu .el-menu { background: rgba(0,0,0,0.15) !important; border-radius: 0 0 8px 8px !important; }
.el-sub-menu .el-menu-item {
  height: 38px !important; line-height: 38px !important;
  padding: 0 16px 0 44px !important; margin: 0 8px 2px !important;
  font-size: 13px !important; color: var(--primary-300) !important;
  border-radius: 4px !important; min-width: auto !important;
}
.el-sub-menu .el-menu-item:hover { background: rgba(201,168,76,0.15) !important; color: var(--gold-light) !important; }
.el-sub-menu .el-menu-item.is-active { background: rgba(201,168,76,0.25) !important; color: var(--gold) !important; font-weight: 600; }

/* 收缩态子菜单保持隐藏 */
.el-menu--collapse .el-sub-menu { margin: 4px auto !important; width: 44px !important; }
.el-menu--collapse .el-sub-menu__title { padding: 0 !important; justify-content: center !important; }
.el-menu--collapse .el-sub-menu__title .el-sub-menu__icon-arrow { display: none !important; }

/* 收缩态弹出子菜单面板 */
.el-menu--popup { background: var(--navy) !important; border: 1px solid var(--gold) !important; border-radius: 8px !important; padding: 4px 0 !important; min-width: 140px !important; }
.el-menu--popup .el-menu-item {
  height: 38px !important; line-height: 38px !important; padding: 0 16px !important;
  color: var(--gold-light) !important; font-size: 13px !important;
  margin: 2px 6px !important; border-radius: 4px !important;
}
.el-menu--popup .el-menu-item:hover { background: rgba(201,168,76,0.2) !important; }
.el-menu--popup .el-menu-item.is-active { background: var(--gold) !important; color: var(--navy) !important; }

/* 收缩态菜单项 — 精确居中 */
.el-menu--collapse { width: 64px !important; padding: 8px 0 !important; }
.el-menu--collapse .el-menu-item {
  width: 44px !important; height: 44px !important;
  padding: 0 !important; margin: 4px auto !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
}
.el-menu--collapse .el-menu-item .el-icon { margin: 0 !important; }
.el-menu--collapse .el-menu-item .el-menu-tooltip__trigger {
  padding: 0 !important; left: 0 !important; right: 0 !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
}
.app-sidebar .logo {
  display: flex; align-items: center; justify-content: center;
  padding: 16px 0; border-bottom: 1px solid var(--gold); min-height: 56px;
  transition: all 0.3s; position: relative;
}
.app-sidebar .logo::after { content: ''; position: absolute; bottom: -3px; left: 12px; right: 12px; height: 1px; background: var(--gold); opacity: 0.5; }
.logo-full { overflow: hidden; white-space: nowrap; flex: 1; text-align: center; }
.logo-full h2 { font-family: 'Playfair Display', serif; color: var(--gold); font-size: 18px; margin-bottom: 2px; letter-spacing: 1px; text-align: center; }
.logo-full p { color: var(--primary-300); font-size: 10px; text-align: center; letter-spacing: 2px; text-transform: uppercase; }
.collapse-btn {
  flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--gold); background: transparent; border: 1px solid var(--gold);
  transition: all 0.3s;
}
.collapse-btn:hover { background: var(--gold); color: var(--navy); }
.app-main { background: var(--bg-100); min-height: 100vh; padding: 28px; transition: padding 0.3s; }
.app-main-landing { padding: 0 !important; min-height: 100vh; background: var(--bg-100); overflow-x: hidden; }
.el-menu-vertical:not(.el-menu--collapse) { width: 100%; }

.sidebar-user-row { display: flex; align-items: center; }
.sidebar-user { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; flex: 1; border-radius: 8px; transition: background 0.2s; }
.sidebar-user:hover { background: rgba(201,168,76,0.15); }
.sidebar-logout { font-size: 16px; color: var(--primary-300); cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.15s; flex-shrink: 0; }
.sidebar-logout:hover { color: #C44545; background: rgba(196,69,69,0.15); }
.sidebar-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gold); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: var(--navy); font-size: 14px; font-weight: 700; flex-shrink: 0; }
.sidebar-user-info { display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
.sidebar-user-name { font-size: 12px; color: var(--gold-light); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-user-role { font-size: 10px; color: var(--primary-300); }
.sidebar-footer { padding: 8px; border-top: 1px solid var(--gold); margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.github-link {
  display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px;
  border-radius: 4px; color: var(--gold-light); text-decoration: none;
  font-size: 12px; font-weight: 500; letter-spacing: 1px; transition: all 0.3s;
  background: transparent; border: 1px solid rgba(201,168,76,0.3);
  width: 100%; box-sizing: border-box;
}
.github-link:hover { background: var(--gold); color: var(--navy); border-color: var(--gold); }
.copyright { margin-top: 12px; text-align: center; }
.copyright p { font-size: 10px; color: var(--primary-300); line-height: 1.6; margin: 0; letter-spacing: 0.5px; }

/* 全局 Art Deco 面包屑 */
.breadcrumb { display: flex; align-items: center; flex-shrink: 0; padding: 0 0 16px; margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap; }
.bc-link { color: var(--text-200); text-decoration: none; font-weight: 500; transition: color 0.3s; }
.bc-link:hover { color: var(--gold-dark); }
.bc-sep { color: var(--gold); margin: 0 8px; font-size: 9px; user-select: none; }
.bc-current { color: var(--text-100); font-weight: 700; border-bottom: 2px solid var(--gold); padding-bottom: 3px; }
.action-bar { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 20px; gap: 12px; }

/* Element Plus — Art Deco Luxe 覆写 */
.el-card { background: var(--bg-200) !important; border: 1px solid var(--bg-300) !important; color: var(--text-100) !important; border-radius: 8px !important; box-shadow: 0 2px 16px rgba(139,105,20,0.06) !important; }
.el-card__header { border-bottom: 1px solid var(--bg-300) !important; color: var(--text-100) !important; font-family: 'Playfair Display', serif !important; font-weight: 600; letter-spacing: 0.5px; }
.el-input__wrapper { background: var(--bg-200) !important; box-shadow: none !important; border-color: var(--bg-300) !important; border-radius: 6px !important; }
.el-input__inner { color: var(--text-100) !important; font-family: 'DM Sans', sans-serif !important; }
.el-input__inner::placeholder { color: var(--text-200) !important; }
.el-textarea__inner { background: var(--bg-200) !important; color: var(--text-100) !important; border-color: var(--bg-300) !important; border-radius: 6px !important; }
/* ===== Element Plus 下拉/选择器全局美化 ===== */
/* 输入框 */
.el-select .el-input__wrapper {
  background: var(--bg-200) !important; border-color: var(--bg-300) !important;
  box-shadow: none !important; border-radius: 6px !important; transition: all 0.2s;
}
.el-select .el-input__wrapper:hover { border-color: var(--gold) !important; }
.el-select.is-focus .el-input__wrapper { border-color: var(--gold) !important; box-shadow: 0 0 0 1px var(--gold) inset !important; }
/* 下拉面板 */
.el-select-dropdown { border: 1px solid var(--bg-300) !important; border-radius: 8px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; overflow: hidden; }
.el-select-dropdown__item {
  color: var(--text-100) !important; font-size: 13px !important; padding: 0 16px !important;
  height: 36px !important; line-height: 36px !important; transition: all 0.1s;
}
.el-select-dropdown__item.is-selected { color: var(--gold-dark) !important; font-weight: 700 !important; background: var(--gold-light) !important; }
.el-select-dropdown__item:hover { background: var(--accent-200) !important; }
.el-select-dropdown__item.is-hovering { background: var(--accent-200) !important; }
/* 多选 tag */
.el-select .el-tag { background: var(--accent-200) !important; border-color: var(--accent-100) !important; color: var(--text-100) !important; border-radius: 4px !important; }
.el-select .el-tag .el-tag__close { color: var(--text-200) !important; }
.el-select .el-tag .el-tag__close:hover { background: var(--accent-100) !important; color: var(--navy) !important; }
/* 下拉菜单（el-dropdown） */
.el-dropdown-menu { border: 1px solid var(--bg-300) !important; border-radius: 8px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; padding: 4px 0 !important; }
.el-dropdown-menu__item { color: var(--text-100) !important; font-size: 13px !important; padding: 8px 16px !important; transition: all 0.1s; }
.el-dropdown-menu__item:hover { background: var(--accent-200) !important; color: var(--text-100) !important; }
/* Popover */
.el-popover { border: 1px solid var(--bg-300) !important; border-radius: 8px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
/* 时间选择器 */
.el-date-editor .el-input__wrapper { background: var(--bg-200) !important; border-color: var(--bg-300) !important; box-shadow: none !important; }
/* 级联面板 */
.el-cascader-menu { border-color: var(--bg-300) !important; }
.el-cascader-node:hover { background: var(--accent-200) !important; }
.el-button { font-family: 'DM Sans', sans-serif !important; letter-spacing: 0.5px; }
.el-button--primary:not(.is-link) { background: var(--navy) !important; border-color: var(--gold) !important; color: var(--gold) !important; font-weight: 700 !important; border-width: 2px !important; }
.el-button--primary:not(.is-link):hover { background: var(--gold) !important; color: var(--navy) !important; }
.el-button--primary.is-link { color: var(--gold-dark) !important; background: transparent !important; border: none !important; font-weight: 600 !important; }
.el-button--primary.is-link:hover { color: var(--navy) !important; }
.el-button--success { background: var(--navy) !important; border-color: var(--gold) !important; color: var(--gold) !important; border-width: 2px !important; font-weight: 600 !important; }
.el-button--success:hover { background: var(--gold) !important; color: var(--navy) !important; }
.el-button--warning { background: var(--accent-100) !important; border-color: var(--accent-100) !important; color: var(--navy) !important; font-weight: 600 !important; }
.el-button--danger { background: #C44545 !important; border-color: #C44545 !important; color: #fff !important; }
.el-button.is-disabled { color: var(--text-200) !important; }
.el-dialog { background: var(--bg-200) !important; border: 1px solid var(--gold) !important; border-radius: 12px !important; }
.el-dialog__title { color: var(--text-100) !important; font-family: 'Playfair Display', serif !important; font-size: 20px !important; }
.el-form-item__label { color: var(--text-100) !important; font-weight: 600 !important; letter-spacing: 0.5px; }
.el-table { background: var(--bg-200) !important; color: var(--text-100) !important; }
.el-table th { background: var(--bg-100) !important; color: var(--text-100) !important; font-weight: 700 !important; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
.el-table tr { background: var(--bg-200) !important; color: var(--text-100) !important; }
.el-table--striped .el-table__body tr.el-table__row--striped td { background: var(--bg-100) !important; }
.el-tabs__item { color: var(--text-200) !important; font-family: 'DM Sans', sans-serif !important; }
.el-tabs__item.is-active { color: var(--gold-dark) !important; }
.el-tag { background: var(--bg-100) !important; border-color: var(--bg-300) !important; color: var(--text-100) !important; }
.el-tag--success { background: var(--accent-200) !important; color: var(--gold-dark) !important; border-color: var(--gold) !important; }
.el-radio-button__inner { background: var(--bg-200) !important; border-color: var(--bg-300) !important; color: var(--text-100) !important; }
.el-radio-button__original-radio:checked+.el-radio-button__inner { background: var(--gold) !important; border-color: var(--gold) !important; color: var(--navy) !important; }
.el-switch__label { color: var(--text-200) !important; }
.el-divider__text { background: var(--bg-200) !important; color: var(--text-200) !important; }
.el-progress-bar__outer { background: var(--bg-300) !important; }
.el-empty__description p { color: var(--text-200) !important; }
.el-alert--info { background: var(--bg-100) !important; border-color: var(--gold) !important; }
.el-alert__title { color: var(--text-100) !important; }
.el-descriptions__label { background: var(--bg-100) !important; color: var(--text-100) !important; }
.el-descriptions__content { background: var(--bg-200) !important; color: var(--text-100) !important; }
.el-checkbox__label { color: var(--text-100) !important; }
.el-step__title.is-process { color: var(--gold-dark) !important; font-weight: bold !important; }
.el-step__title.is-wait { color: var(--text-100) !important; }
.el-step__title.is-success { color: var(--gold-dark) !important; }
.el-step__description { color: var(--text-200) !important; }

/* ===== 移动端响应式 ===== */
.mobile-nav-bar { display: none; }
.mobile-overlay { display: none; }

@media (max-width: 768px) {
  .mobile-nav-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; height: 48px; background: var(--navy); color: var(--gold);
    border-bottom: 2px solid var(--gold); position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  }
  .mobile-logo { font-family: 'Playfair Display', serif; font-size: 15px; letter-spacing: 1px; }
  .mobile-overlay {
    display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 150;
  }
  .app-sidebar {
    position: fixed !important; left: -240px; top: 0; bottom: 0; z-index: 180;
    width: 240px !important; transition: left 0.3s ease !important;
  }
  .app-sidebar.mobile-open { left: 0 !important; }
  .app-sidebar .logo { display: none !important; }
  .app-main { padding: 56px 12px 24px !important; padding-top: 56px !important; margin-top: 0 !important; overflow-y: auto !important; -webkit-overflow-scrolling: touch; }
  #app-container { padding-top: 48px; }
  .el-menu--collapse { width: 240px !important; }
  .el-menu--collapse .el-menu-item { width: auto !important; margin: 4px 10px !important; padding: 0 16px !important; justify-content: flex-start !important; }
  .el-menu--collapse .el-menu-item .el-icon { margin-right: 12px !important; }
  .el-menu--collapse .el-menu-item .el-menu-tooltip__trigger { left: auto !important; right: auto !important; display: flex !important; }
  .el-menu { margin-top: 60px !important; }

  /* 页面组件移动端适配 */
  .three-column, .master-detail, .sb-body, .comp-body { flex-direction: column !important; }
  .left-panel, .sb-left, .left-list { width: 100% !important; max-height: 35vh !important; overflow-y: auto !important; }
  .right-panel, .sb-right { width: 100% !important; max-height: 35vh !important; overflow-y: auto !important; }
  .el-row { display: block !important; }
  .el-col { max-width: 100% !important; margin-bottom: 12px; }
  .el-table { font-size: 12px !important; }
  .el-table .cell { padding: 6px 4px !important; }
  .sg-left { width: 100% !important; }
  .tag-form .el-form-item { margin-right: 0 !important; width: 100% !important; }
  .tag-form .el-select { width: 100% !important; }
  .db-stats-row { grid-template-columns: repeat(2, 1fr) !important; }
  .db-grid { grid-template-columns: 1fr !important; }
  .db-title { font-size: 28px !important; }
  .log-float-panel { width: calc(100vw - 24px) !important; right: 12px !important; }
  .masthead-title { font-size: 32px !important; }
  .editorial-grid { grid-template-columns: 1fr !important; }
  .card-featured { grid-column: span 1 !important; }
}

/* ===== 页面过渡动画 ===== */
.page-fade-enter-active { transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1); }
.page-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.page-fade-enter-from { opacity: 0; transform: translateY(16px) scale(0.98); }
.page-fade-leave-to { opacity: 0; transform: translateY(-10px); }

/* ===== 通知中心 ===== */
.notification-stack { position: fixed; top: 20px; right: 20px; z-index: 3000; display: flex; flex-direction: column; gap: 8px; }
.notification-toast {
  padding: 12px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 10px; cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 260px;
  animation: notifIn 0.3s ease;
}
.notif-info { background: var(--navy); color: var(--gold-light); border: 1px solid var(--gold); }
.notif-success { background: var(--gold); color: var(--navy); }
.notif-error { background: #C44545; color: #fff; }
.notif-icon { font-size: 16px; }
.notif-msg { flex: 1; }
.notif-slide-enter-active { transition: all 0.3s ease; }
.notif-slide-leave-active { transition: all 0.2s ease; }
.notif-slide-enter-from { opacity: 0; transform: translateX(60px); }
.notif-slide-leave-to { opacity: 0; transform: translateX(60px); }
@keyframes notifIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

/* ===== 全局搜索 ===== */
.search-result-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 6px; cursor: pointer; transition: background 0.15s;
}
.search-result-item:hover { background: var(--bg-100); }
.sr-icon { font-size: 18px; }
.sr-body { flex: 1; display: flex; flex-direction: column; }
.sr-name { font-weight: 600; color: var(--text-100); font-size: 14px; }
.sr-type { font-size: 11px; color: var(--text-200); }
.sr-arrow { color: var(--gold); opacity: 0; transition: all 0.15s; }
.search-result-item:hover .sr-arrow { opacity: 1; transform: translateX(4px); }

/* ===== 新手引导 ===== */
.onboarding-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 4000; display: flex; align-items: center; justify-content: center; }
.onboarding-card { background: var(--bg-200); border-radius: 16px; padding: 36px; max-width: 480px; width: 90%; border: 2px solid var(--gold); box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
.onboarding-card h2 { font-family: 'Playfair Display', serif; font-size: 24px; color: var(--text-100); margin: 0 0 24px; text-align: center; }
.onboard-steps { display: flex; flex-direction: column; gap: 16px; }
.on-step { display: flex; gap: 14px; align-items: center; opacity: 0.5; transition: opacity 0.3s; }
.on-step.done { opacity: 1; }
.on-num { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-300); color: var(--text-200); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
.on-step.done .on-num { background: var(--gold); color: var(--navy); }
.on-step strong { color: var(--text-100); font-size: 14px; }
.on-step p { color: var(--text-200); font-size: 12px; margin: 2px 0 0; }

/* ===== 全局加载条 ===== */
.global-loading-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 9999; pointer-events: none; }
.global-loading-bar::after { content: ''; display: block; width: 0; height: 100%; background: var(--gold); transition: width 0.3s; }
.loading-active::after { width: 70%; animation: loadingPulse 1.5s ease-in-out infinite; }
@keyframes loadingPulse { 0% { width: 0; } 50% { width: 90%; } 100% { width: 0; } }
</style>
