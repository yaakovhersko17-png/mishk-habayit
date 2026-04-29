import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'
import { Plus, Check, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORY_KEYWORDS = {
  'ירקות':           ['מלפפון','עגבניה','עגבניות','חסה','גזר','בצל','שום','פלפל','קישוא','חציל','תפוח אדמה','בטטה','כרוב','ברוקולי','פטריות','צנון','תרד','כרובית','אספרגוס','כרישה'],
  'פירות':           ['תפוח','בננה','אבוקדו','לימון','תפוז','ענבים','אבטיח','מלון','תות','מנגו','אגס','אפרסק','קיווי','אננס','שזיף','דובדבן','רימון'],
  'מוצרי חלב':      ['חלב','גבינה','יוגורט','חמאה','שמנת','קוטג','לבן','ביצים','ביצה','שמנת חמוצה'],
  'בשר ודגים':      ['עוף','בקר','כבש','דג','סלמון','טונה','נקניק','המבורגר','קציצות','שניצל','סטייק','כרעיים','חזה','בשר','כבד','קבב'],
  'לחם ומאפים':     ['לחם','פיתה','בגט','חלה','קרקר','עוגיות','לחמניה','בייגל','קרואסון','טוסט'],
  'שימורים':        ['שעועית','חומוס','תירס','זיתים','ממרח','רסק','פסטה רוטב','דלעת'],
  'קפואים':         ['גלידה','אפונה קפואה','תירס קפוא','שניצל קפוא'],
  'משקאות':         ['מים','מיץ','קפה','תה','קולה','בירה','יין','שוקו','ספרייט','פאנטה','רד בול','נקטר'],
  'ניקיון':         ['סבון','שמפו','מרכך','אבקת כביסה','נייר טואלט','ממחטות','מגבון','נוזל כלים','אקונומיקה','ספוג כלים','דטרגנט'],
  'חטיפים ומתוקים': ['שוקולד','ביסלי','במבה','קלוב','עוגה','ממתק','גומי','קריספי','פופקורן','חטיף','וופל','קרמבו'],
  'דגנים ופסטה':    ['אורז','פסטה','קוסקוס','עדשים','קינואה','שיבולת שועל','קמח','סוכר','שעועית יבשה','כוסמת'],
  'כלי בית':        ['פטיש','מסמר','ברגים','מברג','סרט','מטאטא','נורה','מתאם','סוללה','פח','ברז','נייר כסף'],
}

const ALL_CATS = [...Object.keys(CATEGORY_KEYWORDS), 'אחר']

function categorize(name) {
  try {
    const overrides = JSON.parse(localStorage.getItem('shopping_overrides') || '{}')
    const lower = name.toLowerCase()
    for (const [key, cat] of Object.entries(overrides)) {
      if (lower.includes(key)) return cat
    }
  } catch {}
  const lower = name.toLowerCase()
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) return cat
  }
  return 'אחר'
}

function saveOverride(name, cat) {
  try {
    const o = JSON.parse(localStorage.getItem('shopping_overrides') || '{}')
    o[name.toLowerCase()] = cat
    localStorage.setItem('shopping_overrides', JSON.stringify(o))
  } catch {}
}

