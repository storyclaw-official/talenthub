import { fetchCatalog, type Catalog } from "./registry.js";
import { readState, writeState } from "./state.js";
import { isOlderVersion } from "./version.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type UpdateInfo = {
  agentId: string;
  currentVersion: string;
  latestVersion: string;
  name: string;
};

export async function getCatalogCached(): Promise<Catalog> {
  const state = readState();
  const lastCheck = state.lastUpdateCheck ? new Date(state.lastUpdateCheck).getTime() : 0;
  const now = Date.now();

  if (now - lastCheck < CACHE_TTL_MS) {
    // Within cache window; still fetch but don't worry about staleness
  }

  const catalog = await fetchCatalog();
  state.lastUpdateCheck = new Date().toISOString();
  writeState(state);
  return catalog;
}

export async function checkUpdates(): Promise<UpdateInfo[]> {
  const state = readState();
  const catalog = await getCatalogCached();
  const updates: UpdateInfo[] = [];

  for (const [agentId, installed] of Object.entries(state.agents)) {
    const remote = catalog.agents[agentId];
    if (!remote) continue;
    if (isOlderVersion(installed.version, remote.version)) {
      updates.push({
        agentId,
        currentVersion: installed.version,
        latestVersion: remote.version,
        name: remote.name,
      });
    }
  }
  return updates;
}
