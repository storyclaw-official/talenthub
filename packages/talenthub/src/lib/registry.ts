import { getRegistryBaseUrl, readAuth } from "./auth.js"
import { fetchRetry } from "./fetch.js"

function apiUrl(path: string): string {
  const base = getRegistryBaseUrl().replace(/\/$/, "")
  return `${base}/api/talenthub/registry${path}`
}

function authHeaders(token?: string): Record<string, string> {
  const t = token ?? readAuth()?.token
  if (t) {
    return { Authorization: `Bearer ${t}` }
  }
  return {}
}

export type CatalogAgent = {
  version: string
  name: string
  emoji: string
  category: string
  role: string
  tagline: string
  skillCount: number
}

export type Catalog = {
  catalogVersion: number
  updatedAt: string
  agents: Record<string, CatalogAgent>
}

export type AgentManifest = {
  id: string
  version: string
  name: string
  emoji: string
  model: string
  category: string
  role: string
  tagline: string
  description: string
  minOpenClawVersion: string
  skills: string[]
  avatarUrl: string | null
  files: Record<string, string>
  zip_url?: string
}

export async function fetchCatalog(token?: string): Promise<Catalog> {
  const url = apiUrl("/catalog")
  const res = await fetchRetry(url, { headers: authHeaders(token) })
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function fetchManifest(agentId: string, token?: string): Promise<AgentManifest> {
  const url = apiUrl(`/${agentId}`)
  const res = await fetchRetry(url, { headers: authHeaders(token) })
  if (!res.ok) {
    throw new Error(`Agent "${agentId}" not found in registry (${res.status})`)
  }
  return res.json()
}

/**
 * Fetch a share-scoped agent manifest. Used when the CLI is invoked
 * with `--shared-token <token>` — the token itself is the credential
 * and the registry endpoint at `/registry/share/<token>` synthesizes
 * the manifest from the underlying workspace_items row.
 *
 * No `Authorization` header is sent: the share token lives in the
 * URL path, not in a Bearer, to match the website's existing
 * `/api/share/.../raw` style of token-in-path access. Failure modes
 * (revoked, expired, not-found, allowlist mismatch) all surface as
 * 404 to avoid leaking whether a token ever existed.
 */
export async function fetchSharedManifest(shareToken: string): Promise<AgentManifest> {
  const url = apiUrl(`/share/${shareToken}`)
  const res = await fetchRetry(url, {})
  if (!res.ok) {
    // Include the URL in the error so misrouted hosts (e.g. CLI
    // pointing at prod while the share lives on dev) are obvious
    // from the failure message alone.
    throw new Error(`Shared agent not available (${res.status}) — fetched ${url}`)
  }
  return res.json()
}
