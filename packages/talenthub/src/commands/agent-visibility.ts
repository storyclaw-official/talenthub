import { readAuth, getRegistryBaseUrl } from "../lib/auth.js"
import { fetchRetry } from "../lib/fetch.js"

export async function agentVisibility(
  name: string,
  opts: { public?: boolean; private?: boolean } = {},
): Promise<void> {
  const auth = readAuth()
  if (!auth) {
    console.error('Not logged in. Run "talenthub login" first.')
    process.exit(1)
  }

  if (opts.public === opts.private) {
    console.error("Specify exactly one of --public or --private.")
    process.exit(1)
  }
  const targetPublic = opts.public === true

  const base = getRegistryBaseUrl()
  const res = await fetchRetry(`${base}/api/talenthub/registry/${name}/visibility`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ is_public: targetPublic }),
  })

  const result = await res.json().catch(() => ({ error: "Unknown error" }))

  if (!res.ok) {
    console.error(`✗ ${result.error}`)
    process.exit(1)
  }

  console.log(`✓ ${result.message}`)
}
