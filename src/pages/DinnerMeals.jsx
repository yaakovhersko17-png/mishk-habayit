/**
 * DinnerMeals — ארוחות ערב tracking page
 *
 * Supabase setup:
 *
 * -- Run in Supabase SQL Editor:
 * -- CREATE TABLE dinner_meals (
 * --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 * --   user_id UUID REFERENCES auth.users(id),
 * --   meal_text TEXT NOT NULL,
 * --   meal_date DATE NOT NULL,
 * --   rating INTEGER CHECK (rating >= 1 AND rating <= 5),
 * --   notes TEXT,
 * --   created_at TIMESTAMPTZ DEFAULT now(),
 * --   UNIQUE(meal_date)
 * -- );
 * -- CREATE INDEX ON dinner_meals(meal_date);
 * -- ALTER TABLE dinner_meals ENABLE ROW LEVEL SECURITY;
 * -- CREATE POLICY "auth_all" ON dinner_meals FOR ALL TO authenticated USING (true) WITH CHECK (true);
 */

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Star, ChefHat, X, SlidersHorizontal, Edit2, BarChart2, GitMerge, TrendingDown, SkipForward } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

// ─── Helper functions ────────────────────────────────────────────────────────

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
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0') % 24
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return { hour, minute }
}

function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 5 || day === 6
}

function getMissingDays(meals, startDate) {
  const mealDates = new Set(meals.map(m => m.meal_date))
  const result = []
  const today = israeliToday()
  const cursor = new Date(startDate + 'T12:00:00')
  const end = new Date(today + 'T12:00:00')

  while (cursor <= end) {
    const dateStr = new Intl.DateTimeFormat('en-CA').format(cursor)
    if (!isWeekend(dateStr) && !mealDates.has(dateStr)) {
      result.push(dateStr)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

function formatDateHebrew(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 18 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          style={{
            cursor: onChange ? 'pointer' : 'default',
            color: n <= value ? '#fbbf24' : 'rgba(255,255,255,0.2)',
            fill: n <= value ? '#fbbf24' : 'transparent',
            transition: 'color 0.15s, fill 0.15s',
          }}
          onClick={
            onChange
              ? () => onChange(n === value ? 0 : n)
              : undefined
          }
        />
      ))}
    </div>
  )
}

// ─── MealModal ────────────────────────────────────────────────────────────────

