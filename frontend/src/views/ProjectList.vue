<template>
  <div class="mag-page">
    <!-- Masthead -->
    <header class="mag-masthead">
      <div class="mag-issue-line">
        <span class="mag-issue-tag">ISSUE {{ String(projectStore.projects.length).padStart(2,'0') }}</span>
        <span class="mag-issue-date">{{ todayDate }}</span>
      </div>
      <div class="mag-title-row">
        <div class="mag-title-col">
          <h1 class="mag-title">我的<br>ilm set</h1>
          <p class="mag-subtitle">每部短剧，都是你的代表作</p>
        </div>
        <div class="mag-title-col mag-title-right">
          <p class="mag-intro">这里安放着你的每一帧灵感、每一次卡点、每一段值得被看见的故事。选一个片场，继续你的导演之旅。</p>
          <el-button class="mag-cta" @click="showCreateDialog = true">
            开拍新短剧！ <span style="font-size:16px">→</span>
          </el-button>
        </div>
      </div>
    </header>

    <!-- Filter Pills -->
    <div class="mag-filters" v-if="projectStore.projects.length > 0">
      <span :class="['mag-pill', { active: !filterStyle }]" @click="filterStyle = ''">全部</span>
      <span v-for="s in filterTabs" :key="s.value" :class="['mag-pill', { active: filterStyle === s.value }]" @click="filterStyle = filterStyle === s.value ? '' : s.value">{{ s.label }}</span>
    </div>

    <!-- Editorial Grid -->
    <div class="mag-grid" v-if="filteredProjects.length > 0">
      <div
        v-for="(p, idx) in filteredProjects"
        :key="p._id"
        :class="['mag-card', idx === 0 ? 'mag-featured' : '', p.coverImage ? 'has-poster' : '']"
        :style="p.coverImage ? { backgroundImage: 'url(' + p.coverImage + ')', animationDelay: (idx * 80) + 'ms' } : { animationDelay: (idx * 80) + 'ms' }"
      >
        <!-- 有海报时：全幅海报卡片 -->
        <template v-if="p.coverImage">
          <div class="poster-overlay"></div>
          <span class="mag-card-num poster-num">{{ String(idx + 1).padStart(2, '0') }}</span>
          <div class="poster-body" @click="selectProject(p)">
            <div class="poster-top">
              <span class="poster-status">{{ statusLabel(p.status) }}</span>
            </div>
            <div class="poster-bottom">
              <h3 class="poster-title">{{ p.name }}</h3>
              <div class="poster-meta">
                <span>{{ p.videoConfig?.aspectRatio || '9:16' }}</span>
                <span>·</span>
                <span>{{ p.videoConfig?.visualStyle || '写实' }}</span>
                <span>·</span>
                <span>{{ formatDate(p.createdAt) }}</span>
              </div>
              <div class="poster-actions">
                <button class="poster-btn" @click.stop="editProject(p)">改剧本</button>
                <button class="poster-btn poster-btn-redraw" @click.stop="generateCover(p)" :title="genCoverId === p._id ? '绘制中...' : '重新绘制海报'">
                  {{ genCoverId === p._id ? '⏳' : '重绘' }}
                </button>
                <button class="poster-btn poster-btn-del" @click.stop="handleDelete(p._id)">移除</button>
              </div>
            </div>
          </div>
        </template>

        <!-- 无海报时：原有卡片布局 -->
        <template v-else>
          <span class="mag-card-num">{{ String(idx + 1).padStart(2, '0') }}</span>
          <div class="mag-cover" @click="selectProject(p)">
            <div class="mag-cover-placeholder" :style="{ background: coverGradient(p) }" @click.stop>
              <span class="mag-cover-emoji">{{ coverIcon(p) }}</span>
              <span v-if="p.scriptSource !== 'none'" class="mag-cover-gen-btn" @click.stop="generateCover(p)" :title="genCoverId === p._id ? '生成中...' : '🎨 AI 生成海报'">
                {{ genCoverId === p._id ? '⏳' : '🎨' }}
              </span>
            </div>
          </div>
          <div class="mag-card-body">
            <div class="mag-card-header" @click="selectProject(p)">
              <div class="mag-card-meta">
                <span class="mag-status-dot" :class="'status-' + p.status"></span>
                <span class="mag-status">{{ statusLabel(p.status) }}</span>
              </div>
              <h3 class="mag-card-title">{{ p.name }}</h3>
              <p class="mag-card-desc">{{ p.description || '还没有简介哦~ 点击进入片场，开始你的创作吧' }}</p>
            </div>
            <div class="mag-tags">
              <span class="mag-tag">{{ p.videoConfig?.aspectRatio || '9:16' }}</span>
              <span class="mag-tag">{{ p.videoConfig?.visualStyle || '写实' }}</span>
              <span class="mag-tag">{{ sourceLabel(p.scriptSource) }}</span>
            </div>
            <div class="mag-card-footer">
              <span class="mag-date">{{ formatDate(p.createdAt) }}</span>
              <div class="mag-card-actions">
                <button class="mag-action-btn" @click.stop="editProject(p)" title="改一改剧本">改剧本</button>
                <button class="mag-action-btn mag-action-del" @click.stop="handleDelete(p._id)" title="移除片场">移除</button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Empty State -->
    <div class="mag-empty" v-if="!projectStore.loading && filteredProjects.length === 0">
      <div class="mag-empty-num">No. 00</div>
      <h2>片场空空如也</h2>
      <p>快点击「开拍新短剧」，打造专属你的故事吧</p>
      <p class="mag-empty-hint">听说很多爆款短剧，都是从这里诞生的哦~</p>
    </div>

    <!-- Dialog -->
    <el-dialog v-model="showCreateDialog" :title="editingProject ? '改剧本信息' : '✨ 开启你的短剧创作之旅'" width="520px" class="mag-dialog">
      <div v-if="!editingProject" class="mag-template-section">
        <span class="mag-template-label">灵感充电站</span>
        <div class="mag-template-chips">
          <span v-for="t in templates" :key="t.name" class="mag-tpl-chip" @click="applyTemplate(t)">{{ t.icon }} {{ t.name }}</span>
        </div>
      </div>
      <el-form :model="projectForm" label-position="top" class="mag-form">
        <el-form-item label="给你的新故事，起个名字叭！" required>
          <el-input v-model="projectForm.name" maxlength="100" placeholder="比如《重生：前夫请接招》这种，随便你写~" size="large" />
        </el-form-item>
        <el-form-item label="偷偷写下你的故事梗概吧">
          <el-input v-model="projectForm.description" type="textarea" :rows="3" placeholder="比如：女主逆袭打脸、先婚后爱、穿书逆袭..." />
        </el-form-item>
        <div class="mag-form-row">
          <el-form-item label="画面风格 🎨" style="flex:1">
            <el-select v-model="projectForm.videoConfig.visualStyle" style="width:100%">
              <el-option v-for="s in styles" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
          <el-form-item label="画面比例 📐" style="flex:1">
            <el-select v-model="projectForm.videoConfig.aspectRatio" style="width:100%">
              <el-option label="9:16 竖屏" value="9:16" />
              <el-option label="16:9 横屏" value="16:9" />
              <el-option label="4:3 方形" value="4:3" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false" round>下次再说叭</el-button>
        <el-button type="primary" @click="handleSave" round>出发！创作我的短剧 🚀</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useProjectStore } from '../stores/project';
