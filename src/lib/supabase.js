import { createClient } from '@supabase/supabase-js'

// Fallback to hardcoded values so the app always works on GitHub Pages
// even if GitHub Secrets are not configured. The anon key is public by design.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://ljxoeolglqmcpstglpqa.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqeG9lb2xnbHFtY3BzdGdscHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjQxNjQsImV4cCI6MjA5MDkwMDE2NH0.E7XBvkpPCTFqjebtLixe35Y2_0UFC8DFY2aum97sjns'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Re-export utilities for convenient access
export { cached, invalidate, invalidatePrefix, clearCache } from './cache'
export { withRetry } from './retry'
export { rateLimited, checkRateLimit } from './rateLimiter'
export { hasRole, canPerform, requireAuth } from './authorize'
