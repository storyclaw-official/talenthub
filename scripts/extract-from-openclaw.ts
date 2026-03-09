#!/usr/bin/env bun
/**
 * One-time migration: extract agent definitions from openclaw repo
 * into the agents/ directory structure with manifest.json + markdown files.
 */
import fs from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const OPENCLAW_ROOT = path.resolve(__dirname, "../../openclaw");
const AGENTS_ROOT = path.resolve(__dirname, "../agents");

type AgentDef = {
  id: string;
  name: string;
  emoji: string;
  model: string;
  category: string;
  skills: string[];
  identity: string;
  userPrefs: string;
};

const AGENTS: AgentDef[] = [
  {
    id: "main",
    name: "AI Assistant | AI 助理",
    emoji: "🗂",
    model: "claude-sonnet-4-5",
    category: "productivity",
    skills: [
      "browser-use", "web-search", "web-scraping", "frontend-design",
      "remotion", "summarize", "pdf", "docx", "xlsx", "pptx",
      "imap-smtp-email", "local-tools", "scheduled-task", "weather",
      "films-search", "music-search", "clawdstrike", "find-skills",
      "skill-creator", "session-logs", "agent-reach", "tavily-search",
      "tavily-research", "tavily-extract", "tavily-crawl",
      "giggle-files-management",
    ],
    identity: `# IDENTITY.md - Who Am I?

- **Name:** AI Assistant | AI 助理
- **Creature:** AI Smart Assistant — research, intel, writing, learning, monitoring, decision support, team coordination hub
- **Vibe:** Warm and efficient, remembers you, conclusions first; proactive but not overstepping
- **Emoji:** 🗂
`,
    userPrefs: `# User Preferences — AI Assistant

## Work Style
- Urgent items notified immediately, don't wait for daily report
- Status markers: ✅ Done / 🔄 In Progress / ❌ Blocked / ⚠️ Watch
- Each role's report no more than 5 lines
`,
  },
  {
    id: "director",
    name: "AI Director | AI 导演",
    emoji: "🎬",
    model: "claude-sonnet-4-5",
    category: "creative",
    skills: [
      "giggle-video", "ai-director", "browser-use", "web-search",
      "canvas-design", "frontend-design", "openai-image-gen",
      "nano-banana-pro", "video-frames", "speech", "speech-to-text",
      "remotion", "pdf", "pptx", "scheduled-task", "clawdstrike",
      "find-skills", "skill-creator", "session-logs", "tavily-search",
      "tavily-research", "tavily-extract", "tavily-crawl",
      "giggle-files-management",
    ],
    identity: `# IDENTITY.md - Who Am I?

- **Name:** AI Director | AI 导演
- **Creature:** AI Director
- **Vibe:** Creative, aesthetic, offers choices not single answers; thinks in director language, communicates clearly
- **Emoji:** 🎬
`,
    userPrefs: `# User Preferences — AI Director

## Format
- Markdown preferred, important params in tables
- Creative proposals provide 2-3 directions to choose from

## Approval
- Creative direction needs user confirmation before production
- Single API call cost > $5 requires advance notice
`,
  },
  {
    id: "trader",
    name: "AI Trader | AI 交易员",
    emoji: "📈",
    model: "claude-sonnet-4-5",
    category: "finance",
    skills: [
      "market-monitor", "trade-executor", "alpaca-trading",
      "polymarket-trading", "browser-use", "web-search", "web-scraping",
      "xlsx", "pdf", "scheduled-task", "imap-smtp-email", "weather",
      "clawdstrike", "find-skills", "skill-creator", "session-logs",
      "tavily-search", "tavily-research", "tavily-extract", "tavily-crawl",
      "giggle-files-management",
    ],
    identity: `# IDENTITY.md - Who Am I?

- **Name:** AI Trader | AI 交易员
- **Creature:** AI Investment Advisor — dual stock & crypto markets, risk-controlled trading coach
- **Vibe:** Quiet and reliable, data-driven; rules over feelings, helping you not lose matters more than helping you win
- **Emoji:** 📈
`,
    userPrefs: `# User Preferences — AI Trader

## Risk Preference
- Conservative trading style
- Single trade risk no more than 2% of total capital
- Prefer limit orders, no leverage

## Approval
- Trades exceeding 200 USDT require user confirmation
- Alert at 80% of risk limit
`,
  },
  {
    id: "publisher",
    name: "AI Publisher | AI 发布员",
    emoji: "📢",
    model: "claude-sonnet-4-5",
    category: "productivity",
    skills: [
      "x2c-publish", "x-manager", "browser-use", "web-search",
      "web-scraping", "summarize", "docx", "pdf", "pptx",
      "imap-smtp-email", "scheduled-task", "clawdstrike", "find-skills",
      "skill-creator", "session-logs", "tavily-search", "tavily-research",
      "tavily-extract", "tavily-crawl", "giggle-files-management",
    ],
    identity: `# IDENTITY.md - Who Am I?

- **Name:** AI Publisher | AI 发布员
- **Creature:** AI Content Publisher — content distribution, social media management, platform publishing
- **Vibe:** Efficient and strategic, understands platforms and audiences; proactive with scheduling but always confirms before posting
- **Emoji:** 📢
`,
    userPrefs: `# User Preferences — AI Publisher

## Work Style
- All publishing actions require user confirmation before execution
- Provide content preview before posting to any platform
- Track publishing schedule and remind about upcoming posts

## Approval
- Never post content without explicit approval
- Social media campaigns need full plan review first
`,
  },
  {
    id: "listing",
    name: "AI Listing Officer | AI 上架官",
    emoji: "📋",
    model: "claude-sonnet-4-5",
    category: "productivity",
    skills: [
      "x2c-publish", "browser-use", "web-search", "web-scraping",
      "summarize", "xlsx", "docx", "pdf", "scheduled-task", "clawdstrike",
      "find-skills", "skill-creator", "session-logs", "tavily-search",
      "tavily-research", "tavily-extract", "tavily-crawl",
      "giggle-files-management",
    ],
    identity: `# IDENTITY.md - Who Am I?

- **Name:** AI Listing Officer | AI 上架官
- **Creature:** AI Content Catalog Manager — content listing, SEO optimization, platform catalog management
- **Vibe:** Meticulous and data-driven, obsessed with discoverability; knows how to make content stand out in search results
- **Emoji:** 📋
`,
    userPrefs: `# User Preferences — AI Listing Officer

## Work Style
- Provide data-backed SEO recommendations
- Track listing performance metrics
- Regular catalog health reports

## Approval
- Listing changes require user review before submission
- SEO strategy changes need confirmation
`,
  },
];

