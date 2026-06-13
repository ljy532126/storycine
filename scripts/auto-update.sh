#!/bin/bash
set -e

PROJECT_DIR="/app"
LOG_FILE="/var/log/storycine-auto-update.log"
BACKEND_PM2_NAME="storycine-backend"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

cd "$PROJECT_DIR"

# 1. 抓最新
git fetch origin master 2>&1 | tee -a "$LOG_FILE"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
  log "已是最新 ($LOCAL)，无需更新"
  exit 0
fi

log "发现更新: $LOCAL → $REMOTE"

# 2. 记录变更文件
CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE")
log "变更文件: $(echo "$CHANGED" | tr '\n' ' ')"

# 3. 拉取
git pull origin master 2>&1 | tee -a "$LOG_FILE"

BACKEND_CHANGED=false
FRONTEND_CHANGED=false
DEPS_CHANGED=false

for f in $CHANGED; do
  case "$f" in
    backend/*) BACKEND_CHANGED=true ;;
    frontend/*) FRONTEND_CHANGED=true ;;
  esac
  case "$f" in
    */package.json) DEPS_CHANGED=true ;;
  esac
done

# 4. 后端更新
if $BACKEND_CHANGED; then
  log "后端有变更，重启中..."
  cd "$PROJECT_DIR/backend"
  if $DEPS_CHANGED && echo "$CHANGED" | grep -q "backend/package.json"; then
    npm install --production 2>&1 | tee -a "$LOG_FILE"
  fi
  pm2 restart "$BACKEND_PM2_NAME" 2>&1 | tee -a "$LOG_FILE"
  log "后端重启完成"
fi

# 5. 前端构建
if $FRONTEND_CHANGED; then
  log "前端有变更，构建中..."
  cd "$PROJECT_DIR/frontend"
  if $DEPS_CHANGED && echo "$CHANGED" | grep -q "frontend/package.json"; then
    npm install 2>&1 | tee -a "$LOG_FILE"
  fi
  npm run build 2>&1 | tee -a "$LOG_FILE"
  log "前端构建完成"
fi

log "更新完毕"
