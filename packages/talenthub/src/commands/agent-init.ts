import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Parse IDENTITY.md to extract Name and Emoji fields.
 *
 * Expected format:
 *   - **Name:** Aria
 *   - **Emoji:** 🎭
 */
function parseIdentityMd(dir: string): { name?: string; emoji?: string } {
  const filePath = path.join(dir, "IDENTITY.md")
  if (!fs.existsSync(filePath)) return {}

  const content = fs.readFileSync(filePath, "utf-8")
  const result: { name?: string; emoji?: string } = {}

  const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i)
  if (nameMatch) {
    // Take first part before | or — (e.g. "AI Assistant | AI 助理" → "AI Assistant")
    result.name = nameMatch[1].split(/\s*[|—]\s*/)[0].trim()
  }

  const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(.+)/i)
  if (emojiMatch) {
    const val = emojiMatch[1].trim()
    // Skip if it says "none" or similar
    if (val && !/^none/i.test(val)) {
      result.emoji = val
    }
  }

  return result
}

const VALID_CATEGORIES = ["creative", "finance", "productivity", "companion", "research", "engineering"]

export async function agentInit(opts: { dir?: string } = {}): Promise<void> {
  const dir = path.resolve(opts.dir || ".")
  const manifestPath = path.join(dir, "manifest.json")

  if (fs.existsSync(manifestPath)) {
    console.error(`manifest.json already exists in ${dir}`)
    process.exit(1)
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Derive defaults from directory name and IDENTITY.md
  // Agent dirs are typically "workspace-xxx" — extract "xxx" as the id
  const baseName = path.basename(dir)
  const dirName = (baseName.startsWith("workspace-") ? baseName.slice("workspace-".length) : baseName)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
  const identity = parseIdentityMd(dir)

  // --- ID ---
  const defaultId = /^[a-z0-9-]+$/.test(dirName) ? dirName : ""
  const idInput = await prompt(defaultId ? `Agent ID [${defaultId}]: ` : "Agent ID (lowercase alphanumeric + hyphens): ")
  const id = idInput || defaultId
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    console.error("Invalid agent ID. Must be lowercase alphanumeric + hyphens only.")
    process.exit(1)
  }

  // --- Name ---
  const defaultName = identity.name || ""
  const nameInput = await prompt(defaultName ? `Agent name [${defaultName}]: ` : "Agent name: ")
  const name = nameInput || defaultName
  if (!name) {
    console.error("Agent name is required.")
    process.exit(1)
  }

  // --- Emoji ---
  const defaultEmoji = identity.emoji || ""
  const emojiInput = await prompt(defaultEmoji ? `Emoji [${defaultEmoji}]: ` : "Emoji (optional): ")
  const emoji = emojiInput || defaultEmoji

  // --- Category ---
  const category = await prompt(`Category (${VALID_CATEGORIES.join(", ")}) [productivity]: `)
  const finalCategory = category || "productivity"
  if (!VALID_CATEGORIES.includes(finalCategory)) {
    console.error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`)
    process.exit(1)
  }

  const role = await prompt("Role (optional): ")
  const tagline = await prompt("Tagline (optional): ")

  const manifest: Record<string, unknown> = {
    id,
    name,
    category: finalCategory,
    ...(emoji && { emoji }),
    ...(role && { role }),
    ...(tagline && { tagline }),
    description: "",
    skills: [],
    i18n: {},
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
  console.log(`\n✓ Created ${manifestPath}`)

  // Create placeholder prompt files if they don't exist
  for (const file of ["IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"]) {
    const filePath = path.join(dir, file)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# ${file.replace(".md", "")}\n`)
    }
  }
  console.log("✓ Created prompt files (IDENTITY.md, USER.md, SOUL.md, AGENTS.md)")
  console.log(`\nNext: edit the prompt files, then run "talenthub agent publish ${id} --dir ${dir}"`)
}
