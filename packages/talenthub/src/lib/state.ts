import fs from "node:fs";
import { resolveTalentHubStatePath } from "./paths.js";

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
