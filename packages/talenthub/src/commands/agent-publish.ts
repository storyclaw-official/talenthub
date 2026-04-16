import path from "node:path"
import { readAuth, getRegistryBaseUrl } from "../lib/auth.js"
import { findAgentEntry, readConfig } from "../lib/config.js"
import { fetchRetry } from "../lib/fetch.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { readAgentDir, buildAgentZip } from "../lib/agent-zip.js"

export async function agentPublish(opts: { dir?: string; name?: string; id?: string; private?: boolean } = {}): Promise<void> {
  const auth = readAuth()
  if (!auth) {
    console.error("Not logged in. Run \"talenthub login\" first.")
    process.exit(1)
  }

  let dir: string
  if (opts.dir) {
    dir = path.resolve(opts.dir)
  } else if (opts.name) {
    const cfg = readConfig()
    const entry = findAgentEntry(cfg, opts.name)
    if (!entry) {
      console.error(`Agent "${opts.name}" not found in openclaw config.`)
      console.error("Use --dir to publish from an agent directory.")
      process.exit(1)
    }
    dir = resolveWorkspaceDir(opts.name)
  } else {
    dir = path.resolve(".")
  }

  const contents = readAgentDir(dir)
  const { manifest, prompts } = contents

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

  console.log(`\nPackaging ${manifest.emoji || ""} ${agentName}...`)

  if (contents.skillNames.length > 0) {
    console.log(`  Skills: ${contents.skillNames.join(", ")}`)
  }

  const { buffer, sizeKB } = await buildAgentZip(contents)

  console.log(`  Package size: ${sizeKB} KB`)
  console.log(`  Publishing...`)

  // Build metadata for dual-write (DB columns)
  const metadata = {
    id: agentId,
    name: agentName,
    emoji: (manifest.emoji as string) || "",
    role: (manifest.role as string) || "",
    tagline: (manifest.tagline as string) || "",
    description: (manifest.description as string) || "",
    category: (manifest.category as string) || "productivity",
    skills: (manifest.skills as string[]) || [],
    identity_prompt: prompts["IDENTITY.md"] || "",
    user_prompt: prompts["USER.md"] || "",
    soul_prompt: prompts["SOUL.md"] || "",
    agents_prompt: prompts["AGENTS.md"] || "",
    min_openclaw_version: (manifest.minOpenClawVersion as string) || null,
    avatar_url: (manifest.avatarUrl as string) || null,
    is_public: opts.private !== true,
    i18n: manifest.i18n && typeof manifest.i18n === "object" ? manifest.i18n : {},
  }

  // Multipart POST: metadata JSON + zip file
  const formData = new FormData()
  formData.append("metadata", JSON.stringify(metadata))
  formData.append("zip", new Blob([new Uint8Array(buffer)], { type: "application/zip" }), `${agentId}.zip`)

  const base = getRegistryBaseUrl()
  const url = `${base}/api/talenthub/registry/publish`

  const res = await fetchRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
    body: formData,
  })

  const result = await res.json().catch(() => ({ error: "Unknown error" }))

  if (!res.ok) {
    console.error(`\n✗ Publish failed: ${result.error}`)
    process.exit(1)
  }

  console.log(`\n✓ ${result.message}`)
  if (result.zipUrl) {
    console.log(`  Package: ${result.zipUrl}`)
  }
}
