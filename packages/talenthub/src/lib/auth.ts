import fs from "node:fs"
import path from "node:path"
import { fetchRetry } from "./fetch.js"
import { resolveStateDir } from "./paths.js"

export type AuthData = {
  token: string
  user_id: string
  expires_at: string
}

function authFilePath(): string {
  return path.join(resolveStateDir(), "talenthub-auth.json")
}

export function readAuth(): AuthData | null {
  const p = authFilePath()
  if (!fs.existsSync(p)) return null
  try {
    const data: AuthData = JSON.parse(fs.readFileSync(p, "utf-8"))
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      fs.unlinkSync(p)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function writeAuth(data: AuthData): void {
  const p = authFilePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

export function clearAuth(): void {
  const p = authFilePath()
  if (fs.existsSync(p)) {
    fs.unlinkSync(p)
  }
}

export function getRegistryBaseUrl(): string {
  return (
    process.env.TALENTHUB_URL?.trim() ||
    process.env.TALENTHUB_REGISTRY?.trim() ||
    "https://app.storyclaw.com"
  )
}

export type DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_url: string
  expires_in: number
  interval: number
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const base = getRegistryBaseUrl()
  const res = await fetchRetry(`${base}/api/talenthub/auth/device-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    throw new Error(`Failed to request device code: ${res.status}`)
  }
  return res.json()
}

export type TokenResponse = {
  access_token: string
  user_id: string
  expires_at: string
}

/**
 * Exchange an sc_token (web session cookie) for a CLI-compatible th_* token.
 */
export async function exchangeToken(scToken: string): Promise<TokenResponse> {
  const base = getRegistryBaseUrl()
  const res = await fetchRetry(`${base}/api/talenthub/auth/token-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: scToken }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw new Error(`Token exchange failed (${res.status}): ${body.error ?? "unknown error"}`)
  }
  return res.json()
}

/**
 * Verify a th_* CLI token against the registry and return the user_id.
 */
export async function verifyToken(token: string): Promise<{ user_id: string }> {
  const base = getRegistryBaseUrl()
  const res = await fetchRetry(`${base}/api/talenthub/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw new Error(`Token verification failed (${res.status}): ${body.error ?? "unknown error"}`)
  }
  return res.json()
}

export async function pollForToken(
  deviceCode: string,
  interval: number,
  maxWaitMs: number,
): Promise<TokenResponse> {
  const base = getRegistryBaseUrl()
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000))

    const res = await fetchRetry(`${base}/api/talenthub/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
      retries: 2,
    })

    if (res.ok) {
      return res.json()
    }

    const body = await res.json().catch(() => ({ error: "unknown" }))

    if (body.error === "authorization_pending") {
      continue
    }
    if (body.error === "expired_token") {
      throw new Error("Device code expired. Please try again.")
    }
    throw new Error(`Token exchange failed: ${body.error}`)
  }

  throw new Error("Timed out waiting for authorization.")
}
