import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markInstalled, markUninstalled, readState, writeState } from "./state.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-state-test-"));
  const stateDir = path.join(tmpDir, ".openclaw");
  fs.mkdirSync(stateDir);
  vi.stubEnv("OPENCLAW_HOME", tmpDir);
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("readState", () => {
  it("returns empty state when file does not exist", () => {
    const state = readState();
    expect(state).toEqual({ agents: {} });
  });

  it("reads existing state file", () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: { main: { version: "1.0.0", installedAt: "2026-01-01T00:00:00Z" } },
      }),
    );
    const state = readState();
    expect(state.agents.main.version).toBe("1.0.0");
  });

  it("returns empty state for corrupted file", () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(statePath, "not json{{{");
    const state = readState();
    expect(state).toEqual({ agents: {} });
  });
});

describe("writeState", () => {
  it("writes state to file", () => {
    writeState({
      agents: { director: { version: "2.0.0", installedAt: "2026-03-01T00:00:00Z" } },
    });
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    const raw = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    expect(raw.agents.director.version).toBe("2.0.0");
  });
});

describe("markInstalled", () => {
  it("adds a new agent entry", () => {
    markInstalled("trader", "1.0.0");
    const state = readState();
    expect(state.agents.trader.version).toBe("1.0.0");
    expect(state.agents.trader.installedAt).toBeTruthy();
  });

  it("updates an existing agent entry", () => {
    markInstalled("trader", "1.0.0");
    markInstalled("trader", "2.0.0");
    const state = readState();
    expect(state.agents.trader.version).toBe("2.0.0");
  });
});

describe("markUninstalled", () => {
  it("removes an agent entry", () => {
    markInstalled("trader", "1.0.0");
    markUninstalled("trader");
    const state = readState();
    expect(state.agents.trader).toBeUndefined();
  });

  it("is a no-op for non-existent agent", () => {
    markUninstalled("nonexistent");
    const state = readState();
    expect(state.agents).toEqual({});
  });
});
