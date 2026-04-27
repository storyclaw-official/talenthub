import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { addOrUpdateAgent, readConfig, writeConfig } from "../lib/config.js"
import { fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { findAgent, markInstalled, readState, writeState } from "../lib/state.js"
import {
  scanWorkspaceSkillNames,
  installSkillFromZip,
  removeSkillFromWorkspace,
  skillName as extractSkillName,
} from "../lib/skills.js"
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

  // Update config — replace workspace skill allowlist
  const cfg = readConfig()
  const skills = scanWorkspaceSkillNames(wsDir)
  const updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    workspace: wsDir,
    ...(skills.length > 0 ? { skills } : {}),
  })
  writeConfig(updatedCfg)
  markInstalled(manifest.id, manifest.version)
  if (json) jsonl({ event: "progress", phase: "config", percent: WEIGHT.config })

  if (json) {
    jsonl({ event: "done", agentId, success: true, version: manifest.version, skillCount })
  }

  return true
}

// Skill weight: download 5→50, extract 50→90, install 90→100 (matches agent-install).
const SKILL_WEIGHT = { download: 50, extract: 90, install: 100 }

function syncAllowlistForAgent(agentId: string): number {
  const wsDir = resolveWorkspaceDir(agentId)
  const skills = scanWorkspaceSkillNames(wsDir)
  const cfg = readConfig()
  // Preserve existing agent metadata — addOrUpdateAgent spreads the entry into
  // the existing one, so we only need to supply id + the skills we want to write.
  const updated = addOrUpdateAgent(cfg, {
    id: agentId,
    workspace: wsDir,
    skills,
  })
  writeConfig(updated)
  return skills.length
}

async function agentAddSkill(
  agentId: string,
  zipUrl: string,
  options: { force?: boolean; json?: boolean },
): Promise<void> {
  const json = options.json === true
  const log = json ? () => {} : console.log.bind(console)

  // Falls back to on-disk workspace lookup when state is missing the agent
  // (e.g. the openclaw runtime default "main" agent).
  const found = findAgent(agentId)
  if (!found) {
    if (json) jsonl({ event: "error", message: `Agent "${agentId}" is not installed` })
    else console.error(`Agent "${agentId}" is not installed.`)
    process.exit(1)
  }
  const { state, agent } = found

  const wsDir = resolveWorkspaceDir(agentId)

  if (json) jsonl({ event: "start", agentId, action: "add-skill" })
  log(`Adding skill from ${zipUrl} for agent "${agentId}"...`)

  try {
    const result = await installSkillFromZip(zipUrl, wsDir, {
      force: options.force === true,
      onProgress: (evt) => {
        if (json) jsonl({ event: "progress", phase: evt.phase, percent: evt.percent })
      },
    })

    // Update talenthub.json manifest.skills list
    if (agent.manifest) {
      const existingIdx = agent.manifest.skills.findIndex(
        (s) => extractSkillName(s) === result.skillName,
      )
      if (existingIdx >= 0) {
        agent.manifest.skills[existingIdx] = zipUrl
      } else {
        agent.manifest.skills.push(zipUrl)
      }
      writeState(state)
    }

    // Sync openclaw allowlist (scan workspace + write config.agents.list[].skills)
    syncAllowlistForAgent(agentId)
    if (json) jsonl({ event: "progress", phase: "install", percent: SKILL_WEIGHT.install })

    if (json) jsonl({ event: "done", agentId, skill: result.skillName, action: "added", success: true })
    else log(`✓ Skill "${result.skillName}" added for agent "${agentId}".`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (json) jsonl({ event: "error", message })
    else console.error(`Failed to add skill: ${message}`)
    process.exit(1)
  }
}

async function agentRemoveSkill(
  agentId: string,
  skillNameArg: string,
  options: { json?: boolean },
): Promise<void> {
  const json = options.json === true
  const log = json ? () => {} : console.log.bind(console)

  // Falls back to on-disk workspace lookup when state is missing the agent.
  const found = findAgent(agentId)
  if (!found) {
    if (json) jsonl({ event: "error", message: `Agent "${agentId}" is not installed` })
    else console.error(`Agent "${agentId}" is not installed.`)
    process.exit(1)
  }
  const { state, agent } = found

  const wsDir = resolveWorkspaceDir(agentId)

  if (json) jsonl({ event: "start", agentId, action: "remove-skill" })
  log(`Removing skill "${skillNameArg}" from agent "${agentId}"...`)

  try {
    removeSkillFromWorkspace(skillNameArg, wsDir)

    // Drop matching entry from talenthub.json manifest.skills[]
    if (agent.manifest) {
      const matchIdx = agent.manifest.skills.findIndex(
        (s) => extractSkillName(s) === skillNameArg,
      )
      if (matchIdx >= 0) {
        agent.manifest.skills.splice(matchIdx, 1)
        writeState(state)
      }
    }

    // Sync allowlist
    syncAllowlistForAgent(agentId)

    if (json) jsonl({ event: "done", agentId, skill: skillNameArg, action: "removed", success: true })
    else log(`✓ Skill "${skillNameArg}" removed from agent "${agentId}".`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (json) jsonl({ event: "error", message })
    else console.error(`Failed to remove skill: ${message}`)
    process.exit(1)
  }
}

export async function agentUpdate(
  name?: string,
  options?: {
    all?: boolean
    json?: boolean
    addSkill?: string
    removeSkill?: string
    force?: boolean
  },
): Promise<void> {
  const json = options?.json === true
  const log = json ? () => {} : console.log.bind(console)

  // Skill-level operations on an existing agent.
  if (options?.addSkill || options?.removeSkill) {
    if (!name) {
      if (json) jsonl({ event: "error", message: "Agent id required for --add-skill / --remove-skill" })
      else console.error("Agent id required when using --add-skill or --remove-skill.")
      process.exit(1)
    }
    if (options.addSkill && options.removeSkill) {
      if (json) jsonl({ event: "error", message: "--add-skill and --remove-skill are mutually exclusive" })
      else console.error("--add-skill and --remove-skill are mutually exclusive.")
      process.exit(1)
    }
    if (options.addSkill) {
      await agentAddSkill(name, options.addSkill, { force: options.force, json })
      return
    }
    await agentRemoveSkill(name, options.removeSkill!, { json })
    return
  }

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
