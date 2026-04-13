import fs from "node:fs"
import path from "node:path"
import { readAuth, getRegistryBaseUrl } from "../lib/auth.js"
import { findAgentEntry, readConfig } from "../lib/config.js"
import { fetchRetry } from "../lib/fetch.js"
import { resolveWorkspaceDir } from "../lib/paths.js"

const MAX_FILE_SIZE = 200 * 1024
const MAX_TOTAL_SIZE = 1024 * 1024

function readAgentDir(dir: string): {
  manifest: Record<string, unknown>
  files: Record<string, string>
} {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    process.exit(1)
  }

  const manifestPath = path.join(dir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    console.error(`manifest.json not found in ${dir}`)
    console.error("Create a manifest.json with at least: { \"id\": \"...\", \"name\": \"...\", \"category\": \"...\" }")
    process.exit(1)
  }

  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  } catch {
    console.error("Failed to parse manifest.json.")
    process.exit(1)
  }

  const files: Record<string, string> = {}
  let totalSize = 0
  for (const filename of ["IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"]) {
    const p = path.join(dir, filename)
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8")
      const size = Buffer.byteLength(content, "utf-8")
      if (size > MAX_FILE_SIZE) {
        console.error(`${filename} exceeds 200KB limit (${Math.round(size / 1024)}KB).`)
        process.exit(1)
      }
      totalSize += size
      files[filename] = content
    }
  }
  if (totalSize > MAX_TOTAL_SIZE) {
    console.error(`Total prompt content exceeds 1MB limit (${Math.round(totalSize / 1024)}KB).`)
    process.exit(1)
  }

  return { manifest, files }
}

export async function agentPublish(opts: { dir?: string; name?: string; id?: string } = {}): Promise<void> {
  const auth = readAuth()
  if (!auth) {
    console.error("Not logged in. Run \"talenthub login\" first.")
    process.exit(1)
  }

  let manifest: Record<string, unknown>
  let files: Record<string, string>

  if (opts.dir) {
    const agentDir = path.resolve(opts.dir)
    ;({ manifest, files } = readAgentDir(agentDir))
  } else if (opts.name) {
    const cfg = readConfig()
    const entry = findAgentEntry(cfg, opts.name)
    if (!entry) {
      console.error(`Agent "${opts.name}" not found in openclaw config.`)
      console.error("Use --dir to publish from an agent directory.")
      process.exit(1)
    }
    const wsDir = resolveWorkspaceDir(opts.name)
    ;({ manifest, files } = readAgentDir(wsDir))
  } else {
    // Default to current directory
    ;({ manifest, files } = readAgentDir(path.resolve(".")))
  }

  const agentId = opts.id || (manifest.id as string)
  if (!agentId) {
    console.error("No agent ID found. Set \"id\" in manifest.json or use --id.")
    process.exit(1)
  }

  const agentName = (manifest.name as string)
  if (!agentName) {
    console.error("No agent name found. Set \"name\" in manifest.json.")
    process.exit(1)
  }

  const payload = {
    id: agentId,
    name: agentName,
    emoji: (manifest.emoji as string) || "",
    role: (manifest.role as string) || "",
    tagline: (manifest.tagline as string) || "",
    description: (manifest.description as string) || "",
    category: (manifest.category as string) || "productivity",
    skills: (manifest.skills as string[]) || [],
    identity_prompt: files["IDENTITY.md"] || "",
    user_prompt: files["USER.md"] || "",
    soul_prompt: files["SOUL.md"] || "",
    agents_prompt: files["AGENTS.md"] || "",
    min_openclaw_version: (manifest.minOpenClawVersion as string) || null,
    avatar_url: (manifest.avatarUrl as string) || null,
    is_public: true,
    i18n: manifest.i18n && typeof manifest.i18n === "object" ? manifest.i18n : {},
  }

  console.log(`\nPublishing ${payload.emoji || ""} ${payload.name}...`)

  const base = getRegistryBaseUrl()
  const url = `${base}/api/talenthub/registry/publish`

  const res = await fetchRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify(payload),
  })

  const result = await res.json().catch(() => ({ error: "Unknown error" }))

  if (!res.ok) {
    console.error(`\n✗ Publish failed: ${result.error}`)
    process.exit(1)
  }

  console.log(`\n✓ ${result.message}`)
}
