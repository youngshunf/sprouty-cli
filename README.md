# CFM CLI

CreatorFlow Marketplace CLI - 发布技能和应用到市场

## 安装

```bash
npm install -g @dcfuture/cfm-cli
```

## 配置

创建配置文件 `~/.cfm/config.yaml`:

```yaml
remote:
  api_url: https://your-marketplace-api.com
  api_key: sk-xxxxx  # 你的 LLM API Key
```

### 获取 API Key

1. 登录 CreatorFlow 平台
2. 进入「LLM 服务」-「API Key 管理」
3. 创建一个新的 API Key
4. 复制 `sk-` 开头的完整 Key 到配置文件

你也可以在项目目录创建 `.cfm.yaml` 文件（优先级更高）。

> **注意**: 发布时会自动使用你的用户信息作为作者，无需在配置文件中手动指定。

## 使用

### 技能管理

```bash
# 验证技能包
cfm skill validate ./my-skill

# 发布技能
cfm skill publish ./my-skill

# 指定版本发布
cfm skill publish ./my-skill -v 1.0.1

# 递增版本发布
cfm skill publish ./my-skill -b patch  # 1.0.0 -> 1.0.1
cfm skill publish ./my-skill -b minor  # 1.0.0 -> 1.1.0
cfm skill publish ./my-skill -b major  # 1.0.0 -> 2.0.0

# 带更新日志
cfm skill publish ./my-skill -b patch -c "修复了一些问题"
```

### 应用管理

```bash
# 验证应用包
cfm app validate ./my-app

# 发布应用
cfm app publish ./my-app

# 指定版本发布
cfm app publish ./my-app -v 1.0.1

# 递增版本发布
cfm app publish ./my-app -b patch
```

### 查看配置

```bash
cfm config
```

## 技能包结构

```
my-skill/
├── config.yaml      # 必需：技能配置
├── SKILL.md         # 必需：技能文档
└── icon.svg         # 可选：技能图标
```

### config.yaml 示例

```yaml
id: my-skill
name: 我的技能
version: 1.0.0
description: 这是一个示例技能
author_name: Your Name
category: 效率工具
tags:
  - 示例
  - 工具
```

## 应用包结构

```
my-app/
├── manifest.json    # 必需：应用清单
├── AGENTS.md        # 可选：AI 代理说明
├── icon.svg         # 可选：应用图标
├── labels/          # 可选：标签配置
│   └── config.json
└── statuses/        # 可选：状态配置
    └── config.json
```

### manifest.json 示例

```json
{
  "id": "app.my-app",
  "name": "我的应用",
  "version": "1.0.0",
  "description": "这是一个示例应用",
  "author": {
    "name": "Your Name"
  },
  "capabilities": {
    "skills": ["skill-1", "skill-2"]
  }
}
```

## 命令行参数

可以通过命令行参数覆盖配置：

```bash
cfm skill publish ./my-skill --api-url https://api.example.com --api-key your-key
```

## License

MIT
