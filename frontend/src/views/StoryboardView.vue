<template>
  <div class="sb-root">
    <div class="sb-top">
      <div class="tb-left">
        <div class="sg-scroll-area">
            </div>
      </div>
      <div class="tb-right">
        <el-tooltip content="保存当前故事板到数据库" placement="bottom"><el-button size="small" @click="saveStoryboard" :loading="saving" class="tb-btn tb-btn-save">保存</el-button></el-tooltip>
        <el-tooltip content="从剧本重新生成分镜" placement="bottom"><el-button size="small" @click="handleAutoGenerate" :disabled="!currentScriptId" :loading="generating" class="tb-btn tb-btn-refresh">刷新故事板</el-button></el-tooltip>
        <el-tooltip content="删除当前故事板" placement="bottom"><el-button size="small" @click="deleteStoryboard" :disabled="!currentStoryboard" :loading="deletingSB" class="tb-btn tb-btn-delete">删除</el-button></el-tooltip>
        <el-tooltip content="导出" placement="bottom"><el-button size="small" @click="openExport" :disabled="!currentProjectId" class="tb-btn-icon"><Download size="14" fill="currentColor"/></el-button></el-tooltip>
        <el-tooltip content="导入" placement="bottom"><el-button size="small" @click="showImportDialog = true" :disabled="!currentStoryboard" class="tb-btn-icon"><Upload size="14" fill="currentColor"/></el-button></el-tooltip>
        <el-divider direction="vertical" style="margin:0 6px;height:20px" />
        <span style="font-size:11px;color:var(--text-200);white-space:nowrap">无字幕</span>
        <el-switch v-model="noSubtitles" size="small" />
        <el-tooltip content="开启后，生成的视频画面不会出现自动字幕、文字、水印" placement="bottom">
          <Help size="14" fill="var(--text-200)" style="cursor:help"/>
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
        <div class="panel-title"><Movie size="16" fill="var(--gold)"/> 剧集</div>
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
        <div class="timeline" v-if="currentStoryboard && currentStoryboard.shots">
          <div class="tl-header">
            <span class="tl-label"><Film size="16" fill="var(--gold)"/> 分镜时间线 ({{ currentStoryboard.shots.length }} 镜头)</span>
            <div class="tl-batch-btns">
              <el-tooltip content="为所有待定镜头批量生成图片" placement="bottom"><el-button size="small" @click="batchGenerateImages" :loading="batchGenning" class="tb-btn tb-btn-gen">批量生图</el-button></el-tooltip>
              <el-tooltip content="为所有待定镜头批量生成视频" placement="bottom"><el-button size="small" @click="batchGenerateVideos" :loading="batchGenningVideo" class="tb-btn tb-btn-gen">批量生视频</el-button></el-tooltip>
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
              <div v-if="showImgMentionMenu" class="mention-menu" :style="imgMentionMenuStyle">
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
              <div v-if="showMentionMenu" class="mention-menu" :style="mentionMenuStyle">
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
                <el-button size="small" type="warning" link @click="generateTimedStoryboard" :loading="genningTimedSB">AI智能时长</el-button>
              </div>
            </div>
          </div>
          <div class="right-section" style="display:flex;gap:8px;align-items:flex-end">
            <div style="flex:1">
              <label>时长设置 (秒) <span style="font-size:10px;color:var(--text-200);font-weight:400;letter-spacing:0">范围 4-15 秒</span></label>
              <el-input-number v-model="videoDuration" :min="4" :max="15" size="small" style="width:100%" @change="saveVideoDuration" />
            </div>
            <el-popover placement="bottom" :width="340" trigger="click">
              <template #reference>
                <el-button size="small"><SettingTwo theme="outline" size="14" fill="currentColor" /> 高级</el-button>
              </template>
              <div class="vp-pop">
                <div class="vp-pop-section">
                  <span class="vp-pop-title">视频比例</span>
                  <div class="vp-ratio-grid">
                    <div v-for="r in videoRatios" :key="r.value"
                      :class="['vp-ratio-item', { active: videoRatio === r.value }]"
                      @click="videoRatio = r.value" :title="r.label">
                      <div class="vp-ratio-icon" v-html="r.icon"></div>
                      <span class="vp-ratio-label">{{ r.label }}</span>
                    </div>
                  </div>
                </div>
                <div class="vp-pop-section">
                  <span class="vp-pop-title">分辨率</span>
                  <div class="vp-resolution-row">
                    <span v-for="r in videoResolutions" :key="r"
                      :class="['vp-res-item', { active: videoResolution === r, disabled: isResolutionLocked(r) }]"
                      @click="selectResolution(r)" :title="resolutionTooltip(r)">{{ r }}</span>
                  </div>
                </div>
                <div class="vp-pop-section">
                  <span class="vp-pop-title">视频模型</span>
                  <el-select v-model="selectedVideoModel" size="small" style="width:100%">
                    <el-option label="Seedance 2.0" value="doubao_video" />
                    <el-option label="Seedance 2.0 Fast" value="doubao_video_fast" />
                  </el-select>
                </div>
                <div class="vp-pop-section vp-pop-inline">
                  <div style="display:flex;align-items:center;gap:5px">
                    <span style="font-size:12px;color:var(--text-200);white-space:nowrap">禁用水印</span>
                    <el-switch v-model="videoNoWatermark" size="small" />
                  </div>
                  <div style="display:flex;align-items:center;gap:5px">
                    <span style="font-size:12px;color:var(--text-200);white-space:nowrap">生成音频</span>
                    <el-switch v-model="videoGenAudio" size="small" />
                  </div>
                </div>
              </div>
            </el-popover>
          </div>
          <div class="right-section">
            <el-button size="small" type="primary" style="width:100%" @click="generateVideoForShot" :loading="genningVideo" :disabled="!currentShot">生成视频</el-button>
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
          <label>参考图片 ({{ currentRefImages.length }}/9)</label>
          <div class="ref-imgs">
            <div v-for="(img, i) in currentRefImages" :key="i" class="ref-img-item">
              <img :src="img" />
              <span class="ref-img-del" @click="removeRefImage(i)">×</span>
            </div>
            <label v-if="currentRefImages.length < 9" class="ref-upload-btn">
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
    <el-dialog v-model="showExportDialog" :width="screenWidth < 768 ? '94%' : '520px'" destroy-on-close class="export-dialog">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <Download size="20" fill="var(--gold)"/>
          <span style="font-size:17px;font-weight:700;color:var(--text-100)">导出分镜</span>
        </div>
      </template>
      <div class="export-body">
        <div class="export-section">
          <div class="export-section-title"><Film size="14" fill="var(--navy)"/> 选择剧集</div>
          <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="全部剧集（不选=导出全部）">
            <el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" />
          </el-select>
          <div style="display:flex;gap:8px;margin-top:6px">
            <el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">全选</el-button>
            <el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">当前集</el-button>
            <el-button size="small" link @click="exportEpisodes = []">清空</el-button>
          </div>
        </div>
        <div class="export-section">
          <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 导出内容</div>
          <el-checkbox-group v-model="exportTypes">
            <el-checkbox value="script">剧本全文</el-checkbox>
            <el-checkbox value="shots">分镜全文</el-checkbox>
            <el-checkbox value="full_storyboard">故事板全文</el-checkbox>
          </el-checkbox-group>
        </div>
        <div class="export-section">
          <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 导出格式</div>
          <div class="export-format-cards">
            <div v-for="f in formatOptions" :key="f.value" :class="['ef-card',{active:exportFormat===f.value}]" @click="exportFormat=f.value">
              <div class="ef-card-icon" v-html="f.icon"></div>
              <div class="ef-card-label">{{ f.label }}</div>
              <div class="ef-card-hint">{{ f.hint }}</div>
            </div>
          </div>
        </div>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top:12px"><template #title>{{ formatHint }}</template></el-alert>
      <template #footer>
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0">
          <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 导出文件
        </el-button>
      </template>
    </el-dialog>

    <ImageLightbox v-model:visible="imgViewerVisible" :url="imgViewerSrc || ''" title="图片预览" />

    <!-- 导入弹窗 -->
    <el-dialog v-model="showImportDialog" title="导入分镜数据" width="600px" class="export-dialog">
      <div class="export-body">
        <div class="export-section">
          <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 数据格式</div>
          <el-radio-group v-model="importFormat">
            <el-radio value="csv">CSV（逗号分隔）</el-radio>
            <el-radio value="json">JSON（结构化数据）</el-radio>
          </el-radio-group>
          <div style="margin-top:10px">
            <el-upload :auto-upload="false" :show-file-list="false" accept=".csv,.json,.txt" @change="onImportFileChange">
              <el-button size="small">📁 选择文件上传</el-button>
            </el-upload>
          </div>
        </div>
        <div class="export-section">
          <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 粘贴数据</div>
          <el-input v-model="importText" type="textarea" :rows="14" placeholder="粘贴 CSV 或 JSON 数据到此处..." />
        </div>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top:12px">
        <template #title>
          CSV表头：镜头号,场景名称,景别,构图,运镜,灯光,时长,图像描述,角色名,台词,音效,备注,状态
          <br>JSON：数组格式 [{ shotNumber, shotType, imageDescription, ... }]
        </template>
      </el-alert>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!importText.trim()">
          <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 导入数据
        </el-button>
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
import { ref, reactive, watch, computed, nextTick, onMounted, onActivated, onUnmounted, inject } from 'vue';
const resetToScriptGenerate = inject('resetToScriptGenerate', () => {});
import { ElMessage, ElMessageBox } from 'element-plus';
import { Help, PictureOne, Video, Copy, Plus, Delete, Voice, Film, Pic, Time, List, SettingTwo, AlarmClock, Movie, MagicWand, Download, FolderOpen, Edit, Upload } from '@icon-park/vue-next';
import { useProjectStore } from '../stores/project';
import { useScriptStore } from '../stores/script';
import { useStoryboardStore } from '../stores/storyboard';
import { useAssetStore } from '../stores/asset';
import { storyboardAPI, assetAPI } from '../api';
import { ttsAPI, configAPI } from '../api';
import { buildShotsFromScenes } from '../components/promptBuilder';
import ImageLightbox from '../components/ImageLightbox.vue';
import ProjectSwitcher from '../components/ProjectSwitcher.vue';

