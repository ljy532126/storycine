<template>
  <div class="sb-root">
    <!-- 顶部栏 -->
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">故事板</span>
    </div>
    <div class="sb-top">
      <div class="tb-right">
        <div class="sg-project-pills">
          <span v-for="p in projectStore.projects" :key="p._id" :class="['sg-pill', { active: currentProjectId === p._id }]" @click="currentProjectId = p._id; onProjectChange(p._id)">{{ p.name }}</span>
        </div>
        <el-select v-model="currentScriptId" placeholder="选择剧本" @change="onScriptChange" size="default" style="width:180px;margin-left:8px">
          <el-option v-for="s in scripts" :key="s._id" :label="`第${s.episodeNumber}集`" :value="s._id" />
        </el-select>
        <el-button type="primary" style="margin-left:8px" @click="handleAutoGenerate" :disabled="!currentScriptId" :loading="generating">生成故事板</el-button>
        <el-button size="small" class="btn-danger-delete" style="margin-left:4px" @click="deleteStoryboard" :disabled="!currentStoryboard" :loading="deletingSB">删除故事板</el-button>
        <el-button size="small" style="margin-left:4px" @click="openExport">导出</el-button>
        <el-button size="small" style="margin-left:4px" @click="showImportDialog = true" :disabled="!currentStoryboard">导入</el-button>
        <el-button size="small" type="warning" style="margin-left:4px" @click="openTTSDialog(null)" :disabled="!currentStoryboard || ttsBatchRunning" :loading="ttsBatchRunning">
          {{ ttsBatchRunning ? '批量配音中...' : '' }}<Voice size="14" fill="currentColor" style="margin-right:3px;vertical-align:text-bottom"/>批量配音
        </el-button>
        <el-divider direction="vertical" style="margin:0 8px" />
        <span style="font-size:12px;color:var(--text-100)">关闭内嵌字幕</span>
        <el-switch v-model="noSubtitles" size="small" />
        <el-tooltip content="开启后，生成的视频画面不会出现自动字幕、文字、水印，台词请在后期手动添加。" placement="bottom">
          <Help size="16" fill="var(--text-100)" style="cursor:help;margin-left:4px"/>
        </el-tooltip>
      </div>
    </div>

    <!-- 移动端 Tab 导航 -->
    <div class="sb-mobile-tabs" v-if="currentProjectId && screenWidth < 768">
      <div :class="['smtab', { active: mobileTab === 'episodes' }]" @click="mobileTab = 'episodes'"><List size="14" fill="currentColor"/> 剧集</div>
      <div :class="['smtab', { active: mobileTab === 'shots' }]" @click="mobileTab = 'shots'"><Film size="14" fill="currentColor"/> 镜头</div>
      <div :class="['smtab', { active: mobileTab === 'settings' }]" @click="mobileTab = 'settings'"><SettingTwo size="14" fill="currentColor"/> 设置</div>
    </div>

    <div class="sb-body" v-if="currentProjectId">
      <!-- ===== 左：剧集列表 ===== -->
      <div class="sb-left" v-show="screenWidth >= 768 || mobileTab === 'episodes'">
        <div class="panel-title">剧集</div>
        <div class="ep-list">
          <div v-for="ep in scripts" :key="ep._id"
            :class="['ep-item', { active: currentScriptId === ep._id }]"
            @click="currentScriptId = ep._id; onScriptChange(ep._id)">
            <span class="ep-num">第{{ ep.episodeNumber }}集</span>
            <span class="ep-name">{{ ep.episodeTitle || '未命名' }}</span>
          </div>
        </div>
        <div v-if="scripts.length === 0" style="color:var(--text-200);text-align:center;padding:20px">暂无剧集</div>
      </div>

      <!-- ===== 中：预览 + 时间线 ===== -->
      <div class="sb-center" v-show="screenWidth >= 768 || mobileTab === 'shots'">
        <!-- 视频预览区 -->
        <div class="preview-area">
          <div v-if="!currentShot" class="preview-empty">
            <Film size="48" fill="var(--primary-300)"/>
            <p>点击下方镜头缩略图预览</p>
          </div>
          <div v-else class="preview-shot">
            <div class="preview-frame">
              <!-- 视频播放器 -->
              <video v-if="currentShot.renderedVideo && !isTaskId(currentShot.renderedVideo)"
                :src="currentShot.renderedVideo" controls preload="metadata"
                style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px"
                @loadedmetadata="console.log('[视频] 已加载:', currentShot.renderedVideo)">
              </video>
              <!-- 视频生成中 / 等待中 -->
              <div v-else-if="getShotPollKey() && videoPollingMap[getShotPollKey()]" class="preview-empty">
                <PictureOne v-if="videoPollingMap[getShotPollKey()].status === 'queued'" size="48" fill="var(--primary-300)"/>
                <Film v-else-if="videoPollingMap[getShotPollKey()].status === 'running'" size="48" fill="var(--primary-300)"/>
                <AlarmClock v-else size="48" fill="var(--primary-300)"/>
                <p><strong>{{ statusLabel(videoPollingMap[getShotPollKey()].status) }}</strong></p>
                <p style="font-size:11px;color:var(--text-200);word-break:break-all">任务ID: {{ videoPollingMap[getShotPollKey()].taskId }}</p>
                <p style="font-size:11px;color:var(--text-200)">已等待 {{ videoPollingMap[getShotPollKey()].progress }} 秒 · 通常 1~3 分钟</p>
                <el-progress :percentage="Number(Math.min((videoPollingMap[getShotPollKey()].progress || 0) / 1.8, 99).toFixed(2))" style="width:200px;margin-top:4px" :stroke-width="6" />
              </div>
              <!-- 图片预览 -->
              <img v-else-if="currentShot.renderedImage" :src="currentShot.renderedImage" style="max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in" @click="openImgViewer(currentShot.renderedImage)" />
              <Pic v-else size="48" fill="var(--primary-300)"/>
            </div>
            <div class="preview-info">
              <span class="pi-tag">{{ currentShot.shotType }}</span>
              <span class="pi-tag">{{ currentShot.cameraMovement }}</span>
              <span>{{ currentShot.duration }}s</span>
            </div>
            <div class="preview-dialogue" v-if="currentShot.dialogue?.text">
              <strong>{{ currentShot.dialogue.characterName }}</strong>：{{ currentShot.dialogue.text }}
            </div>
          </div>
        </div>

        <!-- 分镜时间线 -->
        <div class="timeline" v-if="currentStoryboard && currentStoryboard.shots" @wheel.prevent="onTimelineWheel">
          <div class="tl-header">
            <span class="tl-label">分镜时间线 ({{ currentStoryboard.shots.length }} 镜头)</span>
            <div class="tl-batch-btns">
              <el-button size="small" type="primary" @click="batchGenerateImages" :loading="batchGenning">批量生图</el-button>
              <el-button size="small" type="success" @click="batchGenerateVideos" :loading="batchGenningVideo" style="margin-left:4px">批量生视频</el-button>
            </div>
          </div>
          <div class="tl-track" ref="tlTrack">
            <template v-for="(s, idx) in currentStoryboard.shots" :key="s.shotNumber">
              <!-- 分镜间插入按钮 -->
              <div class="tl-insert" @click.stop="insertAt(idx)" title="在此插入新分镜">+</div>
              <!-- 分镜卡片 -->
              <div :class="['tl-card', { 'tl-active': currentShot?.shotNumber === s.shotNumber }]" @click="selectShot(s)">
                <div class="tl-card-header">
                  <span class="tl-shot-num">镜头 {{ s.shotNumber }}</span>
                  <span class="tl-shot-dur"><Time size="12" fill="var(--gold)"/> {{ s.duration }}s</span>
                </div>
                <div class="tl-img">
                  <img v-if="s.renderedImage" :src="s.renderedImage" @dblclick.stop="openImgViewer(s.renderedImage)" />
                  <span v-else class="tl-placeholder">待生成</span>
                </div>
                <div class="tl-meta">
                  <span class="tl-type">{{ s.shotType }}</span>
                  <span>{{ s.shotNumber }}</span>
                </div>
                <div class="tl-desc" v-if="s.imageDescription" :title="s.imageDescription">{{ s.imageDescription }}</div>
                <div class="tl-actions">
                  <label class="tl-btn" title="上传图片" @click.stop>
                    <input type="file" accept="image/*" hidden @change="e => uploadShotImage(s, e)" />
                    <PictureOne size="14" fill="var(--text-200)"/>
                  </label>
                  <label class="tl-btn" title="上传视频" @click.stop>
                    <input type="file" accept="video/*" hidden @change="e => uploadShotVideo(s, e)" />
                    <Video size="14" fill="var(--text-200)"/>
                  </label>
                  <span class="tl-btn" title="复制分镜" @click.stop="copyShot(s)"><Copy size="14" fill="var(--text-200)"/></span>
                  <span class="tl-btn" title="插入新分镜" @click.stop="insertShotAfter(s)"><Plus size="14" fill="var(--text-200)"/></span>
                  <span class="tl-btn" title="删除分镜" @click.stop="deleteShot(s)"><Delete size="14" fill="var(--text-200)"/></span>
                  <span class="tl-btn" :title="synthingShot === s.shotNumber ? '生成中...' : 'AI 语音合成'" @click.stop="openTTSDialog(s)" :style="synthingShot === s.shotNumber ? 'opacity:0.5' : ''"><Voice size="14" fill="var(--text-200)"/></span>
                </div>
                <div class="tl-audio" v-if="s.dialogue?.audioUrl && s.dialogue.audioUrl !== synthingShot">
                  <audio :src="s.dialogue.audioUrl" controls preload="none" style="width:100%;height:28px;margin-top:4px" />
                </div>
              </div>
            </template>
            <!-- 末尾插入 + 创建空白分镜 -->
            <div class="tl-insert tl-insert-end" @click.stop="addBlankShot" title="创建空白分镜">+</div>
            <div class="tl-card tl-card-end" @click="addBlankShot">
              <div class="tl-card-header">
                <span class="tl-shot-num">新增</span>
                <span class="tl-shot-dur"><Time size="12" fill="var(--gold)"/> 3s</span>
              </div>
              <div class="tl-img tl-img-add">
                <span class="tl-add-icon">+</span>
              </div>
              <div class="tl-meta-end">创建空白分镜</div>
              <div class="tl-actions-end">
                <span style="font-size:10px;color:var(--primary-300)">点击添加</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 右：绘图/视频面板 ===== -->
      <div class="sb-right" v-show="screenWidth >= 768 || mobileTab === 'settings'">
        <div class="tab-switch">
          <div :class="['tab-btn', { active: rightTab === 'draw' }]" @click="rightTab = 'draw'">绘图</div>
          <div :class="['tab-btn', { active: rightTab === 'video' }]" @click="rightTab = 'video'">视频</div>
        </div>

        <!-- ===== 绘图标签页 ===== -->
        <div v-show="rightTab === 'draw'">
          <div class="right-section">
            <label>图片提示词</label>
            <div class="prompt-editor-wrap" ref="imgPromptEditorWrap">
              <div
                ref="imgPromptRef"
                class="prompt-editor"
                contenteditable="true"
                @input="onImgPromptInput"
                @keydown="onImgPromptKeydown"
                @blur="saveCurrentPrompt"
                @click="onImgPromptClick"
              ></div>
              <div class="prompt-editor-ph" v-if="!imgEditorHasContent" @click="imgPromptRef?.focus()">输入图片生成提示词，输入 @ 可选择插入角色引用...</div>
              <div v-if="showImgMentionMenu" class="mention-menu">
                <div v-for="item in mentionOptions" :key="item.id" class="mention-item" @mousedown.prevent="insertImgMention(item)">
                  <span class="mention-chip" :style="{ background: item.bg || 'rgba(201,168,76,0.2)', color: item.color || 'var(--gold-dark)' }">{{ item.chip }}</span>
                  <span class="mention-name">{{ item.name }}</span>
                  <span class="mention-type">{{ item.type }}</span>
                </div>
                <div v-if="mentionOptions.length === 0" class="mention-empty">无匹配结果</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <span class="char-count">{{ imgEditorCharCount }} / 5000</span>
              <el-button size="small" type="primary" link @click="generatePromptForShot" :loading="genningPrompt">AI 生成</el-button>
            </div>
          </div>
          <div class="right-section">
            <label>模型选择</label>
            <el-select v-model="selectedModel" size="small" style="width:100%">
              <el-option label="Seedream 4.0 | 2K" value="doubao_image" />
              <el-option label="Seedream 4.0 | 4K" value="doubao_image_4k" />
              <el-option label="gpt-image-2" value="openai_image" />
            </el-select>
            <el-button size="small" type="primary" style="width:100%;margin-top:8px" @click="generateImageForShot" :loading="genningImage" :disabled="!currentShot">生成图片</el-button>
          </div>
        </div>

        <!-- ===== 视频标签页 ===== -->
        <div v-show="rightTab === 'video'">
          <div class="seedance-marquee" title="Seedance 2.0 真人内容规避：AI 写实人像也会被判定为真人拦截。建议使用纯场景/道具图片（无人物）、卡通/动漫/古风等非写实风格、用侧面/背影代替正面特写">
            <span class="seedance-marquee-inner">
              <span class="seedance-marquee-dupe">⚠️ Seedance 2.0 真人内容规避：AI 写实人像也会被判定为"真人"拦截 · 建议① 使用纯场景/道具图片（无人物）· ② 使用卡通、动漫、古风等非写实风格 · ③ 用侧面/背影代替正面特写</span>
              <span class="seedance-marquee-dupe">⚠️ Seedance 2.0 真人内容规避：AI 写实人像也会被判定为"真人"拦截 · 建议① 使用纯场景/道具图片（无人物）· ② 使用卡通、动漫、古风等非写实风格 · ③ 用侧面/背影代替正面特写</span>
            </span>
          </div>
          <div class="right-section">
            <label>视频提示词</label>
            <div class="prompt-editor-wrap" ref="promptEditorWrap">
              <div
                ref="videoPromptRef"
                class="prompt-editor"
                contenteditable="true"
                @input="onPromptInput"
                @keydown="onPromptKeydown"
                @blur="onPromptBlur"
                @click="onPromptClick"
              ></div>
              <div class="prompt-editor-ph" v-if="!editorHasContent" @click="focusEditor">输入视频生成提示词，输入 @ 可选择插入角色引用...</div>
              <div v-if="showMentionMenu" class="mention-menu">
                <div v-for="item in mentionOptions" :key="item.id" class="mention-item" @mousedown.prevent="insertMention(item)">
                  <span class="mention-chip" :style="{ background: item.bg || 'rgba(201,168,76,0.2)', color: item.color || 'var(--gold-dark)' }">{{ item.chip }}</span>
                  <span class="mention-name">{{ item.name }}</span>
                  <span class="mention-type">{{ item.type }}</span>
                </div>
                <div v-if="mentionOptions.length === 0" class="mention-empty">无匹配结果</div>
              </div>
            </div>
            <div v-if="videoRefChips.length > 0" class="prompt-chips">
              <span style="font-size:11px;color:var(--text-200);margin-right:4px">点击插入：</span>
              <span v-for="rc in videoRefChips" :key="rc.id" class="prompt-chip" @click="insertChip(rc)" :title="rc.hint">{{ rc.tag }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <span class="char-count">{{ editorCharCount }} / 5000</span>
              <div style="display:flex;gap:4px">
                <el-button size="small" type="primary" link @click="generateVideoPromptForShot" :loading="genningVideoPrompt">AI 生成</el-button>
                <el-button size="small" type="warning" link @click="generateTimedStoryboard" :loading="genningTimedSB">AI 智能分镜时长</el-button>
              </div>
            </div>
          </div>
          <div class="right-section">
            <label>时长设置 (秒)</label>
            <el-input-number v-model="videoDuration" :min="1" :max="30" size="small" style="width:100%" @change="saveVideoDuration" />
          </div>
          <div class="right-section">
            <label>视频模型</label>
            <el-select v-model="selectedVideoModel" size="small" style="width:100%">
              <el-option label="Seedance 2.0" value="doubao_video" />
            </el-select>
            <el-button size="small" type="primary" style="width:100%;margin-top:8px" @click="generateVideoForShot" :loading="genningVideo" :disabled="!currentShot">生成视频</el-button>
            <div style="margin-top:8px;display:flex;gap:4px">
              <el-input v-model="recoverTaskId" size="small" placeholder="粘贴 taskId 恢复视频" clearable style="flex:1" />
              <el-button size="small" @click="recoverVideo" :loading="recovering" :disabled="!recoverTaskId">恢复</el-button>
            </div>
          </div>
        </div>

        <!-- 参考主体 -->
        <div class="right-section">
          <label>参考角色</label>
          <div class="ref-chars">
            <div v-for="c in assetStore.characters" :key="c._id" class="ref-chip"
              :class="{ active: selectedRefs.includes(c._id), 'has-img': getCharThumb(c) }"
              @click="toggleRef(c._id)"
              :title="getCharThumb(c) ? `${c.name}（有参考图）` : `${c.name}（无参考图）`">
              {{ c.name }}<PictureOne v-if="getCharThumb(c)" size="12" fill="var(--gold)" style="margin-left:2px;vertical-align:middle"/>
            </div>
          </div>
        </div>
        <div class="right-section">
          <label>参考场景</label>
          <div class="ref-chars">
            <div v-for="s in assetStore.scenes" :key="s._id" class="ref-chip"
              :class="{ active: selectedSceneRefs.includes(s._id), 'has-img': getSceneThumb(s) }"
              @click="toggleSceneRef(s._id)"
              :title="getSceneThumb(s) ? `${s.sceneName}（有参考图）` : `${s.sceneName}（无参考图）`">
              {{ s.sceneName }}<PictureOne v-if="getSceneThumb(s)" size="12" fill="var(--gold)" style="margin-left:2px;vertical-align:middle"/>
            </div>
          </div>
        </div>

        <!-- 参考图片上传 -->
        <div class="right-section">
          <label>参考图片</label>
          <div class="ref-imgs">
            <div v-for="(img, i) in currentRefImages" :key="i" class="ref-img-item">
              <img :src="img" />
              <span class="ref-img-del" @click="removeRefImage(i)">×</span>
            </div>
            <label class="ref-upload-btn">
              + 上传
              <input type="file" accept="image/*" multiple hidden @change="onRefImageUpload" />
            </label>
          </div>
        </div>

        <!-- 分镜素材管理 -->
        <div class="right-section">
          <label>分镜素材 ({{ (currentShot?.materials || []).length }} 版本)</label>
          <div class="mat-grid">
            <div v-for="m in (currentShot?.materials || [])" :key="m.version"
              class="mat-item" :class="{ 'mat-active': (currentShot.renderedImage === m.url || currentShot.renderedVideo === m.url) }">
              <!-- 视频素材显示播放图标 -->
              <div v-if="m.type === 'video'" class="mat-video-preview" @click="openVideoPreview(m.url)">
                <span class="mat-play-icon">▶</span>
              </div>
              <img v-else-if="m.url" :src="m.url" @click="openImgViewer(m.url)" />
              <span class="mat-type"><Video v-if="m.type === 'video'" size="14" fill="var(--gold)"/><Pic v-else size="14" fill="var(--gold)"/></span>
              <span class="mat-ver">v{{ m.version }}</span>
              <span class="mat-set" @click.stop="setMatAsCurrent(m)" title="设为主素材">★</span>
            </div>
          </div>
          <div v-if="!(currentShot?.materials || []).length" style="color:var(--primary-300);font-size:12px">生成图片/视频后将显示此处</div>
        </div>
        <div class="right-section">
          <label>其他分镜素材</label>
          <div class="mat-grid">
            <div v-for="s in (currentStoryboard?.shots || []).filter(x => x.renderedImage || x.renderedVideo).slice(0, 8)" :key="s.shotNumber"
              class="mat-item" @click="applyMaterialToShot(s)">
              <div v-if="s.renderedVideo && !s.renderedImage" class="mat-video-preview"><span class="mat-play-icon">▶</span></div>
              <img v-else-if="s.renderedImage" :src="s.renderedImage" />
              <span class="mat-num">#{{ s.shotNumber }}</span>
            </div>
          </div>
          <div v-if="!currentStoryboard?.shots?.filter(x => x.renderedImage || x.renderedVideo).length" style="color:var(--primary-300);font-size:12px">生成图片/视频后将显示在此处</div>
        </div>
      </div>
    </div>

    <el-empty v-if="!currentProjectId" description="请选择片场" style="margin-top:80px" />

    <!-- 导出弹窗 -->
    <el-dialog v-model="showExportDialog" title="导出内容" width="540px">
      <el-form label-position="top" size="small">
        <el-form-item label="选择剧集">
          <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="全部剧集（不选=导出全部）">
            <el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" />
          </el-select>
          <div style="display:flex;gap:8px;margin-top:4px">
            <el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">全选</el-button>
            <el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">当前集</el-button>
            <el-button size="small" link @click="exportEpisodes = []">清空</el-button>
          </div>
        </el-form-item>
        <el-form-item label="导出内容">
          <el-checkbox-group v-model="exportTypes">
            <el-checkbox value="script">📝 剧本全文</el-checkbox>
            <el-checkbox value="shots">🎬 分镜全文</el-checkbox>
            <el-checkbox value="full_storyboard">🎞️ 故事板全文</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="导出格式">
          <el-select v-model="exportFormat" style="width:100%">
            <el-option label="PDF（浏览器打印/另存为 PDF）" value="pdf" />
            <el-option label="Markdown（.md 文件）" value="markdown" />
            <el-option label="Excel / CSV（表格格式）" value="csv" />
            <el-option label="Word（.doc 文件）" value="word" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" show-icon style="margin-top:8px">
        <template #title>{{ formatHint }}</template>
      </el-alert>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0 || exportEpisodes.length === 0">导出</el-button>
      </template>
    </el-dialog>

    <!-- 图片查看器 -->
    <el-dialog v-model="imgViewerVisible" title="图片预览" width="90%" top="2vh" destroy-on-close>
      <div class="img-viewer-toolbar">
        <el-button size="small" @click="imgScale = Math.max(0.2, imgScale - 0.2)">−</el-button>
        <span class="img-scale-text">{{ Math.round(imgScale * 100) }}%</span>
        <el-button size="small" @click="imgScale = Math.min(5, imgScale + 0.2)">+</el-button>
        <el-button size="small" @click="imgScale = 1; imgViewerVisible = false">关闭</el-button>
      </div>
      <div class="img-viewer-body"
        @wheel.prevent="(e) => { e.deltaY < 0 ? imgScale = Math.min(5, imgScale + 0.1) : imgScale = Math.max(0.2, imgScale - 0.1) }"
        @mousedown="onImgDragStart" @mousemove="onImgDragMove" @mouseup="onImgDragEnd" @mouseleave="onImgDragEnd"
        :style="{ cursor: imgDragStart ? 'grabbing' : 'grab' }">
        <img v-if="imgViewerSrc" :src="imgViewerSrc"
          :style="{ transform: `translate(${imgX}px,${imgY}px) scale(${imgScale})` }"
          draggable="false" />
      </div>
    </el-dialog>

    <!-- 导入弹窗 -->
    <el-dialog v-model="showImportDialog" title="导入分镜数据" width="600px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
        <template #title>粘贴 CSV 或 JSON。CSV表头：镜头号,场景名称,景别,构图,运镜,灯光,时长,图像描述,角色名,台词,音效,备注,状态</template>
      </el-alert>
      <el-input v-model="importText" type="textarea" :rows="14" placeholder="粘贴数据..." />
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!importText.trim()">导入</el-button>
      </template>
    </el-dialog>

    <!-- TTS 配音参数弹窗 -->
    <el-dialog v-model="showTTSDialog" :title="ttsTargetShot ? `配音: 镜头 ${ttsTargetShot.shotNumber}` : '批量全集配音'" width="520px" destroy-on-close>
      <div style="margin-bottom:12px;font-size:13px;color:var(--text-100)" v-if="ttsTargetShot">
        台词: <strong>{{ (ttsTargetShot.dialogue?.text || ttsTargetShot.imageDescription || '').substring(0, 80) }}{{ (ttsTargetShot.dialogue?.text || ttsTargetShot.imageDescription || '').length > 80 ? '...' : '' }}</strong>
      </div>
      <el-form label-position="top" size="small">
        <el-form-item label="音色">
          <el-select v-model="ttsParams.speaker" style="width:100%" filterable>
            <el-option v-for="v in ttsVoiceOptions" :key="v.value" :label="v.label" :value="v.value" :disabled="v.disabled"/>
          </el-select>
          <el-input v-if="ttsParams.speaker === '__custom__'" v-model="ttsCustomSpeaker" placeholder="输入音色ID" size="small" style="margin-top:8px" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="语速"><el-slider v-model="ttsParams.speechRate" :min="-50" :max="100" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="音量"><el-slider v-model="ttsParams.loudnessRate" :min="-50" :max="100" /></el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" style="font-size:12px" title="临时修改仅本次合成生效" />
      </el-form>
      <template #footer>
        <el-button @click="showTTSDialog = false">取消</el-button>
        <el-button type="primary" @click="handleTTSSynthesize" :loading="synthingShot !== null">
          {{ ttsTargetShot ? '' : '' }}<Voice size="14" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"/>{{ ttsTargetShot ? '合成此句' : '批量合成全部' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick, onMounted, onActivated, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Help, PictureOne, Video, Copy, Plus, Delete, Voice, Film, Pic, Time, List, SettingTwo, AlarmClock } from '@icon-park/vue-next';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { useStoryboardStore } from '../stores/storyboard';
import { useAssetStore } from '../stores/asset';
import { storyboardAPI } from '../api';
import { ttsAPI, configAPI } from '../api';
import { buildShotsFromScenes } from '../components/promptBuilder';

const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const storyboardStore = useStoryboardStore();
const assetStore = useAssetStore();

const currentProjectId = ref('');
const currentScriptId = ref('');
const currentStoryboard = ref(null);
const currentShot = ref(null);
const scripts = ref([]);
const generating = ref(false);
const deletingSB = ref(false);
const genningImage = ref(false);
const genningVideo = ref(false);
const genningPrompt = ref(false);
const genningVideoPrompt = ref(false);
const genningTimedSB = ref(false);
const batchGenning = ref(false);
const batchGenningVideo = ref(false);
const noSubtitles = ref(getStoredNoSubtitles());

function getStoredNoSubtitles() { try { return localStorage.getItem('ad_no_subtitles') === 'true'; } catch { return true; } }
function saveNoSubtitles(v) { try { localStorage.setItem('ad_no_subtitles', String(v)); } catch {} }
const showImportDialog = ref(false);
const showExportDialog = ref(false);
const exportTypes = ref(['script', 'shots', 'full_storyboard']);
const exportFormat = ref('pdf');
const exportEpisodes = ref([]);
const formatHint = computed(() => {
  const m = { pdf: 'PDF：打开打印预览，浏览器「另存为 PDF」保存', markdown: 'Markdown：下载 .md 文件，可用 Typora/VS Code 打开', csv: 'Excel/CSV：下载 .csv 文件，用 Excel/WPS 打开编辑', word: 'Word：下载 .doc 文件，用 Word/WPS 打开编辑' };
  return m[exportFormat.value] || '';
});
const importText = ref('');
const importing = ref(false);
const shotPrompt = ref('');
const selectedModel = ref('doubao_image');
const selectedRefs = ref([]);
const rightTab = ref('draw');
const currentShotPrompt = ref('');
const currentVideoPrompt = ref('');
const videoDuration = ref(5);
const selectedVideoModel = ref('doubao_video');
const currentRefImages = ref([]);
const tlTrack = ref(null);
const videoPromptRef = ref(null);
const promptEditorWrap = ref(null);

// ===== 图片提示词编辑器（复用同一个 mention 系统）=====
const imgPromptRef = ref(null);
const imgPromptEditorWrap = ref(null);
const showImgMentionMenu = ref(false);
const imgEditorHasContent = ref(false);
const imgEditorCharCount = ref(0);
let _imgMentionQuery = '';

function imgEditorEl() { return imgPromptRef.value; }

function onImgPromptInput() {
  currentShotPrompt.value = editorToPlainTextFor(imgEditorEl());
  imgEditorHasContent.value = !!imgEditorEl()?.innerText?.trim();
  imgEditorCharCount.value = imgEditorEl()?.innerText?.length || 0;
  checkMentionTriggerFor(imgEditorEl(), _imgMentionQuery, showImgMentionMenu);
}
function onImgPromptClick() { checkMentionTriggerFor(imgEditorEl(), _imgMentionQuery, showImgMentionMenu); }

function onImgPromptKeydown(e) {
  if (e.key === 'Escape') { showImgMentionMenu.value = false; }
  if (e.key === 'Backspace') handleBackspaceInEditor(e, imgEditorEl(), onImgPromptInput);
}

function insertImgMention(item) {
  insertTag(item, imgEditorEl(), showImgMentionMenu, onImgPromptInput);
}
function renderImgEditor(text) {
  renderEditorContent(text, imgEditorEl(), onImgPromptInput);
}
function loadShotImgEditor(text) {
  currentShotPrompt.value = text || '';
  nextTick(() => renderImgEditor(text || ''));
}

// ===== 通用编辑器工具函数 =====
function editorToPlainTextFor(editor) { if (!editor) return ''; let t=''; editor.childNodes.forEach(n=>{if(n.nodeType===3)t+=n.textContent;else if(n.classList?.contains('mention-tag'))t+=n.dataset.name?'@'+n.dataset.name:n.textContent;else if(n.nodeName==='BR')t+='\n';else t+=n.textContent||''});return t; }

function checkMentionTriggerFor(editor, queryRef, menuRef) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.focusNode) { menuRef.value = false; return; }
  const node = sel.focusNode;
  if (node.nodeType !== Node.TEXT_NODE || !editor?.contains(node)) { menuRef.value = false; return; }
  const offset = sel.focusOffset;
  const before = node.textContent.substring(0, offset);
  const atIdx = before.lastIndexOf('@');
  if (atIdx === -1) { menuRef.value = false; return; }
  if (before.substring(atIdx).includes(' ') || before.substring(atIdx).includes('\n')) { menuRef.value = false; return; }
  mentionQuery.value = before.substring(atIdx + 1);
  menuRef.value = true;
}

