<template>
  <div class="asset-root">
    <div class="top-bar">
      <div class="sg-project-pills">
        <span v-for="p in projectStore.projects" :key="p._id" :class="['sg-pill', { active: currentProjectId === p._id }]" @click="if (currentProjectId !== p._id) { resetToScriptGenerate(p._id); } currentProjectId = p._id">{{ p.name }}</span>
      </div>
    </div>

    <div class="master-detail" v-if="currentProjectId">
      <!-- ===== 左侧：资产列表 ===== -->
      <div class="left-list">
        <el-tabs v-model="activeTab" @tab-change="onTabChange">
          <el-tab-pane name="characters">
            <template #label><span style="display:inline-flex;align-items:center;gap:4px"><People size="14" fill="currentColor"/> 角色</span></template>
            <div class="list-header">
              <span>{{ assetStore.characters.length }} 位角色</span>
              <div style="display:flex;gap:6px">
                <el-button size="small" type="success" @click="batchGenerateAssets('characters')" :loading="batchGenning"><MagicWand size="13" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"/> 一键生图</el-button>
                <el-button size="small" type="primary" @click="createNew('character')"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> 新建</el-button>
              </div>
            </div>
            <div v-if="assetStore.characters.length > 0" class="batch-bar">
              <el-button size="small" link @click="toggleSelectAll('characters')">{{ selectedCharIds.length === assetStore.characters.length ? '取消全选' : '全选' }}</el-button>
              <span v-if="selectedCharIds.length > 0">已选 {{ selectedCharIds.length }}</span>
              <el-button v-if="selectedCharIds.length > 0" size="small" type="danger" @click="batchDeleteAssets('characters')">批量移除</el-button>
            </div>
            <div
              v-for="c in assetStore.characters" :key="c._id"
              :class="['list-item-char-card', { 'card-active': selectedAsset?._id === c._id && activeTab === 'characters' }]"
              :style="{ backgroundImage: getCharThumb(c) ? `url(${getCharThumb(c)})` : '' }"
              @click="selectAsset(c, 'character')"
            >
              <div class="card-overlay"></div>
              <div v-if="cardLoadingId === c._id" class="card-loading-mask">
                <span class="card-loading-spin"></span>
                <span class="card-loading-text">生成中...</span>
              </div>
              <div class="card-hover-actions">
                <label class="card-hover-btn card-hover-upload" @click.stop title="上传图片">
                  <input type="file" accept="image/*" hidden @change="e => onCharAvatarUpload(c, e)" />
                  <span>上传图片</span>
                </label>
              </div>
              <span class="card-view-btn" @click.stop="openImageViewer(c)" title="查看大图">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </span>
              <el-checkbox :model-value="selectedCharIds.includes(c._id)" @change="(v) => v ? selectedCharIds.push(c._id) : (selectedCharIds = selectedCharIds.filter(x => x !== c._id))" @click.stop class="card-check" />
              <div class="card-text-top">
                <span class="card-name">{{ c.name }}</span>
                <span class="card-meta">{{ c.roleType }} · {{ c.gender }} · {{ c.age }}岁</span>
              </div>
            </div>
            <el-empty v-if="assetStore.characters.length === 0" description="还没有角色哦，点击「新建」添加第一位演员吧 ✨" :image-size="40" />
          </el-tab-pane>

          <el-tab-pane name="scenes">
            <template #label><span style="display:inline-flex;align-items:center;gap:4px"><PictureOne size="14" fill="currentColor"/> 场景</span></template>
            <div class="list-header">
              <span>{{ assetStore.scenes.length }} 处场景</span>
              <div style="display:flex;gap:6px">
                <el-button size="small" type="success" @click="batchGenerateAssets('scenes')" :loading="batchGenning"><MagicWand size="13" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"/> 一键生图</el-button>
                <el-button size="small" type="primary" @click="createNew('scene')"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> 新建</el-button>
              </div>
            </div>
            <div v-if="assetStore.scenes.length > 0" class="batch-bar">
              <el-button size="small" link @click="toggleSelectAll('scenes')">{{ selectedSceneIds.length === assetStore.scenes.length ? '取消全选' : '全选' }}</el-button>
              <span v-if="selectedSceneIds.length > 0">已选 {{ selectedSceneIds.length }}</span>
              <el-button v-if="selectedSceneIds.length > 0" size="small" type="danger" @click="batchDeleteAssets('scenes')">批量移除</el-button>
            </div>
            <div
              v-for="s in assetStore.scenes" :key="s._id"
              :class="['list-item-char-card', { 'card-active': selectedAsset?._id === s._id && activeTab === 'scenes' }]"
              :style="{ backgroundImage: getSceneThumb(s) ? `url(${getSceneThumb(s)})` : '' }"
              @click="selectAsset(s, 'scene')"
            >
              <div class="card-overlay"></div>
              <div v-if="cardLoadingId === s._id" class="card-loading-mask">
                <span class="card-loading-spin"></span>
                <span class="card-loading-text">生成中...</span>
              </div>
              <div class="card-hover-actions">
                <label class="card-hover-btn card-hover-upload" @click.stop title="上传场景图">
                  <input type="file" accept="image/*" hidden @change="e => onSceneImageUpload(s, e)" />
                  <span>上传图片</span>
                </label>
              </div>
              <span class="card-view-btn" @click.stop="openSceneViewer(s)" title="查看大图">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </span>
              <el-checkbox :model-value="selectedSceneIds.includes(s._id)" @change="(v) => v ? selectedSceneIds.push(s._id) : (selectedSceneIds = selectedSceneIds.filter(x => x !== s._id))" @click.stop class="card-check" />
              <div class="card-text-top">
                <span class="card-name">{{ s.sceneName }}</span>
              </div>
            </div>
            <el-empty v-if="assetStore.scenes.length === 0" description="还没有场景哦，点击「新建」添加第一处场景吧" :image-size="40" />
          </el-tab-pane>

          <el-tab-pane name="props">
            <template #label><span style="display:inline-flex;align-items:center;gap:4px"><Tool size="14" fill="currentColor"/> 道具</span></template>
            <div class="list-header">
              <span>{{ assetStore.props.length }} 件道具</span>
              <div style="display:flex;gap:6px">
                <el-button size="small" type="success" @click="batchGenerateAssets('props')" :loading="batchGenning"><MagicWand size="13" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"/> 一键生图</el-button>
                <el-button size="small" type="primary" @click="createNew('prop')"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> 新建</el-button>
              </div>
            </div>
            <div v-if="assetStore.props.length > 0" class="batch-bar">
              <el-button size="small" link @click="toggleSelectAll('props')">{{ selectedPropIds.length === assetStore.props.length ? '取消全选' : '全选' }}</el-button>
              <span v-if="selectedPropIds.length > 0">已选 {{ selectedPropIds.length }}</span>
              <el-button v-if="selectedPropIds.length > 0" size="small" type="danger" @click="batchDeleteAssets('props')">批量移除</el-button>
            </div>
            <div
              v-for="p in assetStore.props" :key="p._id"
              :class="['list-item-char-card', { 'card-active': selectedAsset?._id === p._id && activeTab === 'props' }]"
              :style="{ backgroundImage: getPropThumb(p) ? `url(${getPropThumb(p)})` : '' }"
              @click="selectAsset(p, 'prop')"
            >
              <div class="card-overlay"></div>
              <div v-if="cardLoadingId === p._id" class="card-loading-mask">
                <span class="card-loading-spin"></span>
                <span class="card-loading-text">生成中...</span>
              </div>
              <div class="card-hover-actions">
                <label class="card-hover-btn card-hover-upload" @click.stop title="上传道具图">
                  <input type="file" accept="image/*" hidden @change="e => onPropImageUpload(p, e)" />
                  <span>上传图片</span>
                </label>
              </div>
              <span class="card-view-btn" @click.stop="openPropViewer(p)" title="查看大图">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </span>
              <el-checkbox :model-value="selectedPropIds.includes(p._id)" @change="(v) => v ? selectedPropIds.push(p._id) : (selectedPropIds = selectedPropIds.filter(x => x !== p._id))" @click.stop class="card-check" />
              <div class="card-text-top">
                <span class="card-name">{{ p.propName }}</span>
              </div>
            </div>
            <el-empty v-if="assetStore.props.length === 0" description="还没有道具哦，点击「新建」添加第一件道具吧" :image-size="40" />
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- ===== 右侧：详情面板 ===== -->
      <div class="right-detail" v-if="selectedAsset">
        <div class="detail-scroll">
          <!-- 资产信息 -->
          <div class="asset-info-header">
            <template v-if="activeTab === 'characters'">
              <el-form label-position="top" size="small">
                <el-form-item label="角色名称">
                  <el-input v-model="selectedAsset.name" placeholder="角色名称" />
                </el-form-item>
                <el-row :gutter="12">
                  <el-col :span="8">
                    <el-form-item label="角色类型">
                      <el-select v-model="selectedAsset.roleType" style="width:100%">
                        <el-option label="主角" value="主角" />
                        <el-option label="配角" value="配角" />
                        <el-option label="反派" value="反派" />
                        <el-option label="龙套" value="龙套" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="性别">
                      <el-select v-model="selectedAsset.gender" style="width:100%">
                        <el-option label="男" value="男" />
                        <el-option label="女" value="女" />
                        <el-option label="其他" value="其他" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="年龄">
                      <el-input-number v-model="selectedAsset.age" :min="0" :max="999" style="width:100%" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item label="外貌描述"><el-input v-model="selectedAsset.appearance" type="textarea" :rows="2" placeholder="描述角色的外貌特征..." /></el-form-item>
                <el-form-item label="性格特征"><el-input v-model="selectedAsset.personality" placeholder="角色的性格特点..." /></el-form-item>
                <el-form-item label="背景故事"><el-input v-model="selectedAsset.background" type="textarea" :rows="2" placeholder="角色的背景故事..." /></el-form-item>
              </el-form>
            </template>
            <template v-else-if="activeTab === 'scenes'">
              <el-form label-position="top" size="small">
                <el-form-item label="场景名称">
                  <el-input v-model="selectedAsset.sceneName" placeholder="场景名称" />
                </el-form-item>
                <el-form-item label="场景描述">
                  <el-input v-model="selectedAsset.description" type="textarea" :rows="3" />
                </el-form-item>
              </el-form>
              <div class="prompt-section" style="margin-top:12px">
                <div class="section-label">生图提示词<span class="char-count">{{ promptText.length }} / 5000</span>
                  <el-button size="small" type="primary" link @click="generatePrompt" :loading="generatingPrompt">AI 生成</el-button>
                </div>
                <el-input v-model="promptText" type="textarea" :rows="4" placeholder="输入场景提示词..." maxlength="5000" show-word-limit />
              </div>
              <div class="model-section">
                <div class="section-label">模型选择</div>
                <el-select v-model="selectedModel" style="width:100%">
                  <el-option label="Seedream 4.0 | 2K" value="doubao_image" />
                  <el-option label="gpt-image-2" value="openai_image" />
                </el-select>
              </div>
              <div class="model-section">
                <div class="section-label">画幅比例</div>
                <el-select v-model="genRatio" size="small" style="width:100%">
                  <el-option label="9:16 竖屏" value="9:16" />
                  <el-option label="16:9 横屏" value="16:9" />
                  <el-option label="4:3" value="4:3" />
                  <el-option label="3:4" value="3:4" />
                </el-select>
              </div>
              <el-button type="primary" size="large" style="width:100%;margin-top:12px" @click="generateImage" :loading="generatingImage">生成场景图</el-button>
            </template>
            <template v-else>
              <el-form label-position="top" size="small">
                <el-form-item label="道具名称">
                  <el-input v-model="selectedAsset.propName" placeholder="道具名称" />
                </el-form-item>
                <el-form-item label="道具描述">
                  <el-input v-model="selectedAsset.description" type="textarea" :rows="3" />
                </el-form-item>
              </el-form>
              <div class="prompt-section" style="margin-top:12px">
                <div class="section-label">生图提示词<span class="char-count">{{ promptText.length }} / 5000</span>
                  <el-button size="small" type="primary" link @click="generatePrompt" :loading="generatingPrompt">AI 生成</el-button>
                </div>
                <el-input v-model="promptText" type="textarea" :rows="4" placeholder="输入道具提示词..." maxlength="5000" show-word-limit />
              </div>
              <div class="model-section">
                <div class="section-label">模型选择</div>
                <el-select v-model="selectedModel" style="width:100%">
                  <el-option label="Seedream 4.0 | 2K" value="doubao_image" />
                  <el-option label="gpt-image-2" value="openai_image" />
                </el-select>
              </div>
