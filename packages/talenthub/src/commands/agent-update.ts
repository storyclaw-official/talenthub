import fs from "node:fs"
import path from "node:path"
import { installAllSkills, updateAllSkills } from "../lib/skills.js"
import { addOrUpdateAgent, readConfig, writeConfig } from "../lib/config.js"
import { fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { markInstalled, readState, toManifestSnapshot } from "../lib/state.js"
import { checkUpdates } from "../lib/update-check.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

const WEIGHT = { manifest: 10, skillsStart: 10, skillsEnd: 80, files: 90, config: 100 }

async function updateAgent(agentId: string, json: boolean): Promise<boolean> {
  const log = json ? () => {} : console.log.bind(console)

  const manifest = await fetchManifest(agentId)
  const wsDir = resolveWorkspaceDir(agentId)

  if (json) jsonl({
    event: "start",
    agentId: manifest.id, name: manifest.name, emoji: manifest.emoji,
    version: manifest.version, skillCount: manifest.skills.length,
  })
  if (json) jsonl({ event: "progress", phase: "manifest", percent: WEIGHT.manifest })

  // Backup workspace
  const backupDir = `${wsDir}.bak`
  if (fs.existsSync(wsDir)) {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true })
    }
    fs.cpSync(wsDir, backupDir, { recursive: true, dereference: true })
  }
  fs.mkdirSync(wsDir, { recursive: true })

  // Write agent files from the registry response
  log("  Writing agent files...")
  if (manifest.files) {
    for (const [filename, content] of Object.entries(manifest.files)) {
      if (content) {
        fs.writeFileSync(path.join(wsDir, filename), content, "utf-8")
      }
    }
  }
  if (json) jsonl({ event: "progress", phase: "files", percent: WEIGHT.files })

  // Install any new skills (existing skills are skipped)
  let installed = 0
  let failed = 0
  let skipped = 0
  const warnings: string[] = []
  const skillTotal = manifest.skills.length

  if (skillTotal > 0) {
    log("  Installing new skills...")
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

  // Update config
  const cfg = readConfig()
  const updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    workspace: wsDir,
  })
  writeConfig(updatedCfg)
  markInstalled(manifest.id, manifest.version, toManifestSnapshot(manifest))
  if (json) jsonl({ event: "progress", phase: "config", percent: WEIGHT.config })

  if (json) {
    jsonl({ event: "done", agentId, success: true, version: manifest.version, installed, skipped, failed, warnings })
  }

  return true
}

export async function agentUpdate(name?: string, options?: { all?: boolean; json?: boolean }): Promise<void> {
  const json = options?.json === true
  const log = json ? () => {} : console.log.bind(console)

  if (options?.all || !name) {
    const updates = await checkUpdates()
    if (updates.length === 0) {
      if (json) jsonl({ event: "done", success: true, updated: 0 })
      else log("All agents are up to date.")
      return
    }

    // Update shared skills first
    log("Updating shared skills...")
    updateAllSkills()

    log(`\nFound ${updates.length} update(s):\n`)
    for (const u of updates) {
      log(`  Updating ${u.name}: ${u.currentVersion} → ${u.latestVersion}`)
      await updateAgent(u.agentId, json)
      log(`  ✓ ${u.name} updated to ${u.latestVersion}`)
    }
    if (json) jsonl({ event: "done", success: true, updated: updates.length })
    else log("\nAll done.")
    return
  }

  const state = readState()
  if (!state.agents[name]) {
    if (json) jsonl({ event: "error", message: `Agent "${name}" is not installed` })
    else console.error(`Agent "${name}" is not installed. Use "talenthub agent install ${name}" first.`)
    process.exit(1)
  }

  log("Updating shared skills...")
  updateAllSkills()

  log(`Updating agent "${name}"...`)
  await updateAgent(name, json)
  log(`✓ Agent "${name}" updated. All done.`)
}
