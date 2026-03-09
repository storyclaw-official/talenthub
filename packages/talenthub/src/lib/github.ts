const REPO_OWNER = "storyclaw-official";
const REPO_NAME = "agents";
const BRANCH = "main";

function rawUrl(filePath: string): string {
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filePath}`;
}

export type CatalogAgent = {
  version: string;
  name: string;
  emoji: string;
  category: string;
  skillCount: number;
};

export type Catalog = {
  catalogVersion: number;
  updatedAt: string;
  agents: Record<string, CatalogAgent>;
};

export type AgentManifest = {
  id: string;
  version: string;
  name: string;
  emoji: string;
  model: string;
  category: string;
  minOpenClawVersion: string;
  skills: string[];
  files: string[];
};

export async function fetchCatalog(): Promise<Catalog> {
  const url = rawUrl("catalog.json");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchManifest(agentId: string): Promise<AgentManifest> {
  const url = rawUrl(`agents/${agentId}/manifest.json`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Agent "${agentId}" not found in registry (${res.status})`);
  }
  return res.json();
}

export async function fetchAgentFile(agentId: string, filename: string): Promise<string> {
  const url = rawUrl(`agents/${agentId}/${filename}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename} for agent "${agentId}" (${res.status})`);
  }
  return res.text();
}
