import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Edit2, Trash2, Store } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useRealtime } from '../hooks/useRealtime'
import toast from 'react-hot-toast'

export default function Stores() {
  const [stores, setStores]   = useState([])
  const [txCounts, setTxCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime('stores', load)

  async function load() {
    const [{ data: sData }, { data: txData }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('transactions').select('description,amount,type'),
    ])
    const list = sData || []
    setStores(list)
    const counts = {}
    list.forEach(s => {
      const lc = s.name.toLowerCase()
      ;(txData || [])
        .filter(t => t.type === 'expense' && t.description?.toLowerCase().includes(lc))
        .forEach(t => {
          if (!counts[s.id]) counts[s.id] = { count: 0, total: 0 }
          counts[s.id].count++
          counts[s.id].total += Number(t.amount)
        })
    })
    setTxCounts(counts)
    setLoading(false)
  }

  function openAdd() { setEditing(null); setName(''); setModal(true) }
  function openEdit(s) { setEditing(s); setName(s.name); setModal(true) }

  async function handleSave() {
    if (!name.trim()) { toast.error('שם חנות נדרש'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('stores').update({ name: name.trim() }).eq('id', editing.id)
      toast.success('עודכן!')
    } else {
      await supabase.from('stores').insert({ name: name.trim() })
      toast.success('נוסף!')
    }
    setModal(false); setSaving(false); load()
  }

  async function handleDelete(s) {
    if (!confirm(`למחוק את "${s.name}"?`)) return
    await supabase.from('stores').delete().eq('id', s.id)
    toast.success('נמחק'); load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>חנויות</h1>
        <button className={editMode ? 'btn-primary' : 'btn-ghost'} onClick={() => setEditMode(v => !v)} style={{ padding: '0.4rem 0.75rem' }}>
          {editMode ? 'סיום' : 'עריכה'}
        </button>
      </div>

      <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
        {stores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏪</div>
            אין חנויות עדיין — לחץ + להוספה
          </div>
        ) : (
          stores.map((s, i) => {
            const stat = txCounts[s.id]
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ width: 42, height: 42, borderRadius: '0.875rem', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.875rem', flexShrink: 0 }}>
                  <Store size={20} color="#a78bfa" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '0.05rem', color: stat ? 'var(--c-expense)' : 'var(--text-dim)' }}>
                    {stat ? `₪${stat.total.toLocaleString()} • ${stat.count} עסקאות` : '₪0'}
                  </div>
                </div>
                {editMode && (
                  <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.3rem', borderRadius: '0.375rem' }}><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0.3rem', borderRadius: '0.375rem' }}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <button onClick={openAdd}
        style={{ position: 'fixed', bottom: 'calc(62px + max(12px, env(safe-area-inset-bottom, 12px)) + 14px)', left: '1.25rem', width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#8b5cf6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(108,99,255,0.4)', zIndex: 55, transition: 'transform 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        <Plus size={24} color="#fff" />
      </button>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך חנות' : 'חנות חדשה'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שם חנות</label>
            <input className="input-field" placeholder="לדוגמה: רמי לוי" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
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
