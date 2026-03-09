import { readState } from "../lib/state.js";
import { getCatalogCached } from "../lib/update-check.js";

export async function agentSearch(query?: string): Promise<void> {
  const catalog = await getCatalogCached();
  const state = readState();

  let entries = Object.entries(catalog.agents);
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(
      ([id, a]) =>
        id.includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }

  if (entries.length === 0) {
    console.log(query ? `No agents matching "${query}".` : "No agents available.");
    return;
  }

  const header = padRow("", "Agent", "Name", "Category", "Skills", "Version");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const [id, agent] of entries) {
    const installed = state.agents[id] ? "✓" : " ";
    console.log(
      padRow(
        installed,
        id,
        `${agent.emoji} ${agent.name}`,
        agent.category,
        agent.skillCount.toString(),
        agent.version,
      ),
    );
  }

  console.log(`\n${entries.length} agent(s) found. ✓ = installed`);
}

function padRow(
  mark: string,
  id: string,
  name: string,
  category: string,
  skills: string,
  version: string,
): string {
  return `  ${mark.padEnd(2)} ${id.padEnd(14)} ${name.padEnd(32)} ${category.padEnd(14)} ${skills.padEnd(8)} ${version}`;
}