export default function ShoppingCard() {
  const [items, setItems]           = useState([])
  const [addOpen, setAddOpen]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [activeId, setActiveId]     = useState(null)   // which tag shows actions
  const [movingItem, setMovingItem] = useState(null)   // long-press category picker
  const inputRef  = useRef(null)
  const longTimer = useRef(null)

  // loadRef prevents stale closure in useRealtime callback
  const loadRef = useRef(null)
  loadRef.current = load

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime('shopping_items', () => loadRef.current())

  async function load() {
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .order('created_at', { ascending: true })
    setItems(data || [])
  }

  async function addItem() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)

    // Optimistic: show immediately, no wait for DB
    const tempId = `opt-${Date.now()}`
    const optimistic = { id: tempId, name, category: categorize(name), done: false, created_at: new Date().toISOString() }
    setItems(prev => [...prev, optimistic])
    setNewName('')
    setAddOpen(false)
    setSaving(false)

    const { error } = await supabase.from('shopping_items').insert({ name, category: categorize(name) })
    if (error) {
      toast.error('שגיאה בהוספה')
      setItems(prev => prev.filter(i => i.id !== tempId))
    } else {
      load() // sync real UUID from DB, replace optimistic
    }
  }

  async function toggleDone(id, done) {
    setActiveId(null)
    // Optimistic
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !done } : i))
    await supabase.from('shopping_items').update({ done: !done }).eq('id', id)
  }

  async function deleteItem(id) {
    setActiveId(null)
    // Optimistic
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('shopping_items').delete().eq('id', id)
  }

  async function moveCat(item, newCat) {
    saveOverride(item.name, newCat)
    // Optimistic
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, category: newCat } : i))
    setMovingItem(null)
    await supabase.from('shopping_items').update({ category: newCat }).eq('id', item.id)
  }

  function onTouchStart(item) {
    longTimer.current = setTimeout(() => { setMovingItem(item); setActiveId(null) }, 500)
  }
  function onTouchEnd() { clearTimeout(longTimer.current) }

  // Group: { category -> [items] }
  const grouped = {}
  items.forEach(it => {
    if (!grouped[it.category]) grouped[it.category] = []
    grouped[it.category].push(it)
  })

  const total = items.length
  const done  = items.filter(i => i.done).length

  return (
    <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🛒</span>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>רשימת קניות</span>
          {total > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '0.1rem 0.45rem' }}>
              {done}/{total}
            </span>
          )}
        </div>
        <button
          onClick={() => { setAddOpen(true); setTimeout(() => inputRef.current?.focus(), 60) }}
          style={{ width: 28, height: 28, borderRadius: '0.5rem', background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.35)', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* ── List body — fixed height, scroll ── */}
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: '0.25rem 0' }}
        onClick={() => setActiveId(null)}>
        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            רשימה ריקה — לחץ + להוסיף 🛍️
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.45rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.035)' }}
              onClick={e => e.stopPropagation()}>

              {/* Category label — fixed width, right side */}
              <div style={{ minWidth: 68, maxWidth: 68, fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', paddingTop: '0.3rem', textAlign: 'right', flexShrink: 0, letterSpacing: '0.02em' }}>
                {cat}
              </div>

              {/* Product tags — wrap horizontally */}
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                {catItems.map(item => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    {/* Tag */}
                    <button
                      className="shopping-tag"
                      onTouchStart={() => onTouchStart(item)}
                      onTouchEnd={onTouchEnd}
                      onTouchMove={onTouchEnd}
                      onClick={e => { e.stopPropagation(); setActiveId(activeId === item.id ? null : item.id) }}
                      style={{
                        padding: '0.22rem 0.6rem',
                        borderRadius: '1rem',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        background: item.done ? 'rgba(74,222,128,0.1)' : activeId === item.id ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${item.done ? 'rgba(74,222,128,0.3)' : activeId === item.id ? 'rgba(108,99,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                        color: item.done ? '#4ade80' : 'var(--text)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        transition: 'all 0.13s',
                        animation: 'shopping-item-in 0.22s ease-out both',
                      }}
                    >
                      {item.done && <Check size={9} strokeWidth={3} color="#4ade80" />}
                      {item.name}
                    </button>

                    {/* Floating action mini-card */}
                    {activeId === item.id && (
                      <div
                        style={{
                          position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 50,
                          background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '0.625rem', padding: '0.35rem 0.45rem',
                          display: 'flex', gap: '0.35rem', whiteSpace: 'nowrap',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          animation: 'shopping-item-in 0.15s ease-out both',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => toggleDone(item.id, item.done)}
                          style={{ padding: '0.22rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.68rem', cursor: 'pointer', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Check size={10} strokeWidth={3} />
                          {item.done ? 'בטל' : 'בוצע'}
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          style={{ padding: '0.22rem 0.4rem', borderRadius: '0.4rem', fontSize: '0.68rem', cursor: 'pointer', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={10} />
                        </button>
                        <button
                          onClick={() => setActiveId(null)}
                          style={{ padding: '0.22rem 0.35rem', borderRadius: '0.4rem', fontSize: '0.68rem', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Add bottom sheet ── */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setAddOpen(false)}>
          <div style={{ background: '#1a1a2e', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.25rem 1.25rem 2rem', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, marginBottom: '0.875rem', color: 'var(--text)', fontSize: '0.95rem' }}>הוסף מוצר</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="שם המוצר..."
                className="input-field"
                style={{ flex: 1 }}
                dir="rtl"
              />
              <button
                onClick={addItem}
                disabled={saving || !newName.trim()}
                className="btn-primary"
                style={{ padding: '0.6rem 1rem', flexShrink: 0 }}
              >
                {saving ? '...' : 'הוסף'}
              </button>
            </div>
            {newName.trim() && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                קטגוריה: <span style={{ color: '#a78bfa', fontWeight: 600 }}>{categorize(newName.trim())}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Category picker (long press) ── */}
      {movingItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setMovingItem(null)}>
          <div style={{ background: '#1a1a2e', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.25rem 1.25rem 2rem', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, marginBottom: '0.875rem', color: 'var(--text)', fontSize: '0.9rem' }}>
              העבר "<span style={{ color: '#a78bfa' }}>{movingItem.name}</span>" לקטגוריה:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {ALL_CATS.map(cat => (
                <button key={cat} onClick={() => moveCat(movingItem, cat)}
                  style={{
                    padding: '0.38rem 0.75rem', borderRadius: '0.75rem', fontSize: '0.78rem', cursor: 'pointer',
                    background: cat === movingItem.category ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${cat === movingItem.category ? 'rgba(108,99,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
                    color: cat === movingItem.category ? '#a78bfa' : 'var(--text)',
                    fontWeight: cat === movingItem.category ? 600 : 400,
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
