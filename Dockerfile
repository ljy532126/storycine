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

# 阿里云 Alpine 镜像加速（国内服务器必备）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
# 安装 ffmpeg + ffprobe（视频合成必需）
RUN apk add --no-cache ffmpeg

# 安装 nuclei 安全扫描引擎 + 预下载模板库
RUN apk add --no-cache wget ca-certificates \
    && wget -qO /usr/local/bin/nuclei https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei-linux-amd64 \
    && chmod +x /usr/local/bin/nuclei \
    && nuclei -version \
    && nuclei -ut -silent

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
