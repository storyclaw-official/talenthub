import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sampleCatalog = {
  catalogVersion: 1,
  updatedAt: "2026-03-06T00:00:00Z",
  agents: {
    main: { version: "2026.3.6", name: "Main", emoji: "🤖", category: "general", skillCount: 5 },
    director: { version: "2026.3.7", name: "Director", emoji: "🎬", category: "creative", skillCount: 24 },
  },
};

vi.mock("./github.js", () => ({
  fetchCatalog: vi.fn().mockResolvedValue(sampleCatalog),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-uc-test-"));
  const stateDir = path.join(tmpDir, ".openclaw");
  fs.mkdirSync(stateDir);
  vi.stubEnv("OPENCLAW_HOME", tmpDir);
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Import after mocks
const { checkUpdates, getCatalogCached } = await import("./update-check.js");
const { readState } = await import("./state.js");

describe("getCatalogCached", () => {
  it("fetches catalog and updates lastUpdateCheck", async () => {
    const catalog = await getCatalogCached();
    expect(catalog).toEqual(sampleCatalog);
    const state = readState();
    expect(state.lastUpdateCheck).toBeTruthy();
  });
});

describe("checkUpdates", () => {
  it("returns empty when no agents installed", async () => {
    const updates = await checkUpdates();
    expect(updates).toEqual([]);
  });

  it("detects available updates", async () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: {
          main: { version: "2026.3.5", installedAt: "2026-03-01T00:00:00Z" },
          director: { version: "2026.3.7", installedAt: "2026-03-01T00:00:00Z" },
        },
      }),
    );

    const updates = await checkUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].agentId).toBe("main");
    expect(updates[0].currentVersion).toBe("2026.3.5");
    expect(updates[0].latestVersion).toBe("2026.3.6");
  });

  it("returns empty when all up to date", async () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: {
          main: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" },
        },
      }),
    );
    const updates = await checkUpdates();
    expect(updates).toEqual([]);
  });

  it("skips agents not in the catalog", async () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: {
          custom: { version: "1.0.0", installedAt: "2026-03-01T00:00:00Z" },
        },
      }),
    );
    const updates = await checkUpdates();
    expect(updates).toEqual([]);
  });
});
