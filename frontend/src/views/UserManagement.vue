<template>
  <div class="um-root">
    <div class="breadcrumb">
      <router-link to="/" class="bc-link">导演台</router-link>
      <span class="bc-sep"> &gt; </span>
      <span class="bc-current">用户管理</span>
    </div>

    <!-- 统计卡片 -->
    <div class="um-stats">
      <div class="um-stat-card" v-for="s in statCards" :key="s.label" :class="s.cssClass">
        <div class="um-stat-left">
          <span class="um-stat-num">{{ s.value }}</span>
          <span class="um-stat-label">{{ s.label }}</span>
        </div>
        <div class="um-stat-icon-wrap">
          <component :is="s.icon" theme="outline" size="24" :fill="s.iconFill" />
        </div>
        <div class="um-stat-glow"></div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="um-toolbar">
      <div class="um-tb-left">
        <el-input v-model="search" placeholder="搜索账号 / 昵称 / UID" size="default" style="width:240px" clearable @clear="fetchUsers" @keyup.enter="fetchUsers" />
        <el-select v-model="statusFilter" size="default" style="width:120px" clearable placeholder="全部状态" @change="fetchUsers">
          <el-option label="正常" value="active" /><el-option label="已禁用" value="disabled" /><el-option label="已封禁" value="banned" />
        </el-select>
        <el-select v-model="roleFilter" size="default" style="width:120px" clearable placeholder="全部角色" @change="fetchUsers">
          <el-option label="管理员" value="admin" /><el-option label="普通用户" value="user" />
        </el-select>
        <el-button type="primary" size="default" @click="fetchUsers" class="um-search-btn"><el-icon><Search /></el-icon> 搜索</el-button>
      </div>
      <div class="um-tb-right">
        <el-button class="bk-toolbar-btn" size="default" @click="openBackup" v-if="isAdmin">
          <el-icon><FolderOpened /></el-icon> 数据库备份
        </el-button>
        <el-button type="primary" size="default" @click="openCreate"><el-icon><Plus /></el-icon> 新建用户</el-button>
        <el-button size="default" circle @click="fetchUsers" :loading="loading"><el-icon><Refresh /></el-icon></el-button>
        <span class="um-total">共 <b>{{ total }}</b> 个用户</span>
      </div>
    </div>

    <!-- 用户卡片列表 -->
    <div class="um-list" v-loading="loading">
      <div v-for="u in users" :key="u._id" class="um-user-card" :class="statusCardClass(u)" @click="openDetail(u)">
        <div class="um-card-left">
          <div class="um-avatar" :style="avatarStyle(u)">
            <span v-if="!u.avatar">{{ (u.nickname || u.username || '?')[0]?.toUpperCase() }}</span>
          </div>
        </div>
        <div class="um-card-body">
          <div class="um-card-row1">
            <span class="um-uname">{{ u.nickname || u.username }}</span>
            <span class="um-uid" @click.stop="copyUID(u.uid)" :title="copiedUID === u.uid ? '已复制' : '点击复制UID'">{{ u.uid }}</span>
            <el-tag :type="u.role === 'admin' ? 'danger' : 'info'" size="small" effect="plain">{{ u.role === 'admin' ? '管理员' : '用户' }}</el-tag>
            <el-tag :type="statusTagType(u.status)" size="small" effect="dark">{{ statusMap[u.status] }}</el-tag>
          </div>
          <div class="um-card-row2">
            <span>@{{ u.username }}</span>
            <span class="um-sep">·</span>
            <span>{{ fmt(u.createdAt) }} 注册</span>
            <template v-if="u.lastLoginAt">
              <span class="um-sep">·</span>
              <span>最后登录 {{ fmt(u.lastLoginAt) }}</span>
            </template>
            <span v-if="u.lastLoginIp" class="um-sep">·</span>
            <span v-if="u.lastLoginIp">IP: <code>{{ u.lastLoginIp }}</code></span>
            <span v-if="u.phone" class="um-sep">·</span>
            <span v-if="u.phone" style="font-size:12px;color:var(--text-200)">
              📱 {{ showPhoneIds.has(u._id) ? u.phone : maskPhone(u.phone) }}
              <span style="cursor:pointer;color:var(--gold);margin-left:4px;user-select:none" @click.stop="toggleShowPhone(u._id)" :title="showPhoneIds.has(u._id) ? '隐藏' : '查看完整号码'">{{ showPhoneIds.has(u._id) ? '🙈' : '👁' }}</span>
            </span>
            <span v-if="u.loginAttempts > 0" class="um-warn">登录失败 {{ u.loginAttempts }} 次</span>
          </div>
        </div>
        <div class="um-card-right" @click.stop>
          <el-dropdown trigger="click" @command="(cmd) => handleAction(cmd, u)">
            <el-button size="small" circle class="um-more-btn"><el-icon><MoreFilled /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu class="um-drop-menu">
                <el-dropdown-item command="logs" class="um-drop-item um-di-logs"><span class="udot blue"></span><el-icon><List /></el-icon> 日 志</el-dropdown-item>
                <el-dropdown-item command="active" v-if="u.status !== 'active'" class="um-drop-item um-di-green"><span class="udot green"></span><el-icon><Check /></el-icon> 启 用</el-dropdown-item>
                <el-dropdown-item command="disabled" v-if="u.status === 'active'" class="um-drop-item um-di-orange"><span class="udot orange"></span><el-icon><Close /></el-icon> 禁 用</el-dropdown-item>
                <el-dropdown-item command="banned" v-if="u.status !== 'banned'" divided class="um-drop-item um-di-red"><span class="udot red"></span><el-icon><CircleCloseFilled /></el-icon> 封 禁</el-dropdown-item>
                <el-dropdown-item command="resetPwd" class="um-drop-item um-di-gold"><span class="udot gold"></span><el-icon><Key /></el-icon> 重置密码</el-dropdown-item>
                <el-dropdown-item command="delete" divided class="um-drop-item um-di-delete"><span class="udot red"></span><el-icon><Delete /></el-icon> 删除用户</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <el-empty v-if="users.length === 0 && !loading" description="无匹配用户" :image-size="60" />
    </div>

    <!-- 分页 -->
    <div class="um-pager" v-if="total > size">
      <el-pagination background layout="prev, pager, next" :page-size="size" :total="total" :current-page="page" @current-change="p => { page = p; fetchUsers(); }" />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detailUser?.nickname || detailUser?.username || '用户详情'" size="420px" destroy-on-close>
      <template v-if="detailUser">
        <div class="um-detail-avatar">
          <div class="um-d-avatar" :style="avatarStyle(detailUser)">
            <span v-if="!detailUser.avatar">{{ (detailUser.nickname || detailUser.username || '?')[0]?.toUpperCase() }}</span>
          </div>
          <div>
            <div class="um-d-name">{{ detailUser.nickname || detailUser.username }}</div>
            <div class="um-d-role">@{{ detailUser.username }} · {{ detailUser.role === 'admin' ? '管理员' : '普通用户' }}</div>
          </div>
        </div>
        <el-descriptions :column="1" border size="small" style="margin-top:20px">
          <el-descriptions-item label="UID">{{ detailUser.uid }} <el-button size="small" link type="primary" @click="copyUID(detailUser.uid)">{{ copiedUID === detailUser.uid ? '✓ 已复制' : '复制' }}</el-button></el-descriptions-item>
          <el-descriptions-item label="手机号">
            <span v-if="detailUser.phone">
              {{ showPhoneIds.has(detailUser._id) ? detailUser.phone : maskPhone(detailUser.phone) }}
              <el-button size="small" link @click="toggleShowPhone(detailUser._id)">{{ showPhoneIds.has(detailUser._id) ? '隐藏' : '查看完整号码' }}</el-button>
            </span>
            <span v-else style="color:var(--text-200)">未绑定</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态"><el-tag :type="statusTagType(detailUser.status)" size="small">{{ statusMap[detailUser.status] }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ fmt(detailUser.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="最后登录">{{ fmt(detailUser.lastLoginAt) }}</el-descriptions-item>
          <el-descriptions-item label="最后登录 IP"><code>{{ detailUser.lastLoginIp || '—' }}</code></el-descriptions-item>
          <el-descriptions-item label="登录失败次数">{{ detailUser.loginAttempts || 0 }}</el-descriptions-item>
          <el-descriptions-item label="锁定期限">{{ detailUser.lockedUntil ? fmt(detailUser.lockedUntil) : '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="um-detail-actions">
          <el-button size="default" class="um-act-btn um-act-blue" @click="handleAction('logs', detailUser); detailVisible = false"><el-icon><List /></el-icon> 日 志</el-button>
          <el-button size="default" class="um-act-btn um-act-green" v-if="detailUser.status !== 'active'" @click="handleAction('active', detailUser)"><el-icon><Check /></el-icon> 启 用</el-button>
          <el-button size="default" class="um-act-btn um-act-orange" v-if="detailUser.status === 'active'" @click="handleAction('disabled', detailUser)"><el-icon><Close /></el-icon> 禁 用</el-button>
          <el-button size="default" class="um-act-btn um-act-red" v-if="detailUser.status !== 'banned'" @click="handleAction('banned', detailUser)"><el-icon><CircleCloseFilled /></el-icon> 封 禁</el-button>
          <el-button size="default" class="um-act-btn um-act-gold" @click="handleAction('resetPwd', detailUser)"><el-icon><Key /></el-icon> 重置密码</el-button>
          <el-button size="default" class="um-act-btn um-act-red" @click="handleAction('delete', detailUser); detailVisible = false"><el-icon><Delete /></el-icon> 删除用户</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 登录日志弹窗 -->
    <el-dialog v-model="logVisible" :title="'日 志 — ' + logUser" width="760px" destroy-on-close>
      <el-table :data="logs" stripe max-height="450" v-loading="logLoading" size="small">
        <el-table-column label="时间" width="160"><template #default="{ row }">{{ fmt(row.createdAt) }}</template></el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column label="地理位置" min-width="160">
          <template #default="{ row }">
            <span v-if="row.geoInfo?.country" class="um-geo-badge">{{ row.geoInfo.country }} {{ row.geoInfo.province }} {{ row.geoInfo.city }}</span>
            <span v-else style="color:var(--text-200)">—</span>
          </template>
        </el-table-column>
        <el-table-column label="运营商" width="100"><template #default="{ row }">{{ row.geoInfo?.isp || '—' }}</template></el-table-column>
        <el-table-column label="结果" width="70">
          <template #default="{ row }"><el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="100" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="420px" destroy-on-close>
      <p style="color:var(--text-200);margin-bottom:14px">为 <strong style="color:var(--gold)">{{ resetUser?.username }}</strong> 设置新密码</p>
      <el-input v-model="newPassword" type="password" show-password placeholder="至少8位" style="margin-bottom:12px" />
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" @click="doResetPwd" :loading="resetting">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 新建用户弹窗 -->
    <el-dialog v-model="createVisible" title="新建用户" width="420px" destroy-on-close>
      <el-form :model="createForm" label-position="top" size="default" @keyup.enter="doCreate" autocomplete="off">
        <el-form-item label="账号" required>
          <el-input v-model="createForm.username" placeholder="3-30个字符" maxlength="30" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="createForm.password" type="password" show-password placeholder="至少8位" autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="createForm.nickname" placeholder="留空则与账号一致" maxlength="30" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="createForm.role">
            <el-radio value="user">普通用户</el-radio>
            <el-radio value="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreate" :loading="creating">确认创建</el-button>
      </template>
    </el-dialog>
    <!-- 备份管理弹窗 -->
    <el-dialog v-model="backupVisible" title="数据库备份管理" width="580px" destroy-on-close @opened="fetchBackupList">
      <!-- 操作区 -->
      <div class="bk-section">
        <div class="bk-action-cards">
          <div class="bk-action-card bk-ac-export" @click="doExport">
            <div class="bk-ac-icon"><el-icon><Download /></el-icon></div>
            <div class="bk-ac-body">
              <span class="bk-ac-title">{{ exporting ? '导出中...' : '导出备份' }}</span>
              <span class="bk-ac-desc">下载完整的数据库快照</span>
            </div>
            <el-icon v-if="exporting" class="bk-ac-spin"><Loading /></el-icon>
          </div>
          <div class="bk-action-card bk-ac-import" @click="triggerImport">
            <div class="bk-ac-icon"><el-icon><Upload /></el-icon></div>
            <div class="bk-ac-body">
              <span class="bk-ac-title">{{ importing ? '恢复中...' : '导入恢复' }}</span>
              <span class="bk-ac-desc">{{ importFile ? importFile.name : '选择备份文件恢复数据' }}</span>
            </div>
            <el-icon v-if="importing" class="bk-ac-spin"><Loading /></el-icon>
          </div>
          <el-upload ref="importUpload" :auto-upload="false" :show-file-list="false" accept=".gz,.json" @change="onImportFile" style="display:none" />
        </div>
        <div v-if="importFile" class="bk-import-bar">
          <span>已选择 <strong>{{ importFile.name }}</strong> ({{ fmtSize(importFile.size) }}) — 再次点击「导入恢复」确认</span>
          <el-button size="small" link @click="importFile = null; importResult = ''">✕</el-button>
        </div>
        <div v-if="importResult" class="bk-result" :class="importResult.includes('成功') ? 'bk-result-ok' : 'bk-result-fail'">{{ importResult }}</div>
      </div>

      <!-- 自动备份 -->
      <div class="bk-section">
        <h4 class="bk-sec-title">自动备份</h4>
        <div class="bk-auto-row">
          <el-switch v-model="autoCfg.enabled" @change="saveAutoCfg" size="default" />
          <span style="font-size:13px;margin-left:8px;color:var(--text-100)">启用定时备份到服务器磁盘</span>
        </div>
        <div class="bk-auto-row" style="margin-top:10px">
          <span style="font-size:12px;color:var(--text-200);width:96px">间隔（小时）</span>
          <el-input-number v-model="autoCfg.intervalHours" :min="1" :max="168" size="small" @change="saveAutoCfg" style="width:110px" />
          <el-tooltip content="超过此数量后，自动删除最旧的备份文件，只保留最新的 N 个" placement="top">
            <span style="font-size:12px;color:var(--text-200);width:96px;margin-left:16px;cursor:help;border-bottom:1px dotted var(--text-200)">最大保留</span>
          </el-tooltip>
          <el-input-number v-model="autoCfg.maxBackups" :min="1" :max="100" size="small" @change="saveAutoCfg" style="width:100px" />
        </div>
      </div>

      <!-- 备份存储说明 -->
      <div class="bk-section">
        <h4 class="bk-sec-title">备份文件存哪里</h4>
        <div class="bk-path-hint">
          <el-icon><FolderOpened /></el-icon>
          <code>{{ backupPath }}</code>
          <el-button size="small" link @click="copyPath">复制路径</el-button>
          <button class="bk-mount-btn" :class="'mount-' + (mountStatus || 'idle')" @click="checkMount" :disabled="checkingMount">
            <span class="bk-mount-dot"></span>
            <span v-if="checkingMount">检测中...</span>
            <span v-else>{{ mountStatusText }}</span>
          </button>
        </div>
        <p class="bk-path-tip">💡 导出的备份会存在服务器的这个目录里。如果用的是 Docker 部署，要确保这个目录和宿主机打通，不然容器删了备份也没了。点下面教程看具体怎么做 👇</p>

        <el-collapse style="margin-top:6px;border:none;background:transparent">
          <el-collapse-item title="📖 新手教程：怎么保护备份文件不丢失（点击展开）" style="background:var(--bg-100);border-radius:8px;padding:0 12px">
            <div class="bk-guide">

              <div class="bk-guide-box">
                <h5>🤔 先搞懂：为什么备份会丢？</h5>
                <p>你的网站跑在一个叫 Docker 的"虚拟盒子"里。备份文件存在盒子内部的 <code>/app/backups</code> 文件夹。如果盒子被删了（比如重装、升级），盒子里的所有东西都没了——包括备份。</p>
                <p>解决办法：让盒子里这个文件夹，对应到服务器上真实的一个文件夹。盒子删了，服务器上的文件还在。这就叫「挂载」。</p>
              </div>

              <div class="bk-guide-box">
                <h5>🎯 判断你是哪种部署方式</h5>
                <table class="bk-guide-table">
                  <tr><td class="bk-gt-q">你怎么启动的？</td><td class="bk-gt-a">👉 看下面对应的方法</td></tr>
                  <tr><td class="bk-gt-q">用了 <code>docker-compose.yml</code></td><td class="bk-gt-a">👉 方法一（最简单）</td></tr>
                  <tr><td class="bk-gt-q">用了 <code>docker run ...</code> 命令</td><td class="bk-gt-a">👉 方法二</td></tr>
                  <tr><td class="bk-gt-q">不确定 / 别人帮我部署的</td><td class="bk-gt-a">👉 方法三（万能）</td></tr>
                </table>
              </div>

              <div class="bk-guide-box bk-guide-green">
                <h5>✅ 方法一：docker-compose 用户（推荐）</h5>
                <p>你的项目里已经有 <code>docker-compose.yml</code> 文件了，只需要加一小段配置。打开这个文件，找到 <code>app:</code> 下面的 <code>volumes:</code>，改成：</p>
                <pre class="bk-guide-pre">app:
  volumes:
    - ./backups:/app/backups      ← 加这一行
    - uploads_data:/app/uploads</pre>
                <p>然后在服务器上项目目录里执行：</p>
                <pre class="bk-guide-pre">mkdir -p backups
docker-compose down
docker-compose up -d --build</pre>
                <p>搞定！以后所有备份都会存在你项目目录下的 <code>backups/</code> 文件夹里，容器怎么删都不会丢。</p>
              </div>

              <div class="bk-guide-box bk-guide-blue">
                <h5>✅ 方法二：docker run 用户</h5>
                <p>如果你是用 <code>docker run</code> 启动的，加一个 <code>-v</code> 参数：</p>
                <pre class="bk-guide-pre"># 先创建服务器上的备份文件夹
mkdir -p /data/storycine/backups

# 重启容器时加上 -v 参数
docker run -d --name storycine-app -p 3012:3012 \
  -v /data/storycine/backups:/app/backups \
  你的镜像名</pre>
              </div>

              <div class="bk-guide-box bk-guide-orange">
                <h5>✅ 方法三（万能）：不管怎么部署的，手动进出</h5>
                <p>如果以上两种都看不懂，就用最笨但最安全的方法——手动拿进拿出。每次导出备份后，到服务器上操作：</p>
                <pre class="bk-guide-pre"># 第 1 步：看容器叫啥名字
docker ps
# 输出里找到你的网站容器名，比如 storycine-app

# 第 2 步：从容器里把备份复制到服务器上
# 把下面 xxx.json.gz 换成你在页面上看到的文件名
docker cp storycine-app:/app/backups/xxx.json.gz ./我的备份.json.gz

# 第 3 步：把这个文件下载到自己电脑存好</pre>
                <p>恢复的时候反过来：</p>
                <pre class="bk-guide-pre"># 先把备份文件传到服务器，再复制进容器
docker cp ./我的备份.json.gz storycine-app:/app/backups/
# 然后回到这个页面 → 点击「导入恢复」→ 选文件</pre>
              </div>

              <div class="bk-guide-box">
                <h5>🔍 怎么确认备份真的安全了？</h5>
                <p>1. 先点这个页面上的「导出备份」<br>2. 再到服务器上执行：</p>
                <pre class="bk-guide-pre"># 如果用方法一（docker-compose）
ls -la backups/

# 如果用方法二
ls -la /data/storycine/backups/

# 如果用方法三
docker exec storycine-app ls /app/backups/</pre>
                <p>看到有 <code>backup-2026-xxx.json.gz</code> 这样的文件就对了 ✅</p>
              </div>

            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 备份列表 -->
      <div class="bk-section">
        <h4 class="bk-sec-title">历史备份 ({{ backupFiles.length }})</h4>
        <div class="bk-file-list" v-if="backupFiles.length">
          <div v-for="f in backupFiles" :key="f.filename" class="bk-file-row">
            <span class="bk-file-name">{{ f.createdAt }}</span>
            <span class="bk-file-size">{{ f.sizeFormatted }}</span>
            <el-button size="small" @click="downloadBackup(f.filename)" class="bk-btn-icon" title="下载">
              <el-icon><Download /></el-icon>
            </el-button>
            <el-button size="small" @click="deleteBackup(f.filename)" class="bk-btn-icon bk-btn-del" title="删除">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-else class="st-empty-hint">暂无备份文件，点击「导出完整备份」创建第一个</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, markRaw } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { People, User } from '@icon-park/vue-next';
import { Search, Refresh, List, Check, Close, CircleCloseFilled, Key, MoreFilled, Plus, Delete, FolderOpened, Download, Upload, Loading } from '@element-plus/icons-vue';

const users = ref([]);
const loading = ref(false);
const search = ref('');
const statusFilter = ref('');
const roleFilter = ref('');
const page = ref(1);
const size = ref(20);
const total = ref(0);
const statusMap = { active: '正常', disabled: '已禁用', banned: '已封禁' };
const statCounts = reactive({ active: 0, todayNew: 0, admin: 0 });

const statCards = computed(() => [
  { label: '注册用户', value: total.value, icon: markRaw(People), iconFill: '#fff', cssClass: 'um-sc-total' },
  { label: '正常用户', value: statCounts.active, icon: markRaw(User), iconFill: '#fff', cssClass: 'um-sc-active' },
  { label: '今日新增', value: statCounts.todayNew, icon: markRaw(People), iconFill: '#fff', cssClass: 'um-sc-today' },
  { label: '管理员', value: statCounts.admin, icon: markRaw(User), iconFill: '#fff', cssClass: 'um-sc-admin' },
]);

const detailVisible = ref(false);
const detailUser = ref(null);
const copiedUID = ref('');
const showPhoneIds = reactive(new Set());

function maskPhone(p) { if (!p) return ''; return p.substring(0, 3) + '****' + p.substring(7); }
function toggleShowPhone(id) { if (showPhoneIds.has(id)) showPhoneIds.delete(id); else showPhoneIds.add(id); }

const logVisible = ref(false);
const logUser = ref('');
const logs = ref([]);
const logLoading = ref(false);

const resetVisible = ref(false);
const resetUser = ref(null);
const newPassword = ref('');
const resetting = ref(false);

const createVisible = ref(false);
const creating = ref(false);
const createForm = reactive({ username: '', password: '', nickname: '', role: 'user' });

// ===== 备份管理 =====
const isAdmin = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'admin'; } catch { return false; }
});
const backupVisible = ref(false);
const backupFiles = ref([]);
const autoCfg = reactive({ enabled: false, intervalHours: 24, maxBackups: 7 });
const exporting = ref(false);
const importing = ref(false);
const importFile = ref(null);
const importUpload = ref(null);
const importResult = ref('');
const backupPath = ref('backend/backups/');
const checkingMount = ref(false);
const mountStatus = ref('');
const mountStatusText = ref('检测挂载');

