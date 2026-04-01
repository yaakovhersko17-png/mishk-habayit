/**
 * Retry logic with exponential backoff for Supabase / API calls.
 * Retries on 5xx errors or network failures only.
 */

const DEFAULT_OPTS = {
  maxRetries: 3,
  baseDelay: 500,   // ms
  maxDelay: 8000,   // ms
}

/**
 * Execute a Supabase query with automatic retry on transient failures.
 * @param {() => Promise<{data:any, error:any}>} fn - Supabase query function
 * @param {object} opts - Retry options
 * @returns {Promise<{data:any, error:any}>}
 */
export async function withRetry(fn, opts = {}) {
  const { maxRetries, baseDelay, maxDelay } = { ...DEFAULT_OPTS, ...opts }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()

      // Supabase errors with 5xx status → retry
      if (result.error && isRetryable(result.error) && attempt < maxRetries) {
        await sleep(getDelay(attempt, baseDelay, maxDelay))
        continue
      }

      return result
    } catch (err) {
      // Network error → retry
      if (attempt < maxRetries) {
        await sleep(getDelay(attempt, baseDelay, maxDelay))
        continue
      }
      return { data: null, error: err }
    }
  }
}

function isRetryable(error) {
  if (!error) return false
  const status = error.status || error.code
  // Retry on 5xx server errors, 429 rate limit, or network errors
  if (typeof status === 'number') return status >= 500 || status === 429
  // Supabase error messages that indicate transient issues
  const msg = (error.message || '').toLowerCase()
  return msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')
}

function getDelay(attempt, base, max) {
  const delay = base * Math.pow(2, attempt)
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.min(delay + jitter, max)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
