import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOrUpdateAgent,
  findAgentEntry,
  findAgentIndex,
  readConfig,
  removeAgent,
  writeConfig,
} from "./config.js";

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-config-test-"));
  configPath = path.join(tmpDir, "openclaw.json");
  vi.stubEnv("OPENCLAW_CONFIG_PATH", configPath);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("readConfig", () => {
  it("returns empty object when config does not exist", () => {
    expect(readConfig()).toEqual({});
  });

  it("reads valid JSON config", () => {
    fs.writeFileSync(configPath, JSON.stringify({ agents: { list: [] } }));
    expect(readConfig()).toEqual({ agents: { list: [] } });
  });

  it("handles JSON with single-line comments", () => {
    fs.writeFileSync(
      configPath,
      `{
  // This is a comment
  "agents": { "list": [] }
}`,
    );
    const cfg = readConfig();
    expect(cfg.agents?.list).toEqual([]);
  });

  it("handles JSON with trailing commas", () => {
    fs.writeFileSync(configPath, '{ "agents": { "list": [], }, }');
    const cfg = readConfig();
    expect(cfg.agents?.list).toEqual([]);
  });

  it("handles JSON with block comments", () => {
    fs.writeFileSync(
      configPath,
      `{
  /* block comment */
  "agents": { "list": [] }
}`,
    );
    const cfg = readConfig();
    expect(cfg.agents?.list).toEqual([]);
  });
});

describe("writeConfig", () => {
  it("writes config to file", () => {
    writeConfig({ agents: { list: [{ id: "main" }] } });
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(raw.agents.list[0].id).toBe("main");
  });

  it("output ends with newline", () => {
    writeConfig({});
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content.endsWith("\n")).toBe(true);
  });
});

describe("findAgentEntry", () => {
  it("finds agent by id (case insensitive)", () => {
    const cfg = { agents: { list: [{ id: "Director", name: "AI Director" }] } };
    expect(findAgentEntry(cfg, "director")?.name).toBe("AI Director");
    expect(findAgentEntry(cfg, "DIRECTOR")?.name).toBe("AI Director");
  });

  it("returns undefined for missing agent", () => {
    const cfg = { agents: { list: [{ id: "main" }] } };
    expect(findAgentEntry(cfg, "nonexistent")).toBeUndefined();
  });

  it("handles missing agents.list", () => {
    expect(findAgentEntry({}, "main")).toBeUndefined();
  });
});

describe("findAgentIndex", () => {
  it("returns index of matching agent", () => {
    const cfg = { agents: { list: [{ id: "main" }, { id: "director" }] } };
    expect(findAgentIndex(cfg, "director")).toBe(1);
  });

  it("returns -1 for missing agent", () => {
    const cfg = { agents: { list: [{ id: "main" }] } };
    expect(findAgentIndex(cfg, "nonexistent")).toBe(-1);
  });

  it("returns -1 when list is undefined", () => {
    expect(findAgentIndex({}, "main")).toBe(-1);
  });
});

describe("addOrUpdateAgent", () => {
  it("adds a new agent to empty config", () => {
    const result = addOrUpdateAgent({}, { id: "main", name: "Main Agent" });
    expect(result.agents?.list).toEqual([{ id: "main", name: "Main Agent" }]);
  });

  it("adds a new agent to existing list", () => {
    const cfg = { agents: { list: [{ id: "main" }] } };
    const result = addOrUpdateAgent(cfg, { id: "director", name: "Director" });
    expect(result.agents?.list).toHaveLength(2);
    expect(result.agents?.list?.[1].id).toBe("director");
  });

  it("updates existing agent by merging", () => {
    const cfg = {
      agents: { list: [{ id: "main", name: "Old", model: "gpt-4" }] },
    };
    const result = addOrUpdateAgent(cfg, { id: "main", name: "New" });
    expect(result.agents?.list?.[0].name).toBe("New");
    expect(result.agents?.list?.[0].model).toBe("gpt-4");
  });

  it("preserves other config keys", () => {
    const cfg = { agents: { list: [], defaults: { model: "gpt-4" } }, bindings: [] };
    const result = addOrUpdateAgent(cfg, { id: "main" });
    expect(result.agents?.defaults).toEqual({ model: "gpt-4" });
    expect(result.bindings).toEqual([]);
  });
});

describe("removeAgent", () => {
  it("removes agent from list", () => {
    const cfg = {
      agents: { list: [{ id: "main" }, { id: "director" }] },
    };
    const result = removeAgent(cfg, "main");
    expect(result.agents?.list).toEqual([{ id: "director" }]);
  });

  it("removes associated bindings", () => {
    const cfg = {
      agents: { list: [{ id: "main" }] },
      bindings: [{ agentId: "main", channel: "telegram" }, { agentId: "director", channel: "slack" }],
    };
    const result = removeAgent(cfg, "main");
    expect(result.bindings).toEqual([{ agentId: "director", channel: "slack" }]);
  });

  it("removes from agentToAgent allow list", () => {
    const cfg = {
      agents: { list: [{ id: "main" }] },
      tools: { agentToAgent: { allow: ["main", "director"] } },
    };
    const result = removeAgent(cfg, "main");
    expect(result.tools?.agentToAgent?.allow).toEqual(["director"]);
  });

  it("sets list to undefined when last agent removed", () => {
    const cfg = { agents: { list: [{ id: "main" }] } };
    const result = removeAgent(cfg, "main");
    expect(result.agents?.list).toBeUndefined();
  });

  it("sets bindings to undefined when all removed", () => {
    const cfg = {
      agents: { list: [{ id: "main" }] },
      bindings: [{ agentId: "main", channel: "tg" }],
    };
    const result = removeAgent(cfg, "main");
    expect(result.bindings).toBeUndefined();
  });

  it("handles case-insensitive removal", () => {
    const cfg = { agents: { list: [{ id: "Director" }] } };
    const result = removeAgent(cfg, "director");
    expect(result.agents?.list).toBeUndefined();
  });
});