<div class="model-section"><div class="section-label">画幅比例</div><el-select v-model="genRatio" size="small" style="width:100%"><el-option label="9:16 竖屏" value="9:16" /><el-option label="16:9 横屏" value="16:9" /><el-option label="4:3" value="4:3" /><el-option label="3:4" value="3:4" /></el-select></div>
              <el-button type="primary" size="large" style="width:100%;margin-top:12px" @click="generateImage" :loading="generatingImage">生成道具图</el-button>
            </template>
          </div>

          <!-- 生图提示词（仅角色） -->
          <template v-if="activeTab === 'characters'">
            <div class="prompt-section">
              <div class="section-label">
                生图提示词
                <span class="char-count">{{ promptText.length }} / 5000</span>
                <el-tooltip content="一键拼接标准四格角色设定卡提示词（左区特写 + 右区正/侧/后三视图），白色背景，16:9 横屏适用" placement="top" :show-after="300"><el-button size="small" type="warning" link @click="buildCharSheetPrompt" :disabled="!selectedAsset?.appearance">构建提示词</el-button></el-tooltip>
                <el-tooltip content="AI 读懂角色信息，智能润色优化提示词的细节、光影、构图，让生图质量更高" placement="top" :show-after="300"><el-button size="small" type="primary" link @click="generatePrompt" :loading="generatingPrompt">AI 润色</el-button></el-tooltip>
              </div>
              <el-input v-model="promptText" type="textarea" :rows="5" placeholder="输入或生成生图提示词..." maxlength="5000" show-word-limit />
            </div>
            <div class="model-section">
              <div class="section-label">模型选择</div>
              <el-select v-model="selectedModel" style="width:100%">
                <el-option label="Seedream 4.0 | 2K" value="doubao_image" />
                <el-option label="Seedream 4.0 | 4K" value="doubao_image_4k" />
                <el-option label="gpt-image-2" value="openai_image" />
              </el-select>
            </div>
