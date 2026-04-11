import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']

const DINNER_DAYS_KEY   = 'dinner_active_days'
const DINNER_TIME_KEY   = 'dinner_default_time'
const REM_FREQ_KEY      = 'reminder_default_freq'
const REM_TIME_KEY      = 'reminder_default_time'
const REM_DAYS_KEY      = 'reminder_default_days'

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}

export default function Settings() {
  const { profile } = useAuth()

  // Dinner settings
  const [dinnerDays, setDinnerDays] = useState(() => loadLS(DINNER_DAYS_KEY, [0,1,2,3,4,5]))
  const [dinnerTime, setDinnerTime] = useState(() => loadLS(DINNER_TIME_KEY, '19:00'))

  // Reminder schedule settings
  const [remFreq, setRemFreq]   = useState(() => loadLS(REM_FREQ_KEY, 'weekly'))
  const [remTime, setRemTime]   = useState(() => loadLS(REM_TIME_KEY, '09:00'))
  const [remDays, setRemDays]   = useState(() => loadLS(REM_DAYS_KEY, [0]))

  function toggleDinnerDay(d) {
    setDinnerDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }
  function toggleRemDay(d) {
    setRemDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  function saveDinner() {
    localStorage.setItem(DINNER_DAYS_KEY, JSON.stringify(dinnerDays))
    localStorage.setItem(DINNER_TIME_KEY, JSON.stringify(dinnerTime))
    toast.success('הגדרות ארוחת ערב נשמרו')
  }

  function saveReminder() {
    localStorage.setItem(REM_FREQ_KEY, JSON.stringify(remFreq))
    localStorage.setItem(REM_TIME_KEY, JSON.stringify(remTime))
    localStorage.setItem(REM_DAYS_KEY, JSON.stringify(remDays))
    toast.success('הגדרות תזכורות נשמרו')
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

      {/* Reminder scheduling */}
      <div className="page-card">
        {sectionTitle('🔔 תזמון תזכורות')}
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.5rem'}}>תדירות</label>
            <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
              {[['daily','יומי'],['weekly','שבועי'],['monthly','חודשי'],['yearly','שנתי']].map(([val, lbl]) => (
                <button key={val} onClick={() => setRemFreq(val)} style={{
                  padding:'0.4rem 0.875rem', borderRadius:'0.5rem', fontSize:'0.8rem', cursor:'pointer',
                  border:`1px solid ${remFreq===val ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: remFreq===val ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                  color: remFreq===val ? '#fbbf24' : '#64748b', fontWeight: remFreq===val ? 600 : 400,
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>שעה</label>
            <input className="input-field" type="time" value={remTime} onChange={e => setRemTime(e.target.value)} dir="ltr" style={{maxWidth:140}}/>
          </div>
          {(remFreq === 'weekly') && (
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.625rem'}}>ימים בשבוע</label>
              <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                {DAYS_HE.map((d, i) => {
                  const active = remDays.includes(i)
                  return (
                    <button key={i} onClick={() => toggleRemDay(i)} style={{
                      padding:'0.4rem 0.625rem', borderRadius:'0.5rem', fontSize:'0.8rem', cursor:'pointer',
                      border:`1px solid ${active ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                      color: active ? '#fbbf24' : '#64748b', fontWeight: active ? 600 : 400,
                    }}>{d}</button>
                  )
                })}
              </div>
            </div>
          )}
          {remFreq === 'monthly' && (
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>יום בחודש</label>
              <select className="input-field" value={remDays[0] || 1} onChange={e => setRemDays([Number(e.target.value)])} style={{maxWidth:120}} dir="ltr">
                {Array.from({length:28}, (_,i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <button className="btn-primary" onClick={saveReminder} style={{alignSelf:'flex-start'}}>
            <Save size={14}/>שמור הגדרות תזכורות
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
