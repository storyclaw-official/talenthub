import { clearAuth, readAuth } from "../lib/auth.js"

export async function logout(): Promise<void> {
  const existing = readAuth()
  if (!existing) {
    console.log("Not logged in.")
    return
  }

  clearAuth()
  console.log("✓ Logged out. Token removed.")
}
