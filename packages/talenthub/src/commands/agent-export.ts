import fs from "node:fs"
import path from "node:path"
import { readState } from "../lib/state.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { readAgentDir, buildAgentZip } from "../lib/agent-zip.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

export async function agentExport(agentId: string, options: { output?: string; json?: boolean }): Promise<void> {
  const json = options.json === true
  const log = json ? () => {} : console.log.bind(console)
  const state = readState()
  const agent = state.agents[agentId]

  if (!agent) {
    if (json) jsonl({ event: "error", message: `Agent "${agentId}" is not installed` })
    else console.error(`Agent "${agentId}" is not installed.`)
    process.exit(1)
  }

  const wsDir = resolveWorkspaceDir(agentId)
  if (!fs.existsSync(wsDir)) {
    if (json) jsonl({ event: "error", message: `Workspace not found: ${wsDir}` })
    else console.error(`Workspace not found: ${wsDir}`)
    process.exit(1)
  }

  // Ensure manifest.json exists in workspace
  const manifestPath = path.join(wsDir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    // Generate minimal manifest from state or agent ID
    const manifest = agent.manifest
      ? { ...agent.manifest, version: agent.version }
      : { id: agentId, name: agentId, category: "productivity" }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
  }

  log(`Exporting agent "${agentId}"...`)

  const contents = readAgentDir(wsDir)
  const { buffer, files, sizeKB } = await buildAgentZip(contents)

  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve(`${agentId}.zip`)

  fs.writeFileSync(outputPath, buffer)

  if (json) {
    jsonl({ event: "done", agentId, output: outputPath, files, sizeKB })
  } else {
    log(`✓ Exported to ${outputPath} (${sizeKB} KB)`)
    log(`  Files: ${files.join(", ")}`)
  }
}