function fmtSize(s) { return s > 1048576 ? (s / 1048576).toFixed(1) + ' MB' : s > 1024 ? (s / 1024).toFixed(1) + ' KB' : s + ' B'; }
async function copyPath() { try { await navigator.clipboard.writeText(backupPath.value); ElMessage.success('已复制'); } catch {} }

async function checkMount() {
  checkingMount.value = true;
  mountStatus.value = 'idle';
  mountStatusText.value = '检测中...';
  try {
    const res = await fetch('/api/v1/backup/check-mount', { headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    if (data.data?.ok) {
      mountStatus.value = 'ok';
      mountStatusText.value = '挂载正常';
    } else {
      mountStatus.value = 'fail';
      mountStatusText.value = data.data?.message || '检测失败';
    }
  } catch {
    mountStatus.value = 'fail';
    mountStatusText.value = '请求失败';
  }
  finally { checkingMount.value = false; }
}

async function fetchBackupList() {
  try {
    const res = await fetch('/api/v1/backup/list', { headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    if (data.code === 0) {
      backupFiles.value = data.data.files;
      Object.assign(autoCfg, data.data.autoBackup);
    }
  } catch {}
}

async function doExport() {
  exporting.value = true;
  try {
    const res = await fetch('/api/v1/backup/export', { method: 'POST', headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json.gz';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('备份导出完成');
    fetchBackupList();
  } catch { ElMessage.error('导出失败'); }
  finally { exporting.value = false; }
}

function onImportFile(uploadFile) {
  importFile.value = uploadFile.raw;
  importResult.value = '';
  if (!importFile.value) return;
  // 选择文件后，弹确认框
  ElMessageBox.confirm(
    `确认用 "${importFile.value.name}" 恢复数据库？\n\n⚠️ 当前所有数据将被清除并替换为备份中的数据。\n\n💡 导入前会自动备份当前数据（历史列表可见 BEFORE-RESTORE 文件）。`,
    '确认恢复数据库', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
  ).then(() => doImport()).catch(() => { importFile.value = null; });
}

function triggerImport() {
  if (importFile.value) {
    // 已选中文件，直接确认导入
    ElMessageBox.confirm(
      `确认用 "${importFile.value.name}" 恢复数据库？\n\n⚠️ 当前所有数据将被清除并替换为备份中的数据。导入前会自动备份当前数据。`,
      '确认恢复数据库', { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    ).then(() => doImport()).catch(() => {});
  } else {
    importUpload.value?.$el?.querySelector('input[type="file"]')?.click();
  }
}

async function doImport() {
  if (!importFile.value) return;
  importing.value = true;
  importResult.value = '';
  try {
    const form = new FormData();
    form.append('file', importFile.value);
    const res = await fetch('/api/v1/backup/import', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: form });
    const data = await res.json();
    if (data.code === 0) {
      const info = data.data;
      importResult.value = `恢复完成: ${info.inserted} 条记录已导入（回滚备份: ${info.rollbackFile}）`;
      ElMessage.success('数据恢复完成，如需撤销请从历史备份中恢复 BEFORE-RESTORE 文件');
      importFile.value = null;
      fetchBackupList(); fetchUsers();
      setTimeout(() => window.location.reload(), 1500);
    } else {
      importResult.value = data.message || '恢复失败';
    }
  } catch { importResult.value = '恢复失败'; }
  finally { importing.value = false; }
}

async function downloadBackup(filename) {
  try {
    const res = await fetch('/api/v1/backup/download/' + encodeURIComponent(filename), { headers: { Authorization: 'Bearer ' + token() } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch { ElMessage.error('下载失败'); }
}

async function deleteBackup(filename) {
  try { await ElMessageBox.confirm(`删除备份 "${filename}"？`, '确认', { type: 'warning' }); } catch { return; }
  try {
    const res = await fetch('/api/v1/backup/' + encodeURIComponent(filename), { method: 'DELETE', headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    if (data.code === 0) { ElMessage.success('已删除'); fetchBackupList(); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('删除失败'); }
}

async function saveAutoCfg() {
  try {
    const res = await fetch('/api/v1/backup/auto/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ enabled: autoCfg.enabled, intervalHours: autoCfg.intervalHours, maxBackups: autoCfg.maxBackups }),
    });
    const data = await res.json();
    if (data.code === 0) ElMessage.success(data.message);
  } catch { ElMessage.error('保存失败'); }
}

function openBackup() { backupVisible.value = true; }

function fmt(d) { return d ? new Date(d).toLocaleString('zh-CN') : '-'; }
function statusTagType(s) { return s === 'active' ? 'success' : s === 'banned' ? 'danger' : 'warning'; }
function statusCardClass(u) {
  if (u.status === 'banned') return 'um-card-banned';
  if (u.status === 'disabled') return 'um-card-disabled';
  return '';
}

const avatarColors = ['#c9a84c','#6b8fa3','#8B7355','#7b6ba3','#409eff','#67c23a','#e6a23c'];
const avatarGradients = [
  'linear-gradient(135deg, #c9a84c, #e8c97a)', 'linear-gradient(135deg, #6b8fa3, #8aafc2)',
  'linear-gradient(135deg, #8B7355, #a89070)', 'linear-gradient(135deg, #7b6ba3, #a08fc2)',
  'linear-gradient(135deg, #409eff, #79b8ff)', 'linear-gradient(135deg, #67c23a, #85ce61)',
  'linear-gradient(135deg, #e6a23c, #ebb563)',
];
function avatarStyle(u) {
  const idx = (u.username || '?').charCodeAt(0) % avatarGradients.length;
  return {
    backgroundImage: u.avatar ? `url(${u.avatar})` : '',
    background: u.avatar ? '' : avatarGradients[idx],
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

const token = () => localStorage.getItem('token');

async function fetchUsers() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, size: size.value });
    if (search.value) params.set('search', search.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (roleFilter.value) params.set('role', roleFilter.value);
    const res = await fetch(`/api/v1/auth/users?${params}`, { headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    users.value = data.data?.users || [];
    total.value = data.data?.total || 0;
    if (data.data?.stats) Object.assign(statCounts, data.data.stats);
    else {
      statCounts.active = users.value.filter(u => u.status === 'active').length;
      statCounts.admin = users.value.filter(u => u.role === 'admin').length;
      const today = new Date().toDateString();
      statCounts.todayNew = users.value.filter(u => new Date(u.createdAt).toDateString() === today).length;
    }
  } catch (e) { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

function openDetail(u) { detailUser.value = u; detailVisible.value = true; }

async function copyUID(uid) {
  if (!uid) return;
  try { await navigator.clipboard.writeText(uid); copiedUID.value = uid; setTimeout(() => { if (copiedUID.value === uid) copiedUID.value = ''; }, 2000); } catch {}
}

function handleAction(cmd, u) {
  if (cmd === 'logs') { viewLogs(u); return; }
  if (cmd === 'resetPwd') { resetUser.value = u; newPassword.value = ''; resetVisible.value = true; return; }
  if (cmd === 'delete') { deleteUser(u); return; }
  setStatus(u, cmd);
}

async function setStatus(row, status) {
  try { await ElMessageBox.confirm(`确认将 "${row.username}" 设为「${statusMap[status]}」？`, '提示', { type: 'warning' }); } catch { return; }
  try {
    const res = await fetch(`/api/v1/auth/users/${row._id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify({ status }) });
    const data = await res.json();
    if (res.ok) { row.status = status; ElMessage.success(data.message || '已更新'); }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('操作失败'); }
}

async function doResetPwd() {
  if (!newPassword.value || newPassword.value.length < 8) { ElMessage.warning('密码至少8位'); return; }
  resetting.value = true;
  try {
    const res = await fetch(`/api/v1/auth/users/${resetUser.value._id}/reset-password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify({ newPassword: newPassword.value }) });
    const data = await res.json();
    if (res.ok) { ElMessage.success('密码已重置'); resetVisible.value = false; }
    else ElMessage.error(data.message);
  } catch (e) { ElMessage.error('操作失败'); }
  finally { resetting.value = false; }
}

async function viewLogs(row) {
  logUser.value = row.username;
  logVisible.value = true;
  logLoading.value = true;
  try {
    const res = await fetch(`/api/v1/auth/users/${row._id}/logs`, { headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    logs.value = data.data?.logs || [];
  } catch (e) { logs.value = []; }
  finally { logLoading.value = false; }
}

function openCreate() {
  Object.assign(createForm, { username: '', password: '', nickname: '', role: 'user' });
  createVisible.value = true;
}

async function doCreate() {
  if (!createForm.username || createForm.username.length < 3) { ElMessage.warning('账号至少3个字符'); return; }
  if (!createForm.password || createForm.password.length < 8) { ElMessage.warning('密码至少8位'); return; }
  creating.value = true;
  try {
    const res = await fetch('/api/v1/auth/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(createForm) });
    const data = await res.json();
    if (res.ok) { ElMessage.success(data.message || '创建成功'); createVisible.value = false; fetchUsers(); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('创建失败'); }
  finally { creating.value = false; }
}

async function deleteUser(u) {
  try { await ElMessageBox.confirm(`确定删除用户 "${u.username}"？\n该用户的所有数据（登录日志、设置等）将被一并清除，不可恢复。`, '删除用户', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }); } catch { return; }
  try {
    const res = await fetch(`/api/v1/auth/users/${u._id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token() } });
    const data = await res.json();
    if (res.ok) { ElMessage.success('已删除'); fetchUsers(); }
    else ElMessage.error(data.message);
  } catch { ElMessage.error('删除失败'); }
}

onMounted(() => fetchUsers());
</script>

<style scoped>
.um-root { padding: 0; }

/* 统计卡片 */
.um-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.um-stat-card {
  position: relative; overflow: hidden;
  display: flex; justify-content: space-between; align-items: center;
  border-radius: 12px; padding: 18px 20px; transition: all 0.25s;
}
.um-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
.um-sc-total { background: linear-gradient(135deg, #1A1A2E, #2a2a3e); border: 1px solid #3a3a5e; }
.um-sc-active { background: linear-gradient(135deg, #1a3a1a, #2a4a2a); border: 1px solid #3a5a3a; }
.um-sc-today { background: linear-gradient(135deg, #3a2a1a, #4a3a2a); border: 1px solid #5a4a3a; }
.um-sc-admin { background: linear-gradient(135deg, #2a1a3a, #3a2a4a); border: 1px solid #4a3a5a; }

.um-stat-left { display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
.um-stat-num { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900; color: #fff; line-height: 1; }
.um-stat-label { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
.um-stat-icon-wrap { width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
.um-stat-glow { position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%); pointer-events: none; }

/* 工具栏 */
.um-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 8px; flex-wrap: wrap; }
.um-tb-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.um-tb-right { display: flex; align-items: center; gap: 8px; }
.um-total { font-size: 13px; color: var(--text-200); white-space: nowrap; }
.um-total b { color: var(--gold); font-family: 'Playfair Display', serif; font-size: 16px; }
.um-search-btn { display: flex; align-items: center; gap: 4px !important; }

/* 备份按钮 */
.bk-toolbar-btn {
  border: 1px solid var(--bg-300) !important; background: var(--bg-200) !important; color: var(--text-100) !important;
  display: flex; align-items: center; gap: 6px;
}
.bk-toolbar-btn:hover { border-color: var(--gold) !important; color: var(--gold-dark) !important; background: rgba(201,168,76,0.06) !important; }

/* 卡片列表 */
.um-list { display: flex; flex-direction: column; gap: 8px; }
.um-user-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--bg-200); border: 1px solid var(--bg-300); border-radius: 12px;
  padding: 14px 18px; cursor: pointer; transition: all 0.2s;
  border-left: 4px solid transparent;
}
.um-user-card:hover { border-color: var(--gold); border-left-color: var(--gold); }
.um-card-banned { border-left-color: #f56c6c !important; opacity: 0.7; }
.um-card-disabled { border-left-color: #e6a23c !important; opacity: 0.8; }
.um-card-left { flex-shrink: 0; }
.um-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px; font-weight: 700;
}
.um-card-body { flex: 1; min-width: 0; }
.um-card-right { flex-shrink: 0; }
.um-more-btn { border: 1px solid var(--bg-300) !important; background: var(--bg-100) !important; color: var(--text-200) !important; }
.um-more-btn:hover { border-color: var(--gold) !important; color: var(--gold) !important; }

.um-card-row1 { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.um-card-row2 { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-200); flex-wrap: wrap; }
.um-uname { font-size: 15px; font-weight: 700; color: var(--text-100); }
.um-uid {
  font-size: 10px; font-family: 'Courier New', monospace; color: var(--gold);
  background: rgba(201,168,76,0.1); padding: 2px 8px; border-radius: 4px; cursor: pointer; user-select: all;
}
.um-uid:hover { background: rgba(201,168,76,0.2); }
.um-sep { color: var(--bg-300); }
.um-warn { color: #e6a23c; font-weight: 600; }
code { font-family: 'Courier New', monospace; font-size: 11px; color: var(--gold-dark); background: rgba(201,168,76,0.06); padding: 1px 5px; border-radius: 3px; }

/* 抽屉 */
.um-detail-avatar { display: flex; align-items: center; gap: 14px; }
.um-d-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 700; flex-shrink: 0;
}
.um-d-name { font-size: 18px; font-weight: 700; color: var(--text-100); }
.um-d-role { font-size: 12px; color: var(--text-200); margin-top: 2px; }
.um-geo-badge { background: rgba(201,168,76,0.08); padding: 2px 8px; border-radius: 4px; font-size: 11px; color: var(--gold-dark); }

.um-pager { display: flex; justify-content: center; margin-top: 20px; }

/* 下拉菜单美化 */
.um-drop-menu { padding: 6px !important; min-width: 150px !important; }
.um-drop-item { padding: 10px 14px !important; font-size: 13px !important; font-weight: 600 !important; border-radius: 8px !important; margin: 2px 4px !important; transition: all 0.2s !important; }
.um-drop-item:hover { transform: translateX(4px); }
.udot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }
.udot.blue { background: #409eff; box-shadow: 0 0 6px rgba(64,158,255,0.5); }
.udot.green { background: #67c23a; box-shadow: 0 0 6px rgba(103,194,58,0.4); }
.udot.orange { background: #e6a23c; box-shadow: 0 0 6px rgba(230,162,60,0.4); }
.udot.red { background: #f56c6c; box-shadow: 0 0 6px rgba(245,108,108,0.4); }
.udot.gold { background: var(--gold); box-shadow: 0 0 6px rgba(201,168,76,0.5); }

/* 下拉各项独立配色 */
.um-di-logs { color: #409eff !important; }
.um-di-logs .el-icon { color: #409eff !important; }
.um-di-logs:hover { background: rgba(64,158,255,0.06) !important; }

.um-di-green { color: #67c23a !important; }
.um-di-green .el-icon { color: #67c23a !important; }
.um-di-green:hover { background: rgba(103,194,58,0.06) !important; }

.um-di-orange { color: #e6a23c !important; }
.um-di-orange .el-icon { color: #e6a23c !important; }
.um-di-orange:hover { background: rgba(230,162,60,0.06) !important; }

.um-di-red { color: #f56c6c !important; }
.um-di-red .el-icon { color: #f56c6c !important; }
.um-di-red:hover { background: rgba(245,108,108,0.06) !important; }

.um-di-gold { color: var(--gold-dark) !important; }
.um-di-gold .el-icon { color: var(--gold) !important; }
.um-di-gold:hover { background: rgba(201,168,76,0.06) !important; }

.um-di-delete { color: #f56c6c !important; font-weight: 700 !important; }
.um-di-delete .el-icon { color: #f56c6c !important; }
.um-di-delete:hover { background: rgba(245,108,108,0.1) !important; transform: translateX(4px) scale(1.02); }

/* 抽屉操作按钮 */
.um-detail-actions {
  margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.um-act-btn {
  border: 1.5px solid var(--bg-300) !important;
  background: var(--bg-100) !important;
  color: var(--text-100) !important;
  font-weight: 600 !important; letter-spacing: 0.5px;
  display: flex !important; align-items: center; gap: 6px;
  transition: all 0.25s !important;
}
.um-act-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.um-act-blue:hover { border-color: #409eff !important; color: #409eff !important; background: rgba(64,158,255,0.06) !important; box-shadow: 0 4px 16px rgba(64,158,255,0.12); }
.um-act-green:hover { border-color: #67c23a !important; color: #67c23a !important; background: rgba(103,194,58,0.06) !important; box-shadow: 0 4px 16px rgba(103,194,58,0.12); }
.um-act-orange:hover { border-color: #e6a23c !important; color: #e6a23c !important; background: rgba(230,162,60,0.06) !important; box-shadow: 0 4px 16px rgba(230,162,60,0.12); }
.um-act-red:hover { border-color: #f56c6c !important; color: #f56c6c !important; background: rgba(245,108,108,0.06) !important; box-shadow: 0 4px 16px rgba(245,108,108,0.12); }
.um-act-gold:hover { border-color: var(--gold) !important; color: var(--gold-dark) !important; background: rgba(201,168,76,0.06) !important; box-shadow: 0 4px 16px rgba(201,168,76,0.15); }

@media (max-width: 768px) {
  .um-stats { grid-template-columns: repeat(2, 1fr); }
  .um-toolbar { flex-direction: column; align-items: stretch; }
  .um-card-row2 { gap: 2px; }
}

/* ===== 备份管理 ===== */
.bk-section { margin-bottom: 20px; }
.bk-sec-title { font-size: 12px; font-weight: 700; color: var(--text-200); margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid var(--bg-300); text-transform: uppercase; letter-spacing: 1px; }

.bk-action-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.bk-action-card {
  display: flex; align-items: center; gap: 14px; padding: 18px 20px;
  border-radius: 12px; cursor: pointer; transition: all 0.2s;
  border: 1px solid var(--bg-300); background: var(--bg-100);
}
.bk-action-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
.bk-ac-icon {
  width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.bk-ac-export .bk-ac-icon { background: rgba(64,158,255,0.08); color: #409eff; }
.bk-ac-export:hover { border-color: #409eff; }
.bk-ac-import .bk-ac-icon { background: rgba(230,162,60,0.08); color: #e6a23c; }
.bk-ac-import:hover { border-color: #e6a23c; }
.bk-ac-body { display: flex; flex-direction: column; gap: 2px; }
.bk-ac-title { font-size: 13px; font-weight: 700; color: var(--text-100); }
.bk-ac-desc { font-size: 11px; color: var(--text-200); }
.bk-ac-spin { animation: bk-spin 1s linear infinite; color: var(--text-200); margin-left: auto; }
@keyframes bk-spin { to { transform: rotate(360deg); } }

.bk-import-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 10px; padding: 10px 14px; border-radius: 8px;
  background: rgba(230,162,60,0.06); border: 1px solid rgba(230,162,60,0.15);
  font-size: 12px; color: var(--text-200);
}
.bk-import-bar strong { color: var(--text-100); font-weight: 600; }
.bk-result { margin-top: 10px; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; }
.bk-result-ok { background: rgba(103,194,58,0.06); color: #67c23a; }
.bk-result-fail { background: rgba(245,108,108,0.06); color: #f56c6c; }

.bk-auto-row { display: flex; align-items: center; }
.bk-path-hint { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-100); border-radius: 8px; font-size: 12px; }
.bk-path-hint code { font-family: 'Courier New', monospace; font-size: 12px; color: var(--gold-dark); background: rgba(201,168,76,0.08); padding: 3px 8px; border-radius: 4px; }
.bk-file-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.bk-file-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: var(--bg-100); font-size: 12px; }
.bk-file-row:hover { background: var(--bg-300); }
.bk-file-name { flex: 1; color: var(--text-100); font-family: monospace; font-size: 11px; }
.bk-file-size { color: var(--text-200); font-size: 11px; white-space: nowrap; }
.bk-btn-icon { width: 32px; height: 32px; padding: 0 !important; border: 1px solid var(--bg-300) !important; background: var(--bg-200) !important; color: var(--text-200) !important; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px !important; }
.bk-btn-icon:hover { border-color: var(--gold) !important; color: var(--gold-dark) !important; }
.bk-btn-del:hover { border-color: #c44545 !important; color: #c44545 !important; }

/* 挂载检测按钮 */
.bk-mount-btn {
  display: flex; align-items: center; gap: 8px; margin-left: auto;
  padding: 5px 14px; font-size: 12px; font-family: inherit;
  border-radius: 20px; cursor: pointer; transition: all 0.25s; border: none;
  font-weight: 600; white-space: nowrap;
}
.bk-mount-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
/* 未检测 */
.bk-mount-btn.mount-idle {
  background: var(--bg-300); color: var(--text-200);
}
.bk-mount-btn.mount-idle .bk-mount-dot { background: #aaa; }
/* 检测中 */
.bk-mount-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.bk-mount-btn.mount-idle:disabled { background: var(--bg-300); }
.bk-mount-btn.mount-idle:disabled .bk-mount-dot {
  animation: mount-pulse 0.8s infinite;
}
/* 正常 */
.bk-mount-btn.mount-ok {
  background: rgba(103,194,58,0.1); color: #67c23a;
}
.bk-mount-btn.mount-ok .bk-mount-dot {
  background: #67c23a;
  box-shadow: 0 0 8px rgba(103,194,58,0.6);
  animation: mount-breathe 2s ease-in-out infinite;
}
/* 异常 */
.bk-mount-btn.mount-fail {
  background: rgba(245,108,108,0.1); color: #f56c6c;
}
.bk-mount-btn.mount-fail .bk-mount-dot {
  background: #f56c6c;
  box-shadow: 0 0 8px rgba(245,108,108,0.5);
}
@keyframes mount-breathe {
  0%, 100% { box-shadow: 0 0 4px rgba(103,194,58,0.4); }
  50% { box-shadow: 0 0 14px rgba(103,194,58,0.8); }
}
@keyframes mount-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes mount-breathe-fail {
  0%, 100% { box-shadow: 0 0 4px rgba(245,108,108,0.4); }
  50% { box-shadow: 0 0 14px rgba(245,108,108,0.7); }
}
.bk-path-tip { font-size: 12px; color: var(--text-200); margin: 8px 0 0 0; line-height: 1.7; }
.bk-guide { font-size: 13px; color: var(--text-100); line-height: 1.8; padding: 8px 0; }
.bk-guide h5 { font-size: 14px; font-weight: 700; color: var(--text-100); margin: 0 0 8px 0; }
.bk-guide p { margin: 6px 0; color: var(--text-200); }
.bk-guide code { font-size: 12px; padding: 2px 6px; }
.bk-guide-box { background: #fff; border: 1px solid var(--bg-300); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
.bk-guide-box h5 { line-height: 1.5; }
.bk-guide-green { border-left: 4px solid #67c23a; }
.bk-guide-blue { border-left: 4px solid #409eff; }
.bk-guide-orange { border-left: 4px solid #e6a23c; }
.bk-guide-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.bk-guide-table td { padding: 8px 10px; border-bottom: 1px solid var(--bg-300); }
.bk-gt-q { color: var(--text-200); width: 200px; }
.bk-gt-a { color: var(--text-100); font-weight: 600; }
.bk-guide-pre { background: var(--bg-300); color: var(--text-100); padding: 12px 16px; border-radius: 8px; font-size: 12px; line-height: 1.7; overflow-x: auto; margin: 6px 0 12px; font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-all; }
.st-empty-hint { text-align: center; padding: 20px; color: var(--text-200); font-size: 13px; }
</style>
