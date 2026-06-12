import { createRouter, createWebHistory } from 'vue-router';

const Landing = () => import('../views/Landing.vue');
const Login = () => import('../views/Login.vue');
const Register = () => import('../views/Register.vue');
const Dashboard = () => import('../views/Dashboard.vue');
const ProjectList = () => import('../views/ProjectList.vue');
const Settings = () => import('../views/Settings.vue');
const Statistics = () => import('../views/Statistics.vue');
const AIStorageConfig = () => import('../views/AIStorageConfig.vue');
const MediaLibrary = () => import('../views/MediaLibrary.vue');
const TTSLibrary = () => import('../views/TTSLibrary.vue');
const WorkspaceView = () => import('../views/WorkspaceView.vue');
const UserManagement = () => import('../views/UserManagement.vue');
const ErrorLog = () => import('../views/ErrorLog.vue');
const Announcements = () => import('../views/Announcements.vue');

const routes = [
  { path: '/', name: 'Landing', component: Landing },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/projects', name: 'ProjectList', component: ProjectList, meta: { requiresAuth: true } },
  { path: '/script-generate', redirect: '/workspace?ws=script-generate' },
  { path: '/script-edit', redirect: to => ({ path: '/workspace', query: { ...to.query, ws: 'script-edit' } }) },
  { path: '/assets', redirect: '/workspace?ws=assets' },
  { path: '/storyboard', redirect: '/workspace?ws=storyboard' },
  { path: '/composition', redirect: '/workspace?ws=composition' },
  { path: '/settings', name: 'Settings', component: Settings, meta: { requiresAuth: true } },
  { path: '/statistics', name: 'Statistics', component: Statistics, meta: { requiresAuth: true } },
  { path: '/ai-storage', name: 'AIStorageConfig', component: AIStorageConfig, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/media-library', name: 'MediaLibrary', component: MediaLibrary, meta: { requiresAuth: true } },
  { path: '/tts-library', name: 'TTSLibrary', component: TTSLibrary, meta: { requiresAuth: true } },
  { path: '/workspace', name: 'WorkspaceView', component: WorkspaceView, meta: { requiresAuth: true } },
  { path: '/users', name: 'UserManagement', component: UserManagement, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/error-logs', name: 'ErrorLog', component: ErrorLog, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/announcements', name: 'Announcements', component: Announcements, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/profile', redirect: '/settings' },
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
