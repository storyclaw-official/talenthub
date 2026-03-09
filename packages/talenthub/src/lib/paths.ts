import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function resolveHomeDir(): string {
  return process.env.OPENCLAW_HOME?.trim() || os.homedir();
}

export function resolveStateDir(): string {
  const override = process.env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    return path.resolve(override.replace(/^~/, resolveHomeDir()));
  }
  const home = resolveHomeDir();
  const newDir = path.join(home, ".openclaw");
  if (fs.existsSync(newDir)) return newDir;
  const legacy = path.join(home, ".clawdbot");
  if (fs.existsSync(legacy)) return legacy;
  return newDir;
}

export function resolveConfigPath(): string {
  const override = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return path.resolve(override.replace(/^~/, resolveHomeDir()));
  }
  const stateDir = resolveStateDir();
  const candidates = ["openclaw.json", "clawdbot.json"];
  for (const name of candidates) {
    const p = path.join(stateDir, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(stateDir, "openclaw.json");
}

export function resolveWorkspaceDir(agentId: string): string {
  const stateDir = resolveStateDir();
  if (agentId === "main") {
    return process.env.OPENCLAW_WORKSPACE?.trim()
      ? path.resolve(process.env.OPENCLAW_WORKSPACE.replace(/^~/, resolveHomeDir()))
      : path.join(stateDir, "workspace");
  }
  return path.join(stateDir, `workspace-${agentId}`);
}

export function resolveTalentHubStatePath(): string {
  return path.join(resolveStateDir(), "talenthub.json");
}
