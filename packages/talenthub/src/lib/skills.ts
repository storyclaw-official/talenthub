import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { resolveStateDir } from "./paths.js"

/**
 * Resolve the `skills` binary shipped as a dependency rather than relying on
 * `npx` (which re-downloads on every invocation). Falls back to bare `skills`
 * on PATH if the local binary cannot be resolved.
 */
function resolveSkillsBin(): string {
  try {
    const require = createRequire(import.meta.url)
    const pkgJson = require.resolve("skills/package.json")
    return path.join(path.dirname(pkgJson), "bin", "cli.mjs")
  } catch {
    return "skills"
  }
}

const SKILLS_BIN = resolveSkillsBin()

/**
 * Replace `https://github.com/...` URLs with a mirror when TALENTHUB_GITHUB_URL is set.
 * Example: TALENTHUB_GITHUB_URL=https://gitmirror.com
 *   https://github.com/owner/repo → https://gitmirror.com/owner/repo
 */
function applyGithubMirror(url: string): string {
  const mirror = process.env.TALENTHUB_GITHUB_URL?.trim()
  if (!mirror) return url
  const base = mirror.replace(/\/+$/, "")
  return url.replace(/^https?:\/\/github\.com/i, base)
}

// ── Skill spec parsing ───────────────────────────────────────────────────────
//
// Manifest entries use "https://github.com/owner/repo@skill-name"
// e.g. "https://github.com/anthropics/skills@pdf"
// The repo part (before @) is passed directly to `skills add` as the source.

export type SkillSpec = { repo: string; skill: string }

/**
 * Parse a skill URL string into repo source and skill name.
 * Accepts "https://github.com/owner/repo@skill" (preferred) and
 * legacy "owner/repo@skill" format.
 * Returns undefined if the string is not in the expected format.
 */
export function parseSkillSpec(entry: string): SkillSpec | undefined {
  const atIdx = entry.lastIndexOf("@")
  if (atIdx <= 0) return undefined
  const repo = entry.slice(0, atIdx)
  const skill = entry.slice(atIdx + 1)
  if (!repo.includes("/") || !skill) return undefined
  return { repo, skill }
}

/**
 * Extract just the skill name (directory name) from a fully-qualified entry.
 */
export function skillName(entry: string): string {
  const spec = parseSkillSpec(entry)
  return spec ? spec.skill : entry
}

// ── Shared skills directory ──────────────────────────────────────────────────

/**
 * Where installed skill folders live: `~/.openclaw/skills/<name>/`.
 * The `skills` CLI creates a `skills/` subdirectory under its cwd,
 * so we pass `resolveStateDir()` (~/.openclaw/) as the cwd.
 */
export function resolveSharedSkillsDir(): string {
  return path.join(resolveStateDir(), "skills")
}

function resolveSkillDir(name: string): string {
  return path.join(resolveSharedSkillsDir(), name)
}

export function isSkillInstalled(name: string): boolean {
  const dir = resolveSkillDir(name)
  if (!fs.existsSync(dir)) return false
  return fs.existsSync(path.join(dir, "SKILL.md"))
}

// ── Install / link ───────────────────────────────────────────────────────────

/**
 * Install one or more skills from a single repo via `skills add` into the
 * shared directory. Accepts multiple skill names so only one clone is needed.
 *
 * Returns the list of skill names that were successfully installed.
 */
