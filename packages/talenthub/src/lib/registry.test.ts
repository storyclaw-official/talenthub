import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchCatalog, fetchManifest } from "./registry.js"

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  vi.stubEnv("TALENTHUB_URL", "")
  vi.stubEnv("TALENTHUB_REGISTRY", "")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const BASE = "https://app.storyclaw.com/api/talent/registry"

const sampleCatalog = {
  catalogVersion: 2,
  updatedAt: "2026-03-06T00:00:00Z",
  agents: {
    main: { version: "2026.3.6", name: "Main", emoji: "🤖", category: "general", role: "AI Assistant", tagline: "Test", skillCount: 5 },
  },
}

const sampleManifest = {
  id: "main",
  version: "2026.3.6",
  name: "Main Agent",
  emoji: "🤖",
  model: "claude-sonnet-4-5",
  category: "general",
  role: "AI Assistant",
  tagline: "Test",
  description: "Test desc",
  minOpenClawVersion: "2026.3.1",
  skills: ["web-search"],
  avatarUrl: null,
  files: { "IDENTITY.md": "# Identity", "SOUL.md": "# Soul" },
}

describe("fetchCatalog", () => {
  it("returns parsed catalog on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleCatalog),
    })
    const result = await fetchCatalog()
    expect(result).toEqual(sampleCatalog)
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/catalog`)
  })

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
    await expect(fetchCatalog()).rejects.toThrow("Failed to fetch catalog: 404 Not Found")
  })

  it("uses TALENTHUB_URL override", async () => {
    vi.stubEnv("TALENTHUB_URL", "http://localhost:3000")
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleCatalog),
    })
    await fetchCatalog()
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/talent/registry/catalog")
  })
})

describe("fetchManifest", () => {
  it("returns parsed manifest on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleManifest),
    })
    const result = await fetchManifest("main")
    expect(result).toEqual(sampleManifest)
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/main`)
  })

  it("throws descriptive error for missing agent", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" })
    await expect(fetchManifest("unknown")).rejects.toThrow('Agent "unknown" not found in registry (404)')
  })
})
