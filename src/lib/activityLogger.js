import { supabase } from './supabase'

export async function logActivity({ userId, userName, actionType, entityType, description, entityId = null, metadata = {} }) {
  try {
    await supabase.from('activity_log').insert({
      user_id: userId,
      user_name: userName,
      action_type: actionType,
      entity_type: entityType,
      description,
      entity_id: entityId,
      metadata,
    })
  } catch (err) {
    console.error('Activity log error:', err)
  }
}

export const ACTION_TYPES = {
  CREATE: 'הוספה',
  UPDATE: 'עריכה',
  DELETE: 'מחיקה',
  LOGIN:  'התחברות',
  LOGOUT: 'התנתקות',
  SCAN:   'סריקה',
  EXPORT: 'ייצוא',
  COMPLETE: 'השלמה',
}

export const ENTITY_TYPES = {
  TRANSACTION: 'טרנזקציה',
  WALLET:      'ארנק',
  CATEGORY:    'קטגוריה',
  INVOICE:     'חשבונית',
  REMINDER:    'תזכורת',
  NOTE:        'פתק',
  REPORT:      'דוח',
  USER:        'משתמש',
}