function insertTag(item, editor, menuRef, afterFn) {
  menuRef.value = false;
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection(); if (!sel.rangeCount) return;
  const node = sel.focusNode;
  if (node?.nodeType === Node.TEXT_NODE) {
    const offset = sel.focusOffset;
    const before = node.textContent.substring(0, offset);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) { node.textContent = node.textContent.substring(0, atIdx) + node.textContent.substring(offset); sel.collapse(node, atIdx); }
  }
  const span = document.createElement('span');
  span.className = 'mention-tag'; span.contentEditable = 'false';
  span.dataset.name = item.name; span.dataset.url = item.url || ''; span.dataset.appearance = item.appearance || '';
  span.style.background = item.bg; span.style.color = item.color;
  span.innerText = item.chip;
  const range = sel.getRangeAt(0); range.insertNode(span);
  const space = document.createTextNode('\xA0'); range.setStartAfter(span); range.insertNode(space);
  range.setStartAfter(space); range.collapse(true); sel.removeAllRanges(); sel.addRange(range);
  afterFn();
}

function handleBackspaceInEditor(e, editor, afterFn) {
  const sel = window.getSelection(); if (!sel.rangeCount) return;
  const node = sel.focusNode;
  if (node?.nodeType === Node.TEXT_NODE && sel.focusOffset === 0) {
    const prev = node.previousSibling;
    if (prev?.classList?.contains('mention-tag')) { e.preventDefault(); prev.remove(); afterFn(); }
  }
}

