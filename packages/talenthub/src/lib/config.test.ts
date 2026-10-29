import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOrUpdateAgent,
  deleteAgent,
  findAgentEntry,
  findAgentIndex,
  needsOpenClawRegistration,
  readConfig,
  removeAgent,
  saveAgent,
  usesKeyedRoster,
  writeConfig,
} from "./config.js";
import { deleteAgentWithOpenClaw, registerAgentWithOpenClaw } from "./openclaw-cli.js";

vi.mock("./openclaw-cli.js", () => ({
  registerAgentWithOpenClaw: vi.fn(),
  deleteAgentWithOpenClaw: vi.fn(),
}));

let tmpDir: string;
let configPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-config-test-"));
  configPath = path.join(tmpDir, "openclaw.json");
  vi.stubEnv("OPENCLAW_CONFIG_PATH", configPath);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(registerAgentWithOpenClaw).mockReset();
  vi.mocked(deleteAgentWithOpenClaw).mockReset();
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

// openclaw >= 2026.7.2 keys the roster by id under agents.entries and treats
// a leftover agents.list as an invalid config.
const keyedFleet = () => ({
  meta: { lastTouchedVersion: "2026.10.2-2" },
  agents: {
    ownership: "explicit",
    entries: {
      main: { workspace: "/ws/main", skills: ["pdf"] },
      "qingshan-ai-drama-factory-minipc": { name: "Qingshan", workspace: "/ws/qs", skills: ["nalu"] },
    },
  },
});

describe("usesKeyedRoster", () => {
  it("is keyed when agents.entries exists", () => {
    expect(usesKeyedRoster({ agents: { entries: {} } })).toBe(true);
  });

  it("is keyed when the config was last written by openclaw 2026.7.2 or later", () => {
    expect(usesKeyedRoster({ meta: { lastTouchedVersion: "2026.7.2-beta.4" } })).toBe(true);
    expect(usesKeyedRoster({ meta: { lastTouchedVersion: "2026.10.2-2" } })).toBe(true);
  });

  it("is the legacy list for older or unknown versions", () => {
    expect(usesKeyedRoster({ meta: { lastTouchedVersion: "2026.7.1-2" } })).toBe(false);
    expect(usesKeyedRoster({ meta: { lastTouchedVersion: "2026.6.11-8" }, agents: { list: [] } })).toBe(false);
    expect(usesKeyedRoster({})).toBe(false);
  });
});

describe("keyed roster", () => {
  it("finds an entry by its key", () => {
    expect(findAgentEntry(keyedFleet(), "Qingshan-AI-Drama-Factory-Minipc")).toEqual({
      id: "qingshan-ai-drama-factory-minipc",
      name: "Qingshan",
      workspace: "/ws/qs",
      skills: ["nalu"],
    });
    expect(findAgentEntry(keyedFleet(), "missing")).toBeUndefined();
  });

  it("updates an existing entry in place and never writes agents.list", () => {
    const result = addOrUpdateAgent(keyedFleet(), {
      id: "qingshan-ai-drama-factory-minipc",
      workspace: "/ws/qs",
      skills: ["nalu", "storyclaw-workspace-reporter"],
    });
    expect(result.agents?.list).toBeUndefined();
    expect(result.agents?.ownership).toBe("explicit");
    expect(result.agents?.entries?.["qingshan-ai-drama-factory-minipc"]).toEqual({
      name: "Qingshan",
      workspace: "/ws/qs",
      skills: ["nalu", "storyclaw-workspace-reporter"],
    });
    expect(result.agents?.entries?.main).toEqual({ workspace: "/ws/main", skills: ["pdf"] });
  });

  it("drops a stale agents.list left by an older talenthub", () => {
    const cfg = { ...keyedFleet(), agents: { ...keyedFleet().agents, list: [{ id: "main", default: true }] } };
    const result = addOrUpdateAgent(cfg, { id: "main", skills: ["pdf", "docx"] });
    expect(result.agents).not.toHaveProperty("list");
    expect(result.agents?.entries?.main?.skills).toEqual(["pdf", "docx"]);
  });

  it("writes the implicit main agent directly", () => {
    const cfg = { meta: { lastTouchedVersion: "2026.10.2-2" } };
    expect(needsOpenClawRegistration(cfg, "main")).toBe(false);
    expect(addOrUpdateAgent(cfg, { id: "main", skills: ["pdf"] }).agents).toEqual({
      entries: { main: { skills: ["pdf"] } },
    });
  });

  it("refuses to add a new agent without openclaw", () => {
    expect(needsOpenClawRegistration(keyedFleet(), "director")).toBe(true);
    expect(() => addOrUpdateAgent(keyedFleet(), { id: "director" })).toThrow(/openclaw agents add/);
  });

  it("keeps entries when removing bindings", () => {
    const cfg = { ...keyedFleet(), bindings: [{ agentId: "qingshan-ai-drama-factory-minipc", channel: "tg" }] };
    const result = removeAgent(cfg, "qingshan-ai-drama-factory-minipc");
    expect(result.agents).not.toHaveProperty("list");
    expect(result.bindings).toBeUndefined();
  });
});

