import fs from "node:fs"
import path from "node:path"
import { isClawhubAvailable, installSkill } from "../lib/clawhub.js"
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

  const hasClawhub = isClawhubAvailable()

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
  if (hasClawhub && manifest.skills.length > 0) {
    console.log(`Installing ${manifest.skills.length} skills via clawhub...`)
    for (const skill of manifest.skills) {
      const ok = installSkill(skill, wsDir)
      if (ok) installed++
      else failed++
    }
  } else if (!hasClawhub && manifest.skills.length > 0) {
    console.log(
      `Skipping ${manifest.skills.length} skills (clawhub not installed).`,
    )
    console.log("Install clawhub later: npm i -g clawhub")
    console.log(`Then run: talenthub agent update ${name}`)
  }

  let updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    skills: manifest.skills,
    model: manifest.model,
  })
  writeConfig(updatedCfg)

  markInstalled(manifest.id, manifest.version)

  console.log(
    `\n${manifest.emoji} Installed ${manifest.name}` +
      (installed > 0 ? ` with ${installed} skills` : "") +
      (failed > 0 ? ` (${failed} failed)` : "") +
      (!hasClawhub && manifest.skills.length > 0
        ? " (skills pending — install clawhub)"
        : "") +
      ".",
  )
  console.log("Restart the OpenClaw gateway to apply changes.")
}
