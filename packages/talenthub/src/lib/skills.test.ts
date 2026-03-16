import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockExecSync = vi.fn()
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}))

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talenthub-skills-test-"))
  const stateDir = path.join(tmpDir, ".openclaw")
  fs.mkdirSync(stateDir)
  vi.stubEnv("OPENCLAW_HOME", tmpDir)
  vi.stubEnv("OPENCLAW_STATE_DIR", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
  mockExecSync.mockReset()
})

const { parseSkillSpec, skillName, installSkill, isSkillInstalled, installAllSkills, updateAllSkills } = await import("./skills.js")

describe("parseSkillSpec", () => {
  it("parses owner/repo@skill", () => {
    expect(parseSkillSpec("inferen-sh/skills@web-search")).toEqual({
      repo: "inferen-sh/skills",
      skill: "web-search",
    })
  })

  it("returns undefined for plain slug without repo", () => {
    expect(parseSkillSpec("web-search")).toBeUndefined()
  })

  it("returns undefined for empty string", () => {
    expect(parseSkillSpec("")).toBeUndefined()
  })
})

describe("skillName", () => {
  it("extracts skill name from qualified entry", () => {
    expect(skillName("anthropics/skills@pdf")).toBe("pdf")
  })

  it("returns the entry as-is for unqualified string", () => {
    expect(skillName("pdf")).toBe("pdf")
  })
})

describe("isSkillInstalled", () => {
  it("returns false when skill dir does not exist", () => {
    expect(isSkillInstalled("web-search")).toBe(false)
  })

  it("returns true when skill dir has SKILL.md", () => {
    const skillDir = path.join(tmpDir, ".openclaw", "skills", "web-search")
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Web Search")
    expect(isSkillInstalled("web-search")).toBe(true)
  })
})

describe("installSkill", () => {
  it("runs skills add and creates symlink", () => {
    const wsDir = path.join(tmpDir, "workspace")
    fs.mkdirSync(wsDir, { recursive: true })

    mockExecSync.mockImplementation(() => {
      const skillDir = path.join(tmpDir, ".openclaw", "skills", "web-search")
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Web Search")
    })

    expect(installSkill("inferen-sh/skills@web-search", wsDir)).toBe(true)
    expect(mockExecSync).toHaveBeenCalledTimes(1)

    const link = path.join(wsDir, "skills", "web-search")
    expect(fs.existsSync(link)).toBe(true)
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
  })

  it("returns false for invalid spec (no repo)", () => {
    const wsDir = path.join(tmpDir, "workspace")
    fs.mkdirSync(wsDir, { recursive: true })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(installSkill("nonexistent-skill-xyz", wsDir)).toBe(false)
    errorSpy.mockRestore()
  })

  it("returns false when skills cli fails", () => {
    const wsDir = path.join(tmpDir, "workspace")
    fs.mkdirSync(wsDir, { recursive: true })
    mockExecSync.mockImplementation(() => { throw new Error("fail") })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(installSkill("inferen-sh/skills@web-search", wsDir)).toBe(false)
    errorSpy.mockRestore()
  })

  it("skips install when skill already exists, still creates symlink", () => {
    const wsDir = path.join(tmpDir, "workspace")
    fs.mkdirSync(wsDir, { recursive: true })
    const skillDir = path.join(tmpDir, ".openclaw", "skills", "web-search")
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Web Search")

    expect(installSkill("inferen-sh/skills@web-search", wsDir)).toBe(true)
    expect(mockExecSync).not.toHaveBeenCalled()

    const link = path.join(wsDir, "skills", "web-search")
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
  })
})

describe("installAllSkills", () => {
  it("counts installed, skipped, and failed", () => {
    const wsDir = path.join(tmpDir, "workspace")
    fs.mkdirSync(wsDir, { recursive: true })

    // Pre-install browser-use
    const browserDir = path.join(tmpDir, ".openclaw", "skills", "browser-use")
    fs.mkdirSync(browserDir, { recursive: true })
    fs.writeFileSync(path.join(browserDir, "SKILL.md"), "# Browser Use")

    // web-search will be installed by skills cli
    mockExecSync.mockImplementation(() => {
      const skillDir = path.join(tmpDir, ".openclaw", "skills", "web-search")
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Web Search")
    })

    const result = installAllSkills(
      ["browser-use/browser-use@browser-use", "inferen-sh/skills@web-search"],
      wsDir,
    )
    expect(result.skipped).toBe(1)
    expect(result.installed).toBe(1)
    expect(result.failed).toBe(0)
  })
})

describe("updateAllSkills", () => {
  it("returns true on success", () => {
    const skillsDir = path.join(tmpDir, ".openclaw", "skills")
    fs.mkdirSync(skillsDir, { recursive: true })
    mockExecSync.mockReturnValue(undefined)
    expect(updateAllSkills()).toBe(true)
  })

  it("returns false on failure", () => {
    const skillsDir = path.join(tmpDir, ".openclaw", "skills")
    fs.mkdirSync(skillsDir, { recursive: true })
    mockExecSync.mockImplementation(() => { throw new Error("fail") })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(updateAllSkills()).toBe(false)
    errorSpy.mockRestore()
  })
})
