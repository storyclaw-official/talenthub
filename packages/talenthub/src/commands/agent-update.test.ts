import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sampleManifest = {
  id: "director",
  version: "2026.3.7",
  name: "AI Director",
  emoji: "🎬",
  model: "claude-sonnet-4-5",
  category: "creative",
  role: "AI Director",
  tagline: "Test",
  description: "Test",
  minOpenClawVersion: "2026.3.1",
  skills: ["inferen-sh/skills@web-search", "browser-use/browser-use@browser-use", "anthropics/skills@new-skill"],
  avatarUrl: null,
  files: { "IDENTITY.md": "# Updated Identity" },
}

vi.mock("../lib/registry.js", () => ({
  fetchManifest: vi.fn().mockResolvedValue(sampleManifest),
  fetchCatalog: vi.fn().mockResolvedValue({
    catalogVersion: 2,
    updatedAt: "2026-03-06T00:00:00Z",
    agents: {
      director: { version: "2026.3.7", name: "Director", emoji: "🎬", category: "creative", skillCount: 3 },
    },
  }),
}))

vi.mock("../lib/skills.js", () => ({
  installAllSkills: vi.fn().mockReturnValue({ installed: 1, skipped: 2, failed: 0 }),
  updateAllSkills: vi.fn().mockReturnValue(true),
  syncSkillLinks: vi.fn(),
}))

let tmpDir: string
let configPath: string
let statePath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-update-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  configPath = path.join(stateDir, "openclaw.json")
  statePath = path.join(stateDir, "talenthub.json")
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

const { agentUpdate } = await import("./agent-update.js")
const { readConfig } = await import("../lib/config.js")
const { readState } = await import("../lib/state.js")
const { installAllSkills, updateAllSkills } = await import("../lib/skills.js")

describe("agentUpdate", () => {
  it("updates a single installed agent", async () => {
    const stateDir = path.join(tmpDir, ".openclaw")
    const wsDir = path.join(stateDir, "workspace-director")
    fs.mkdirSync(wsDir, { recursive: true })
    fs.writeFileSync(path.join(wsDir, "IDENTITY.md"), "# Old Identity")
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }))
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    )

    await agentUpdate("director", {})

    expect(fs.readFileSync(path.join(wsDir, "IDENTITY.md"), "utf-8")).toBe("# Updated Identity")
    expect(fs.existsSync(`${wsDir}.bak`)).toBe(true)

    const cfg = readConfig()
    expect(cfg.agents?.list?.[0].name).toBe("AI Director")

    const state = readState()
    expect(state.agents.director.version).toBe("2026.3.7")

    expect(installAllSkills).toHaveBeenCalledWith(
      ["inferen-sh/skills@web-search", "browser-use/browser-use@browser-use", "anthropics/skills@new-skill"],
      wsDir,
    )
  })

  it("exits when agent is not installed", async () => {
    fs.writeFileSync(statePath, JSON.stringify({ agents: {} }))

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })

    await expect(agentUpdate("director", {})).rejects.toThrow("process.exit")
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it("update --all with no updates available", async () => {
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.7", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    )

    await agentUpdate(undefined, { all: true })

    expect(console.log).toHaveBeenCalledWith("All agents are up to date.")
  })

  it("update --all with updates available", async () => {
    const stateDir = path.join(tmpDir, ".openclaw")
    const wsDir = path.join(stateDir, "workspace-director")
    fs.mkdirSync(wsDir, { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }))
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    )

    await agentUpdate(undefined, { all: true })

    expect(updateAllSkills).toHaveBeenCalled()

    const state = readState()
    expect(state.agents.director.version).toBe("2026.3.7")
  })
})
