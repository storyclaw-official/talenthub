import fs from "node:fs";
import readline from "node:readline";
import { readConfig, removeAgent, writeConfig } from "../lib/config.js";
import { resolveWorkspaceDir } from "../lib/paths.js";
import { markUninstalled, readState } from "../lib/state.js";

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

export async function agentUninstall(name: string, options: { yes?: boolean }): Promise<void> {
  const state = readState();
  if (!state.agents[name]) {
    console.error(`Agent "${name}" is not installed via talenthub.`);
    process.exit(1);
  }

  if (!options.yes) {
    const ok = await confirm(`Remove agent "${name}"? This will archive the workspace. [y/N] `);
    if (!ok) {
      console.log("Cancelled.");
      return;
    }
  }

  // Archive workspace
  const wsDir = resolveWorkspaceDir(name);
  if (fs.existsSync(wsDir)) {
    const backupDir = `${wsDir}.bak`;
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.renameSync(wsDir, backupDir);
    console.log(`Workspace archived to ${backupDir}`);
  }

  // Remove from config
  const cfg = readConfig();
  const { config: updatedCfg, removedBindings } = removeAgentFromConfig(cfg, name);
  writeConfig(updatedCfg);

  markUninstalled(name);

  console.log(
    `Removed agent "${name}"` +
      (removedBindings > 0 ? ` (${removedBindings} binding(s) cleaned)` : "") +
      ".",
  );
}

function removeAgentFromConfig(cfg: ReturnType<typeof readConfig>, agentId: string) {
  const result = removeAgent(cfg, agentId);
  const originalBindings = cfg.bindings?.length ?? 0;
  const newBindings = (result.bindings ?? []).length;
  return {
    config: result,
    removedBindings: originalBindings - newBindings,
  };
}
