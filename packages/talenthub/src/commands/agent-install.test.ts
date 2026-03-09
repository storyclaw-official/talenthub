import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sampleCatalog = {
  catalogVersion: 1,
  updatedAt: "2026-03-06T00:00:00Z",
  agents: {
    director: { version: "2026.3.6", name: "Director", emoji: "🎬", category: "creative", skillCount: 2 },
  },
};

const sampleManifest = {
  id: "director",
  version: "2026.3.6",
  name: "AI Director",
  emoji: "🎬",
  model: "claude-sonnet-4-5",
  category: "creative",
  minOpenClawVersion: "2026.3.1",
  skills: ["web-search", "browser-use"],
  files: ["IDENTITY.md"],
};

vi.mock("../lib/github.js", () => ({
  fetchCatalog: vi.fn().mockResolvedValue(sampleCatalog),
  fetchManifest: vi.fn().mockResolvedValue(sampleManifest),
  fetchAgentFile: vi.fn().mockResolvedValue("# Director Identity"),
}));

vi.mock("../lib/clawhub.js", () => ({
  ensureClawhub: vi.fn(),
  installSkill: vi.fn().mockReturnValue(true),
}));

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-install-test-"));
  const stateDir = path.join(tmpDir, ".openclaw");
  fs.mkdirSync(stateDir);
  configPath = path.join(stateDir, "openclaw.json");
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

const { agentInstall } = await import("./agent-install.js");
const { readConfig } = await import("../lib/config.js");
const { readState } = await import("../lib/state.js");
const { fetchCatalog } = await import("../lib/github.js");
const { installSkill } = await import("../lib/clawhub.js");

describe("agentInstall", () => {
  it("installs agent, writes config, writes files, installs skills", async () => {
    await agentInstall("director", { force: false });

    // Config should have the agent
    const cfg = readConfig();
    expect(cfg.agents?.list).toHaveLength(1);
    expect(cfg.agents?.list?.[0].id).toBe("director");
    expect(cfg.agents?.list?.[0].model).toBe("claude-sonnet-4-5");

    // State should track the install
    const state = readState();
    expect(state.agents.director.version).toBe("2026.3.6");

    // Workspace should exist with the fetched file
    const wsDir = path.join(tmpDir, ".openclaw", "workspace-director");
    expect(fs.existsSync(path.join(wsDir, "IDENTITY.md"))).toBe(true);
    expect(fs.readFileSync(path.join(wsDir, "IDENTITY.md"), "utf-8")).toBe("# Director Identity");

    // Skills should be installed
    expect(installSkill).toHaveBeenCalledTimes(2);
    expect(installSkill).toHaveBeenCalledWith("web-search", wsDir);
    expect(installSkill).toHaveBeenCalledWith("browser-use", wsDir);
  });

  it("exits when agent not found in catalog", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(agentInstall("nonexistent", { force: false })).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("exits when agent exists and no --force", async () => {
    // Pre-populate config with the agent
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(agentInstall("director", { force: false })).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("overwrites when --force is set", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director", name: "Old" }] } }));

    await agentInstall("director", { force: true });

    const cfg = readConfig();
    expect(cfg.agents?.list?.[0].name).toBe("AI Director");
  });

  it("handles skill install failures gracefully", async () => {
    vi.mocked(installSkill)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    await agentInstall("director", { force: false });

    // Should still complete and write config
    const cfg = readConfig();
    expect(cfg.agents?.list).toHaveLength(1);
  });
});
