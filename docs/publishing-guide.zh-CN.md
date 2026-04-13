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

每个 Agent 存放在一个工作目录中（通常是 `~/.openclaw/workspace-<agent-id>/`），包含以下文件：

| 文件 | 是否必须 | 说明 |
|------|----------|------|
| `manifest.json` | **必须** | Agent 元数据（ID、名称、分类等） |
| `IDENTITY.md` | 必须 | Agent 的核心身份和人设提示词 |
| `USER.md` | 可选 | 面向用户的使用说明 |
| `SOUL.md` | 可选 | 深层性格和行为准则 |
| `AGENTS.md` | 可选 | 多 Agent 协作指令 |

### 文件大小限制

- 单个文件：最大 **200 KB**
- 所有文件总计：最大 **1 MB**

## 初始化 Agent

使用 `talenthub agent init` 生成 `manifest.json` 和占位提示词文件：

```bash
talenthub agent init --dir ~/.openclaw/workspace-my-agent
```

CLI 会自动：
1. 从目录名提取 Agent ID（如 `workspace-my-agent` → `my-agent`）
2. 解析 `IDENTITY.md`（如果存在）获取默认名称和 emoji
3. 提示你确认或修改各字段

### manifest.json

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "emoji": "🤖",
  "role": "Assistant",
  "tagline": "一句话描述你的 Agent",
  "description": "更详细的介绍，说明这个 Agent 能做什么、适合什么场景。",
  "category": "productivity",
  "skills": [],
  "i18n": {},
  "minOpenClawVersion": "2026.3.1",
  "avatarUrl": null
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，小写字母加连字符（如 `my-agent`） |
| `name` | string | 显示名称 |
| `emoji` | string | 一个 emoji 图标 |
| `role` | string | 角色简述（如 "Code Reviewer"、"Writer"） |
| `tagline` | string | 一行摘要，在搜索结果中展示 |
| `description` | string | 详细描述，在 Agent 详情页展示 |
| `category` | string | 分类，可选值：`creative`、`finance`、`productivity`、`companion`、`research`、`engineering` |
| `skills` | string[] | Agent 使用的技能包列表，格式为 `https://github.com/<owner>/<repo>@<skill-name>` |
| `i18n` | object | 按语言代码（如 `zh-CN`、`zh-TW`、`ja`）存放 role/tagline/description 的翻译。可以为空 `{}`，稍后通过网页界面填写。 |
| `minOpenClawVersion` | string | 所需的最低 StoryClaw 版本 |
| `avatarUrl` | string \| null | 头像图片 URL（可选） |

> **注意：** manifest 中没有 `version` 字段。版本由服务器自动生成 —— 详见[版本管理](#版本管理)。

## 发布 Agent

### 从目录发布（推荐）

```bash
talenthub agent publish --dir /path/to/agent
```

### 从已安装的 Agent 发布

如果 Agent 已在 StoryClaw 配置中，使用 `--name` 解析其工作目录：

```bash
talenthub agent publish --name my-agent
```

### 从当前目录发布

如果你已经在 Agent 目录中：

```bash
talenthub agent publish
```

### 其他选项

| 选项 | 说明 |
|------|------|
| `--dir <path>` | 包含 `manifest.json` 和 `.md` 文件的 Agent 目录 |
| `--name <name>` | openclaw 配置中的 Agent 名称（用于解析工作目录） |
| `--id <id>` | 覆盖 manifest 中的 Agent ID |

### 发布流程

1. CLI 读取目录中的 `manifest.json` 和所有提示词文件
2. 将 Agent 上传到 TalentHub 注册中心
3. 服务器自动生成版本号（见下文）
4. 发布成功后，其他用户即可搜索并安装该 Agent

## 版本管理

版本完全由服务器管理，无需手动设置。

- **格式：** `YYYY.MM.DD-X`（如 `2026.04.13-1`）
- **新 Agent：** 版本为 `YYYY.MM.DD-1`（当天日期，计数器从 1 开始）
- **更新核心字段：** 版本自动递增（同一天递增计数器，新的一天重置为 1）
- **仅更新元数据：** 版本保持不变

**触发版本递增的核心字段：**
- `skills`
- `user_prompt`（USER.md）
- `soul_prompt`（SOUL.md）
- `agents_prompt`（AGENTS.md）

**不触发版本递增的元数据字段：**
- `emoji`、`role`、`tagline`、`description`、`category`、`avatar_url`、`i18n`、`identity_prompt`（IDENTITY.md）

每次版本递增时，服务器会自动保存上一版本的快照，以便将来恢复。

## 更新已发布的 Agent

修改提示词文件或 `manifest.json` 后，重新运行发布命令：

```bash
talenthub agent publish --dir /path/to/agent
```

如果核心字段有变化，服务器会自动分配新版本号。

## 完整发布示例

下面以发布一个"翻译助手"为例，演示完整流程：

### 1. 创建 Agent 目录

```bash
mkdir -p ~/my-agents/translator
cd ~/my-agents/translator
```

### 2. 初始化 Agent

```bash
talenthub agent init --dir .
```

按提示设置 ID（`translator`）、名称、emoji 和分类。

### 3. 编写提示词文件

编辑 `IDENTITY.md`：

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Translator | 翻译官
- **Creature:** Professional multilingual translator
- **Vibe:** Precise, culturally aware, preserves the original tone
- **Emoji:** 🌐
```

根据需要编辑 `SOUL.md`、`USER.md` 和 `AGENTS.md`。

### 4. 登录并发布

```bash
# 登录（首次需要）
talenthub login

# 发布
talenthub agent publish --dir ~/my-agents/translator
```

发布成功后：

```
Publishing 🌐 Translator...

✓ Updated (version bumped to v2026.04.13-1)
```

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

## 环境变量

| 变量 | 说明 |
|------|------|
| `TALENTHUB_URL` | 覆盖注册中心地址（默认：`https://app.storyclaw.com`） |
| `TALENTHUB_REGISTRY` | `TALENTHUB_URL` 的别名 |

## 常见问题

**"manifest.json not found"** — 运行 `talenthub agent init --dir <path>` 创建，或手动创建。

**"Not logged in"** — 运行 `talenthub login` 登录。

**"Agent not found in openclaw config"** — 使用 `--dir` 直接指定 Agent 目录。

**"Invalid agent id"** — Agent ID 必须为小写字母、数字和连字符（如 `my-agent`）。

**"Exceeds size limit"** — 缩减提示词文件内容。单个文件不超过 200 KB，总计不超过 1 MB。

**网络问题** — CLI 会自动重试失败的请求。如果你在防火墙后或有 IPv6 问题，CLI 默认使用 IPv4。
