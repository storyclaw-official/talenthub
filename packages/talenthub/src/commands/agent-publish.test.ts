import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockFetch = vi.fn()

let tmpDir: string
let configPath: string
let authPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-publish-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  configPath = path.join(stateDir, "openclaw.json")
  authPath = path.join(stateDir, "talenthub-auth.json")

  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")
  vi.stubEnv("OPENCLAW_CONFIG_PATH", configPath)
  vi.stubEnv("OPENCLAW_WORKSPACE", "")
  vi.stubEnv("TALENTHUB_URL", "http://localhost:3000")
  vi.stubEnv("TALENTHUB_REGISTRY", "")

  vi.stubGlobal("fetch", mockFetch)

  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const { agentPublish } = await import("./agent-publish.js")

function setupAuth() {
  fs.writeFileSync(
    authPath,
    JSON.stringify({
      token: "th_test",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }),
  )
}

function setupAgent() {
  fs.writeFileSync(
    configPath,
    JSON.stringify({ agents: { list: [{ id: "test-agent", name: "Test Agent" }] } }),
  )
  const wsDir = path.join(tmpDir, ".openclaw", "workspace-test-agent")
  fs.mkdirSync(wsDir, { recursive: true })
  fs.writeFileSync(path.join(wsDir, "IDENTITY.md"), "# Test Identity")
  fs.writeFileSync(path.join(wsDir, "USER.md"), "# Test User")
  fs.writeFileSync(path.join(wsDir, "SOUL.md"), "# Test Soul")
  fs.writeFileSync(path.join(wsDir, "AGENTS.md"), "# Test Agents")
  fs.writeFileSync(
    path.join(wsDir, "manifest.json"),
    JSON.stringify({
      id: "test-agent",
      name: "Test Agent",
      emoji: "🧪",
      category: "productivity",
      skills: ["web-search"],
    }),
  )
  return wsDir
}

describe("agentPublish", () => {
  it("exits when not logged in", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })
    await expect(agentPublish({ name: "test-agent" })).rejects.toThrow("process.exit")
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it("exits when manifest.json not found", async () => {
    setupAuth()
    // Create dir without manifest.json
    const wsDir = path.join(tmpDir, "no-manifest")
    fs.mkdirSync(wsDir, { recursive: true })

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })
    await expect(agentPublish({ dir: wsDir })).rejects.toThrow("process.exit")
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it("publishes agent successfully", async () => {
    setupAuth()
    const wsDir = setupAgent()

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, status: "pending", message: "Published!" }),
    })

    await agentPublish({ dir: wsDir })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe("http://localhost:3000/api/talenthub/registry/publish")
    const body = JSON.parse(call[1].body)
    expect(body.id).toBe("test-agent")
    expect(body.soul_prompt).toBe("# Test Soul")
  })

  it("handles publish failure", async () => {
    setupAuth()
    const wsDir = setupAgent()

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Agent ID already taken" }),
    })

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })
    await expect(agentPublish({ dir: wsDir })).rejects.toThrow("process.exit")
    exitSpy.mockRestore()
  })
})
