/**
 * Client-side rate limiter to prevent API abuse.
 * Uses a sliding window approach per action key.
 */

const windows = new Map()

/**
 * Check if an action is allowed under rate limit.
 * @param {string} key - Action identifier (e.g. 'invoice-scan', 'transaction-create')
 * @param {number} maxRequests - Max requests allowed in the window
 * @param {number} windowMs - Time window in ms (default 60s)
 * @returns {{ allowed: boolean, retryAfter: number }} retryAfter in ms (0 if allowed)
 */
export function checkRateLimit(key, maxRequests = 10, windowMs = 60_000) {
  const now = Date.now()
  let timestamps = windows.get(key) || []

  // Remove expired timestamps
  timestamps = timestamps.filter(t => now - t < windowMs)

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0]
    const retryAfter = windowMs - (now - oldest)
    return { allowed: false, retryAfter }
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  return { allowed: true, retryAfter: 0 }
}

/**
 * Rate-limited wrapper — rejects with a message if limit exceeded.
 * @param {string} key
 * @param {() => Promise<any>} fn
 * @param {number} max
 * @param {number} windowMs
 */
export async function rateLimited(key, fn, max = 10, windowMs = 60_000) {
  const { allowed, retryAfter } = checkRateLimit(key, max, windowMs)
  if (!allowed) {
    const secs = Math.ceil(retryAfter / 1000)
    return { data: null, error: { message: `יותר מדי בקשות. נסה שוב בעוד ${secs} שניות` } }
  }
  return fn()
}
