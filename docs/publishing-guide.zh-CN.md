# 发布 Agent 到 TalentHub

TalentHub 是 StoryClaw 的 Agent 市场。你可以发布自己的 AI Agent，让其他用户发现、安装和使用它们。

## 前提条件

- **Node.js 18+** 和 npm
- **StoryClaw** 已安装并配置（`~/.openclaw/openclaw.json`）
- **TalentHub CLI** 已安装：

```bash
npm install -g @storyclaw/talenthub
```

## 登录认证

TalentHub 使用设备码（device-code）登录流程（类似 GitHub CLI）。运行：

```bash
talenthub login
```

浏览器会自动打开，使用你的 StoryClaw 账号登录即可。登录成功后，CLI 会在本地保存一个令牌（token），有效期 30 天，过期后重新运行 `talenthub login`。

退出登录：

```bash
talenthub logout
```

## Agent 目录结构

每个 Agent 存放在一个目录中，包含以下文件：

| 文件 | 是否必须 | 说明 |
|------|----------|------|
| `manifest.json` | 推荐 | Agent 元数据（名称、版本、分类等） |
| `IDENTITY.md` | **必须** | Agent 的核心身份和人设提示词 |
| `USER.md` | 可选 | 面向用户的使用说明 |
| `SOUL.md` | 可选 | 深层性格和行为准则 |
| `AGENTS.md` | 可选 | 多 Agent 协作指令 |

### 文件大小限制

- 单个文件：最大 **200 KB**
- 所有文件总计：最大 **1 MB**

## 创建 manifest.json

`manifest.json` 定义了 Agent 的基本信息。以下是一个完整示例：

```json
{
  "id": "my-agent",
  "version": "1.0.0",
  "name": "My Agent",
  "emoji": "🤖",
  "role": "Assistant",
  "tagline": "一句话描述你的 Agent",
  "description": "更详细的介绍，说明这个 Agent 能做什么、适合什么场景。",
  "category": "productivity",
  "model": "claude-sonnet-4-5",
  "skills": [
    "https://github.com/tavily-ai/skills@search",
    "https://github.com/anthropics/skills@pdf"
  ],
  "minOpenClawVersion": "2026.3.1",
  "avatarUrl": null
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，小写字母加连字符（如 `my-agent`） |
| `version` | string | 版本号（如 `"1.0.0"` 或 `"2026.3.16"`） |
| `name` | string | 显示名称 |
| `emoji` | string | 一个 emoji 图标 |
| `role` | string | 角色简述（如 "Code Reviewer"、"Writer"） |
| `tagline` | string | 一行摘要，在搜索结果中展示 |
| `description` | string | 详细描述，在 Agent 详情页展示 |
| `category` | string | 分类，可选值：`creative`、`finance`、`productivity`、`companion`、`research`、`engineering` |
| `model` | string | 默认使用的 AI 模型（用户可自行覆盖） |
| `skills` | string[] | Agent 使用的技能包列表，格式为 `https://github.com/<owner>/<repo>@<skill-name>` |
| `minOpenClawVersion` | string | 所需的最低 StoryClaw 版本 |
| `avatarUrl` | string \| null | 头像图片 URL（可选） |

## 编写提示词文件

### IDENTITY.md（必须）

定义 Agent 的核心身份。示例：

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Code Reviewer | 代码审查员
- **Creature:** Senior engineering reviewer — thorough, opinionated, fair
- **Vibe:** Direct and honest; explains why something matters
- **Emoji:** 🛡️
```

### USER.md（可选）

面向用户的使用说明，告诉用户如何与 Agent 交互、Agent 擅长什么。

### SOUL.md（可选）

定义 Agent 的深层性格特征、价值观和行为边界。

### AGENTS.md（可选）

当 Agent 需要与其他 Agent 协作时，在此定义协作规则和指令。

## 发布 Agent

### 方式一：从已安装的 Agent 发布

如果 Agent 已经安装在你的 StoryClaw 配置中：

```bash
talenthub agent publish <agent-name>
```

CLI 会从 `~/.openclaw/openclaw.json` 中读取 Agent 配置，找到对应的工作目录，上传 manifest 和提示词文件。

### 方式二：从独立目录发布

如果你有一个独立的 Agent 目录（包含 `manifest.json` 和 `.md` 文件）：

```bash
talenthub agent publish <agent-name> --dir /path/to/agent
```

### 发布流程

1. CLI 读取目录中的 `manifest.json` 和所有提示词文件
2. 提示你确认或修改版本号
3. 将 Agent 上传到 TalentHub 注册中心
4. 发布成功后，其他用户即可搜索并安装该 Agent

## 完整发布示例

下面以发布一个"翻译助手"为例，演示完整流程：

### 1. 创建 Agent 目录

```bash
mkdir -p ~/my-agents/translator
cd ~/my-agents/translator
```

### 2. 编写 manifest.json

```json
{
  "id": "translator",
  "version": "1.0.0",
  "name": "Translator",
  "emoji": "🌐",
  "role": "Translation Assistant",
  "tagline": "Fluent multilingual translator for documents and conversations.",
  "description": "A professional translator that handles Chinese, English, Japanese, and more. Preserves tone, context, and technical terminology.",
  "category": "productivity",
  "model": "claude-sonnet-4-5",
  "skills": [],
  "minOpenClawVersion": "2026.3.1"
}
```

### 3. 编写 IDENTITY.md

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Translator | 翻译官
- **Creature:** Professional multilingual translator
- **Vibe:** Precise, culturally aware, preserves the original tone
- **Emoji:** 🌐
```

### 4. 登录并发布

```bash
# 登录（首次需要）
talenthub login

# 发布
talenthub agent publish translator --dir ~/my-agents/translator
```

CLI 会提示：

```
Version [1.0.0]:
```

直接按回车确认版本号，或输入新的版本号。发布成功后会看到：

```
Publishing 🌐 Translator v1.0.0...

✓ Agent published successfully.
```

## 更新已发布的 Agent

修改提示词文件或 `manifest.json` 后，重新运行发布命令：

```bash
talenthub agent publish <agent-name>
```

在版本号提示处输入新版本号即可。注册中心会独立存储每个版本。

## 下架 Agent

隐藏你的 Agent（数据会保留，不会删除）：

```bash
talenthub agent unpublish <agent-name>
```

需要确认操作。下架后可以随时重新发布。

## 浏览和安装 Agent

其他用户可以通过以下命令发现和使用你发布的 Agent：

```bash
# 搜索 Agent
talenthub agent search <关键词>

# 列出所有可用 Agent
talenthub agent search

# 安装 Agent
talenthub agent install <agent-name>

# 更新已安装的 Agent
talenthub agent update --all

# 查看已安装的 Agent
talenthub agent list
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `TALENTHUB_URL` | 覆盖注册中心地址（默认：`https://app.storyclaw.com`） |
| `TALENTHUB_REGISTRY` | `TALENTHUB_URL` 的别名 |

## 常见问题

**"Not logged in"** — 运行 `talenthub login` 登录。

**"Agent not found in openclaw config"** — 用 `--dir` 指定 Agent 目录，或先安装该 Agent。

**"Exceeds size limit"** — 缩减提示词文件内容。单个文件不超过 200 KB，总计不超过 1 MB。

**网络问题** — CLI 会自动重试失败的请求。如果你在防火墙后或有 IPv6 问题，CLI 默认使用 IPv4。
