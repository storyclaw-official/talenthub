import fs from "node:fs";
import { resolveConfigPath } from "./paths.js";

export type AgentEntry = {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: string;
  skills?: string[];
  [key: string]: unknown;
};

export type OpenClawConfig = {
  agents?: {
    list?: AgentEntry[];
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
  const id = agentId.toLowerCase();
  return cfg.agents?.list?.find((e) => e.id?.toLowerCase() === id);
}

export function findAgentIndex(cfg: OpenClawConfig, agentId: string): number {
  const id = agentId.toLowerCase();
  return cfg.agents?.list?.findIndex((e) => e.id?.toLowerCase() === id) ?? -1;
}

export function addOrUpdateAgent(
  cfg: OpenClawConfig,
  entry: AgentEntry,
): OpenClawConfig {
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

export function removeAgent(cfg: OpenClawConfig, agentId: string): OpenClawConfig {
  const id = agentId.toLowerCase();
  const list = (cfg.agents?.list ?? []).filter((e) => e.id?.toLowerCase() !== id);
  const bindings = (cfg.bindings ?? []).filter((b) => b.agentId?.toLowerCase() !== id);
  const allow = (cfg.tools?.agentToAgent?.allow ?? []).filter((a) => a.toLowerCase() !== id);

  return {
    ...cfg,
    agents: { ...cfg.agents, list: list.length > 0 ? list : undefined },
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
