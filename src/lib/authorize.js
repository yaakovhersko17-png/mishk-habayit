/**
 * Authorization layer — separates permission checks from authentication.
 * Authentication = "who are you?" (handled by AuthContext/Supabase Auth)
 * Authorization  = "what can you do?" (handled here)
 */

// Role hierarchy: admin > user
const ROLES = { user: 1, admin: 2 }

/**
 * Check if a profile has a minimum required role.
 * @param {object} profile - User profile with `role` field
 * @param {string} requiredRole - Minimum role needed ('user' | 'admin')
 * @returns {boolean}
 */
export function hasRole(profile, requiredRole) {
  if (!profile?.role) return false
  return (ROLES[profile.role] || 0) >= (ROLES[requiredRole] || 999)
}

/**
 * Check if user can perform an action on a resource.
 * Shared household model: all authenticated users can CRUD their own + shared data.
 * Admin-only actions are explicitly gated.
 */
export function canPerform(profile, action, resource = null) {
  if (!profile) return false

  // Admin-only actions
  const ADMIN_ACTIONS = [
    'manage_users',
    'view_all_activity',
    'delete_user',
    'change_roles',
  ]

  if (ADMIN_ACTIONS.includes(action)) {
    return hasRole(profile, 'admin')
  }

  // All authenticated users can perform standard CRUD
  return true
}

/**
 * Guard wrapper — throws if unauthorized.
 * Use in page components or API calls.
 * @param {object} profile
 * @param {string} action
 * @param {string} [errorMsg]
 */
export function requireAuth(profile, action, errorMsg = 'אין לך הרשאה לבצע פעולה זו') {
  if (!canPerform(profile, action)) {
    throw new Error(errorMsg)
  }
}
