import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sampleCatalog = {
  catalogVersion: 2,
  updatedAt: "2026-03-06T00:00:00Z",
  agents: {
    director: { version: "2026.3.6", name: "Director", emoji: "🎬", category: "creative", skillCount: 2 },
  },
}

const sampleManifest = {
  id: "director",
  version: "2026.3.6",
  name: "AI Director",
  emoji: "🎬",
  model: "claude-sonnet-4-5",
  category: "creative",
  role: "AI Director",
  tagline: "Test",
  description: "Test",
  minOpenClawVersion: "2026.3.1",
  skills: ["https://github.com/inferen-sh/skills@web-search", "https://github.com/browser-use/browser-use@browser-use"],
  avatarUrl: null,
  files: { "IDENTITY.md": "# Director Identity" },
}

vi.mock("../lib/registry.js", () => ({
  fetchCatalog: vi.fn().mockResolvedValue(sampleCatalog),
  fetchManifest: vi.fn().mockResolvedValue(sampleManifest),
}))

vi.mock("../lib/skills.js", () => ({
  installAllSkills: vi.fn().mockReturnValue({ installed: 2, skipped: 0, failed: 0 }),
}))

let tmpDir: string
let configPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-install-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  configPath = path.join(tmpDir, ".openclaw", "openclaw.json")
  fs.writeFileSync(configPath, "{}")

  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")
  vi.stubEnv("OPENCLAW_CONFIG_PATH", configPath)
  vi.stubEnv("OPENCLAW_WORKSPACE", "")

  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const { agentInstall } = await import("./agent-install.js")
const { readConfig } = await import("../lib/config.js")
const { readState } = await import("../lib/state.js")
const { installAllSkills } = await import("../lib/skills.js")

describe("agentInstall", () => {
  it("installs agent, writes config, writes files, installs skills", async () => {
    await agentInstall("director", { force: false })

    const cfg = readConfig()
    expect(cfg.agents?.list).toHaveLength(1)
    expect(cfg.agents?.list?.[0].id).toBe("director")

    const state = readState()
    expect(state.agents.director.version).toBe("2026.3.6")

    const wsDir = path.join(tmpDir, ".openclaw", "workspace-director")
    expect(fs.existsSync(path.join(wsDir, "IDENTITY.md"))).toBe(true)
    expect(fs.readFileSync(path.join(wsDir, "IDENTITY.md"), "utf-8")).toBe("# Director Identity")

    expect(installAllSkills).toHaveBeenCalledTimes(1)
    expect(installAllSkills).toHaveBeenCalledWith(["https://github.com/inferen-sh/skills@web-search", "https://github.com/browser-use/browser-use@browser-use"], wsDir, undefined, false)
  })

  it("exits when agent not found in catalog", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })

    await expect(agentInstall("nonexistent", { force: false })).rejects.toThrow("process.exit")
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it("exits when agent exists and no --force", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }))

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })

    await expect(agentInstall("director", { force: false })).rejects.toThrow("process.exit")
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it("overwrites when --force is set", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director", name: "Old" }] } }))

    await agentInstall("director", { force: true })

    const cfg = readConfig()
    expect(cfg.agents?.list?.[0].name).toBe("AI Director")
  })

  it("handles skill install failures gracefully", async () => {
    vi.mocked(installAllSkills).mockReturnValueOnce({ installed: 1, skipped: 0, failed: 1 })

    await agentInstall("director", { force: false })

    const cfg = readConfig()
    expect(cfg.agents?.list).toHaveLength(1)
  })
})
