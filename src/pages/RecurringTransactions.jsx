import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const TYPE_LABELS = { income: 'הכנסה', expense: 'הוצאה' }
const TYPE_COLORS = { income: 'var(--c-income)', expense: 'var(--c-expense)' }

const emptyForm = {
  description: '', amount: '', type: 'expense',
  currency: '₪', category_id: '', wallet_id: '',
  day_of_month: 1
}

function currentMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function RecurringTransactions() {
  const { user } = useAuth()
  const [rules, setRules]       = useState([])
  const [cats, setCats]         = useState([])
  const [wallets, setWallets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [running, setRunning]   = useState(false)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(emptyForm)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    loadAll().then(() => autoRun())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    const [{ data: rData }, { data: cData }, { data: wData }] = await Promise.all([
      supabase.from('recurring_rules').select('*').order('day_of_month'),
      supabase.from('categories').select('id,name,icon,color,type'),
      supabase.from('wallets').select('id,name,balance'),
    ])
    setRules(rData || [])
    setCats(cData || [])
    setWallets(wData || [])
    setLoading(false)
  }

  // Auto-insert overdue rules for current month
  async function autoRun(silent = true) {
    const today = new Date()
    const todayDay = today.getDate()
    const thisMonth = currentMonth()

    const { data: allRules } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!allRules?.length) return

    const due = allRules.filter(r =>
      r.last_run_month !== thisMonth && r.day_of_month <= todayDay
    )
    if (!due.length) return

    if (!silent) setRunning(true)
    let created = 0

    for (const rule of due) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(rule.day_of_month).padStart(2, '0')}`
      const { error } = await supabase.from('transactions').insert({
        type: rule.type,
        amount: rule.amount,
        currency: rule.currency,
        description: rule.description,
        category_id: rule.category_id || null,
        wallet_id: rule.wallet_id || null,
        user_id: user.id,
        date: dateStr,
      })
      if (!error) {
        await supabase.from('recurring_rules').update({ last_run_month: thisMonth }).eq('id', rule.id)
        created++
        if (rule.wallet_id) {
          const { data: wRow } = await supabase.from('wallets').select('balance').eq('id', rule.wallet_id).single()
          if (wRow) {
            const sign = rule.type === 'income' ? 1 : -1
            await supabase.from('wallets').update({ balance: Number(wRow.balance) + sign * Number(rule.amount) }).eq('id', rule.wallet_id)
          }
        }
      }
    }

    if (!silent) {
      setRunning(false)
      if (created > 0) {
        toast.success(`${created} עסקאות חוזרות נוצרו`)
        loadAll()
      } else {
        toast('אין עסקאות חוזרות לביצוע')
      }
    } else if (created > 0) {
      toast.success(`${created} עסקאות חוזרות הופעלו אוטומטית`, { duration: 4000 })
      loadAll()
    }
  }

  function openAdd()   { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(r) { setEditing(r); setForm({ description: r.description, amount: r.amount, type: r.type, currency: r.currency, category_id: r.category_id || '', wallet_id: r.wallet_id || '', day_of_month: r.day_of_month }); setModal(true) }

  async function handleSave() {
    if (!form.description || !form.amount) { toast.error('תיאור וסכום חובה'); return }
    setSaving(true)
    const payload = {
      ...form,
      amount: Number(form.amount),
      day_of_month: Number(form.day_of_month),
      category_id: form.category_id || null,
      wallet_id: form.wallet_id || null,
      user_id: user.id,
      is_active: true,
    }
    if (editing) {
      await supabase.from('recurring_rules').update(payload).eq('id', editing.id)
      toast.success('כלל עודכן!')
    } else {
      await supabase.from('recurring_rules').insert(payload)
      toast.success('כלל נוסף!')
    }
    setModal(false); setSaving(false); loadAll()
  }

  async function toggleActive(r) {
    await supabase.from('recurring_rules').update({ is_active: !r.is_active }).eq('id', r.id)
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, active: !x.active } : x))
  }

  async function handleDelete(r) {
    if (!confirm(`למחוק "${r.description}"?`)) return
    await supabase.from('recurring_rules').delete().eq('id', r.id)
    toast.success('נמחק'); loadAll()
  }

  if (loading) return <LoadingSpinner />

  const thisMonth = currentMonth()
  const activeCount = rules.filter(r => r.is_active).length
  const doneThisMonth = rules.filter(r => r.last_run_month === thisMonth).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>עסקאות חוזרות</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-ghost" onClick={() => autoRun(false)} disabled={running} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <RefreshCw size={14} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
            הפעל עכשיו
          </button>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} />כלל חדש</button>
        </div>
      </div>

      {/* Summary */}
      {rules.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
          {[
            { label: 'כללים פעילים', value: activeCount, color: 'var(--c-income)' },
            { label: 'בוצעו החודש', value: doneThisMonth, color: 'var(--c-primary)' },
            { label: 'סה"כ כללים', value: rules.length, color: 'var(--text-sub)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ textAlign: 'center', padding: '0.875rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Explanation */}
      <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        💡 כללים חוזרים מופעלים אוטומטית בכניסה לדף ביום המתאים. לדוגמה: משכורת ב-1 לחודש, שכירות ב-5.
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="page-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔄</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>אין כללים חוזרים עדיין</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>הגדר עסקאות שחוזרות כל חודש</div>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} />כלל חדש</button>
        </div>
      ) : (
        <div className="page-card stagger-list" style={{ padding: 0, overflow: 'hidden' }}>
          {rules.map((r, i) => {
            const cat = cats.find(c => c.id === r.category_id)
            const wallet = wallets.find(w => w.id === r.wallet_id)
            const ranThisMonth = r.last_run_month === thisMonth
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                opacity: r.is_active ? 1 : 0.5,
              }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: '0.75rem', background: r.type === 'income' ? 'var(--c-income-bg)' : 'var(--c-expense-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  {cat?.icon || (r.type === 'income' ? '💰' : '💸')}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>יום {r.day_of_month} לחודש</span>
                    {cat && <span>• {cat.name}</span>}
                    {wallet && <span>• {wallet.name}</span>}
                    {ranThisMonth && <span style={{ color: 'var(--c-income)' }}>• ✓ בוצע החודש</span>}
                  </div>
                </div>
                {/* Amount */}
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: TYPE_COLORS[r.type], fontSize: '0.95rem' }}>
                    {r.type === 'income' ? '+' : '-'}{r.currency}{Number(r.amount).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'left' }}>{TYPE_LABELS[r.type]}</div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={() => toggleActive(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: r.is_active ? 'var(--c-income)' : 'var(--text-dim)' }}>
                    {r.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}><Edit2 size={13} /></button>
                  <button onClick={() => handleDelete(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-expense)', padding: '0.25rem' }}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך כלל' : 'כלל חוזר חדש'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תיאור</label>
            <input className="input-field" placeholder="לדוגמה: משכורת, שכירות..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סכום ₪</label>
              <input className="input-field" type="number" placeholder="1000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>יום בחודש</label>
              <select className="input-field" value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: Number(e.target.value) }))} dir="ltr">
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סוג</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[['expense', 'הוצאה'], ['income', 'הכנסה']].map(([k, v]) => (
                <button key={k} onClick={() => setForm(f => ({ ...f, type: k }))} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', border: `1px solid ${form.type === k ? (k === 'income' ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)') : 'var(--border)'}`, background: form.type === k ? (k === 'income' ? 'var(--c-income-bg)' : 'var(--c-expense-bg)') : 'var(--surface)', color: form.type === k ? (k === 'income' ? 'var(--c-income)' : 'var(--c-expense)') : 'var(--text-sub)' }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>קטגוריה</label>
            <select className="input-field" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">ללא קטגוריה</option>
              {cats.filter(c => c.type === form.type || c.type === 'both').map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>ארנק</label>
            <select className="input-field" value={form.wallet_id} onChange={e => setForm(f => ({ ...f, wallet_id: e.target.value }))}>
              <option value="">ללא ארנק</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
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
