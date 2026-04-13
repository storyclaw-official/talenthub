/**
 * Agent version utilities.
 *
 * Format: YYYY.MM.DD-X
 *   - YYYY: 4-digit year
 *   - MM:   2-digit zero-padded month (01-12)
 *   - DD:   2-digit zero-padded day (01-31)
 *   - X:    positive integer counter (1, 2, 3, ...)
 */

const VERSION_RE = /^(\d{4})\.(\d{2})\.(\d{2})-(\d+)$/

type ParsedVersion = {
  year: number
  month: number
  day: number
  counter: number
}

function parseVersion(v: string): ParsedVersion | null {
  const m = VERSION_RE.exec(v)
  if (!m) return null
  const month = Number(m[2])
  const day = Number(m[3])
  const counter = Number(m[4])
  if (month < 1 || month > 12 || day < 1 || day > 31 || counter < 1) return null
  return { year: Number(m[1]), month, day, counter }
}

/**
 * Compare two version strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 *
 * Falls back to string comparison if either version doesn't match the
 * YYYY.MM.DD-X format (for backwards compatibility with old versions).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersion(a)
  const pb = parseVersion(b)

  // If both parse, compare structurally
  if (pa && pb) {
    const fields: (keyof ParsedVersion)[] = ["year", "month", "day", "counter"]
    for (const field of fields) {
      if (pa[field] < pb[field]) return -1
      if (pa[field] > pb[field]) return 1
    }
    return 0
  }

  // Fallback: string comparison (handles old "2026.3.16" style versions)
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Check if version `a` is older than version `b`.
 */
export function isOlderVersion(a: string, b: string): boolean {
  return compareVersions(a, b) === -1
}
