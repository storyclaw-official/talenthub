import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockFetch = vi.fn()

vi.mock("node:readline", () => ({
  default: {
    createInterface: vi.fn().mockReturnValue({
      question: (_q: string, cb: (a: string) => void) => cb("y"),
      close: vi.fn(),
    }),
  },
}))

let tmpDir: string
let authPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-unpub-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  authPath = path.join(stateDir, "talenthub-auth.json")

  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")
  vi.stubEnv("TALENTHUB_URL", "http://localhost:3000")
  vi.stubEnv("TALENTHUB_REGISTRY", "")

  vi.stubGlobal("fetch", mockFetch)

  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const { agentUnpublish } = await import("./agent-unpublish.js")

describe("agentUnpublish", () => {
  it("exits when not logged in", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })
    await expect(agentUnpublish("test-agent")).rejects.toThrow("process.exit")
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it("unpublishes agent successfully", async () => {
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        token: "th_test",
        user_id: "user-1",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
    )

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, message: "Agent archived. Data preserved." }),
    })

    await agentUnpublish("test-agent")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe("http://localhost:3000/api/talent/registry/test-agent/unpublish")
    expect(console.log).toHaveBeenCalledWith("✓ Agent archived. Data preserved.")
  })

  it("handles unpublish failure", async () => {
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        token: "th_test",
        user_id: "user-1",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
    )

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not the owner of this agent" }),
    })

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit")
    })
    await expect(agentUnpublish("test-agent")).rejects.toThrow("process.exit")
    exitSpy.mockRestore()
  })
})
