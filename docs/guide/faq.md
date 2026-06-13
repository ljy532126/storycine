## 忘记管理员密码怎么办？

在 `docker-compose.yml` 中找到 `RESET_ADMIN_PWD=false`，改为 `true`：

```bash
docker compose up -d --build
docker logs storycine-app 2>&1 | grep -A3 "Password:"
# 拿到密码后改回 false
```

## 为什么角色塑造报错？

这是早期版本的 bug，已修复。如果使用的是最新代码（`git pull`），不会再出现此问题。报错原因是 AI 有时返回 `{"characters": [...]}` 包裹格式，代码误把对象当数组使。

## AI 生图为空怎么办？

1. 检查「系统设置」中是否已配置生图模型的 API Key
2. 检查提示词是否超过字数限制（5000 字符）
3. 检查模型选择是否正确（Seedream / GPT-Image）

## 豆包 Seedance 视频生成失败？

常见原因：
- API Key 未配置或已过期
- 参考图 URL 不可达（对象存储需配置公网地址）
- Token 余额不足

## 对象存储上传失败？

系统支持自动降级：上传云存储失败时自动回退到本地服务器存储。检查：
- Endpoint 和 Bucket 配置是否正确
- AccessKey 是否有写入权限
- 地域选择是否与 Bucket 实际地域一致

## 如何更新代码？

```bash
cd /path/to/storycine
git pull
docker compose up -d --build
```

数据持久化：MongoDB / Redis / MinIO / uploads 均使用 Docker 命名卷，重建容器不会丢失数据。
