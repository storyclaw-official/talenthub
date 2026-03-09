import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readAuth, writeAuth, clearAuth, getRegistryBaseUrl } from "./auth.js"

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-auth-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")
  vi.stubEnv("TALENTHUB_URL", "")
  vi.stubEnv("TALENTHUB_REGISTRY", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("readAuth", () => {
  it("returns null when no auth file exists", () => {
    expect(readAuth()).toBeNull()
  })

  it("returns auth data when file exists", () => {
    const authPath = path.join(tmpDir, ".openclaw", "talenthub-auth.json")
    const data = {
      token: "th_test123",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }
    fs.writeFileSync(authPath, JSON.stringify(data))
    expect(readAuth()).toEqual(data)
  })

  it("returns null and deletes file when expired", () => {
    const authPath = path.join(tmpDir, ".openclaw", "talenthub-auth.json")
    const data = {
      token: "th_expired",
      user_id: "user-1",
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }
    fs.writeFileSync(authPath, JSON.stringify(data))
    expect(readAuth()).toBeNull()
    expect(fs.existsSync(authPath)).toBe(false)
  })
})

describe("writeAuth", () => {
  it("writes auth data to file", () => {
    const data = {
      token: "th_new",
      user_id: "user-2",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }
    writeAuth(data)
    const authPath = path.join(tmpDir, ".openclaw", "talenthub-auth.json")
    expect(JSON.parse(fs.readFileSync(authPath, "utf-8"))).toEqual(data)
  })
})

describe("clearAuth", () => {
  it("removes auth file", () => {
    const authPath = path.join(tmpDir, ".openclaw", "talenthub-auth.json")
    fs.writeFileSync(authPath, "{}")
    clearAuth()
    expect(fs.existsSync(authPath)).toBe(false)
  })

  it("does nothing when no file exists", () => {
    expect(() => clearAuth()).not.toThrow()
  })
})

describe("getRegistryBaseUrl", () => {
  it("returns default URL when no env vars set", () => {
    expect(getRegistryBaseUrl()).toBe("https://app.storyclaw.com")
  })

  it("respects TALENTHUB_URL env var", () => {
    vi.stubEnv("TALENTHUB_URL", "http://localhost:3000")
    expect(getRegistryBaseUrl()).toBe("http://localhost:3000")
  })

  it("falls back to TALENTHUB_REGISTRY", () => {
    vi.stubEnv("TALENTHUB_REGISTRY", "https://custom.example.com")
    expect(getRegistryBaseUrl()).toBe("https://custom.example.com")
  })

  it("prefers TALENTHUB_URL over TALENTHUB_REGISTRY", () => {
    vi.stubEnv("TALENTHUB_URL", "http://localhost:3000")
    vi.stubEnv("TALENTHUB_REGISTRY", "https://custom.example.com")
    expect(getRegistryBaseUrl()).toBe("http://localhost:3000")
  })
})
