#!/usr/bin/env node
import dns from "node:dns"

// IPv6 is unreachable on many networks (especially behind NAT/China);
// try IPv4 first to avoid EHOSTUNREACH delays on every fetch.
dns.setDefaultResultOrder("ipv4first")

import { Command } from "commander"
import { agentInstall } from "./commands/agent-install.js"
import { agentList } from "./commands/agent-list.js"
import { agentPublish } from "./commands/agent-publish.js"
import { agentSearch } from "./commands/agent-search.js"
import { agentUninstall } from "./commands/agent-uninstall.js"
import { agentUnpublish } from "./commands/agent-unpublish.js"
import { agentUpdate } from "./commands/agent-update.js"
import { login } from "./commands/login.js"
import { logout } from "./commands/logout.js"

const program = new Command()

program
  .name("talenthub")
  .description("Manage StoryClaw AI agents")
  .version("0.1.0")

program.command("login").description("Authenticate with StoryClaw").action(login)
program.command("logout").description("Remove stored credentials").action(logout)

const agent = program.command("agent").description("Agent management commands")

agent
  .command("install <name>")
  .description("Install an agent and its skills")
  .option("-f, --force", "Overwrite existing agent", false)
  .action(agentInstall)

agent
  .command("update [name]")
  .description("Update an agent or all agents")
  .option("-a, --all", "Update all installed agents")
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
  .command("publish <name>")
  .description("Publish a local agent to the registry")
  .option("-d, --dir <path>", "Agent directory containing manifest.json and .md files")
  .action(agentPublish)

agent
  .command("unpublish <name>")
  .description("Archive an agent from the registry")
  .action(agentUnpublish)

program.parse()