function renderEditorContent(text, editor, afterFn) {
  if (!editor) return;
  if (!text) { editor.innerHTML = ''; afterFn(); return; }
  let html = ''; let last = 0;
  const re = /@([^\s@,;.，。；]+)/g; let m;
  while ((m = re.exec(text))) {
    html += (text.substring(last, m.index)).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const name = m[1];
    const c = assetStore.characters.find(x => x.name === name);
    const s = assetStore.scenes.find(x => x.sceneName === name);
    const bg = (s && !c) ? '#e2f3f5' : 'rgba(201,168,76,0.2)';
    const color = (s && !c) ? '#02adb5' : 'var(--gold-dark)';
    html += '<span class="mention-tag" contenteditable="false" data-name="'+name+'" style="background:'+bg+';color:'+color+'">@'+name+'</span>';
    last = re.lastIndex;
  }
  html += (text.substring(last)).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  editor.innerHTML = html;
  afterFn();
}
const screenWidth = ref(window.innerWidth);
const mobileTab = ref('shots');
window.addEventListener('resize', () => { screenWidth.value = window.innerWidth; });
const showMentionMenu = ref(false);
const mentionQuery = ref('');
const editorHasContent = ref(false);
const editorCharCount = ref(0);

function focusEditor() { videoPromptRef.value?.focus(); }

// ===== 编辑器：DOM → 纯文本 =====
function editorToPlainText() {
  const el = videoPromptRef.value; if (!el) return '';
  let text = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
    else if (node.classList?.contains('mention-tag')) {
      text += node.dataset.name ? '@' + node.dataset.name : node.textContent;
    } else if (node.nodeName === 'BR') text += '\n';
    else text += node.textContent || '';
  });
  return text;
}

function onPromptInput() {
  const text = editorToPlainText();
  currentVideoPrompt.value = text;
  editorHasContent.value = !!el().innerText?.trim();
  editorCharCount.value = el().innerText?.length || 0;
  checkMentionTrigger();
}
function el() { return videoPromptRef.value; }

function onPromptBlur() {
  if (currentShot.value) currentShot.value._videoPrompt = editorToPlainText();
}

// ===== @提及下拉 =====
function checkMentionTrigger() {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.focusNode) { showMentionMenu.value = false; return; }
  const node = sel.focusNode;
  if (node.nodeType !== Node.TEXT_NODE) { showMentionMenu.value = false; return; }
  const offset = sel.focusOffset;
  const before = node.textContent.substring(0, offset);
  const atIdx = before.lastIndexOf('@');
  if (atIdx === -1) { showMentionMenu.value = false; return; }
  if (before.substring(atIdx).includes(' ') || before.substring(atIdx).includes('\n')) { showMentionMenu.value = false; return; }
  mentionQuery.value = before.substring(atIdx + 1);
  showMentionMenu.value = true;
}

function onPromptClick() { checkMentionTrigger(); }

// 候选项
const mentionOptions = computed(() => {
  const q = mentionQuery.value.toLowerCase();
  const list = [];
  assetStore.characters.forEach(c => {
    if (!q || c.name?.toLowerCase().includes(q)) {
      const url = getRefUrl(c); if (!url) return;
      list.push({ id: c._id, name: c.name, type: '角色', chip: '@'+c.name, bg: 'rgba(201,168,76,0.2)', color: 'var(--gold-dark)', url, appearance: c.appearance || '' });
    }
  });
  assetStore.scenes.forEach(s => {
    if (!q || s.sceneName?.toLowerCase().includes(q)) {
      const url = getRefUrl(s);
      list.push({ id: s._id, name: s.sceneName, type: '场景', chip: '@'+s.sceneName, bg: '#e2f3f5', color: '#02adb5', url: url || '', appearance: s.description || s.stylePrompt || '' });
    }
  });
  return list.slice(0, 15);
});

