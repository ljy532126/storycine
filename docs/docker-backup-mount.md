# Docker 备份目录挂载教程

## 为什么需要挂载

Docker 容器销毁后，容器内的所有文件（包括 `backend/backups/` 目录下的备份文件）都会丢失。必须将宿主机目录挂载到容器内 `/app/backups`，备份才能持久保存。

---

## 方法一：docker run（单容器）

```bash
docker run -d \
  --name storycine-app \
  -p 3012:3012 \
  -v /data/storycine/backups:/app/backups \
  -v /data/storycine/uploads:/app/uploads \
  storycine-app:latest
```

宿主机目录 `/data/storycine/backups` 需要提前创建：

```bash
mkdir -p /data/storycine/backups
chmod 755 /data/storycine/backups
```

---

## 方法二：docker-compose（推荐）

项目自带的 `docker-compose.yml` 已配置好备份卷 `backups_data`，你只需额外指定宿主机路径。

### 想用宿主机具体目录而非 Docker 卷

把 `docker-compose.yml` 中 `app` 服务的 volumes 改为：

```yaml
app:
  volumes:
    - ./backups:/app/backups      # 映射到项目同级目录
    - uploads_data:/app/uploads
```

然后去掉底部 `volumes:` 中的 `backups_data:`（不再需要）。

然后运行：

```bash
mkdir -p backups
docker-compose up -d --build
```

备份文件会保存在宿主机的 `./backups/` 目录下。

---

## 方法三：已运行的容器热挂载

不需要重建容器，直接复制备份文件：

```bash
# 查看容器名
docker ps | grep storycine

# 从容器复制备份到宿主机
docker cp storycine-app:/app/backups/backup-xxx.json.gz ./my-backup.json.gz

# 恢复时，先复制文件进容器
docker cp ./my-backup.json.gz storycine-app:/app/backups/

# 然后在网页端「用户管理 → 备份 → 历史备份」中下载/导入
```

---

## 验证挂载是否生效

1. 网页端导出一次备份
2. SSH 到服务器，检查宿主机目录是否有文件：

```bash
ls -la /data/storycine/backups/
# 或
ls -la ./backups/
```

看到 `.json.gz` 文件就说明挂载成功。

---

## 定时备份到其他位置（可选）

如果还想把备份同步到云存储（阿里云 OSS / AWS S3 / 腾讯云 COS），可以加一个 cron 定时任务：

```bash
# 每天晚上 3 点同步到云存储
0 3 * * * rsync -avz /data/storycine/backups/ user@nas-server:/backups/storycine/
```

或使用 rclone：

```bash
rclone sync /data/storycine/backups s3:my-bucket/storycine-backups/
```
