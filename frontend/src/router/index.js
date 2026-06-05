import { createRouter, createWebHistory } from 'vue-router';

// 路由懒加载：每个页面独立 chunk，按需加载，大幅减少首屏体积
const Landing = () => import('../views/Landing.vue');
const Login = () => import('../views/Login.vue');
const Register = () => import('../views/Register.vue');
const Dashboard = () => import('../views/Dashboard.vue');
const ProjectList = () => import('../views/ProjectList.vue');
const ScriptGenerate = () => import('../views/ScriptGenerate.vue');
const ScriptEdit = () => import('../views/ScriptEdit.vue');
const AssetManager = () => import('../views/AssetManager.vue');
const StoryboardView = () => import('../views/StoryboardView.vue');
const CompositionView = () => import('../views/CompositionView.vue');
const Settings = () => import('../views/Settings.vue');
const Statistics = () => import('../views/Statistics.vue');
const AIConfig = () => import('../views/AIConfig.vue');
const AIStorageConfig = () => import('../views/AIStorageConfig.vue');
const MediaLibrary = () => import('../views/MediaLibrary.vue');
const TTSLibrary = () => import('../views/TTSLibrary.vue');
const UserManagement = () => import('../views/UserManagement.vue');
const Profile = () => import('../views/Profile.vue');

const ErrorLog = () => import('../views/ErrorLog.vue');

const routes = [
  { path: '/', name: 'Landing', component: Landing },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/projects', name: 'ProjectList', component: ProjectList, meta: { requiresAuth: true } },
  { path: '/script-generate', name: 'ScriptGenerate', component: ScriptGenerate, meta: { requiresAuth: true } },
  { path: '/script-edit', name: 'ScriptEdit', component: ScriptEdit, meta: { requiresAuth: true } },
  { path: '/assets', name: 'AssetManager', component: AssetManager, meta: { requiresAuth: true } },
  { path: '/storyboard', name: 'StoryboardView', component: StoryboardView, meta: { requiresAuth: true } },
  { path: '/composition', name: 'CompositionView', component: CompositionView, meta: { requiresAuth: true } },
  { path: '/settings', name: 'Settings', component: Settings, meta: { requiresAuth: true } },
  { path: '/statistics', name: 'Statistics', component: Statistics, meta: { requiresAuth: true } },
  { path: '/ai-config', name: 'AIConfig', component: AIConfig, meta: { requiresAuth: true } },
  { path: '/ai-storage', name: 'AIStorageConfig', component: AIStorageConfig, meta: { requiresAuth: true } },
  { path: '/media-library', name: 'MediaLibrary', component: MediaLibrary, meta: { requiresAuth: true } },
  { path: '/tts-library', name: 'TTSLibrary', component: TTSLibrary, meta: { requiresAuth: true } },
  { path: '/users', name: 'UserManagement', component: UserManagement, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/error-logs', name: 'ErrorLog', component: ErrorLog, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/profile', name: 'Profile', component: Profile, meta: { requiresAuth: true } },
];

const router = createRouter({ history: createWebHistory(), routes });

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) {
    next({ path: '/login', query: { redirect: to.fullPath } });
    return;
  }
  if (to.meta.requiresAdmin) {
    let role = '';
    try { role = JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { /* ignore */ }
    if (role !== 'admin') {
      next({ path: '/dashboard' });
      return;
    }
  }
  next();
});

export default router;
