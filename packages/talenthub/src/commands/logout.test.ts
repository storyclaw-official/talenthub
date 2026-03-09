import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-logout-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")

  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const { logout } = await import("./logout.js")

describe("logout", () => {
  it("removes auth file", async () => {
    const authPath = path.join(tmpDir, ".openclaw", "talenthub-auth.json")
    fs.writeFileSync(authPath, JSON.stringify({ token: "th_test", user_id: "u1", expires_at: "2026-12-01" }))

    await logout()

    expect(fs.existsSync(authPath)).toBe(false)
    expect(console.log).toHaveBeenCalledWith("✓ Logged out. Token removed.")
  })

  it("handles not being logged in", async () => {
    await logout()
    expect(console.log).toHaveBeenCalledWith("Not logged in.")
  })
})