function insertMention(item) {
  showMentionMenu.value = false;
  const editor = el(); if (!editor) return;
  editor.focus();
  const sel = window.getSelection(); if (!sel.rangeCount) return;
  const node = sel.focusNode;
  // 删除 @xxx 输入文本
  if (node?.nodeType === Node.TEXT_NODE) {
    const offset = sel.focusOffset;
    const before = node.textContent.substring(0, offset);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      node.textContent = node.textContent.substring(0, atIdx) + node.textContent.substring(offset);
      sel.collapse(node, atIdx);
    }
  }
  // 插入 tag span
  const span = document.createElement('span');
  span.className = 'mention-tag'; span.contentEditable = 'false';
  span.dataset.name = item.name; span.dataset.url = item.url || '';
  span.dataset.appearance = item.appearance || '';
  span.style.background = item.bg; span.style.color = item.color;
  span.innerText = item.chip;
  const range = sel.getRangeAt(0);
  range.insertNode(span);
  const space = document.createTextNode(' ');
  range.setStartAfter(span); range.insertNode(space);
  range.setStartAfter(space); range.collapse(true);
  sel.removeAllRanges(); sel.addRange(range);
  onPromptInput();
}

// ===== 键盘 =====
function onPromptKeydown(e) {
  if (e.key === 'Escape') { showMentionMenu.value = false; return; }
  if (e.key === 'Backspace') {
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const node = sel.focusNode;
    if (node?.nodeType === Node.TEXT_NODE && sel.focusOffset === 0) {
      const prev = node.previousSibling;
      if (prev?.classList?.contains('mention-tag')) { e.preventDefault(); prev.remove(); onPromptInput(); }
    }
  }
}

// ===== 芯片点击 =====
function insertChip(rc) {
  const char = assetStore.characters.find(x => x._id === rc.id);
  if (char) {
    insertMention({ id: rc.id, name: rc.name, type: '角色', chip: rc.tag, bg: 'rgba(201,168,76,0.2)', color: 'var(--gold-dark)', url: getRefUrl(char) || '', appearance: rc.hint || '' });
    return;
  }
  const scene = assetStore.scenes.find(x => x._id === rc.id);
  if (scene) {
    insertMention({ id: rc.id, name: rc.name, type: '场景', chip: rc.tag, bg: '#e2f3f5', color: '#02adb5', url: getRefUrl(scene) || '', appearance: scene.description || scene.stylePrompt || '' });
  }
}

// ===== 解析引用（editor DOM 优先） =====
function parsePromptRefs() {
  const editor = el();
  const tags = editor ? [...editor.querySelectorAll('.mention-tag')] : [];
  if (tags.length > 0) {
    const refs = []; const seen = new Set();
    tags.forEach(tag => {
      const n = tag.dataset.name, u = tag.dataset.url, a = tag.dataset.appearance || '';
      if (n && !seen.has(n)) { seen.add(n); refs.push({ name: n, url: u || '', appearance: a }); }
    });
    return refs;
  }
  // fallback: 纯文本正则
  const text = currentVideoPrompt.value || '';
  const refs = []; const seen = new Set();
  const re = /@([^\s@,;.，。；]+)/g; let m;
  while ((m = re.exec(text))) {
    const name = m[1]; if (seen.has(name)) continue; seen.add(name);
    const c = assetStore.characters.find(x => x.name === name);
    const s = assetStore.scenes.find(x => x.sceneName === name);
    if (c) {
      refs.push({ name, url: getRefUrl(c) || '', appearance: c.appearance || '' });
    } else if (s) {
      refs.push({ name, url: getRefUrl(s) || '', appearance: s.description || s.stylePrompt || '' });
    }
  }
  return refs;
}

// 参考图芯片（角色 + 场景）
const videoRefChips = computed(() => {
  const chips = [];
  selectedRefs.value.forEach(id => {
    const c = assetStore.characters.find(x => x._id === id);
    if (c) chips.push({ id: c._id, name: c.name, tag: '@'+c.name, hint: c.appearance || c.name, type: '角色' });
  });
  selectedSceneRefs.value.forEach(id => {
    const s = assetStore.scenes.find(x => x._id === id);
    if (s) chips.push({ id: s._id, name: s.sceneName, tag: '@'+s.sceneName, hint: s.description || s.stylePrompt || s.sceneName, type: '场景' });
  });
  return chips;
});

// ===== 加载镜头时渲染编辑器 =====
function renderEditor(text) {
  const editor = el(); if (!editor) return;
  if (!text) { editor.innerHTML = ''; onPromptInput(); return; }
  let html = ''; let last = 0;
  const re = /@([^\s@,;.，。；]+)/g; let m;
  while ((m = re.exec(text))) {
    html += (text.substring(last, m.index)).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const name = m[1];
    const c = assetStore.characters.find(x => x.name === name);
    const s = assetStore.scenes.find(x => x.sceneName === name);
    const bg = (s && !c) ? '#e2f3f5' : 'rgba(201,168,76,0.2)';
    const color = (s && !c) ? '#02adb5' : 'var(--gold-dark)';
    html += `<span class="mention-tag" contenteditable="false" data-name="${name}" style="background:${bg};color:${color}">@${name}</span>`;
    last = re.lastIndex;
  }
  html += (text.substring(last)).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  editor.innerHTML = html;
  onPromptInput();
}

// ===== 图片提示词也同样的编辑器（省略，保留 textarea） =====

watch(noSubtitles, saveNoSubtitles);

onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  // 恢复视频生成状态
  if (window.__videoGenning) { genningVideo.value = true; window.__setLoading?.(true); }
  if (window.__imgGenning) { genningImage.value = true; window.__setLoading?.(true); }
  if (restored) { currentProjectId.value = restored._id; onProjectChange(restored._id); }
  // 恢复未完成的视频任务
  setTimeout(() => resumeVideoTasks(), 1000);
});

// keep-alive 缓存激活时：同步从其他页面切换过来的项目
onActivated(() => {
  const storeProject = projectStore.currentProject;
  if (storeProject && storeProject._id !== currentProjectId.value) {
    currentProjectId.value = storeProject._id;
    onProjectChange(storeProject._id);
  }
});

function onProjectChange(val) {
  currentScriptId.value = ''; currentStoryboard.value = null; currentShot.value = null;
  if (val) {
    scriptStore.fetchScripts(val).then(() => {
      scripts.value = [...scriptStore.scripts];
      if (scripts.value.length > 0) { currentScriptId.value = scripts.value[0]._id; onScriptChange(scripts.value[0]._id); }
    });
    storyboardStore.fetchStoryboards({ projectId: val });
    assetStore.fetchCharacters(val);
    assetStore.fetchScenes(val);
  }
}
function onScriptChange(val) {
  if (val) {
    const existing = storyboardStore.storyboards.find(s => s.scriptId === val);
    currentStoryboard.value = existing ? JSON.parse(JSON.stringify(existing)) : null;
    currentShot.value = currentStoryboard.value?.shots?.[0] || null;
    updatePrompt();
  }
}
async function handleAutoGenerate() {
  if (!currentScriptId.value || !currentProjectId.value) return;
  generating.value = true;
  try {
    // 1. 拉取分镜 + 全局设定
    const script = await scriptStore.fetchScript(currentScriptId.value);
    const scenes = script.scenes || [];
    if (scenes.length === 0) {
      ElMessage.warning('该集还没有分镜，请先在「分镜管理」中添加或生成分镜');
      generating.value = false;
      return;
    }

    // 读取项目全局设定
    let videoConfig = { aspectRatio: '9:16', visualStyle: '写实', subStyle: '' };
    let directorSettings = null;
    try {
      const project = await projectStore.fetchProject(currentProjectId.value);
      if (project?.videoConfig) videoConfig = project.videoConfig;
      if (project?.directorSettings) directorSettings = project.directorSettings;
    } catch (e) { /* ignore */ }

    ElMessage.info(`正在同步 ${scenes.length} 个分镜到故事板（画幅:${videoConfig.aspectRatio} 风格:${videoConfig.visualStyle}）...`);

    // 2. 用共享构建器批量生成镜头+提示词
    const shots = buildShotsFromScenes(scenes, videoConfig, noSubtitles.value, directorSettings);

    // 保留旧的已生成素材（按镜号匹配）
    const oldShots = currentStoryboard.value?.shots || [];
    shots.forEach(newShot => {
      const old = oldShots.find(s => s.shotNumber === newShot.shotNumber);
      if (old) {
        if (old.renderedImage) newShot.renderedImage = old.renderedImage;
        if (old.renderedVideo) newShot.renderedVideo = old.renderedVideo;
        if (old.materials?.length) newShot.materials = [...old.materials];
        if (old._imagePrompt) newShot._imagePrompt = old._imagePrompt;
        if (old._videoPrompt) newShot._videoPrompt = old._videoPrompt;
      }
    });

    // 3. 批量同步到故事板
    const token = localStorage.getItem('token');
    const rawRes = await fetch('/api/v1/storyboards/auto-generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scriptId: currentScriptId.value, projectId: currentProjectId.value, batchShots: shots }),
    });
    const data = await rawRes.json();

    currentStoryboard.value = data.data ? JSON.parse(JSON.stringify(data.data)) : { shots };
    currentStoryboard.value.shots = currentStoryboard.value.shots || shots;
    // 同步到 store 缓存，切换剧集后能恢复
    const idx = storyboardStore.storyboards.findIndex(s => s.scriptId === currentScriptId.value);
    if (idx >= 0) storyboardStore.storyboards[idx] = JSON.parse(JSON.stringify(currentStoryboard.value));
    else storyboardStore.storyboards.push(JSON.parse(JSON.stringify(currentStoryboard.value)));
    // 保留当前选中的分镜（按镜号匹配）
    const prevShotNum = currentShot.value?.shotNumber;
    const matched = currentStoryboard.value.shots.find(s => s.shotNumber === prevShotNum);
    currentShot.value = matched || currentStoryboard.value.shots[0] || null;
    loadShotData(currentShot.value);

    ElMessage.success(`已同步 ${shots.length} 个分镜，图片/视频提示词已自动区分生成`);
  } catch (e) {
    console.error(e);
    ElMessage.error('同步失败: ' + (e.message || ''));
  }
  finally { generating.value = false; }
}

async function deleteStoryboard() {
  if (!currentStoryboard.value?._id) return;
  try { await ElMessageBox.confirm('确定删除当前故事板？删除后可以重新生成。', '删除故事板', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '下次再说叭' }); } catch { return; }
  deletingSB.value = true;
  try {
    const token = localStorage.getItem('token');
    await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    currentStoryboard.value = null;
    currentShot.value = null;
    ElMessage.success('故事板已删除，可重新生成');
  } catch (e) { ElMessage.error('删除失败'); }
  finally { deletingSB.value = false; }
}

function selectShot(s) {
  // 保存当前分镜的提示词
  saveCurrentPrompt();
  saveCurrentVideoPrompt();
  saveVideoDuration();
  // 切换到新分镜
  currentShot.value = s;
  loadShotData(s);
}

function loadShotData(s) {
  if (!s) return;
  currentShotPrompt.value = s._imagePrompt || s.imageDescription || '';
  currentVideoPrompt.value = s._videoPrompt || '';
  videoDuration.value = s.duration || 5;
  currentRefImages.value = s._refImages || [];
  nextTick(() => {
    renderEditor(s._videoPrompt || '');
    renderImgEditor(s._imagePrompt || s.imageDescription || '');
  });
}

function saveCurrentPrompt() {
  if (currentShot.value) currentShot.value._imagePrompt = currentShotPrompt.value;
}
function saveCurrentVideoPrompt() {
  if (currentShot.value) currentShot.value._videoPrompt = currentVideoPrompt.value;
}
function saveVideoDuration() {
  if (currentShot.value && videoDuration.value) currentShot.value.duration = videoDuration.value;
}

function updatePrompt() {
  loadShotData(currentShot.value);
}

function getCharThumb(c) { return c.morphs?.[0]?.referenceImage || c.morphs?.[0]?.generatedImages?.front || c.referenceImage || c.generatedImage || ''; }
function getSceneThumb(s) { return s.generatedImage || s.referenceImage || s.styleImage || ''; }
// 优先取公网可访问的 URL（云存储），fallback 到本地路径
function getRefUrl(asset) {
  const morph = asset.morphs?.[0];
  // 候选 URL 列表：公网 URL 优先，本地 /uploads/ 兜底
  const candidates = [
    morph?.generatedImages?.front,
    morph?.generatedImages?.side,
    morph?.generatedImages?.back,
    morph?.referenceImage,
    asset.generatedImage,
    asset.referenceImage,
  ].filter(Boolean);
  // 优先返回 https:// 公网 URL（对象存储/云存储）
  const cloud = candidates.find(u => u.startsWith('https://') || u.startsWith('http://'));
  if (cloud) return cloud;
  // fallback 到 /uploads/ 本地路径
  const local = candidates.find(u => u.startsWith('/uploads/'));
  return local || candidates[0] || '';
}

