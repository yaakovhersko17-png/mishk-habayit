import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import { useRealtime } from '../hooks/useRealtime'
import toast from 'react-hot-toast'

const COLORS = ['#4CAF50','#2196F3','#FF9800','#E91E63','#00BCD4','#9C27B0','#FF5722','#607D8B','#8BC34A','#6c63ff','#f87171','#fbbf24','#60a5fa','#f472b6','#34d399']
const emptyForm = { name: '', icon: '', color: '#6c63ff', type: 'expense', parent_id: '' }

function CatRow({ c, txCounts, onClick, onEdit, onDelete, editMode }) {
  const total = txCounts[c.id]?.total || 0
  const count = txCounts[c.id]?.count || 0
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        padding: '0.75rem 1rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Icon — right side (flex-start in RTL) */}
      <div style={{ width: 44, height: 44, borderRadius: '0.875rem', background: `${c.color}22`, border: `1px solid ${c.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
        {c.icon}
      </div>
      {/* Name + amount — center (flex:1) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
        <div style={{ fontSize: '0.72rem', marginTop: '0.1rem' }}>
          <span style={{ color: count > 0 ? (c.type === 'income' ? 'var(--c-income)' : 'var(--c-expense)') : 'var(--text-dim)' }}>
            {count > 0 ? `₪${total.toLocaleString()}` : '₪0'}
          </span>
          {count > 0 && <span style={{ color: 'var(--text-dim)', marginRight: '0.3rem' }}>• {count} טרנ׳</span>}
        </div>
      </div>
      {/* Edit/delete — only in editMode */}
      {editMode && (
        <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.3rem', borderRadius: '0.375rem' }}><Edit2 size={13} /></button>
          <button onClick={() => onDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0.3rem', borderRadius: '0.375rem' }}><Trash2 size={13} /></button>
        </div>
      )}
      {/* Chevron — left side (flex-end in RTL), visible when navigable */}
      {onClick && !editMode && <ChevronLeft size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />}
    </div>
  )
}

export default function Categories() {
  const { user, profile } = useAuth()
  const [cats, setCats] = useState([])
  const [txCounts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selectedParent, setSelectedParent] = useState(null)
  const [editMode, setEditMode]             = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime('categories', load)

  async function load() {
    const [{ data: cData }, { data: txData }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('transactions').select('category_id, amount'),
    ])
    setCats(cData || [])
    const counts = {}
    ;(txData || []).forEach(t => {
      if (t.category_id) {
        if (!counts[t.category_id]) counts[t.category_id] = { count: 0, total: 0 }
        counts[t.category_id].count++
        counts[t.category_id].total += Number(t.amount)
      }
    })
    setCounts(counts)
    setLoading(false)
  }

  function openAdd(parentId = '') { setEditing(null); setForm({ ...emptyForm, parent_id: parentId }); setModal(true) }
  function openEdit(c) { setEditing(c); setForm({ name: c.name, icon: c.icon, color: c.color, type: c.type, parent_id: c.parent_id || '' }); setModal(true) }

  async function handleSave() {
    if (!form.name) { toast.error('שם קטגוריה נדרש'); return }
    setSaving(true)
    const saveData = { ...form, parent_id: form.parent_id || null }
    if (editing) {
      await supabase.from('categories').update(saveData).eq('id', editing.id)
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.UPDATE, entityType: ENTITY_TYPES.CATEGORY, description: `עדכן/ה קטגוריה: ${form.name}`, entityId: editing.id })
      toast.success('עודכן!')
    } else {
      await supabase.from('categories').insert({ ...saveData, created_by: user.id })
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.CREATE, entityType: ENTITY_TYPES.CATEGORY, description: `הוסיף/ה קטגוריה: ${form.name}` })
      toast.success('נוסף!')
    }
    setModal(false); load(); setSaving(false)
  }

  async function handleDelete(c) {
    if (!confirm(`למחוק את "${c.name}"?`)) return
    await supabase.from('categories').delete().eq('id', c.id)
    await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.DELETE, entityType: ENTITY_TYPES.CATEGORY, description: `מחק/ה קטגוריה: ${c.name}`, entityId: c.id })
    toast.success('נמחק')
    if (selectedParent?.id === c.parent_id) {
      const updated = cats.filter(x => x.id !== c.id)
      const stillHasKids = updated.some(x => x.parent_id === selectedParent.id)
      if (!stillHasKids) setSelectedParent(null)
    }
    load()
  }

  if (loading) return <LoadingSpinner />

  const parents = cats.filter(c => !c.parent_id)
  const childrenByParent = {}
  cats.filter(c => c.parent_id).forEach(c => {
    if (!childrenByParent[c.parent_id]) childrenByParent[c.parent_id] = []
    childrenByParent[c.parent_id].push(c)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      {selectedParent ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setSelectedParent(null)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}
            >
              <ChevronRight size={16} />חזור
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{selectedParent.icon}</span>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{selectedParent.name}</h1>
            </div>
          </div>
          <button className={editMode ? 'btn-primary' : 'btn-ghost'} onClick={() => setEditMode(v => !v)} style={{ padding: '0.4rem 0.75rem' }}>
            {editMode ? 'סיום' : 'עריכה'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>קטגוריות</h1>
          <button className={editMode ? 'btn-primary' : 'btn-ghost'} onClick={() => setEditMode(v => !v)} style={{ padding: '0.4rem 0.75rem' }}>
            {editMode ? 'סיום' : 'עריכה'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
        {selectedParent ? (
          // Children view
          (() => {
            const children = childrenByParent[selectedParent.id] || []
            if (children.length === 0) return (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
                אין תת-קטגוריות עדיין — לחץ "+ תת-קטגוריה" להוספה
              </div>
            )
            return children.map((c, i) => (
              <div key={c.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <CatRow c={c} txCounts={txCounts} onEdit={openEdit} onDelete={handleDelete} editMode={editMode} />
              </div>
            ))
          })()
        ) : (
          // Parents view
          parents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏷️</div>
              אין קטגוריות עדיין
            </div>
          ) : (
            parents.map((c, i) => {
              const kids = childrenByParent[c.id] || []
              return (
                <div key={c.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <CatRow
                    c={c}
                    txCounts={txCounts}
                    onClick={!editMode && kids.length > 0 ? () => setSelectedParent(c) : undefined}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    editMode={editMode}
                  />
                  {/* Sub-count badge */}
                  {kids.length > 0 && (
                    <div style={{ paddingRight: '4.5rem', paddingBottom: '0.375rem', marginTop: '-0.25rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1rem 0.5rem' }}>
                        {kids.length} תת-קטגוריות
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )
        )}
      </div>

      {/* Floating add button */}
      <button onClick={() => openAdd(selectedParent?.id || '')}
        style={{position:'fixed',bottom:'calc(62px + max(12px, env(safe-area-inset-bottom, 12px)) + 14px)',left:'1.25rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:55,transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <Plus size={24} color="#fff"/>
      </button>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך קטגוריה' : 'קטגוריה חדשה'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שם</label>
            <input className="input-field" placeholder="שם הקטגוריה..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סוג</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[['expense', 'הוצאה'], ['income', 'הכנסה'], ['both', 'שניהם']].map(([k, v]) => (
                <button key={k} onClick={() => setForm({ ...form, type: k })} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', border: `1px solid ${form.type === k ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.08)'}`, background: form.type === k ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.03)', color: form.type === k ? '#a78bfa' : 'var(--text-sub)' }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>קטגוריית הורה</label>
            <select className="input-field" value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}>
              <option value="">ללא הורה (קטגוריית אב)</option>
              {cats.filter(c => (!editing || c.id !== editing.id) && !c.parent_id).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.5rem' }}>אייקון</label>
            <input className="input-field" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="הוסף אמוג׳י 😀" style={{ fontSize: '1.5rem', textAlign: 'center' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.5rem' }}>צבע</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`, cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