const episodeBar = inject('wsEpisodeBar', null);


const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const storyboardStore = useStoryboardStore();
const assetStore = useAssetStore();

const currentProjectId = inject('currentProjectId');
const currentScriptId = ref('');
const currentStoryboard = ref(null);
const currentShot = ref(null);
const scripts = ref([]);
const generating = ref(false);
const deletingSB = ref(false);
const saving = ref(false);
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
const formatOptions = [
  { value:'pdf', label:'PDF', hint:'打印预览保存', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e74c3c"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zM16.5 13H15v-2h-1.5V7H15v2h1.5v1.5H15V13zM19 13h-1.5V7H19v6zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>' },
  { value:'markdown', label:'Markdown', hint:'Typora/VS Code', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#3498db"><path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19v-4.69l1.88 2.35 1.88-2.35v4.69h1.13V8.81h-1.13l-1.88 2.35-1.88-2.35H5.69v6.38h1.12zM15.73 15.19l2.62-3.19-2.62-3.19h1.51l1.87 2.31 1.87-2.31h1.51l-2.62 3.19 2.62 3.19h-1.51l-1.87-2.31-1.87 2.31h-1.51z"/></svg>' },
  { value:'csv', label:'CSV Excel', hint:'Excel/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#27ae60"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v-2H8v2zm0-4h2V8H8v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2z"/></svg>' },
  { value:'word', label:'Word', hint:'Word/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#2980b9"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2.5-4.5L10 13l1.5 2.5H13l-2-3 2-3h-1.5L10 11.5 8.5 9.5H7l2 3-2 3h1.5z"/></svg>' },
  { value:'json', label:'JSON', hint:'结构化数据', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#8e44ad"><path d="M5 3h2v2H5v5c0 1.1-.9 2-2 2v1c1.1 0 2 .9 2 2v5h2v2H5c-1.07 0-2-.94-2-2.03V17c0-1.1-.9-2-2-2v-1c1.1 0 2-.9 2-2V7c0-1.08.93-2 2-2zm14 0c1.07 0 2 .94 2 2.03V7c0 1.1.9 2 2 2v1c-1.1 0-2 .9-2 2v5.03c0 1.09-.93 2-2 2h-2v-2h2v-5c0-1.1.9-2 2-2V7c0-1.1-.9-2-2-2h-2V3h2z"/></svg>' },
  { value:'html', label:'HTML', hint:'浏览器打开', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e67e22"><path d="M12 18.177l-6.72-3.878-.9-8.12L12 2l7.62 4.179-.9 8.12L12 18.177zM4.86 6.556l.72 6.482L12 16.545l6.42-3.507.72-6.482L12 3.455 4.86 6.556zM11 13h2l-.3 3.5-1 .5-1-.5L11 13zm0-6h2l-.2 5H11.2L11 7z"/></svg>' },
  { value:'png', label:'PNG 图片', hint:'截图导出', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#16a085"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' },
];
const importText = ref('');
const importFormat = ref('csv');
const importing = ref(false);
const formatHint = computed(() => {
  const m = { pdf: 'PDF：打开打印预览，浏览器「另存为 PDF」保存', markdown: 'Markdown：下载 .md 文件，可用 Typora/VS Code 打开', csv: 'Excel/CSV：下载 .csv 文件，用 Excel/WPS 打开编辑', word: 'Word：下载 .doc 文件，用 Word/WPS 打开编辑', json: 'JSON：下载 .json 文件，结构化数据，可程序化处理', html: 'HTML：下载 .html 文件，浏览器直接打开查看', png: 'PNG：将导出内容渲染为高清截图下载，多集全选时可能需几秒' };
  return m[exportFormat.value] || '';
});
const shotPrompt = ref('');
const selectedModel = ref('doubao_image');
const selectedRefs = ref([]);
const rightTab = ref('draw');
const currentShotPrompt = ref('');
const currentVideoPrompt = ref('');
const videoDuration = ref(5);
const videoRatio = ref('9:16');
const videoResolutions = ['480p', '720p', '1080p'];

function isResolutionLocked(r) {
  return selectedVideoModel.value === 'doubao_video_fast' && r === '1080p';
}
function resolutionTooltip(r) {
  if (isResolutionLocked(r)) return 'Seedance Fast 不支持 1080p，最高 720p';
  return r;
}
function selectResolution(r) {
  if (isResolutionLocked(r)) return;
  videoResolution.value = r;
}
const videoRatios = [
  { label: '21:9', value: '21:9', icon: '<svg viewBox="0 0 42 18" width="28" height="12"><rect x="0" y="0" width="42" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { label: '16:9', value: '16:9', icon: '<svg viewBox="0 0 32 18" width="24" height="14"><rect x="0" y="0" width="32" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { label: '4:3', value: '4:3', icon: '<svg viewBox="0 0 24 18" width="20" height="15"><rect x="0" y="0" width="24" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { label: '1:1', value: '1:1', icon: '<svg viewBox="0 0 18 18" width="16" height="16"><rect x="0" y="0" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { label: '3:4', value: '3:4', icon: '<svg viewBox="0 0 18 24" width="15" height="20"><rect x="0" y="0" width="18" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
  { label: '9:16', value: '9:16', icon: '<svg viewBox="0 0 18 32" width="14" height="24"><rect x="0" y="0" width="18" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
];
const videoResolution = ref('720p');
const videoNoWatermark = ref(true);
const videoGenAudio = ref(true);
const selectedVideoModel = ref('doubao_video');
const currentRefImages = ref([]);
const tlTrack = ref(null);
const videoPromptRef = ref(null);
const promptEditorWrap = ref(null);
const mentionMenuStyle = ref({ top: 'auto', left: '8px' });

// ===== 图片提示词编辑器（复用同一个 mention 系统）=====
const imgPromptRef = ref(null);
const imgPromptEditorWrap = ref(null);
const showImgMentionMenu = ref(false);
const imgEditorHasContent = ref(false);
const imgEditorCharCount = ref(0);
const imgMentionMenuStyle = ref({ top: 'auto', left: '8px' });
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
  updateMentionMenuPos(menuRef === showImgMentionMenu ? imgMentionMenuStyle : mentionMenuStyle, editor, atIdx, offset);
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
    const colors = getMentionColors(name);
    html += '<span class="mention-tag" contenteditable="false" data-name="'+name+'" style="background:'+colors.bg+';color:'+colors.color+'">@'+name+'</span>';
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
  updateMentionMenuPos(mentionMenuStyle, el(), atIdx, offset);
}

// 根据 @ 符号位置动态计算提及菜单坐标
function updateMentionMenuPos(styleRef, editor, atIdx, offset) {
  if (!editor) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0).cloneRange();
  const node = sel.focusNode;
  if (node && node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, Math.max(0, atIdx));
    range.collapse(true);
  }
  const caretRect = range.getBoundingClientRect();
  const wrap = editor.parentElement;
  if (!wrap) return;
  const wrapRect = wrap.getBoundingClientRect();
  const atLeft = caretRect.left - wrapRect.left;
  // 当 @ 在编辑器右半边时，弹窗右对齐防止溢出
  if (atLeft > wrapRect.width * 0.55) {
    styleRef.value = { top: (caretRect.bottom - wrapRect.top + 4) + 'px', right: '4px', left: 'auto' };
  } else {
    styleRef.value = { top: (caretRect.bottom - wrapRect.top + 4) + 'px', left: atLeft + 'px' };
  }
}

function onPromptClick() { checkMentionTrigger(); }

// 根据是否有参考图返回对应的 tag 颜色
function getMentionColors(name) {
  const c = assetStore.characters.find(x => x.name === name);
  const s = assetStore.scenes.find(x => x.sceneName === name);
  const asset = c || s;
  const hasImg = asset ? !!getRefUrl(asset) : false;
  if (s && !c) {
    // 场景：有图=蓝色，无图=灰色
    return hasImg
      ? { bg: '#e2f3f5', color: '#02adb5' }
      : { bg: '#f0f0f0', color: '#999' };
  }
  // 角色：有图=金色，无图=灰色
  return hasImg
    ? { bg: 'rgba(201,168,76,0.2)', color: 'var(--gold-dark)' }
    : { bg: '#f0f0f0', color: '#999' };
}

// 候选项
const mentionOptions = computed(() => {
  const q = mentionQuery.value.toLowerCase();
  const list = [];
  assetStore.characters.forEach(c => {
    if (!q || c.name?.toLowerCase().includes(q)) {
      const url = getRefUrl(c);
      const colors = getMentionColors(c.name);
      list.push({ id: c._id, name: c.name, type: '角色', chip: '@'+c.name, bg: colors.bg, color: colors.color, url: url || '', appearance: c.appearance || '' });
    }
  });
  assetStore.scenes.forEach(s => {
    if (!q || s.sceneName?.toLowerCase().includes(q)) {
      const url = getRefUrl(s);
      const colors = getMentionColors(s.sceneName);
      list.push({ id: s._id, name: s.sceneName, type: '场景', chip: '@'+s.sceneName, bg: colors.bg, color: colors.color, url: url || '', appearance: s.description || s.stylePrompt || '' });
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
    const colors = getMentionColors(char.name);
    insertMention({ id: rc.id, name: rc.name, type: '角色', chip: rc.tag, bg: colors.bg, color: colors.color, url: getRefUrl(char) || '', appearance: rc.hint || '' });
    return;
  }
  const scene = assetStore.scenes.find(x => x._id === rc.id);
  if (scene) {
    const colors = getMentionColors(scene.sceneName);
    insertMention({ id: rc.id, name: rc.name, type: '场景', chip: rc.tag, bg: colors.bg, color: colors.color, url: getRefUrl(scene) || '', appearance: scene.description || scene.stylePrompt || '' });
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
    const colors = getMentionColors(name);
    html += `<span class="mention-tag" contenteditable="false" data-name="${name}" style="background:${colors.bg};color:${colors.color}">@${name}</span>`;
    last = re.lastIndex;
  }
  html += (text.substring(last)).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  editor.innerHTML = html;
  onPromptInput();
}

// ===== 图片提示词也同样的编辑器（省略，保留 textarea） =====

watch(noSubtitles, saveNoSubtitles);


// 监听顶栏切片场
watch(currentProjectId, (n, o) => { if (n && n !== o) { currentProjectId.value = n; onProjectChange(n); } });
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

async function onProjectChange(val) {
  currentScriptId.value = ''; currentStoryboard.value = null; currentShot.value = null;
  if (val) {
    await Promise.all([
      scriptStore.fetchScripts(val),
      storyboardStore.fetchStoryboards({ projectId: val }),
    ]);
    scripts.value = [...scriptStore.scripts];
    if (scripts.value.length > 0) { currentScriptId.value = scripts.value[0]._id; onScriptChange(scripts.value[0]._id); }
    syncEpisodeBar();
    assetStore.fetchCharacters(val);
    assetStore.fetchScenes(val);
  }
}
function onScriptChange(val) {
  if (val) {
    const existing = storyboardStore.storyboards.find(s => (s.scriptId?._id || s.scriptId) === val);
    currentStoryboard.value = existing ? JSON.parse(JSON.stringify(existing)) : null;
    currentShot.value = currentStoryboard.value?.shots?.[0] || null;
    updatePrompt();
    syncEpisodeBar();
  }
}
function syncEpisodeBar(){if(!episodeBar)return;episodeBar.scripts=scripts.value;episodeBar.currentScriptId=currentScriptId.value;episodeBar.select=onScriptChange;episodeBar.add=null;episodeBar.dup=null;}
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
        if (old._refImages?.length) newShot._refImages = [...old._refImages];
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
    const idx = storyboardStore.storyboards.findIndex(s => (s.scriptId?._id || s.scriptId) === currentScriptId.value);
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

async function saveStoryboard() {
  if (!currentStoryboard.value?._id) { ElMessage.warning('请先生成故事板'); return; }
  saving.value = true;
  try {
    const token = localStorage.getItem('token');
    await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shots: currentStoryboard.value.shots }),
    });
    ElMessage.success('故事板已保存');
  } catch (e) { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
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

// 时间线横向滚轮 — 用原生 listener 绕过 passive 问题
watch(tlTrack, (el, _, onCleanup) => {
  if (!el) return;
  const handler = (e) => {
    e.preventDefault();
    if (el.scrollWidth <= el.clientWidth) return;
    el.scrollBy({ left: (e.deltaY || e.deltaX || 0) * 1.5, behavior: 'auto' });
  };
  el.addEventListener('wheel', handler, { passive: false });
  onCleanup(() => el.removeEventListener('wheel', handler));
}, { flush: 'post' });

async function onRefImageUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  // 限制单次最多9张
  const remaining = 9 - currentRefImages.value.length;
  if (remaining <= 0) { ElMessage.warning('最多上传9张参考图'); e.target.value = ''; return; }
  const toUpload = Array.from(files).slice(0, remaining);
  try {
    const res = await assetAPI.uploadReferenceFiles(toUpload);
    if (res.data?.urls) {
      currentRefImages.value.push(...res.data.urls);
      if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
      ElMessage.success(`已上传${res.data.urls.length}张参考图`);
    }
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message || ''));
  }
  e.target.value = '';
}

async function removeRefImage(i) {
  const url = currentRefImages.value[i];
  // 服务端参考图：调接口删除文件
  if (url && url.startsWith('/uploads/references/')) {
    try { await assetAPI.deleteReferenceFile(url); } catch {}
  }
  currentRefImages.value.splice(i, 1);
  if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
}

const imgViewerVisible = ref(false);
const imgViewerSrc = ref('');

function openVideoPreview(url) {
  if (!url) return;
  window.open(url, '_blank');
}
function openImgViewer(src) {
  if (!src) return;
  imgViewerSrc.value = src;
  imgViewerVisible.value = true;
}

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
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt: batchPrompt, model: selectedVideoModel.value, inputImage: s.renderedImage || '', referenceImages: refUrls, duration: s.duration || 5, ratio: videoRatio.value, resolution: videoResolution.value, watermark: !videoNoWatermark.value, generateAudio: videoGenAudio.value })
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
      nextTick(() => renderEditor(data.data.prompt));
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
      nextTick(() => renderEditor(data.data.prompt));
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
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt: finalPrompt, model: selectedVideoModel.value, inputImage, referenceImages: refUrls, duration: videoDuration.value, ratio: videoRatio.value, resolution: videoResolution.value, watermark: !videoNoWatermark.value, generateAudio: videoGenAudio.value })
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
  if (exportTypes.value.length === 0) return;
  const fmt = exportFormat.value;
  showExportDialog.value = false;
  try {
    const res = await fetch('/api/v1/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({
        projectId: currentProjectId.value,
        episodeIds: exportEpisodes.value,
        types: exportTypes.value,
        format: fmt === 'png' ? 'html' : fmt,
      }),
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '生成失败'); return; }

    if (fmt === 'pdf') {
      // PDF: 打开打印窗口
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(data.html); w.document.close(); setTimeout(() => w.print(), 500); }
    } else if (fmt === 'html') {
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename + '.html';
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('下载完成');
    } else if (fmt === 'png') {
      await exportAsPng(data.html, data.filename);
    } else {
      const ext = { markdown: 'md', csv: 'csv', word: 'doc', json: 'json' }[fmt] || 'txt';
      const mime = { markdown: 'text/markdown', csv: 'text/csv', word: 'application/msword', json: 'application/json' }[fmt] || 'text/plain';
      const blob = new Blob([data.content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename + '.' + ext;
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('下载完成');
    }
  } catch (e) { ElMessage.error('导出失败'); }
}