const selectedSceneRefs = ref([]);

function toggleRef(id) {
  const idx = selectedRefs.value.indexOf(id);
  if (idx > -1) selectedRefs.value.splice(idx, 1);
  else selectedRefs.value.push(id);
}
function setMatAsCurrent(m) {
  if (!currentShot.value) return;
  if (m.type === 'video') {
    currentShot.value.renderedVideo = m.url;
  } else {
    currentShot.value.renderedImage = m.url;
  }
  if (currentStoryboard.value?._id) {
    const token = localStorage.getItem('token');
    fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${currentShot.value.shotNumber}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(m.type === 'video' ? { renderedVideo: m.url } : { renderedImage: m.url }),
    }).catch(() => {});
  }
  ElMessage.success(m.type === 'video' ? `已切换为当前视频 (v${m.version})` : `已切换为主图 (v${m.version})`);
}
function toggleSceneRef(id) {
  const idx = selectedSceneRefs.value.indexOf(id);
  if (idx > -1) selectedSceneRefs.value.splice(idx, 1);
  else selectedSceneRefs.value.push(id);
}

function onTimelineWheel(e) {
  // @wheel.prevent 已处理 preventDefault
  const el = tlTrack.value || e.currentTarget?.querySelector('.tl-track');
  if (!el) return;
  el.scrollLeft += e.deltaY || e.deltaX || 0;
}

function onRefImageUpload(e) {
  const files = e.target.files;
  if (!files) return;
  for (const f of files) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentRefImages.value.push(ev.target.result);
      if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
    };
    reader.readAsDataURL(f);
  }
  e.target.value = '';
}

function removeRefImage(i) {
  currentRefImages.value.splice(i, 1);
  if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
}

const imgViewerVisible = ref(false);
const imgViewerSrc = ref('');
const imgScale = ref(1);
const imgX = ref(0);
const imgY = ref(0);
let imgDragStart = false, imgStartX = 0, imgStartY = 0, imgOrigX = 0, imgOrigY = 0;

function openVideoPreview(url) {
  if (!url) return;
  window.open(url, '_blank');
}
function openImgViewer(src) {
  if (!src) return;
  imgViewerSrc.value = src;
  imgScale.value = 1;
  imgX.value = 0;
  imgY.value = 0;
  imgViewerVisible.value = true;
}
function onImgDragStart(e) { imgDragStart = true; imgStartX = e.clientX; imgStartY = e.clientY; imgOrigX = imgX.value; imgOrigY = imgY.value; }
function onImgDragMove(e) { if (!imgDragStart) return; imgX.value = imgOrigX + e.clientX - imgStartX; imgY.value = imgOrigY + e.clientY - imgStartY; }
function onImgDragEnd() { imgDragStart = false; }

function applyMaterialToShot(s) {
  if (!currentShot.value || !s.renderedImage) return;
  currentShot.value.renderedImage = s.renderedImage;
  ElMessage.success(`素材 #${s.shotNumber} 已应用到当前分镜`);
}

// ===== 分镜卡片按钮功能 =====

function uploadShotImage(shot, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    shot.renderedImage = ev.target.result;
    ElMessage.success(`分镜 #${shot.shotNumber} 图片已上传`);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function uploadShotVideo(shot, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!currentStoryboard.value?._id) { ElMessage.error('请先保存分镜表'); e.target.value = ''; return; }

  const formData = new FormData();
  formData.append('video', file);
  try {
    const res = await storyboardAPI.uploadShotVideo(
      currentStoryboard.value._id, shot.shotNumber, formData
    );
    shot.renderedVideo = res.data.url;
    shot.status = 'completed';
    ElMessage.success(`分镜 #${shot.shotNumber} 视频已上传`);
  } catch (err) {
    ElMessage.error(`上传失败: ${err.response?.data?.message || err.message}`);
  }
  e.target.value = '';
}

function copyShot(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  const copy = JSON.parse(JSON.stringify(shot));
  copy.shotNumber = shot.shotNumber + 0.5; // 临时编号
  shots.splice(idx + 1, 0, copy);
  renumberShots();
  ElMessage.success(`已复制分镜 #${shot.shotNumber}`);
}

