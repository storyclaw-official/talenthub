import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CLI_TIMEOUT_MS = 120_000;

/** The openclaw binary: on PATH, else next to the node running this CLI (nvm installs both there). */
function openclawBin(): string {
  const sibling = path.join(path.dirname(process.execPath), "openclaw");
  const onPath = spawnSync("openclaw", ["--version"], { stdio: "ignore", timeout: CLI_TIMEOUT_MS });
  return onPath.error && fs.existsSync(sibling) ? sibling : "openclaw";
}

function runOpenClaw(args: string[]): void {
  const res = spawnSync(openclawBin(), args, { encoding: "utf-8", timeout: CLI_TIMEOUT_MS });
  if (res.error) throw new Error(`openclaw ${args[0]} ${args[1]} failed: ${res.error.message}`);
  if (res.status !== 0) {
    const output = `${res.stderr ?? ""}\n${res.stdout ?? ""}`.trim().split("\n").slice(-5).join("\n");
    throw new Error(`openclaw ${args[0]} ${args[1]} exited with ${res.status}: ${output}`);
  }
}

/**
 * Register a new agent through openclaw, which creates its agent dir and auth
 * and, for a device's first extra agent, the fleet ownership fields.
 * It also stamps the agent id into IDENTITY.md, so the published identity is
 * put back afterwards.
 */
export function registerAgentWithOpenClaw(agentId: string, workspace: string): void {
  const identityPath = path.join(workspace, "IDENTITY.md");
  const identity = fs.existsSync(identityPath) ? fs.readFileSync(identityPath) : null;
  try {
    runOpenClaw(["agents", "add", agentId, "--workspace", workspace, "--non-interactive", "--json"]);
  } finally {
    if (identity) fs.writeFileSync(identityPath, identity);
  }
}

/** Remove an agent from a keyed roster; openclaw also prunes its state. */
export function deleteAgentWithOpenClaw(agentId: string): void {
  runOpenClaw(["agents", "delete", agentId, "--force", "--json"]);
}