describe("saveAgent", () => {
  it("registers a new agent with openclaw before writing its entry", () => {
    writeConfig(keyedFleet());
    vi.mocked(registerAgentWithOpenClaw).mockImplementation((id, workspace) => {
      const cfg = readConfig();
      cfg.agents!.entries![id] = { name: id, workspace, agentDir: `/agents/${id}` };
      writeConfig(cfg);
    });
    saveAgent({ id: "director", name: "AI Director", workspace: "/ws/director", skills: ["films-search"] });
    expect(registerAgentWithOpenClaw).toHaveBeenCalledWith("director", "/ws/director");
    expect(readConfig().agents?.entries?.director).toEqual({
      name: "AI Director",
      workspace: "/ws/director",
      agentDir: "/agents/director",
      skills: ["films-search"],
    });
  });

  it("updates an existing agent without openclaw", () => {
    writeConfig(keyedFleet());
    saveAgent({ id: "qingshan-ai-drama-factory-minipc", workspace: "/ws/qs", skills: ["nalu", "reporter"] });
    expect(registerAgentWithOpenClaw).not.toHaveBeenCalled();
    const cfg = readConfig();
    expect(cfg.agents).not.toHaveProperty("list");
    expect(cfg.agents?.entries?.["qingshan-ai-drama-factory-minipc"]?.skills).toEqual(["nalu", "reporter"]);
  });

  it("keeps writing agents.list on older openclaw", () => {
    writeConfig({ meta: { lastTouchedVersion: "2026.6.11-8" }, agents: { defaults: {}, list: [] } });
    saveAgent({ id: "director", workspace: "/ws/director" });
    expect(registerAgentWithOpenClaw).not.toHaveBeenCalled();
    expect(readConfig().agents?.list?.map((e) => e.id)).toEqual(["main", "director"]);
  });
});

describe("deleteAgent", () => {
  it("removes a keyed entry through openclaw", () => {
    writeConfig(keyedFleet());
    vi.mocked(deleteAgentWithOpenClaw).mockImplementation((id) => {
      const cfg = readConfig();
      delete cfg.agents!.entries![id];
      writeConfig(cfg);
    });
    deleteAgent("qingshan-ai-drama-factory-minipc");
    expect(deleteAgentWithOpenClaw).toHaveBeenCalledWith("qingshan-ai-drama-factory-minipc");
    expect(Object.keys(readConfig().agents?.entries ?? {})).toEqual(["main"]);
  });

  it("edits agents.list directly on older openclaw", () => {
    writeConfig({ agents: { list: [{ id: "main" }, { id: "director" }] } });
    deleteAgent("director");
    expect(deleteAgentWithOpenClaw).not.toHaveBeenCalled();
    expect(readConfig().agents?.list).toEqual([{ id: "main" }]);
  });
});
