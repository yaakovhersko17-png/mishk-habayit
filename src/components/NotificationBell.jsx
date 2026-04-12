import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ── helpers ───────────────────────────────────────────────────────────────────

function israeliToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

function getIsraeliTime() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jerusalem', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const hour   = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0') % 24
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return { hour, minute }
}

function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 5 || day === 6
}

function formatDateHebrew(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function formatDueTime(dueDateStr) {
  const d = new Date(dueDateStr)
  return d.toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function computeMissingDays(meals) {
  const today = israeliToday()
  if (!meals.length) return isWeekend(today) ? [] : [today]
  const covered  = new Set(meals.map(m => m.meal_date))
  const sorted   = [...meals].sort((a, b) => a.meal_date.localeCompare(b.meal_date))
  const earliest = sorted[0].meal_date
  const result   = []
  const cursor   = new Date(earliest + 'T12:00:00')
  const end      = new Date(today + 'T12:00:00')
  while (cursor <= end) {
    const d = new Intl.DateTimeFormat('en-CA').format(cursor)
    if (!isWeekend(d) && !covered.has(d)) result.push(d)
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

function notify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/mishk-habayit/favicon.svg' })
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen]             = useState(false)
  const [missingDinners, setMissingDinners] = useState([])
  const [overdueReminders, setOverdueReminders] = useState([])
  const [skipping, setSkipping]     = useState(null)
  const [completing, setCompleting] = useState(null)
  const navigate  = useNavigate()
  const ref       = useRef(null)
  const timersRef = useRef([])   // reminder setTimeout IDs

  useEffect(() => {
    requestNotifPermission()
    loadAll()
    scheduleDinnerReminder()

    function clickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', clickOutside)
    return () => {
      document.removeEventListener('mousedown', clickOutside)
      timersRef.current.forEach(clearTimeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function requestNotifPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch (_) {}
  }

  // ── 8pm dinner reminder ────────────────────────────────────────────────────

  function scheduleDinnerReminder() {
    try {
      const { hour, minute } = getIsraeliTime()
      const msUntil20 = ((20 - hour) * 60 - minute) * 60 * 1000
      if (msUntil20 <= 0) return
      const id = setTimeout(async () => {
        try {
          const today = israeliToday()
          if (isWeekend(today)) return
          const { data } = await supabase
            .from('dinner_meals').select('id').eq('meal_date', today).limit(1)
          if (!data?.length) notify('📝 ארוחת ערב חסרה', 'עוד לא מילאת מה אכלת הערב')
        } catch (_) {}
      }, msUntil20)
      timersRef.current.push(id)
    } catch (_) {}
  }

  // ── Load all data ──────────────────────────────────────────────────────────

  async function loadAll() {
    await Promise.all([loadDinners(), loadReminders()])
  }

  async function loadDinners() {
    const { data } = await supabase
      .from('dinner_meals')
      .select('meal_date, meal_text')
      .order('meal_date', { ascending: true })
    setMissingDinners(computeMissingDays(data || []))
  }

  async function loadReminders() {
    // Clear previous scheduled timers for reminders
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const { data } = await supabase
      .from('reminders')
      .select('id, title, description, due_date, is_completed')
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })

    const now = Date.now()
    const overdue = []

    ;(data || []).forEach(r => {
      const dueMs = new Date(r.due_date).getTime()
      if (dueMs <= now) {
        // Already overdue — show immediately in bell
        overdue.push(r)
      } else {
        // Future — schedule browser notification + re-load when it fires
        const diff = dueMs - now
        const id = setTimeout(() => {
          notify(`🔔 תזכורת: ${r.title}`, r.description || '')
          loadReminders() // refresh overdue list
        }, diff)
        timersRef.current.push(id)
      }
    })

    setOverdueReminders(overdue)
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function skipDay(date) {
    setSkipping(date)
    const { error } = await supabase
      .from('dinner_meals')
      .insert({ meal_date: date, meal_text: '__skip__' })
    if (error) { toast.error('שגיאה בדילוג'); setSkipping(null); return }
    toast.success(`${formatDateHebrew(date)} — סומן כדולג`)
    await loadDinners()
    setSkipping(null)
  }

  async function completeReminder(r) {
    setCompleting(r.id)
    const { error } = await supabase
      .from('reminders')
      .update({ is_completed: true })
      .eq('id', r.id)
    if (error) { toast.error('שגיאה בעדכון'); setCompleting(null); return }
    toast.success(`✅ "${r.title}" הושלם!`)
    await loadReminders()
    setCompleting(null)
  }

  // ── Badge count ────────────────────────────────────────────────────────────

  const count = missingDinners.length + overdueReminders.length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'relative',
          background: open ? 'rgba(108,99,255,0.15)' : 'transparent',
          border: `1px solid ${open ? 'rgba(108,99,255,0.3)' : 'transparent'}`,
          borderRadius: '0.625rem',
          padding: '0.4rem',
          cursor: 'pointer',
          color: count > 0 ? '#f87171' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
        aria-label="התראות"
      >
        <Bell size={18} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            minWidth: 17, height: 17, borderRadius: '999px',
            background: '#ef4444', fontSize: '0.58rem', fontWeight: 700,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 'calc(100% + 0.5rem)',
          width: 310,
          background: '#1a1a2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.875rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 200,
          overflow: 'hidden',
          direction: 'rtl',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
              התראות {count > 0 && <span style={{ color: '#f87171' }}>({count})</span>}
            </span>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div style={{ maxHeight: 420, overflowY: 'auto', padding: '0.5rem' }}>
            {count === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                🎉 אין התראות
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* ── Reminders section ─────────────────────────────── */}
                {overdueReminders.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24',
                      padding: '0.25rem 0.25rem 0.375rem',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      🔔 תזכורות ({overdueReminders.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {overdueReminders.map(r => (
                        <div key={r.id} style={{
                          background: 'rgba(251,191,36,0.06)',
                          border: '1px solid rgba(251,191,36,0.18)',
                          borderRadius: '0.625rem',
                          padding: '0.625rem 0.75rem',
                          display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                        }}>
                          {/* Checkbox */}
                          <button
                            onClick={() => completeReminder(r)}
                            disabled={completing === r.id}
                            style={{
                              flexShrink: 0,
                              width: 20, height: 20,
                              borderRadius: '0.3rem',
                              border: '2px solid rgba(251,191,36,0.4)',
                              background: completing === r.id ? 'rgba(251,191,36,0.3)' : 'transparent',
                              cursor: completing === r.id ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginTop: 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            {completing === r.id && <Check size={11} color="#fbbf24" />}
                          </button>

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {r.title}
                            </div>
                            {r.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: 2 }}>
                                {r.description}
                              </div>
                            )}
                            <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: 3 }}>
                              ⏰ {formatDueTime(r.due_date)}
                            </div>
                          </div>

                          {/* Go to reminders */}
                          <button
                            onClick={() => { navigate('/reminders'); setOpen(false) }}
                            style={{
                              flexShrink: 0, background: 'none', border: 'none',
                              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 2,
                            }}
                          >›</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Dinners section ───────────────────────────────── */}
                {missingDinners.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, color: '#fca5a5',
                      padding: '0.25rem 0.25rem 0.375rem',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      🍽️ ארוחת ערב ({missingDinners.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {missingDinners.map(date => (
                        <div key={date} style={{
                          background: 'rgba(239,68,68,0.06)',
                          border: '1px solid rgba(239,68,68,0.15)',
                          borderRadius: '0.625rem',
                          padding: '0.625rem 0.75rem',
                        }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>
                            {formatDateHebrew(date)}
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button
                              onClick={() => { navigate('/dinners'); setOpen(false) }}
                              style={{
                                flex: 1, padding: '0.3rem 0.5rem', borderRadius: '0.375rem',
                                background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.3)',
                                color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                              }}>
                              מלא ›
                            </button>
                            <button
                              onClick={() => skipDay(date)}
                              disabled={skipping === date}
                              style={{
                                flex: 1, padding: '0.3rem 0.5rem', borderRadius: '0.375rem',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600,
                                cursor: skipping === date ? 'default' : 'pointer',
                                opacity: skipping === date ? 0.6 : 1,
                              }}>
                              {skipping === date ? '...' : 'דלג'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
