#!/bin/bash
# ===========================================
#  StoryCine Docker 部署脚本 (服务器用)
# ===========================================
set -e

echo "========================================"
echo "   StoryCine Docker 部署"
echo "========================================"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 1. 创建 .env
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "[*] 已创建 backend/.env，请编辑填入 LLM API Key"
fi

# 2. 构建前端
echo "[*] 构建前端..."
cd frontend
npm install --silent
npm run build
cd ..

# 3. Docker 启动
echo "[*] 启动 Docker 服务..."
docker compose up -d --build

echo ""
echo "========================================"
echo "   部署完成！"
echo "   访问: http://$(curl -s ifconfig.me 2>/dev/null || echo '你的服务器IP'):3012"
echo ""
echo "   查看日志: docker compose logs -f app"
echo "   重启服务: docker compose restart app"
echo "   停止服务: docker compose down"
echo "========================================"
