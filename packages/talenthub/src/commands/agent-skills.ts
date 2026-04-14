import fs from "node:fs"
import path from "node:path"
import { readState, writeState } from "../lib/state.js"
import { resolveWorkspaceDir } from "../lib/paths.js"
import { installSkill, isSkillInstalled, parseSkillSpec, skillName } from "../lib/skills.js"

function jsonl(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

export async function skillsList(agentId: string, options: { json?: boolean }): Promise<void> {
  const json = options.json === true
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

  const skills = agent.manifest.skills
  const wsDir = resolveWorkspaceDir(agentId)

  if (json) {
    const items = skills.map((entry) => {
      const name = skillName(entry)
      const spec = parseSkillSpec(entry)
      const installed = isSkillInstalled(name)
      const linked = fs.existsSync(path.join(wsDir, "skills", name))
      return { url: entry, name, repo: spec?.repo ?? "", installed, linked }
    })
    jsonl({ event: "done", agentId, skills: items })
  } else {
    if (skills.length === 0) {
      console.log(`Agent "${agentId}" has no skills.`)
      return
    }
    console.log(`Skills for "${agentId}" (${skills.length}):\n`)
    for (const entry of skills) {
      const name = skillName(entry)
      const installed = isSkillInstalled(name)
      const linked = fs.existsSync(path.join(wsDir, "skills", name))
      const status = installed && linked ? "✓" : installed ? "~ (not linked)" : "✗ (not installed)"
      console.log(`  ${status}  ${name}`)
      console.log(`       ${entry}`)
    }
  }
}

export async function skillsAdd(agentId: string, githubUrl: string, options: { json?: boolean; force?: boolean }): Promise<void> {
  const json = options.json === true
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

  const spec = parseSkillSpec(githubUrl)
  if (!spec) {
    if (json) jsonl({ event: "error", message: `Invalid skill URL "${githubUrl}". Expected "https://github.com/owner/repo@skill"` })
    else console.error(`Invalid skill URL "${githubUrl}". Expected "https://github.com/owner/repo@skill"`)
    process.exit(1)
  }

  // Check duplicate
  const existing = agent.manifest.skills.find((s) => skillName(s) === spec.skill)
  if (existing && !options.force) {
    if (json) jsonl({ event: "error", message: `Skill "${spec.skill}" already exists for agent "${agentId}". Use --force to replace.` })
    else console.error(`Skill "${spec.skill}" already exists for agent "${agentId}". Use --force to replace.`)
    process.exit(1)
  }

  const wsDir = resolveWorkspaceDir(agentId)
  const log = json ? () => {} : console.log.bind(console)

  log(`Installing skill "${spec.skill}" for agent "${agentId}"...`)

  const ok = installSkill(githubUrl, wsDir)
  if (!ok) {
    if (json) jsonl({ event: "error", message: `Failed to install skill "${spec.skill}"` })
    else console.error(`Failed to install skill "${spec.skill}"`)
    process.exit(1)
  }

  // Update manifest.skills in talenthub.json
  if (existing) {
    // Replace existing entry (--force)
    agent.manifest.skills = agent.manifest.skills.map((s) => skillName(s) === spec.skill ? githubUrl : s)
  } else {
    agent.manifest.skills.push(githubUrl)
  }
  writeState(state)

  if (json) jsonl({ event: "done", agentId, skill: spec.skill, url: githubUrl, action: existing ? "replaced" : "added" })
  else log(`✓ Skill "${spec.skill}" ${existing ? "replaced" : "added"} for agent "${agentId}".`)
}

export async function skillsRemove(agentId: string, name: string, options: { json?: boolean }): Promise<void> {
  const json = options.json === true
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

  const matchIdx = agent.manifest.skills.findIndex((s) => skillName(s) === name)
  if (matchIdx === -1) {
    if (json) jsonl({ event: "error", message: `Skill "${name}" not found in agent "${agentId}"` })
    else console.error(`Skill "${name}" not found in agent "${agentId}".`)
    process.exit(1)
  }

  const removedUrl = agent.manifest.skills[matchIdx]

  // Remove symlink from agent workspace
  const wsDir = resolveWorkspaceDir(agentId)
  const linkPath = path.join(wsDir, "skills", name)
  if (fs.existsSync(linkPath)) {
    const stat = fs.lstatSync(linkPath)
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(linkPath)
    } else {
      fs.rmSync(linkPath, { recursive: true, force: true })
    }
  }

  // Update manifest.skills in talenthub.json
  agent.manifest.skills.splice(matchIdx, 1)
  writeState(state)

  if (json) jsonl({ event: "done", agentId, skill: name, url: removedUrl, action: "removed" })
  else console.log(`✓ Skill "${name}" removed from agent "${agentId}".`)
}
