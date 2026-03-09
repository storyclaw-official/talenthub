import fs from "node:fs";
import path from "node:path";
import { ensureClawhub, installSkill } from "../lib/clawhub.js";
import { addOrUpdateAgent, findAgentEntry, readConfig, writeConfig } from "../lib/config.js";
import { fetchAgentFile, fetchCatalog, fetchManifest } from "../lib/github.js";
import { resolveWorkspaceDir } from "../lib/paths.js";
import { markInstalled } from "../lib/state.js";

export async function agentInstall(name: string, options: { force?: boolean }): Promise<void> {
  console.log(`Looking up agent "${name}"...`);

  const catalog = await fetchCatalog();
  if (!catalog.agents[name]) {
    const available = Object.keys(catalog.agents).join(", ");
    console.error(`Agent "${name}" not found. Available: ${available}`);
    process.exit(1);
  }

  const manifest = await fetchManifest(name);
  console.log(`Found ${manifest.emoji} ${manifest.name} v${manifest.version} (${manifest.skills.length} skills)`);

  const cfg = readConfig();
  const existing = findAgentEntry(cfg, name);
  if (existing && !options.force) {
    console.error(
      `Agent "${name}" already exists in config. Use --force to overwrite.`,
    );
    process.exit(1);
  }

  ensureClawhub();

  const wsDir = resolveWorkspaceDir(name);
  fs.mkdirSync(wsDir, { recursive: true });

  console.log(`Fetching agent files...`);
  for (const filename of manifest.files) {
    try {
      const content = await fetchAgentFile(name, filename);
      fs.writeFileSync(path.join(wsDir, filename), content, "utf-8");
    } catch (err) {
      console.warn(`  Warning: could not fetch ${filename}: ${err}`);
    }
  }

  console.log(`Installing ${manifest.skills.length} skills via clawhub...`);
  let installed = 0;
  let failed = 0;
  for (const skill of manifest.skills) {
    const ok = installSkill(skill, wsDir);
    if (ok) installed++;
    else failed++;
  }

  let updatedCfg = addOrUpdateAgent(cfg, {
    id: manifest.id,
    name: manifest.name,
    skills: manifest.skills,
    model: manifest.model,
  });
  writeConfig(updatedCfg);

  markInstalled(manifest.id, manifest.version);

  console.log(
    `\n${manifest.emoji} Installed ${manifest.name} with ${installed} skills` +
      (failed > 0 ? ` (${failed} failed)` : "") +
      ".",
  );
  console.log("Restart the OpenClaw gateway to apply changes.");
}
