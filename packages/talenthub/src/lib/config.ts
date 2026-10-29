import fs from "node:fs";
import { deleteAgentWithOpenClaw, registerAgentWithOpenClaw } from "./openclaw-cli.js";
import { resolveConfigPath, resolveWorkspaceDir } from "./paths.js";

export type AgentEntry = {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: string;
  skills?: string[];
  [key: string]: unknown;
};

/** A keyed roster entry (openclaw >= 2026.7.2): the id is the key, not a field. */
export type KeyedAgentEntry = Omit<AgentEntry, "id">;

export type OpenClawConfig = {
  meta?: { lastTouchedVersion?: string; [key: string]: unknown };
  agents?: {
    list?: AgentEntry[];
    entries?: Record<string, KeyedAgentEntry>;
    defaults?: Record<string, unknown>;
    [key: string]: unknown;
  };
  bindings?: Array<{ agentId: string; [key: string]: unknown }>;
  tools?: {
    agentToAgent?: { allow?: string[]; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** First openclaw release with the keyed roster; it rejects any config that still has agents.list. */
const KEYED_ROSTER_SINCE = [2026, 7, 2];

function parseVersion(version: string | undefined): number[] | null {
  const match = version?.match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

/**
 * openclaw 2026.7.2 replaced `agents.list` with keyed `agents.entries` and
 * treats a leftover `agents.list` as an invalid config (no reload, no writes).
 * The roster is keyed when `agents.entries` exists or when the config was last
 * written by such a version.
 */
export function usesKeyedRoster(cfg: OpenClawConfig): boolean {
  const entries = cfg.agents?.entries;
  if (entries && typeof entries === "object" && !Array.isArray(entries)) return true;
  const version = parseVersion(cfg.meta?.lastTouchedVersion);
  if (!version) return false;
  for (let i = 0; i < KEYED_ROSTER_SINCE.length; i++) {
    if (version[i] !== KEYED_ROSTER_SINCE[i]) return version[i] > KEYED_ROSTER_SINCE[i];
  }
  return true;
}

function findEntryKey(cfg: OpenClawConfig, agentId: string): string | undefined {
  const id = agentId.toLowerCase();
  return Object.keys(cfg.agents?.entries ?? {}).find((key) => key.toLowerCase() === id);
}

/**
 * Whether adding this agent has to go through openclaw (`openclaw agents add`):
 * on a keyed roster a new agent also needs its agent dir, auth and, for the
 * first extra agent, the fleet ownership fields that only openclaw writes.
 * The implicit "main" agent can be written directly.
 */
export function needsOpenClawRegistration(cfg: OpenClawConfig, agentId: string): boolean {
  return (
    usesKeyedRoster(cfg) &&
    agentId.toLowerCase() !== "main" &&
    findEntryKey(cfg, agentId) === undefined
  );
}

export function readConfig(): OpenClawConfig {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) return {};
  const raw = fs.readFileSync(configPath, "utf-8");
  // JSON5-like: strip comments, trailing commas (basic approach)
  try {
    return JSON.parse(raw);
  } catch {
    // Try stripping single-line comments and trailing commas
    const cleaned = raw
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(cleaned);
  }
}

export function writeConfig(cfg: OpenClawConfig): void {
  const configPath = resolveConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
}

export function findAgentEntry(cfg: OpenClawConfig, agentId: string): AgentEntry | undefined {
  if (usesKeyedRoster(cfg)) {
    const key = findEntryKey(cfg, agentId);
    return key === undefined ? undefined : { ...cfg.agents?.entries?.[key], id: key };
  }
  const id = agentId.toLowerCase();
  return cfg.agents?.list?.find((e) => e.id?.toLowerCase() === id);
}

export function findAgentIndex(cfg: OpenClawConfig, agentId: string): number {
  const id = agentId.toLowerCase();
  return cfg.agents?.list?.findIndex((e) => e.id?.toLowerCase() === id) ?? -1;
}

/** Without `agents.list`: openclaw drops it once `agents.entries` exists, and a config that still has it is invalid. */
function withoutList(agents: NonNullable<OpenClawConfig["agents"]>): NonNullable<OpenClawConfig["agents"]> {
  const { list: _list, ...rest } = agents;
  return rest;
}

export function addOrUpdateAgent(
  cfg: OpenClawConfig,
  entry: AgentEntry,
): OpenClawConfig {
  if (usesKeyedRoster(cfg)) {
    if (needsOpenClawRegistration(cfg, entry.id)) {
      throw new Error(`Agent "${entry.id}" must be registered with "openclaw agents add" first.`);
    }
    const { id, ...fields } = entry;
    const key = findEntryKey(cfg, id) ?? id;
    const entries = { ...cfg.agents?.entries, [key]: { ...cfg.agents?.entries?.[key], ...fields } };
    return { ...cfg, agents: { ...withoutList(cfg.agents ?? {}), entries } };
  }
  const existingList = cfg.agents?.list ?? [];
  const list = [...existingList];
  const idx = findAgentIndex(cfg, entry.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
  } else {
    // When there was no agents.list (implicit "main" agent from defaults)
    // and we're adding a non-main agent, prepend a "main" placeholder so
    // the gateway still sees the original default agent.
    if (
      existingList.length === 0 &&
      entry.id.toLowerCase() !== "main" &&
      cfg.agents?.defaults
    ) {
      list.unshift({ id: "main", default: true } as AgentEntry);
    }
    list.push(entry);
  }
  return { ...cfg, agents: { ...cfg.agents, list } };
}

/** Write an agent's roster entry, registering it with openclaw first when the roster requires that. */
export function saveAgent(entry: AgentEntry): void {
  let cfg = readConfig();
  if (needsOpenClawRegistration(cfg, entry.id)) {
    registerAgentWithOpenClaw(entry.id, entry.workspace ?? resolveWorkspaceDir(entry.id));
    cfg = readConfig();
  }
  writeConfig(addOrUpdateAgent(cfg, entry));
}

/**
 * Drop an agent and its bindings. On a keyed roster the entry itself is
 * removed by openclaw (`openclaw agents delete`), which also prunes the
 * agent's state; a direct edit cannot remove roster entries.
 */
export function deleteAgent(agentId: string): { removedBindings: number } {
  const before = readConfig();
  if (usesKeyedRoster(before) && findEntryKey(before, agentId) !== undefined) {
    deleteAgentWithOpenClaw(agentId);
  }
  const cfg = readConfig();
  const updated = removeAgent(cfg, agentId);
  writeConfig(updated);
  return { removedBindings: (cfg.bindings?.length ?? 0) - (updated.bindings?.length ?? 0) };
}

export function removeAgent(cfg: OpenClawConfig, agentId: string): OpenClawConfig {
  const id = agentId.toLowerCase();
  const list = (cfg.agents?.list ?? []).filter((e) => e.id?.toLowerCase() !== id);
  const bindings = (cfg.bindings ?? []).filter((b) => b.agentId?.toLowerCase() !== id);
  const allow = (cfg.tools?.agentToAgent?.allow ?? []).filter((a) => a.toLowerCase() !== id);

  return {
    ...cfg,
    agents: usesKeyedRoster(cfg)
      ? withoutList(cfg.agents ?? {})
      : { ...cfg.agents, list: list.length > 0 ? list : undefined },
    bindings: bindings.length > 0 ? bindings : undefined,
    tools: cfg.tools
      ? {
          ...cfg.tools,
          agentToAgent: cfg.tools.agentToAgent
            ? { ...cfg.tools.agentToAgent, allow: allow.length > 0 ? allow : undefined }
            : undefined,
        }
      : undefined,
  };
}