<div class="model-section"><div class="section-label">画幅比例</div><el-select v-model="genRatio" size="small" style="width:100%"><el-option label="9:16 竖屏" value="9:16" /><el-option label="16:9 横屏" value="16:9" /><el-option label="4:3" value="4:3" /><el-option label="3:4" value="3:4" /></el-select></div>
            <el-button type="primary" size="large" style="width:100%;margin-top:12px" @click="generateImage" :loading="generatingImage">生成角色图</el-button>
            <!-- 参考图预览 + 删除 -->
            <div v-if="activeTab === 'characters' && charMainImage" style="margin-top:14px">
              <div class="section-label">参考图预览</div>
              <div style="position:relative;display:inline-block">
                <img :src="charMainImage" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:2px solid var(--bg-300)" />
                <el-button size="small" type="danger" circle style="position:absolute;top:-6px;right:-6px" @click="removeCharRefImage">×</el-button>
              </div>
            </div>
          </template>

          <!-- 底部操作 -->
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--bg-300);display:flex;gap:8px">
            <el-button type="danger" size="small" @click="handleDelete">移除</el-button>
            <el-button size="small" @click="saveAssetDetails" :loading="saving">保存修改</el-button>
          </div>
        </div>
      </div>

      <!-- 未选择资产 -->
      <div class="right-detail right-empty" v-if="!selectedAsset && currentProjectId">
        <el-empty description="点击左侧卡片查看详情和提示词" />
      </div>
    </div>

    <el-empty v-if="!currentProjectId" description="请先在上方选择一个片场" style="margin-top:80px" />

    <!-- ===== 新建对话框 ===== -->
    <el-dialog v-model="createDialogVisible" :title="createDialogTitle" width="420px" destroy-on-close>
      <el-form :model="createForm" label-position="top" size="small">
        <el-form-item :label="createDialogType === 'character' ? '角色名称 *' : createDialogType === 'scene' ? '场景名称' : '道具名称'" required>
          <el-input v-model="createForm.name" placeholder="请输入名称" maxlength="20" show-word-limit />
        </el-form-item>
        <template v-if="createDialogType === 'character'">
          <el-form-item label="角色类型">
            <el-select v-model="createForm.roleType" style="width:100%">
              <el-option label="主角" value="主角" />
              <el-option label="配角" value="配角" />
              <el-option label="反派" value="反派" />
              <el-option label="龙套" value="龙套" />
            </el-select>
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="createForm.gender">
              <el-radio value="男">男</el-radio>
              <el-radio value="女">女</el-radio>
              <el-radio value="其他">其他</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="年龄">
            <el-input-number v-model="createForm.age" :min="0" :max="999" />
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="描述">
            <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="可选，稍后也可在详情面板中填写" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate" :loading="creating">确认创建</el-button>
      </template>
    </el-dialog>

    <ImageLightbox
      v-model:visible="viewerVisible"
      :url="viewerSrc"
      :title="viewerChar?.name || viewerChar?.sceneName || viewerChar?.propName || ''"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PictureFilled } from '@element-plus/icons-vue';
