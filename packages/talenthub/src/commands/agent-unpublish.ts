import readline from "node:readline"
import { readAuth, getRegistryBaseUrl } from "../lib/auth.js"

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase().startsWith("y"))
    })
  })
}

export async function agentUnpublish(name: string): Promise<void> {
  const auth = readAuth()
  if (!auth) {
    console.error("Not logged in. Run \"talenthub login\" first.")
    process.exit(1)
  }

  const ok = await confirm(
    `Unpublish agent "${name}"? It will be hidden but data is preserved. [y/N] `,
  )
  if (!ok) {
    console.log("Cancelled.")
    return
  }

  const base = getRegistryBaseUrl()
  const res = await fetch(`${base}/api/talent/registry/${name}/unpublish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
  })

  const result = await res.json().catch(() => ({ error: "Unknown error" }))

  if (!res.ok) {
    console.error(`✗ Unpublish failed: ${result.error}`)
    process.exit(1)
  }

  console.log(`✓ ${result.message}`)
}