async function exportAsPng(html, filename) {
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:820px;height:0;border:0;';
  document.body.appendChild(iframe);
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  await new Promise(function(r) { setTimeout(r, 600); });
  try {
    var html2canvas = (await import('html2canvas')).default;
    var canvas = await html2canvas(doc.body, {
      scale: 2, useCORS: true, backgroundColor: '#FBF7F0',
      windowWidth: 820, windowHeight: doc.body.scrollHeight,
    });
    canvas.toBlob(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename + '.png';
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('PNG 导出完成');
    }, 'image/png');
  } catch (e) { ElMessage.error('PNG 截图失败'); }
  finally { document.body.removeChild(iframe); }
}

function onImportFileChange(uploadFile) {
  var file = uploadFile && uploadFile.raw;
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    importText.value = e.target.result || '';
    var name = file.name.toLowerCase();
    if (name.endsWith('.json')) importFormat.value = 'json';
    else if (name.endsWith('.csv')) importFormat.value = 'csv';
  };
  reader.readAsText(file, 'utf-8');
}

async function handleImport() {
  if (!currentStoryboard.value || !importText.value.trim()) return;
  importing.value = true;
  const text = importText.value.trim();
  const format = importFormat.value;
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
/* ===== CINEMATIC SUITE — 全面美化 ===== */

.sb-root {
  display: flex; flex-direction: column; height: calc(100vh - 48px);
  background: radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 60%),
              linear-gradient(180deg, var(--bg-100) 0%, #f3efe7 100%);
}

/* ===== TOP BAR ===== */
.sb-top {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px; flex-shrink: 0; gap: 8px;
  padding: 6px 12px;
  background: var(--bg-200); border: 1px solid var(--bg-300);
  border-radius: 8px;
}
.tb-left {
  display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
}
.tb-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; flex-wrap: wrap; }

