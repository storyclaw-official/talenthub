import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"

// Brain files included in every exported / published agent zip.
// Mirrors the storyclaw workspace validator's accepted brain-file
// set so the agent doesn't have to retry uploads.
const PROMPT_FILES = [
  "AGENTS.md",
  "BOOTSTRAP.md",
  "EVOLUTION.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "SOUL.md",
  "TOOLS.md",
  "USER.md",
]

// Skill directories we never ship. `storyclaw-workspace-reporter` is
// the per-installation API client for the originating agent; its
// `.auth` is already filtered (dotfile), but the surrounding
// scaffolding is also scoped — receivers re-install it cleanly with
// their own key.
const SKIPPED_SKILL_DIRS = new Set<string>(["storyclaw-workspace-reporter"])

// File patterns we filter inside the skills walk. Mirrors the
// storyclaw workspace validator's BLACKLIST_PATTERNS so the agent
// doesn't have to retry --exclude'ing them. Matches against the
// zip-relative key (forward-slash separated).
const SKILL_FILE_BLACKLIST: RegExp[] = [
  /(?:^|\/)__pycache__\//,
  /\.pyc$/i,
  /(?:^|\/)secrets?\//,
  /(?:^|\/)id_rsa(?:\.pub)?$/,
  /\.pem$/i,
  /\.p12$/i,
  // Generated lockfile; talenthub install rebuilds it anyway.
  /(?:^|\/)skills-lock\.json$/,
]

const MAX_FILE_SIZE = 200 * 1024
const MAX_TOTAL_PROMPT_SIZE = 1024 * 1024
const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50MB

export type AgentDirContents = {
  manifest: Record<string, unknown>
  prompts: Record<string, string>
  skills: Record<string, Record<string, string>>
  skillNames: string[]
}

/**
 * Read an agent workspace directory and return manifest, prompts, and skills.
 * Validates prompt file sizes. Handles symlinked skill dirs.
 */
export function readAgentDir(dir: string): AgentDirContents {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    process.exit(1)
  }

  const manifestPath = path.join(dir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    console.error(`manifest.json not found in ${dir}`)
    console.error('Create a manifest.json with at least: { "id": "...", "name": "...", "category": "..." }')
    process.exit(1)
  }

  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  } catch {
    console.error("Failed to parse manifest.json.")
    process.exit(1)
  }

  // Read prompt files
  const prompts: Record<string, string> = {}
  let totalPromptSize = 0
  for (const filename of PROMPT_FILES) {
    const p = path.join(dir, filename)
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8")
      const size = Buffer.byteLength(content, "utf-8")
      if (size > MAX_FILE_SIZE) {
        console.error(`${filename} exceeds 200KB limit (${Math.round(size / 1024)}KB).`)
        process.exit(1)
      }
      totalPromptSize += size
      prompts[filename] = content
    }
  }
  if (totalPromptSize > MAX_TOTAL_PROMPT_SIZE) {
    console.error(`Total prompt content exceeds 1MB limit (${Math.round(totalPromptSize / 1024)}KB).`)
    process.exit(1)
  }

  // Read skills from workspace/skills/ directory
  const skills: Record<string, Record<string, string>> = {}
  const skillsDir = path.join(dir, "skills")
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir)) {
      // Per-installation skills must not be bundled.
      if (SKIPPED_SKILL_DIRS.has(entry)) continue
      const skillPath = path.join(skillsDir, entry)
      let realPath: string
      try {
        realPath = fs.realpathSync(skillPath)
      } catch {
        continue
      }
      if (!fs.statSync(realPath).isDirectory()) continue

      const files: Record<string, string> = {}
      const readDir = (dir: string, prefix: string) => {
        for (const file of fs.readdirSync(dir)) {
          // Skip dotfiles. The big one we MUST exclude is `.auth` — the
          // workspace-reporter skill writes a per-agent CloudFront-signing
          // key there at install time, and including it in a published or
          // exported agent zip would leak that key to anyone who installs
          // the resulting catalog entry. Same blanket filter incidentally
          // keeps editor cruft (.DS_Store, .swp) out of the zip.
          if (file.startsWith(".")) continue
          const key = prefix ? `${prefix}/${file}` : file
          // Skip files / subdirs the storyclaw workspace validator
          // would reject. Saves the agent a retry round-trip per
          // offending path.
          if (SKILL_FILE_BLACKLIST.some((re) => re.test(key))) continue
          const fullPath = path.join(dir, file)
          if (fs.statSync(fullPath).isDirectory()) {
            readDir(fullPath, key)
          } else {
            files[key] = fs.readFileSync(fullPath, "utf-8")
          }
        }
      }
      readDir(realPath, "")
      if (Object.keys(files).length > 0) {
        skills[entry] = files
      }
    }
  }

  return { manifest, prompts, skills, skillNames: Object.keys(skills) }
}

export type BuildZipResult = {
  buffer: Buffer
  files: string[]
  skillCount: number
  sizeKB: number
}

/**
 * Build a zip buffer from agent contents.
 * Uses fixed timestamps for deterministic content hashing.
 */
export async function buildAgentZip(contents: AgentDirContents): Promise<BuildZipResult> {
  const { manifest, prompts, skills } = contents
  const zip = new JSZip()
  const fixedDate = new Date("2020-01-01T00:00:00Z")

  // manifest.json (metadata only — no version)
  const manifestContent = {
    id: manifest.id,
    name: manifest.name,
    emoji: manifest.emoji || undefined,
    category: manifest.category || undefined,
    role: manifest.role || undefined,
    tagline: manifest.tagline || undefined,
    description: manifest.description || undefined,
    i18n: manifest.i18n && typeof manifest.i18n === "object" ? manifest.i18n : undefined,
  }
  zip.file("manifest.json", JSON.stringify(manifestContent, null, 2) + "\n", { date: fixedDate })

  const files: string[] = ["manifest.json"]

  // Prompt files
  for (const [filename, content] of Object.entries(prompts)) {
    zip.file(filename, content, { date: fixedDate })
    files.push(filename)
  }

  // Skills
  let skillCount = 0
  for (const [skillName, skillFiles] of Object.entries(skills)) {
    for (const [fileName, content] of Object.entries(skillFiles)) {
      zip.file(`skills/${skillName}/${fileName}`, content, { date: fixedDate })
    }
    skillCount++
  }
  if (skillCount > 0) {
    files.push(`skills/ (${skillCount} skills)`)
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }))

  if (buffer.length > MAX_ZIP_SIZE) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1)
    console.error(`Zip exceeds 50MB limit (${sizeMB}MB).`)
    process.exit(1)
  }

  return {
    buffer,
    files,
    skillCount,
    sizeKB: Math.round(buffer.length / 1024),
  }
}
