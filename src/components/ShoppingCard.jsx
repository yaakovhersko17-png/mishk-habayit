import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'
import { Plus, Check, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORY_KEYWORDS = {
  'ירקות':         ['מלפפון','עגבניה','עגבניות','חסה','גזר','בצל','שום','פלפל','קישוא','חציל','תפוח אדמה','בטטה','כרוב','ברוקולי','פטריות','צנון','תרד','כרובית','אספרגוס','כרישה'],
  'פירות':         ['תפוח','בננה','אבוקדו','לימון','תפוז','ענבים','אבטיח','מלון','תות','מנגו','אגס','אפרסק','קיווי','אננס','שזיף','דובדבן','רימון'],
  'מוצרי חלב':    ['חלב','גבינה','יוגורט','חמאה','שמנת','קוטג','לבן','ביצים','ביצה','שמנת חמוצה'],
  'בשר ודגים':    ['עוף','בקר','כבש','דג','סלמון','טונה','נקניק','המבורגר','קציצות','שניצל','סטייק','כרעיים','חזה','בשר','כבד','קבב'],
  'לחם ומאפים':   ['לחם','פיתה','בגט','חלה','קרקר','עוגיות','לחמניה','בייגל','קרואסון','טוסט'],
  'שימורים':      ['שעועית','חומוס','תירס','זיתים','ממרח','רסק','פסטה רוטב','דלעת'],
  'קפואים':       ['גלידה','אפונה קפואה','תירס קפוא','שניצל קפוא'],
  'משקאות':       ['מים','מיץ','קפה','תה','קולה','בירה','יין','שוקו','ספרייט','פאנטה','רד בול','נקטר'],
  'ניקיון':       ['סבון','שמפו','מרכך','אבקת כביסה','נייר טואלט','ממחטות','מגבון','נוזל כלים','אקונומיקה','ספוג כלים','דטרגנט'],
  'חטיפים ומתוקים':['שוקולד','ביסלי','במבה','קלוב','עוגה','ממתק','גומי','קריספי','פופקורן','חטיף','וופל','קרמבו'],
  'דגנים ופסטה':  ['אורז','פסטה','קוסקוס','עדשים','קינואה','שיבולת שועל','קמח','סוכר','שעועית יבשה','כוסמת'],
  'כלי בית':      ['פטיש','מסמר','ברגים','סרט','מטאטא','נורה','מתאם','סוללה','פח','ברז','נייר כסף'],
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
  const [items, setItems]         = useState([])
  const [addOpen, setAddOpen]     = useState(false)
  const [newName, setNewName]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [activeId, setActiveId]   = useState(null)
  const [movingItem, setMovingItem] = useState(null)
  const inputRef     = useRef(null)
  const longTimer    = useRef(null)

  useEffect(() => { load() }, [])
  useRealtime('shopping_items', load)

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
    const { error } = await supabase.from('shopping_items').insert({
      name,
      category: categorize(name),
    })
    if (error) toast.error('שגיאה בהוספה')
    setNewName('')
    setAddOpen(false)
    setSaving(false)
  }

  async function toggleDone(id, done) {
    await supabase.from('shopping_items').update({ done: !done }).eq('id', id)
  }

  async function deleteItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id)
    setActiveId(null)
  }

  async function moveCat(item, newCat) {
    saveOverride(item.name, newCat)
    await supabase.from('shopping_items').update({ category: newCat }).eq('id', item.id)
    setMovingItem(null)
  }

  function onTouchStart(item) {
    longTimer.current = setTimeout(() => { setMovingItem(item); setActiveId(null) }, 500)
  }
  function onTouchEnd() { clearTimeout(longTimer.current) }

  // group by category
  const grouped = {}
  items.forEach(it => { if (!grouped[it.category]) grouped[it.category] = []; grouped[it.category].push(it) })
  const done = items.filter(i => i.done).length

  return (
    <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🛒</span>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>רשימת קניות</span>
          {items.length > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '0.1rem 0.45rem' }}>
              {done}/{items.length}
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

      {/* List */}
      <div style={{ maxHeight: 252, overflowY: 'auto', padding: '0.375rem 0' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            רשימה ריקה — לחץ + להוסיף 🛍️
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <div style={{ padding: '0.3rem 1rem 0.1rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>
                {cat}
              </div>
              {catItems.map(item => (
                <div
                  key={item.id}
                  className="shopping-item"
                  style={{ background: activeId === item.id ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                  onClick={() => setActiveId(activeId === item.id ? null : item.id)}
                  onTouchStart={() => onTouchStart(item)}
                  onTouchEnd={onTouchEnd}
                  onTouchMove={onTouchEnd}
                >
                  {/* Circle checkbox */}
                  <div
                    onClick={e => { e.stopPropagation(); toggleDone(item.id, item.done) }}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                      border: item.done ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.22)',
                      background: item.done ? 'rgba(74,222,128,0.18)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {item.done && <Check size={11} color="#4ade80" strokeWidth={3} />}
                  </div>

                  {/* Name */}
                  <span style={{
                    flex: 1, fontSize: '0.85rem',
                    color: item.done ? 'var(--text-muted)' : 'var(--text)',
                    textDecoration: item.done ? 'line-through' : 'none',
                    transition: 'color 0.2s',
                  }}>
                    {item.name}
                  </span>

                  {/* Inline action buttons */}
                  {activeId === item.id && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { toggleDone(item.id, item.done); setActiveId(null) }}
                        style={{ padding: '0.18rem 0.45rem', borderRadius: '0.4rem', fontSize: '0.68rem', cursor: 'pointer', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                      >
                        {item.done ? 'בטל' : '✓ בוצע'}
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        style={{ padding: '0.18rem 0.4rem', borderRadius: '0.4rem', fontSize: '0.68rem', cursor: 'pointer', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Add modal — bottom sheet */}
      {addOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setAddOpen(false)}
        >
          <div
            style={{ background: '#1a1a2e', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.25rem 1.25rem 2rem', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
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

      {/* Move-to-category bottom sheet (long press) */}
      {movingItem && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setMovingItem(null)}
        >
          <div
            style={{ background: '#1a1a2e', borderRadius: '1.25rem 1.25rem 0 0', padding: '1.25rem 1.25rem 2rem', width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.875rem', color: 'var(--text)', fontSize: '0.9rem' }}>
              העבר "<span style={{ color: '#a78bfa' }}>{movingItem.name}</span>" לקטגוריה:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {ALL_CATS.map(cat => (
                <button
                  key={cat}
                  onClick={() => moveCat(movingItem, cat)}
                  style={{
                    padding: '0.38rem 0.75rem', borderRadius: '0.75rem', fontSize: '0.78rem', cursor: 'pointer',
                    background: cat === movingItem.category ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${cat === movingItem.category ? 'rgba(108,99,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
                    color: cat === movingItem.category ? '#a78bfa' : 'var(--text)',
                    fontWeight: cat === movingItem.category ? 600 : 400,
                  }}
                >
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
