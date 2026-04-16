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

  const rows = agents.map(([id, info]) => {
    const remote = catalog?.agents[id];
    const skillCount = remote?.skillCount?.toString() ?? "?";
    let status = "Up to date";
    if (remote && remote.version !== info.version) {
      status = `Update available (${remote.version})`;
    } else if (!remote) {
      status = "Not in registry";
    }
    return [id, info.version, skillCount, status] as const;
  });

  const cols = ["Agent", "Version", "Skills", "Status"] as const;
  const widths = cols.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)) + 2,
  );

  const fmt = (row: readonly string[]) =>
    "  " + row.map((v, i) => v.padEnd(widths[i])).join("");

  console.log(fmt(cols));
  console.log("-".repeat(widths.reduce((a, b) => a + b, 2)));
  for (const row of rows) {
    console.log(fmt(row));
  }
}
