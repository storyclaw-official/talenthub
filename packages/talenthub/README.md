# @storyclaw/talenthub

CLI tool to manage StoryClaw AI agents — publish, install, update, and browse the TalentHub marketplace.

[中文文档](#中文文档)

## Install

```bash
npm install -g @storyclaw/talenthub
```

## Quick Start

```bash
# Login
talenthub login

# Initialize an agent
talenthub agent init --dir ~/.openclaw/workspace-my-agent

# Publish it
talenthub agent publish --dir ~/.openclaw/workspace-my-agent

# Browse & install agents
talenthub agent search
talenthub agent install <agent-name>
```

## Commands

| Command | Description |
|---------|-------------|
| `talenthub login` | Authenticate with StoryClaw |
| `talenthub logout` | Remove stored credentials |
| `talenthub agent init` | Initialize a new agent with manifest.json and prompt files |
| `talenthub agent publish` | Publish a local agent to the registry |
| `talenthub agent unpublish <name>` | Archive an agent from the registry |
| `talenthub agent install <name>` | Install an agent and its skills |
| `talenthub agent update [name]` | Update an agent or all agents (`--all`, `--json`) |
| `talenthub agent uninstall <name>` | Remove an installed agent |
| `talenthub agent list` | List installed agents and check for updates |
| `talenthub agent search [query]` | Browse available agents |

## Agent Structure

A publishable agent directory contains:

| File | Required | Description |
|------|----------|-------------|
| `manifest.json` | **Required** | Agent metadata (id, name, category, etc.) |
| `IDENTITY.md` | Yes | Core identity and personality prompt |
| `USER.md` | Optional | User-facing instructions |
| `SOUL.md` | Optional | Deep personality and behavioral guidelines |
| `AGENTS.md` | Optional | Multi-agent coordination instructions |

### manifest.json

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "emoji": "🤖",
  "role": "Assistant",
  "tagline": "A helpful AI assistant",
  "description": "Longer description of what this agent does.",
  "category": "productivity",
  "skills": [],
  "i18n": {},
  "minOpenClawVersion": "2026.3.1"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase alphanumeric + hyphens) |
| `name` | string | Human-readable display name |
| `emoji` | string | Single emoji icon |
| `role` | string | Short role description |
| `tagline` | string | One-line summary for search results |
| `description` | string | Longer description for detail page |
| `category` | string | One of: `creative`, `finance`, `productivity`, `companion`, `research`, `engineering` |
| `skills` | string[] | Skill specs (e.g. `https://github.com/owner/repo@skill-name`) |
| `i18n` | object | Translations keyed by locale (`zh-CN`, `zh-TW`, `ja`). Fill via web interface. |
| `minOpenClawVersion` | string | Minimum StoryClaw version required |
| `avatarUrl` | string \| null | Optional avatar image URL |

> **Note:** Version is not in the manifest — it is generated automatically by the server.

### Size Limits

- Each file: **200 KB** max
- Total across all files: **1 MB** max

## Publishing

```bash
# From a directory (recommended)
talenthub agent publish --dir /path/to/agent

# From an installed agent
talenthub agent publish --name my-agent

# From the current directory
talenthub agent publish
```

| Option | Description |
|--------|-------------|
| `--dir <path>` | Agent directory with manifest.json and .md files |
| `--name <name>` | Agent name in openclaw config (resolves workspace dir) |
| `--id <id>` | Override agent ID from manifest |

## Versioning

Versions are fully server-managed in `YYYY.MM.DD-X` format (e.g. `2026.04.13-1`).

- **New agent** → `YYYY.MM.DD-1`
- **Core field changes** (skills, USER.md, SOUL.md, AGENTS.md) → version auto-bumps
- **Metadata-only changes** (emoji, role, tagline, etc.) → version stays the same

Previous versions are automatically saved as snapshots.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALENTHUB_URL` | Override registry base URL (default: `https://app.storyclaw.com`) |
| `TALENTHUB_REGISTRY` | Alias for `TALENTHUB_URL` |

## Docs

