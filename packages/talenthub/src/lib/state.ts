import fs from "node:fs";
import { resolveTalentHubStatePath, resolveWorkspaceDir } from "./paths.js";

export type AgentManifestSnapshot = {
  id: string;
  name: string;
  emoji?: string;
  category?: string;
  role?: string;
  tagline?: string;
  description?: string;
  skills: string[];
  avatarUrl?: string | null;
  minOpenClawVersion?: string;
  i18n?: Record<string, unknown>;
};

export type InstalledAgent = {
  version: string;
  installedAt: string;
  manifest?: AgentManifestSnapshot;
};

export type TalentHubState = {
  agents: Record<string, InstalledAgent>;
  lastUpdateCheck?: string;
};

export function readState(): TalentHubState {
  const statePath = resolveTalentHubStatePath();
  if (!fs.existsSync(statePath)) {
    return { agents: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    return { agents: {} };
  }
}

export function writeState(state: TalentHubState): void {
  const statePath = resolveTalentHubStatePath();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export function toManifestSnapshot(manifest: {
  id: string;
  name: string;
  emoji?: string;
  category?: string;
  role?: string;
  tagline?: string;
  description?: string;
  skills: string[];
  avatarUrl?: string | null;
  minOpenClawVersion?: string;
  i18n?: Record<string, unknown>;
}): AgentManifestSnapshot {
  return {
    id: manifest.id,
    name: manifest.name,
    emoji: manifest.emoji || undefined,
    category: manifest.category || undefined,
    role: manifest.role || undefined,
    tagline: manifest.tagline || undefined,
    description: manifest.description || undefined,
    skills: manifest.skills,
    avatarUrl: manifest.avatarUrl ?? undefined,
    minOpenClawVersion: manifest.minOpenClawVersion || undefined,
    i18n: manifest.i18n,
  };
}

export function markInstalled(agentId: string, version: string, manifest?: AgentManifestSnapshot): void {
  const state = readState();
  state.agents[agentId] = {
    version,
    installedAt: new Date().toISOString(),
    ...(manifest ? { manifest } : {}),
  };
  writeState(state);
}

export function markUninstalled(agentId: string): void {
  const state = readState();
  delete state.agents[agentId];
  writeState(state);
}

/**
 * Look up an agent in talenthub state, falling back to its on-disk workspace.
 *
 * For the openclaw runtime default `main` agent (and any agent whose
 * workspace was provisioned outside talenthub), `state.agents[agentId]` is
 * absent even though the workspace directory exists. In that case we
 * bootstrap a minimal state entry so subsequent skill add/remove operations
 * can record their work.
 *
 * Returns `null` only when both state and workspace are absent.
 */
export function findAgent(
  agentId: string,
): { state: TalentHubState; agent: InstalledAgent } | null {
  const state = readState();
  const existing = state.agents[agentId];
  if (existing) return { state, agent: existing };

  const wsDir = resolveWorkspaceDir(agentId);
  if (!fs.existsSync(wsDir)) return null;

  // "0.0.0" is a deliberate pre-everything sentinel so checkUpdates() always
  // sees the bootstrapped agent as outdated relative to the catalog version.
  // The user gets prompted to pull the canonical main agent from the catalog,
  // and the first real `agent update` overwrites this with a proper version.
  const bootstrapped: InstalledAgent = {
    version: "0.0.0",
    installedAt: new Date().toISOString(),
  };
  state.agents[agentId] = bootstrapped;
  writeState(state);
  return { state, agent: bootstrapped };
}