function insertShotAfter(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  shots.splice(idx + 1, 0, {
    shotNumber: shot.shotNumber + 0.5,
    sceneName: shot.sceneName || '',
    shotType: '中景', cameraMovement: '静止', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
  ElMessage.success(`已在 #${shot.shotNumber} 后插入新分镜`);
}

async function deleteShot(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  if (shots.length <= 1) { ElMessage.warning('至少保留一个分镜'); return; }
  try {
    await ElMessageBox.confirm(`确认移除分镜 #${shot.shotNumber}？此操作不可撤销。`, '删除确认', { type: 'warning', confirmButtonText: '确认移除', cancelButtonText: '取消' });
  } catch { return; }
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  shots.splice(idx, 1);
  renumberShots();
  if (currentShot.value?.shotNumber === shot.shotNumber) {
    currentShot.value = shots[Math.min(idx, shots.length - 1)] || null;
  }
  ElMessage.success(`已移除分镜 #${shot.shotNumber}`);
}

function insertAt(idx) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  shots.splice(idx, 0, {
    shotNumber: idx + 0.5, sceneName: shots[idx]?.sceneName || '',
    shotType: '中景', cameraMovement: '静止', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
  ElMessage.success(`已在位置 #${idx + 1} 插入新分镜`);
}

function addBlankShot() {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  shots.push({
    shotNumber: shots.length + 1, sceneName: '',
    shotType: '中景', cameraMovement: '静止', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
}

async function batchGenerateImages() {
  if (!currentStoryboard.value) return;
  const pending = currentStoryboard.value.shots.filter(s => !s.renderedImage && (s._imagePrompt || s.imageDescription));
  if (pending.length === 0) { ElMessage.warning('没有待生成的分镜（需要先填写提示词）'); return; }
  try { await ElMessageBox.confirm(`将为 ${pending.length} 个分镜批量生成图片，确认开始？`, '批量生图', { type: 'info' }); } catch { return; }
  batchGenning.value = true;
  window.__imgGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  for (const s of pending) {
    try {
      const prompt = s._imagePrompt || s.imageDescription;
      const res = await fetch('/api/v1/assets/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'character', prompt, model: selectedModel.value, referenceImages: s._refImages || [] })
      });
      const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
      if (data.data?.imageUrl) { s.renderedImage = data.data.imageUrl; done++; const mats2 = s.materials || []; mats2.push({ version: mats2.length + 1, type: "image", url: data.data.imageUrl, prompt: s._imagePrompt || "", createdAt: new Date().toISOString() }); s.materials = mats2; const mats = s.materials || []; mats.push({ version: mats.length + 1, type: "image", url: data.data.imageUrl, prompt: s._imagePrompt || "", createdAt: new Date().toISOString() }); s.materials = mats; try { if (currentStoryboard.value?._id) { const token2 = localStorage.getItem('token'); await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${s.shotNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` }, body: JSON.stringify({ renderedImage: data.data.imageUrl, materials: s.materials }) }); } } catch {} }
    } catch (e) { console.error('batch image fail:', e); }
  }
  batchGenning.value = false;
  window.__imgGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`批量生图完成：${done}/${pending.length}`);
}

async function batchGenerateVideos() {
  if (!currentStoryboard.value) return;
  const pending = currentStoryboard.value.shots.filter(s => !s.renderedVideo && (s._videoPrompt || s.imageDescription));
  if (pending.length === 0) { ElMessage.warning('没有待生成的分镜（需要先填写视频提示词）'); return; }
  try { await ElMessageBox.confirm(`将为 ${pending.length} 个分镜批量生成视频，确认开始？`, '批量生视频', { type: 'info' }); } catch { return; }
  batchGenningVideo.value = true;
  window.__videoGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  // 批量生视频复用选中参考角色作为兜底参考图
  const fallbackUrls = [];
  selectedRefs.value.forEach(id => { const url = getRefUrl(assetStore.characters.find(x => x._id === id)); if (url) fallbackUrls.push(url); });
  selectedSceneRefs.value.forEach(id => { const url = getRefUrl(assetStore.scenes.find(x => x._id === id)); if (url) fallbackUrls.push(url); });

  for (const s of pending) {
    try {
      const prompt = s._videoPrompt || s.imageDescription;
      const parsedRefs = prompt ? parsePromptRefs(prompt) : [];
      const refUrls = parsedRefs.length > 0 ? parsedRefs.filter(r => r.url).map(r => r.url) : fallbackUrls;
      // 注入场景/角色描述到 prompt 中
      let batchPrompt = prompt;
      const sceneDescsBatch = parsedRefs.filter(r => r.appearance && !assetStore.characters.some(c => c.name === r.name)).map(r => `【场景:${r.name}】${r.appearance}`).join('；');
      if (sceneDescsBatch) batchPrompt = sceneDescsBatch + '。' + batchPrompt;
      const charDescsBatch = parsedRefs.filter(r => r.appearance && assetStore.characters.some(c => c.name === r.name)).map(r => `【${r.name}外貌】${r.appearance}`).join('；');
      if (charDescsBatch) batchPrompt = charDescsBatch + '。' + batchPrompt;
      const res = await fetch('/api/v1/assets/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt: batchPrompt, model: selectedVideoModel.value, inputImage: s.renderedImage || '', referenceImages: refUrls, duration: s.duration || 5 })
      });
      const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
      if (data.data?.imageUrl) { s.renderedVideo = data.data.imageUrl; done++; try { if (currentStoryboard.value?._id) { const token = localStorage.getItem('token'); await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${s.shotNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ renderedVideo: data.data.imageUrl }) }); } } catch {} }
    } catch (e) { console.error('batch video fail:', e); }
  }
  batchGenningVideo.value = false;
  window.__videoGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`批量生视频完成：${done}/${pending.length}`);
}

function renumberShots() {
  if (!currentStoryboard.value) return;
  currentStoryboard.value.shots.forEach((s, i) => { s.shotNumber = i + 1; });
}

async function generatePromptForShot() {
  if (!currentShot.value) return;
  genningPrompt.value = true;
  try {
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'storyboard', existingPrompt: '你是AI绘图提示词专家。根据分镜描述生成高质量中文图片提示词，包含画面内容、人物动作、场景氛围、光影、构图、风格。只输出完整提示词。\\n\\n分镜描述：' + currentShotPrompt.value + '\\n\\n请生成完整图片提示词。' })
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
    currentShotPrompt.value = data.data?.prompt || currentShotPrompt.value;
    saveCurrentPrompt();
    ElMessage.success('图片提示词已生成');
  } catch (e) { ElMessage.error('生成失败'); }
  finally { genningPrompt.value = false; }
}

async function generateVideoPromptForShot() {
  if (!currentShot.value) return;
  genningVideoPrompt.value = true;
  try {
    const s = currentShot.value;
    const dialogues = s._dialogues || [];
    const dialogueText = dialogues.map(d => (d.characterName || '') + '：' + (d.text || '') + (d.actionHint ? '(' + d.actionHint + ')' : '')).filter(x => x.includes('：')).join('；');
    const charNames = [...new Set(dialogues.map(d => d.characterName).filter(Boolean))];
    const charAppearances = [];
    charNames.forEach(name => {
      const c = assetStore.characters.find(x => x.name === name);
      if (c && c.appearance) charAppearances.push('【' + name + '】' + c.appearance);
    });
    const parts = [
      '场景：' + (s.sceneName || '') + '，' + (s._timeOfDay || '') + '，' + (s._atmosphere || ''),
      '景别：' + (s.shotType || '中景') + '，运镜：' + (s.cameraMovement || '静止'),
      '时长：' + videoDuration.value + '秒',
      dialogueText ? '台词：' + dialogueText : '',
      charAppearances.length > 0 ? '角色外貌：' + charAppearances.join('；') : '',
      s.imageDescription ? '画面描述：' + s.imageDescription : '',
    ].filter(Boolean).join('\n');
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'video', existingPrompt: '你是短视频导演。根据以下分镜信息生成一段完整的视频提示词。要求：包含画面描述、运镜方式、人物动作、台词节奏、光影氛围，适合' + videoDuration.value + '秒竖屏短视频。只输出视频提示词文本。\n\n' + parts })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
    if (data.data?.prompt) {
      currentVideoPrompt.value = data.data.prompt;
      saveCurrentVideoPrompt();
      ElMessage.success('视频提示词已生成（含台词节奏）');
    }
  } catch (e) { ElMessage.error('生成失败: ' + (e.message || '')); }
  finally { genningVideoPrompt.value = false; }
}
async function generateTimedStoryboard() {
  if (!currentVideoPrompt.value) { ElMessage.warning('请先生成或填写视频提示词'); return; }
  genningTimedSB.value = true;
  try {
    const totalDuration = videoDuration.value;
    const sysPrompt = `你是短视频分镜导演。将一段视频提示词拆分为带时间轴的多镜头分镜脚本。

规则：
1. 总时长固定为${totalDuration}秒。
2. 根据内容复杂度自动合理分配秒数，动作/对话各分配足够时间。
3. 每个镜头的秒数不固定，根据动作和台词量智能判断（通常2-6秒一个镜头）。
4. 每个镜头标注时间区间、景别、运镜、画面内容。
5. 包含所有台词，分配台词到对应镜头。
6. 结尾加上约束：无字幕，面部不变形，人体结构正常。
7. 直接输出最终文本，不要JSON，不要多余解释。类似格式：
  ${totalDuration}秒竖屏9:16，超写实电影级摄影，无字幕。

  镜头1（0-X秒）：[景别]，[画面内容]。人物动作。运镜方式。
  镜头2（X-Y秒）：...
  ...`;
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'storyboard', existingPrompt: sysPrompt + '\n\n待拆分内容：\n' + currentVideoPrompt.value })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || 'AI分镜失败'); return; }
    if (data.data?.prompt) {
      currentVideoPrompt.value = data.data.prompt;
      saveCurrentVideoPrompt();
      ElMessage.success('已生成智能时间轴分镜！');
    }
  } catch (e) { ElMessage.error('分镜失败: ' + (e.message || '')); }
  finally { genningTimedSB.value = false; }
}
async function generateImageForShot() {
  if (!currentShot.value || !currentShotPrompt.value) { ElMessage.warning('请先填写提示词'); return; }
  genningImage.value = true;
  window.__imgGenning = true;
  window.__setLoading?.(true);
  try {
    // 收集参考图：选中角色 + 选中场景 + 当前分镜已上传的参考图
    const refUrls = [];
    const charAppearances = [];
    const sceneDescs = [];
    selectedRefs.value.forEach(id => {
      const c = assetStore.characters.find(x => x._id === id);
      if (!c) return;
      const url = getRefUrl(c);
      if (url) refUrls.push(url);
      const appearance = c.appearance || (c.morphs && c.morphs[0] && c.morphs[0].appearancePrompt) || '';
      if (appearance) charAppearances.push('【' + c.name + '】' + appearance);
    });
    selectedSceneRefs.value.forEach(id => {
      const s = assetStore.scenes.find(x => x._id === id);
      if (!s) return;
      const url = getRefUrl(s);
      if (url) refUrls.push(url);
      if (s.description || s.stylePrompt) sceneDescs.push(`【场景:${s.sceneName}】${s.description || s.stylePrompt}`);
    });
    if (currentShot.value._refImages?.length) refUrls.push(...currentShot.value._refImages);

    let enrichedPrompt = currentShotPrompt.value;
    if (charAppearances.length > 0) {
      enrichedPrompt += '；【角色外貌约束·必须遵守】严格按照以下角色设定生成，保持人物五官、发型、服饰100%一致：' + charAppearances.join('；') + '；注意：面部特征、发型发色、服饰风格必须与以上设定完全吻合，不得改变';
    }
    if (sceneDescs.length > 0) {
      enrichedPrompt += '；【场景约束·必须遵守】严格按照以下场景设定生成画面环境，保持场景建筑、室内布局、光影色调100%一致：' + sceneDescs.join('；') + '；注意：场景的建筑风格、室内设计、灯光氛围必须与以上设定完全吻合';
    }
    console.log('[生图] 参考图数量:', refUrls.length, '角色外貌描述:', charAppearances.length, '场景描述:', sceneDescs.length, 'URLs:', refUrls);
    const res = await fetch('/api/v1/assets/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'character', prompt: enrichedPrompt, model: selectedModel.value, referenceImages: refUrls })
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }
    if (data.data?.imageUrl) {
      currentShot.value.renderedImage = data.data.imageUrl;
      const mats = currentShot.value.materials || []; mats.push({ version: mats.length + 1, type: "image", url: data.data.imageUrl, prompt: currentShotPrompt.value, createdAt: new Date().toISOString() }); currentShot.value.materials = mats;
      // 持久化到数据库
      if (currentStoryboard.value?._id) {
        try { await storyboardAPI.updateShot(currentStoryboard.value._id, currentShot.value.shotNumber, { renderedImage: data.data.imageUrl, materials: mats }); } catch {}
      }
      ElMessage.success('图片生成完成，已保存到数据库');
    }
  } catch (e) { ElMessage.error('生成失败'); }
  finally {
    genningImage.value = false;
    window.__imgGenning = false;
    window.__setLoading?.(false);
  }
}

// 视频生成 polling 状态 — key: `${scriptId}_${shotNumber}`
const videoPollingMap = reactive({});
const videoPollTimers = {};
const recoverTaskId = ref('');
const recovering = ref(false);
function isTaskId(url) { return url && /^cgt-/.test(url); }
function getShotPollKey(shot, scriptId) {
  const s = shot || currentShot.value;
  const sid = scriptId || currentScriptId.value;
  if (!s?.shotNumber || !sid) return null;
  return `${sid}_${s.shotNumber}`;
}
function statusLabel(s) {
  const m = { queued: '排队中', submitted: '已提交', running: '生成中', processing: '处理中', succeeded: '已完成', failed: '失败', cancelled: '已取消', expired: '已过期' };
  return m[s] || s || '处理中';
}

async function recoverVideo() {
  const tid = recoverTaskId.value.trim();
  if (!tid) return;
  recovering.value = true;
  try {
    const res = await fetch('/api/v1/assets/video-tasks/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ taskIds: [tid] }),
    });
    const json = await res.json();
    const r = json.data?.[0];
    if (r?.videoUrl) {
      currentShot.value.renderedVideo = r.videoUrl;
      const mats = currentShot.value.materials || [];
      mats.push({ version: mats.length + 1, type: 'video', url: r.videoUrl, prompt: currentVideoPrompt.value, createdAt: new Date().toISOString() });
      currentShot.value.materials = mats;
      if (currentStoryboard.value?._id) {
        try { await storyboardAPI.updateShot(currentStoryboard.value._id, currentShot.value.shotNumber, { renderedVideo: r.videoUrl, materials: mats }); } catch {}
      }
      recoverTaskId.value = '';
      ElMessage.success('视频已恢复到当前分镜 🎉');
    } else {
      ElMessage.warning(r?.status === 'running' || r?.status === 'queued' ? '任务仍在生成中，已开始轮询' : `任务状态: ${r?.status || '未知'}`);
      if (r?.status === 'running' || r?.status === 'queued') {
        startVideoPolling(tid, currentShot.value?.shotNumber, currentStoryboard.value?._id, currentScriptId.value);
      }
    }
  } catch (e) { ElMessage.error('恢复失败: ' + (e.message || '')); }
  finally { recovering.value = false; }
}

async function generateVideoForShot() {
  if (!currentShot.value || !currentVideoPrompt.value) { ElMessage.warning('请先填写或生成视频提示词'); return; }
  genningVideo.value = true;
  window.__videoGenning = true;
  window.__setLoading?.(true);
  try {
    const prompt = currentVideoPrompt.value;
    // 解析 @引用 → 有序排列参考图 + 外貌/场景描述
    const parsedRefs = parsePromptRefs(prompt);
    const refUrls = parsedRefs.filter(r => r.url).map(r => r.url);
    // 区分角色和场景的描述信息
    const charDescs = [];
    const sceneDescs = [];
    parsedRefs.forEach(r => {
      if (!r.appearance) return;
      // 通过名字查找是角色还是场景
      const isChar = assetStore.characters.some(c => c.name === r.name);
      if (isChar) {
        charDescs.push(`【${r.name}外貌】${r.appearance}`);
      } else {
        sceneDescs.push(`【场景:${r.name}】${r.appearance}`);
      }
    });
    const promptParts = [];
    if (charDescs.length) promptParts.push(charDescs.join('；'));
    if (sceneDescs.length) promptParts.push(sceneDescs.join('；'));
    if (promptParts.length) promptParts.push(prompt);
    const finalPrompt = promptParts.length ? promptParts.join('。') : prompt;

    // 兜底：如果 prompt 里没写 @引用，复用右侧选中角色 + 场景
    if (refUrls.length === 0) {
      selectedRefs.value.forEach(id => {
        const c = assetStore.characters.find(x => x._id === id);
        const url = getRefUrl(c);
        if (url) refUrls.push(url);
      });
    }
    selectedSceneRefs.value.forEach(id => {
      const s = assetStore.scenes.find(x => x._id === id);
      const url = getRefUrl(s); if (url && !refUrls.includes(url)) refUrls.push(url);
    });
    if (currentShot.value._refImages?.length) {
      currentShot.value._refImages.forEach(u => { if (!refUrls.includes(u)) refUrls.push(u); });
    }
    const inputImage = currentShot.value.renderedImage || '';

    console.log('[生视频]', JSON.stringify({
      shot: currentShot.value.shotNumber,
      prompt: finalPrompt.substring(0, 120),
      refUrls: refUrls.map(u => u.substring(0, 80)),
      parsedRefs: parsedRefs.map(r => ({ name: r.name, url: r.url.substring(0, 60) })),
      inputImage: inputImage.substring(0, 60) || '(none)',
    }, null, 2));

    const res = await fetch('/api/v1/assets/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt: finalPrompt, model: selectedVideoModel.value, inputImage, referenceImages: refUrls, duration: videoDuration.value })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '视频生成失败'); return; }

    const taskId = data.data?.imageUrl;
    if (!taskId) { ElMessage.error('未获取到视频任务ID'); return; }

    // 保存 taskId 到 shot + localStorage 持久化（刷新页面也不丢失）
    currentShot.value.renderedVideo = taskId;
    currentShot.value._videoTaskId = taskId;
    const task = { taskId, shotNumber: currentShot.value.shotNumber, startTime: Date.now(), storyboardId: currentStoryboard.value?._id, scriptId: currentScriptId.value };
    try {
      const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
      tasks[taskId] = task;
      localStorage.setItem('ad_video_tasks', JSON.stringify(tasks));
    } catch {}
    ElMessage.success('视频任务已提交，后台生成中（约1-3分钟），可切换页面稍后回来看');
    window.__addNotification?.('视频任务已提交', 'info', '⏳');

    startVideoPolling(taskId, currentShot.value.shotNumber, currentStoryboard.value?._id, currentScriptId.value);
  } catch (e) { ElMessage.error('视频生成失败: ' + (e.message || '')); }
  finally {
    genningVideo.value = false;
    window.__videoGenning = false;
    window.__setLoading?.(false);
  }
}

function startVideoPolling(taskId, shotNumOverride, sbIdOverride, scriptIdOverride) {
  const shotNum = shotNumOverride || currentShot.value?.shotNumber;
  const scriptId = scriptIdOverride || currentScriptId.value;
  const key = `${scriptId}_${shotNum}`;
  const startTime = Date.now();
  videoPollingMap[key] = { progress: 0, status: 'queued', taskId, shotNum, scriptId };

  clearInterval(videoPollTimers[key]);
  videoPollTimers[key] = setInterval(async () => {
    if (!videoPollingMap[key]) { clearInterval(videoPollTimers[key]); return; }
    const e = videoPollingMap[key];
    e.progress = Math.floor((Date.now() - startTime) / 1000);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/assets/video-task/${taskId}?provider=doubao`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const d = json.data;
      const finalStatuses = ['succeeded', 'completed', 'failed', 'expired', 'cancelled', 'error'];
      if (finalStatuses.includes(d.status)) {
        clearInterval(videoPollTimers[key]);
        delete videoPollTimers[key];
        e.status = d.status;
        try {
          const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
          delete tasks[taskId]; localStorage.setItem('ad_video_tasks', JSON.stringify(tasks));
        } catch {}
        if (d.status === 'succeeded' || d.status === 'completed') {
          const url = d.videoUrl;
          if (url) {
            if (currentStoryboard.value?._id === sbIdOverride && currentShot.value?.shotNumber === shotNum) {
              currentShot.value.renderedVideo = url;
              const mats = currentShot.value.materials || [];
              mats.push({ version: mats.length + 1, type: 'video', url, prompt: currentVideoPrompt.value, createdAt: new Date().toISOString() });
              currentShot.value.materials = mats;
            }
            try {
              const sb = sbIdOverride ? await storyboardAPI.get(sbIdOverride) : null;
              if (sb?.data) {
                const shot = sb.data.shots?.find(s => s.shotNumber === shotNum);
                if (shot) { shot.renderedVideo = url; shot.status = 'completed'; }
                if (sbIdOverride === currentStoryboard.value?._id) currentStoryboard.value = sb.data;
              }
            } catch {}
            await storyboardAPI.updateShot(sbIdOverride, shotNum, { renderedVideo: url }).catch(() => {});
          }
          ElMessage.success(`镜头 ${shotNum} 视频生成完成 🎉`);
          window.__addNotification?.(`镜头 ${shotNum} 视频完成`, 'success', '🎥');
        } else {
          if (currentStoryboard.value?.shots) {
            const shot = currentStoryboard.value.shots.find(s => s.shotNumber === shotNum);
            if (shot && shot.renderedVideo === taskId) { shot.renderedVideo = ''; shot.status = 'failed'; }
          }
          ElMessage.warning(`镜头 ${shotNum} 视频失败: ${d.status}`);
        }
        delete videoPollingMap[key];
      } else {
        e.status = d.status || 'processing';
      }
    } catch { /* 继续轮询 */ }
  }, 5000);
}

function resumeVideoTasks() {
  try {
    const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
    const entries = Object.values(tasks);
    if (entries.length === 0) return;
    console.log('[视频] 恢复未完成任务:', entries.length, '个');
    entries.forEach(t => {
      startVideoPolling(t.taskId, t.shotNumber, t.storyboardId, t.scriptId);
    });
  } catch {}
}

onUnmounted(() => { Object.values(videoPollTimers).forEach(clearInterval); });

function formatEpLabel(ep) {
  const title = (ep.episodeTitle || '').replace(/^第\d+集[：:]*\s*/, '').trim();
  return title ? `第${ep.episodeNumber}集：${title}` : `第${ep.episodeNumber}集`;
}

// ===== TTS 配音 =====
const showTTSDialog = ref(false);
const ttsTargetShot = ref(null);
const synthingShot = ref(null);
const ttsBatchRunning = ref(false);
const ttsParams = reactive({ speaker: 'zh_female_vv_uranus_bigtts', speechRate: 0, loudnessRate: 0 });
const ttsCustomSpeaker = ref('');

const ttsVoiceOptions = ref([{ label: '加载中...', value: '' }]);

async function fetchTTSVoices() {
  try {
    const { data } = await configAPI.getTTSVoices();
    if (data && data.length > 0) {
      const opts = [{ label: '自定义音色ID (手动输入)', value: '__custom__' }];
      const byGender = {};
      data.forEach(v => { const g = v.gender || '其他'; if (!byGender[g]) byGender[g] = []; byGender[g].push({ label: v.name, value: v.id }); });
      Object.entries(byGender).forEach(([g, voices]) => { opts.push({ label: `──── ${g}声 ────`, value: '', disabled: true }); opts.push(...voices); });
      ttsVoiceOptions.value = opts;
    }
  } catch {}
}

function openTTSDialog(shot) {
  fetchTTSVoices();
  ttsTargetShot.value = shot;
  ttsParams.speaker = 'zh_female_vv_uranus_bigtts';
  ttsParams.speechRate = 0;
  ttsParams.loudnessRate = 0;
  showTTSDialog.value = true;
}

async function handleTTSSynthesize() {
  if (!synthingShot.value && !ttsTargetShot.value) { ttsBatchRunning.value = true; }
  else { synthingShot.value = ttsTargetShot.value ? ttsTargetShot.value.shotNumber : -1; }
  showTTSDialog.value = false;
  const speaker = ttsParams.speaker === '__custom__' ? (ttsCustomSpeaker.value || 'zh_female_vv_uranus_bigtts') : ttsParams.speaker;
  try {
    if (!ttsTargetShot.value) {
      const { data } = await ttsAPI.batchSynthesize({
        storyboardId: currentStoryboard.value._id,
        speaker, speechRate: ttsParams.speechRate, loudnessRate: ttsParams.loudnessRate,
      });
      const ok = data.results?.filter(r => r.success).length || 0;
      ElMessage.success(`批量配音完成: ${ok}/${data.results?.length || 0}`);
      if (currentStoryboard.value) {
        const sb = await storyboardAPI.get(currentStoryboard.value._id);
        if (sb?.data) { currentStoryboard.value = sb.data; }
      }
    } else {
      const shot = ttsTargetShot.value;
      const text = shot.dialogue?.text || shot.imageDescription || '';
      if (!text.trim()) { ElMessage.warning('该镜头没有台词'); return; }
      const { data } = await ttsAPI.synthesize({
        storyboardId: currentStoryboard.value._id,
        shotNumber: shot.shotNumber,
        text, characterName: shot.dialogue?.characterName || '',
        projectId: currentProjectId.value,
        scriptId: currentScriptId.value,
        speaker, speechRate: ttsParams.speechRate, loudnessRate: ttsParams.loudnessRate,
      });
      if (shot.dialogue) shot.dialogue.audioUrl = data.audioUrl;
      ElMessage.success('配音完成');
    }
  } catch (e) { ElMessage.error(e.response?.data?.message || '配音失败'); }
  finally { synthingShot.value = null; ttsBatchRunning.value = false; ttsTargetShot.value = null; }
}

function openExport() {
  exportEpisodes.value = currentScriptId.value ? [currentScriptId.value] : scripts.value.map(e => e._id);
  showExportDialog.value = true;
}

async function handleExport() {
  if (exportTypes.value.length === 0 || exportEpisodes.value.length === 0) return;
  const fmt = exportFormat.value;
  showExportDialog.value = false;
  try {
    const res = await fetch('/api/v1/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({
        projectId: currentProjectId.value,
        episodeIds: exportEpisodes.value,
        types: exportTypes.value,
        format: fmt,
      }),
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }

    if (fmt === 'pdf') {
      // PDF: 打开打印窗口
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(data.html); w.document.close(); setTimeout(() => w.print(), 500); }
    } else {
      // Markdown / CSV / Word: 下载文件
      const ext = { markdown: 'md', csv: 'csv', word: 'doc' }[fmt] || 'txt';
      const mime = { markdown: 'text/markdown', csv: 'text/csv', word: 'application/msword' }[fmt] || 'text/plain';
      const blob = new Blob([data.content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${data.filename || 'export'}.${ext}`;
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('下载完成');
    }
  } catch (e) { ElMessage.error('导出失败'); }
}
async function handleImport() {
  if (!currentStoryboard.value || !importText.value.trim()) return;
  importing.value = true;
  const text = importText.value.trim();
  const format = text.startsWith('[') || text.startsWith('{') ? 'json' : 'csv';
  try {
    const data = format === 'json' ? JSON.parse(text) : text;
    await storyboardAPI.importData(currentStoryboard.value._id, data, format);
    const refreshed = await storyboardStore.fetchStoryboard(currentStoryboard.value._id);
    currentStoryboard.value = JSON.parse(JSON.stringify(refreshed));
    importText.value = ''; showImportDialog.value = false;
    ElMessage.success('导入成功');
  } catch (e) { ElMessage.error('导入失败'); }
  finally { importing.value = false; }
}
</script>

<style scoped>
/* ===== ART DECO FILM SUITE ===== */

.sb-root { display: flex; flex-direction: column; height: calc(100vh - 48px); }
.sb-top { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 16px; flex-shrink: 0; }
.tb-right { display: flex; align-items: center; gap: 6px; }

.sb-body { display: flex; flex: 1; gap: 16px; overflow: hidden; min-height: 0; }

/* ===== LEFT: Episode List ===== */
.sb-left {
  width: 190px; flex-shrink: 0; background: var(--bg-200);
  border-radius: 10px; border: 1px solid var(--gold);
  box-shadow: 0 4px 20px rgba(139,105,20,0.08);
  overflow-y: auto; padding: 16px;
}
.panel-title {
  font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700;
  color: var(--text-100); margin-bottom: 12px; padding-bottom: 10px;
  border-bottom: 2px solid var(--gold); letter-spacing: 1px;
}
.ep-item {
  padding: 10px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 6px;
  display: flex; flex-direction: column; gap: 2px;
  border-left: 3px solid transparent; transition: all 0.25s;
}
.ep-item:hover { background: var(--gold-light); border-left-color: var(--gold); }
.ep-item.active { background: var(--navy); border-left-color: var(--gold); }
.ep-item.active .ep-num{color:var(--gold)!important}
.ep-item.active .ep-name{color:var(--gold-light)!important}
.ep-num { color: var(--text-100); font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
.ep-name { color: var(--text-200); font-size: 11px; }

/* ===== CENTER: Preview + Timeline ===== */
.sb-center { flex: 1; display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* Preview */
.preview-area {
  background: linear-gradient(135deg, #f8f6f0 0%, #f0ece3 100%);
  border-radius: 12px;
  border: 1px solid #e0d9cc;
  flex: 1; display: flex;
  align-items: center; justify-content: center; overflow: hidden;
  position: relative;
  box-shadow: inset 0 0 40px rgba(201,168,76,0.06), 0 2px 16px rgba(0,0,0,0.06);
}
.preview-area::before {
  content: ''; position: absolute; top: 12px; left: 16px;
  font-family: 'Playfair Display', serif; font-size: 10px;
  color: #b8a88a; letter-spacing: 3px; opacity: 0.6;
}
.preview-empty { text-align: center; color: #8b7355; }
.preview-empty p { margin-top: 10px; font-size: 14px; color: #8b7355; opacity: 0.7; letter-spacing: 1px; }
.preview-shot { text-align: center; width: 100%; }
.preview-frame {
  height: 220px; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.03); border-radius: 6px; margin: 0 12px;
}
.preview-info { display: flex; gap: 10px; justify-content: center; padding: 10px; font-size: 12px; }
.pi-tag {
  background: #c9a84c; color: #fff; padding: 3px 10px;
  border-radius: 3px; font-size: 11px; font-weight: 700; letter-spacing: 1px;
}
.preview-dialogue {
  padding: 10px 18px; color: #6b5e47; font-size: 13px;
  background: rgba(201,168,76,0.08); border-top: 1px solid #e0d9cc;
  font-style: italic;
}

/* Timeline */
.timeline {
  background: var(--bg-200); border-radius: 10px; border: 1px solid var(--gold);
  padding: 14px; flex-shrink: 0; box-shadow: 0 2px 12px rgba(139,105,20,0.05);
}
.tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.tl-label { font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700; color: var(--text-100); letter-spacing: 1px; }
.tl-track { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; align-items: flex-start; }
.tl-track::-webkit-scrollbar { height: 4px; }
.tl-track::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }
.tl-card {
  flex-shrink: 0; width: 112px; border-radius: 8px;
  border: 2px solid var(--bg-300); background: var(--bg-200);
  transition: all 0.25s cubic-bezier(0.22,0.61,0.36,1); overflow: hidden;
}
.tl-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(201,168,76,0.15); }
.tl-active { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.2); }
.tl-card-header { display: flex; justify-content: space-between; padding: 5px 8px; background: var(--bg-100); border-bottom: 1px solid var(--bg-300); }
.tl-shot-num { font-size: 10px; font-weight: 700; color: var(--text-100); letter-spacing: 0.5px; }
.tl-shot-dur { font-size: 10px; color: var(--gold-dark); font-weight: 600; }
.tl-img { width: 100%; height: 58px; background: var(--navy); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
.tl-img img { width: 100%; height: 100%; object-fit: cover; }
.tl-placeholder { color: var(--gold); font-size: 11px; opacity: 0.5; letter-spacing: 1px; }
.tl-meta { display: flex; justify-content: space-between; padding: 3px 8px 0; font-size: 10px; cursor: pointer; }
.tl-desc { padding: 3px 8px 0; font-size: 10px; color: var(--text-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.tl-type { color: var(--gold-dark); font-weight: 600; letter-spacing: 0.5px; }
.tl-insert {
  flex-shrink: 0; width: 22px; height: 60px; border-radius: 4px;
  background: var(--bg-100); border: 1px dashed var(--gold);
  color: var(--gold); display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; align-self: center;
}
.tl-insert:hover { border-color: var(--gold-dark); color: var(--gold-dark); background: var(--gold-light); }
.tl-insert-end { height: 130px; }
.tl-card-end { cursor: pointer; opacity: 0.5; flex-shrink: 0; width: 112px; }
.tl-card-end:hover { opacity: 1; border-color: var(--gold); }
.tl-img-add { cursor: pointer !important; }
.tl-add-icon { font-size: 32px; color: var(--gold); line-height: 1; opacity: 0.4; }
.tl-card-end:hover .tl-add-icon { opacity: 1; color: var(--gold-dark); }
.tl-meta-end { padding: 3px 8px 0; font-size: 10px; text-align: center; }
.tl-actions-end { display: flex; justify-content: center; align-items: center; padding: 4px 2px; border-top: 1px solid var(--bg-300); height: 26px; }
.tl-actions { display: flex; justify-content: center; gap: 3px; padding: 4px 2px; border-top: 1px solid var(--bg-300); height: 26px; align-items: center; }
.tl-btn {
  width: 20px; height: 20px; border-radius: 3px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 11px; color: var(--text-200); transition: all 0.15s; position: relative;
}
.tl-btn:hover { background: var(--gold); color: var(--navy); }
.tl-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.tl-btn-del:hover { background: #C44545; color: #fff; }

.prompt-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; }
.prompt-chip {
  padding: 2px 10px; font-size: 11px; cursor: pointer; user-select: none;
  border: 1px solid var(--gold); color: var(--gold-dark); background: var(--accent-200);
  border-radius: 4px; font-weight: 600; transition: all 0.15s;
  font-family: 'DM Sans', 'Microsoft YaHei', sans-serif;
}
.prompt-chip:hover { background: var(--gold); color: var(--navy); transform: translateY(-1px); }

/* ===== 富文本编辑器 ===== */
.prompt-editor-wrap { position: relative; }
.prompt-editor {
  min-height: 88px; max-height: 260px; overflow-y: auto;
  padding: 10px 12px; border: 1px solid var(--bg-300); border-radius: 6px;
  background: var(--bg-200); font-family: 'DM Sans','Microsoft YaHei',monospace;
  font-size: 13px; line-height: 1.7; color: var(--text-100);
  outline: none; cursor: text; word-break: break-word;
}
.prompt-editor:focus { border-color: var(--gold); box-shadow: 0 0 0 1px rgba(201,168,76,0.3); }
.seedance-marquee {
  overflow: hidden; white-space: nowrap; width: 100%;
  padding: 6px 0 6px 12px;
  background: var(--accent-200); border-radius: 6px; margin-bottom: 12px;
  font-size: 11px; color: var(--text-100); cursor: default;
}
.seedance-marquee-text { display: none; } /* 旧类名废弃，保留向后兼容 */
.seedance-marquee-inner { white-space: nowrap; display: flex; }
.seedance-marquee-dupe {
  display: inline-block; flex-shrink: 0; white-space: nowrap;
  animation: seedance-marquee-scroll 25s linear infinite;
  padding-right: 48px;
}
.seedance-marquee:hover .seedance-marquee-dupe { animation-play-state: paused; }
@keyframes seedance-marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
.prompt-editor-ph {
  position: absolute; top: 10px; left: 12px; color: var(--text-200);
  font-size: 13px; pointer-events: none;
  font-family: 'DM Sans','Microsoft YaHei',monospace;
}
.mention-tag {
  display: inline-block; padding: 1px 5px; border-radius: 4px;
  font-size: 12px; font-weight: 600; line-height: 1.5; cursor: default;
  user-select: all; margin: 0 1px; border-bottom: 2px solid rgba(0,0,0,0.1);
}
.mention-menu {
  position: absolute; left: 8px; bottom: 100%; margin-bottom: 4px; z-index: 200;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15); max-height: 200px; overflow-y: auto;
  min-width: 220px; padding: 4px 0;
}
.mention-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 12px;
  cursor: pointer; font-size: 13px; transition: background 0.1s;
}
.mention-item:hover { background: var(--accent-200); }
.mention-chip { padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; flex-shrink: 0; }
.mention-name { flex: 1; color: var(--text-100); font-weight: 500; }
.mention-type { font-size: 10px; color: var(--text-200); }
.mention-empty { padding: 8px 12px; color: var(--text-200); font-size: 12px; }

.prompt-preview {
  padding: 6px 0; font-size: 12px; line-height: 1.6; color: var(--text-200);
}
.prompt-preview mark {
  background: rgba(201,168,76,0.2); color: var(--gold-dark); border-radius: 3px;
  padding: 1px 3px; font-weight: 600; border-bottom: 2px solid var(--gold);
}

/* ===== RIGHT: Image/Video Panel ===== */
.sb-right {
  width: 250px; flex-shrink: 0; background: var(--bg-200);
  border-radius: 10px; border: 1px solid var(--gold);
  padding: 14px; overflow-y: auto;
  box-shadow: 0 4px 20px rgba(139,105,20,0.08);
}
.tab-switch { display: flex; margin-bottom: 14px; border-radius: 6px; overflow: hidden; border: 1px solid var(--gold); }
.tab-btn {
  flex: 1; text-align: center; padding: 8px 0; font-size: 12px; font-weight: 600;
  cursor: pointer; background: var(--bg-100); color: var(--text-200);
  letter-spacing: 1px; transition: all 0.25s;
}
.tab-btn.active { background: var(--navy); color: var(--gold); }
.right-section { margin-bottom: 16px; }
.right-section > label {
  display: block; font-size: 11px; font-weight: 700; color: var(--text-100);
  margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;
}
.char-count { font-size: 10px; color: var(--text-200); }
.ref-chars { display: flex; flex-wrap: wrap; gap: 5px; }
.ref-chip {
  padding: 4px 10px; border-radius: 4px; background: var(--bg-100);
  font-size: 11px; cursor: pointer; border: 1px solid var(--bg-300);
  color: var(--text-200); transition: all 0.2s;
}
.ref-chip:hover { border-color: var(--gold); }
.ref-chip.active { background: var(--navy); border-color: var(--gold); color: var(--gold) !important; }
.ref-chip.has-img { border-color: var(--gold); }
.ref-chip:not(.has-img) { opacity: 0.6; }
.mat-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.mat-item {
  width: 54px; height: 54px; border-radius: 6px; overflow: hidden; cursor: pointer;
  position: relative; background: var(--navy); border: 1px solid var(--bg-300);
}
.mat-item:hover { border-color: var(--gold); }
.mat-item img { width: 100%; height: 100%; object-fit: cover; }
.mat-num { position: absolute; bottom: 1px; right: 2px; font-size: 9px; color: var(--gold); background: rgba(26,26,46,0.8); padding: 0 4px; border-radius: 2px; }
.mat-ver { position: absolute; top: 2px; left: 2px; font-size: 9px; color: var(--gold); background: rgba(26,26,46,0.8); padding: 0 3px; border-radius: 2px; }
.mat-set { position: absolute; top: 2px; right: 2px; font-size: 12px; color: var(--gold); cursor: pointer; opacity: 0; transition: opacity 0.15s; }
.mat-item:hover .mat-set { opacity: 1; }
.mat-active { border-color: var(--gold) !important; box-shadow: 0 0 0 2px rgba(201,168,76,0.3); }
.mat-video-preview { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.mat-play-icon { font-size: 16px; color: var(--gold); }
.mat-type { position: absolute; bottom: 1px; left: 2px; font-size: 10px; }
.ref-imgs { display: flex; flex-wrap: wrap; gap: 6px; }
.ref-img-item { width: 54px; height: 54px; border-radius: 6px; overflow: hidden; position: relative; background: var(--bg-100); border: 1px solid var(--bg-300); }
.ref-img-item img { width: 100%; height: 100%; object-fit: cover; }
.ref-img-del { position: absolute; top: 0; right: 0; width: 16px; height: 16px; background: var(--accent-100); color: var(--navy); font-size: 11px; line-height: 16px; text-align: center; cursor: pointer; font-weight: 700; }
.ref-upload-btn { width: 54px; height: 54px; border-radius: 6px; border: 1px dashed var(--gold); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--gold); cursor: pointer; transition: all 0.2s; }
.ref-upload-btn:hover { border-color: var(--gold-dark); color: var(--gold-dark); background: var(--gold-light); }

/* 图片查看器 */
.img-viewer-toolbar { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px; background: var(--navy); border-radius: 8px 8px 0 0; }
.img-scale-text { color: var(--gold); font-size: 14px; font-weight: 700; min-width: 50px; text-align: center; }
.img-viewer-body { display: flex; align-items: center; justify-content: center; min-height: 400px; background: #111; overflow: hidden; cursor: zoom-in; }
.img-viewer-body img { max-width: 100%; max-height: 70vh; object-fit: contain; }

.sg-project-pills { display: flex; gap: 8px; flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--bg-300) transparent; padding-bottom: 4px; }
.sg-pill { font-size: 13px; padding: 6px 16px; border-radius: 18px; cursor: pointer; background: var(--bg-200); border: 1px solid var(--bg-300); color: var(--text-200); font-weight: 500; white-space: nowrap; transition: all 0.15s; user-select: none; }
.sg-pill:hover { border-color: var(--gold); color: var(--text-100); }
.sg-pill.active { background: var(--navy); border-color: var(--gold); color: var(--gold); font-weight: 700; }
.sg-project-pills::-webkit-scrollbar { height: 4px; }
.sg-project-pills::-webkit-scrollbar-thumb { background: var(--bg-300); border-radius: 2px; }
/* 移动端 Tab 导航 */
.sb-mobile-tabs { display: none; }
@media (max-width: 768px) {
  .sb-mobile-tabs { display: flex; gap: 0; margin-bottom: 8px; background: var(--bg-200); border-radius: 12px; padding: 4px; border: 1px solid var(--bg-300); flex-shrink: 0; }
  .smtab { flex: 1; text-align: center; padding: 0; border-radius: 10px; font-size: 0.875rem; font-weight: 600; color: var(--text-200); cursor: pointer; height: 44px; display: flex; align-items: center; justify-content: center; }
  .smtab.active { background: var(--navy); color: var(--gold); }

  .sb-body { flex-direction: column; gap: 0; overflow-y: auto; }
  .sb-body > div { flex: 1; min-height: 0; }
  .sb-left { width: 100%; max-height: none; overflow-y: visible; }
  .sb-center { width: 100%; flex: 1; }
  .sb-right { width: 100%; max-height: none; }

  .tl-track-row { flex-wrap: wrap; gap: 4px; }
}

/* 删除按钮 - 覆盖全局 disabled 样式 */
.btn-danger-delete { background: #e74c3c !important; border-color: #e74c3c !important; color: #fff !important; font-weight: 600 !important; }
.btn-danger-delete:hover { background: #c0392b !important; border-color: #c0392b !important; color: #fff !important; }
.btn-danger-delete.is-disabled { background: #ebc9c6 !important; border-color: #ebc9c6 !important; color: rgba(255,255,255,0.7) !important; }
</style>
