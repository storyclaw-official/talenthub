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

vi.mock("../lib/update-check.js", () => ({
  getCatalogCached: vi.fn().mockResolvedValue(sampleCatalog),
}));

let tmpDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-list-test-"));
  const stateDir = path.join(tmpDir, ".openclaw");
  fs.mkdirSync(stateDir);
  vi.stubEnv("OPENCLAW_HOME", tmpDir);
  vi.stubEnv("OPENCLAW_STATE_DIR", "");
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const { agentList } = await import("./agent-list.js");

describe("agentList", () => {
  it("shows message when no agents installed", async () => {
    await agentList();
    expect(logSpy).toHaveBeenCalledWith("No agents installed via talenthub.");
  });

  it("shows installed agents with update status", async () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: {
          main: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" },
          director: { version: "2026.3.5", installedAt: "2026-03-01T00:00:00Z" },
        },
      }),
    );

    await agentList();

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("main");
    expect(output).toContain("Up to date");
    expect(output).toContain("director");
    expect(output).toContain("Update available");
  });

  it("handles catalog fetch failure gracefully", async () => {
    const { getCatalogCached } = await import("../lib/update-check.js");
    vi.mocked(getCatalogCached).mockRejectedValueOnce(new Error("network"));

    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: {
          main: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" },
        },
      }),
    );

    await agentList();

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("main");
    expect(output).toContain("Not in registry");
  });
});
