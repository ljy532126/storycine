import { createRouter, createWebHistory } from 'vue-router';
import Landing from '../views/Landing.vue';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import Dashboard from '../views/Dashboard.vue';
import ProjectList from '../views/ProjectList.vue';
import ScriptGenerate from '../views/ScriptGenerate.vue';
import ScriptEdit from '../views/ScriptEdit.vue';
import AssetManager from '../views/AssetManager.vue';
import StoryboardView from '../views/StoryboardView.vue';
import CompositionView from '../views/CompositionView.vue';
import Settings from '../views/Settings.vue';
import Statistics from '../views/Statistics.vue';
import AIConfig from '../views/AIConfig.vue';
import AIStorageConfig from '../views/AIStorageConfig.vue';
import MediaLibrary from '../views/MediaLibrary.vue';
import UserManagement from '../views/UserManagement.vue';
import Profile from '../views/Profile.vue';

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
  { path: '/users', name: 'UserManagement', component: UserManagement, meta: { requiresAuth: true, requiresAdmin: true } },
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