/* 项目胶囊滚动区域 — 右侧渐变暗示可滚动 */
.sg-scroll-area {
  position: relative; flex: 1; min-width: 0; overflow: hidden;
}
.sg-scroll-area::after {
  content: ''; position: absolute; right: 0; top: 0; bottom: 0;
  width: 40px; pointer-events: none; z-index: 2;
  background: linear-gradient(90deg, transparent, rgba(251,247,240,0.85));
  border-radius: 0 4px 4px 0;
  opacity: 0; transition: opacity 0.3s;
}
.sg-scroll-area:hover::after,
.sg-scroll-area:has(.sg-project-pills:hover)::after,
.sg-scroll-area:focus-within::after { opacity: 1; }
.sg-script-wrap { flex-shrink: 0; }

/* ===== BODY ===== */
.sb-body { display: flex; flex: 1; gap: 14px; overflow: hidden; min-height: 0; }

/* ===== LEFT: Episode List ===== */
.sb-left {
  width: 178px; flex-shrink: 0;
  background: linear-gradient(180deg, rgba(255,253,249,0.9) 0%, rgba(251,247,240,0.85) 100%);
  border-radius: 14px; border: 1px solid rgba(201,168,76,0.15);
  box-shadow: 0 2px 20px rgba(139,105,20,0.06);
  overflow-y: auto; padding: 14px 10px;
  backdrop-filter: blur(6px);
}
.panel-title {
  font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700;
  color: var(--text-100); margin-bottom: 10px; padding: 0 4px 10px;
  border-bottom: 2px solid var(--gold); letter-spacing: 1.5px;
  display: flex; align-items: center; gap: 6px;
}
.ep-list { display: flex; flex-direction: column; gap: 4px; }
.ep-item {
  padding: 10px 12px; border-radius: 10px; cursor: pointer;
  display: flex; flex-direction: column; gap: 3px;
  border-left: 3px solid transparent;
  transition: all 0.3s cubic-bezier(0.22,0.61,0.36,1);
  position: relative; overflow: hidden;
}
.ep-item::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(201,168,76,0.04) 100%);
  opacity: 0; transition: opacity 0.3s;
}
.ep-item:hover { background: rgba(201,168,76,0.06); border-left-color: rgba(201,168,76,0.4); }
.ep-item:hover::after { opacity: 1; }
.ep-item.active {
  background: linear-gradient(135deg, rgba(26,26,46,0.06) 0%, rgba(201,168,76,0.08) 100%);
  border-left-color: var(--gold);
  box-shadow: inset 0 0 0 1px rgba(201,168,76,0.15);
}
.ep-item.active .ep-num { color: var(--gold-dark) !important; font-weight: 800; }
.ep-item.active .ep-name { color: var(--text-100) !important; }
.ep-num { color: var(--text-100); font-size: 13px; font-weight: 600; letter-spacing: 0.5px; }
.ep-name { color: var(--text-200); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== CENTER: Preview + Timeline ===== */
.sb-center { flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0; }

/* Preview — 增强电影感 */
.preview-area {
  background: linear-gradient(135deg, #f8f6f0 0%, #ede8dc 50%, #f0ece3 100%);
  border-radius: 16px;
  border: 2px solid rgba(201,168,76,0.15);
  flex: 1; display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
  box-shadow: inset 0 0 60px rgba(139,105,20,0.04), 0 4px 24px rgba(0,0,0,0.05);
}
.preview-area::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.08) 100%);
  pointer-events: none; z-index: 1;
}
.preview-empty { text-align: center; color: #8b7355; position: relative; z-index: 2; }
.preview-empty p { margin-top: 12px; font-size: 14px; color: #8b7355; opacity: 0.6; letter-spacing: 1px; }
.preview-shot { text-align: center; width: 100%; position: relative; z-index: 2; }
.preview-frame {
  height: 260px; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.02); border-radius: 10px; margin: 0 16px;
  position: relative;
}
.preview-info {
  display: flex; gap: 10px; justify-content: center; padding: 10px;
  font-size: 12px;
}
.pi-tag {
  background: linear-gradient(135deg, var(--gold) 0%, #b8943a 100%);
  color: #fff; padding: 4px 12px;
  border-radius: 4px; font-size: 11px; font-weight: 700;
  letter-spacing: 1.5px; box-shadow: 0 2px 6px rgba(201,168,76,0.3);
}
.preview-dialogue {
  padding: 12px 20px; color: #6b5e47; font-size: 13px;
  background: rgba(201,168,76,0.06); border-top: 1px solid rgba(201,168,76,0.15);
  font-style: italic; letter-spacing: 0.3px;
}

/* Timeline — 卡片升级 */
.timeline {
  background: rgba(255,253,249,0.8);
  border-radius: 14px; border: 1px solid rgba(201,168,76,0.12);
  padding: 14px; flex-shrink: 0;
  box-shadow: 0 2px 16px rgba(139,105,20,0.04);
  backdrop-filter: blur(6px);
}
.tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.tl-label {
  font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700;
  color: var(--text-100); letter-spacing: 1px;
  display: flex; align-items: center; gap: 6px;
}
.tl-batch-btns { display: flex; gap: 4px; }
.tl-track { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; align-items: flex-start; }
.tl-track::-webkit-scrollbar { height: 5px; }
.tl-track::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 3px; }
.tl-track::-webkit-scrollbar-track { background: rgba(201,168,76,0.06); border-radius: 3px; }

.tl-card {
  flex-shrink: 0; width: 128px; border-radius: 10px;
  border: 2px solid rgba(232,213,196,0.5);
  background: linear-gradient(180deg, var(--bg-200) 0%, rgba(251,247,240,0.9) 100%);
  transition: all 0.3s cubic-bezier(0.22,0.61,0.36,1); overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}
.tl-card:hover {
  border-color: var(--gold); transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(201,168,76,0.18);
}
.tl-active {
  border-color: var(--gold) !important;
  box-shadow: 0 0 0 3px rgba(201,168,76,0.25), 0 4px 16px rgba(201,168,76,0.15) !important;
}
.tl-card-header {
  display: flex; justify-content: space-between; padding: 6px 10px;
  background: linear-gradient(180deg, rgba(26,26,46,0.04) 0%, transparent 100%);
  border-bottom: 1px solid rgba(232,213,196,0.4);
}
.tl-shot-num { font-size: 11px; font-weight: 700; color: var(--text-100); letter-spacing: 0.5px; }
.tl-shot-dur { font-size: 10px; color: var(--gold-dark); font-weight: 700; }
.tl-img { width: 100%; height: 72px; background: var(--navy); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
.tl-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.tl-card:hover .tl-img img { transform: scale(1.05); }
.tl-placeholder { color: var(--gold); font-size: 12px; opacity: 0.4; letter-spacing: 1px; }
.tl-meta { display: flex; justify-content: space-between; padding: 4px 10px 0; font-size: 10px; cursor: pointer; }
.tl-desc { padding: 3px 10px 0; font-size: 10px; color: var(--text-200); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.tl-type { color: var(--gold-dark); font-weight: 600; letter-spacing: 0.5px; }

.tl-insert {
  flex-shrink: 0; width: 24px; height: 70px; border-radius: 6px;
  background: rgba(251,247,240,0.7); border: 1.5px dashed rgba(201,168,76,0.4);
  color: var(--gold); display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; cursor: pointer;
  transition: all 0.25s; align-self: center;
}
.tl-insert:hover { border-color: var(--gold); color: var(--navy); background: var(--gold); }
.tl-insert-end { height: 150px; }
.tl-card-end { cursor: pointer; opacity: 0.45; flex-shrink: 0; width: 128px; }
.tl-card-end:hover { opacity: 1; border-color: var(--gold); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(201,168,76,0.12); }
.tl-img-add { cursor: pointer !important; }
.tl-add-icon { font-size: 40px; color: var(--gold); line-height: 1; opacity: 0.35; transition: all 0.3s; }
.tl-card-end:hover .tl-add-icon { opacity: 1; color: var(--gold-dark); }
.tl-meta-end { padding: 4px 10px 0; font-size: 10px; text-align: center; font-weight: 600; color: var(--text-200); }
.tl-actions-end { display: flex; justify-content: center; align-items: center; padding: 4px 2px; border-top: 1px solid rgba(232,213,196,0.3); height: 28px; }

.tl-actions { display: flex; justify-content: center; gap: 3px; padding: 5px 2px; border-top: 1px solid rgba(232,213,196,0.3); height: 28px; align-items: center; }
.tl-btn {
  width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 11px; color: var(--text-200);
  transition: all 0.2s cubic-bezier(0.22,0.61,0.36,1); position: relative;
}
.tl-btn:hover { background: var(--gold); color: #fff; transform: scale(1.1); }
.tl-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

/* ===== RIGHT: Image/Video Panel ===== */
.sb-right {
  width: 262px; flex-shrink: 0;
  background: linear-gradient(180deg, rgba(255,253,249,0.92) 0%, rgba(251,247,240,0.85) 100%);
  border-radius: 14px; border: 1px solid rgba(201,168,76,0.15);
  padding: 14px; overflow-y: auto;
  box-shadow: 0 2px 20px rgba(139,105,20,0.06);
  backdrop-filter: blur(6px);
}
.tab-switch {
  display: flex; margin-bottom: 14px; border-radius: 8px; overflow: hidden;
  border: 1.5px solid var(--gold);
  box-shadow: 0 2px 6px rgba(201,168,76,0.1);
}
.tab-btn {
  flex: 1; text-align: center; padding: 9px 0; font-size: 12px; font-weight: 700;
  cursor: pointer; background: rgba(251,247,240,0.5); color: var(--text-200);
  letter-spacing: 1.5px; transition: all 0.3s cubic-bezier(0.22,0.61,0.36,1);
  text-transform: uppercase;
}
.tab-btn.active {
  background: linear-gradient(135deg, var(--navy) 0%, #252540 100%);
  color: var(--gold);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}

/* Section 金线分割 */
.right-section {
  margin-bottom: 14px; padding-bottom: 14px;
  border-bottom: 1px solid rgba(201,168,76,0.1);
}
.right-section:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
.right-section > label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--text-100);
  margin-bottom: 8px; letter-spacing: 1.5px; text-transform: uppercase;
}
.right-section > label::before {
  content: ''; width: 4px; height: 14px; border-radius: 2px;
  background: var(--gold); display: inline-block;
}

.char-count { font-size: 10px; color: var(--text-200); font-weight: 500; }
.ref-chars { display: flex; flex-wrap: wrap; gap: 6px; }
.ref-chip {
  padding: 5px 12px; border-radius: 6px; background: rgba(251,247,240,0.7);
  font-size: 11px; cursor: pointer; border: 1.5px solid var(--bg-300);
  color: var(--text-200); font-weight: 500;
  transition: all 0.25s cubic-bezier(0.22,0.61,0.36,1);
  backdrop-filter: blur(4px);
}
.ref-chip:hover { border-color: var(--gold); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(201,168,76,0.1); }
.ref-chip.active {
  background: linear-gradient(135deg, rgba(26,26,46,0.08) 0%, rgba(201,168,76,0.1) 100%);
  border-color: var(--gold); color: var(--gold-dark) !important; font-weight: 700;
}
.ref-chip.has-img { border-color: rgba(201,168,76,0.4); }
.ref-chip:not(.has-img) { opacity: 0.55; }

/* 素材网格 */
.mat-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.mat-item {
  width: 58px; height: 58px; border-radius: 8px; overflow: hidden; cursor: pointer;
  position: relative; background: var(--navy); border: 1.5px solid var(--bg-300);
  transition: all 0.25s cubic-bezier(0.22,0.61,0.36,1);
}
.mat-item:hover { border-color: var(--gold); transform: scale(1.06); z-index: 2; }
.mat-item img { width: 100%; height: 100%; object-fit: cover; }
.mat-num { position: absolute; bottom: 2px; right: 3px; font-size: 9px; color: var(--gold); background: rgba(26,26,46,0.85); padding: 1px 5px; border-radius: 3px; font-weight: 600; }
.mat-ver { position: absolute; top: 3px; left: 3px; font-size: 9px; color: var(--gold); background: rgba(26,26,46,0.85); padding: 1px 4px; border-radius: 3px; font-weight: 600; }
.mat-set { position: absolute; top: 3px; right: 3px; font-size: 12px; color: var(--gold); cursor: pointer; opacity: 0; transition: opacity 0.2s; }
.mat-item:hover .mat-set { opacity: 1; }
.mat-active { border-color: var(--gold) !important; box-shadow: 0 0 0 2px rgba(201,168,76,0.35); }
.mat-video-preview { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.mat-play-icon { font-size: 18px; color: var(--gold); }
.mat-type { position: absolute; bottom: 2px; left: 3px; font-size: 10px; }

/* 参考图片上传 */
.ref-imgs { display: flex; flex-wrap: wrap; gap: 7px; }
.ref-img-item {
  width: 58px; height: 58px; border-radius: 8px; overflow: hidden;
  position: relative; background: var(--bg-100);
  border: 1.5px solid rgba(201,168,76,0.2);
  transition: all 0.2s;
}
.ref-img-item:hover { border-color: var(--gold); transform: scale(1.05); }
.ref-img-item img { width: 100%; height: 100%; object-fit: cover; }
.ref-img-del {
  position: absolute; top: 2px; right: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(200,60,60,0.85); color: #fff;
  font-size: 12px; line-height: 18px; text-align: center;
  cursor: pointer; font-weight: 700; opacity: 0;
  transition: all 0.2s;
}
.ref-img-item:hover .ref-img-del { opacity: 1; }
.ref-img-del:hover { background: #e74c3c; transform: scale(1.15); }
.ref-upload-btn {
  width: 58px; height: 58px; border-radius: 8px;
  border: 2px dashed rgba(201,168,76,0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--gold); cursor: pointer;
  font-weight: 600;
  transition: all 0.25s cubic-bezier(0.22,0.61,0.36,1);
  background: rgba(201,168,76,0.03);
}
.ref-upload-btn:hover {
  border-color: var(--gold); color: var(--navy);
  background: rgba(201,168,76,0.12); transform: scale(1.04);
}

/* ===== 提示词编辑器 ===== */
.prompt-editor-wrap { position: relative; }
.prompt-editor {
  min-height: 88px; max-height: 260px; overflow-y: auto;
  padding: 10px 14px; border: 1.5px solid var(--bg-300); border-radius: 8px;
  background: rgba(251,247,240,0.6); font-family: 'DM Sans','Microsoft YaHei',monospace;
  font-size: 13px; line-height: 1.7; color: var(--text-100);
  outline: none; cursor: text; word-break: break-word;
  transition: all 0.25s;
}
.prompt-editor:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
  background: rgba(251,247,240,0.9);
}
.seedance-marquee {
  overflow: hidden; white-space: nowrap; width: 100%;
  padding: 7px 0 7px 14px;
  background: linear-gradient(90deg, rgba(201,168,76,0.08) 0%, rgba(251,247,240,0.3) 100%);
  border-radius: 8px; margin-bottom: 12px;
  font-size: 11px; color: var(--text-200); cursor: default;
  border: 1px solid rgba(201,168,76,0.08);
}
.seedance-marquee-text { display: none; }
.seedance-marquee-inner { white-space: nowrap; display: flex; }
.seedance-marquee-dupe {
  display: inline-block; flex-shrink: 0; white-space: nowrap;
  animation: seedance-marquee-scroll 25s linear infinite;
  padding-right: 48px;
}
.seedance-marquee:hover .seedance-marquee-dupe { animation-play-state: paused; }
@keyframes seedance-marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

.prompt-editor-ph {
  position: absolute; top: 11px; left: 14px; color: var(--text-200);
  font-size: 13px; pointer-events: none; opacity: 0.6;
  font-family: 'DM Sans','Microsoft YaHei',monospace;
}

/* mention */
.mention-tag {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  font-size: 12px; font-weight: 600; line-height: 1.5; cursor: default;
  user-select: all; margin: 0 1px; border-bottom: 2px solid rgba(0,0,0,0.1);
}
.mention-menu {
  position: absolute; z-index: 200;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.12); max-height: 220px; overflow-y: auto;
  max-width: min(320px, calc(100% - 8px)); padding: 4px 0;
  min-width: 140px;
}
.mention-item { display: flex; align-items: center; gap: 8px; padding: 7px 12px; cursor: pointer; font-size: 13px; transition: background 0.12s; overflow: hidden; }
.mention-item:hover { background: var(--accent-200); }
.mention-chip { padding: 1px 7px; border-radius: 3px; font-size: 11px; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
.mention-name { flex: 1; color: var(--text-100); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mention-type { font-size: 10px; color: var(--text-200); flex-shrink: 0; }
.mention-empty { padding: 10px 14px; color: var(--text-200); font-size: 12px; }

/* prompt chips */
.prompt-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0; }
.prompt-chip {
  padding: 3px 12px; font-size: 11px; cursor: pointer; user-select: none;
  border: 1.5px solid rgba(201,168,76,0.4); color: var(--gold-dark);
  background: rgba(201,168,76,0.06); border-radius: 6px; font-weight: 600;
  transition: all 0.2s; font-family: 'DM Sans', 'Microsoft YaHei', sans-serif;
}
.prompt-chip:hover { background: var(--gold); color: #fff; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(201,168,76,0.25); }

/* prompt preview */
.prompt-preview { padding: 6px 0; font-size: 12px; line-height: 1.6; color: var(--text-200); }
.prompt-preview mark {
  background: rgba(201,168,76,0.2); color: var(--gold-dark); border-radius: 3px;
  padding: 1px 3px; font-weight: 600; border-bottom: 2px solid var(--gold);
}

/* ===== 图片查看器 ===== */
.img-viewer-toolbar {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 12px; background: linear-gradient(180deg, var(--navy) 0%, #1a1a30 100%);
  border-radius: 10px 10px 0 0;
}
.img-scale-text { color: var(--gold); font-size: 15px; font-weight: 700; min-width: 55px; text-align: center; }
.img-viewer-body {
  display: flex; align-items: center; justify-content: center; min-height: 420px;
  background: #0a0a14; overflow: hidden; border-radius: 0 0 10px 10px;
}
.img-viewer-body img { max-width: 100%; max-height: 70vh; object-fit: contain; }

/* ===== 视频高级参数 popover ===== */
.vp-pop { display: flex; flex-direction: column; gap: 14px; }
.vp-pop-section { display: flex; flex-direction: column; gap: 6px; }
.vp-pop-inline { flex-direction: row !important; justify-content: space-between; align-items: center; gap: 8px; }
.vp-pop-title { font-size: 11px; font-weight: 700; color: var(--text-200); text-transform: uppercase; letter-spacing: 1px; }
.vp-ratio-grid { display: flex; gap: 6px; flex-wrap: wrap; }
.vp-ratio-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 5px 8px; border-radius: 8px; cursor: pointer;
  border: 1.5px solid var(--bg-300); color: var(--text-200);
  transition: all 0.2s; min-width: 46px;
}
.vp-ratio-item:hover { border-color: var(--gold); color: var(--gold); }
.vp-ratio-item.active { border-color: var(--gold); background: rgba(201,168,76,0.1); color: var(--gold); font-weight: 700; }
.vp-ratio-icon { display: flex; align-items: center; justify-content: center; }
.vp-ratio-label { font-size: 10px; font-weight: 600; }
.vp-resolution-row { display: flex; gap: 5px; flex-wrap: wrap; }
.vp-res-item {
  padding: 4px 14px; border-radius: 8px; cursor: pointer;
  border: 1.5px solid var(--bg-300); color: var(--text-200);
  font-size: 12px; font-weight: 600; transition: all 0.2s;
}
.vp-res-item:hover { border-color: var(--gold); color: var(--gold); }
.vp-res-item.active { border-color: var(--gold); background: rgba(201,168,76,0.1); color: var(--gold); }
.vp-res-item.disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }

/* ===== 移动端 ===== */
.sb-mobile-tabs { display: none; }
@media (max-width: 768px) {
  .sb-mobile-tabs {
    display: flex; gap: 0; margin-bottom: 8px;
    background: rgba(255,253,249,0.8); border-radius: 14px; padding: 4px;
    border: 1px solid rgba(201,168,76,0.15); flex-shrink: 0; backdrop-filter: blur(6px);
  }
  .smtab {
    flex: 1; text-align: center; padding: 0; border-radius: 12px;
    font-size: 0.875rem; font-weight: 600; color: var(--text-200);
    cursor: pointer; height: 44px; display: flex; align-items: center; justify-content: center;
    gap: 4px;
  }
  .smtab.active { background: var(--navy); color: var(--gold); }

  .sb-body { flex-direction: column; gap: 0; overflow-y: auto; }
  .sb-body > div { flex: 1; min-height: 0; }
  .sb-left { width: 100%; max-height: none; overflow-y: visible; }
  .sb-center { width: 100%; flex: 1; }
  .sb-right { width: 100%; max-height: none; }
}

/* ===== 删除按钮 ===== */
.btn-danger-delete { background: #e74c3c !important; border-color: #e74c3c !important; color: #fff !important; font-weight: 600 !important; }
.btn-danger-delete:hover { background: #c0392b !important; border-color: #c0392b !important; color: #fff !important; }
.btn-danger-delete.is-disabled { background: #ebc9c6 !important; border-color: #ebc9c6 !important; color: rgba(255,255,255,0.7) !important; }

/* ===== 工具栏按钮 ===== */
.tb-btn { font-size: 11px !important; padding: 5px 12px !important; font-weight: 600; }
.tb-btn-refresh { color: var(--gold-dark) !important; border-color: var(--gold) !important; background: var(--bg-200) !important; }
.tb-btn-refresh:hover { background: var(--gold) !important; color: #fff !important; border-color: var(--gold) !important; }
.tb-btn-save { color: var(--gold-dark) !important; border-color: var(--gold) !important; background: var(--bg-200) !important; }
.tb-btn-save:hover { background: var(--gold) !important; color: #fff !important; border-color: var(--gold) !important; }
.tb-btn-delete { color: var(--text-200) !important; border-color: var(--bg-300) !important; background: var(--bg-200) !important; }
.tb-btn-delete:hover { color: #c44545 !important; border-color: #c44545 !important; background: rgba(196,69,69,0.04) !important; }
.tb-btn-gen { color: var(--gold-dark) !important; border-color: var(--gold) !important; font-size: 11px !important; padding: 5px 12px !important; font-weight: 600; background: var(--bg-200) !important; }
.tb-btn-gen:hover { background: var(--gold-light) !important; border-color: var(--gold) !important; color: var(--navy) !important; }
.tb-btn-icon { width: 30px !important; height: 30px !important; padding: 0 !important; border-radius: 6px !important; border-color: var(--bg-300) !important; color: var(--text-200) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; background: var(--bg-200) !important; }
.tb-btn-icon:hover { border-color: var(--gold) !important; color: var(--gold-dark) !important; background: var(--bg-100) !important; }

/* ===== 面包屑 ===== */
.breadcrumb { padding: 4px 0 8px; flex-shrink: 0; }
</style>

<style>
/* ===== 导出/导入对话框 ===== */
.export-dialog .el-dialog__header { padding-bottom: 8px; border-bottom: 1px solid var(--bg-300); }
.export-body { display: flex; flex-direction: column; gap: 16px; }
.export-section { padding: 12px 16px; background: var(--bg-100); border-radius: 10px; border: 1px solid var(--bg-300); }
.export-section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-100); margin-bottom: 10px; }
.export-format-cards { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
@media (max-width: 600px) { .export-format-cards { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 400px) { .export-format-cards { grid-template-columns: repeat(3, 1fr); } }
.ef-card { display: flex; flex-direction: column; align-items: center; padding: 10px 4px 6px; border-radius: 10px; border: 2px solid var(--bg-300); cursor: pointer; transition: all 0.2s; background: var(--bg-200); }
.ef-card:hover { border-color: var(--navy); background: var(--bg-100); transform: translateY(-1px); }
.ef-card.active { border-color: var(--navy); background: rgba(26,35,50,0.05); box-shadow: 0 0 0 2px rgba(26,35,50,0.12); }
.ef-card-icon { margin-bottom: 4px; line-height: 1; }
.ef-card-label { font-size: 11px; font-weight: 700; color: var(--text-100); margin-bottom: 1px; }
.ef-card-hint { font-size: 10px; color: var(--text-200); }
</style>
