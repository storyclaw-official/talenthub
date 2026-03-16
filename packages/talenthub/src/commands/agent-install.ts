import fs from "node:fs"
import path from "node:path"
import { installAllSkills } from "../lib/skills.js"
import { addOrUpdateAgent, findAgentEntry, readConfig, writeConfig } from "../lib/config.js"
import { fetchCatalog, fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { markInstalled } from "../lib/state.js"

export async function agentInstall(name: string, options: { force?: boolean }): Promise<void> {
  console.log(`Looking up agent "${name}"...`)

  const catalog = await fetchCatalog()
  if (!catalog.agents[name]) {
    const available = Object.keys(catalog.agents).join(", ")
    console.error(`Agent "${name}" not found. Available: ${available}`)
    process.exit(1)
  }

  const manifest = await fetchManifest(name)
  console.log(`Found ${manifest.emoji} ${manifest.name} v${manifest.version} (${manifest.skills.length} skills)`)

  const cfg = readConfig()
  const existing = findAgentEntry(cfg, name)
  if (existing && !options.force) {
    console.error(
      `Agent "${name}" already exists in config. Use --force to overwrite.`,
    )
    process.exit(1)
  }

  const wsDir = resolveWorkspaceDir(name)
  fs.mkdirSync(wsDir, { recursive: true })

  console.log("Writing agent files...")
  if (manifest.files) {
    for (const [filename, content] of Object.entries(manifest.files)) {
      if (content) {
        fs.writeFileSync(path.join(wsDir, filename), content, "utf-8")
      }
    }
  }

  let installed = 0
  let failed = 0
  let skipped = 0
  if (manifest.skills.length > 0) {
    console.log(`Installing ${manifest.skills.length} skills via npx skills...`)
    const result = installAllSkills(manifest.skills, wsDir)
    installed = result.installed
    failed = result.failed
    skipped = result.skipped
  }

  const updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    skills: manifest.skills,
  })
  writeConfig(updatedCfg)

  markInstalled(manifest.id, manifest.version)

  const parts: string[] = []
  if (installed > 0) parts.push(`${installed} installed`)
  if (skipped > 0) parts.push(`${skipped} already present`)
  if (failed > 0) parts.push(`${failed} failed`)
  const skillSummary = parts.length > 0 ? ` (skills: ${parts.join(", ")})` : ""

  console.log(`\n${manifest.emoji} Installed ${manifest.name}${skillSummary}.`)
  console.log("Restart the OpenClaw gateway to apply changes.")
}
