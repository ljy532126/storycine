<template>
  <div class="sb-root">
    <div class="sb-top" v-if="!wsSbActions">
      <div class="tb-left">
        <div class="sg-scroll-area">
            </div>
      </div>
      <div class="tb-right">
        <el-tooltip content="淇濆瓨褰撳墠鏁呬簨鏉垮埌鏁版嵁搴? placement="bottom"><el-button size="small" @click="saveStoryboard" :loading="saving" class="tb-btn tb-btn-save">淇濆瓨</el-button></el-tooltip>
        <el-tooltip content="浠庡墽鏈噸鏂扮敓鎴愬垎闀? placement="bottom"><el-button size="small" @click="handleAutoGenerate" :disabled="!currentScriptId" :loading="generating" class="tb-btn tb-btn-refresh">鍒锋柊鏁呬簨鏉?/el-button></el-tooltip>
        <el-tooltip content="鍒犻櫎褰撳墠鏁呬簨鏉? placement="bottom"><el-button size="small" @click="deleteStoryboard" :disabled="!currentStoryboard" :loading="deletingSB" class="tb-btn tb-btn-delete">鍒犻櫎</el-button></el-tooltip>
        <el-tooltip content="瀵煎嚭" placement="bottom"><el-button size="small" @click="openExport" :disabled="!currentProjectId" class="tb-btn-icon"><Download size="14" fill="currentColor"/></el-button></el-tooltip>
        <el-tooltip content="瀵煎叆" placement="bottom"><el-button size="small" @click="showImportDialog = true" :disabled="!currentStoryboard" class="tb-btn-icon"><Upload size="14" fill="currentColor"/></el-button></el-tooltip>
        <el-divider direction="vertical" style="margin:0 6px;height:20px" />
        <span style="font-size:11px;color:var(--text-200);white-space:nowrap">鏃犲瓧骞?/span>
        <el-switch v-model="noSubtitles" size="small" />
        <el-tooltip content="寮€鍚悗锛岀敓鎴愮殑瑙嗛鐢婚潰涓嶄細鍑虹幇鑷姩瀛楀箷銆佹枃瀛椼€佹按鍗? placement="bottom">
          <Help size="14" fill="var(--text-200)" style="cursor:help"/>
        </el-tooltip>
      </div>
    </div>

    <!-- 绉诲姩绔?Tab 瀵艰埅 -->
    <div class="sb-mobile-tabs" v-if="currentProjectId && screenWidth < 768">
      <div :class="['smtab', { active: mobileTab === 'episodes' }]" @click="mobileTab = 'episodes'"><List size="14" fill="currentColor"/> 鍓ч泦</div>
      <div :class="['smtab', { active: mobileTab === 'shots' }]" @click="mobileTab = 'shots'"><Film size="14" fill="currentColor"/> 闀滃ご</div>
      <div :class="['smtab', { active: mobileTab === 'settings' }]" @click="mobileTab = 'settings'"><SettingTwo size="14" fill="currentColor"/> 璁剧疆</div>
    </div>

    <div class="sb-body" v-if="currentProjectId && pageReady">
      <!-- ===== 宸︼細鍓ч泦鍒楄〃 ===== -->
      <div class="sb-left" v-show="screenWidth >= 768 || mobileTab === 'episodes'">
        <div class="panel-title"><Movie size="16" fill="var(--gold)"/> 鍓ч泦</div>
        <div class="ep-list">
          <div v-for="ep in scripts" :key="ep._id"
            :class="['ep-item', { active: currentScriptId === ep._id }]"
            @click="currentScriptId = ep._id; onScriptChange(ep._id)">
            <span class="ep-num">绗瑊{ ep.episodeNumber }}闆?/span>
            <span class="ep-name">{{ ep.episodeTitle || '鏈懡鍚? }}</span>
          </div>
        </div>
        <div v-if="scripts.length === 0" style="color:var(--text-200);text-align:center;padding:20px">鏆傛棤鍓ч泦</div>
      </div>

      <!-- ===== 涓細棰勮 + 鏃堕棿绾?===== -->
      <div class="sb-center" v-show="screenWidth >= 768 || mobileTab === 'shots'">
        <!-- 瑙嗛棰勮鍖?-->
        <div class="preview-area">
          <div v-if="!currentShot" class="preview-empty">
            <Film size="48" fill="var(--primary-300)"/>
            <p>鐐瑰嚮涓嬫柟闀滃ご缂╃暐鍥鹃瑙?/p>
          </div>
          <div v-else class="preview-shot">
            <div class="preview-frame">
              <!-- 瑙嗛鎾斁鍣?-->
              <video v-if="currentShot.renderedVideo && !isTaskId(currentShot.renderedVideo)"
                :src="currentShot.renderedVideo" controls preload="metadata"
                style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px"
                @loadedmetadata="console.log('[瑙嗛] 宸插姞杞?', currentShot.renderedVideo)">
              </video>
              <!-- 瑙嗛鐢熸垚涓?/ 绛夊緟涓?-->
              <div v-else-if="getShotPollKey() && videoPollingMap[getShotPollKey()]" class="preview-empty">
                <PictureOne v-if="videoPollingMap[getShotPollKey()].status === 'queued'" size="48" fill="var(--primary-300)"/>
                <Film v-else-if="videoPollingMap[getShotPollKey()].status === 'running'" size="48" fill="var(--primary-300)"/>
                <AlarmClock v-else size="48" fill="var(--primary-300)"/>
                <p><strong>{{ statusLabel(videoPollingMap[getShotPollKey()].status) }}</strong></p>
                <p style="font-size:11px;color:var(--text-200);word-break:break-all">浠诲姟ID: {{ videoPollingMap[getShotPollKey()].taskId }}</p>
                <p style="font-size:11px;color:var(--text-200)">宸茬瓑寰?{{ videoPollingMap[getShotPollKey()].progress }} 绉?路 閫氬父 1~3 鍒嗛挓</p>
                <el-progress :percentage="Number(Math.min((videoPollingMap[getShotPollKey()].progress || 0) / 1.8, 99).toFixed(2))" style="width:200px;margin-top:4px" :stroke-width="6" />
              </div>
              <!-- 鍥剧墖棰勮 -->
              <img v-else-if="currentShot.renderedImage" :src="currentShot.renderedImage" style="max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in" @click="openImgViewer(currentShot.renderedImage)" />
              <!-- 娓呴櫎鎸夐挳 -->
              <div v-if="currentShot.renderedVideo || currentShot.renderedImage" class="preview-clear" @click="clearShotMedia(currentShot, currentShot.renderedVideo ? 'video' : 'image')" title="娓呴櫎濯掍綋锛堟枃浠朵繚鐣欙級">鉁?/div>
              <!-- 鏆傛棤濯掍綋鍗犱綅 -->
              <div v-if="!currentShot.renderedImage && !currentShot.renderedVideo && !(getShotPollKey() && videoPollingMap[getShotPollKey()])" class="preview-placeholder">
                <div class="pp-pulse-ring">
                  <div class="pp-pulse-ring-inner">
                    <Film size="36" fill="rgba(201,168,76,0.25)"/>
                  </div>
                </div>
                <span class="pp-label">寰呯敓鎴?/span>
                <span class="pp-hint">鐐瑰嚮涓嬫柟闀滃ご鍗＄墖鐢熸垚鍚庡湪姝ら瑙?/span>
              </div>
              <!-- 鏅埆/杩愰暅/鏃堕暱娴眰 -->
              <div class="preview-info" v-if="currentShot.renderedImage || currentShot.renderedVideo">
                <span class="pi-tag">{{ currentShot.shotType }}</span>
                <span class="pi-tag">{{ currentShot.cameraMovement }}</span>
                <span class="pi-dur">{{ currentShot.duration }}s</span>
              </div>
            </div>
            <div class="preview-dialogue" v-if="(currentShot._dialogues || []).length > 0">
              <div v-for="(d, di) in currentShot._dialogues" :key="di" class="preview-dialogue-line">
                <strong>{{ d.characterName }}</strong>锛歿{ d.text }}
              </div>
            </div>
            <div class="preview-dialogue" v-else-if="currentShot.dialogue?.text">
              <strong>{{ currentShot.dialogue.characterName }}</strong>锛歿{ currentShot.dialogue.text }}
            </div>
          </div>
        </div>

        <!-- 鍒嗛暅鏃堕棿绾?-->
        <div class="timeline" v-if="currentStoryboard && currentStoryboard.shots" @mouseenter="showTimelineArrows = true" @mouseleave="showTimelineArrows = false">
          <div class="tl-header">
            <span class="tl-label"><Film size="16" fill="var(--gold)"/> 鍒嗛暅鏃堕棿绾?({{ currentStoryboard.shots.length }} 闀滃ご)</span>
            <div class="tl-batch-btns">
              <el-tooltip content="涓烘墍鏈夊緟瀹氶暅澶存壒閲忕敓鎴愬浘鐗? placement="bottom"><el-button size="small" @click="batchGenerateImages" :loading="batchGenning" class="tb-btn tb-btn-gen">鎵归噺鐢熷浘</el-button></el-tooltip>
              <el-tooltip content="涓烘墍鏈夊緟瀹氶暅澶存壒閲忕敓鎴愯棰? placement="bottom"><el-button size="small" @click="batchGenerateVideos" :loading="batchGenningVideo" class="tb-btn tb-btn-gen">鎵归噺鐢熻棰?/el-button></el-tooltip>
            </div>
          </div>
          <div class="tl-track-wrap">
            <transition name="tl-arrow-fade">
              <span v-if="showTimelineArrows && tlCanScrollLeft" class="tl-arrow tl-arrow-left" @click="tlScroll(-280)">鈼€</span>
            </transition>
            <div class="tl-track" ref="tlTrack">
              <template v-for="(s, idx) in currentStoryboard.shots" :key="s.shotNumber">
              <!-- 鍒嗛暅闂存彃鍏ユ寜閽?-->
              <div class="tl-insert" @click.stop="insertAt(idx)" title="鍦ㄦ鎻掑叆鏂板垎闀?>+</div>
              <!-- 鍒嗛暅鍗＄墖 -->
              <div :class="['tl-card', { 'tl-active': currentShot?.shotNumber === s.shotNumber }]" @click="selectShot(s)">
                <div class="tl-card-header">
                  <span class="tl-shot-num">闀滃ご {{ s.shotNumber }}</span>
                  <span class="tl-shot-dur"><Time size="12" fill="var(--gold)"/> {{ s.duration }}s</span>
                </div>
                <div class="tl-img">
                  <div v-if="genningShotSet.has(s.shotNumber)" class="tl-genning">
                    <span class="tl-genning-spin">鉄?/span>
                    <span class="tl-genning-text">鐢熸垚涓?/span>
                  </div>
                  <img v-else-if="s.renderedImage" :src="s.renderedImage" @dblclick.stop="openImgViewer(s.renderedImage)" />
                  <div v-else-if="s.renderedVideo" class="tl-video-thumb" @dblclick.stop="openVideoPreview(s.renderedVideo)">
                    <span class="tl-video-play">鈻?/span>
                  </div>
                  <span v-else class="tl-placeholder">寰呯敓鎴?/span>
                  <span v-if="s.renderedImage" class="tl-img-clear" @click.stop="clearShotMedia(s, 'image')" title="娓呴櫎鍥剧墖锛堟枃浠朵繚鐣欎笉鍒狅級">鉁?/span>
                  <span v-if="s.renderedVideo" class="tl-img-clear" @click.stop="clearShotMedia(s, 'video')" title="娓呴櫎瑙嗛锛堟枃浠朵繚鐣欎笉鍒狅級">鉁?/span>
                  <!-- 鍘嗗彶鐗堟湰閫夋嫨鍣?-->
                  <span v-if="(s.materials || []).filter(m => m.type === 'image').length >= 2"
                    class="tl-ver-badge" @click.stop="toggleVerPicker(s)" title="鍘嗗彶鐢熸垚鐗堟湰">
                    {{ (s.materials || []).filter(m => m.type === 'image').length }}鐗?
                  </span>
                </div>
                <!-- 鐗堟湰閫夋嫨寮圭獥 -->
                <div v-if="verPickerShot === s.shotNumber" class="tl-ver-popup" @click.stop>
                  <div v-for="m in (s.materials || []).filter(x => x.type === 'image').sort((a,b) => b.version - a.version)" :key="m.version"
                    :class="['tl-ver-item', { 'tl-ver-active': s.renderedImage === m.url }]"
                    @click.stop="selectVer(s, m)">
                    <img :src="m.url" />
                    <span class="tl-ver-label">v{{ m.version }}</span>
                  </div>
                </div>
                <div class="tl-meta">
                  <span class="tl-type">{{ s.shotType }}</span>
                  <span>{{ s.shotNumber }}</span>
                </div>
                <div class="tl-desc" v-if="s.imageDescription" :title="s.imageDescription">{{ s.imageDescription }}</div>
                <div class="tl-actions">
                  <label class="tl-btn" title="涓婁紶鍥剧墖" @click.stop>
                    <input type="file" accept="image/*" hidden @change="e => uploadShotImage(s, e)" />
                    <PictureOne size="14" fill="var(--text-200)"/>
                  </label>
                  <label class="tl-btn" title="涓婁紶瑙嗛" @click.stop>
                    <input type="file" accept="video/*" hidden @change="e => uploadShotVideo(s, e)" />
                    <Video size="14" fill="var(--text-200)"/>
                  </label>
                  <span class="tl-btn" title="澶嶅埗鍒嗛暅" @click.stop="copyShot(s)"><Copy size="14" fill="var(--text-200)"/></span>
                  <span class="tl-btn" title="鎻掑叆鏂板垎闀? @click.stop="insertShotAfter(s)"><Plus size="14" fill="var(--text-200)"/></span>
                  <span class="tl-btn" title="鍒犻櫎鍒嗛暅" @click.stop="deleteShot(s)"><Delete size="14" fill="var(--text-200)"/></span>
                  <span class="tl-btn" :title="synthingShot === s.shotNumber ? '鐢熸垚涓?..' : 'AI 璇煶鍚堟垚'" @click.stop="openTTSDialog(s)" :style="synthingShot === s.shotNumber ? 'opacity:0.5' : ''"><Voice size="14" fill="var(--text-200)"/></span>
                </div>
                <div class="tl-audio" v-if="s.dialogue?.audioUrl && s.dialogue.audioUrl !== synthingShot">
                  <audio :src="s.dialogue.audioUrl" controls preload="none" style="width:100%;height:28px;margin-top:4px" />
                </div>
              </div>
            </template>
            <!-- 鏈熬鎻掑叆 + 鍒涘缓绌虹櫧鍒嗛暅 -->
            <div class="tl-insert tl-insert-end" @click.stop="addBlankShot" title="鍒涘缓绌虹櫧鍒嗛暅">+</div>
            <div class="tl-card tl-card-end" @click="addBlankShot">
              <div class="tl-card-header">
                <span class="tl-shot-num">鏂板</span>
                <span class="tl-shot-dur"><Time size="12" fill="var(--gold)"/> 3s</span>
              </div>
              <div class="tl-img tl-img-add">
                <span class="tl-add-icon">+</span>
              </div>
              <div class="tl-meta-end">鍒涘缓绌虹櫧鍒嗛暅</div>
              <div class="tl-actions-end">
                <span style="font-size:10px;color:var(--primary-300)">鐐瑰嚮娣诲姞</span>
              </div>
            </div>
          </div>
          <transition name="tl-arrow-fade">
            <span v-if="showTimelineArrows && tlCanScrollRight" class="tl-arrow tl-arrow-right" @click="tlScroll(280)">鈻?/span>
          </transition>
          </div>
        </div>
      </div>

      <!-- ===== 鍙筹細缁樺浘/瑙嗛闈㈡澘 ===== -->
      <div class="sb-right" v-show="screenWidth >= 768 || mobileTab === 'settings'">
        <div class="tab-switch">
          <div :class="['tab-btn', { active: rightTab === 'draw' }]" @click="rightTab = 'draw'">缁樺浘</div>
          <div :class="['tab-btn', { active: rightTab === 'video' }]" @click="rightTab = 'video'">瑙嗛</div>
        </div>

        <!-- ===== 缁樺浘鏍囩椤?===== -->
        <div v-show="rightTab === 'draw'">
          <div class="right-section">
            <label>鍥剧墖鎻愮ず璇?/label>
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
              <div class="prompt-editor-ph" v-if="!imgEditorHasContent" @click="imgPromptRef?.focus()">杈撳叆鍥剧墖鐢熸垚鎻愮ず璇嶏紝杈撳叆 @ 鍙€夋嫨鎻掑叆瑙掕壊寮曠敤...</div>
              <div v-if="showImgMentionMenu" class="mention-menu" :style="imgMentionMenuStyle">
                <div v-for="item in mentionOptions" :key="item.id" class="mention-item" @mousedown.prevent="insertImgMention(item)">
                  <span class="mention-chip" :style="{ background: item.bg || 'rgba(201,168,76,0.2)', color: item.color || 'var(--gold-dark)' }">{{ item.chip }}</span>
                  <span class="mention-name">{{ item.name }}</span>
                  <span class="mention-type">{{ item.type }}</span>
                </div>
                <div v-if="mentionOptions.length === 0" class="mention-empty">鏃犲尮閰嶇粨鏋?/div>
              </div>
            </div>
            <div v-if="videoRefChips.length > 0" class="prompt-chips">
              <span style="font-size:11px;color:var(--text-200);margin-right:4px">鐐瑰嚮鎻掑叆锛?/span>
              <span v-for="rc in videoRefChips" :key="rc.id" class="prompt-chip" @click="insertChipToImg(rc)" :title="rc.hint">{{ rc.tag }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <span class="char-count">{{ imgEditorCharCount }} / 5000</span>
              <el-button size="small" type="primary" link @click="generatePromptForShot" :loading="genningPrompt">AI 鐢熸垚</el-button>
            </div>
          </div>
          <div class="right-section">
            <label>妯″瀷閫夋嫨</label>
            <el-select v-model="selectedModel" size="small" style="width:100%">
              <el-option label="Seedream 4.0 | 2K" value="doubao_image" />
              <el-option label="Seedream 4.0 | 4K" value="doubao_image_4k" />
              <el-option label="gpt-image-2" value="openai_image" />
            </el-select>
            <el-button size="small" type="primary" style="width:100%;margin-top:8px" @click="generateImageForShot" :loading="genningImage" :disabled="!currentShot">鐢熸垚鍥剧墖</el-button>
          </div>
        </div>

        <!-- ===== 瑙嗛鏍囩椤?===== -->
        <div v-show="rightTab === 'video'">
          <div class="seedance-marquee" title="Seedance 2.0 鐪熶汉鍐呭瑙勯伩锛欰I 鍐欏疄浜哄儚涔熶細琚垽瀹氫负鐪熶汉鎷︽埅銆傚缓璁娇鐢ㄧ函鍦烘櫙/閬撳叿鍥剧墖锛堟棤浜虹墿锛夈€佸崱閫?鍔ㄦ极/鍙ら绛夐潪鍐欏疄椋庢牸銆佺敤渚ч潰/鑳屽奖浠ｆ浛姝ｉ潰鐗瑰啓">
            <span class="seedance-marquee-inner">
              <span class="seedance-marquee-dupe">鈿狅笍 Seedance 2.0 鐪熶汉鍐呭瑙勯伩锛欰I 鍐欏疄浜哄儚涔熶細琚垽瀹氫负"鐪熶汉"鎷︽埅 路 寤鸿鈶?浣跨敤绾満鏅?閬撳叿鍥剧墖锛堟棤浜虹墿锛壜?鈶?浣跨敤鍗￠€氥€佸姩婕€佸彜椋庣瓑闈炲啓瀹為鏍?路 鈶?鐢ㄤ晶闈?鑳屽奖浠ｆ浛姝ｉ潰鐗瑰啓</span>
              <span class="seedance-marquee-dupe">鈿狅笍 Seedance 2.0 鐪熶汉鍐呭瑙勯伩锛欰I 鍐欏疄浜哄儚涔熶細琚垽瀹氫负"鐪熶汉"鎷︽埅 路 寤鸿鈶?浣跨敤绾満鏅?閬撳叿鍥剧墖锛堟棤浜虹墿锛壜?鈶?浣跨敤鍗￠€氥€佸姩婕€佸彜椋庣瓑闈炲啓瀹為鏍?路 鈶?鐢ㄤ晶闈?鑳屽奖浠ｆ浛姝ｉ潰鐗瑰啓</span>
            </span>
          </div>
          <div class="right-section">
            <label>瑙嗛鎻愮ず璇?/label>
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
              <div class="prompt-editor-ph" v-if="!editorHasContent" @click="focusEditor">杈撳叆瑙嗛鐢熸垚鎻愮ず璇嶏紝杈撳叆 @ 鍙€夋嫨鎻掑叆瑙掕壊寮曠敤...</div>
              <div v-if="showMentionMenu" class="mention-menu" :style="mentionMenuStyle">
                <div v-for="item in mentionOptions" :key="item.id" class="mention-item" @mousedown.prevent="insertMention(item)">
                  <span class="mention-chip" :style="{ background: item.bg || 'rgba(201,168,76,0.2)', color: item.color || 'var(--gold-dark)' }">{{ item.chip }}</span>
                  <span class="mention-name">{{ item.name }}</span>
                  <span class="mention-type">{{ item.type }}</span>
                </div>
                <div v-if="mentionOptions.length === 0" class="mention-empty">鏃犲尮閰嶇粨鏋?/div>
              </div>
            </div>
            <div v-if="videoRefChips.length > 0" class="prompt-chips">
              <span style="font-size:11px;color:var(--text-200);margin-right:4px">鐐瑰嚮鎻掑叆锛?/span>
              <span v-for="rc in videoRefChips" :key="rc.id" class="prompt-chip" @click="insertChip(rc)" :title="rc.hint">{{ rc.tag }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
              <span class="char-count">{{ editorCharCount }} / 5000</span>
              <div style="display:flex;gap:4px">
                <el-button size="small" type="primary" link @click="generateVideoPromptForShot" :loading="genningVideoPrompt">AI 鐢熸垚</el-button>
                <el-button size="small" type="warning" link @click="generateTimedStoryboard" :loading="genningTimedSB">AI鏅鸿兘鏃堕暱</el-button>
              </div>
            </div>
          </div>
          <div class="right-section" style="display:flex;gap:8px;align-items:flex-end">
            <div style="flex:1">
              <label>鏃堕暱璁剧疆 (绉? <span style="font-size:10px;color:var(--text-200);font-weight:400;letter-spacing:0">鑼冨洿 4-15 绉?/span></label>
              <el-input-number v-model="videoDuration" :min="4" :max="15" size="small" style="width:100%" @change="saveVideoDuration" />
            </div>
            <el-popover placement="bottom" :width="340" trigger="click">
              <template #reference>
                <el-button size="small"><SettingTwo theme="outline" size="14" fill="currentColor" /> 楂樼骇</el-button>
              </template>
              <div class="vp-pop">
                <div class="vp-pop-section">
                  <span class="vp-pop-title">瑙嗛姣斾緥</span>
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
                  <span class="vp-pop-title">鍒嗚鲸鐜?/span>
                  <div class="vp-resolution-row">
                    <span v-for="r in videoResolutions" :key="r"
                      :class="['vp-res-item', { active: videoResolution === r, disabled: isResolutionLocked(r) }]"
                      @click="selectResolution(r)" :title="resolutionTooltip(r)">{{ r }}</span>
                  </div>
                </div>
                <div class="vp-pop-section">
                  <span class="vp-pop-title">瑙嗛妯″瀷</span>
                  <el-select v-model="selectedVideoModel" size="small" style="width:100%">
                    <el-option label="Seedance 2.0" value="doubao_video" />
                    <el-option label="Seedance 2.0 Fast" value="doubao_video_fast" />
                  </el-select>
                </div>
                <div class="vp-pop-section vp-pop-inline">
                  <div style="display:flex;align-items:center;gap:5px">
                    <span style="font-size:12px;color:var(--text-200);white-space:nowrap">绂佺敤姘村嵃</span>
                    <el-switch v-model="videoNoWatermark" size="small" />
                  </div>
                  <div style="display:flex;align-items:center;gap:5px">
                    <span style="font-size:12px;color:var(--text-200);white-space:nowrap">鐢熸垚闊抽</span>
                    <el-switch v-model="videoGenAudio" size="small" />
                  </div>
                </div>
              </div>
            </el-popover>
          </div>
          <div class="right-section">
            <el-button size="small" type="primary" style="width:100%" @click="generateVideoForShot" :loading="genningVideo" :disabled="!currentShot">鐢熸垚瑙嗛</el-button>
          </div>
        </div>

        <!-- 鍙傝€冧富浣?-->
        <div class="right-section">
          <label>鍙傝€冭鑹?/label>
          <div class="ref-chars">
            <div v-for="c in assetStore.characters" :key="c._id" class="ref-chip"
              :class="{ active: selectedRefs.includes(c._id), 'has-img': getCharThumb(c) }"
              @click="toggleRef(c._id)"
              :title="getCharThumb(c) ? `${c.name}锛堟湁鍙傝€冨浘锛塦 : `${c.name}锛堟棤鍙傝€冨浘锛塦">
              {{ c.name }}<PictureOne v-if="getCharThumb(c)" size="12" fill="var(--gold)" style="margin-left:2px;vertical-align:middle"/>
            </div>
          </div>
        </div>
        <div class="right-section">
          <label>鍙傝€冨満鏅?/label>
          <div class="ref-chars">
            <div v-for="s in assetStore.scenes" :key="s._id" class="ref-chip"
              :class="{ active: selectedSceneRefs.includes(s._id), 'has-img': getSceneThumb(s) }"
              @click="toggleSceneRef(s._id)"
              :title="getSceneThumb(s) ? `${s.sceneName}锛堟湁鍙傝€冨浘锛塦 : `${s.sceneName}锛堟棤鍙傝€冨浘锛塦">
              {{ s.sceneName }}<PictureOne v-if="getSceneThumb(s)" size="12" fill="var(--gold)" style="margin-left:2px;vertical-align:middle"/>
            </div>
          </div>
        </div>

        <!-- 鍙傝€冨浘鐗囦笂浼?-->
        <div class="right-section">
          <label>鍙傝€冨浘鐗?({{ currentRefImages.length }}/9)</label>
          <div class="ref-imgs">
            <div v-for="(img, i) in currentRefImages" :key="i" class="ref-img-item">
              <img :src="img" />
              <span class="ref-img-del" @click="removeRefImage(i)">脳</span>
            </div>
            <label v-if="currentRefImages.length < 9" class="ref-upload-btn">
              + 涓婁紶
              <input type="file" accept="image/*" multiple hidden @change="onRefImageUpload" />
            </label>
          </div>
        </div>

        <!-- 鍒嗛暅绱犳潗绠＄悊 -->
        <div class="right-section">
          <label>鍒嗛暅绱犳潗 ({{ (currentShot?.materials || []).length }} 鐗堟湰)</label>
          <div class="mat-grid">
            <div v-for="m in (currentShot?.materials || [])" :key="m.version"
              class="mat-item" :class="{ 'mat-active': (currentShot.renderedImage === m.url || currentShot.renderedVideo === m.url) }">
              <!-- 瑙嗛绱犳潗鏄剧ず鎾斁鍥炬爣 -->
              <div v-if="m.type === 'video'" class="mat-video-preview" @click="openVideoPreview(m.url)">
                <span class="mat-play-icon">鈻?/span>
              </div>
              <img v-else-if="m.url" :src="m.url" @click="openImgViewer(m.url)" />
              <span class="mat-type"><Video v-if="m.type === 'video'" size="14" fill="var(--gold)"/><Pic v-else size="14" fill="var(--gold)"/></span>
              <span class="mat-ver">v{{ m.version }}</span>
              <span class="mat-set" @click.stop="setMatAsCurrent(m)" title="璁句负涓荤礌鏉?>鈽?/span>
            </div>
          </div>
          <div v-if="!(currentShot?.materials || []).length" style="color:var(--primary-300);font-size:12px">鐢熸垚鍥剧墖/瑙嗛鍚庡皢鏄剧ず姝ゅ</div>
        </div>
        <div class="right-section">
          <label>鍏朵粬鍒嗛暅绱犳潗</label>
          <div class="mat-grid">
            <div v-for="s in (currentStoryboard?.shots || []).filter(x => x.renderedImage || x.renderedVideo).slice(0, 8)" :key="s.shotNumber"
              class="mat-item" @click="applyMaterialToShot(s)">
              <div v-if="s.renderedVideo && !s.renderedImage" class="mat-video-preview"><span class="mat-play-icon">鈻?/span></div>
              <img v-else-if="s.renderedImage" :src="s.renderedImage" />
              <span class="mat-num">#{{ s.shotNumber }}</span>
            </div>
          </div>
          <div v-if="!currentStoryboard?.shots?.filter(x => x.renderedImage || x.renderedVideo).length" style="color:var(--primary-300);font-size:12px">鐢熸垚鍥剧墖/瑙嗛鍚庡皢鏄剧ず鍦ㄦ澶?/div>
        </div>
      </div>
    </div>

    <el-empty v-if="!currentProjectId" description="璇烽€夋嫨鐗囧満" style="margin-top:80px" />
    <div v-else-if="!pageReady" class="sb-loader-wrap">
      <div class="sb-loader-ring"><div class="sb-loader-inner"><Film size="28" fill="rgba(201,168,76,0.3)"/></div></div>
      <span class="sb-loader-text">闀滃ご鏉垮姞杞戒腑</span>
    </div>

    <!-- 瀵煎嚭寮圭獥 -->
    <el-dialog v-model="showExportDialog" :width="screenWidth < 768 ? '94%' : '520px'" destroy-on-close class="export-dialog">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <Download size="20" fill="var(--gold)"/>
          <span style="font-size:17px;font-weight:700;color:var(--text-100)">瀵煎嚭鍒嗛暅</span>
        </div>
      </template>
      <div class="export-body">
        <div class="export-section">
          <div class="export-section-title"><Film size="14" fill="var(--navy)"/> 閫夋嫨鍓ч泦</div>
          <el-select v-model="exportEpisodes" style="width:100%" multiple collapse-tags placeholder="鍏ㄩ儴鍓ч泦锛堜笉閫?瀵煎嚭鍏ㄩ儴锛?>
            <el-option v-for="ep in scripts" :key="ep._id" :label="formatEpLabel(ep)" :value="ep._id" />
          </el-select>
          <div style="display:flex;gap:8px;margin-top:6px">
            <el-button size="small" link @click="exportEpisodes = scripts.map(e => e._id)">鍏ㄩ€?/el-button>
            <el-button size="small" link @click="exportEpisodes = currentScriptId ? [currentScriptId] : []">褰撳墠闆?/el-button>
            <el-button size="small" link @click="exportEpisodes = []">娓呯┖</el-button>
          </div>
        </div>
        <div class="export-section">
          <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 瀵煎嚭鍐呭</div>
          <el-checkbox-group v-model="exportTypes">
            <el-checkbox value="script">鍓ф湰鍏ㄦ枃</el-checkbox>
            <el-checkbox value="shots">鍒嗛暅鍏ㄦ枃</el-checkbox>
            <el-checkbox value="full_storyboard">鏁呬簨鏉垮叏鏂?/el-checkbox>
          </el-checkbox-group>
        </div>
        <div class="export-section">
          <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 瀵煎嚭鏍煎紡</div>
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
        <el-button @click="showExportDialog = false">鍙栨秷</el-button>
        <el-button type="primary" @click="handleExport" :disabled="exportTypes.length === 0">
          <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 瀵煎嚭鏂囦欢
        </el-button>
      </template>
    </el-dialog>

    <ImageLightbox v-model:visible="imgViewerVisible" :url="imgViewerSrc || ''" title="鍥剧墖棰勮" />

    <!-- 瀵煎叆寮圭獥 -->
    <el-dialog v-model="showImportDialog" title="瀵煎叆鍒嗛暅鏁版嵁" width="600px" class="export-dialog">
      <div class="export-body">
        <div class="export-section">
          <div class="export-section-title"><FolderOpen size="14" fill="var(--navy)"/> 鏁版嵁鏍煎紡</div>
          <el-radio-group v-model="importFormat">
            <el-radio value="csv">CSV锛堥€楀彿鍒嗛殧锛?/el-radio>
            <el-radio value="json">JSON锛堢粨鏋勫寲鏁版嵁锛?/el-radio>
          </el-radio-group>
          <div style="margin-top:10px">
            <el-upload :auto-upload="false" :show-file-list="false" accept=".csv,.json,.txt" @change="onImportFileChange">
              <el-button size="small">馃搧 閫夋嫨鏂囦欢涓婁紶</el-button>
            </el-upload>
          </div>
        </div>
        <div class="export-section">
          <div class="export-section-title"><Edit size="14" fill="var(--navy)"/> 绮樿创鏁版嵁</div>
          <el-input v-model="importText" type="textarea" :rows="14" placeholder="绮樿创 CSV 鎴?JSON 鏁版嵁鍒版澶?.." />
        </div>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top:12px">
        <template #title>
          CSV琛ㄥご锛氶暅澶村彿,鍦烘櫙鍚嶇О,鏅埆,鏋勫浘,杩愰暅,鐏厜,鏃堕暱,鍥惧儚鎻忚堪,瑙掕壊鍚?鍙拌瘝,闊虫晥,澶囨敞,鐘舵€?
          <br>JSON锛氭暟缁勬牸寮?[{ shotNumber, shotType, imageDescription, ... }]
        </template>
      </el-alert>
      <template #footer>
        <el-button @click="showImportDialog = false">鍙栨秷</el-button>
        <el-button type="primary" @click="handleImport" :loading="importing" :disabled="!importText.trim()">
          <Download size="14" fill="currentColor" style="margin-right:4px;vertical-align:text-bottom"/> 瀵煎叆鏁版嵁
        </el-button>
      </template>
    </el-dialog>

    <!-- TTS 閰嶉煶鍙傛暟寮圭獥 -->
    <el-dialog v-model="showTTSDialog" :title="ttsTargetShot ? `閰嶉煶: 闀滃ご ${ttsTargetShot.shotNumber}` : '鎵归噺鍏ㄩ泦閰嶉煶'" width="560px" destroy-on-close>
      <div v-if="ttsTargetShot" style="margin-bottom:12px">
        <span style="font-size:12px;font-weight:600;color:var(--text-100);display:block;margin-bottom:6px">閫夋嫨鍙拌瘝锛堝叡 {{ ttsDialogueOptions.length }} 鍙ワ級</span>
        <div v-if="ttsDialogueOptions.length > 0" class="tts-dialogue-list">
          <div v-for="(d, di) in ttsDialogueOptions" :key="di"
            :class="['tts-dialogue-item', { active: ttsSelectedDi === di }]"
            @click="ttsSelectedDi = di">
            <span class="tts-di-char">{{ d.characterName || '鏈煡' }}</span>
            <span class="tts-di-text">{{ d.text }}</span>
          </div>
        </div>
        <div v-else style="color:var(--text-200);font-size:12px">璇ラ暅澶存病鏈夊彴璇嶏紝灏嗗悎鎴愰暅澶存弿杩?/div>
      </div>
      <el-form label-position="top" size="small">
        <el-form-item label="闊宠壊">
          <el-select v-model="ttsParams.speaker" style="width:100%" filterable>
            <el-option v-for="v in ttsVoiceOptions" :key="v.value" :label="v.label" :value="v.value" :disabled="v.disabled"/>
          </el-select>
          <el-input v-if="ttsParams.speaker === '__custom__'" v-model="ttsCustomSpeaker" placeholder="杈撳叆闊宠壊ID" size="small" style="margin-top:8px" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="璇€?><el-slider v-model="ttsParams.speechRate" :min="-50" :max="100" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="闊抽噺"><el-slider v-model="ttsParams.loudnessRate" :min="-50" :max="100" /></el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" style="font-size:12px" title="涓存椂淇敼浠呮湰娆″悎鎴愮敓鏁? />
      </el-form>
      <template #footer>
        <el-button @click="showTTSDialog = false">鍙栨秷</el-button>
        <el-button type="primary" @click="handleTTSSynthesize" :loading="synthingShot !== null" :disabled="ttsTargetShot && ttsDialogueOptions.length > 0 && ttsSelectedDi < 0">
          <Voice size="14" fill="currentColor" style="margin-right:2px;vertical-align:text-bottom"/>{{ ttsTargetShot ? '鍚堟垚閫変腑鐨勫彴璇? : '鎵归噺鍚堟垚鍏ㄩ儴' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick, onMounted, onActivated, onDeactivated, onUnmounted, inject } from 'vue';
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
const wsSbActions = inject('wsSbActions', null);


const projectStore = useProjectStore();
const scriptStore = useScriptStore();
const storyboardStore = useStoryboardStore();
const assetStore = useAssetStore();

const currentProjectId = inject('currentProjectId');
const currentScriptId = ref('');
const currentStoryboard = ref(null);
const currentShot = ref(null);
const pageReady = ref(false);
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
const genningShotSet = reactive(new Set());
const noSubtitles = ref(getStoredNoSubtitles());

function getStoredNoSubtitles() { try { return localStorage.getItem('ad_no_subtitles') === 'true'; } catch { return true; } }
function saveNoSubtitles(v) { try { localStorage.setItem('ad_no_subtitles', String(v)); } catch {} }
const showImportDialog = ref(false);
const showTimelineArrows = ref(false);
const tlCanScrollLeft = ref(false);
const tlCanScrollRight = ref(false);
const showExportDialog = ref(false);
const verPickerShot = ref(null); // 褰撳墠鎵撳紑鐗堟湰閫夋嫨鍣ㄧ殑闀滃ご鍙?
const exportTypes = ref(['script', 'shots', 'full_storyboard']);
const exportFormat = ref('pdf');
const exportEpisodes = ref([]);
const formatOptions = [
  { value:'pdf', label:'PDF', hint:'鎵撳嵃棰勮淇濆瓨', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e74c3c"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zM16.5 13H15v-2h-1.5V7H15v2h1.5v1.5H15V13zM19 13h-1.5V7H19v6zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/></svg>' },
  { value:'markdown', label:'Markdown', hint:'Typora/VS Code', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#3498db"><path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19v-4.69l1.88 2.35 1.88-2.35v4.69h1.13V8.81h-1.13l-1.88 2.35-1.88-2.35H5.69v6.38h1.12zM15.73 15.19l2.62-3.19-2.62-3.19h1.51l1.87 2.31 1.87-2.31h1.51l-2.62 3.19 2.62 3.19h-1.51l-1.87-2.31-1.87 2.31h-1.51z"/></svg>' },
  { value:'csv', label:'CSV Excel', hint:'Excel/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#27ae60"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v-2H8v2zm0-4h2V8H8v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2zm4 4h2v-2h-2v2zm0-4h2V8h-2v2z"/></svg>' },
  { value:'word', label:'Word', hint:'Word/WPS', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#2980b9"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2.5-4.5L10 13l1.5 2.5H13l-2-3 2-3h-1.5L10 11.5 8.5 9.5H7l2 3-2 3h1.5z"/></svg>' },
  { value:'json', label:'JSON', hint:'缁撴瀯鍖栨暟鎹?, icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#8e44ad"><path d="M5 3h2v2H5v5c0 1.1-.9 2-2 2v1c1.1 0 2 .9 2 2v5h2v2H5c-1.07 0-2-.94-2-2.03V17c0-1.1-.9-2-2-2v-1c1.1 0 2-.9 2-2V7c0-1.08.93-2 2-2zm14 0c1.07 0 2 .94 2 2.03V7c0 1.1.9 2 2 2v1c-1.1 0-2 .9-2 2v5.03c0 1.09-.93 2-2 2h-2v-2h2v-5c0-1.1.9-2 2-2V7c0-1.1-.9-2-2-2h-2V3h2z"/></svg>' },
  { value:'html', label:'HTML', hint:'娴忚鍣ㄦ墦寮€', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#e67e22"><path d="M12 18.177l-6.72-3.878-.9-8.12L12 2l7.62 4.179-.9 8.12L12 18.177zM4.86 6.556l.72 6.482L12 16.545l6.42-3.507.72-6.482L12 3.455 4.86 6.556zM11 13h2l-.3 3.5-1 .5-1-.5L11 13zm0-6h2l-.2 5H11.2L11 7z"/></svg>' },
  { value:'png', label:'PNG 鍥剧墖', hint:'鎴浘瀵煎嚭', icon:'<svg viewBox="0 0 24 24" width="24" height="24" fill="#16a085"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' },
];
const importText = ref('');
const importFormat = ref('csv');
const importing = ref(false);
const formatHint = computed(() => {
  const m = { pdf: 'PDF锛氭墦寮€鎵撳嵃棰勮锛屾祻瑙堝櫒銆屽彟瀛樹负 PDF銆嶄繚瀛?, markdown: 'Markdown锛氫笅杞?.md 鏂囦欢锛屽彲鐢?Typora/VS Code 鎵撳紑', csv: 'Excel/CSV锛氫笅杞?.csv 鏂囦欢锛岀敤 Excel/WPS 鎵撳紑缂栬緫', word: 'Word锛氫笅杞?.doc 鏂囦欢锛岀敤 Word/WPS 鎵撳紑缂栬緫', json: 'JSON锛氫笅杞?.json 鏂囦欢锛岀粨鏋勫寲鏁版嵁锛屽彲绋嬪簭鍖栧鐞?, html: 'HTML锛氫笅杞?.html 鏂囦欢锛屾祻瑙堝櫒鐩存帴鎵撳紑鏌ョ湅', png: 'PNG锛氬皢瀵煎嚭鍐呭娓叉煋涓洪珮娓呮埅鍥句笅杞斤紝澶氶泦鍏ㄩ€夋椂鍙兘闇€鍑犵' };
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
  if (isResolutionLocked(r)) return 'Seedance Fast 涓嶆敮鎸?1080p锛屾渶楂?720p';
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

// ===== 鍥剧墖鎻愮ず璇嶇紪杈戝櫒锛堝鐢ㄥ悓涓€涓?mention 绯荤粺锛?====
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

// ===== 閫氱敤缂栬緫鍣ㄥ伐鍏峰嚱鏁?=====
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
  const re = /@([^\s@,;.锛屻€傦紱]+)/g; let m;
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

// ===== 缂栬緫鍣細DOM 鈫?绾枃鏈?=====
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

// ===== @鎻愬強涓嬫媺 =====
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

// 鏍规嵁 @ 绗﹀彿浣嶇疆鍔ㄦ€佽绠楁彁鍙婅彍鍗曞潗鏍?
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
  // 褰?@ 鍦ㄧ紪杈戝櫒鍙冲崐杈规椂锛屽脊绐楀彸瀵归綈闃叉婧㈠嚭
  if (atLeft > wrapRect.width * 0.55) {
    styleRef.value = { top: (caretRect.bottom - wrapRect.top + 4) + 'px', right: '4px', left: 'auto' };
  } else {
    styleRef.value = { top: (caretRect.bottom - wrapRect.top + 4) + 'px', left: atLeft + 'px' };
  }
}

function onPromptClick() { checkMentionTrigger(); }

// 鏍规嵁鏄惁鏈夊弬鑰冨浘杩斿洖瀵瑰簲鐨?tag 棰滆壊
function getMentionColors(name) {
  const c = assetStore.characters.find(x => x.name === name);
  const s = assetStore.scenes.find(x => x.sceneName === name);
  const asset = c || s;
  const hasImg = asset ? !!getRefUrl(asset) : false;
  if (s && !c) {
    return hasImg
      ? { bg: 'rgba(2,173,181,0.14)', color: '#028a91' }
      : { bg: '#f0f0f0', color: '#999' };
  }
  return hasImg
    ? { bg: 'rgba(106,90,205,0.15)', color: '#5b4ab8' }
    : { bg: '#f0f0f0', color: '#999' };
}

// 鍊欓€夐」
const mentionOptions = computed(() => {
  const q = mentionQuery.value.toLowerCase();
  const list = [];
  assetStore.characters.forEach(c => {
    if (!q || c.name?.toLowerCase().includes(q)) {
      const url = getRefUrl(c);
      const colors = getMentionColors(c.name);
      list.push({ id: c._id, name: c.name, type: '瑙掕壊', chip: '@'+c.name, bg: colors.bg, color: colors.color, url: url || '', appearance: c.appearance || '' });
    }
  });
  assetStore.scenes.forEach(s => {
    if (!q || s.sceneName?.toLowerCase().includes(q)) {
      const url = getRefUrl(s);
      const colors = getMentionColors(s.sceneName);
      list.push({ id: s._id, name: s.sceneName, type: '鍦烘櫙', chip: '@'+s.sceneName, bg: colors.bg, color: colors.color, url: url || '', appearance: s.description || s.stylePrompt || '' });
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
  // 鍒犻櫎 @xxx 杈撳叆鏂囨湰
  if (node?.nodeType === Node.TEXT_NODE) {
    const offset = sel.focusOffset;
    const before = node.textContent.substring(0, offset);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      node.textContent = node.textContent.substring(0, atIdx) + node.textContent.substring(offset);
      sel.collapse(node, atIdx);
    }
  }
  // 鎻掑叆 tag span
  const span = document.createElement('span');
  span.className = 'mention-tag'; span.contentEditable = 'false';
  span.dataset.name = item.name; span.dataset.url = item.url || '';
  span.dataset.appearance = item.appearance || '';
  span.style.background = item.bg; span.style.color = item.color;
  span.innerText = item.chip;
  const range = sel.getRangeAt(0);
  range.insertNode(span);
  const space = document.createTextNode('聽');
  range.setStartAfter(span); range.insertNode(space);
  range.setStartAfter(space); range.collapse(true);
  sel.removeAllRanges(); sel.addRange(range);
  onPromptInput();
}

// ===== 閿洏 =====
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

// ===== 鑺墖鐐瑰嚮锛堣棰戯級=====
function insertChip(rc) {
  const char = assetStore.characters.find(x => x._id === rc.id);
  if (char) {
    const colors = getMentionColors(char.name);
    insertMention({ id: rc.id, name: rc.name, type: '瑙掕壊', chip: rc.tag, bg: colors.bg, color: colors.color, url: getRefUrl(char) || '', appearance: rc.hint || '' });
    return;
  }
  const scene = assetStore.scenes.find(x => x._id === rc.id);
  if (scene) {
    const colors = getMentionColors(scene.sceneName);
    insertMention({ id: rc.id, name: rc.name, type: '鍦烘櫙', chip: rc.tag, bg: colors.bg, color: colors.color, url: getRefUrl(scene) || '', appearance: scene.description || scene.stylePrompt || '' });
  }
}

// ===== 鑺墖鐐瑰嚮锛堢粯鍥撅級=====
function insertChipToImg(rc) {
  const char = assetStore.characters.find(x => x._id === rc.id);
  if (char) {
    const colors = getMentionColors(char.name);
    insertImgMention({ id: rc.id, name: rc.name, type: '瑙掕壊', chip: rc.tag, bg: colors.bg, color: colors.color, url: getRefUrl(char) || '', appearance: char.appearance || '' });
    return;
  }
  const scene = assetStore.scenes.find(x => x._id === rc.id);
  if (scene) {
    const colors = getMentionColors(scene.sceneName);
    insertImgMention({ id: rc.id, name: rc.name, type: '鍦烘櫙', chip: rc.tag, bg: colors.bg, color: colors.color, url: getRefUrl(scene) || '', appearance: scene.description || scene.stylePrompt || '' });
  }
}

// ===== 瑙ｆ瀽寮曠敤锛坋ditor DOM 浼樺厛锛?=====
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
  // fallback: 绾枃鏈鍒?
  const text = currentVideoPrompt.value || '';
  const refs = []; const seen = new Set();
  const re = /@([^\s@,;.锛屻€傦紱]+)/g; let m;
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

// 鍙傝€冨浘鑺墖锛堣鑹?+ 鍦烘櫙锛?
const videoRefChips = computed(() => {
  const chips = [];
  selectedRefs.value.forEach(id => {
    const c = assetStore.characters.find(x => x._id === id);
    if (c) chips.push({ id: c._id, name: c.name, tag: '@'+c.name, hint: c.appearance || c.name, type: '瑙掕壊' });
  });
  selectedSceneRefs.value.forEach(id => {
    const s = assetStore.scenes.find(x => x._id === id);
    if (s) chips.push({ id: s._id, name: s.sceneName, tag: '@'+s.sceneName, hint: s.description || s.stylePrompt || s.sceneName, type: '鍦烘櫙' });
  });
  return chips;
});

// ===== 鍔犺浇闀滃ご鏃舵覆鏌撶紪杈戝櫒 =====
function renderEditor(text) {
  const editor = el(); if (!editor) return;
  if (!text) { editor.innerHTML = ''; onPromptInput(); return; }
  let html = ''; let last = 0;
  const re = /@([^\s@,;.锛屻€傦紱]+)/g; let m;
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

// ===== 鍥剧墖鎻愮ず璇嶄篃鍚屾牱鐨勭紪杈戝櫒锛堢渷鐣ワ紝淇濈暀 textarea锛?=====

watch(noSubtitles, saveNoSubtitles);


// 鐩戝惉椤舵爮鍒囩墖鍦?
watch(currentProjectId, (n, o) => { if (n && n !== o) { currentProjectId.value = n; onProjectChange(n); } });
onMounted(async () => {
  await projectStore.fetchProjects();
  const restored = await projectStore.restoreLastProject();
  // 鎭㈠瑙嗛鐢熸垚鐘舵€?
  if (window.__videoGenning) { genningVideo.value = true; window.__setLoading?.(true); }
  if (window.__imgGenning) { genningImage.value = true; window.__setLoading?.(true); }
  if (restored) { currentProjectId.value = restored._id; onProjectChange(restored._id); }
  // 鎭㈠鏈畬鎴愮殑瑙嗛浠诲姟
  setTimeout(() => resumeVideoTasks(), 1000);
});

// keep-alive 缂撳瓨婵€娲绘椂锛氬悓姝ヤ粠鍏朵粬椤甸潰鍒囨崲杩囨潵鐨勯」鐩?
onActivated(() => {
  const storeProject = projectStore.currentProject;
  if (storeProject && storeProject._id !== currentProjectId.value) {
    currentProjectId.value = storeProject._id;
    onProjectChange(storeProject._id);
  } else if (currentProjectId.value && !pageReady.value) {
    // keep-alive 鎭㈠锛屾暟鎹凡瀛樺湪
    nextTick(() => { pageReady.value = true; });
  }
  syncWsSbActions();
});
onDeactivated(() => { if (wsSbActions) wsSbActions.visible = false; });

async function onProjectChange(val) {
  currentScriptId.value = ''; currentStoryboard.value = null; currentShot.value = null; pageReady.value = false;
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
  await nextTick();
  pageReady.value = true;
}
async function onScriptChange(val) {
  if (val) {
    const existing = storyboardStore.storyboards.find(s => (s.scriptId?._id || s.scriptId) === val);
    currentStoryboard.value = existing ? JSON.parse(JSON.stringify(existing)) : null;
    currentShot.value = currentStoryboard.value?.shots?.[0] || null;
    updatePrompt();
    syncEpisodeBar();
    // 瀹夊叏缃戯細浠庡墽鏈媺鏈€鏂板彴璇嶅悓姝ュ埌鏁呬簨鏉块暅澶?
    loadLatestDialogues(val);
    syncWsSbActions();
  }
}
async function loadLatestDialogues(scriptId) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/v1/scripts/${scriptId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const script = data.data;
    if (!script?.scenes || !currentStoryboard.value?.shots) return;
    let changed = false;
    currentStoryboard.value.shots.forEach(shot => {
      const scene = script.scenes.find(s => s.sceneNumber === shot.shotNumber);
      if (scene?.dialogues) {
        const oldLen = (shot._dialogues || []).length;
        if (oldLen !== scene.dialogues.length) {
          shot._dialogues = scene.dialogues.map(d => ({...d}));
          changed = true;
        }
      }
    });
    if (changed && currentShot.value) {
      // 寮哄埗瑙﹀彂褰撳墠闀滃ご棰勮鏇存柊
      currentShot.value = { ...currentShot.value };
    }
  } catch {} // 闈欓粯锛屽け璐ヤ笉褰卞搷涓绘祦绋?
}
function syncEpisodeBar(){if(!episodeBar)return;episodeBar.scripts=scripts.value;episodeBar.currentScriptId=currentScriptId.value;episodeBar.select=onScriptChange;episodeBar.add=null;episodeBar.dup=null;}
function syncWsSbActions() {
  if (!wsSbActions) return;
  wsSbActions.visible = !!currentProjectId.value;
  wsSbActions.canRefresh = !!currentScriptId.value;
  wsSbActions.canDelete = !!currentStoryboard.value;
  wsSbActions.canExport = !!currentProjectId.value;
  wsSbActions.canImport = !!currentStoryboard.value;
  wsSbActions.noSubtitles = noSubtitles.value;
  wsSbActions.save = saveStoryboard;
  wsSbActions.refresh = handleAutoGenerate;
  wsSbActions.del = deleteStoryboard;
  wsSbActions.export_click = openExport;
  wsSbActions.import_click = () => { showImportDialog.value = true; };
}
watch([saving, generating, deletingSB], () => { if (wsSbActions) { wsSbActions.saving = saving.value; wsSbActions.generating = generating.value; wsSbActions.deleting = deletingSB.value; } });
// 鍙屽悜鍚屾鏃犲瓧骞曞紑鍏?
watch(() => wsSbActions?.noSubtitles, (v) => { if (v !== undefined && v !== noSubtitles.value) { noSubtitles.value = v; saveNoSubtitles(v); } });
async function handleAutoGenerate() {
  if (!currentScriptId.value || !currentProjectId.value) return;
  generating.value = true;
  try {
    // 1. 鎷夊彇鍒嗛暅 + 鍏ㄥ眬璁惧畾
    const script = await scriptStore.fetchScript(currentScriptId.value);
    const scenes = script.scenes || [];
    if (scenes.length === 0) {
      ElMessage.warning('璇ラ泦杩樻病鏈夊垎闀滐紝璇峰厛鍦ㄣ€屽垎闀滅鐞嗐€嶄腑娣诲姞鎴栫敓鎴愬垎闀?);
      generating.value = false;
      return;
    }

    // 璇诲彇椤圭洰鍏ㄥ眬璁惧畾
    let videoConfig = { aspectRatio: '9:16', visualStyle: '鍐欏疄', subStyle: '' };
    let directorSettings = null;
    try {
      const project = await projectStore.fetchProject(currentProjectId.value);
      if (project?.videoConfig) videoConfig = project.videoConfig;
      if (project?.directorSettings) directorSettings = project.directorSettings;
    } catch (e) { /* ignore */ }

    ElMessage.info(`姝ｅ湪鍚屾 ${scenes.length} 涓垎闀滃埌鏁呬簨鏉匡紙鐢诲箙:${videoConfig.aspectRatio} 椋庢牸:${videoConfig.visualStyle}锛?..`);

    // 2. 鐢ㄥ叡浜瀯寤哄櫒鎵归噺鐢熸垚闀滃ご+鎻愮ず璇?
    const shots = buildShotsFromScenes(scenes, videoConfig, noSubtitles.value, directorSettings);

    // 淇濈暀鏃х殑宸茬敓鎴愮礌鏉愶紙鎸夐暅鍙峰尮閰嶏級
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

    // 3. 鎵归噺鍚屾鍒版晠浜嬫澘
    const token = localStorage.getItem('token');
    const rawRes = await fetch('/api/v1/storyboards/auto-generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scriptId: currentScriptId.value, projectId: currentProjectId.value, batchShots: shots }),
    });
    const data = await rawRes.json();

    currentStoryboard.value = data.data ? JSON.parse(JSON.stringify(data.data)) : { shots };
    currentStoryboard.value.shots = currentStoryboard.value.shots || shots;
    // 鍚屾鍒?store 缂撳瓨锛屽垏鎹㈠墽闆嗗悗鑳芥仮澶?
    const idx = storyboardStore.storyboards.findIndex(s => (s.scriptId?._id || s.scriptId) === currentScriptId.value);
    if (idx >= 0) storyboardStore.storyboards[idx] = JSON.parse(JSON.stringify(currentStoryboard.value));
    else storyboardStore.storyboards.push(JSON.parse(JSON.stringify(currentStoryboard.value)));
    // 淇濈暀褰撳墠閫変腑鐨勫垎闀滐紙鎸夐暅鍙峰尮閰嶏級
    const prevShotNum = currentShot.value?.shotNumber;
    const matched = currentStoryboard.value.shots.find(s => s.shotNumber === prevShotNum);
    currentShot.value = matched || currentStoryboard.value.shots[0] || null;
    loadShotData(currentShot.value);

    ElMessage.success(`宸插悓姝?${shots.length} 涓垎闀滐紝鍥剧墖/瑙嗛鎻愮ず璇嶅凡鑷姩鍖哄垎鐢熸垚`);
  } catch (e) {
    console.error(e);
    ElMessage.error('鍚屾澶辫触: ' + (e.message || ''));
  }
  finally { generating.value = false; }
}

async function saveStoryboard() {
  if (!currentStoryboard.value?._id) { ElMessage.warning('璇峰厛鐢熸垚鏁呬簨鏉?); return; }
  saving.value = true;
  try {
    const token = localStorage.getItem('token');
    await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shots: currentStoryboard.value.shots }),
    });
    ElMessage.success('鏁呬簨鏉垮凡淇濆瓨');
  } catch (e) { ElMessage.error('淇濆瓨澶辫触'); }
  finally { saving.value = false; }
}

async function deleteStoryboard() {
  if (!currentStoryboard.value?._id) return;
  try { await ElMessageBox.confirm('纭畾鍒犻櫎褰撳墠鏁呬簨鏉匡紵鍒犻櫎鍚庡彲浠ラ噸鏂扮敓鎴愩€?, '鍒犻櫎鏁呬簨鏉?, { type: 'warning', confirmButtonText: '纭鍒犻櫎', cancelButtonText: '涓嬫鍐嶈鍙? }); } catch { return; }
  deletingSB.value = true;
  try {
    const token = localStorage.getItem('token');
    await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    currentStoryboard.value = null;
    currentShot.value = null;
    ElMessage.success('鏁呬簨鏉垮凡鍒犻櫎锛屽彲閲嶆柊鐢熸垚');
  } catch (e) { ElMessage.error('鍒犻櫎澶辫触'); }
  finally { deletingSB.value = false; }
}

function selectShot(s) {
  // 淇濆瓨褰撳墠鍒嗛暅鐨勬彁绀鸿瘝
  saveCurrentPrompt();
  saveCurrentVideoPrompt();
  saveVideoDuration();
  verPickerShot.value = null; // 鍒囨崲闀滃ご鍏抽棴鐗堟湰閫夋嫨鍣?
  // 鍒囨崲鍒版柊鍒嗛暅
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
// 浼樺厛鍙栧叕缃戝彲璁块棶鐨?URL锛堜簯瀛樺偍锛夛紝fallback 鍒版湰鍦拌矾寰?
function getRefUrl(asset) {
  const morph = asset.morphs?.[0];
  // 鍊欓€?URL 鍒楄〃锛氬叕缃?URL 浼樺厛锛屾湰鍦?/uploads/ 鍏滃簳
  const candidates = [
    morph?.generatedImages?.front,
    morph?.generatedImages?.side,
    morph?.generatedImages?.back,
    morph?.referenceImage,
    asset.generatedImage,
    asset.referenceImage,
  ].filter(Boolean);
  // 浼樺厛杩斿洖 https:// 鍏綉 URL锛堝璞″瓨鍌?浜戝瓨鍌級
  const cloud = candidates.find(u => u.startsWith('https://') || u.startsWith('http://'));
  if (cloud) return cloud;
  // fallback 鍒?/uploads/ 鏈湴璺緞
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
  ElMessage.success(m.type === 'video' ? `宸插垏鎹负褰撳墠瑙嗛 (v${m.version})` : `宸插垏鎹负涓诲浘 (v${m.version})`);
}
function toggleVerPicker(shot) {
  verPickerShot.value = verPickerShot.value === shot.shotNumber ? null : shot.shotNumber;
}
function selectVer(shot, m) {
  shot.renderedImage = m.url;
  verPickerShot.value = null;
  // 鎸佷箙鍖栧埌鏁版嵁搴?
  if (currentStoryboard.value?._id) {
    const token = localStorage.getItem('token');
    fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${shot.shotNumber}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ renderedImage: m.url }),
    }).catch(() => {});
  }
  ElMessage.success(`宸插垏鎹负 v${m.version} 鐗堟湰鍥剧墖`);
}
function toggleSceneRef(id) {
  const idx = selectedSceneRefs.value.indexOf(id);
  if (idx > -1) selectedSceneRefs.value.splice(idx, 1);
  else selectedSceneRefs.value.push(id);
}

// 鏃堕棿绾挎í鍚戞粴杞?鈥?鐢ㄥ師鐢?listener 缁曡繃 passive 闂
watch(tlTrack, (el, _, onCleanup) => {
  if (!el) return;
  const updateArrows = () => {
    tlCanScrollLeft.value = el.scrollLeft > 1;
    tlCanScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
  };
  // 婊氳疆
  const wheelHandler = (e) => {
    e.preventDefault();
    if (el.scrollWidth <= el.clientWidth) return;
    el.scrollBy({ left: (e.deltaY || e.deltaX || 0) * 1.5, behavior: 'auto' });
    requestAnimationFrame(updateArrows);
  };
  // 榧犳爣鎷栨嫿锛?px闃堝€煎尯鍒嗙偣鍑讳笌鎷栧姩锛岃秴鍑哄悗璺熸墜婊戝姩锛?
  let dragging = false, dragStartX = 0, dragStartScroll = 0, hasDragged = false;
  const onDown = (e) => {
    if (e.target.closest('.tl-btn') || e.target.closest('.tl-img-clear') || e.target.closest('.tl-ver-badge') || e.target.closest('audio') || e.target.closest('.tl-arrow')) return;
    dragging = true; dragStartX = e.clientX; dragStartScroll = el.scrollLeft; hasDragged = false;
    document.body.classList.add('tl-dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    if (!hasDragged && Math.abs(dx) < 4) return;
    hasDragged = true;
    el.scrollLeft = dragStartScroll - dx;
    updateArrows();
  };
  const onUp = () => { dragging = false; document.body.classList.remove('tl-dragging'); };
  el.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  el.addEventListener('wheel', wheelHandler, { passive: false });
  el.addEventListener('scroll', updateArrows, { passive: true });
  onCleanup(() => {
    el.removeEventListener('wheel', wheelHandler);
    el.removeEventListener('scroll', updateArrows);
    el.removeEventListener('mousedown', onDown);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  });
  setTimeout(updateArrows, 500);
}, { flush: 'post' });

function tlScroll(px) {
  const el = tlTrack.value;
  if (!el) return;
  el.scrollBy({ left: px, behavior: 'smooth' });
}

async function onRefImageUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  // 闄愬埗鍗曟鏈€澶?寮?
  const remaining = 9 - currentRefImages.value.length;
  if (remaining <= 0) { ElMessage.warning('鏈€澶氫笂浼?寮犲弬鑰冨浘'); e.target.value = ''; return; }
  const toUpload = Array.from(files).slice(0, remaining);
  try {
    const res = await assetAPI.uploadReferenceFiles(toUpload);
    if (res.data?.urls) {
      currentRefImages.value.push(...res.data.urls);
      if (currentShot.value) currentShot.value._refImages = [...currentRefImages.value];
      ElMessage.success(`宸蹭笂浼?{res.data.urls.length}寮犲弬鑰冨浘`);
    }
  } catch (err) {
    ElMessage.error('涓婁紶澶辫触: ' + (err.response?.data?.message || err.message || ''));
  }
  e.target.value = '';
}

async function removeRefImage(i) {
  const url = currentRefImages.value[i];
  // 鏈嶅姟绔弬鑰冨浘锛氳皟鎺ュ彛鍒犻櫎鏂囦欢
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
  ElMessage.success(`绱犳潗 #${s.shotNumber} 宸插簲鐢ㄥ埌褰撳墠鍒嗛暅`);
}

// ===== 鍒嗛暅鍗＄墖鎸夐挳鍔熻兘 =====

async function uploadShotImage(shot, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!currentStoryboard.value?._id) { ElMessage.error('璇峰厛淇濆瓨鍒嗛暅琛?); e.target.value = ''; return; }

  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await storyboardAPI.uploadShotImage(
      currentStoryboard.value._id, shot.shotNumber, formData
    );
    shot.renderedImage = res.data.url;
    shot.status = 'completed';
    ElMessage.success(`鍒嗛暅 #${shot.shotNumber} 鍥剧墖宸蹭笂浼燻);
  } catch (err) {
    ElMessage.error(`涓婁紶澶辫触: ${err.response?.data?.message || err.message}`);
  }
  e.target.value = '';
}

async function uploadShotVideo(shot, e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!currentStoryboard.value?._id) { ElMessage.error('璇峰厛淇濆瓨鍒嗛暅琛?); e.target.value = ''; return; }

  // 璇诲彇瑙嗛鐪熷疄鏃堕暱
  let actualDuration = 0;
  try {
    const url = URL.createObjectURL(file);
    actualDuration = await new Promise((resolve) => {
      const v = document.createElement('video'); v.preload = 'metadata';
      v.onloadedmetadata = () => { resolve(v.duration || 0); URL.revokeObjectURL(url); };
      v.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
      v.src = url;
    });
  } catch {}

  const formData = new FormData();
  formData.append('video', file);
  try {
    const res = await storyboardAPI.uploadShotVideo(
      currentStoryboard.value._id, shot.shotNumber, formData
    );
    shot.renderedVideo = res.data.url;
    shot.status = 'completed';
    if (actualDuration > 0) {
      shot.duration = Math.ceil(actualDuration);
      // 寮哄埗鍝嶅簲寮忔洿鏂?
      const shots = currentStoryboard.value.shots;
      const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
      if (idx >= 0) shots[idx].duration = shot.duration;
      // 鎸佷箙鍖栨椂闀?
      await storyboardAPI.updateShot(currentStoryboard.value._id, shot.shotNumber, { duration: shot.duration, renderedVideo: shot.renderedVideo, status: 'completed' }).catch(() => {});
      ElMessage.success(`鍒嗛暅 #${shot.shotNumber} 瑙嗛宸蹭笂浼狅紝鏃堕暱 ${shot.duration}s`);
    } else {
      ElMessage.success(`鍒嗛暅 #${shot.shotNumber} 瑙嗛宸蹭笂浼燻);
    }
  } catch (err) {
    ElMessage.error(`涓婁紶澶辫触: ${err.response?.data?.message || err.message}`);
  }
  e.target.value = '';
}

function copyShot(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  const copy = JSON.parse(JSON.stringify(shot));
  copy.shotNumber = shot.shotNumber + 0.5; // 涓存椂缂栧彿
  shots.splice(idx + 1, 0, copy);
  renumberShots();
  ElMessage.success(`宸插鍒跺垎闀?#${shot.shotNumber}`);
}

function insertShotAfter(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  shots.splice(idx + 1, 0, {
    shotNumber: shot.shotNumber + 0.5,
    sceneName: shot.sceneName || '',
    shotType: '涓櫙', cameraMovement: '鍥哄畾', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
  ElMessage.success(`宸插湪 #${shot.shotNumber} 鍚庢彃鍏ユ柊鍒嗛暅`);
}

async function clearShotMedia(shot, type) {
  if (!currentStoryboard.value?._id) { ElMessage.error('璇峰厛淇濆瓨鍒嗛暅琛?); return; }
  try {
    await ElMessageBox.confirm(
      type === 'image' ? '娓呴櫎璇ラ暅澶寸殑鍥剧墖锛熸枃浠朵繚鐣欏湪鏈嶅姟鍣紝鍙噸鏂颁笂浼犮€? : '娓呴櫎璇ラ暅澶寸殑瑙嗛锛熸枃浠朵繚鐣欏湪鏈嶅姟鍣紝鍙噸鏂颁笂浼犮€?,
      '娓呴櫎濯掍綋', { type: 'warning', confirmButtonText: '纭娓呴櫎', cancelButtonText: '鍙栨秷' }
    );
  } catch { return; }

  const field = type === 'image' ? 'renderedImage' : 'renderedVideo';
  shot[field] = '';
  shot.status = 'pending';
  // 淇濈暀 materials 鍘嗗彶鐗堟湰涓嶅垹
  try {
    await storyboardAPI.updateShot(currentStoryboard.value._id, shot.shotNumber, { [field]: '', status: 'pending' });
    ElMessage.success(`宸叉竻闄?{type === 'image' ? '鍥剧墖' : '瑙嗛'}`);
  } catch { ElMessage.error('淇濆瓨澶辫触'); }
}

async function deleteShot(shot) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  if (shots.length <= 1) { ElMessage.warning('鑷冲皯淇濈暀涓€涓垎闀?); return; }
  try {
    await ElMessageBox.confirm(`纭绉婚櫎鍒嗛暅 #${shot.shotNumber}锛熸鎿嶄綔涓嶅彲鎾ら攢銆俙, '鍒犻櫎纭', { type: 'warning', confirmButtonText: '纭绉婚櫎', cancelButtonText: '鍙栨秷' });
  } catch { return; }
  const idx = shots.findIndex(s => s.shotNumber === shot.shotNumber);
  if (idx === -1) return;
  shots.splice(idx, 1);
  renumberShots();
  if (currentShot.value?.shotNumber === shot.shotNumber) {
    currentShot.value = shots[Math.min(idx, shots.length - 1)] || null;
  }
  ElMessage.success(`宸茬Щ闄ゅ垎闀?#${shot.shotNumber}`);
}

function insertAt(idx) {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  shots.splice(idx, 0, {
    shotNumber: idx + 0.5, sceneName: shots[idx]?.sceneName || '',
    shotType: '涓櫙', cameraMovement: '鍥哄畾', duration: 3,
    imageDescription: '', renderedImage: '', renderedVideo: '',
    dialogue: { characterName: '', text: '', audioUrl: '' },
    soundEffect: '', notes: '', status: 'pending',
    _imagePrompt: '', _videoPrompt: '', _refImages: [],
  });
  renumberShots();
  ElMessage.success(`宸插湪浣嶇疆 #${idx + 1} 鎻掑叆鏂板垎闀渀);
}

function addBlankShot() {
  if (!currentStoryboard.value) return;
  const shots = currentStoryboard.value.shots;
  shots.push({
    shotNumber: shots.length + 1, sceneName: '',
    shotType: '涓櫙', cameraMovement: '鍥哄畾', duration: 3,
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
  if (pending.length === 0) { ElMessage.warning('娌℃湁寰呯敓鎴愮殑鍒嗛暅锛堥渶瑕佸厛濉啓鎻愮ず璇嶏級'); return; }
  try { await ElMessageBox.confirm(`灏嗕负 ${pending.length} 涓垎闀滄壒閲忕敓鎴愬浘鐗囷紝纭寮€濮嬶紵`, '鎵归噺鐢熷浘', { type: 'info' }); } catch { return; }
  batchGenning.value = true;
  window.__imgGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  for (const s of pending) {
    genningShotSet.add(s.shotNumber);
    try {
      const prompt = s._imagePrompt || s.imageDescription;
      const res = await fetch('/api/v1/assets/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'character', prompt, model: selectedModel.value, referenceImages: s._refImages || [] })
      });
      const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '鐢熸垚澶辫触'); genningShotSet.delete(s.shotNumber); continue; }
      if (data.data?.imageUrl) { s.renderedImage = data.data.imageUrl; done++; const mats2 = s.materials || []; mats2.push({ version: mats2.length + 1, type: "image", url: data.data.imageUrl, prompt: s._imagePrompt || "", createdAt: new Date().toISOString() }); s.materials = mats2; const mats = s.materials || []; mats.push({ version: mats.length + 1, type: "image", url: data.data.imageUrl, prompt: s._imagePrompt || "", createdAt: new Date().toISOString() }); s.materials = mats; try { if (currentStoryboard.value?._id) { const token2 = localStorage.getItem('token'); await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${s.shotNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` }, body: JSON.stringify({ renderedImage: data.data.imageUrl, materials: s.materials }) }); } } catch {} }
    } catch (e) { console.error('batch image fail:', e); }
  }
  batchGenning.value = false;
  window.__imgGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`鎵归噺鐢熷浘瀹屾垚锛?{done}/${pending.length}`);
}

async function batchGenerateVideos() {
  if (!currentStoryboard.value) return;
  const pending = currentStoryboard.value.shots.filter(s => !s.renderedVideo && (s._videoPrompt || s.imageDescription));
  if (pending.length === 0) { ElMessage.warning('娌℃湁寰呯敓鎴愮殑鍒嗛暅锛堥渶瑕佸厛濉啓瑙嗛鎻愮ず璇嶏級'); return; }
  try { await ElMessageBox.confirm(`灏嗕负 ${pending.length} 涓垎闀滄壒閲忕敓鎴愯棰戯紝纭寮€濮嬶紵`, '鎵归噺鐢熻棰?, { type: 'info' }); } catch { return; }
  batchGenningVideo.value = true;
  window.__videoGenning = true;
  window.__setLoading?.(true);
  let done = 0;
  // 鎵归噺鐢熻棰戝鐢ㄩ€変腑鍙傝€冭鑹蹭綔涓哄厹搴曞弬鑰冨浘
  const fallbackUrls = [];
  selectedRefs.value.forEach(id => { const url = getRefUrl(assetStore.characters.find(x => x._id === id)); if (url) fallbackUrls.push(url); });
  selectedSceneRefs.value.forEach(id => { const url = getRefUrl(assetStore.scenes.find(x => x._id === id)); if (url) fallbackUrls.push(url); });

  for (const s of pending) {
    genningShotSet.add(s.shotNumber);
    try {
      const prompt = s._videoPrompt || s.imageDescription;
      const parsedRefs = prompt ? parsePromptRefs(prompt) : [];
      const refUrls = parsedRefs.length > 0 ? parsedRefs.filter(r => r.url).map(r => r.url) : fallbackUrls;
      // 娉ㄥ叆鍦烘櫙/瑙掕壊鎻忚堪鍒?prompt 涓?
      let batchPrompt = prompt;
      const sceneDescsBatch = parsedRefs.filter(r => r.appearance && !assetStore.characters.some(c => c.name === r.name)).map(r => `銆愬満鏅?${r.name}銆?{r.appearance}`).join('锛?);
      if (sceneDescsBatch) batchPrompt = sceneDescsBatch + '銆? + batchPrompt;
      const charDescsBatch = parsedRefs.filter(r => r.appearance && assetStore.characters.some(c => c.name === r.name)).map(r => `銆?{r.name}澶栬矊銆?{r.appearance}`).join('锛?);
      if (charDescsBatch) batchPrompt = charDescsBatch + '銆? + batchPrompt;
      const res = await fetch('/api/v1/assets/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'video', prompt: batchPrompt, model: selectedVideoModel.value, inputImage: s.renderedImage || '', referenceImages: refUrls, duration: s.duration || 5, ratio: videoRatio.value, resolution: videoResolution.value, watermark: !videoNoWatermark.value, generateAudio: videoGenAudio.value })
      });
      const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '鐢熸垚澶辫触'); genningShotSet.delete(s.shotNumber); continue; }
      if (data.data?.imageUrl) { s.renderedVideo = data.data.imageUrl; done++; try { if (currentStoryboard.value?._id) { const token = localStorage.getItem('token'); await fetch(`/api/v1/storyboards/${currentStoryboard.value._id}/shots/${s.shotNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ renderedVideo: data.data.imageUrl }) }); } } catch {} }
    } catch (e) { console.error('batch video fail:', e); }
  }
  batchGenningVideo.value = false;
  window.__videoGenning = false;
  window.__setLoading?.(false);
  ElMessage.success(`鎵归噺鐢熻棰戝畬鎴愶細${done}/${pending.length}`);
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
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'storyboard', existingPrompt: '浣犳槸AI缁樺浘鎻愮ず璇嶄笓瀹躲€傛牴鎹垎闀滄弿杩扮敓鎴愰珮璐ㄩ噺涓枃鍥剧墖鎻愮ず璇嶏紝鍖呭惈鐢婚潰鍐呭銆佷汉鐗╁姩浣溿€佸満鏅皼鍥淬€佸厜褰便€佹瀯鍥俱€侀鏍笺€傚彧杈撳嚭瀹屾暣鎻愮ず璇嶃€俓\n\\n鍒嗛暅鎻忚堪锛? + currentShotPrompt.value + '\\n\\n璇风敓鎴愬畬鏁村浘鐗囨彁绀鸿瘝銆? })
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '鐢熸垚澶辫触'); return; }
    currentShotPrompt.value = data.data?.prompt || currentShotPrompt.value;
    saveCurrentPrompt();
    ElMessage.success('鍥剧墖鎻愮ず璇嶅凡鐢熸垚');
  } catch (e) { ElMessage.error('鐢熸垚澶辫触'); }
  finally { genningPrompt.value = false; }
}

async function generateVideoPromptForShot() {
  if (!currentShot.value) return;
  genningVideoPrompt.value = true;
  try {
    const s = currentShot.value;
    const dialogues = s._dialogues || [];
    const dialogueText = dialogues.map(d => (d.characterName || '') + '锛? + (d.text || '') + (d.actionHint ? '(' + d.actionHint + ')' : '')).filter(x => x.includes('锛?)).join('锛?);
    const charNames = [...new Set(dialogues.map(d => d.characterName).filter(Boolean))];
    const charAppearances = [];
    charNames.forEach(name => {
      const c = assetStore.characters.find(x => x.name === name);
      if (c && c.appearance) charAppearances.push('銆? + name + '銆? + c.appearance);
    });
    const parts = [
      '鍦烘櫙锛? + (s.sceneName || '') + '锛? + (s._timeOfDay || '') + '锛? + (s._atmosphere || ''),
      '鏅埆锛? + (s.shotType || '涓櫙') + '锛岃繍闀滐細' + (s.cameraMovement || '鍥哄畾'),
      '鏃堕暱锛? + videoDuration.value + '绉?,
      dialogueText ? '鍙拌瘝锛? + dialogueText : '',
      charAppearances.length > 0 ? '瑙掕壊澶栬矊锛? + charAppearances.join('锛?) : '',
      s.imageDescription ? '鐢婚潰鎻忚堪锛? + s.imageDescription : '',
    ].filter(Boolean).join('\n');
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'video', existingPrompt: '浣犳槸鐭棰戝婕斻€傛牴鎹互涓嬪垎闀滀俊鎭敓鎴愪竴娈靛畬鏁寸殑瑙嗛鎻愮ず璇嶃€傝姹傦細鍖呭惈鐢婚潰鎻忚堪銆佽繍闀滄柟寮忋€佷汉鐗╁姩浣溿€佸彴璇嶈妭濂忋€佸厜褰辨皼鍥达紝閫傚悎' + videoDuration.value + '绉掔珫灞忕煭瑙嗛銆傚彧杈撳嚭瑙嗛鎻愮ず璇嶆枃鏈€俓n\n' + parts })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || '鐢熸垚澶辫触'); return; }
    if (data.data?.prompt) {
      currentVideoPrompt.value = data.data.prompt;
      saveCurrentVideoPrompt();
      nextTick(() => renderEditor(data.data.prompt));
      ElMessage.success('瑙嗛鎻愮ず璇嶅凡鐢熸垚锛堝惈鍙拌瘝鑺傚锛?);
    }
  } catch (e) { ElMessage.error('鐢熸垚澶辫触: ' + (e.message || '')); }
  finally { genningVideoPrompt.value = false; }
}
async function generateTimedStoryboard() {
  if (!currentVideoPrompt.value) { ElMessage.warning('璇峰厛鐢熸垚鎴栧～鍐欒棰戞彁绀鸿瘝'); return; }
  genningTimedSB.value = true;
  try {
    const totalDuration = videoDuration.value;
    const sysPrompt = `浣犳槸鐭棰戝垎闀滃婕斻€傚皢涓€娈佃棰戞彁绀鸿瘝鎷嗗垎涓哄甫鏃堕棿杞寸殑澶氶暅澶村垎闀滆剼鏈€?

瑙勫垯锛?
1. 鎬绘椂闀垮浐瀹氫负${totalDuration}绉掋€?
2. 鏍规嵁鍐呭澶嶆潅搴﹁嚜鍔ㄥ悎鐞嗗垎閰嶇鏁帮紝鍔ㄤ綔/瀵硅瘽鍚勫垎閰嶈冻澶熸椂闂淬€?
3. 姣忎釜闀滃ご鐨勭鏁颁笉鍥哄畾锛屾牴鎹姩浣滃拰鍙拌瘝閲忔櫤鑳藉垽鏂紙閫氬父2-6绉掍竴涓暅澶达級銆?
4. 姣忎釜闀滃ご鏍囨敞鏃堕棿鍖洪棿銆佹櫙鍒€佽繍闀溿€佺敾闈㈠唴瀹广€?
5. 鍖呭惈鎵€鏈夊彴璇嶏紝鍒嗛厤鍙拌瘝鍒板搴旈暅澶淬€?
6. 缁撳熬鍔犱笂绾︽潫锛氭棤瀛楀箷锛岄潰閮ㄤ笉鍙樺舰锛屼汉浣撶粨鏋勬甯搞€?
7. 鐩存帴杈撳嚭鏈€缁堟枃鏈紝涓嶈JSON锛屼笉瑕佸浣欒В閲娿€傜被浼兼牸寮忥細
  ${totalDuration}绉掔珫灞?:16锛岃秴鍐欏疄鐢靛奖绾ф憚褰憋紝鏃犲瓧骞曘€?

  闀滃ご1锛?-X绉掞級锛歔鏅埆]锛孾鐢婚潰鍐呭]銆備汉鐗╁姩浣溿€傝繍闀滄柟寮忋€?
  闀滃ご2锛圶-Y绉掞級锛?..
  ...`;
    const res = await fetch('/api/v1/assets/generate-prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: currentProjectId.value, assetType: 'storyboard', existingPrompt: sysPrompt + '\n\n寰呮媶鍒嗗唴瀹癸細\n' + currentVideoPrompt.value })
    });
    const data = await res.json();
    if (!res.ok) { ElMessage.error(data.message || 'AI鍒嗛暅澶辫触'); return; }
    if (data.data?.prompt) {
      currentVideoPrompt.value = data.data.prompt;
      saveCurrentVideoPrompt();
      nextTick(() => renderEditor(data.data.prompt));
      ElMessage.success('宸茬敓鎴愭櫤鑳芥椂闂磋酱鍒嗛暅锛?);
    }
  } catch (e) { ElMessage.error('鍒嗛暅澶辫触: ' + (e.message || '')); }
  finally { genningTimedSB.value = false; }
}
async function generateImageForShot() {
  if (!currentShot.value || !currentShotPrompt.value) { ElMessage.warning('璇峰厛濉啓鎻愮ず璇?); return; }
  const shot = currentShot.value;
  const shotNum = shot.shotNumber;
  genningImage.value = true;
  window.__imgGenning = true;
  window.__setLoading?.(true);
  try {
    genningShotSet.add(shotNum);
    // 鏀堕泦鍙傝€冨浘锛氶€変腑瑙掕壊 + 閫変腑鍦烘櫙 + 褰撳墠鍒嗛暅宸蹭笂浼犵殑鍙傝€冨浘
    const refUrls = [];
    const charAppearances = [];
    const sceneDescs = [];
    selectedRefs.value.forEach(id => {
      const c = assetStore.characters.find(x => x._id === id);
      if (!c) return;
      const url = getRefUrl(c);
      if (url) refUrls.push(url);
      const appearance = c.appearance || (c.morphs && c.morphs[0] && c.morphs[0].appearancePrompt) || '';
      if (appearance) charAppearances.push('銆? + c.name + '銆? + appearance);
    });
    selectedSceneRefs.value.forEach(id => {
      const s = assetStore.scenes.find(x => x._id === id);
      if (!s) return;
      const url = getRefUrl(s);
      if (url) refUrls.push(url);
      if (s.description || s.stylePrompt) sceneDescs.push(`銆愬満鏅?${s.sceneName}銆?{s.description || s.stylePrompt}`);
    });
    if (shot._refImages?.length) refUrls.push(...shot._refImages);

    let enrichedPrompt = currentShotPrompt.value;
    if (charAppearances.length > 0) {
      enrichedPrompt += '锛涖€愯鑹插璨岀害鏉熉峰繀椤婚伒瀹堛€戜弗鏍兼寜鐓т互涓嬭鑹茶瀹氱敓鎴愶紝淇濇寔浜虹墿浜斿畼銆佸彂鍨嬨€佹湇楗?00%涓€鑷达細' + charAppearances.join('锛?) + '锛涙敞鎰忥細闈㈤儴鐗瑰緛銆佸彂鍨嬪彂鑹层€佹湇楗伴鏍煎繀椤讳笌浠ヤ笂璁惧畾瀹屽叏鍚诲悎锛屼笉寰楁敼鍙?;
    }
    if (sceneDescs.length > 0) {
      enrichedPrompt += '锛涖€愬満鏅害鏉熉峰繀椤婚伒瀹堛€戜弗鏍兼寜鐓т互涓嬪満鏅瀹氱敓鎴愮敾闈㈢幆澧冿紝淇濇寔鍦烘櫙寤虹瓚銆佸鍐呭竷灞€銆佸厜褰辫壊璋?00%涓€鑷达細' + sceneDescs.join('锛?) + '锛涙敞鎰忥細鍦烘櫙鐨勫缓绛戦鏍笺€佸鍐呰璁°€佺伅鍏夋皼鍥村繀椤讳笌浠ヤ笂璁惧畾瀹屽叏鍚诲悎';
    }
    console.log('[鐢熷浘] 鍙傝€冨浘鏁伴噺:', refUrls.length, '瑙掕壊澶栬矊鎻忚堪:', charAppearances.length, '鍦烘櫙鎻忚堪:', sceneDescs.length, 'URLs:', refUrls);
    const res = await fetch('/api/v1/assets/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ projectId: currentProjectId.value, assetId: '', assetType: 'character', prompt: enrichedPrompt, model: selectedModel.value, referenceImages: refUrls })
    });
    const data = await res.json();
if (!res.ok) { ElMessage.error(data.message || '鐢熸垚澶辫触'); genningShotSet.delete(shotNum); return; }
    if (data.data?.imageUrl) {
      shot.renderedImage = data.data.imageUrl;
      const mats = shot.materials || []; mats.push({ version: mats.length + 1, type: "image", url: data.data.imageUrl, prompt: currentShotPrompt.value, createdAt: new Date().toISOString() }); shot.materials = mats;
      // 鎸佷箙鍖栧埌鏁版嵁搴?
      if (currentStoryboard.value?._id) {
        try { await storyboardAPI.updateShot(currentStoryboard.value._id, shotNum, { renderedImage: data.data.imageUrl, materials: mats }); } catch {}
      }
      ElMessage.success('鍥剧墖鐢熸垚瀹屾垚锛屽凡淇濆瓨鍒版暟鎹簱');
    }
  } catch (e) { ElMessage.error('鐢熸垚澶辫触'); }
  finally {
    genningShotSet.delete(shotNum);
    genningImage.value = false;
    window.__imgGenning = false;
    window.__setLoading?.(false);
  }
}

// 瑙嗛鐢熸垚 polling 鐘舵€?鈥?key: `${scriptId}_${shotNumber}`
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
  const m = { queued: '鎺掗槦涓?, submitted: '宸叉彁浜?, running: '鐢熸垚涓?, processing: '澶勭悊涓?, succeeded: '宸插畬鎴?, failed: '澶辫触', cancelled: '宸插彇娑?, expired: '宸茶繃鏈? };
  return m[s] || s || '澶勭悊涓?;
}

async function generateVideoForShot() {
  if (!currentShot.value || !currentVideoPrompt.value) { ElMessage.warning('璇峰厛濉啓鎴栫敓鎴愯棰戞彁绀鸿瘝'); return; }
  const vShot = currentShot.value;
  const vShotNum = vShot.shotNumber;
  genningVideo.value = true;
  window.__videoGenning = true;
  window.__setLoading?.(true);
  try {
    genningShotSet.add(vShotNum);
    const prompt = currentVideoPrompt.value;
    // 瑙ｆ瀽 @寮曠敤 鈫?鏈夊簭鎺掑垪鍙傝€冨浘 + 澶栬矊/鍦烘櫙鎻忚堪
    const parsedRefs = parsePromptRefs(prompt);
    const refUrls = parsedRefs.filter(r => r.url).map(r => r.url);
    // 鍖哄垎瑙掕壊鍜屽満鏅殑鎻忚堪淇℃伅
    const charDescs = [];
    const sceneDescs = [];
    parsedRefs.forEach(r => {
      if (!r.appearance) return;
      // 閫氳繃鍚嶅瓧鏌ユ壘鏄鑹茶繕鏄満鏅?
      const isChar = assetStore.characters.some(c => c.name === r.name);
      if (isChar) {
        charDescs.push(`銆?{r.name}澶栬矊銆?{r.appearance}`);
      } else {
        sceneDescs.push(`銆愬満鏅?${r.name}銆?{r.appearance}`);
      }
    });
    const promptParts = [];
    if (charDescs.length) promptParts.push(charDescs.join('锛?));
    if (sceneDescs.length) promptParts.push(sceneDescs.join('锛?));
    if (promptParts.length) promptParts.push(prompt);
    const finalPrompt = promptParts.length ? promptParts.join('銆?) : prompt;

    // 鍏滃簳锛氬鏋?prompt 閲屾病鍐?@寮曠敤锛屽鐢ㄥ彸渚ч€変腑瑙掕壊 + 鍦烘櫙
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
    if (vShot._refImages?.length) {
      vShot._refImages.forEach(u => { if (!refUrls.includes(u)) refUrls.push(u); });
    }
    const inputImage = vShot.renderedImage || '';

    console.log('[鐢熻棰慮', JSON.stringify({
      shot: vShotNum,
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
    if (!res.ok) { ElMessage.error(data.message || '瑙嗛鐢熸垚澶辫触'); return; }

    const taskId = data.data?.imageUrl;
    if (!taskId) { ElMessage.error('鏈幏鍙栧埌瑙嗛浠诲姟ID'); return; }

    // 淇濆瓨 taskId 鍒?shot + localStorage 鎸佷箙鍖栵紙鍒锋柊椤甸潰涔熶笉涓㈠け锛?
    vShot.renderedVideo = taskId;
    vShot._videoTaskId = taskId;
    const task = { taskId, shotNumber: vShotNum, startTime: Date.now(), storyboardId: currentStoryboard.value?._id, scriptId: currentScriptId.value };
    try {
      const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
      tasks[taskId] = task;
      localStorage.setItem('ad_video_tasks', JSON.stringify(tasks));
    } catch {}
    ElMessage.success('瑙嗛浠诲姟宸叉彁浜わ紝鍚庡彴鐢熸垚涓紙绾?-3鍒嗛挓锛夛紝鍙垏鎹㈤〉闈㈢◢鍚庡洖鏉ョ湅');
    window.__addNotification?.('瑙嗛浠诲姟宸叉彁浜?, 'info', '鈴?);

    startVideoPolling(taskId, vShotNum, currentStoryboard.value?._id, currentScriptId.value);
  } catch (e) { ElMessage.error('瑙嗛鐢熸垚澶辫触: ' + (e.message || '')); }
  finally {
    genningShotSet.delete(vShotNum);
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
          ElMessage.success(`闀滃ご ${shotNum} 瑙嗛鐢熸垚瀹屾垚 馃帀`);
          window.__addNotification?.(`闀滃ご ${shotNum} 瑙嗛瀹屾垚`, 'success', '馃帴');
        } else {
          if (currentStoryboard.value?.shots) {
            const shot = currentStoryboard.value.shots.find(s => s.shotNumber === shotNum);
            if (shot && shot.renderedVideo === taskId) { shot.renderedVideo = ''; shot.status = 'failed'; }
          }
          ElMessage.warning(`闀滃ご ${shotNum} 瑙嗛澶辫触: ${d.status}`);
        }
        delete videoPollingMap[key];
      } else {
        e.status = d.status || 'processing';
      }
    } catch { /* 缁х画杞 */ }
  }, 5000);
}

function resumeVideoTasks() {
  try {
    const tasks = JSON.parse(localStorage.getItem('ad_video_tasks') || '{}');
    const entries = Object.values(tasks);
    if (entries.length === 0) return;
    console.log('[瑙嗛] 鎭㈠鏈畬鎴愪换鍔?', entries.length, '涓?);
    entries.forEach(t => {
      startVideoPolling(t.taskId, t.shotNumber, t.storyboardId, t.scriptId);
    });
  } catch {}
}

onUnmounted(() => { Object.values(videoPollTimers).forEach(clearInterval); });

function formatEpLabel(ep) {
  const title = (ep.episodeTitle || '').replace(/^绗琝d+闆哰锛?]*\s*/, '').trim();
  return title ? `绗?{ep.episodeNumber}闆嗭細${title}` : `绗?{ep.episodeNumber}闆哷;
}

// ===== TTS 閰嶉煶 =====
const showTTSDialog = ref(false);
const ttsTargetShot = ref(null);
const synthingShot = ref(null);
const ttsSelectedDi = ref(-1); // 褰撳墠閫変腑鐨勫彴璇嶇储寮?
const ttsDialogueOptions = ref([]); // 澶囬€夊彴璇嶅垪琛?
const ttsBatchRunning = ref(false);
const ttsParams = reactive({ speaker: 'zh_female_vv_uranus_bigtts', speechRate: 0, loudnessRate: 0 });
const ttsCustomSpeaker = ref('');

const ttsVoiceOptions = ref([{ label: '鍔犺浇涓?..', value: '' }]);

async function fetchTTSVoices() {
  try {
    const { data } = await configAPI.getTTSVoices();
    if (data && data.length > 0) {
      const opts = [{ label: '鑷畾涔夐煶鑹睮D (鎵嬪姩杈撳叆)', value: '__custom__' }];
      const byGender = {};
      data.forEach(v => { const g = v.gender || '鍏朵粬'; if (!byGender[g]) byGender[g] = []; byGender[g].push({ label: v.name, value: v.id }); });
      Object.entries(byGender).forEach(([g, voices]) => { opts.push({ label: `鈹€鈹€鈹€鈹€ ${g}澹?鈹€鈹€鈹€鈹€`, value: '', disabled: true }); opts.push(...voices); });
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
  // 鏀堕泦 _dialogues + dialogue 浣滀负澶囬€夊彴璇?
  const dialogues = (shot._dialogues || []).filter(d => d.text && d.text.trim());
  if ((!dialogues.length) && shot.dialogue?.text && shot.dialogue.text.trim()) {
    dialogues.push(shot.dialogue);
  }
  ttsDialogueOptions.value = dialogues;
  ttsSelectedDi.value = dialogues.length > 0 ? 0 : -1;
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
      ElMessage.success(`鎵归噺閰嶉煶瀹屾垚: ${ok}/${data.results?.length || 0}`);
      if (currentStoryboard.value) {
        const sb = await storyboardAPI.get(currentStoryboard.value._id);
        if (sb?.data) { currentStoryboard.value = sb.data; }
      }
    } else {
      const shot = ttsTargetShot.value;
      const sel = ttsDialogueOptions.value[ttsSelectedDi.value];
      const text = sel?.text || shot.dialogue?.text || shot.imageDescription || '';
      const charName = sel?.characterName || shot.dialogue?.characterName || '';
      if (!text.trim()) { ElMessage.warning('璇ラ暅澶存病鏈夊彴璇?); return; }
      const { data } = await ttsAPI.synthesize({
        storyboardId: currentStoryboard.value._id,
        shotNumber: shot.shotNumber,
        text, characterName: charName,
        projectId: currentProjectId.value,
        scriptId: currentScriptId.value,
        speaker, speechRate: ttsParams.speechRate, loudnessRate: ttsParams.loudnessRate,
      });
      if (shot.dialogue) shot.dialogue.audioUrl = data.audioUrl;
      ElMessage.success('閰嶉煶瀹屾垚');
    }
  } catch (e) { ElMessage.error(e.response?.data?.message || '閰嶉煶澶辫触'); }
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
if (!res.ok) { ElMessage.error(data.message || '鐢熸垚澶辫触'); genningShotSet.delete((currentStoryboard.value?.shots?.find(x=>x.shotNumber===currentShot?.value?.shotNumber)?.shotNumber || 0)); return; }

    if (fmt === 'pdf') {
      // PDF: 鎵撳紑鎵撳嵃绐楀彛
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(data.html); w.document.close(); setTimeout(() => w.print(), 500); }
    } else if (fmt === 'html') {
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename + '.html';
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('涓嬭浇瀹屾垚');
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
      ElMessage.success('涓嬭浇瀹屾垚');
    }
  } catch (e) { ElMessage.error('瀵煎嚭澶辫触'); }
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
      ElMessage.success('PNG 瀵煎嚭瀹屾垚');
    }, 'image/png');
  } catch (e) { ElMessage.error('PNG 鎴浘澶辫触'); }
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
    ElMessage.success('瀵煎叆鎴愬姛');
  } catch (e) { ElMessage.error('瀵煎叆澶辫触'); }
  finally { importing.value = false; }
}
</script>

<style scoped>
/* ===== CINEMATIC SUITE 鈥?鍏ㄩ潰缇庡寲 ===== */

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

/* 椤圭洰鑳跺泭婊氬姩鍖哄煙 鈥?鍙充晶娓愬彉鏆楃ず鍙粴鍔?*/
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

/* 椤甸潰灏辩华鍓嶇殑鍔犺浇楠ㄦ灦 */
.sb-loader-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 300px; }
.sb-loader-ring {
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(201,168,76,0.06); display: flex; align-items: center; justify-content: center;
  animation: pp-breathe 2.5s ease-in-out infinite;
}
.sb-loader-inner { animation: pp-spin 8s linear infinite; opacity: 0.4; }
.sb-loader-text { font-size: 13px; color: rgba(139,105,20,0.35); letter-spacing: 3px; font-weight: 700; }

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

/* Preview 鈥?澧炲己鐢靛奖鎰?*/
.preview-area {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
  border-radius: 16px;
  border: 2px solid rgba(201,168,76,0.2);
  flex: 1; display: flex; align-items: stretch; justify-content: center;
  overflow: hidden; position: relative;
  box-shadow: inset 0 0 80px rgba(0,0,0,0.3), 0 4px 24px rgba(0,0,0,0.15);
}
.preview-area::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.08) 100%);
  pointer-events: none; z-index: 1;
}
.preview-empty { text-align: center; color: rgba(255,255,255,0.5); position: relative; z-index: 2; }
.preview-empty p { margin-top: 12px; font-size: 14px; color: rgba(255,255,255,0.4); opacity: 0.6; letter-spacing: 1px; }
.preview-shot { display: flex; flex-direction: column; text-align: center; width: 100%; height: 100%; position: relative; z-index: 2; }
.preview-frame {
  flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; padding: 0 16px;
  position: relative;
}
/* 寰呯敓鎴愬崰浣?*/
.preview-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 2; }
.pp-pulse-ring {
  width: 80px; height: 80px; border-radius: 50%;
  background: rgba(201,168,76,0.06); display: flex; align-items: center; justify-content: center;
  animation: pp-breathe 2.5s ease-in-out infinite;
}
.pp-pulse-ring-inner { animation: pp-spin 8s linear infinite; opacity: 0.5; }
@keyframes pp-breathe {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(201,168,76,0.15); }
  50% { transform: scale(1.08); box-shadow: 0 0 0 12px rgba(201,168,76,0); }
}
@keyframes pp-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.pp-label {
  font-size: 14px; font-weight: 700; color: rgba(201,168,76,0.35); letter-spacing: 4px;
  text-transform: uppercase;
}
.pp-hint {
  font-size: 11px; color: rgba(255,255,255,0.25); letter-spacing: 1px;
}
.preview-clear {
  position: absolute; top: 8px; right: 8px; width: 22px; height: 22px;
  background: rgba(0,0,0,0.65); color: #fff; font-size: 13px; line-height: 22px;
  text-align: center; border-radius: 50%; cursor: pointer; z-index: 5;
  transition: background 0.2s;
}
.preview-clear:hover { background: #e74c3c; }
.preview-info {
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 6px; align-items: center; z-index: 3;
}
.pi-dur {
  font-size: 11px; color: #fff; background: rgba(0,0,0,0.5);
  padding: 2px 6px; border-radius: 3px; font-weight: 600;
}
.pi-tag {
  background: linear-gradient(135deg, var(--gold) 0%, #b8943a 100%);
  color: #fff; padding: 4px 12px;
  border-radius: 4px; font-size: 11px; font-weight: 700;
  letter-spacing: 1.5px; box-shadow: 0 2px 6px rgba(201,168,76,0.3);
}
.preview-dialogue {
  padding: 8px 16px; color: rgba(255,255,255,0.75); font-size: 12px;
  background: rgba(0,0,0,0.25); border-top: 1px solid rgba(201,168,76,0.12);
  letter-spacing: 0.2px; height: 60px; overflow-y: auto; flex-shrink: 0;
  scrollbar-width: thin; scrollbar-color: rgba(201,168,76,0.25) transparent;
  mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
}
.preview-dialogue-line { padding: 1px 0; line-height: 1.35; }
.preview-dialogue-line + .preview-dialogue-line { border-top: 1px solid rgba(255,255,255,0.06); }
.preview-dialogue::-webkit-scrollbar { width: 4px; }
.preview-dialogue::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.25); border-radius: 2px; }

/* Timeline 鈥?鍗＄墖鍗囩骇 */
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
.tl-track-wrap { position: relative; }
.tl-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 28px; height: 56px; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.6); color: var(--gold); font-size: 11px; cursor: pointer;
  border-radius: 4px; z-index: 5; user-select: none;
}
.tl-arrow:hover { background: var(--gold); color: #000; }
.tl-arrow-left { left: 0; }
.tl-arrow-right { right: 0; }
.tl-arrow-fade-enter-active { transition: opacity 0.2s; }
.tl-arrow-fade-leave-active { transition: opacity 0.15s; }
.tl-arrow-fade-enter-from, .tl-arrow-fade-leave-to { opacity: 0; }
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
.tl-img { width: 100%; height: 72px; background: var(--navy); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; position: relative; }
.tl-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.tl-card:hover .tl-img img { transform: scale(1.05); }
.tl-img-clear {
  position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
  background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; line-height: 18px;
  text-align: center; border-radius: 50%; cursor: pointer; opacity: 0;
  transition: opacity 0.2s; z-index: 5;
}
.tl-img:hover .tl-img-clear { opacity: 1; }
.tl-img-clear:hover { background: #e74c3c; }

/* 鍘嗗彶鐗堟湰寰界珷 */
.tl-ver-badge {
  position: absolute; bottom: 2px; left: 2px;
  background: rgba(201,168,76,0.85); color: #fff; font-size: 9px;
  padding: 1px 5px; border-radius: 3px; cursor: pointer; z-index: 4;
  font-weight: 700; letter-spacing: 0.5px; opacity: 0;
  transition: opacity 0.2s;
}
.tl-img:hover .tl-ver-badge { opacity: 1; }
.tl-ver-badge:hover { background: var(--gold); }

/* 鐗堟湰閫夋嫨寮圭獥 */
.tl-ver-popup {
  position: absolute; bottom: 22px; left: 0; right: 0;
  background: rgba(30,30,50,0.95); border: 1px solid var(--gold);
  border-radius: 6px; padding: 4px; z-index: 10;
  display: flex; gap: 4px; overflow-x: auto;
  scrollbar-width: thin; scrollbar-color: rgba(201,168,76,0.3) transparent;
}
.tl-ver-popup::-webkit-scrollbar { height: 3px; }
.tl-ver-popup::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 2px; }
.tl-ver-item {
  flex-shrink: 0; width: 44px; height: 44px; border-radius: 4px;
  overflow: hidden; cursor: pointer; position: relative;
  border: 1.5px solid transparent; transition: border-color 0.2s;
}
.tl-ver-item:hover { border-color: rgba(201,168,76,0.5); }
.tl-ver-active { border-color: var(--gold); }
.tl-ver-item img { width: 100%; height: 100%; object-fit: cover; }
.tl-ver-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.7); color: #fff; font-size: 8px;
  text-align: center; padding: 1px 0; letter-spacing: 0.5px;
}

/* 瑙嗛缂╃暐鍥?*/
.tl-video-thumb {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--navy) 0%, #1a1a2e 100%); cursor: pointer;
}
.tl-video-play {
  width: 28px; height: 28px; border-radius: 50%; background: rgba(201,168,76,0.85);
  display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff;
}

/* 鍗＄墖鐢熸垚涓?*/
@keyframes tl-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.tl-genning {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  background: linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.02) 100%);
}
.tl-genning-spin { font-size: 22px; color: var(--gold); animation: tl-spin 1.2s linear infinite; }
.tl-genning-text { font-size: 10px; color: var(--gold-dark); font-weight: 600; letter-spacing: 1px; }

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
  scrollbar-width: thin; scrollbar-color: transparent transparent;
}
.sb-right:hover { scrollbar-color: rgba(201,168,76,0.2) transparent; }
.sb-right::-webkit-scrollbar { width: 4px; }
.sb-right::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; transition: background 0.3s; }
.sb-right:hover::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.25); }
.sb-right::-webkit-scrollbar-track { background: transparent; }
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

