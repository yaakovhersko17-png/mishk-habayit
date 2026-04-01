/**
 * Simple in-memory cache with TTL for reducing redundant Supabase queries.
 * Usage:
 *   const data = await cached('wallets', () => supabase.from('wallets').select('*'), 60_000)
 */

const store = new Map()

/**
 * Get or set a cached value.
 * @param {string} key - Cache key
 * @param {() => Promise<{data:any, error:any}>} fetcher - Async function that returns Supabase-style { data, error }
 * @param {number} ttl - Time to live in ms (default 60s)
 * @returns {Promise<{data:any, error:any}>}
 */
export async function cached(key, fetcher, ttl = 60_000) {
  const entry = store.get(key)
  if (entry && Date.now() - entry.ts < ttl) {
    return { data: entry.data, error: null }
  }
  const result = await fetcher()
  if (!result.error && result.data) {
    store.set(key, { data: result.data, ts: Date.now() })
  }
  return result
}

/** Invalidate a specific cache key */
export function invalidate(key) {
  store.delete(key)
}

/** Invalidate all keys that start with a prefix */
export function invalidatePrefix(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

/** Clear the entire cache */
export function clearCache() {
  store.clear()
}
