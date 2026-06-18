#!/bin/bash
# StoryCine 首次部署配置向导
set -e

cd "$(dirname "$0")"

echo "========================================"
echo "  StoryCine 部署配置向导"
echo "========================================"
echo ""

# 检查 docker
if ! command -v docker &>/dev/null; then
  echo "❌ 未安装 Docker，请先安装"
  exit 1
fi

# 公网地址
echo -n "📌 请输入你的公网域名或IP（直接回车跳过）: "
read -r PUBLIC_URL
PUBLIC_URL=${PUBLIC_URL:-http://localhost:3012}
echo "   公网地址: $PUBLIC_URL"

# 生成密码
echo ""
echo "🔐 正在生成安全密钥..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
MONGO_ROOT_PASS=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
MINIO_ROOT_USER=storycine_admin
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)

# 管理员密码
echo -n "🔑 请输入管理员初始密码（直接回车随机生成6位数字）: "
read -r ADMIN_PASSWORD
echo ""

# 写入 .env
cat > backend/.env << ENVEOF
# ========== JWT 密钥（必填，已自动生成） ==========
JWT_SECRET=${JWT_SECRET}

# ========== 字段加密密钥（必填，已自动生成） ==========
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ========== 管理员账号 ==========
${ADMIN_PASSWORD:+ADMIN_PASSWORD=${ADMIN_PASSWORD}}

# ========== 服务端口 ==========
SERVER_PORT=3012

# ========== 公网访问地址 ==========
PUBLIC_URL=${PUBLIC_URL}

# ========== MongoDB ==========
MONGO_ROOT_PASS=${MONGO_ROOT_PASS}
MONGO_URI=mongodb://storycine_user:storycine_pass@localhost:27017/storycine?authSource=storycine
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DATABASE=storycine
MONGO_USER=storycine_user
MONGO_PASSWORD=storycine_pass
MONGO_AUTH_SOURCE=storycine

# ========== Redis ==========
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# ========== MinIO ==========
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=${MINIO_ROOT_USER}
MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD}
MINIO_BUCKET=storycine

# ========== LLM 大模型（登录后在系统设置页面填写） ==========
DEEPSEEK_API_KEY=
DOUBAO_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-v4-pro
DOUBAO_BASE_URL=
DOUBAO_MODEL=doubao-seedance-2-0-260128
TONGYI_API_KEY=
TONGYI_BASE_URL=
TONGYI_MODEL=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
LANGGRAPH_API_KEY=
LANGGRAPH_PROJECT_ID=

# ========== 火山引擎 AK/SK ==========
VOLCANO_ACCESS_KEY=
VOLCANO_SECRET_KEY=

# ========== 图像/视频模型 ==========
JIMENG_API_KEY=
JIMENG_BASE_URL=
WAN27_API_KEY=
WAN27_BASE_URL=
ENVEOF

# 准备目录
mkdir -p backups-cold

echo "✅ 配置文件已生成: backend/.env"
echo ""

# 展示凭据
echo "========================================"
echo "  📋 请保存以下信息（仅此一次！）"
echo "========================================"
echo "  管理员账号: admin"
if [ -n "$ADMIN_PASSWORD" ]; then
  echo "  管理员密码: $ADMIN_PASSWORD"
else
  echo "  管理员密码: 首次启动后通过 docker logs storycine-app 查看"
fi
echo "  MongoDB Root: $MONGO_ROOT_PASS"
echo "  Redis 密码:   $REDIS_PASSWORD"
echo "========================================"
echo ""

# 导出环境变量给 docker compose 使用
export JWT_SECRET ENCRYPTION_KEY MONGO_ROOT_PASS REDIS_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD
export COLD_BACKUP_DIR=/app/backups-cold

# 构建启动
echo "🚀 开始构建 & 启动..."
docker compose up -d --build

echo ""
echo "========================================"
echo "  🎉 部署完成！"
echo "  访问地址: $PUBLIC_URL"
echo "  登录后在「系统设置」配置 LLM API Key"
echo "========================================"