- [Publishing Guide (English)](https://github.com/storyclaw-official/talenthub/blob/main/docs/publishing-guide.md)
- [Publishing Guide (中文)](https://github.com/storyclaw-official/talenthub/blob/main/docs/publishing-guide.zh-CN.md)

## License

MIT

---

## 中文文档

StoryClaw AI Agent 管理工具 — 发布、安装、更新和浏览 TalentHub 市场。

[English](#storyclawtalenthub)

### 安装

```bash
npm install -g @storyclaw/talenthub
```

### 快速开始

```bash
# 登录
talenthub login

# 初始化 Agent
talenthub agent init --dir ~/.openclaw/workspace-my-agent

# 发布
talenthub agent publish --dir ~/.openclaw/workspace-my-agent

# 浏览和安装
talenthub agent search
talenthub agent install <agent-name>
```

### 命令列表

| 命令 | 说明 |
|------|------|
| `talenthub login` | 登录 StoryClaw |
| `talenthub logout` | 退出登录 |
| `talenthub agent init` | 初始化新 Agent（生成 manifest.json 和提示词文件） |
| `talenthub agent publish` | 发布 Agent 到注册中心 |
| `talenthub agent unpublish <name>` | 下架 Agent |
| `talenthub agent install <name>` | 安装 Agent 及其技能 |
| `talenthub agent update [name]` | 更新 Agent（`--all` 更新全部，`--json` 结构化输出） |
| `talenthub agent uninstall <name>` | 卸载 Agent |
| `talenthub agent list` | 列出已安装的 Agent |
| `talenthub agent search [query]` | 搜索可用 Agent |

### Agent 目录结构

| 文件 | 是否必须 | 说明 |
|------|----------|------|
| `manifest.json` | **必须** | Agent 元数据（ID、名称、分类等） |
| `IDENTITY.md` | 必须 | 核心身份和人设提示词 |
| `USER.md` | 可选 | 面向用户的使用说明 |
| `SOUL.md` | 可选 | 深层性格和行为准则 |
| `AGENTS.md` | 可选 | 多 Agent 协作指令 |

### manifest.json

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "emoji": "🤖",
  "role": "Assistant",
  "tagline": "一句话描述你的 Agent",
  "description": "更详细的介绍。",
  "category": "productivity",
  "skills": [],
  "i18n": {},
  "minOpenClawVersion": "2026.3.1"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，小写字母加连字符 |
| `name` | string | 显示名称 |
| `emoji` | string | 一个 emoji 图标 |
| `role` | string | 角色简述 |
| `tagline` | string | 一行摘要 |
| `description` | string | 详细描述 |
| `category` | string | `creative`、`finance`、`productivity`、`companion`、`research`、`engineering` |
| `skills` | string[] | 技能包列表（如 `https://github.com/owner/repo@skill-name`） |
| `i18n` | object | 按语言代码存放翻译（`zh-CN`、`zh-TW`、`ja`），可通过网页界面填写 |
| `minOpenClawVersion` | string | 最低 StoryClaw 版本 |
| `avatarUrl` | string \| null | 头像 URL（可选） |

> **注意：** manifest 中没有 `version` 字段，版本由服务器自动生成。

### 发布

```bash
# 从目录发布（推荐）
talenthub agent publish --dir /path/to/agent

# 从已安装的 Agent 发布
talenthub agent publish --name my-agent

# 从当前目录发布
talenthub agent publish
```

| 选项 | 说明 |
|------|------|
| `--dir <path>` | Agent 目录 |
| `--name <name>` | openclaw 配置中的 Agent 名称 |
| `--id <id>` | 覆盖 manifest 中的 Agent ID |

### 版本管理

版本完全由服务器管理，格式为 `YYYY.MM.DD-X`（如 `2026.04.13-1`）。

- **新 Agent** → `YYYY.MM.DD-1`
- **核心字段变更**（skills、USER.md、SOUL.md、AGENTS.md）→ 版本自动递增
- **仅元数据变更**（emoji、role、tagline 等）→ 版本不变

每次版本递增时自动保存上一版本快照。

### 文件大小限制

- 单个文件：最大 **200 KB**
- 所有文件总计：最大 **1 MB**

### 环境变量

| 变量 | 说明 |
|------|------|
| `TALENTHUB_URL` | 覆盖注册中心地址（默认：`https://app.storyclaw.com`） |
| `TALENTHUB_REGISTRY` | `TALENTHUB_URL` 的别名 |

### 详细文档

- [发布指南（中文）](https://github.com/storyclaw-official/talenthub/blob/main/docs/publishing-guide.zh-CN.md)
- [Publishing Guide (English)](https://github.com/storyclaw-official/talenthub/blob/main/docs/publishing-guide.md)
