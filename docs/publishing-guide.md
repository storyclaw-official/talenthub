# Publishing Agents to TalentHub

TalentHub is the agent marketplace for StoryClaw. You can publish your own AI agents so that other users can discover, install, and hire them.

## Prerequisites

- **Node.js 18+** and npm
- **StoryClaw** installed and configured (`~/.openclaw/openclaw.json`)
- **TalentHub CLI** installed:

```bash
npm install -g @storyclaw/talenthub
```

## Authentication

TalentHub uses a device-code flow (similar to GitHub CLI). Run:

```bash
talenthub login
```

This opens a browser where you sign in with your StoryClaw account. Once approved, the CLI stores a token locally. The token expires after 30 days; run `talenthub login` again to re-authenticate.

To sign out:

```bash
talenthub logout
```

## Agent Structure

Each agent lives in a workspace directory (typically `~/.openclaw/workspace-<agent-id>/`). A publishable agent contains:

| File | Required | Description |
|------|----------|-------------|
| `manifest.json` | **Required** | Agent metadata (id, name, category, etc.) |
| `IDENTITY.md` | Yes | The agent's core identity and personality prompt |
| `USER.md` | Optional | User-facing instructions |
| `SOUL.md` | Optional | Deep personality and behavioral guidelines |
| `AGENTS.md` | Optional | Multi-agent coordination instructions |

### Size Limits

- Each individual file (`IDENTITY.md`, `USER.md`, etc.): **200 KB** max
- Total prompt content across all files: **1 MB** max

## Initializing an Agent

Use `talenthub agent init` to generate a `manifest.json` and placeholder prompt files:

```bash
talenthub agent init --dir ~/.openclaw/workspace-my-agent
```

The CLI will:
1. Read the directory name to suggest an agent ID (e.g. `workspace-my-agent` → `my-agent`)
2. Parse `IDENTITY.md` (if it exists) for default name and emoji
3. Prompt you to confirm or override each field

### manifest.json

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "emoji": "🤖",
  "role": "Assistant",
  "tagline": "A helpful AI assistant",
  "description": "Longer description of what this agent does and when to use it.",
  "category": "productivity",
  "skills": [],
  "i18n": {},
  "minOpenClawVersion": "2026.3.1",
  "avatarUrl": null
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase alphanumeric + hyphens). |
| `name` | string | Human-readable display name. |
| `emoji` | string | Single emoji shown alongside the name. |
| `role` | string | Short role description (e.g. "Writer", "Code Reviewer"). |
| `tagline` | string | One-line summary shown in search results. |
| `description` | string | Longer description for the agent detail page. |
| `category` | string | One of: `creative`, `finance`, `productivity`, `companion`, `research`, `engineering`. |
| `skills` | string[] | List of skill specs (e.g. `https://github.com/owner/repo@skill-name`). |
| `i18n` | object | Translations for role/tagline/description keyed by locale (e.g. `zh-CN`, `zh-TW`, `ja`). Can be empty `{}` and filled later via the web interface. |
| `minOpenClawVersion` | string | Minimum StoryClaw version required. |
| `avatarUrl` | string \| null | Optional avatar image URL. |

