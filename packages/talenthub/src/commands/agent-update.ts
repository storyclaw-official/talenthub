import fs from "node:fs"
import path from "node:path"
import { ensureClawhub, installSkill, updateAllSkills } from "../lib/clawhub.js"
import { addOrUpdateAgent, readConfig, writeConfig } from "../lib/config.js"
import { fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { markInstalled, readState } from "../lib/state.js"
import { checkUpdates } from "../lib/update-check.js"

async function updateAgent(agentId: string): Promise<boolean> {
  const manifest = await fetchManifest(agentId)
  const wsDir = resolveWorkspaceDir(agentId)

  // Backup workspace
  const backupDir = `${wsDir}.bak`
  if (fs.existsSync(wsDir)) {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true })
    }
    fs.cpSync(wsDir, backupDir, { recursive: true })
  }
  fs.mkdirSync(wsDir, { recursive: true })

  // Write agent files from the registry response
  if (manifest.files) {
    for (const [filename, content] of Object.entries(manifest.files)) {
      if (content) {
        fs.writeFileSync(path.join(wsDir, filename), content, "utf-8")
      }
    }
  }

  // Determine new skills to install
  const lockPath = path.join(wsDir, ".clawhub", "lock.json")
  const existingSkills = new Set<string>()
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"))
      for (const entry of lock.skills ?? []) {
        if (entry.slug) existingSkills.add(entry.slug)
      }
    } catch {
      // Ignore parse errors
    }
  }

  const newSkills = manifest.skills.filter((s) => !existingSkills.has(s))
  if (newSkills.length > 0) {
    ensureClawhub()
    for (const skill of newSkills) {
      installSkill(skill, wsDir)
    }
  }

  // Update all existing skills
  updateAllSkills(wsDir)

  // Update config
  const cfg = readConfig()
  const updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    skills: manifest.skills,
  })
  writeConfig(updatedCfg)
  markInstalled(manifest.id, manifest.version)
  return true
}

export async function agentUpdate(name?: string, options?: { all?: boolean }): Promise<void> {
  if (options?.all || !name) {
    const updates = await checkUpdates()
    if (updates.length === 0) {
      console.log("All agents are up to date.")
      return
    }

    ensureClawhub()
    console.log(`Found ${updates.length} update(s):\n`)
    for (const u of updates) {
      console.log(`  Updating ${u.name}: ${u.currentVersion} → ${u.latestVersion}`)
      await updateAgent(u.agentId)
      console.log(`  ✓ ${u.name} updated to ${u.latestVersion}`)
    }
    console.log("\nRestart the OpenClaw gateway to apply changes.")
    return
  }

  const state = readState()
  if (!state.agents[name]) {
    console.error(`Agent "${name}" is not installed. Use "talenthub agent install ${name}" first.`)
    process.exit(1)
  }

  ensureClawhub()
  console.log(`Updating agent "${name}"...`)
  await updateAgent(name)
  console.log(`✓ Agent "${name}" updated. Restart the OpenClaw gateway to apply changes.`)
}