import api from '../api';

const router = useRouter();
const projectStore = useProjectStore();

const showCreateDialog = ref(false);
const editingProject = ref(null);
const genCoverId = ref(null);
const filterStyle = ref('');
const styles = ['写实', '动漫', '真人', '古风', '电影感'];
const filterTabs = [
  { label: '写实', value: '写实' },
  { label: '动漫', value: '动漫' },
  { label: '古风', value: '古风' },
  { label: '电影感', value: '电影感' },
];
const todayDate = computed(() => new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' }));

const templates = [
  { name: '都市爱情', icon: '💕', visualStyle: '写实', subStyle: '都市情感', aspectRatio: '9:16' },
  { name: '古风仙侠', icon: '🏯', visualStyle: '写实', subStyle: '古风写实', aspectRatio: '9:16' },
  { name: '悬疑推理', icon: '🔍', visualStyle: '写实', subStyle: '悬疑恐怖', aspectRatio: '16:9' },
  { name: '科幻未来', icon: '🚀', visualStyle: '写实', subStyle: '未来科幻', aspectRatio: '16:9' },
  { name: '校园青春', icon: '📚', visualStyle: '动漫', subStyle: '二次元', aspectRatio: '9:16' },
];

const filteredProjects = computed(() => {
  const list = [...projectStore.projects].map((p, i) => ({ ...p, _index: i }));
  if (!filterStyle.value) return list;
  return list.filter(p => (p.videoConfig?.visualStyle || '') === filterStyle.value);
});

function applyTemplate(t) { projectForm.name = t.name; projectForm.description = ''; projectForm.videoConfig = { visualStyle: t.visualStyle, subStyle: t.subStyle, aspectRatio: t.aspectRatio }; }

const projectForm = reactive({ name: '', description: '', videoConfig: { visualStyle: '写实', aspectRatio: '9:16' } });

onMounted(() => { projectStore.fetchProjects(); });
onActivated(() => { projectStore.fetchProjects(); });

const coverGradients = [
  'linear-gradient(135deg, #1A1A2E 0%, #2d2d44 100%)',
  'linear-gradient(135deg, #8B7355 0%, #C9A84C 100%)',
  'linear-gradient(135deg, #1A1A2E 0%, #4a3728 100%)',
  'linear-gradient(135deg, #2c1810 0%, #8B7355 100%)',
  'linear-gradient(135deg, #C9A84C 0%, #8B6914 100%)',
];
function coverGradient(p) { return coverGradients[(p._index || 0) % coverGradients.length]; }
const coverIcons = ['🎬', '📽️', '🎞️', '🎭', '📺'];
function coverIcon(p) { return coverIcons[(p._index || 0) % coverIcons.length]; }

function selectProject(p) { projectStore.setCurrentProject(p); router.push('/script-generate'); }

function editProject(p) {
  editingProject.value = p;
  Object.assign(projectForm, { name: p.name, description: p.description, videoConfig: { ...p.videoConfig } });
  showCreateDialog.value = true;
}

async function handleSave() {
  if (!projectForm.name) { ElMessage.warning('给你的短剧起个名字吧 📝'); return; }
  if (editingProject.value) {
    await projectStore.updateProject(editingProject.value._id, { ...projectForm });
    ElMessage.success('修改完成，继续创作吧！');
  } else {
    const project = await projectStore.createProject({ ...projectForm });
    ElMessage.success('哇！新片场搭建完成啦 🥳');
    showCreateDialog.value = false;
    projectForm.name = ''; projectForm.description = '';
    projectStore.setCurrentProject(project);
    router.push('/script-generate');
    return;
  }
  showCreateDialog.value = false; editingProject.value = null;
  projectForm.name = ''; projectForm.description = '';
}

async function generateCover(p) {
  if (genCoverId.value) return;
  genCoverId.value = p._id;
  try {
    const data = await api.post(`/projects/${p._id}/generate-cover`);
    if (data.data?.coverImage) {
      p.coverImage = data.data.coverImage;
      ElMessage.success('海报绘制完成 🎉');
    } else { ElMessage.error('海报生成失败，请重试'); }
  } catch (e) { ElMessage.error('海报生成失败'); }
  finally { genCoverId.value = null; }
}

async function handleDelete(id) {
  try { await ElMessageBox.confirm('确定要移除这个片场吗？删掉就找不回来咯~', '移除片场', { type: 'warning', confirmButtonText: '狠心移除', cancelButtonText: '下次再说叭' }); } catch { return; }
  try { const info = await projectStore.deleteProject(id); const total = (info.scripts||0)+(info.characters||0)+(info.scenes||0)+(info.props||0)+(info.storyboards||0)+(info.compositions||0); ElMessage.success(`片场已拆除，释放了 ${total} 个关联资源 🧹`); } catch (e) { ElMessage.error('哎呀，移除出错啦，再试一次哦'); }
}

function statusLabel(s) { return { draft:'剧本筹备中', in_progress:'拍摄进行时', completed:'成片杀青啦', archived:'片场存档' }[s] || s; }
function sourceLabel(s) { return { ai_generated:'AI生成', manual_import:'已导入', none:'空白' }[s] || s; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN', { month:'short', day:'numeric' }) : ''; }
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Noto+Serif+SC:wght@400;600;700;900&display=swap');

.mag-page { padding: 0; font-family: 'Noto Serif SC', 'STSong', 'SimSun', 'Microsoft YaHei', serif; max-width: 1100px; margin: 0 auto; }

/* ===== Masthead ===== */
.mag-masthead { margin-bottom: 40px; border-bottom: 2px solid var(--gold); padding-bottom: 32px; }
.mag-issue-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.mag-issue-tag { font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 700; letter-spacing: 4px; color: var(--gold-dark); }
.mag-issue-date { font-size: 12px; color: var(--text-200); letter-spacing: 2px; }
.mag-title-row { display: flex; gap: 60px; }
.mag-title-col:first-child { flex: 0 0 280px; }
.mag-title-col:last-child { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 16px; }
.mag-title { font-family: 'Playfair Display', 'Noto Serif SC', serif; font-size: 72px; font-weight: 900; line-height: 0.95; color: var(--text-100); margin: 0; letter-spacing: -2px; }
.mag-subtitle { font-size: 15px; color: var(--text-200); margin: 12px 0 0; font-weight: 600; letter-spacing: 1px; }
.mag-intro { font-size: 14px; color: var(--text-200); line-height: 1.8; margin: 0; max-width: 420px; }
.mag-cta {
  align-self: flex-start; font-family: 'Playfair Display', 'Noto Serif SC', serif !important;
  background: var(--navy) !important; border: 2px solid var(--gold) !important; color: var(--gold) !important;
  padding: 14px 28px !important; font-size: 15px !important; font-weight: 700 !important;
  letter-spacing: 2px !important; border-radius: 0 !important; height: auto !important;
  transition: all 0.2s;
}
.mag-cta:hover { background: var(--gold) !important; color: var(--navy) !important; transform: translateX(4px); }

/* ===== Filters ===== */
.mag-filters { display: flex; gap: 10px; margin-bottom: 32px; flex-wrap: wrap; }
.mag-pill {
  font-size: 12px; padding: 6px 16px; border-radius: 0; cursor: pointer;
  border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500;
  transition: all 0.15s; user-select: none;
  font-family: 'DM Sans', 'Microsoft YaHei', sans-serif; letter-spacing: 1px;
}
.mag-pill:hover { border-color: var(--gold); color: var(--text-100); }
.mag-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); }

