import fs from "node:fs"
import path from "node:path"
import { verifyToken } from "../lib/auth.js"
import { installAllSkills } from "../lib/skills.js"
import { addOrUpdateAgent, findAgentEntry, readConfig, writeConfig } from "../lib/config.js"
import { fetchCatalog, fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { markInstalled } from "../lib/state.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

// Weight breakdown: manifest 0→5%, skills 5→90%, files 90→95%, config 95→100%
const WEIGHT = { manifest: 5, skillsStart: 5, skillsEnd: 90, files: 95, config: 100 }

export async function agentInstall(name: string, options: { force?: boolean; token?: string; json?: boolean }): Promise<void> {
  const token = options.token
  const json = options.json === true

  const log = json ? () => {} : console.log.bind(console)

  if (token) {
    if (!token.startsWith("th_")) {
      if (json) jsonl({ event: "error", message: "Invalid token format" })
      else console.error("Invalid token format. Token must start with 'th_'.")
      process.exit(1)
    }
    log("Verifying token...")
    try {
      await verifyToken(token)
    } catch {
      if (json) jsonl({ event: "error", message: "Token verification failed" })
      else console.error("Token verification failed. Please check your token and try again.")
      process.exit(1)
    }
  }

  log(`Looking up agent "${name}"...`)

  const catalog = await fetchCatalog(token)
  if (!catalog.agents[name]) {
    const available = Object.keys(catalog.agents).join(", ")
    if (json) jsonl({ event: "error", message: `Agent "${name}" not found`, available })
    else console.error(`Agent "${name}" not found. Available: ${available}`)
    process.exit(1)
  }

  const manifest = await fetchManifest(name, token)
  log(`Found ${manifest.emoji} ${manifest.name} v${manifest.version} (${manifest.skills.length} skills)`)
  if (json) jsonl({
    event: "start",
    agentId: manifest.id, name: manifest.name, emoji: manifest.emoji,
    version: manifest.version, skillCount: manifest.skills.length,
  })
  if (json) jsonl({ event: "progress", phase: "manifest", percent: WEIGHT.manifest })

  const cfg = readConfig()
  const existing = findAgentEntry(cfg, name)
  if (existing && !options.force) {
    if (json) jsonl({ event: "error", message: `Agent "${name}" already exists. Use --force.` })
    else console.error(`Agent "${name}" already exists in config. Use --force to overwrite.`)
    process.exit(1)
  }

  const wsDir = resolveWorkspaceDir(name)
  fs.mkdirSync(wsDir, { recursive: true })

  // Install skills first — this is the slowest step (5% → 90%)
  let installed = 0
  let failed = 0
  let skipped = 0
  const warnings: string[] = []
  const skillTotal = manifest.skills.length

  if (skillTotal > 0) {
    log(`Installing ${skillTotal} skills via npx skills...`)
    const skillWeight = WEIGHT.skillsEnd - WEIGHT.skillsStart

    const result = installAllSkills(manifest.skills, wsDir, json ? (evt) => {
      const percent = WEIGHT.skillsStart + Math.round((evt.current / evt.total) * skillWeight)
      jsonl({
        event: "progress", phase: "skills", percent,
        detail: evt.name, current: evt.current, total: evt.total, status: evt.status,
      })
      if (evt.status === "failed") {
        warnings.push(`${evt.name}: ${evt.error ?? "install failed"}`)
      }
    } : undefined, json)

    installed = result.installed
    failed = result.failed
    skipped = result.skipped
  } else {
    if (json) jsonl({ event: "progress", phase: "skills", percent: WEIGHT.skillsEnd })
  }

  // Write agent files (90% → 95%)
  log("Writing agent files...")
  if (manifest.files) {
    for (const [filename, content] of Object.entries(manifest.files)) {
      if (content) {
        fs.writeFileSync(path.join(wsDir, filename), content, "utf-8")
      }
    }
  }
  if (json) jsonl({ event: "progress", phase: "files", percent: WEIGHT.files })

  // Update config (95% → 100%)
  // Write workspace path instead of skills — the gateway discovers skills
  // from <workspace>/skills/ symlinks that were created during skill install.
  const updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    workspace: wsDir,
  })
  writeConfig(updatedCfg)
  markInstalled(manifest.id, manifest.version)
  if (json) jsonl({ event: "progress", phase: "config", percent: WEIGHT.config })

  if (json) {
    jsonl({ event: "done", success: true, installed, skipped, failed, warnings, workspace: wsDir })
  } else {
    const parts: string[] = []
    if (installed > 0) parts.push(`${installed} installed`)
    if (skipped > 0) parts.push(`${skipped} already present`)
    if (failed > 0) parts.push(`${failed} failed`)
    const skillSummary = parts.length > 0 ? ` (skills: ${parts.join(", ")})` : ""
    console.log(`\n${manifest.emoji} Installed ${manifest.name}${skillSummary}.`)
  }
}
