#!/usr/bin/env node
import { Command } from "commander";
import { agentInstall } from "./commands/agent-install.js";
import { agentList } from "./commands/agent-list.js";
import { agentSearch } from "./commands/agent-search.js";
import { agentUninstall } from "./commands/agent-uninstall.js";
import { agentUpdate } from "./commands/agent-update.js";

const program = new Command();

program
  .name("talenthub")
  .description("Manage StoryClaw AI agents")
  .version("0.1.0");

const agent = program.command("agent").description("Agent management commands");

agent
  .command("install <name>")
  .description("Install an agent and its skills")
  .option("-f, --force", "Overwrite existing agent", false)
  .action(agentInstall);

agent
  .command("update [name]")
  .description("Update an agent or all agents")
  .option("-a, --all", "Update all installed agents")
  .action(agentUpdate);

agent
  .command("uninstall <name>")
  .description("Remove an installed agent")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(agentUninstall);

agent
  .command("list")
  .description("List installed agents and check for updates")
  .action(agentList);

agent
  .command("search [query]")
  .description("Browse available agents")
  .action(agentSearch);

program.parse();