/* Section 閲戠嚎鍒嗗壊 */
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

/* ===== 鍙傝€冧富浣撻€変腑鍔ㄦ晥 ===== */
@keyframes ref-fill {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}
@keyframes ref-border-glow {
  0%, 100% { border-color: var(--gold); }
  50% { border-color: #f0d060; }
}

.ref-chars { display: flex; flex-wrap: wrap; gap: 6px; }
.ref-chip {
  padding: 5px 12px; border-radius: 6px; background: rgba(251,247,240,0.7);
  font-size: 11px; cursor: pointer; border: 1.5px solid var(--bg-300);
  color: var(--text-200); font-weight: 500;
  transition: all 0.25s cubic-bezier(0.22,0.61,0.36,1);
  backdrop-filter: blur(4px);
  position: relative; overflow: hidden;
}
.ref-chip:hover { border-color: var(--gold); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(201,168,76,0.1); }
.ref-chip.active {
  color: var(--gold-dark) !important; font-weight: 700;
  background: linear-gradient(90deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.22) 25%, rgba(251,247,240,0.4) 50%, rgba(201,168,76,0.06) 75%, rgba(201,168,76,0.22) 100%);
  background-size: 200% 100%;
  animation: ref-fill 2.5s ease-in-out infinite, ref-border-glow 2.5s ease-in-out infinite;
  transform: translateY(-1px);
}
.ref-chip.has-img { border-color: rgba(201,168,76,0.4); }
.ref-chip:not(.has-img) { opacity: 0.55; }

