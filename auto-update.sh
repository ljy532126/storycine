#!/bin/bash
set -e

PROJECT_DIR="/www/wwwroot/storycine"

cd "$PROJECT_DIR"

echo "[$(date)] 拉取代码..."
git pull origin master

echo "[$(date)] 重新构建并启动容器..."
cd "$PROJECT_DIR"
docker compose build --no-cache
docker compose up -d

echo "[$(date)] 完成"