function installSkillsFromRepo(repo: string, skillNames: string[], quiet = false): { ok: string[]; error?: string } {
  const skillFlag = skillNames.join(" ")
  try {
    const cmd = `node ${SKILLS_BIN} add ${applyGithubMirror(repo)} --skill ${skillFlag} --agent openclaw -y`
    execSync(cmd, { stdio: quiet ? "pipe" : "inherit", cwd: resolveStateDir(), timeout: 300_000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Extract stderr from ExecSyncError if available
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString().trim()
    const detail = stderr || msg
    if (!quiet) console.error(`  Warning: failed to install skills from ${repo}: ${skillNames.join(", ")}`)
    return { ok: skillNames.filter((s) => isSkillInstalled(s)), error: detail }
  }
  return { ok: skillNames.filter((s) => isSkillInstalled(s)) }
}

/**
 * Install a single skill via `skills add` into the shared directory,
 * then symlink it into the agent workspace.
 *
 * @param entry Skill URL string ("https://github.com/owner/repo@skill")
 * @param workspaceDir Agent workspace directory
 * Returns true on success, false on failure (logged, non-fatal).
 */
export function installSkill(entry: string, workspaceDir: string): boolean {
  const spec = parseSkillSpec(entry)
  if (!spec) {
    console.error(`  Warning: invalid skill spec "${entry}" — expected "https://github.com/owner/repo@skill"`)
    return false
  }

  if (!isSkillInstalled(spec.skill)) {
    const result = installSkillsFromRepo(spec.repo, [spec.skill])
    if (result.ok.length === 0) return false
  }

  if (!isSkillInstalled(spec.skill)) {
    console.error(`  Warning: skill "${spec.skill}" not found after install`)
    return false
  }

  linkSkillToWorkspace(spec.skill, workspaceDir)
  return true
}

/**
 * Create a symlink from the shared skill dir into the agent workspace.
 */
function linkSkillToWorkspace(name: string, workspaceDir: string): void {
  const target = resolveSkillDir(name)
  const wsSkillsDir = path.join(workspaceDir, "skills")
  fs.mkdirSync(wsSkillsDir, { recursive: true })

  const link = path.join(wsSkillsDir, name)
  if (fs.existsSync(link)) {
    const stat = fs.lstatSync(link)
    if (stat.isSymbolicLink()) {
      const existing = fs.readlinkSync(link)
      if (existing === target) return
      fs.unlinkSync(link)
    } else {
      fs.rmSync(link, { recursive: true, force: true })
    }
  }

  fs.symlinkSync(target, link, "dir")
}

/**
 * Install all skills for an agent: skip already-installed, batch-install
 * missing skills grouped by repo (one clone per repo), then symlink
 * everything into the workspace.
 *
 * @param skills Array of skill URL strings ("https://github.com/owner/repo@skill")
 * Returns { installed, skipped, failed } counts.
 */
export type SkillProgressCallback = (event: {
  name: string
  repo: string
  status: "skipped" | "installing" | "done" | "failed"
  current: number
  total: number
  error?: string
}) => void

export function installAllSkills(
  skills: string[],
  workspaceDir: string,
  onProgress?: SkillProgressCallback,
  quiet = false,
): { installed: number; skipped: number; failed: number } {
  fs.mkdirSync(resolveStateDir(), { recursive: true })

  let installed = 0
  let skipped = 0
  let failed = 0
  let current = 0
  const total = skills.length

  // Group missing skills by repo so each repo is cloned only once
  const needInstall = new Map<string, string[]>()
  const skillRepoMap = new Map<string, string>()

  for (const entry of skills) {
    const spec = parseSkillSpec(entry)
    if (!spec) {
      current++
      console.error(`  Warning: invalid skill spec "${entry}" — expected "https://github.com/owner/repo@skill"`)
      onProgress?.({ name: entry, repo: "", status: "failed", current, total, error: "invalid spec" })
      failed++
      continue
    }
    skillRepoMap.set(spec.skill, spec.repo)
    if (isSkillInstalled(spec.skill)) {
      current++
      linkSkillToWorkspace(spec.skill, workspaceDir)
      onProgress?.({ name: spec.skill, repo: spec.repo, status: "skipped", current, total })
      skipped++
    } else {
      const list = needInstall.get(spec.repo) ?? []
      list.push(spec.skill)
      needInstall.set(spec.repo, list)
    }
  }

  // Batch install: one `skills add` per repo
  for (const [repo, skillNames] of needInstall) {
    for (const name of skillNames) {
      current++
      onProgress?.({ name, repo, status: "installing", current, total })
    }
    // Rewind current so we can report done/failed per skill
    current -= skillNames.length

    const result = installSkillsFromRepo(repo, skillNames, quiet)
    const okSet = new Set(result.ok)

    for (const name of skillNames) {
      current++
      if (okSet.has(name)) {
        installed++
        linkSkillToWorkspace(name, workspaceDir)
        onProgress?.({ name, repo, status: "done", current, total })
      } else {
        failed++
        onProgress?.({ name, repo, status: "failed", current, total, error: result.error ?? "install failed" })
      }
    }
  }

  return { installed, skipped, failed }
}

/**
 * Update all installed skills via `skills update`.
 */
export function updateAllSkills(): boolean {
  try {
    execSync(`node ${SKILLS_BIN} update --agent openclaw`, {
      stdio: "inherit",
      cwd: resolveStateDir(),
    })
    return true
  } catch {
    console.error("  Warning: failed to update skills")
    return false
  }
}

/**
 * Re-sync symlinks for an agent workspace.
 * Ensures every skill in the list is linked; adds new links, preserves existing.
 */
export function syncSkillLinks(skills: string[], workspaceDir: string): void {
  for (const entry of skills) {
    const name = skillName(entry)
    if (isSkillInstalled(name)) {
      linkSkillToWorkspace(name, workspaceDir)
    }
  }
}
