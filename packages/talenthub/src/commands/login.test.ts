import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../lib/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth.js")>()
  return {
    ...actual,
    requestDeviceCode: vi.fn().mockResolvedValue({
      device_code: "dc_test",
      user_code: "ABCD1234",
      verification_url: "https://app.storyclaw.com/talent/auth/verify?user_code=ABCD1234",
      expires_in: 600,
      interval: 1,
    }),
    pollForToken: vi.fn().mockResolvedValue({
      access_token: "th_newtoken",
      user_id: "user-123",
      expires_at: "2026-06-01T00:00:00Z",
    }),
  }
})

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}))

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-login-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")
  vi.stubEnv("TALENTHUB_URL", "")
  vi.stubEnv("TALENTHUB_REGISTRY", "")

  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const { login } = await import("./login.js")
const { readAuth } = await import("../lib/auth.js")

describe("login", () => {
  it("performs device code flow and saves token", async () => {
    await login()

    const auth = readAuth()
    expect(auth).not.toBeNull()
    expect(auth!.token).toBe("th_newtoken")
    expect(auth!.user_id).toBe("user-123")
  })

  it("skips login when already authenticated", async () => {
    const authPath = path.join(tmpDir, ".openclaw", "talenthub-auth.json")
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        token: "th_existing",
        user_id: "user-existing",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
    )

    await login()

    expect(console.log).toHaveBeenCalledWith("Already logged in.")
  })
})
