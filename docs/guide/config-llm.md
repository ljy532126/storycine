# 配置 LLM

StoryCine 支持 4 个 AI 模型提供商：**DeepSeek**、**豆包 (Doubao)**、**通义 (Tongyi)**、**OpenAI**。

## 界面配置（推荐）

1. 登录后点击左侧菜单「**系统设置**」
2. 选择 LLM 提供商（DeepSeek / 豆包 / 通义 / OpenAI）
3. 填入 API Key 和 Base URL（如需要）
4. 点击「**保存**」→「**测试连接**」

## 环境变量配置

编辑 `backend/.env`，填入对应的 Key：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxx
DOUBAO_API_KEY=xxxxxxxx
TONGYI_API_KEY=sk-xxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxx
```

## 优先级

同时配置多个时，系统按以下优先级选择：
**DeepSeek > 豆包 > 通义 > OpenAI**

## 获取 API Key

| 提供商 | 获取地址 |
|---|---|
| DeepSeek | https://platform.deepseek.com/api_keys |
| 豆包 | https://console.volcengine.com/ark |
| 通义 | https://dashscope.aliyun.com |
| OpenAI | https://platform.openai.com/api-keys |
