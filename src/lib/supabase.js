import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Re-export utilities for convenient access
export { cached, invalidate, invalidatePrefix, clearCache } from './cache'
export { withRetry } from './retry'
export { rateLimited, checkRateLimit } from './rateLimiter'
export { hasRole, canPerform, requireAuth } from './authorize'
