import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;
let configPath: string;
let statePath: string;

function setupAgent(agentId: string) {
  const stateDir = path.join(tmpDir, ".openclaw");
  // Write config with agent
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      agents: { list: [{ id: agentId, name: "Test Agent" }] },
      bindings: [{ agentId, channel: "telegram" }],
    }),
  );
  // Write state
  fs.writeFileSync(
    statePath,
    JSON.stringify({
      agents: { [agentId]: { version: "1.0.0", installedAt: "2026-01-01T00:00:00Z" } },
    }),
  );
  // Create workspace
  const wsDir = path.join(stateDir, `workspace-${agentId}`);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, "IDENTITY.md"), "test");
  return wsDir;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-uninstall-test-"));
  const stateDir = path.join(tmpDir, ".openclaw");
  fs.mkdirSync(stateDir);
  configPath = path.join(stateDir, "openclaw.json");
  statePath = path.join(stateDir, "talenthub.json");
  fs.writeFileSync(configPath, "{}");
  fs.writeFileSync(statePath, JSON.stringify({ agents: {} }));

  vi.stubEnv("OPENCLAW_HOME", tmpDir);
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
  vi.stubEnv("OPENCLAW_CONFIG_PATH", configPath);
  vi.stubEnv("OPENCLAW_WORKSPACE", "");

  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const { agentUninstall } = await import("./agent-uninstall.js");
const { readConfig } = await import("../lib/config.js");
const { readState } = await import("../lib/state.js");

describe("agentUninstall", () => {
  it("exits when agent is not installed", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(agentUninstall("nonexistent", { yes: true })).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("removes agent with --yes, archives workspace, cleans config", async () => {
    const wsDir = setupAgent("director");

    await agentUninstall("director", { yes: true });

    // Workspace should be archived
    expect(fs.existsSync(wsDir)).toBe(false);
    expect(fs.existsSync(`${wsDir}.bak`)).toBe(true);
    expect(fs.readFileSync(path.join(`${wsDir}.bak`, "IDENTITY.md"), "utf-8")).toBe("test");

    // Config should be cleaned
    const cfg = readConfig();
    expect(cfg.agents?.list).toBeUndefined();
    expect(cfg.bindings).toBeUndefined();

    // State should be cleaned
    const state = readState();
    expect(state.agents.director).toBeUndefined();
  });

  it("replaces existing .bak directory", async () => {
    const wsDir = setupAgent("director");
    const bakDir = `${wsDir}.bak`;
    fs.mkdirSync(bakDir, { recursive: true });
    fs.writeFileSync(path.join(bakDir, "old-file.txt"), "old");

    await agentUninstall("director", { yes: true });

    expect(fs.existsSync(path.join(bakDir, "old-file.txt"))).toBe(false);
    expect(fs.existsSync(path.join(bakDir, "IDENTITY.md"))).toBe(true);
  });

  it("handles missing workspace gracefully", async () => {
    // Set up agent in state/config but no workspace dir
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { director: { version: "1.0.0", installedAt: "2026-01-01T00:00:00Z" } },
      }),
    );
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [{ id: "director" }] } }));

    await agentUninstall("director", { yes: true });

    const state = readState();
    expect(state.agents.director).toBeUndefined();
  });
});
