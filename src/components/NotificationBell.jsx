import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ── helpers (duplicated from DinnerMeals to avoid coupling) ──────────────────

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

// A day is "covered" if there's any entry for it (real meal or skipped)
function computeMissingDays(meals) {
  const today = israeliToday()
  if (!meals.length) return isWeekend(today) ? [] : [today]

  const covered = new Set(meals.map(m => m.meal_date))
  const sorted  = [...meals].sort((a, b) => a.meal_date.localeCompare(b.meal_date))
  const earliest = sorted[0].meal_date

  const result = []
  const cursor = new Date(earliest + 'T12:00:00')
  const end    = new Date(today + 'T12:00:00')
  while (cursor <= end) {
    const d = new Intl.DateTimeFormat('en-CA').format(cursor)
    if (!isWeekend(d) && !covered.has(d)) result.push(d)
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen]       = useState(false)
  const [missing, setMissing] = useState([])
  const [skipping, setSkipping] = useState(null)
  const navigate = useNavigate()
  const ref      = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    loadMissing()
    scheduleReminder()

    function clickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', clickOutside)
    return () => {
      document.removeEventListener('mousedown', clickOutside)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleReminder() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch (_) {}

    try {
      const { hour, minute } = getIsraeliTime()
      const msUntil20 = ((20 - hour) * 60 - minute) * 60 * 1000
      if (msUntil20 <= 0) return

      timerRef.current = setTimeout(async () => {
        try {
          const today = israeliToday()
          if (isWeekend(today)) return
          const { data } = await supabase
            .from('dinner_meals').select('id').eq('meal_date', today).limit(1)
          if (!data?.length && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('📝 ארוחת ערב חסרה', {
              body: 'עוד לא מילאת מה אכלת הערב',
              icon: '/mishk-habayit/favicon.svg',
            })
          }
        } catch (_) {}
      }, msUntil20)
    } catch (_) {}
  }

  async function loadMissing() {
    const { data } = await supabase
      .from('dinner_meals')
      .select('meal_date, skipped')
      .order('meal_date', { ascending: true })
    setMissing(computeMissingDays(data || []))
  }

  async function skipDay(date) {
    setSkipping(date)
    const { error } = await supabase
      .from('dinner_meals')
      .insert({ meal_date: date, meal_text: 'דולג', skipped: true })
    if (error) {
      toast.error('שגיאה בדילוג')
      setSkipping(null)
      return
    }
    toast.success(`${formatDateHebrew(date)} — סומן כדולג`)
    await loadMissing()
    setSkipping(null)
  }

  const count = missing.length

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
          color: count > 0 ? '#f87171' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
          width: 300,
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
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0' }}>
              התראות {count > 0 && <span style={{ color: '#f87171' }}>({count})</span>}
            </span>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2, display: 'flex' }}>
              <X size={16} />
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0.5rem' }}>
            {count === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#475569', fontSize: '0.875rem' }}>
                🎉 אין התראות
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {missing.map(date => (
                  <div key={date} style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: '0.625rem',
                    padding: '0.625rem 0.75rem',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: 600, marginBottom: '0.2rem' }}>
                      🍽️ ארוחת ערב חסרה
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
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
                          color: '#64748b', fontSize: '0.75rem', fontWeight: 600,
                          cursor: skipping === date ? 'default' : 'pointer',
                          opacity: skipping === date ? 0.6 : 1,
                        }}>
                        {skipping === date ? '...' : 'דלג'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
