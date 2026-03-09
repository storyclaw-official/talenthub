// Reads all agent manifests and generates catalog.json at repo root.
// Run: npx tsx scripts/generate-catalog.ts
import fs from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const AGENTS_DIR = path.resolve(__dirname, "../agents");
const CATALOG_PATH = path.resolve(__dirname, "../catalog.json");

type CatalogEntry = {
  version: string;
  name: string;
  emoji: string;
  category: string;
  skillCount: number;
};

async function main() {
  const entries = await fs.readdir(AGENTS_DIR, { withFileTypes: true });
  const agents: Record<string, CatalogEntry> = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(AGENTS_DIR, entry.name, "manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw);
      agents[manifest.id] = {
        version: manifest.version,
        name: manifest.name,
        emoji: manifest.emoji,
        category: manifest.category,
        skillCount: manifest.skills?.length ?? 0,
      };
    } catch {
      console.warn(`Skipping ${entry.name}: no valid manifest.json`);
    }
  }

  const catalog = {
    catalogVersion: 1,
    updatedAt: new Date().toISOString(),
    agents,
  };

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
  console.log(`catalog.json written with ${Object.keys(agents).length} agents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
