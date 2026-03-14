const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 4

/**
 * fetch wrapper with timeout + retry for transient network errors.
 * Retries only on TypeError (network-level failures like ETIMEDOUT,
 * EHOSTUNREACH, ECONNRESET); HTTP errors are returned as-is.
 *
 * The first retry is silent and fast (500ms) to absorb transient
 * connection-establishment failures (common with Cloudflare + undici).
 */
export async function fetchRetry(
  url: string,
  init?: RequestInit & { retries?: number; timeoutMs?: number },
): Promise<Response> {
  const maxRetries = init?.retries ?? DEFAULT_MAX_RETRIES
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let lastError: unknown
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const silent = attempt === 1
        const delay = silent ? 500 : attempt * 1_000
        if (!silent) {
          console.warn(`  Network error, retrying (${attempt - 1}/${maxRetries - 1}) in ${delay / 1000}s...`)
        }
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
