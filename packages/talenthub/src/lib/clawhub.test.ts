import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockExecSync = vi.fn();
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Must import after vi.mock
const { ensureClawhub, installSkill, updateAllSkills } = await import("./clawhub.js");

describe("ensureClawhub", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does nothing when clawhub is installed", () => {
    mockExecSync.mockReturnValue(Buffer.from("1.0.0"));
    ensureClawhub();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits when clawhub is not installed", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(() => ensureClawhub()).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("installSkill", () => {
  it("returns true on success", () => {
    mockExecSync.mockReturnValue(undefined);
    expect(installSkill("web-search", "/tmp/ws")).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith(
      'clawhub install web-search --workdir "/tmp/ws" --no-input',
      { stdio: "inherit" },
    );
  });

  it("returns false on failure", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("fail");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(installSkill("broken-skill", "/tmp/ws")).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("updateAllSkills", () => {
  it("returns true on success", () => {
    mockExecSync.mockReturnValue(undefined);
    expect(updateAllSkills("/tmp/ws")).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith(
      'clawhub update --all --workdir "/tmp/ws" --no-input',
      { stdio: "inherit" },
    );
  });

  it("returns false on failure", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("fail");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(updateAllSkills("/tmp/ws")).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
