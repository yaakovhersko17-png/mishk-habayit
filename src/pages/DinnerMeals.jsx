/*
 * SUPABASE SETUP — run once in SQL Editor:
 *
 * CREATE TABLE dinner_meals (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   meal_text TEXT NOT NULL,
 *   meal_date DATE NOT NULL,
 *   rating INTEGER CHECK (rating >= 1 AND rating <= 5),
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   UNIQUE(user_id, meal_date)
 * );
 * CREATE INDEX ON dinner_meals(user_id, meal_date);
 * ALTER TABLE dinner_meals ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own meals" ON dinner_meals FOR ALL USING (auth.uid() = user_id);
 */

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Plus, Bell, Star, ChefHat, X, SlidersHorizontal,
  Edit2, BarChart2, GitMerge, TrendingDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

// ── Israeli time helpers ─────────────────────────────────────────────────────

function israeliToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

function getIsraeliTime() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const hour   = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0') % 24
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return { hour, minute }
}

function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 5 || day === 6
}

function getMissingDays(meals, startDate) {
  const today     = israeliToday()
  const mealDates = new Set(meals.map(m => m.meal_date))
  const missing   = []
  const cur       = new Date(startDate + 'T12:00:00')
  const end       = new Date(today + 'T12:00:00')
  while (cur <= end) {
    const ds = new Intl.DateTimeFormat('en-CA').format(cur)
    if (!isWeekend(ds) && !mealDates.has(ds)) missing.push(ds)
    cur.setDate(cur.getDate() + 1)
  }
  return missing
}

function formatDateHebrew(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 18 }) {
  return (
    <div style={{ display: 'flex', gap: 2, direction: 'ltr' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s} size={size}
          fill={s <= value ? '#fbbf24' : 'transparent'}
          color={s <= value ? '#fbbf24' : '#475569'}
          style={{ cursor: onChange ? 'pointer' : 'default', flexShrink: 0 }}
          onClick={() => onChange?.(s === value ? 0 : s)}
        />
      ))}
    </div>
  )
}

// ── MealModal ────────────────────────────────────────────────────────────────

