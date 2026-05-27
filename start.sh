#!/bin/bash
# ===========================================
#  StoryCine 一键启动脚本 (Linux / macOS)
# ===========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   StoryCine 一键启动${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}[错误] 未找到 Node.js，请先安装 Node.js >= 18${NC}"
  exit 1
fi
echo -e "${GREEN}[✓] Node.js $(node -v)${NC}"

# 2. 安装后端依赖
echo -e "${YELLOW}[*] 检查后端依赖...${NC}"
if [ ! -d "backend/node_modules" ]; then
  echo -e "${YELLOW}[*] 安装后端依赖...${NC}"
  cd backend && npm install && cd ..
fi
echo -e "${GREEN}[✓] 后端依赖就绪${NC}"

# 3. 安装前端依赖
echo -e "${YELLOW}[*] 检查前端依赖...${NC}"
if [ ! -d "frontend/node_modules" ]; then
  echo -e "${YELLOW}[*] 安装前端依赖...${NC}"
  cd frontend && npm install && cd ..
fi
echo -e "${GREEN}[✓] 前端依赖就绪${NC}"

# 4. 检查 .env
if [ ! -f "backend/.env" ]; then
  echo -e "${YELLOW}[*] 创建 backend/.env (从 .env.example 复制)${NC}"
  cp backend/.env.example backend/.env
  echo -e "${YELLOW}[!] 请编辑 backend/.env 填入 LLM API Key${NC}"
fi

# 5. 启动数据库（Docker 方式）
echo -e "${YELLOW}[*] 启动数据库服务...${NC}"
if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
  docker compose up -d mongodb redis minio 2>/dev/null || docker-compose up -d mongodb redis minio 2>/dev/null
  echo -e "${GREEN}[✓] 数据库已启动 (Docker)${NC}"
else
  echo -e "${YELLOW}[!] Docker 未运行，请确保 MongoDB/Redis 已手动启动${NC}"
fi

# 6. 启动服务
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   启动服务...${NC}"
echo -e "${GREEN}   后端: http://localhost:3012${NC}"
echo -e "${GREEN}   前端: http://localhost:5173${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 启动后端
cd "$SCRIPT_DIR/backend"
node server.js &
BACKEND_PID=$!

# 启动前端
cd "$SCRIPT_DIR/frontend"
npx vite --host &
FRONTEND_PID=$!

# 等待中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
echo -e "${GREEN}[*] 服务已启动，按 Ctrl+C 停止${NC}"
wait