function MealModal({ meal, defaultDate, onSave, onDelete, onClose }) {
  const isEditing = Boolean(meal)
  const [mealText, setMealText] = useState(meal?.meal_text ?? '')
  const [mealDate, setMealDate] = useState(meal?.meal_date ?? defaultDate ?? israeliToday())
  const [rating, setRating] = useState(meal?.rating ?? 0)
  const [notes, setNotes] = useState(meal?.notes ?? '')

  function handleSave() {
    if (!mealText.trim()) {
      toast.error('חובה למלא מה אכלת')
      return
    }
    onSave({
      meal_text: mealText.trim(),
      meal_date: mealDate,
      rating: rating || null,
      notes: notes.trim() || null,
    })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '3rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
      }}
    >
      <div
        style={{
          background: '#1e1e3a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: '1.5rem',
          width: '100%',
          maxWidth: 420,
          direction: 'rtl',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>
            {isEditing ? 'עריכת ארוחה' : 'הוספת ארוחה'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* מה אכלתי */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: 6 }}>
            מה אכלתי *
          </label>
          <input
            autoFocus
            className="input-field"
            value={mealText}
            onChange={e => setMealText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="לדוגמה: פסטה, שניצל, סלט..."
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* תאריך */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: 6 }}>
            תאריך
          </label>
          <input
            type="date"
            className="input-field"
            value={mealDate}
            onChange={e => setMealDate(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* דירוג */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: 6 }}>
            דירוג (לא חובה)
          </label>
          <StarRating value={rating} onChange={setRating} size={22} />
        </div>

        {/* הערות */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: 6 }}>
            הערות (לא חובה)
          </label>
          <textarea
            className="input-field"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="הערות נוספות..."
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {isEditing && (
            <button
              className="btn-danger"
              onClick={() => onDelete(meal.id)}
              style={{ marginLeft: 'auto' }}
            >
              <X size={16} />
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={handleSave}>
            שמור
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MissingDaysModal ─────────────────────────────────────────────────────────

function MissingDaysModal({ missing, onFill, onSkip, onClose }) {
  const [skipping, setSkipping] = useState(null)

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSkip(date) {
    setSkipping(date)
    await onSkip(date)
    setSkipping(null)
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '3rem', paddingLeft: '1rem', paddingRight: '1rem',
      }}
    >
      <div style={{
        background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 420,
        direction: 'rtl', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>
            ימים חסרים ({missing.length})
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missing.map(date => (
            <div key={date} style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '0.65rem 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{formatDateHebrew(date)}</span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => onFill(date)}
                  style={{
                    padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.3)', color: '#a78bfa',
                  }}>
                  מלא
                </button>
                <button
                  onClick={() => handleSkip(date)}
                  disabled={skipping === date}
                  style={{
                    padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                    cursor: skipping === date ? 'default' : 'pointer', opacity: skipping === date ? 0.5 : 1,
                    background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', color: 'var(--text-muted)',
                  }}>
                  {skipping === date ? '...' : 'דלג'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SmartMealsView ───────────────────────────────────────────────────────────

function SmartMealsView({ meals, onMerge, onClose }) {
  const [mergeState, setMergeState] = useState({})

  const topFrequent = useMemo(() => {
    const counts = {}
    meals.forEach(m => {
      const key = m.meal_text.trim().toLowerCase()
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))
  }, [meals])

  const forgottenMeals = useMemo(() => {
    const lastDate = {}
    meals.forEach(m => {
      const key = m.meal_text.trim().toLowerCase()
      if (!lastDate[key] || m.meal_date > lastDate[key].date) {
        lastDate[key] = { text: m.meal_text.trim(), date: m.meal_date }
      }
    })
    return Object.values(lastDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [meals])

  const dayDistribution = useMemo(() => {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const counts = Array(7).fill(0)
    meals.forEach(m => {
      const day = new Date(m.meal_date + 'T12:00:00').getDay()
      counts[day]++
    })
    return counts.map((count, i) => ({ name: dayNames[i], count }))
  }, [meals])

  const mergeSuggestions = useMemo(() => {
    const uniqueTexts = [...new Set(meals.map(m => m.meal_text.trim()))]
    const pairs = []
    for (let i = 0; i < uniqueTexts.length && pairs.length < 8; i++) {
      for (let j = 0; j < uniqueTexts.length && pairs.length < 8; j++) {
        if (i === j) continue
        const a = uniqueTexts[i]
        const b = uniqueTexts[j]
        if (a.length >= 3 && b.toLowerCase().includes(a.toLowerCase()) && a !== b) {
          const alreadyAdded = pairs.some(
            p => (p.a === a && p.b === b) || (p.a === b && p.b === a)
          )
          if (!alreadyAdded) {
            pairs.push({ a, b })
          }
        }
      }
    }
    return pairs
  }, [meals])

  function handleMerge(from, to) {
    const key = `${from}→${to}`
    setMergeState(prev => ({ ...prev, [key]: to }))
    onMerge(from, to)
  }

  const sectionStyle = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: '1rem',
    marginBottom: '1rem',
  }

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text)',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#0f1117',
        overflowY: 'auto',
        direction: 'rtl',
        padding: '1.5rem 1rem',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.25rem' }}>ארוחות חכמות</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>

        {meals.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
            <ChefHat size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>אין עדיין ארוחות לניתוח</p>
          </div>
        ) : (
          <>
            {/* Top 5 frequent */}
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <Star size={17} color="#fbbf24" fill="#fbbf24" />
                <span>5 הארוחות הנפוצות ביותר</span>
              </div>
              {topFrequent.map((item, idx) => (
                <div
                  key={item.text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0.4rem 0',
                    borderBottom: idx < topFrequent.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#6c63ff', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ flex: 1, color: 'var(--text)', fontSize: '0.9rem' }}>{item.text}</span>
                  <span style={{
                    background: 'rgba(251,191,36,0.15)',
                    color: '#fbbf24',
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}>
                    ×{item.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Forgotten meals */}
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <TrendingDown size={17} color="#ef4444" />
                <span>ארוחות שנשכחו</span>
              </div>
              {forgottenMeals.map((item, idx) => (
                <div
                  key={item.text}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.4rem 0',
                    borderBottom: idx < forgottenMeals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{item.text}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatDateHebrew(item.date)}</span>
                </div>
              ))}
            </div>

            {/* Distribution chart */}
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <BarChart2 size={17} color="#60a5fa" />
                <span>התפלגות לפי יום</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={dayDistribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-sub)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-sub)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text)' }}
                    itemStyle={{ color: '#6c63ff' }}
                  />
                  <Bar dataKey="count" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Merge suggestions */}
            {mergeSuggestions.length > 0 && (
              <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <GitMerge size={17} color="#4ade80" />
                  <span>הצעות למיזוג</span>
                </div>
                {mergeSuggestions.map((pair, idx) => {
                  const keyAtoB = `${pair.a}→${pair.b}`
                  const keyBtoA = `${pair.b}→${pair.a}`
                  const merged = mergeState[keyAtoB] || mergeState[keyBtoA]
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.6rem 0',
                        borderBottom: idx < mergeSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}
                    >
                      <div style={{ color: 'var(--text)', fontSize: '0.88rem', marginBottom: 6 }}>
                        <span>{pair.a}</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>≈</span>
                        <span>{pair.b}</span>
                      </div>
                      {merged ? (
                        <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>✓ ימוזג ל: {merged}</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleMerge(pair.b, pair.a)}
                            style={{
                              background: 'rgba(74,222,128,0.1)',
                              border: '1px solid rgba(74,222,128,0.25)',
                              borderRadius: 6,
                              color: '#4ade80',
                              fontSize: '0.78rem',
                              padding: '3px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            מזג ל: {pair.a}
                          </button>
                          <button
                            onClick={() => handleMerge(pair.a, pair.b)}
                            style={{
                              background: 'rgba(74,222,128,0.1)',
                              border: '1px solid rgba(74,222,128,0.25)',
                              borderRadius: 6,
                              color: '#4ade80',
                              fontSize: '0.78rem',
                              padding: '3px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            מזג ל: {pair.b}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── DinnerMeals (main page) ──────────────────────────────────────────────────

export default function DinnerMeals() {
  const { user } = useAuth()
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editMeal, setEditMeal] = useState(null)
  const [showMissing, setShowMissing] = useState(false)
  const [showSmart, setShowSmart] = useState(false)
  const [addForDate, setAddForDate] = useState(null)
  const [showFilter, setShowFilter] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterText, setFilterText] = useState('')

  const today = israeliToday()
  const todayIsWeekend = isWeekend(today)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('dinner_meals')
      .select('*')
      .order('meal_date', { ascending: false })
    if (error) {
      console.error('DinnerMeals load error:', error)
      toast.error('שגיאה בטעינת ארוחות')
    }
    setMeals(data || [])
    setLoading(false)
  }

  const missingDays = useMemo(() => {
    if (meals.length === 0) {
      return isWeekend(today) ? [] : [today]
    }
    const earliest = [...meals].sort((a, b) => a.meal_date.localeCompare(b.meal_date))[0].meal_date
    return getMissingDays(meals, earliest)
  }, [meals, today])

  const filteredMeals = useMemo(() => {
    return meals.filter(m => {
      if (m.meal_text === '__skip__') return false
      if (filterText && !m.meal_text.toLowerCase().includes(filterText.toLowerCase())) return false
      if (filterFrom && m.meal_date < filterFrom) return false
      if (filterTo && m.meal_date > filterTo) return false
      return true
    })
  }, [meals, filterText, filterFrom, filterTo])

  const hasFilters = Boolean(filterText || filterFrom || filterTo)

  const todayMeal    = meals.find(m => m.meal_date === today && m.meal_text !== '__skip__')
  const todaySkipped = meals.find(m => m.meal_date === today && m.meal_text === '__skip__')

  async function saveMeal(data) {
    let error
    if (editMeal) {
      ;({ error } = await supabase
        .from('dinner_meals')
        .update(data)
        .eq('id', editMeal.id))
    } else {
      ;({ error } = await supabase
        .from('dinner_meals')
        .insert({ ...data, user_id: user.id }))
    }
    if (error) {
      if (error.code === '23505') {
        toast.error('כבר קיימת ארוחה לתאריך זה')
      } else {
        console.error('saveMeal error:', error)
        toast.error('שגיאה בשמירה')
      }
      return
    }
    toast.success(editMeal ? 'ארוחה עודכנה' : 'ארוחה נוספה')
    setShowAdd(false)
    setEditMeal(null)
    setAddForDate(null)
    load()
  }

  async function deleteMeal(id) {
    const { error } = await supabase
      .from('dinner_meals')
      .delete()
      .eq('id', id)
    if (error) {
      toast.error('שגיאה במחיקה')
      return
    }
    toast.success('ארוחה נמחקה')
    setEditMeal(null)
    load()
  }

  async function mergeMeals(fromText, toText) {
    const { error } = await supabase
      .from('dinner_meals')
      .update({ meal_text: toText })
      .eq('meal_text', fromText)
    if (error) {
      toast.error('שגיאה במיזוג')
      return
    }
    toast.success(`מוזג ל: ${toText}`)
    load()
  }

  async function skipDay(date) {
    const { error } = await supabase
      .from('dinner_meals')
      .insert({ meal_date: date, meal_text: '__skip__' })
    if (error) { toast.error('שגיאה בדילוג'); return }
    toast.success(`${date} — סומן כדולג`)
    setShowMissing(false)
    load()
  }

  async function undoSkip(date) {
    await supabase.from('dinner_meals').delete().eq('meal_date', date).eq('meal_text', '__skip__')
    load()
  }

  function openAdd() {
    setAddForDate(null)
    setEditMeal(null)
    setShowAdd(true)
  }

  function handleFillMissing(date) {
    setShowMissing(false)
    setAddForDate(date)
    setShowAdd(true)
  }

  function clearFilters() {
    setFilterText('')
    setFilterFrom('')
    setFilterTo('')
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerStyle = {
    direction: 'rtl',
    padding: '1.25rem 1rem',
    paddingBottom: '5rem',
    maxWidth: 680,
    margin: '0 auto',
    color: 'var(--text)',
  }

  const cardStyle = {
    background: '#1e1e3a',
    borderRadius: 14,
    padding: '1rem 1.1rem',
    marginBottom: '0.6rem',
    border: '1px solid rgba(255,255,255,0.07)',
    cursor: 'pointer',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }

  return (
    <div style={containerStyle}>
      {/* Page title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.6rem' }}>🍽️</span>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)' }}>ארוחות ערב</h1>
        </div>
        {missingDays.length > 0 && (
          <button
            onClick={() => setShowMissing(true)}
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 20,
              padding: '4px 12px',
              cursor: 'pointer',
              color: '#fca5a5',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            {missingDays.length} ימים חסרים
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} />
          הוסף ארוחה
        </button>
        <button
          className="btn-ghost"
          onClick={() => setShowSmart(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ChefHat size={16} />
          ארוחות חכמות
        </button>
      </div>

      {/* Today status card */}
      {!todayIsWeekend && (
        <div
          style={{
            background: todayMeal ? 'rgba(34,197,94,0.1)' : todaySkipped ? 'rgba(100,116,139,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${todayMeal ? 'rgba(34,197,94,0.3)' : todaySkipped ? 'rgba(100,116,139,0.25)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 14,
            padding: '0.9rem 1.1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', color: todayMeal ? '#86efac' : todaySkipped ? 'var(--text-sub)' : '#fca5a5', marginBottom: 2 }}>
              ארוחת היום
            </div>
            {todayMeal ? (
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem' }}>{todayMeal.meal_text}</div>
            ) : todaySkipped ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>דולג — לא בישלנו הערב</div>
            ) : (
              <div style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>לא מולא עדיין</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {!todayMeal && !todaySkipped && (
              <>
                <button
                  className="btn-primary"
                  onClick={() => { setAddForDate(today); setShowAdd(true) }}
                  style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                >
                  מלא עכשיו
                </button>
                <button
                  onClick={() => skipDay(today)}
                  style={{ fontSize: '0.82rem', padding: '6px 12px', borderRadius: 8, background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <SkipForward size={13} />דלג
                </button>
              </>
            )}
            {todaySkipped && (
              <button
                onClick={() => undoSkip(today)}
                style={{ fontSize: '0.8rem', padding: '5px 12px', borderRadius: 8, background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', color: '#a78bfa', cursor: 'pointer' }}
              >
                בטל דילוג
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active filter bar */}
      {hasFilters && (
        <div
          style={{
            background: 'rgba(108,99,255,0.1)',
            border: '1px solid rgba(108,99,255,0.25)',
            borderRadius: 10,
            padding: '0.5rem 0.9rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            color: '#a5b4fc',
          }}
        >
          <span>
            {[
              filterText && `חיפוש: "${filterText}"`,
              filterFrom && `מ: ${filterFrom}`,
              filterTo && `עד: ${filterTo}`,
            ].filter(Boolean).join(' · ')}
          </span>
          <button
            onClick={clearFilters}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', padding: 0, fontSize: '0.82rem' }}
          >
            נקה
          </button>
        </div>
      )}

      {/* Meals list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>טוען...</div>
      ) : filteredMeals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem', opacity: 0.3 }}>🍽️</span>
          {hasFilters ? 'לא נמצאו ארוחות לפי הסינון' : 'עוד לא נוספו ארוחות'}
        </div>
      ) : (
        filteredMeals.map(meal => (
          <div
            key={meal.id}
            style={cardStyle}
            onClick={() => setEditMeal(meal)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = '#1e1e3a'}
          >
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🍽</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {meal.meal_text}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: meal.rating ? 4 : 0 }}>
                {formatDateHebrew(meal.meal_date)}
              </div>
              {meal.rating > 0 && <StarRating value={meal.rating} size={13} />}
              {meal.notes && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', fontStyle: 'italic', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meal.notes}
                </div>
              )}
            </div>
            <Edit2 size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        ))
      )}

      {/* FAB — filter button */}
      <button
        onClick={() => setShowFilter(v => !v)}
        style={{
          position: 'fixed',
          bottom: '5rem',
          left: '1rem',
          width: 46,
          height: 46,
          borderRadius: '50%',
          cursor: 'pointer',
          background: hasFilters ? '#6c63ff' : '#1e1e3a',
          border: `1px solid ${hasFilters ? '#6c63ff' : 'rgba(255,255,255,0.15)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 100,
          transition: 'background 0.2s',
        }}
      >
        <SlidersHorizontal size={18} color={hasFilters ? '#fff' : 'var(--text-sub)'} />
      </button>

      {/* Filter slide-up panel */}
      {showFilter && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#1e1e3a',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '18px 18px 0 0',
            padding: '1.25rem 1rem 2rem',
            zIndex: 200,
            direction: 'rtl',
            animation: 'slideUp 0.22s ease',
          }}
        >
          <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>סינון ארוחות</div>
          <input
            className="input-field"
            placeholder="חיפוש לפי שם..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>מתאריך</label>
              <input
                type="date"
                className="input-field"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>עד תאריך</label>
              <input
                type="date"
                className="input-field"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={clearFilters}>נקה הכל</button>
            <button className="btn-primary" onClick={() => setShowFilter(false)}>החל</button>
          </div>
        </div>
      )}

      {/* Modals */}
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
          onFill={handleFillMissing}
          onSkip={skipDay}
          onClose={() => setShowMissing(false)}
        />
      )}
      {showSmart && (
        <SmartMealsView
          meals={meals.filter(m => m.meal_text !== '__skip__')}
          onMerge={mergeMeals}
          onClose={() => setShowSmart(false)}
        />
      )}
    </div>
  )
}
