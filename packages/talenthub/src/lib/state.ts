import fs from "node:fs";
import { resolveTalentHubStatePath } from "./paths.js";

export type InstalledAgent = {
  version: string;
  installedAt: string;
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

export function markInstalled(agentId: string, version: string): void {
  const state = readState();
  state.agents[agentId] = {
    version,
    installedAt: new Date().toISOString(),
  };
  writeState(state);
}

export function markUninstalled(agentId: string): void {
  const state = readState();
  delete state.agents[agentId];
  writeState(state);
}
