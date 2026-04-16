#!/usr/bin/env node
import dns from "node:dns"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// IPv6 is unreachable on many networks (especially behind NAT/China);
// try IPv4 first to avoid EHOSTUNREACH delays on every fetch.
dns.setDefaultResultOrder("ipv4first")

import { Command } from "commander"
import { agentInit } from "./commands/agent-init.js"
import { agentInstall } from "./commands/agent-install.js"
import { agentList } from "./commands/agent-list.js"
import { agentPublish } from "./commands/agent-publish.js"
import { agentSearch } from "./commands/agent-search.js"
import { agentUninstall } from "./commands/agent-uninstall.js"
import { agentUnpublish } from "./commands/agent-unpublish.js"
import { agentVisibility } from "./commands/agent-visibility.js"
import { agentExport } from "./commands/agent-export.js"
import { agentUpdate } from "./commands/agent-update.js"
import { skillsList, skillsAdd, skillsRemove } from "./commands/agent-skills.js"
import { login } from "./commands/login.js"
import { logout } from "./commands/logout.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"))

const program = new Command()

program
  .name("talenthub")
  .description("Manage StoryClaw AI agents")
  .version(pkg.version)

program
  .command("login")
  .description("Authenticate with StoryClaw")
  .option("-t, --token <token>", "Authenticate directly with an sc_token")
  .action(login)
program.command("logout").description("Remove stored credentials").action(logout)

const agent = program.command("agent").description("Agent management commands")

agent
  .command("init")
  .description("Initialize a new agent with manifest.json and prompt files")
  .option("-d, --dir <path>", "Target directory (defaults to current directory)")
  .action(agentInit)

agent
  .command("install <name>")
  .description("Install an agent and its skills")
  .option("-f, --force", "Overwrite existing agent", false)
  .option("-t, --token <token>", "Authenticate with a th_* token for private agents")
  .option("--json", "Output structured JSONL progress for machine consumption", false)
  .action(agentInstall)

agent
  .command("update [name]")
  .description("Update an agent or all agents")
  .option("-a, --all", "Update all installed agents")
  .option("--json", "Output structured JSONL progress for machine consumption", false)
  .action(agentUpdate)

agent
  .command("uninstall <name>")
  .description("Remove an installed agent")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(agentUninstall)

agent
  .command("list")
  .description("List installed agents and check for updates")
  .action(agentList)

agent
  .command("search [query]")
  .description("Browse available agents")
  .action(agentSearch)

agent
  .command("publish")
  .description("Publish a local agent to the registry")
  .option("-d, --dir <path>", "Agent directory containing manifest.json and .md files (defaults to current directory)")
  .option("-n, --name <name>", "Agent name in openclaw config (used to resolve workspace dir)")
  .option("--id <id>", "Override agent ID from manifest")
  .option("--private", "Publish as a private agent (only owner can access)", false)
  .action(agentPublish)

agent
  .command("unpublish <name>")
  .description("Archive an agent from the registry")
  .action(agentUnpublish)

agent
  .command("visibility <name>")
  .description("Change an agent's visibility between public and private")
  .option("--public", "Make the agent public")
  .option("--private", "Make the agent private (only owner can access)")
  .action(agentVisibility)

agent
  .command("export <agentId>")
  .description("Export an installed agent to a .zip file")
  .option("-o, --output <path>", "Output file path (defaults to <agentId>.zip)")
  .option("--json", "Output structured JSONL for machine consumption", false)
  .action(agentExport)

const skills = agent.command("skills").description("Manage skills for an installed agent")

skills
  .command("list <agentId>")
  .description("List skills for an installed agent")
  .option("--json", "Output structured JSONL for machine consumption", false)
  .action(skillsList)

skills
  .command("add <agentId> <githubUrl>")
  .description("Add a skill to an installed agent")
  .option("-f, --force", "Replace existing skill with same name", false)
  .option("--json", "Output structured JSONL for machine consumption", false)
  .action(skillsAdd)

skills
  .command("remove <agentId> <skillName>")
  .description("Remove a skill from an installed agent")
  .option("--json", "Output structured JSONL for machine consumption", false)
  .action(skillsRemove)

program.parse()
