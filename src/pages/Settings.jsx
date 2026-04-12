import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']

const DINNER_DAYS_KEY = 'dinner_active_days'
const DINNER_TIME_KEY = 'dinner_default_time'

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}

export default function Settings() {
  const { profile } = useAuth()
  const { theme, setTheme } = useTheme()

  const [dinnerDays, setDinnerDays] = useState(() => loadLS(DINNER_DAYS_KEY, [0,1,2,3,4,5]))
  const [dinnerTime, setDinnerTime] = useState(() => loadLS(DINNER_TIME_KEY, '19:00'))

  function toggleDinnerDay(d) {
    setDinnerDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  function saveDinner() {
    localStorage.setItem(DINNER_DAYS_KEY, JSON.stringify(dinnerDays))
    localStorage.setItem(DINNER_TIME_KEY, JSON.stringify(dinnerTime))
    toast.success('הגדרות ארוחת ערב נשמרו')
  }

  const sectionTitle = (t) => (
    <h2 style={{margin:'0 0 1rem',fontSize:'1rem',fontWeight:600,color:'#e2e8f0'}}>{t}</h2>
  )

  const row = (label, value) => (
    <div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)'}}>
      <span style={{fontSize:'0.85rem',color:'#64748b'}}>{label}</span>
      <span style={{fontSize:'0.85rem',color:'#e2e8f0',fontWeight:500}}>{value}</span>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem',maxWidth:560}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>הגדרות</h1>

      {/* System info */}
      <div className="page-card">
        {sectionTitle('מידע מערכת')}
        <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
          {row('משתמש מחובר', profile?.name)}
          {row('תפקיד', profile?.role === 'admin' ? 'אדמין' : 'משתמש')}
          {row('מטבע בסיס', '₪ שקל')}
          {row('גיבוי', 'Supabase Cloud – אוטומטי')}
        </div>
      </div>

      {/* Appearance */}
      <div className="page-card">
        {sectionTitle('🎨 מראה')}
        <div style={{display:'flex',gap:'0.625rem'}}>
          {[['dark','🌙 כהה'],['light','☀️ בהיר']].map(([val, lbl]) => {
            const active = theme === val
            return (
              <button key={val} onClick={() => setTheme(val)} style={{
                flex:1, padding:'0.625rem 1rem', borderRadius:'0.75rem', fontSize:'0.875rem',
                cursor:'pointer', fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? 'rgba(108,99,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.03)',
                color: active ? '#a78bfa' : '#94a3b8',
                transition:'all 0.15s',
              }}>{lbl}</button>
            )
          })}
        </div>
      </div>

      {/* Dinner scheduling */}
      <div className="page-card">
        {sectionTitle('🍽️ תזמון ארוחת ערב')}
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.625rem'}}>ימים פעילים</label>
            <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
              {DAYS_HE.map((d, i) => {
                const active = dinnerDays.includes(i)
                return (
                  <button key={i} onClick={() => toggleDinnerDay(i)} style={{
                    padding:'0.4rem 0.625rem', borderRadius:'0.5rem', fontSize:'0.8rem', cursor:'pointer',
                    border:`1px solid ${active ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: active ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#a78bfa' : '#64748b', fontWeight: active ? 600 : 400,
                  }}>{d}</button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>שעת ברירת מחדל</label>
            <input className="input-field" type="time" value={dinnerTime} onChange={e => setDinnerTime(e.target.value)} dir="ltr" style={{maxWidth:140}}/>
          </div>
          <button className="btn-primary" onClick={saveDinner} style={{alignSelf:'flex-start'}}>
            <Save size={14}/>שמור הגדרות ארוחה
          </button>
        </div>
      </div>

      {/* Users */}
      <div className="page-card">
        {sectionTitle('משתמשים')}
        <div style={{padding:'0.875rem',borderRadius:'0.75rem',background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.15)'}}>
          <p style={{margin:0,fontSize:'0.85rem',color:'#94a3b8',textAlign:'center'}}>
            המשתמשים הקבועים במערכת הם <strong style={{color:'#a78bfa'}}>יעקב</strong> ו-<strong style={{color:'#a78bfa'}}>יעל</strong>.<br/>
            ניהול משתמשים זמין בפאנל האדמין.
          </p>
        </div>
      </div>
    </div>
  )
}