import { People, PictureOne, MagicWand, FolderDownload, Voice, Tool } from '@icon-park/vue-next';
import { useProjectStore } from '../stores/project';
import { useAssetStore } from '../stores/asset';
import { assetAPI } from '../api';
import ImageLightbox from '../components/ImageLightbox.vue';


const resetToScriptGenerate = inject('resetToScriptGenerate', () => {});
const projectStore = useProjectStore();
const assetStore = useAssetStore();

const currentProjectId = ref('');
const activeTab = ref('characters');
const selectedAsset = ref(null);
const selectedAssetType = ref('');
const promptText = ref('');
const selectedModel = ref('doubao_image');
const genRatio = ref('9:16');
const generatingPrompt = ref(false);
const generatingImage = ref(false);
const cardLoadingId = ref(null);
const batchGenning = ref(false);
const saving = ref(false);
const uploadUrl = '/api/v1/assets/upload-reference';
const uploadHeaders = {};
const selectedCharIds = ref([]);
const selectedSceneIds = ref([]);
const selectedPropIds = ref([]);

// 新建对话框
const createDialogVisible = ref(false);
const createDialogType = ref('character'); // 'character' | 'scene' | 'prop'
const createForm = reactive({ name: '', roleType: '配角', gender: '其他', age: 0, description: '' });
const creating = ref(false);
const createDialogTitle = computed(() => ({ character: '新建角色', scene: '新建场景', prop: '新建道具' }[createDialogType.value]));

function onAssetCheck() {}

function toggleSelectAll(type) {
  const map = {
    characters: { ids: selectedCharIds, list: assetStore.characters },
    scenes: { ids: selectedSceneIds, list: assetStore.scenes },
    props: { ids: selectedPropIds, list: assetStore.props },
  };
  const cfg = map[type];
  if (!cfg) return;
  if (cfg.ids.value.length === cfg.list.length) {
    cfg.ids.value = [];
  } else {
    cfg.ids.value = cfg.list.map(item => item._id);
  }
}

