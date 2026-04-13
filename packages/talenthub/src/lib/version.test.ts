import { describe, it, expect } from "vitest"
import { compareVersions, isOlderVersion } from "./version.js"

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("2026.04.13-1", "2026.04.13-1")).toBe(0)
  })

  it("compares by date then counter", () => {
    expect(compareVersions("2026.04.13-1", "2026.04.14-1")).toBe(-1)
    expect(compareVersions("2026.04.14-1", "2026.04.13-1")).toBe(1)
    expect(compareVersions("2026.04.13-1", "2026.04.13-2")).toBe(-1)
    expect(compareVersions("2026.04.13-3", "2026.04.13-2")).toBe(1)
  })

  it("handles old-format versions via string fallback", () => {
    expect(compareVersions("2026.3.16", "2026.3.16")).toBe(0)
    expect(compareVersions("2026.3.16", "2026.4.1")).toBe(-1)
  })

  it("handles mixed old and new formats via string fallback", () => {
    // String comparison: "2026.3" > "2026.0" so old format appears "newer"
    // This is expected — once all agents use the new format, this edge case goes away
    expect(compareVersions("2026.3.16", "2026.04.13-1")).toBe(1)
  })
})

describe("isOlderVersion", () => {
  it("returns true when installed is older", () => {
    expect(isOlderVersion("2026.04.13-1", "2026.04.13-2")).toBe(true)
  })

  it("returns false when versions are equal", () => {
    expect(isOlderVersion("2026.04.13-1", "2026.04.13-1")).toBe(false)
  })

  it("returns false when installed is newer", () => {
    expect(isOlderVersion("2026.04.13-2", "2026.04.13-1")).toBe(false)
  })
})