/* ===== Grid ===== */
.mag-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }

/* ===== Card ===== */
.mag-card {
  position: relative; background: var(--bg-200); overflow: hidden;
  border: 1px solid var(--bg-300); transition: all 0.3s;
  animation: magFadeUp 0.5s ease-out both;
  display: flex; flex-direction: column;
}
.mag-card:hover { border-color: var(--gold); box-shadow: 0 8px 32px rgba(139,105,20,0.1); transform: translateY(-2px); }
.mag-featured { grid-column: span 2; grid-row: span 1; flex-direction: row; }
.mag-featured .mag-cover { flex: 1; min-height: 280px; }
.mag-featured .mag-card-body { flex: 1; }

.mag-card-num {
  position: absolute; top: 12px; right: 16px; z-index: 2;
  font-family: 'Playfair Display', serif; font-size: 12px; font-weight: 700;
  color: var(--gold-light); background: var(--navy); padding: 2px 8px; letter-spacing: 2px;
}

/* Cover */
.mag-cover { position: relative; overflow: hidden; cursor: pointer; min-height: 160px; background: var(--bg-100); }
.mag-cover-img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; transition: transform 0.4s; }
.mag-card:hover .mag-cover-img { transform: scale(1.03); }
.mag-cover-placeholder { width: 100%; height: 100%; min-height: 160px; display: flex; align-items: center; justify-content: center; position: absolute; inset: 0; }
.mag-cover-emoji { font-size: 36px; opacity: 0.4; }
.mag-cover-gen-btn {
  position: absolute; bottom: 10px; right: 10px;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(201,168,76,0.85); color: var(--navy);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; cursor: pointer; opacity: 0;
  transition: all 0.2s; z-index: 2;
}
.mag-cover-placeholder:hover .mag-cover-gen-btn { opacity: 1; }
.mag-cover-gen-btn:hover { background: var(--gold); transform: scale(1.15); }