async function batchDeleteAssets(type) {
  const map = {
    characters: { ids: selectedCharIds, api: assetAPI.batchDeleteCharacters },
    scenes: { ids: selectedSceneIds, api: assetAPI.batchDeleteScenes },
    props: { ids: selectedPropIds, api: assetAPI.batchDeleteProps },
  };
  const cfg = map[type];
  if (!cfg || cfg.ids.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认移除选中的 ${cfg.ids.value.length} 个？`, '批量移除', { type: 'warning' });
  } catch { return; }
  try {
    await cfg.api([...cfg.ids.value]);
    cfg.ids.value = [];
    if (currentProjectId.value) onProjectChange(currentProjectId.value);
    ElMessage.success(`已移除`);
  } catch (e) { ElMessage.error('批量哎呀，移除出错啦，再试一次哦'); }
}

const tabLabel = computed(() => ({ characters: '角色', scenes: '场景', props: '道具' }[activeTab.value] || ''));

const morphImages = computed(() => {
  const m = selectedAsset.value?.morphs?.[0];
  if (m?.generatedImages) {
    const gi = m.generatedImages;
    return [gi.front, gi.side, gi.back].filter(Boolean);
  }
  return [];
});
const charMainImage = computed(() => morphImages.value[0] || selectedAsset.value?.morphs?.[0]?.referenceImage || selectedAsset.value?.referenceImage || null);
const charFrontImage = computed(() => morphImages.value[0] || null);
const charSideImage = computed(() => morphImages.value[1] || null);
const charBackImage = computed(() => morphImages.value[2] || null);
const charVoice = computed({
  get: () => selectedAsset.value?.voiceConfig?.voiceId || 'gentle_female',
  set: (v) => { if (selectedAsset.value) { if (!selectedAsset.value.voiceConfig) selectedAsset.value.voiceConfig = {}; selectedAsset.value.voiceConfig.voiceId = v; } },
});

function getCharThumb(c) {
  return c.morphs?.[0]?.referenceImage || c.morphs?.[0]?.generatedImages?.front || c.referenceImage || c.generatedImage || '';
}
function getSceneThumb(s) { return s.generatedImage || s.referenceImage || ''; }
function getPropThumb(p) { return p.generatedImage || p.referenceImage || ''; }

const viewerVisible = ref(false);
const viewerChar = ref(null);
const viewerSrc = ref('');

function openImageViewer(c) {
  viewerChar.value = c;
  viewerSrc.value = getCharThumb(c) || '';
  viewerVisible.value = true;
}
function openSceneViewer(s) { viewerChar.value = { name: s.sceneName }; viewerSrc.value = getSceneThumb(s) || ''; viewerVisible.value = true; }
function openPropViewer(p) { viewerChar.value = { name: p.propName }; viewerSrc.value = getPropThumb(p) || ''; viewerVisible.value = true; }

async function onSceneImageUpload(s, e) {
  const file = e.target.files?.[0];
  if (!file || !s) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    s.referenceImage = ev.target.result;
    s.generatedImage = ev.target.result;
    try { await assetAPI.updateScene(s._id, { referenceImage: ev.target.result, generatedImage: ev.target.result }); } catch {}
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
async function onPropImageUpload(p, e) {
  const file = e.target.files?.[0];
  if (!file || !p) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    p.referenceImage = ev.target.result;
    p.generatedImage = ev.target.result;
    try { await assetAPI.updateProp(p._id, { referenceImage: ev.target.result, generatedImage: ev.target.result }); } catch {}
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function onCharAvatarUpload(c, e) {
  const file = e.target.files?.[0];
  if (!file || !c) return;
  try {
    const res = await assetAPI.uploadCharacterImage(c._id, file);
    const imageUrl = res.data?.imageUrl;
    if (imageUrl) {
      if (!c.morphs || c.morphs.length === 0) {
        c.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
      }
      c.morphs[0].referenceImage = imageUrl;
      c.morphs[0].generatedImages.front = imageUrl;
      c.referenceImage = imageUrl;
    }
    ElMessage.success(`${c.name} 头像内容已经稳稳保存好咯~`);
  } catch (err) {
    ElMessage.error('文件上传失败啦，请检查一下再重试哦: ' + (err.response?.data?.message || err.message));
  }
  e.target.value = '';
}

onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  if (window.__assetGenning) { generatingImage.value = true; window.__setLoading?.(true); }
  if (restored) { currentProjectId.value = restored._id; onProjectChange(restored._id); }
});

const projectAspectRatio = ref('9:16');

async function onProjectChange(val) {
  if (val) {
    assetStore.fetchCharacters(val); assetStore.fetchScenes(val); assetStore.fetchProps(val);
    try {
      const project = await projectStore.fetchProject(val);
      if (project?.videoConfig?.aspectRatio) projectAspectRatio.value = project.videoConfig.aspectRatio;
    } catch (e) {}
  }
}

function onTabChange() { selectedAsset.value = null; promptText.value = ''; }

function selectAsset(asset, type) {
  selectedAsset.value = asset;
  selectedAssetType.value = type;
  if (type === 'character') {
    promptText.value = asset.morphs?.[0]?.appearancePrompt || asset.appearance || '';
  } else if (type === 'scene') {
    promptText.value = asset.stylePrompt || asset.description || '';
  } else {
    promptText.value = asset.description || '';
  }
  selectedModel.value = 'doubao_image';
  genRatio.value = type === 'character' ? '16:9' : (projectAspectRatio.value || '9:16');
}

function createNew(type) {
  createDialogType.value = type;
  createForm.name = ''; createForm.description = '';
  if (type === 'character') {
    createForm.roleType = '配角'; createForm.gender = '其他'; createForm.age = 0;
  }
  createDialogVisible.value = true;
}

async function submitCreate() {
  if (!createForm.name.trim()) { ElMessage.warning('请输入名称'); return; }
  creating.value = true;
  try {
    let asset;
    if (createDialogType.value === 'character') {
      asset = await assetStore.createCharacter({
        projectId: currentProjectId.value,
        name: createForm.name.trim(),
        roleType: createForm.roleType,
        gender: createForm.gender,
        age: createForm.age,
      });
    } else if (createDialogType.value === 'scene') {
      asset = await assetStore.createScene({
        projectId: currentProjectId.value,
        sceneName: createForm.name.trim(),
        description: createForm.description.trim(),
      });
    } else {
      asset = await assetStore.createProp({
        projectId: currentProjectId.value,
        propName: createForm.name.trim(),
        description: createForm.description.trim(),
      });
    }
    createDialogVisible.value = false;
    selectAsset(asset, createDialogType.value);
    ElMessage.success('创建成功 ✨');
  } catch (e) {
    ElMessage.error('创建失败: ' + (e.response?.data?.message || e.message));
  } finally {
    creating.value = false;
  }
}

function buildCharSheetPrompt() {
  const a = selectedAsset.value;
  if (!a) return ElMessage.warning('请先选择一个角色');
  const outfit = (a.appearance || '').replace(/外貌[：:]\s*/g, '').trim();
  const personality = (a.personality || '').trim();
  const bg = (a.background || '').trim().substring(0, 80);
  const roleDesc = [a.roleType || '角色', a.gender || '', a.age ? a.age + '岁' : ''].filter(Boolean).join('，');

  promptText.value = [
    '【强约束】画面中严禁出现任何文字、字母、乱码、logo、水印、标题、字幕、签名、符号，纯画面，无任何额外元素',
    '【画质/风格】8K超写实，角色设定卡风格，纯白色背景，工作室柔光，85mm镜头无畸变，角色设计参考图，高细节',
    `【角色信息】${a.name}，${roleDesc}`,
    `【外貌设定】${outfit}${personality ? '，' + personality : ''}${bg ? '。背景：' + bg : ''}`,
    '【画面布局—4格角色设定卡】',
    '┌──────────┬──────────────────────────┐',
    '│ 左区     │ 右区（上排）             │',
    '│ 特写图   │ 正视图：正面站立全身     │',
    '│ 头部至   │                          │',
    '│ 上半身   │ 侧视图：左侧全身         │',
    '│ 五官清晰 │ 后视图：背面全身         │',
    '│ 肤质可见 │                          │',
    '└──────────┴──────────────────────────┘',
    '左区（占画面约 35% 宽度）：角色头部到胸部近景特写，脸部占据左区 70% 面积，五官纹理清晰可见，中性表情，眼神平静，发丝细节丰富',
    '右区（占画面约 65% 宽度）：横排三个等宽视图——正视图（正面直立）、侧视图（左侧90°）、后视图（背面直立），三个视图高度统一为画面高度的 75%，角色从头顶到脚尖完整可见',
    '【一致性】特写与三视图为同一角色，五官、发型、服装、体态 100% 一致',
    '【约束】纯白背景，无阴影，平视，正面光，角色直立无动作，双手自然垂放，中性表情，不戴墨镜/帽子等额外配饰，不露腿，服装完整无破损',
  ].join('；\n');

  ElMessage.success('提示词已构建，可点击「AI 润色」优化或将「16:9 横屏」后直接生图');
}

async function generatePrompt() {
  if (!selectedAsset.value || !currentProjectId.value) return;
  generatingPrompt.value = true;
  try {
    const res = await assetAPI.generatePrompt({
      projectId: currentProjectId.value,
      assetId: selectedAsset.value._id,
      assetType: selectedAssetType.value,
      existingPrompt: promptText.value,
    });
    promptText.value = res.data.prompt;
    // 同步到 asset + 持久化数据库
    if (selectedAssetType.value === 'character') {
      if (!selectedAsset.value.morphs || selectedAsset.value.morphs.length === 0) {
        selectedAsset.value.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
      }
      selectedAsset.value.morphs[0].appearancePrompt = promptText.value;
      try { await assetAPI.updateCharacter(selectedAsset.value._id, { morphs: selectedAsset.value.morphs }); } catch {}
    } else if (selectedAssetType.value === 'scene') {
      selectedAsset.value.stylePrompt = promptText.value;
      try { await assetAPI.updateScene(selectedAsset.value._id, { stylePrompt: promptText.value }); } catch {}
    } else {
      selectedAsset.value.description = promptText.value;
      try { await assetAPI.updateProp(selectedAsset.value._id, { description: promptText.value }); } catch {}
    }
    ElMessage.success('提示词已生成并保存 ✨');
  } catch (e) {
    ElMessage.error('提示词生成失败: ' + (e.response?.data?.message || e.message));
  } finally {
    generatingPrompt.value = false;
  }
}

async function generateImage() {
  if (!promptText.value) { ElMessage.warning('请先填写生图提示词'); return; }
  // 快照：锁定当前角色，防止生图中切换人物导致图片串位
  const targetAsset = selectedAsset.value;
  const targetType = selectedAssetType.value;
  generatingImage.value = true;
  cardLoadingId.value = targetAsset._id;
  window.__assetGenning = true;
  window.__setLoading?.(true);
  try {
    // 收集参考图：角色的 morphs 图片 + referenceImage
    const refImages = [];
    if (targetType === 'character') {
      const morph = targetAsset.morphs?.[0];
      if (morph?.referenceImage) refImages.push(morph.referenceImage);
      if (targetAsset.referenceImage && !refImages.includes(targetAsset.referenceImage)) refImages.push(targetAsset.referenceImage);
    } else if (targetType === 'scene') {
      if (targetAsset.referenceImage) refImages.push(targetAsset.referenceImage);
    }
    console.log('[AssetManager-生图] 参考图数量:', refImages.length, 'URLs:', refImages.map(u => u.substring(0, 60)));

    const res = await assetAPI.generateImage({
      projectId: currentProjectId.value,
      assetId: targetAsset._id,
      assetType: targetType,
      prompt: promptText.value,
      model: selectedModel.value,
      ratio: genRatio.value,
      referenceImages: refImages,
    });
    if (res.data?.imageUrl) {
      const url = res.data.imageUrl;
      const isCloud = url.startsWith('https://') || url.startsWith('http://');
      console.log('[角色小店-生图] 返回URL:', url, isCloud ? '(公网云存储 ✅)' : '(本地路径 ⚠️)');
      if (targetType === 'character') {
        if (!targetAsset.morphs || targetAsset.morphs.length === 0) {
          targetAsset.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
        }
        targetAsset.morphs[0].generatedImages.front = url;
        targetAsset.morphs[0].referenceImage = url;
      }
      targetAsset.generatedImage = url;
      targetAsset.referenceImage = url;
    }
    ElMessage.success('图片生成完成 🎉');
  } catch (e) {
    ElMessage.error('生图失败: ' + (e.response?.data?.message || e.message));
  } finally {
    generatingImage.value = false;
    cardLoadingId.value = null;
    window.__assetGenning = false;
    window.__setLoading?.(false);
  }
}

function onRefUploaded(resp) {
  if (resp.data?.url) {
    if (selectedAssetType.value === 'character' && selectedAsset.value) {
      if (!selectedAsset.value.morphs || selectedAsset.value.morphs.length === 0) {
        selectedAsset.value.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
      }
      selectedAsset.value.morphs[0].referenceImage = resp.data.url;
    }
    selectedAsset.value.referenceImage = resp.data.url;
    ElMessage.success('参考图上传成功');
  }
}

function previewRef(file) {
  window.open(file.url, '_blank');
}

async function saveAssetDetails() {
  if (!selectedAsset.value) return;
  saving.value = true;
  try {
    if (selectedAssetType.value === 'character') {
      await assetAPI.updateCharacter(selectedAsset.value._id, {
        name: selectedAsset.value.name,
        roleType: selectedAsset.value.roleType,
        gender: selectedAsset.value.gender,
        age: selectedAsset.value.age,
        appearance: selectedAsset.value.appearance,
        personality: selectedAsset.value.personality,
        background: selectedAsset.value.background,
        morphs: selectedAsset.value.morphs,
      });
    } else if (selectedAssetType.value === 'scene') {
      await assetAPI.updateScene(selectedAsset.value._id, {
        sceneName: selectedAsset.value.sceneName,
        stylePrompt: promptText.value,
        description: selectedAsset.value.description,
      });
    } else {
      await assetAPI.updateProp(selectedAsset.value._id, {
        propName: selectedAsset.value.propName,
        description: promptText.value || selectedAsset.value.description,
      });
    }
    ElMessage.success('内容已经稳稳保存好咯~');
  } catch (e) {
    ElMessage.error('哎呀，保存出错啦，再试一次哦');
  } finally {
    saving.value = false;
  }
}

async function removeCharRefImage() {
  if (!selectedAsset.value) return;
  try {
    if (selectedAsset.value.morphs?.[0]) {
      selectedAsset.value.morphs[0].referenceImage = '';
      selectedAsset.value.morphs[0].generatedImages = { front: '', side: '', back: '' };
    }
    selectedAsset.value.referenceImage = '';
    await assetAPI.updateCharacter(selectedAsset.value._id, { morphs: selectedAsset.value.morphs, referenceImage: '' });
    ElMessage.success('参考图已删除');
  } catch (e) { ElMessage.error('删除失败'); }
}

async function handleDelete() {
  if (!selectedAsset.value) return;
  try { await ElMessageBox.confirm('确认移除这个资产？', '提示', { type: 'warning' }); } catch { return; }
  try {
    if (selectedAssetType.value === 'character') {
      await assetStore.deleteCharacter(selectedAsset.value._id);
    } else if (selectedAssetType.value === 'scene') {
      await assetStore.deleteScene(selectedAsset.value._id);
    } else {
      await assetStore.deleteProp(selectedAsset.value._id);
    }
    selectedAsset.value = null;
    ElMessage.success('已移除');
  } catch (e) { ElMessage.error('哎呀，移除出错啦，再试一次哦'); }
}

async function batchGenerateAssets(type) {
  const map = {
    characters: { list: assetStore.characters, promptFn: (a) => a.morphs?.[0]?.appearancePrompt || a.appearance || '', apiFn: (a) => assetAPI.generateImage({ projectId: currentProjectId.value, assetId: a._id, assetType: 'character', prompt: a.morphs?.[0]?.appearancePrompt || a.appearance || '', model: selectedModel.value, ratio: genRatio.value }) },
    scenes: { list: assetStore.scenes, promptFn: (a) => a.stylePrompt || a.description || '', apiFn: (a) => assetAPI.generateImage({ projectId: currentProjectId.value, assetId: a._id, assetType: 'scene', prompt: a.stylePrompt || a.description || '', model: selectedModel.value, ratio: genRatio.value }) },
    props: { list: assetStore.props, promptFn: (a) => a.description || '', apiFn: (a) => assetAPI.generateImage({ projectId: currentProjectId.value, assetId: a._id, assetType: 'prop', prompt: a.description || '', model: selectedModel.value, ratio: genRatio.value }) },
  };
  const cfg = map[type];
  if (!cfg || cfg.list.length === 0) { ElMessage.warning('没有可生成的资产'); return; }
  const hasImg = (a) => {
    const m = a.morphs?.[0];
    return a.generatedImage || a.referenceImage ||
      m?.generatedImages?.front || m?.generatedImages?.side || m?.generatedImages?.back ||
      m?.referenceImage;
  };
  const pending = cfg.list.filter(a => cfg.promptFn(a) && !hasImg(a));
  const alreadyDone = cfg.list.filter(a => cfg.promptFn(a) && hasImg(a)).length;
  if (pending.length === 0) { ElMessage.warning('没有含提示词的资产，请先生成提示词'); return; }
  const msg = alreadyDone > 0 ? `剩余 ${pending.length} 个待生成（${alreadyDone} 个已有图片将被跳过），确认开始？` : `将为 ${pending.length} 个资产批量生图，确认开始？`;
  try { await ElMessageBox.confirm(msg, '一键生图', { type: 'info' }); } catch { return; }

  batchGenning.value = true;
  window.__assetGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  for (const a of pending) {
    try {
      const res = await cfg.apiFn(a);
      const url = res.data?.imageUrl;
      if (url) {
        if (type === 'characters') {
          if (!a.morphs || a.morphs.length === 0) a.morphs = [{ morphName: '默认', appearancePrompt: '', referenceImage: '', generatedImages: { front: '', side: '', back: '' }, outfitDescription: '', expressionSet: [] }];
          a.morphs[0].generatedImages.front = url; a.morphs[0].referenceImage = url;
        }
        a.generatedImage = url; a.referenceImage = url; done++;
      }
    } catch (e) { console.error('batch gen fail:', e); }
  }
  batchGenning.value = false;
  cardLoadingId.value = null;
  window.__assetGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`一键生图完成：${done}/${pending.length}`);
}
</script>

<style scoped>
.asset-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.top-bar { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 16px; flex-shrink: 0; }
.master-detail { display: flex; flex: 1; gap: 16px; overflow: hidden; min-height: 0; }

/* ===== 左侧列表 ===== */
.left-list {
  width: 310px; flex-shrink: 0; background: var(--bg-200);
  border-radius: 12px; border: 1px solid var(--bg-300); overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.list-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; color: var(--text-100); font-size: 13px; font-weight: 600;
  border-bottom: 1px solid var(--bg-300);
}

/* 图片卡片 */
.list-item-char-card {
  position: relative; height: 115px; border-radius: 12px; margin: 8px 12px;
  background-size: cover; background-position: center top; background-color: #f0ebe3;
  cursor: pointer; overflow: hidden; border: 2px solid transparent;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-item-char-card:hover { transform: translateY(-2px); border-color: #FEACA5; box-shadow: 0 6px 24px rgba(0,0,0,0.1); }
.card-active { border-color: #FE7C6E !important; box-shadow: 0 0 0 3px rgba(254,124,110,0.15) !important; }
.card-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.4) 100%);
}
.card-active .card-overlay { background: linear-gradient(to bottom, rgba(254,124,110,0.2) 0%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.45) 100%); }

/* 卡片生成中遮罩 */
.card-loading-mask {
  position: absolute; inset: 0; z-index: 4;
  background: rgba(26,26,46,0.6); backdrop-filter: blur(4px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  border-radius: 12px;
}
.card-loading-spin {
  width: 28px; height: 28px; border: 3px solid rgba(201,168,76,0.25);
  border-top-color: var(--gold); border-radius: 50%;
  animation: gen-spin 0.8s linear infinite;
}
@keyframes gen-spin { 100% { transform: rotate(360deg); } }
.card-loading-text {
  color: var(--gold); font-size: 12px; font-weight: 700;
  letter-spacing: 2px;
  animation: gen-pulse 1.2s ease-in-out infinite;
}
@keyframes gen-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

/* 卡片文字 */
.card-text-top {
  position: absolute; top: 12px; left: 40px; right: 12px;
  display: flex; justify-content: space-between; align-items: baseline; z-index: 2;
}
.card-name {
  color: #fff; font-size: 15px; font-weight: 700;
  text-shadow: 0 1px 6px rgba(0,0,0,0.7);
}
.card-meta {
  color: rgba(255,255,255,0.82); font-size: 10px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
}

/* 悬浮上传按钮 */
.card-hover-actions {
  position: absolute; bottom: 10px; left: 12px; right: 48px; z-index: 3;
  display: flex; align-items: center;
  opacity: 0; transition: opacity 0.25s;
}
.list-item-char-card:hover .card-hover-actions { opacity: 1; }
.card-hover-btn {
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; border-radius: 8px; transition: all 0.2s;
  color: #fff; font-size: 12px; font-weight: 600;
}
.card-hover-upload {
  padding: 6px 14px; background: rgba(254,124,110,0.88);
  backdrop-filter: blur(6px);
}
.card-hover-upload:hover { background: #FE7C6E; }
.card-hover-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

/* 查看大图按钮 */
.card-view-btn {
  position: absolute; bottom: 10px; right: 10px; z-index: 3;
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(255,255,255,0.92); color: #666;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transition: all 0.2s;
}
.list-item-char-card:hover .card-view-btn { opacity: 1; }
.card-view-btn:hover { background: #FE7C6E; color: #fff; transform: scale(1.1); }

/* 复选框 */
.card-check { position: absolute; top: 8px; left: 8px; z-index: 3; }
.card-check :deep(.el-checkbox__inner) {
  width: 16px; height: 16px; border-radius: 4px;
  background: rgba(255,255,255,0.25); border: 1.5px solid rgba(255,255,255,0.5);
  transition: all 0.2s;
}
.card-check :deep(.el-checkbox__input.is-checked .el-checkbox__inner) { background: #FE7C6E; border-color: #FE7C6E; }
.card-check :deep(.el-checkbox__input.is-checked .el-checkbox__inner::after) { border-color: #fff; }
.card-check :deep(.el-checkbox__label) { display: none; }
.card-check :deep(.el-checkbox__input) { margin: 0; }

/* 批量操作条 */
.batch-bar {
  display: flex; align-items: center; gap: 8px; padding: 6px 14px;
  color: var(--text-100); font-size: 12px;
  background: #fef0ef; border-radius: 8px; margin: 4px 12px 8px;
  border: 1px solid #fce4dc;
}

/* ===== 右侧详情 ===== */
.right-detail {
  flex: 1; background: var(--bg-200); border-radius: 12px;
  border: 1px solid var(--bg-300); overflow-y: auto; min-width: 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.right-empty { display: flex; align-items: center; justify-content: center; }
.detail-scroll { padding: 28px; max-width: 620px; }

.asset-info-header { margin-bottom: 24px; }
.info-title { font-size: 22px; font-weight: 700; color: var(--text-100); margin-bottom: 4px; }
.info-sub { color: var(--text-200); font-size: 13px; display: flex; gap: 8px; align-items: center; }

/* 分组卡片 */
.prompt-section {
  margin-bottom: 18px; padding: 16px; background: var(--bg-100);
  border-radius: 10px; border: 1px solid var(--bg-300);
}
.model-section {
  margin-bottom: 14px; padding: 14px; background: var(--bg-100);
  border-radius: 10px; border: 1px solid var(--bg-300);
}
.section-label {
  display: flex; align-items: center; gap: 8px;
  color: var(--text-100); font-size: 13px; font-weight: 700;
  margin-bottom: 10px;
}
.char-count { margin-left: auto; color: var(--text-200); font-size: 11px; font-weight: 400; }

/* 图片查看器 */
.viewer-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: #f5f0eb; border-bottom: 1px solid var(--bg-300);
  border-radius: 8px 8px 0 0;
}
.viewer-body {
  display: flex; align-items: center; justify-content: center;
  min-height: 400px; background: #1a1a1a; overflow: hidden; border-radius: 0 0 8px 8px;
}
.viewer-body img { max-width: 100%; max-height: 70vh; object-fit: contain; }

/* Tabs sticky */
:deep(.el-tabs__header) { position: sticky; top: 0; z-index: 10; background: var(--bg-200); margin: 0 !important; padding: 6px 12px 0; }
:deep(.el-tabs__nav-wrap::after) { height: 1px; }
.left-list { overflow-y: auto !important; max-height: calc(100vh - 160px); }

.sg-project-pills { display: flex; gap: 8px; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--bg-300) transparent; padding-bottom: 4px; }
.sg-pill { font-size: 13px; padding: 6px 16px; border-radius: 18px; cursor: pointer; background: var(--bg-200); border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500; white-space: nowrap; transition: all 0.15s; user-select: none; }
.sg-pill:hover { border-color: var(--gold); color: var(--text-100); }
.sg-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }
.sg-project-pills::-webkit-scrollbar { height: 4px; }
.sg-project-pills::-webkit-scrollbar-thumb { background: var(--bg-300); border-radius: 2px; }
@media (max-width: 768px) {
  .detail-panel { padding: 12px; }
  .model-section .el-select { width: 100% !important; }
}
</style>
