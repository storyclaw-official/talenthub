import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { readAuth, getRegistryBaseUrl } from "../lib/auth.js"
import { findAgentEntry, readConfig } from "../lib/config.js"
import { fetchRetry } from "../lib/fetch.js"
import { resolveWorkspaceDir } from "../lib/paths.js"

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

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

  let manifest: Record<string, unknown> = {}
  const manifestPath = path.join(dir, "manifest.json")
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    } catch {
      console.warn("Warning: could not parse manifest.json.")
    }
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

export async function agentPublish(name: string, opts: { dir?: string } = {}): Promise<void> {
  const auth = readAuth()
  if (!auth) {
    console.error("Not logged in. Run \"talenthub login\" first.")
    process.exit(1)
  }

  let manifest: Record<string, unknown>
  let files: Record<string, string>
  let fallbackName = name
  let fallbackModel = "claude-sonnet-4-5"
  let fallbackSkills: string[] = []

  if (opts.dir) {
    const agentDir = path.resolve(opts.dir)
    ;({ manifest, files } = readAgentDir(agentDir))
  } else {
    const cfg = readConfig()
    const entry = findAgentEntry(cfg, name)
    if (!entry) {
      console.error(`Agent "${name}" not found in openclaw config.`)
      console.error("Use --dir to publish from an agent directory, or install the agent first.")
      process.exit(1)
    }
    fallbackName = entry.name || name
    fallbackModel = entry.model || fallbackModel
    fallbackSkills = entry.skills || []

    const wsDir = resolveWorkspaceDir(name)
    ;({ manifest, files } = readAgentDir(wsDir))
  }

  const agentId = (manifest.id as string) || name
  const currentVersion = (manifest.version as string) || "0.1.0"

  const version = await prompt(`Version [${currentVersion}]: `)
  const finalVersion = version || currentVersion

  const payload = {
    id: agentId,
    version: finalVersion,
    name: (manifest.name as string) || fallbackName,
    emoji: (manifest.emoji as string) || "",
    role: (manifest.role as string) || "",
    tagline: (manifest.tagline as string) || "",
    description: (manifest.description as string) || "",
    category: (manifest.category as string) || "productivity",
    model: (manifest.model as string) || fallbackModel,
    skills: (manifest.skills as string[]) || fallbackSkills,
    identity_prompt: files["IDENTITY.md"] || "",
    user_prompt: files["USER.md"] || "",
    soul_prompt: files["SOUL.md"] || "",
    agents_prompt: files["AGENTS.md"] || "",
    min_openclaw_version: (manifest.minOpenClawVersion as string) || null,
    avatar_url: (manifest.avatarUrl as string) || null,
    is_public: true,
    ...(manifest.i18n && typeof manifest.i18n === "object"
      ? { i18n: manifest.i18n }
      : {}),
  }

  console.log(`\nPublishing ${payload.emoji || ""} ${payload.name} v${finalVersion}...`)

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
