import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sampleCatalog = {
  catalogVersion: 1,
  updatedAt: "2026-03-06T00:00:00Z",
  agents: {
    main: { version: "2026.3.6", name: "Main Agent", emoji: "🤖", category: "general", skillCount: 5 },
    director: { version: "2026.3.6", name: "AI Director", emoji: "🎬", category: "creative", skillCount: 24 },
    trader: { version: "2026.3.6", name: "AI Trader", emoji: "📈", category: "finance", skillCount: 10 },
  },
};

vi.mock("../lib/update-check.js", () => ({
  getCatalogCached: vi.fn().mockResolvedValue(sampleCatalog),
}));

let tmpDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-search-test-"));
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

const { agentSearch } = await import("./agent-search.js");

describe("agentSearch", () => {
  it("lists all agents when no query", async () => {
    await agentSearch();
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("main");
    expect(output).toContain("director");
    expect(output).toContain("trader");
    expect(output).toContain("3 agent(s) found");
  });

  it("filters by agent id", async () => {
    await agentSearch("director");
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("director");
    expect(output).not.toContain("trader");
    expect(output).toContain("1 agent(s) found");
  });

  it("filters by name", async () => {
    await agentSearch("AI Trader");
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("trader");
    expect(output).toContain("1 agent(s) found");
  });

  it("filters by category", async () => {
    await agentSearch("finance");
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("trader");
    expect(output).toContain("1 agent(s) found");
  });

  it("shows no results message for unmatched query", async () => {
    await agentSearch("nonexistent");
    expect(logSpy).toHaveBeenCalledWith('No agents matching "nonexistent".');
  });

  it("marks installed agents with checkmark", async () => {
    const statePath = path.join(tmpDir, ".openclaw", "talenthub.json");
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        agents: {
          main: { version: "2026.3.6", installedAt: "2026-03-01T00:00:00Z" },
        },
      }),
    );

    await agentSearch();
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    // The row for "main" should contain ✓
    const mainLine = logSpy.mock.calls.find((c) => typeof c[0] === "string" && c[0].includes("main") && c[0].includes("Main Agent"));
    expect(mainLine?.[0]).toContain("✓");
  });
});
