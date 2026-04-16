import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { addOrUpdateAgent, readConfig, writeConfig } from "../lib/config.js"
import { fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { markInstalled, readState } from "../lib/state.js"
import { checkUpdates } from "../lib/update-check.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

const PROMPT_FILES = ["IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"]
const WEIGHT = { manifest: 10, downloadEnd: 50, extractEnd: 90, config: 100 }

async function updateAgent(agentId: string, json: boolean): Promise<boolean> {
  const log = json ? () => {} : console.log.bind(console)

  const manifest = await fetchManifest(agentId)
  const wsDir = resolveWorkspaceDir(agentId)

  if (json) jsonl({
    event: "start",
    agentId: manifest.id, name: manifest.name, emoji: manifest.emoji,
    version: manifest.version,
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

  let skillCount = 0

  if (manifest.zip_url) {
    // New path: download zip and extract
    log("  Downloading package...")
    if (json) jsonl({ event: "progress", phase: "download", percent: 10 })

    const res = await fetch(manifest.zip_url)
    if (!res.ok) throw new Error(`Failed to download zip: ${res.status}`)
    const zipBuffer = Buffer.from(await res.arrayBuffer())

    if (json) jsonl({ event: "progress", phase: "download", percent: WEIGHT.downloadEnd })

    log("  Extracting...")
    const zip = await JSZip.loadAsync(zipBuffer)

    // Write prompt files — skip IDENTITY.md to preserve local customizations
    for (const filename of PROMPT_FILES) {
      if (filename === "IDENTITY.md") continue
      const f = zip.file(filename)
      if (f) {
        fs.writeFileSync(path.join(wsDir, filename), await f.async("string"), "utf-8")
      }
    }

    // Extract bundled skills
    const skillsDir = path.join(wsDir, "skills")
    const seenSkills = new Set<string>()

    for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir || !zipPath.startsWith("skills/")) continue
      const parts = zipPath.slice("skills/".length).split("/")
      if (parts.length < 2) continue
      const skillName = parts[0]
      const fileName = parts.slice(1).join("/")

      if (!seenSkills.has(skillName)) {
        seenSkills.add(skillName)
        skillCount++
      }

      const targetFile = path.join(skillsDir, skillName, fileName)
      fs.mkdirSync(path.dirname(targetFile), { recursive: true })
      fs.writeFileSync(targetFile, await zipEntry.async("string"), "utf-8")
    }

    if (json) jsonl({ event: "progress", phase: "extract", percent: WEIGHT.extractEnd })
  } else {
    // Legacy fallback: write files from manifest response
    // Skip IDENTITY.md to preserve local customizations
    log("  Writing agent files...")
    if (manifest.files) {
      for (const [filename, content] of Object.entries(manifest.files)) {
        if (content && filename !== "IDENTITY.md") {
          fs.writeFileSync(path.join(wsDir, filename), content, "utf-8")
        }
      }
    }
    if (json) jsonl({ event: "progress", phase: "extract", percent: WEIGHT.extractEnd })
  }

  // Update config
  const cfg = readConfig()
  const updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    workspace: wsDir,
  })
  writeConfig(updatedCfg)
  markInstalled(manifest.id, manifest.version)
  if (json) jsonl({ event: "progress", phase: "config", percent: WEIGHT.config })

  if (json) {
    jsonl({ event: "done", agentId, success: true, version: manifest.version, skillCount })
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

  log(`Updating agent "${name}"...`)
  await updateAgent(name, json)
  log(`✓ Agent "${name}" updated. All done.`)
}
