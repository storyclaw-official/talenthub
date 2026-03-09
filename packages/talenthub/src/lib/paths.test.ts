import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveConfigPath,
  resolveStateDir,
  resolveTalentHubStatePath,
  resolveWorkspaceDir,
} from "./paths.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-test-"));
  vi.stubEnv("OPENCLAW_HOME", tmpDir);
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
  vi.stubEnv("OPENCLAW_CONFIG_PATH", "");
  vi.stubEnv("OPENCLAW_WORKSPACE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveStateDir", () => {
  it("returns .openclaw under home when it exists", () => {
    const dir = path.join(tmpDir, ".openclaw");
    fs.mkdirSync(dir);
    expect(resolveStateDir()).toBe(dir);
  });

  it("falls back to .clawdbot when .openclaw does not exist", () => {
    const legacy = path.join(tmpDir, ".clawdbot");
    fs.mkdirSync(legacy);
    expect(resolveStateDir()).toBe(legacy);
  });

  it("defaults to .openclaw when neither exists", () => {
    expect(resolveStateDir()).toBe(path.join(tmpDir, ".openclaw"));
  });

  it("uses OPENCLAW_STATE_DIR override", () => {
    const custom = path.join(tmpDir, "custom-state");
    vi.stubEnv("OPENCLAW_STATE_DIR", custom);
    expect(resolveStateDir()).toBe(custom);
  });

  it("expands ~ in OPENCLAW_STATE_DIR", () => {
    vi.stubEnv("OPENCLAW_STATE_DIR", "~/my-state");
    expect(resolveStateDir()).toBe(path.join(tmpDir, "my-state"));
  });
});

describe("resolveConfigPath", () => {
  it("returns openclaw.json when it exists", () => {
    const stateDir = path.join(tmpDir, ".openclaw");
    fs.mkdirSync(stateDir);
    const configPath = path.join(stateDir, "openclaw.json");
    fs.writeFileSync(configPath, "{}");
    expect(resolveConfigPath()).toBe(configPath);
  });

  it("falls back to clawdbot.json", () => {
    const stateDir = path.join(tmpDir, ".openclaw");
    fs.mkdirSync(stateDir);
    const configPath = path.join(stateDir, "clawdbot.json");
    fs.writeFileSync(configPath, "{}");
    expect(resolveConfigPath()).toBe(configPath);
  });

  it("defaults to openclaw.json when no config exists", () => {
    expect(resolveConfigPath()).toBe(
      path.join(tmpDir, ".openclaw", "openclaw.json"),
    );
  });

  it("uses OPENCLAW_CONFIG_PATH override", () => {
    const custom = path.join(tmpDir, "my-config.json");
    vi.stubEnv("OPENCLAW_CONFIG_PATH", custom);
    expect(resolveConfigPath()).toBe(custom);
  });
});

describe("resolveWorkspaceDir", () => {
  it("returns workspace for main agent", () => {
    const stateDir = path.join(tmpDir, ".openclaw");
    fs.mkdirSync(stateDir);
    expect(resolveWorkspaceDir("main")).toBe(path.join(stateDir, "workspace"));
  });

  it("uses OPENCLAW_WORKSPACE for main agent", () => {
    const custom = path.join(tmpDir, "my-ws");
    vi.stubEnv("OPENCLAW_WORKSPACE", custom);
    expect(resolveWorkspaceDir("main")).toBe(custom);
  });

  it("returns workspace-{id} for non-main agents", () => {
    const stateDir = path.join(tmpDir, ".openclaw");
    fs.mkdirSync(stateDir);
    expect(resolveWorkspaceDir("director")).toBe(
      path.join(stateDir, "workspace-director"),
    );
  });
});

describe("resolveTalentHubStatePath", () => {
  it("returns talenthub.json inside state dir", () => {
    expect(resolveTalentHubStatePath()).toBe(
      path.join(tmpDir, ".openclaw", "talenthub.json"),
    );
  });
});
