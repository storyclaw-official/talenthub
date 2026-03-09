import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sampleManifest = {
  id: "director",
  version: "2026.3.7",
  name: "AI Director",
  emoji: "🎬",
  model: "claude-sonnet-4-5",
  category: "creative",
  minOpenClawVersion: "2026.3.1",
  skills: ["web-search", "browser-use", "new-skill"],
  files: ["IDENTITY.md"],
};

vi.mock("../lib/github.js", () => ({
  fetchManifest: vi.fn().mockResolvedValue(sampleManifest),
  fetchAgentFile: vi.fn().mockResolvedValue("# Updated Identity"),
  fetchCatalog: vi.fn().mockResolvedValue({
    catalogVersion: 1,
    updatedAt: "2026-03-06T00:00:00Z",
    agents: {
      director: { version: "2026.3.7", name: "Director", emoji: "🎬", category: "creative", skillCount: 3 },
    },
  }),
}));

vi.mock("../lib/clawhub.js", () => ({
  ensureClawhub: vi.fn(),
  installSkill: vi.fn().mockReturnValue(true),
  updateAllSkills: vi.fn().mockReturnValue(true),
}));

let tmpDir: string;
let configPath: string;
let statePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-update-test-"));
  const stateDir = path.join(tmpDir, ".openclaw");
  fs.mkdirSync(stateDir);
  configPath = path.join(stateDir, "openclaw.json");
  statePath = path.join(stateDir, "talenthub.json");
  fs.writeFileSync(configPath, "{}");

  vi.stubEnv("OPENCLAW_HOME", tmpDir);
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
  vi.stubEnv("OPENCLAW_CONFIG_PATH", configPath);
  vi.stubEnv("OPENCLAW_WORKSPACE", "");

  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const { agentUpdate } = await import("./agent-update.js");
const { readConfig } = await import("../lib/config.js");
const { readState } = await import("../lib/state.js");
const { installSkill, updateAllSkills } = await import("../lib/clawhub.js");

describe("agentUpdate", () => {
  it("updates a single installed agent", async () => {
    // Pre-install the agent
    const stateDir = path.join(tmpDir, ".openclaw");
    const wsDir = path.join(stateDir, "workspace-director");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, "IDENTITY.md"), "# Old Identity");
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }));
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    );

    await agentUpdate("director", {});

    // File should be updated
    expect(fs.readFileSync(path.join(wsDir, "IDENTITY.md"), "utf-8")).toBe("# Updated Identity");

    // Backup should exist
    expect(fs.existsSync(`${wsDir}.bak`)).toBe(true);

    // Config should be updated
    const cfg = readConfig();
    expect(cfg.agents?.list?.[0].model).toBe("claude-sonnet-4-5");

    // State version should be updated
    const state = readState();
    expect(state.agents.director.version).toBe("2026.3.7");
  });

  it("installs only new skills (not already in lock.json)", async () => {
    const stateDir = path.join(tmpDir, ".openclaw");
    const wsDir = path.join(stateDir, "workspace-director");
    const lockDir = path.join(wsDir, ".clawhub");
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(
      path.join(lockDir, "lock.json"),
      JSON.stringify({ skills: [{ slug: "web-search" }, { slug: "browser-use" }] }),
    );
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }));
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    );

    await agentUpdate("director", {});

    // Only "new-skill" should be installed (web-search and browser-use already in lock)
    expect(installSkill).toHaveBeenCalledTimes(1);
    expect(installSkill).toHaveBeenCalledWith("new-skill", wsDir);

    // updateAllSkills should still be called
    expect(updateAllSkills).toHaveBeenCalledWith(wsDir);
  });

  it("exits when agent is not installed", async () => {
    fs.writeFileSync(statePath, JSON.stringify({ agents: {} }));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(agentUpdate("director", {})).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("update --all with no updates available", async () => {
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.7", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    );

    await agentUpdate(undefined, { all: true });

    expect(console.log).toHaveBeenCalledWith("All agents are up to date.");
  });

  it("update --all with updates available", async () => {
    const stateDir = path.join(tmpDir, ".openclaw");
    const wsDir = path.join(stateDir, "workspace-director");
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }));
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" } },
      }),
    );

    await agentUpdate(undefined, { all: true });

    const state = readState();
    expect(state.agents.director.version).toBe("2026.3.7");
  });
});