> **Note:** `version` is not in the manifest. Versions are generated automatically by the server — see [Versioning](#versioning).

## Publishing

### From a directory (recommended)

```bash
talenthub agent publish --dir /path/to/agent
```

### From an installed agent

If the agent is in your StoryClaw config, use `--name` to resolve its workspace directory:

```bash
talenthub agent publish --name my-agent
```

### From the current directory

If you are already in the agent directory:

```bash
talenthub agent publish
```

### Additional options

| Option | Description |
|--------|-------------|
| `--dir <path>` | Agent directory containing `manifest.json` and `.md` files |
| `--name <name>` | Agent name in openclaw config (resolves workspace dir) |
| `--id <id>` | Override the agent ID from manifest |

### Publish flow

1. The CLI reads `manifest.json` and all prompt files from the agent directory.
2. The agent payload is uploaded to the TalentHub registry.
3. The server generates a version automatically (see below).
4. On success, the agent becomes available for other users to discover and install.

## Versioning

Versions are fully server-managed. You do not set a version manually.

- **Format:** `YYYY.MM.DD-X` (e.g. `2026.04.13-1`)
- **New agent:** gets version `YYYY.MM.DD-1` (today's date, counter 1)
- **Update with core field changes:** version auto-bumps (counter increments on same day, or resets to 1 on a new day)
- **Update with only metadata changes:** version stays the same

**Core fields** that trigger a version bump:
- `skills`
- `user_prompt` (USER.md)
- `soul_prompt` (SOUL.md)
- `agents_prompt` (AGENTS.md)

**Metadata fields** that do NOT trigger a version bump:
- `emoji`, `role`, `tagline`, `description`, `category`, `avatar_url`, `i18n`, `identity_prompt` (IDENTITY.md)

Previous versions are automatically saved as snapshots for future restore.

## Updating a Published Agent

Edit your prompt files and/or `manifest.json`, then run the publish command again:

```bash
talenthub agent publish --dir /path/to/agent
```

If core fields changed, the server assigns a new version automatically.

## Complete Publishing Example

Here is a step-by-step example of publishing a "Translator" agent:

### 1. Create the agent directory

```bash
mkdir -p ~/my-agents/translator
cd ~/my-agents/translator
```

### 2. Initialize the agent

```bash
talenthub agent init --dir .
```

Follow the prompts to set the ID (`translator`), name, emoji, and category.

### 3. Edit the prompt files

Edit `IDENTITY.md`:

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Translator
- **Creature:** Professional multilingual translator
- **Vibe:** Precise, culturally aware, preserves the original tone
- **Emoji:** 🌐
```

Edit `SOUL.md`, `USER.md`, and `AGENTS.md` as needed.

### 4. Login and publish

```bash
# Login (first time only)
talenthub login

# Publish
talenthub agent publish --dir ~/my-agents/translator
```

On success:

```
Publishing 🌐 Translator...

✓ Updated (version bumped to v2026.04.13-1)
```

## Unpublishing

To hide your agent from the marketplace (data is preserved, not deleted):

```bash
talenthub agent unpublish <agent-name>
```

You will be asked to confirm. Unpublished agents can be republished later.

## Browsing and Installing Agents

Other users can discover your published agents with:

```bash
# Search agents
talenthub agent search <query>

# List all available agents
talenthub agent search

# Install an agent
talenthub agent install <agent-name>

# Update installed agents
talenthub agent update --all

# List installed agents
talenthub agent list
```

## Writing Prompt Files

### IDENTITY.md (required)

Defines the agent's core identity. Example:

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Code Reviewer
- **Creature:** Senior engineering reviewer — thorough, opinionated, fair
- **Vibe:** Direct and honest; explains why something matters
- **Emoji:** 🛡️
```

### USER.md (optional)

User-facing instructions that tell users how to interact with the agent and what it is good at.

### SOUL.md (optional)

Deep personality traits, values, communication style, and behavioral boundaries.

### AGENTS.md (optional)

When the agent needs to coordinate with other agents, define the collaboration rules here.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALENTHUB_URL` | Override the registry base URL (default: `https://app.storyclaw.com`) |
| `TALENTHUB_REGISTRY` | Alias for `TALENTHUB_URL` |

## Troubleshooting

**"manifest.json not found"** — Run `talenthub agent init --dir <path>` to create one, or create it manually.

**"Not logged in"** — Run `talenthub login` to authenticate.

**"Agent not found in openclaw config"** — Use `--dir` to point to the agent directory directly.

**"Invalid agent id"** — Agent ID must be lowercase alphanumeric characters and hyphens only (e.g. `my-agent`).

**"Exceeds size limit"** — Reduce the content of your prompt files. Each file must be under 200 KB and the total under 1 MB.

**Network issues** — The CLI retries failed requests automatically. If you are behind a firewall or in a region with IPv6 issues, the CLI defaults to IPv4.
