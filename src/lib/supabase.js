import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[supabase] Missing env vars!\n' +
    '  VITE_SUPABASE_URL: ' + (supabaseUrl ? '✅' : '❌ missing') + '\n' +
    '  VITE_SUPABASE_ANON_KEY: ' + (supabaseKey ? '✅' : '❌ missing') + '\n' +
    'Check GitHub repo → Settings → Secrets and variables → Actions'
  )
}

// Use placeholder values so createClient() never throws at module-init time.
// If secrets are missing the app will still mount and show a visible error.
export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseKey  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMH0.placeholder'
)

// Re-export utilities for convenient access
export { cached, invalidate, invalidatePrefix, clearCache } from './cache'
export { withRetry } from './retry'
export { rateLimited, checkRateLimit } from './rateLimiter'
export { hasRole, canPerform, requireAuth } from './authorize'
