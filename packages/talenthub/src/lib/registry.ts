import { getRegistryBaseUrl } from "./auth.js"

function apiUrl(path: string): string {
  const base = getRegistryBaseUrl().replace(/\/$/, "")
  return `${base}/api/talent/registry${path}`
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
}

export async function fetchCatalog(): Promise<Catalog> {
  const url = apiUrl("/catalog")
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function fetchManifest(agentId: string): Promise<AgentManifest> {
  const url = apiUrl(`/${agentId}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Agent "${agentId}" not found in registry (${res.status})`)
  }
  return res.json()
}
