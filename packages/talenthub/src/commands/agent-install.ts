import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { verifyToken } from "../lib/auth.js"
import { addOrUpdateAgent, findAgentEntry, readConfig, writeConfig } from "../lib/config.js"
import { fetchManifest } from "../lib/registry.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { markInstalled } from "../lib/state.js"
import { scanWorkspaceSkillNames } from "../lib/skills.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

// Weight breakdown: manifest 0→5%, download 5→50%, extract 50→90%, config 90→100%
const WEIGHT = { manifest: 5, downloadStart: 5, downloadEnd: 50, extractEnd: 90, config: 100 }

const PROMPT_FILES = ["IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"]

async function downloadAndExtractZip(
  zipUrl: string,
  wsDir: string,
  json: boolean,
  log: (...args: unknown[]) => void,
): Promise<{ skillCount: number }> {
  log("Downloading package...")
  if (json) jsonl({ event: "progress", phase: "download", percent: WEIGHT.downloadStart })

  const res = await fetch(zipUrl)
  if (!res.ok) throw new Error(`Failed to download zip: ${res.status} ${res.statusText}`)
  const zipBuffer = Buffer.from(await res.arrayBuffer())

  if (json) jsonl({ event: "progress", phase: "download", percent: WEIGHT.downloadEnd })

  log("Extracting...")
  const zip = await JSZip.loadAsync(zipBuffer)

  // Write prompt files
  for (const filename of PROMPT_FILES) {
    const f = zip.file(filename)
    if (f) {
      fs.writeFileSync(path.join(wsDir, filename), await f.async("string"), "utf-8")
    }
  }

  // Extract bundled skills
  let skillCount = 0
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

  return { skillCount }
}

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

  let manifest
  try {
    manifest = await fetchManifest(name, token)
  } catch {
    if (json) jsonl({ event: "error", message: `Agent "${name}" not found` })
    else console.error(`Agent "${name}" not found in registry.`)
    process.exit(1)
  }
  log(`Found ${manifest.emoji} ${manifest.name} v${manifest.version}`)
  if (json) jsonl({
    event: "start",
    agentId: manifest.id, name: manifest.name, emoji: manifest.emoji,
    version: manifest.version,
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

  let skillCount = 0

  if (manifest.zip_url) {
    // New path: download zip and extract everything
    const result = await downloadAndExtractZip(manifest.zip_url, wsDir, json, log)
    skillCount = result.skillCount
  } else {
    // Legacy fallback: write files from manifest response
    log("Writing agent files...")
    if (manifest.files) {
      for (const [filename, content] of Object.entries(manifest.files)) {
        if (content) {
          fs.writeFileSync(path.join(wsDir, filename), content, "utf-8")
        }
      }
    }
    if (json) jsonl({ event: "progress", phase: "extract", percent: WEIGHT.extractEnd })
  }

  // Update config — include workspace skill names as the agent's allowlist
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
    jsonl({ event: "done", success: true, skillCount, workspace: wsDir })
  } else {
    const skillNote = skillCount > 0 ? ` (${skillCount} skills)` : ""
    console.log(`\n${manifest.emoji} Installed ${manifest.name}${skillNote}.`)
  }
}