/* 绱犳潗缃戞牸 */
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

/* 鍙傝€冨浘鐗囦笂浼?*/
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

/* ===== 鎻愮ず璇嶇紪杈戝櫒 ===== */
.prompt-editor-wrap { position: relative; }
.prompt-editor {
  min-height: 88px; max-height: 260px; overflow-y: auto;
  padding: 10px 14px; border: 1.5px solid var(--bg-300); border-radius: 8px;
  background: rgba(251,247,240,0.6); font-family: 'DM Sans','Microsoft YaHei',monospace;
  font-size: 12px; line-height: 1.7; color: var(--gold-dark);
  outline: none; cursor: text; word-break: break-word;
  transition: all 0.25s;
  scrollbar-width: thin; scrollbar-color: transparent transparent;
}
.prompt-editor:hover { scrollbar-color: rgba(201,168,76,0.2) transparent; }
.prompt-editor::-webkit-scrollbar { width: 4px; }
.prompt-editor::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; transition: background 0.3s; }
.prompt-editor:hover::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.25); }
.prompt-editor::-webkit-scrollbar-track { background: transparent; }
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
  font-size: 12px; pointer-events: none; opacity: 0.6;
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

/* ===== 鍥剧墖鏌ョ湅鍣?===== */
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

/* ===== 瑙嗛楂樼骇鍙傛暟 popover ===== */
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

