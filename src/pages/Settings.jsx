import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { Save, ChevronDown, ChevronUp, Moon, Sun, Bell, Utensils, Users, Info, History, Smartphone, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const VOICE_FUNCTION_URL = 'https://ljxoeolglqmcpstglpqa.supabase.co/functions/v1/voice-command'
const WIDGET_URL = 'https://yaakovhersko17-png.github.io/mishk-habayit/widget'

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const DINNER_DAYS_KEY = 'dinner_active_days'
const DINNER_TIME_KEY = 'dinner_default_time'

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}

function AccordionRow({ icon, label, sub, color = '#6c63ff', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Row header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          padding: '0.875rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 38, height: 38, borderRadius: '0.75rem',
          background: `${color}20`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
          {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
        </div>
        <div style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {/* Expandable content */}
      {open && (
        <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function NavRow({ icon, label, sub, color = '#6c63ff', onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '0.75rem',
        background: `${color}20`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
      </div>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>›</div>
    </div>
  )
}

export default function Settings() {
  const { profile } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [dinnerDays, setDinnerDays] = useState(() => loadLS(DINNER_DAYS_KEY, [0,1,2,3,4,5]))
  const [dinnerTime, setDinnerTime] = useState(() => loadLS(DINNER_TIME_KEY, '19:00'))
  const [copiedWidget, setCopiedWidget] = useState(false)
  const [copiedSiri, setCopiedSiri] = useState(false)
  const [siriToken, setSiriToken] = useState('')

  async function loadSiriToken() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) setSiriToken(session.access_token)
    else toast.error('לא מחובר')
  }

  function copyText(text, setter) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true)
      setTimeout(() => setter(false), 2000)
    })
  }

  function toggleDinnerDay(d) {
    setDinnerDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  function saveDinner() {
    localStorage.setItem(DINNER_DAYS_KEY, JSON.stringify(dinnerDays))
    localStorage.setItem(DINNER_TIME_KEY, JSON.stringify(dinnerTime))
    toast.success('הגדרות ארוחת ערב נשמרו')
  }

  const infoRow = (label, value) => (
    <div key={label} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.625rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.825rem', color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 560 }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>הגדרות</h1>

      <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>הגדרות ממשק</span>
        </div>

        {/* Appearance */}
        <AccordionRow
          icon={<Moon size={18} />}
          label="מראה"
          sub={theme === 'dark' ? 'מצב כהה פעיל' : 'מצב בהיר פעיל'}
          color="#6c63ff"
        >
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            {[['dark', '🌙 כהה'], ['light', '☀️ בהיר']].map(([val, lbl]) => {
              const active = theme === val
              return (
                <button key={val} onClick={() => setTheme(val)} style={{
                  flex: 1, padding: '0.625rem 1rem', borderRadius: '0.75rem', fontSize: '0.875rem',
                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                  border: `1px solid ${active ? 'rgba(108,99,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#a78bfa' : 'var(--text-sub)', transition: 'all 0.15s',
                }}>{lbl}</button>
              )
            })}
          </div>
        </AccordionRow>

        {/* Dinner scheduling */}
        <AccordionRow
          icon={<Utensils size={18} />}
          label="תזמון ארוחת ערב"
          sub={`ימים פעילים · ${dinnerTime}`}
          color="#f97316"
        >
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.625rem' }}>ימים פעילים</label>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {DAYS_HE.map((d, i) => {
                const active = dinnerDays.includes(i)
                return (
                  <button key={i} onClick={() => toggleDinnerDay(i)} style={{
                    padding: '0.4rem 0.625rem', borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer',
                    border: `1px solid ${active ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: active ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#a78bfa' : 'var(--text-muted)', fontWeight: active ? 600 : 400,
                  }}>{d}</button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שעת ברירת מחדל</label>
            <input className="input-field" type="time" value={dinnerTime}
              onChange={e => setDinnerTime(e.target.value)} dir="ltr" style={{ maxWidth: 140 }} />
          </div>
          <button className="btn-primary" onClick={saveDinner} style={{ alignSelf: 'flex-start' }}>
            <Save size={14} />שמור הגדרות ארוחה
          </button>
        </AccordionRow>

        {/* Users */}
        <AccordionRow
          icon={<Users size={18} />}
          label="משתמשים"
          sub="יעקב ויעל"
          color="#60a5fa"
        >
          <div style={{
            padding: '0.875rem', borderRadius: '0.75rem',
            background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.15)',
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)', textAlign: 'center' }}>
              המשתמשים הקבועים הם <strong style={{ color: '#a78bfa' }}>יעקב</strong> ו-<strong style={{ color: '#a78bfa' }}>יעל</strong>.<br />
              ניהול משתמשים זמין בפאנל האדמין.
            </p>
          </div>
        </AccordionRow>

        {/* System info — collapsed by default */}
        <AccordionRow
          icon={<Info size={18} />}
          label="מידע מערכת"
          sub="גרסה, גיבוי, משתמש"
          color="#94a3b8"
          defaultOpen={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {infoRow('משתמש מחובר', profile?.name)}
            {infoRow('תפקיד', profile?.role === 'admin' ? 'אדמין' : 'משתמש')}
            {infoRow('מטבע בסיס', '₪ שקל')}
            {infoRow('גיבוי', 'Supabase Cloud – אוטומטי')}
          </div>
        </AccordionRow>

        {/* Siri & Widget */}
        <AccordionRow
          icon={<Smartphone size={18} />}
          label="סירי ווידג'ט"
          sub="קיצורי סירי וכרטיסיית מסך הבית"
          color="#4ade80"
        >
          {/* Widget URL */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.5rem', fontWeight: 600 }}>📱 ווידג'ט מסך הבית</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              פתח את הקישור הזה בסאפארי → שתף → הוסף למסך הבית
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.625rem',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all', direction: 'ltr',
              }}>{WIDGET_URL}</div>
              <button onClick={() => copyText(WIDGET_URL, setCopiedWidget)} style={{
                padding: '0.5rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer',
                background: copiedWidget ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)',
                color: copiedWidget ? '#4ade80' : 'var(--text-muted)', flexShrink: 0,
              }}>
                {copiedWidget ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Siri token */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '0.5rem', fontWeight: 600 }}>🎙️ קיצור סירי</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              1. לחץ "קבל Token" → העתק<br />
              2. פתח "קיצורי דרך" → צור קיצור חדש<br />
              3. הוסף פעולת "קבל תוכן כתובת URL"<br />
              4. URL: <span dir="ltr" style={{ fontFamily: 'monospace' }}>{VOICE_FUNCTION_URL}</span><br />
              5. Headers: <span style={{ fontFamily: 'monospace' }}>Authorization: Bearer {"<TOKEN>"}</span><br />
              6. Body (JSON): <span style={{ fontFamily: 'monospace' }}>{`{"command":"<speak input>"}`}</span>
            </div>
            {!siriToken ? (
              <button onClick={loadSiriToken} style={{
                padding: '0.5rem 1rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer',
                background: 'rgba(108,99,255,0.2)', color: '#a78bfa', fontSize: '0.8rem', fontWeight: 600,
              }}>קבל Token לסירי</button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{
                  flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.625rem',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.65rem', color: 'var(--text-muted)', wordBreak: 'break-all',
                  direction: 'ltr', maxHeight: 60, overflow: 'hidden',
                }}>{siriToken.substring(0, 60)}...</div>
                <button onClick={() => copyText(siriToken, setCopiedSiri)} style={{
                  padding: '0.5rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer',
                  background: copiedSiri ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)',
                  color: copiedSiri ? '#4ade80' : 'var(--text-muted)', flexShrink: 0,
                }}>
                  {copiedSiri ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* Siri command examples */}
          <div style={{
            padding: '0.75rem', borderRadius: '0.75rem',
            background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600, marginBottom: '0.4rem' }}>דוגמאות לפקודות:</div>
            {['הוצאה 50 שקל על אוכל', 'הכנסה 2000 שקל', 'כמה כסף יש לי'].map(cmd => (
              <div key={cmd} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0' }}>
                🎙️ "{cmd}"
              </div>
            ))}
          </div>
        </AccordionRow>

        {/* History — navigate row */}
        <NavRow
          icon={<History size={18} />}
          label="היסטוריית ממשק"
          sub="יומן פעילות ושינויים"
          color="#4ade80"
          onClick={() => navigate('/history')}
        />
      </div>
    </div>
  )
}
