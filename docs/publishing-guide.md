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

Each agent lives in a workspace directory under `~/.openclaw/agents/<agent-id>/`. A publishable agent contains:

| File | Required | Description |
|------|----------|-------------|
| `manifest.json` | Recommended | Agent metadata (name, version, category, etc.) |
| `IDENTITY.md` | Yes | The agent's core identity and personality prompt |
| `USER.md` | Optional | User-facing instructions |
| `SOUL.md` | Optional | Deep personality and behavioral guidelines |
| `AGENTS.md` | Optional | Multi-agent coordination instructions |

### manifest.json

```json
{
  "id": "my-agent",
  "version": "1.0.0",
  "name": "My Agent",
  "emoji": "🤖",
  "role": "Assistant",
  "tagline": "A helpful AI assistant",
  "description": "Longer description of what this agent does and when to use it.",
  "category": "productivity",
  "model": "claude-sonnet-4-5",
  "skills": ["web-search", "code-interpreter"],
  "minOpenClawVersion": "0.0.5",
  "avatarUrl": null
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase, hyphens). Falls back to agent name if missing. |
| `version` | string | Semver version string (e.g. `"1.0.0"`). |
| `name` | string | Human-readable display name. |
| `emoji` | string | Single emoji shown alongside the name. |
| `role` | string | Short role description (e.g. "Writer", "Code Reviewer"). |
| `tagline` | string | One-line summary shown in search results. |
| `description` | string | Longer description for the agent detail page. |
| `category` | string | One of: `creative`, `finance`, `productivity`, `companion`, `research`, `engineering`. |
| `model` | string | Default AI model (can be overridden by users). |
| `skills` | string[] | List of skill pack IDs this agent uses. |
| `minOpenClawVersion` | string | Minimum StoryClaw version required. |
| `avatarUrl` | string \| null | Optional avatar image URL. |

### Size Limits

- Each individual file (`IDENTITY.md`, `USER.md`, etc.): **200 KB** max
- Total prompt content across all files: **1 MB** max

## Publishing

### From an installed agent

If the agent is already installed in your StoryClaw config:

```bash
talenthub agent publish <agent-name>
```

The CLI reads the agent entry from `~/.openclaw/openclaw.json`, locates its workspace directory, and uploads the manifest and prompt files.

### From a standalone directory

If you have a standalone agent directory with `manifest.json` and `.md` files:

```bash
talenthub agent publish <agent-name> --dir /path/to/agent
```

### Publish flow

1. The CLI reads `manifest.json` and all prompt files from the agent directory.
2. You are prompted to confirm or change the version number.
3. The agent payload is uploaded to the TalentHub registry.
4. On success, the agent becomes available for other users to discover and install.

## Updating a Published Agent

To release a new version, update your prompt files and/or `manifest.json`, then run:

```bash
talenthub agent publish <agent-name>
```

When prompted, enter the new version number. The registry stores each version independently, so users can see the changelog.

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
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TALENTHUB_URL` | Override the registry base URL (default: `https://app.storyclaw.com`) |
| `TALENTHUB_REGISTRY` | Alias for `TALENTHUB_URL` |

## Troubleshooting

**"Not logged in"** — Run `talenthub login` to authenticate.

**"Agent not found in openclaw config"** — Either install the agent first or use `--dir` to point to the agent directory.

**"Exceeds size limit"** — Reduce the content of your prompt files. Each file must be under 200 KB and the total under 1 MB.

**Network issues** — The CLI retries failed requests automatically. If you are behind a firewall or in a region with IPv6 issues, the CLI defaults to IPv4.
