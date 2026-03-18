import { execSync } from "node:child_process"
import { readAuth, requestDeviceCode, pollForToken, exchangeToken, verifyToken, writeAuth } from "../lib/auth.js"

function openUrl(url: string): void {
  try {
    const cmd =
      process.platform === "darwin"
        ? `open "${url}"`
        : process.platform === "win32"
          ? `start "${url}"`
          : `xdg-open "${url}"`
    execSync(cmd, { stdio: "ignore" })
  } catch {
    // Browser open is best-effort
  }
}

export async function login(options: { token?: string }): Promise<void> {
  if (options.token) {
    try {
      if (options.token.startsWith("th_")) {
        console.log("Verifying token...")
        const { user_id } = await verifyToken(options.token)
        writeAuth({ token: options.token, user_id, expires_at: "" })
        console.log(`✓ Logged in successfully.`)
        console.log(`  User ID: ${user_id}`)
      } else {
        // sc_token from web session — exchange for a CLI token
        console.log("Exchanging token...")
        const { access_token, user_id, expires_at } = await exchangeToken(options.token)
        writeAuth({ token: access_token, user_id, expires_at })
        console.log(`✓ Logged in successfully.`)
        console.log(`  User ID: ${user_id}`)
      }
    } catch (err) {
      console.error(`✗ Login failed: ${err instanceof Error ? err.message : err}`)
      process.exit(1)
    }
    return
  }

  const existing = readAuth()
  if (existing) {
    console.log("Already logged in.")
    console.log(`  User ID: ${existing.user_id}`)
    console.log(`  Expires: ${existing.expires_at}`)
    console.log('Run "talenthub logout" first to re-authenticate.')
    return
  }

  console.log("Requesting device code...")
  const { device_code, user_code, verification_url, interval, expires_in } =
    await requestDeviceCode()

  console.log(`\nOpen this URL in your browser to authorize:\n`)
  console.log(`  ${verification_url}\n`)
  console.log(`Your code: ${user_code}\n`)
  console.log("Waiting for authorization...")

  openUrl(verification_url)

  try {
    const { access_token, user_id, expires_at } = await pollForToken(
      device_code,
      interval,
      expires_in * 1000,
    )

    writeAuth({ token: access_token, user_id, expires_at })

    console.log(`\n✓ Logged in successfully.`)
    console.log(`  User ID: ${user_id}`)
  } catch (err) {
    console.error(`\n✗ Login failed: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}