/* ===== 绉诲姩绔?===== */
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

/* ===== 鍒犻櫎鎸夐挳 ===== */
.btn-danger-delete { background: #e74c3c !important; border-color: #e74c3c !important; color: #fff !important; font-weight: 600 !important; }
.btn-danger-delete:hover { background: #c0392b !important; border-color: #c0392b !important; color: #fff !important; }
.btn-danger-delete.is-disabled { background: #ebc9c6 !important; border-color: #ebc9c6 !important; color: rgba(255,255,255,0.7) !important; }

/* ===== 宸ュ叿鏍忔寜閽?===== */
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

/* ===== 闈㈠寘灞?===== */
.breadcrumb { padding: 4px 0 8px; flex-shrink: 0; }
</style>

<style>
/* ===== 瀵煎嚭/瀵煎叆瀵硅瘽妗?===== */
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
<style>
/* TTS 鍙拌瘝閫夋嫨鍒楄〃锛堝脊绐楁覆鏌撳湪 body 涓嬶紝蹇呴』闈?scoped锛?*/
.tts-dialogue-list { max-height: 200px; overflow-y: auto; border: 1px solid var(--bg-300, #e5e5e5); border-radius: 8px; }
.tts-dialogue-item { padding: 10px 12px; cursor: pointer; display: flex; gap: 8px; align-items: flex-start; border-bottom: 1px solid var(--bg-300, #f0f0f0); transition: background 0.15s; }
.tts-dialogue-item:last-child { border-bottom: none; }
.tts-dialogue-item:hover { background: rgba(201,168,76,0.06); }
.tts-dialogue-item.active { background: rgba(201,168,76,0.12); border-left: 3px solid var(--gold, #c9a84c); }
.tts-di-char { flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--gold-dark, #8b6914); min-width: 48px; }
.tts-di-text { font-size: 13px; color: var(--text-100, #333); line-height: 1.5; word-break: break-word; }
/* 时间线拖拽时强制 grab 鼠标样式 */
body.tl-dragging, body.tl-dragging * { cursor: grabbing !important; user-select: none !important; }
</style>
