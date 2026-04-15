import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, Target } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { hapticSuccess } from '../lib/haptic'
import toast from 'react-hot-toast'

const ICONS  = ['🎯','🏠','✈️','🚗','💍','📱','🎓','💰','🌴','🏋️','🐕','🎸','💻','👶','🏖️']
const COLORS = ['#6c63ff','#4ade80','#f87171','#fbbf24','#22d3ee','#f472b6','#a78bfa','#34d399','#60a5fa','#fb923c']

const emptyForm = { name: '', icon: '🎯', color: '#6c63ff', target_amount: '', current_amount: '', target_date: '' }

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(emptyForm)
  const [saving, setSaving]   = useState(false)
  const [addModal, setAddModal] = useState(null) // goal to add money to
  const [addAmt, setAddAmt]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
    setGoals(data || [])
    setLoading(false)
  }

  function openAdd()   { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(g) { setEditing(g); setForm({ name: g.name, icon: g.icon, color: g.color, target_amount: g.target_amount, current_amount: g.current_amount, target_date: g.target_date || '' }); setModal(true) }

  async function handleSave() {
    if (!form.name || !form.target_amount) { toast.error('שם וסכום יעד חובה'); return }
    setSaving(true)
    const payload = { name: form.name, icon: form.icon, color: form.color, target_amount: Number(form.target_amount), current_amount: Number(form.current_amount) || 0, target_date: form.target_date || null, user_id: user.id }
    if (editing) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editing.id)
      if (error) { toast.error('שגיאה בעדכון'); setSaving(false); return }
      toast.success('יעד עודכן!')
    } else {
      const { error } = await supabase.from('goals').insert(payload)
      if (error) { toast.error('שגיאה בשמירה'); setSaving(false); return }
      toast.success('יעד נוסף!')
      hapticSuccess()
    }
    setModal(false); setSaving(false); load()
  }

  async function handleDelete(g) {
    if (!confirm(`למחוק את "${g.name}"?`)) return
    await supabase.from('goals').delete().eq('id', g.id)
    toast.success('נמחק')
    load()
  }

  async function handleAddMoney() {
    const amt = Number(addAmt)
    if (!amt || amt <= 0) { toast.error('סכום לא תקין'); return }
    const newAmt = Math.min(Number(addModal.current_amount) + amt, Number(addModal.target_amount))
    await supabase.from('goals').update({ current_amount: newAmt }).eq('id', addModal.id)
    if (newAmt >= Number(addModal.target_amount)) { toast.success('🎉 הגעת ליעד!'); hapticSuccess() }
    else toast.success(`נוסף ₪${amt.toLocaleString()}`)
    setAddModal(null); setAddAmt('')
    load()
  }

  if (loading) return <LoadingSpinner />

  const total    = goals.reduce((s, g) => s + Number(g.target_amount), 0)
  const saved    = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const pct      = total > 0 ? Math.round(saved / total * 100) : 0
  const done     = goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>יעדי חיסכון</h1>
        <button className="btn-primary" onClick={openAdd}><Plus size={14} />יעד חדש</button>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="page-card" style={{ background: 'linear-gradient(135deg,rgba(108,99,255,0.15),rgba(139,92,246,0.08))', borderColor: 'rgba(108,99,255,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>סה"כ נחסך</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>₪{saved.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>מתוך יעד</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--c-primary)' }}>₪{total.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>הושלמו</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--c-income)' }}>{done}/{goals.length}</div>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6c63ff,#a78bfa)' }} />
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{pct}% הושלם</div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="page-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>אין יעדים עדיין</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>הגדר יעד חיסכון ראשון</div>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} />יעד חדש</button>
        </div>
      ) : (
        <div className="stagger-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {goals.map(g => {
            const cur  = Number(g.current_amount)
            const tgt  = Number(g.target_amount)
            const p    = tgt > 0 ? Math.min(cur / tgt * 100, 100) : 0
            const done = cur >= tgt
            const daysLeft = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / 86400000) : null
            return (
              <div key={g.id} className="page-card" style={{ position: 'relative', borderColor: done ? 'var(--c-income-bdr)' : 'var(--border)', background: done ? 'var(--c-income-bg)' : 'var(--surface)' }}>
                {done && <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--c-income)', background: 'var(--c-income-bg)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--c-income-bdr)' }}>הושלם ✓</div>}
                <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '0.875rem', background: `${g.color}20`, border: `1px solid ${g.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{g.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{g.name}</div>
                    <div style={{ display: 'flex', gap: '0.875rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₪{cur.toLocaleString()} / ₪{tgt.toLocaleString()}</span>
                      {daysLeft !== null && <span style={{ fontSize: '0.75rem', color: daysLeft < 0 ? 'var(--c-expense)' : daysLeft < 30 ? 'var(--c-loan)' : 'var(--text-dim)' }}>{daysLeft < 0 ? `עבר ב-${Math.abs(daysLeft)} ימים` : `${daysLeft} ימים נותרו`}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0 }}>
                    {!done && <button onClick={() => { setAddModal(g); setAddAmt('') }} style={{ background: `${g.color}20`, border: `1px solid ${g.color}40`, color: g.color, borderRadius: '0.5rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>+ הוסף</button>}
                    <button onClick={() => openEdit(g)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.3rem' }}><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(g)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-expense)', padding: '0.3rem' }}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${p}%`, background: done ? 'linear-gradient(90deg,var(--c-income),#22c55e)' : `linear-gradient(90deg,${g.color},${g.color}cc)` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  <span>{Math.round(p)}%</span>
                  <span>נשאר: ₪{Math.max(tgt - cur, 0).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך יעד' : 'יעד חדש'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Icon picker */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.5rem' }}>אייקון</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {ICONS.map(ic => <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ width: 36, height: 36, borderRadius: '0.5rem', fontSize: '1.2rem', background: form.icon === ic ? 'rgba(108,99,255,0.2)' : 'var(--surface)', border: `1px solid ${form.icon === ic ? 'rgba(108,99,255,0.5)' : 'var(--border)'}`, cursor: 'pointer' }}>{ic}</button>)}
            </div>
          </div>
          {/* Name */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שם היעד</label>
            <input className="input-field" placeholder="לדוגמה: חיסכון לחופשה" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {/* Amounts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סכום יעד ₪</label>
              <input className="input-field" type="number" placeholder="10000" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>נחסך כבר ₪</label>
              <input className="input-field" type="number" placeholder="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} dir="ltr" />
            </div>
          </div>
          {/* Target date */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תאריך יעד (אופציונלי)</label>
            <input className="input-field" type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} dir="ltr" />
          </div>
          {/* Color */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.5rem' }}>צבע</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {COLORS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`, cursor: 'pointer' }} />)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
          </div>
        </div>
      </Modal>

      {/* Add money modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setAddModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: '1.25rem', padding: '1.5rem', width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>{addModal.icon}</div>
            <div style={{ fontWeight: 700, textAlign: 'center', color: 'var(--text)', marginBottom: '0.25rem' }}>{addModal.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.25rem' }}>₪{Number(addModal.current_amount).toLocaleString()} / ₪{Number(addModal.target_amount).toLocaleString()}</div>
            <input className="input-field" type="number" placeholder="כמה להוסיף?" value={addAmt} onChange={e => setAddAmt(e.target.value)} autoFocus dir="ltr" style={{ marginBottom: '1rem', textAlign: 'center', fontSize: '1.25rem', fontWeight: 600 }} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setAddModal(null)} style={{ flex: 1, justifyContent: 'center' }}>ביטול</button>
              <button className="btn-primary" onClick={handleAddMoney} style={{ flex: 1, justifyContent: 'center' }}>הוסף</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
