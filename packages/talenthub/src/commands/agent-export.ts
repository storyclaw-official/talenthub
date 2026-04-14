import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { readState } from "../lib/state.js"
import { resolveWorkspaceDir } from "../lib/paths.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

const PROMPT_FILES = ["IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"]

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

  if (!agent.manifest) {
    if (json) jsonl({ event: "error", message: `Agent "${agentId}" has no manifest data. Reinstall or update to populate it.` })
    else console.error(`Agent "${agentId}" has no manifest data. Reinstall or update to populate it.`)
    process.exit(1)
  }

  const wsDir = resolveWorkspaceDir(agentId)
  if (!fs.existsSync(wsDir)) {
    if (json) jsonl({ event: "error", message: `Workspace not found: ${wsDir}` })
    else console.error(`Workspace not found: ${wsDir}`)
    process.exit(1)
  }

  log(`Exporting agent "${agentId}"...`)

  const zip = new JSZip()

  // Add manifest.json
  const manifest = {
    ...agent.manifest,
    version: agent.version,
  }
  zip.file("manifest.json", JSON.stringify(manifest, null, 2) + "\n")

  // Add prompt files from workspace
  const includedFiles: string[] = ["manifest.json"]
  for (const filename of PROMPT_FILES) {
    const filePath = path.join(wsDir, filename)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8")
      zip.file(filename, content)
      includedFiles.push(filename)
    }
  }

  // Write zip
  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve(`${agentId}.zip`)

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  fs.writeFileSync(outputPath, buffer)

  const sizeKB = Math.round(buffer.length / 1024)

  if (json) {
    jsonl({ event: "done", agentId, output: outputPath, files: includedFiles, sizeKB })
  } else {
    log(`✓ Exported to ${outputPath} (${sizeKB} KB)`)
    log(`  Files: ${includedFiles.join(", ")}`)
  }
}