/* Card Body */
.mag-card-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
.mag-card-header { cursor: pointer; flex: 1; }
.mag-card-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.mag-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bg-300); }
.status-in_progress { background: var(--accent-100); }
.status-completed { background: var(--primary-100); }
.mag-status { font-size: 11px; color: var(--text-200); letter-spacing: 1px; font-family: 'DM Sans', 'Microsoft YaHei', sans-serif; }
.mag-card-title {
  font-family: 'Playfair Display', 'Noto Serif SC', serif;
  font-size: 20px; font-weight: 700; color: var(--text-100); margin: 0 0 6px;
  line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mag-featured .mag-card-title { font-size: 26px; }
.mag-card-desc {
  font-size: 13px; color: var(--text-200); line-height: 1.6; margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font-family: 'DM Sans', 'Microsoft YaHei', sans-serif;
}

/* Tags */
.mag-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.mag-tag {
  font-size: 10px; padding: 3px 10px; border: 1px solid var(--bg-300); color: var(--text-200);
  font-family: 'DM Sans', 'Microsoft YaHei', sans-serif; letter-spacing: 0.5px;
}

/* Footer */
.mag-card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--bg-300); }
.mag-date { font-size: 11px; color: var(--text-200); font-family: 'DM Sans', sans-serif; }
.mag-card-actions { display: flex; gap: 12px; }
.mag-action-btn {
  font-size: 11px; border: none; background: none; color: var(--text-200); cursor: pointer;
  font-family: 'DM Sans', 'Microsoft YaHei', sans-serif; padding: 0;
  letter-spacing: 0.5px; transition: color 0.15s;
}
.mag-action-btn:hover { color: var(--text-100); }
.mag-action-del:hover { color: #C44545; }

/* ===== Empty ===== */
.mag-empty { text-align: center; padding: 100px 20px; }
.mag-empty-num { font-family: 'Playfair Display', serif; font-size: 14px; color: var(--primary-300); letter-spacing: 4px; margin-bottom: 20px; }
.mag-empty h2 { font-family: 'Playfair Display', 'Noto Serif SC', serif; font-size: 28px; color: var(--text-100); margin: 0 0 8px; }
.mag-empty p { font-size: 14px; color: var(--text-200); margin: 0; }
.mag-empty-hint { font-size: 12px !important; color: var(--primary-300) !important; margin-top: 12px !important; }

/* ===== Dialog ===== */
.mag-template-section { margin-bottom: 20px; }
.mag-template-label { font-size: 12px; color: var(--text-200); display: block; margin-bottom: 10px; font-weight: 500; letter-spacing: 2px; }
.mag-template-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mag-tpl-chip {
  padding: 8px 16px; font-size: 13px; cursor: pointer; border: 1px solid var(--bg-300);
  color: var(--text-200); transition: all 0.15s; font-family: 'DM Sans', 'Microsoft YaHei', sans-serif;
}
.mag-tpl-chip:hover { border-color: var(--gold); color: var(--text-100); }
.mag-form .el-form-item { margin-bottom: 16px; }
.mag-form-row { display: flex; gap: 16px; }

/* ===== Poster Card ===== */
.has-poster {
  background-size: cover; background-position: center; min-height: 320px;
  cursor: pointer; position: relative; border: none;
}
.mag-featured.has-poster { min-height: 400px; }
.poster-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%);
  z-index: 1; border-radius: 0;
}
.poster-num { z-index: 3; color: rgba(255,255,255,0.7); background: transparent; }
.poster-body { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; justify-content: space-between; padding: 16px; }
.poster-top { display: flex; justify-content: flex-end; }
.poster-status { font-size: 10px; color: rgba(255,255,255,0.8); background: rgba(0,0,0,0.4); padding: 3px 10px; border-radius: 10px; letter-spacing: 1px; }
.poster-bottom { display: flex; flex-direction: column; gap: 6px; }
.poster-title { font-size: 22px; font-weight: 700; color: #fff; margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.8); line-height: 1.2; }
.mag-featured .poster-title { font-size: 30px; }
.poster-meta { font-size: 11px; color: rgba(255,255,255,0.7); display: flex; gap: 4px; }
.poster-actions { display: flex; gap: 8px; margin-top: 4px; }
.poster-btn { font-size: 11px; padding: 4px 12px; border: 1px solid rgba(255,255,255,0.4); background: rgba(0,0,0,0.3); color: rgba(255,255,255,0.8); cursor: pointer; border-radius: 4px; transition: all 0.15s; backdrop-filter: blur(4px); }
.poster-btn:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.7); }
.poster-btn-del:hover { border-color: #e88; color: #faa; }
.poster-btn-redraw { color: var(--gold); border-color: rgba(201,168,76,0.5); font-weight: 500; }
.poster-btn-redraw:hover { border-color: var(--gold); background: rgba(201,168,76,0.15); color: var(--gold-light); }

/* ===== Animations ===== */
@keyframes magFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 768px) {
  .mag-title-row { flex-direction: column; gap: 24px; }
  .mag-title-col:first-child { flex: none; }
  .mag-title { font-size: 48px; }
  .mag-grid { grid-template-columns: 1fr; }
  .mag-featured { grid-column: span 1; flex-direction: column; }
  .mag-featured .mag-cover { min-height: 200px; }
}
</style>