function MealModal({ meal, defaultDate, onSave, onDelete, onClose }) {
  const [text,   setText]   = useState(meal?.meal_text  || '')
  const [date,   setDate]   = useState(meal?.meal_date  || defaultDate || israeliToday())
  const [rating, setRating] = useState(meal?.rating     || 0)
  const [notes,  setNotes]  = useState(meal?.notes      || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!text.trim()) { toast.error('מלא מה אכלת'); return }
    setSaving(true)
    await onSave({ meal_text: text.trim(), meal_date: date, rating: rating || null, notes: notes.trim() || null })
    setSaving(false)
  }

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'1rem', paddingTop:'3rem', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'#1e1e3a', border:'1px solid rgba(108,99,255,0.3)', borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0' }}>
            {meal ? 'עריכת ארוחה' : 'הוספת ארוחה'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:4 }}><X size={20}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div>
            <label style={{ fontSize:'0.8rem', color:'#94a3b8', display:'block', marginBottom:'0.375rem' }}>מה אכלתי *</label>
            <input
              className="input-field" value={text}
              onChange={e => setText(e.target.value)}
              placeholder="פסטה בולונז, עוף בתנור..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            />
          </div>
          <div>
            <label style={{ fontSize:'0.8rem', color:'#94a3b8', display:'block', marginBottom:'0.375rem' }}>תאריך</label>
            <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:'0.8rem', color:'#94a3b8', display:'block', marginBottom:'0.375rem' }}>דירוג (לא חובה)</label>
            <StarRating value={rating} onChange={setRating} size={24} />
          </div>
          <div>
            <label style={{ fontSize:'0.8rem', color:'#94a3b8', display:'block', marginBottom:'0.375rem' }}>הערות (לא חובה)</label>
            <textarea className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות..." rows={2} style={{ resize:'vertical' }} />
          </div>
        </div>

        <div style={{ display:'flex', gap:'0.625rem', marginTop:'1.25rem' }}>
          {meal && <button onClick={() => onDelete(meal.id)} className="btn-danger" style={{ flexShrink:0 }}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>}
          <button onClick={onClose} className="btn-ghost" style={{ flex:1 }}>ביטול</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex:1 }}>{saving ? '...' : 'שמור'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MissingDaysModal ─────────────────────────────────────────────────────────

function MissingDaysModal({ missing, onFill, onClose }) {
  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'1rem', paddingTop:'3rem', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'#1e1e3a', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.5)', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#e2e8f0', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Bell size={18} color="#f87171"/>
            ימים חסרים ({missing.length})
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:4 }}><X size={20}/></button>
        </div>
        {missing.length === 0 ? (
          <p style={{ color:'#4ade80', textAlign:'center', padding:'1rem' }}>✅ הכל מלא! אין ימים חסרים</p>
        ) : (
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {missing.map(date => (
              <button
                key={date} onClick={() => onFill(date)}
                style={{ textAlign:'right', direction:'rtl', padding:'0.75rem 1rem', borderRadius:'0.75rem', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#fca5a5', cursor:'pointer', fontSize:'0.875rem', fontWeight:500 }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.08)' }}
              >
                {formatDateHebrew(date)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SmartMealsView ───────────────────────────────────────────────────────────

function SmartMealsView({ meals, onMerge, onClose }) {
  const today = israeliToday()

  const top5 = useMemo(() => {
    const map = {}
    meals.forEach(m => {
      const k = m.meal_text.trim().toLowerCase()
      if (!map[k]) map[k] = { text: m.meal_text, count: 0 }
      map[k].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [meals])

  const forgotten = useMemo(() => {
    const lastMap = {}
    meals.forEach(m => {
      const k = m.meal_text.trim().toLowerCase()
      if (!lastMap[k] || m.meal_date > lastMap[k].date)
        lastMap[k] = { text: m.meal_text, date: m.meal_date }
    })
    return Object.values(lastMap)
      .filter(m => m.date < today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [meals, today])

  const chartData = useMemo(() => {
    const dayNames = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
    const counts = [0,0,0,0,0,0,0]
    meals.forEach(m => { counts[new Date(m.meal_date + 'T12:00:00').getDay()]++ })
    return dayNames.map((name, i) => ({ name, count: counts[i] }))
  }, [meals])

  const mergeSuggestions = useMemo(() => {
    const texts = [...new Set(meals.map(m => m.meal_text.trim()))]
    const pairs = []
    for (let i = 0; i < texts.length && pairs.length < 8; i++) {
      for (let j = i + 1; j < texts.length && pairs.length < 8; j++) {
        const a = texts[i].toLowerCase(), b = texts[j].toLowerCase()
        if (a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a)))
          pairs.push([texts[i], texts[j]])
      }
    }
    return pairs
  }, [meals])

  const [merged, setMerged] = useState({})

  const sec = { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', padding:'1rem' }
  const ttl = { fontSize:'0.85rem', fontWeight:700, color:'#94a3b8', marginBottom:'0.75rem', display:'flex', alignItems:'center', gap:'0.375rem' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, overflowY:'auto', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}>
      <div style={{ minHeight:'100%', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'1rem' }}>
        <div style={{ background:'#0f1117', border:'1px solid rgba(108,99,255,0.25)', borderRadius:'1.5rem', padding:'1.5rem', width:'100%', maxWidth:520, marginTop:'1rem', marginBottom:'2rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 style={{ margin:0, fontSize:'1.25rem', fontWeight:700, color:'#e2e8f0', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <ChefHat size={20} color="#fbbf24"/> ארוחות חכמות
            </h2>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:4 }}><X size={22}/></button>
          </div>

          {meals.length === 0 ? (
            <div style={{ textAlign:'center', color:'#64748b', padding:'2rem' }}>אין מספיק נתונים עדיין — הוסף ארוחות כדי לראות ניתוח</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Top 5 */}
              <div style={sec}>
                <div style={ttl}><Star size={14} color="#fbbf24"/> טופ 5 — הכי נאכל</div>
                {top5.map((m, i) => (
                  <div key={m.text} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0', borderBottom: i < top5.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(108,99,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'#a78bfa', flexShrink:0 }}>{i+1}</div>
                    <div style={{ flex:1, fontSize:'0.875rem', color:'#e2e8f0' }}>{m.text}</div>
                    <div style={{ fontSize:'0.75rem', color:'#64748b', background:'rgba(255,255,255,0.05)', padding:'0.125rem 0.5rem', borderRadius:9999 }}>{m.count}x</div>
                  </div>
                ))}
              </div>

              {/* Forgotten */}
              {forgotten.length > 0 && (
                <div style={sec}>
                  <div style={ttl}><TrendingDown size={14} color="#f87171"/> ארוחות שנשכחו</div>
                  {forgotten.map(m => (
                    <div key={m.text} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.375rem 0' }}>
                      <div style={{ flex:1, fontSize:'0.875rem', color:'#cbd5e1' }}>{m.text}</div>
                      <div style={{ fontSize:'0.75rem', color:'#64748b' }}>
                        {new Date(m.date + 'T12:00:00').toLocaleDateString('he-IL', { day:'numeric', month:'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart */}
              <div style={sec}>
                <div style={ttl}><BarChart2 size={14} color="#60a5fa"/> התפלגות לפי יום שבוע</div>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={chartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }}/>
                    <YAxis tick={{ fontSize:10, fill:'#64748b' }} allowDecimals={false}/>
                    <Tooltip
                      contentStyle={{ background:'#1e1e3a', border:'1px solid rgba(108,99,255,0.3)', borderRadius:8, fontSize:12 }}
                      labelStyle={{ color:'#e2e8f0' }} itemStyle={{ color:'#a78bfa' }}
                    />
                    <Bar dataKey="count" fill="#6c63ff" radius={[4,4,0,0]} name="ארוחות"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Merge suggestions */}
              {mergeSuggestions.length > 0 && (
                <div style={sec}>
                  <div style={ttl}><GitMerge size={14} color="#4ade80"/> הצעות מיזוג</div>
                  <div style={{ fontSize:'0.75rem', color:'#64748b', marginBottom:'0.625rem' }}>ארוחות בשם דומה — מיזוג יאחד אותן בסטטיסטיקה</div>
                  {mergeSuggestions.map(([a, b]) => {
                    const key = `${a}||${b}`
                    return (
                      <div key={key} style={{ padding:'0.625rem', borderRadius:'0.5rem', background:'rgba(74,222,128,0.05)', border:'1px solid rgba(74,222,128,0.1)', marginBottom:'0.5rem' }}>
                        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'0.8rem', color:'#e2e8f0' }}>{a}</span>
                          <span style={{ color:'#475569' }}>≈</span>
                          <span style={{ fontSize:'0.8rem', color:'#e2e8f0' }}>{b}</span>
                        </div>
                        {merged[key] ? (
                          <div style={{ fontSize:'0.75rem', color:'#4ade80' }}>✓ מוזג ל: {merged[key]}</div>
                        ) : (
                          <div style={{ display:'flex', gap:'0.375rem' }}>
                            <button onClick={() => { onMerge(b, a); setMerged(s => ({...s,[key]:a})) }}
                              style={{ flex:1, fontSize:'0.7rem', padding:'0.3rem', borderRadius:6, background:'rgba(108,99,255,0.12)', border:'1px solid rgba(108,99,255,0.2)', color:'#a78bfa', cursor:'pointer' }}>
                              → {a}
                            </button>
                            <button onClick={() => { onMerge(a, b); setMerged(s => ({...s,[key]:b})) }}
                              style={{ flex:1, fontSize:'0.7rem', padding:'0.3rem', borderRadius:6, background:'rgba(108,99,255,0.12)', border:'1px solid rgba(108,99,255,0.2)', color:'#a78bfa', cursor:'pointer' }}>
                              → {b}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DinnerMeals() {
  const { user } = useAuth()
  const [meals,       setMeals]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [editMeal,    setEditMeal]    = useState(null)
  const [showMissing, setShowMissing] = useState(false)
  const [showSmart,   setShowSmart]   = useState(false)
  const [addForDate,  setAddForDate]  = useState(null)
  const [showFilter,  setShowFilter]  = useState(false)
  const [filterFrom,  setFilterFrom]  = useState('')
  const [filterTo,    setFilterTo]    = useState('')
  const [filterText,  setFilterText]  = useState('')

  const today = israeliToday()

  useEffect(() => {
    load()
    // Request notification permission
    try {
      if ('Notification' in window && Notification.permission === 'default')
        Notification.requestPermission()
    } catch (_) {}
  }, [])

  // Schedule 20:00 reminder when meals change
  useEffect(() => {
    if (meals.some(m => m.meal_date === today)) return // already filled
    if (isWeekend(today)) return
    try {
      const { hour, minute } = getIsraeliTime()
      if (hour >= 20) return // already past 20:00
      const msUntil = ((20 - hour) * 60 - minute) * 60 * 1000
      const tid = setTimeout(() => {
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📝 ארוחת ערב חסרה', {
              body: 'עוד לא מילאת מה אכלת הערב — לחץ למילוי',
              icon: '/mishk-habayit/favicon.svg',
              tag: 'dinner-reminder',
            })
          }
        } catch (_) {}
      }, msUntil)
      return () => clearTimeout(tid)
    } catch (_) {}
  }, [meals, today])

  async function load() {
    const { data, error } = await supabase
      .from('dinner_meals')
      .select('*')
      .eq('user_id', user.id)
      .order('meal_date', { ascending: false })
    if (error) { toast.error('שגיאה בטעינת ארוחות'); setLoading(false); return }
    setMeals(data || [])
    setLoading(false)
  }

  const missingDays = useMemo(() => {
    if (meals.length === 0) return isWeekend(today) ? [] : [today]
    const earliest = [...meals].sort((a, b) => a.meal_date.localeCompare(b.meal_date))[0].meal_date
    return getMissingDays(meals, earliest)
  }, [meals, today])

  const filteredMeals = useMemo(() => {
    return meals.filter(m => {
      if (filterFrom && m.meal_date < filterFrom) return false
      if (filterTo   && m.meal_date > filterTo)   return false
      if (filterText && !m.meal_text.toLowerCase().includes(filterText.toLowerCase())) return false
      return true
    })
  }, [meals, filterFrom, filterTo, filterText])

  const hasFilters = filterFrom || filterTo || filterText
  const todayFilled = meals.some(m => m.meal_date === today)

  async function saveMeal(data) {
    if (editMeal) {
      const { error } = await supabase.from('dinner_meals').update(data).eq('id', editMeal.id)
      if (error) { toast.error('שגיאה בשמירה'); return }
      toast.success('עודכן')
    } else {
      const { error } = await supabase.from('dinner_meals').insert({ ...data, user_id: user.id })
      if (error) {
        toast.error(error.code === '23505' ? 'כבר קיימת ארוחה לתאריך זה' : 'שגיאה בשמירה')
        return
      }
      toast.success('נשמר! 🍽')
    }
    setShowAdd(false); setEditMeal(null); setAddForDate(null)
    load()
  }

  async function deleteMeal(id) {
    const { error } = await supabase.from('dinner_meals').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    toast.success('נמחק')
    setEditMeal(null)
    load()
  }

  async function mergeMeals(fromText, toText) {
    const { error } = await supabase
      .from('dinner_meals')
      .update({ meal_text: toText })
      .eq('user_id', user.id)
      .ilike('meal_text', fromText)
    if (error) { toast.error('שגיאה במיזוג'); return }
    toast.success(`מוזג: ${fromText} → ${toText}`)
    load()
  }

  function openAdd(date = null) {
    setAddForDate(date)
    setEditMeal(null)
    setShowAdd(true)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'2px solid rgba(139,92,246,0.3)', borderTopColor:'#8b5cf6', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem', paddingBottom:'5rem' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
        <div style={{ width:36, height:36, borderRadius:'0.75rem', background:'linear-gradient(135deg,#f97316,#fb923c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>🍽️</div>
        <div style={{ flex:1 }}>
          <h1 style={{ margin:0, fontSize:'1.4rem', fontWeight:700, color:'#e2e8f0' }}>ארוחות ערב</h1>
          <p style={{ margin:0, fontSize:'0.75rem', color:'#64748b' }}>{meals.length} ארוחות מתועדות</p>
        </div>
        {/* Bell with missing-days badge */}
        <button
          onClick={() => setShowMissing(true)}
          style={{ position:'relative', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'0.75rem', padding:'0.5rem 0.625rem', cursor:'pointer', color:'#94a3b8', display:'flex', alignItems:'center' }}>
          <Bell size={18}/>
          {missingDays.length > 0 && (
            <span style={{ position:'absolute', top:-6, right:-6, background:'#ef4444', color:'#fff', borderRadius:9999, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700, padding:'0 3px', lineHeight:1 }}>
              {missingDays.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display:'flex', gap:'0.625rem' }}>
        <button onClick={() => openAdd()} className="btn-primary" style={{ flex:1, justifyContent:'center', gap:'0.375rem' }}>
          <Plus size={16}/> הוסף ארוחה
        </button>
        <button
          onClick={() => setShowSmart(true)}
          style={{ flex:1, justifyContent:'center', display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.625rem 1rem', borderRadius:'0.875rem', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)', color:'#fbbf24', cursor:'pointer', fontSize:'0.875rem', fontWeight:600 }}>
          <ChefHat size={16}/> ארוחות חכמות
        </button>
      </div>

      {/* ── Today status ── */}
      {!isWeekend(today) && (
        <div style={{
          padding:'0.875rem 1rem', borderRadius:'1rem',
          background: todayFilled ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${todayFilled ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
          display:'flex', alignItems:'center', gap:'0.75rem',
        }}>
          <span style={{ fontSize:'1.25rem' }}>{todayFilled ? '✅' : '⏳'}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'0.875rem', fontWeight:600, color: todayFilled ? '#4ade80' : '#f87171' }}>
              {todayFilled ? 'ארוחת הערב מולאה' : 'הערב עדיין לא מולא'}
            </div>
            {todayFilled && (
              <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:2 }}>
                {meals.find(m => m.meal_date === today)?.meal_text}
              </div>
            )}
          </div>
          {!todayFilled && (
            <button onClick={() => openAdd(today)} className="btn-primary" style={{ padding:'0.375rem 0.75rem', fontSize:'0.8rem' }}>
              מלא עכשיו
            </button>
          )}
        </div>
      )}

      {/* ── Active filter bar ── */}
      {hasFilters && (
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', padding:'0.625rem 0.875rem', borderRadius:'0.75rem', background:'rgba(108,99,255,0.08)', border:'1px solid rgba(108,99,255,0.2)' }}>
          <span style={{ fontSize:'0.75rem', color:'#a78bfa' }}>מסנן:</span>
          {filterText && <span style={{ fontSize:'0.75rem', color:'#e2e8f0', background:'rgba(108,99,255,0.15)', padding:'0.125rem 0.5rem', borderRadius:9999 }}>"{filterText}"</span>}
          {filterFrom && <span style={{ fontSize:'0.75rem', color:'#e2e8f0', background:'rgba(108,99,255,0.15)', padding:'0.125rem 0.5rem', borderRadius:9999 }}>מ-{filterFrom}</span>}
          {filterTo   && <span style={{ fontSize:'0.75rem', color:'#e2e8f0', background:'rgba(108,99,255,0.15)', padding:'0.125rem 0.5rem', borderRadius:9999 }}>עד-{filterTo}</span>}
          <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterText('') }}
            style={{ marginRight:'auto', fontSize:'0.7rem', color:'#64748b', background:'none', border:'none', cursor:'pointer' }}>
            נקה <X size={10} style={{ display:'inline-block', verticalAlign:'middle' }}/>
          </button>
        </div>
      )}

      {/* ── Meals list ── */}
      {filteredMeals.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem 1rem', color:'#475569' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🍽️</div>
          <div style={{ fontWeight:600, color:'#64748b', marginBottom:'0.375rem' }}>
            {hasFilters ? 'אין תוצאות לסינון זה' : 'אין ארוחות עדיין'}
          </div>
          <div style={{ fontSize:'0.85rem' }}>
            {hasFilters ? 'נסה לשנות את הסינון' : 'לחץ "הוסף ארוחה" כדי להתחיל'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
          {filteredMeals.map(m => (
            <div
              key={m.id}
              onClick={() => setEditMeal(m)}
              style={{ padding:'0.875rem 1rem', borderRadius:'1rem', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:'0.875rem', transition:'background 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor='rgba(108,99,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)' }}
            >
              <div style={{ width:38, height:38, borderRadius:'0.75rem', background:'linear-gradient(135deg,rgba(249,115,22,0.2),rgba(251,146,60,0.15))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.15rem', flexShrink:0 }}>🍽</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, color:'#e2e8f0', fontSize:'0.9rem', marginBottom:'0.2rem' }}>{m.meal_text}</div>
                <div style={{ fontSize:'0.75rem', color:'#64748b', marginBottom: m.rating || m.notes ? '0.375rem' : 0 }}>
                  {formatDateHebrew(m.meal_date)}
                </div>
                {m.rating > 0 && <StarRating value={m.rating} size={13}/>}
                {m.notes && <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.25rem', fontStyle:'italic' }}>{m.notes}</div>}
              </div>
              <Edit2 size={14} color="#475569" style={{ flexShrink:0, marginTop:4 }}/>
            </div>
          ))}
        </div>
      )}

      {/* ── FAB filter button ── */}
      <button
        onClick={() => setShowFilter(f => !f)}
        style={{
          position:'fixed', bottom:'5rem', left:'1rem', zIndex:500,
          width:46, height:46, borderRadius:'50%',
          background: hasFilters ? '#6c63ff' : 'rgba(30,30,58,0.95)',
          border: `1px solid ${hasFilters ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
          boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          color: hasFilters ? '#fff' : '#94a3b8',
        }}>
        <SlidersHorizontal size={18}/>
      </button>

      {/* ── Filter slide-up panel ── */}
      {showFilter && (
        <div style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:600,
          background:'#1e1e3a', border:'1px solid rgba(108,99,255,0.25)',
          borderRadius:'1.5rem 1.5rem 0 0',
          padding:'1.25rem',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.4)',
          animation:'slideUp 0.25s ease-out',
        }}>
          <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <h3 style={{ margin:0, fontSize:'0.95rem', fontWeight:700, color:'#e2e8f0' }}>סינון ארוחות</h3>
            <button onClick={() => setShowFilter(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div>
              <label style={{ fontSize:'0.75rem', color:'#94a3b8', display:'block', marginBottom:'0.25rem' }}>חיפוש טקסט</label>
              <input className="input-field" value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="חפש ארוחה..."/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.625rem' }}>
              <div>
                <label style={{ fontSize:'0.75rem', color:'#94a3b8', display:'block', marginBottom:'0.25rem' }}>מתאריך</label>
                <input className="input-field" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}/>
              </div>
              <div>
                <label style={{ fontSize:'0.75rem', color:'#94a3b8', display:'block', marginBottom:'0.25rem' }}>עד תאריך</label>
                <input className="input-field" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.625rem', marginTop:'0.25rem' }}>
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterText(''); setShowFilter(false) }} className="btn-ghost" style={{ flex:1 }}>נקה הכל</button>
              <button onClick={() => setShowFilter(false)} className="btn-primary" style={{ flex:1 }}>החל</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {(showAdd || editMeal) && (
        <MealModal
          meal={editMeal}
          defaultDate={addForDate || today}
          onSave={saveMeal}
          onDelete={deleteMeal}
          onClose={() => { setShowAdd(false); setEditMeal(null); setAddForDate(null) }}
        />
      )}
      {showMissing && (
        <MissingDaysModal
          missing={missingDays}
          onFill={date => { setShowMissing(false); openAdd(date) }}
          onClose={() => setShowMissing(false)}
        />
      )}
      {showSmart && (
        <SmartMealsView
          meals={meals}
          onMerge={mergeMeals}
          onClose={() => setShowSmart(false)}
        />
      )}
    </div>
  )
}
