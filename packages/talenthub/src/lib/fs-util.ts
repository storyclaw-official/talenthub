import fs from "node:fs"

/**
 * Write an agent/skill file, self-healing any stuck permissions.
 *
 * A brain file (e.g. EVOLUTION.md) may already exist on disk read-only —
 * left over from an older export, a bad mode, or a previous crash. A plain
 * `fs.writeFileSync` over a 0440 file throws EACCES, so install/update would
 * abort and the agent could never rewrite its own file again.
 *
 * Removing a read-only file only requires a writable *directory* (which we
 * always have), so we unlink first, then write fresh and normalize the mode
 * to 0o644. This guarantees the owner can write the file afterwards,
 * regardless of the runtime umask or the previous mode.
 */
export function writeAgentFile(filePath: string, content: string | Buffer): void {
  fs.rmSync(filePath, { force: true })
  fs.writeFileSync(filePath, content)
  fs.chmodSync(filePath, 0o644)
}
