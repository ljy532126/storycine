# ===== 构建前端 =====
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY frontend/ .
RUN npm run build

# ===== 运行时 =====
FROM node:20-alpine
WORKDIR /app

# 使用国内镜像加速
RUN npm config set registry https://registry.npmmirror.com

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --only=production

COPY backend/ .
COPY --from=frontend /frontend/dist /frontend/dist

# 备份目录（docker run 时需要 -v 挂载以持久化）
RUN mkdir -p /app/backups
VOLUME ["/app/backups"]

EXPOSE 3012
CMD ["node", "server.js"]