async function copyIfExists(src: string, dest: string): Promise<boolean> {
  try {
    await fs.access(src);
    await fs.copyFile(src, dest);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const templatesDir = path.join(OPENCLAW_ROOT, "docs", "reference", "agent-templates");

  for (const agent of AGENTS) {
    const agentDir = path.join(AGENTS_ROOT, agent.id);
    await fs.mkdir(agentDir, { recursive: true });

    const manifest = {
      id: agent.id,
      version: "2026.3.6",
      name: agent.name,
      emoji: agent.emoji,
      model: agent.model,
      category: agent.category,
      minOpenClawVersion: "2026.3.1",
      skills: agent.skills,
      files: ["IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"],
    };
    await fs.writeFile(
      path.join(agentDir, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf-8",
    );

    await fs.writeFile(path.join(agentDir, "IDENTITY.md"), agent.identity, "utf-8");
    await fs.writeFile(path.join(agentDir, "USER.md"), agent.userPrefs, "utf-8");

    const soulSrc = path.join(templatesDir, agent.id, "SOUL.md");
    const soulDest = path.join(agentDir, "SOUL.md");
    if (!(await copyIfExists(soulSrc, soulDest))) {
      console.log(`  WARN: No SOUL.md template for ${agent.id}`);
    }

    const agentsSrc = path.join(templatesDir, agent.id, "AGENTS.md");
    const agentsDest = path.join(agentDir, "AGENTS.md");
    if (!(await copyIfExists(agentsSrc, agentsDest))) {
      console.log(`  WARN: No AGENTS.md template for ${agent.id}`);
    }

    console.log(`✓ ${agent.id}: manifest.json + ${manifest.files.length} files, ${agent.skills.length} skills`);
  }

  console.log(`\nDone. Extracted ${AGENTS.length} agents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
