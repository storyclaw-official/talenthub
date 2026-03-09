import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAgentFile, fetchCatalog, fetchManifest } from "./github.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CATALOG_URL =
  "https://raw.githubusercontent.com/storyclaw-official/agents/main/catalog.json";

const MANIFEST_URL = (id: string) =>
  `https://raw.githubusercontent.com/storyclaw-official/agents/main/agents/${id}/manifest.json`;

const FILE_URL = (id: string, file: string) =>
  `https://raw.githubusercontent.com/storyclaw-official/agents/main/agents/${id}/${file}`;

const sampleCatalog = {
  catalogVersion: 1,
  updatedAt: "2026-03-06T00:00:00Z",
  agents: {
    main: { version: "2026.3.6", name: "Main", emoji: "🤖", category: "general", skillCount: 5 },
  },
};

const sampleManifest = {
  id: "main",
  version: "2026.3.6",
  name: "Main Agent",
  emoji: "🤖",
  model: "claude-sonnet-4-5",
  category: "general",
  minOpenClawVersion: "2026.3.1",
  skills: ["web-search"],
  files: ["IDENTITY.md"],
};

describe("fetchCatalog", () => {
  it("returns parsed catalog on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleCatalog),
    });
    const result = await fetchCatalog();
    expect(result).toEqual(sampleCatalog);
    expect(mockFetch).toHaveBeenCalledWith(CATALOG_URL);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    await expect(fetchCatalog()).rejects.toThrow("Failed to fetch catalog: 404 Not Found");
  });
});

describe("fetchManifest", () => {
  it("returns parsed manifest on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleManifest),
    });
    const result = await fetchManifest("main");
    expect(result).toEqual(sampleManifest);
    expect(mockFetch).toHaveBeenCalledWith(MANIFEST_URL("main"));
  });

  it("throws descriptive error for missing agent", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    await expect(fetchManifest("unknown")).rejects.toThrow(
      'Agent "unknown" not found in registry (404)',
    );
  });
});

describe("fetchAgentFile", () => {
  it("returns file text on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# Identity\nI am main."),
    });
    const result = await fetchAgentFile("main", "IDENTITY.md");
    expect(result).toBe("# Identity\nI am main.");
    expect(mockFetch).toHaveBeenCalledWith(FILE_URL("main", "IDENTITY.md"));
  });

  it("throws on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });
    await expect(fetchAgentFile("main", "SOUL.md")).rejects.toThrow(
      'Failed to fetch SOUL.md for agent "main" (500)',
    );
  });
});
