import { readState } from "../lib/state.js";
import { getCatalogCached } from "../lib/update-check.js";

export async function agentList(): Promise<void> {
  const state = readState();
  const agents = Object.entries(state.agents);

  if (agents.length === 0) {
    console.log("No agents installed via talenthub.");
    console.log('Run "talenthub agent search" to see available agents.');
    return;
  }

  let catalog;
  try {
    catalog = await getCatalogCached();
  } catch {
    catalog = null;
  }

  const header = padRow("Agent", "Version", "Skills", "Status");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const [id, info] of agents) {
    const remote = catalog?.agents[id];
    const skillCount = remote?.skillCount?.toString() ?? "?";
    let status = "Up to date";
    if (remote && remote.version !== info.version) {
      status = `Update available (${remote.version})`;
    } else if (!remote) {
      status = "Not in registry";
    }
    console.log(padRow(id, info.version, skillCount, status));
  }
}

function padRow(name: string, version: string, skills: string, status: string): string {
  return `  ${name.padEnd(16)} ${version.padEnd(14)} ${skills.padEnd(8)} ${status}`;
}
