import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, History, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useRealtime } from '../hooks/useRealtime'
import { useSuccess } from '../context/SuccessContext'
import { hapticSuccess } from '../lib/haptic'
import toast from 'react-hot-toast'

const ICONS  = ['🎯','🏠','✈️','🚗','💍','📱','🎓','💰','🌴','🏋️','🐕','🎸','💻','👶','🏖️']
const COLORS = ['#6c63ff','#4ade80','#f87171','#fbbf24','#22d3ee','#f472b6','#a78bfa','#34d399','#60a5fa','#fb923c']
const emptyForm = { name: '', icon: '🎯', color: '#6c63ff', wallet_id: '', target_amount: '', target_date: '', is_dream: false, auto_amount: '' }

function JarSvg({ pct, color, size = 72 }) {
  const id = `j${color.replace(/[^a-z0-9]/gi, '')}`
  const fill = Math.min(Math.max(pct / 100, 0), 1)
  const bodyTop = 20
  const bodyH = 52
  const filled = bodyH * fill
  const fillY = bodyTop + (bodyH - filled)
  return (
    <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 72 80" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id={id}>
          <path d="M16 20 Q9 20 8 28 L7 62 Q7 73 36 73 Q65 73 65 62 L64 28 Q63 20 56 20 Z" />
        </clipPath>
      </defs>
      <rect x="18" y="7" width="36" height="14" rx="3" fill={color} opacity="0.3" />
      <rect x="24" y="3" width="24" height="7" rx="2" fill={color} opacity="0.5" />
      <path d="M16 20 Q9 20 8 28 L7 62 Q7 73 36 73 Q65 73 65 62 L64 28 Q63 20 56 20 Z"
        fill="rgba(255,255,255,0.04)" stroke={color} strokeWidth="1.8" />
      {fill > 0 && (
        <rect x="0" y={fillY} width="72" height={filled + 16} fill={color} opacity="0.55" clipPath={`url(#${id})`} />
      )}
      <path d="M19 30 Q21 25 25 27 Q23 40 21 44 Q17 42 19 30 Z" fill="white" opacity="0.09" />
    </svg>
  )
}

export default function Goals() {
  const { user } = useAuth()
  const showSuccess = useSuccess()

  const [goals, setGoals]             = useState([])
  const [wallets, setWallets]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(emptyForm)
  const [saving, setSaving]           = useState(false)

  const [depositGoal, setDepositGoal]         = useState(null)
  const [depositAmt, setDepositAmt]           = useState('')
  const [depositNote, setDepositNote]         = useState('')
  const [depositSourceWallet, setDepositSrc]  = useState('')
  const [depositing, setDepositing]           = useState(false)

  const [histGoal, setHistGoal]       = useState(null)
  const [deposits, setDeposits]       = useState([])
  const [histLoading, setHistLoading] = useState(false)

  const loadRef = useRef(null)
  loadRef.current = load

  useEffect(() => { load() }, [])
  useRealtime(['goals', 'goal_deposits'], () => loadRef.current())

  async function load() {
    const [{ data: g }, { data: w }] = await Promise.all([
      supabase.from('goals').select('*').order('created_at'),
      supabase.from('wallets').select('id,name,icon,balance').order('created_at'),
    ])
    setGoals(g || [])
    setWallets(w || [])
    setLoading(false)
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(g) {
    setEditing(g)
    setForm({ name: g.name, icon: g.icon, color: g.color, wallet_id: g.wallet_id || '', target_amount: g.target_amount || '', target_date: g.target_date || '', is_dream: g.is_dream || false, auto_amount: g.auto_amount || '' })
    setModal(true)
  }
  function openDeposit(g) { setDepositGoal(g); setDepositAmt(''); setDepositNote(''); setDepositSrc(g.wallet_id || '') }

  async function handleSave() {
    if (!form.name) { toast.error('שם צנצנת חובה'); return }
    setSaving(true)
    const payload = {
      name: form.name,
      icon: form.icon,
      color: form.color,
      wallet_id: form.wallet_id || null,
      target_amount: form.target_amount ? Number(form.target_amount) : 0,
      target_date: form.target_date || null,
      is_dream: form.is_dream || false,
      auto_amount: form.auto_amount ? Number(form.auto_amount) : null,
      user_id: user.id,
    }
    if (!editing) payload.current_amount = 0
    if (editing) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editing.id)
      if (error) { console.error('goals update error:', error); toast.error(`שגיאה בעדכון: ${error.message}`); setSaving(false); return }
    } else {
      const { error } = await supabase.from('goals').insert(payload)
      if (error) { console.error('goals insert error:', error); toast.error(`שגיאה בשמירה: ${error.message}`); setSaving(false); return }
      hapticSuccess()
    }
    setModal(false); setSaving(false); load()
  }

  async function handleDelete(g) {
    if (!confirm(`למחוק את "${g.name}"?`)) return
    await supabase.from('goals').delete().eq('id', g.id)
    load()
  }

  async function handleDeposit() {
    const amt = Number(depositAmt)
    if (!amt || amt <= 0) { toast.error('סכום לא תקין'); return }
    setDepositing(true)

    const cur = Number(depositGoal.current_amount)
    const tgt = Number(depositGoal.target_amount)
    const newAmt = tgt > 0 ? Math.min(cur + amt, tgt) : cur + amt
    const srcId = depositSourceWallet || null
    const dstId = depositGoal.wallet_id || null

    // 1. Update jar progress + record deposit
    await Promise.all([
      supabase.from('goal_deposits').insert({ goal_id: depositGoal.id, user_id: user.id, amount: amt, note: depositNote || null }),
      supabase.from('goals').update({ current_amount: newAmt }).eq('id', depositGoal.id),
    ])

    // 2. Wallet balance movement
    if (srcId && dstId && srcId !== dstId) {
      // Cross-wallet transfer: source − amt, destination + amt
      const [{ data: sw }, { data: dw }] = await Promise.all([
        supabase.from('wallets').select('balance').eq('id', srcId).single(),
        supabase.from('wallets').select('balance').eq('id', dstId).single(),
      ])
      await Promise.all([
        sw && supabase.from('wallets').update({ balance: Number(sw.balance) - amt }).eq('id', srcId),
        dw && supabase.from('wallets').update({ balance: Number(dw.balance) + amt }).eq('id', dstId),
        supabase.from('transactions').insert({
          type: 'transfer', description: `הפקדה לחיסכון: ${depositGoal.name}`,
          amount: amt, currency: '₪',
          wallet_id: srcId, to_wallet_id: dstId,
          date: new Date().toISOString().split('T')[0], user_id: user.id,
        }),
      ])
    } else if (srcId) {
      // Same wallet or no destination — just deduct from source + log
      const { data: sw } = await supabase.from('wallets').select('balance').eq('id', srcId).single()
      await Promise.all([
        sw && supabase.from('wallets').update({ balance: Number(sw.balance) - amt }).eq('id', srcId),
        supabase.from('transactions').insert({
          type: 'expense', description: `הפקדה לחיסכון: ${depositGoal.name}`,
          amount: amt, currency: '₪',
          wallet_id: srcId,
          date: new Date().toISOString().split('T')[0], user_id: user.id,
        }),
      ])
    }
    if (tgt > 0 && newAmt >= tgt) { hapticSuccess(); showSuccess('🎉 הגעת ליעד!') }
    else showSuccess('הכסף הופקד בצנצנת! 🏺')
    setDepositGoal(null); setDepositAmt(''); setDepositNote(''); setDepositSrc('')
    setDepositing(false)
    load()
  }

  async function openHistory(g) {
    setHistGoal(g); setHistLoading(true); setDeposits([])
    const { data } = await supabase.from('goal_deposits').select('*').eq('goal_id', g.id).order('created_at', { ascending: false })
    setDeposits(data || []); setHistLoading(false)
  }

  if (loading) return <LoadingSpinner />

  const regularGoals = goals.filter(g => !g.is_dream)
  const dreamGoals   = goals.filter(g => g.is_dream)
  const total = goals.reduce((s, g) => s + (Number(g.target_amount) || 0), 0)
  const saved = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const pct   = total > 0 ? Math.round(saved / total * 100) : 0
  const done  = goals.filter(g => g.target_amount && Number(g.current_amount) >= Number(g.target_amount)).length

  function renderJarCard(g) {
    const cur    = Number(g.current_amount)
    const tgt    = Number(g.target_amount)
    const p      = tgt > 0 ? Math.min(cur / tgt * 100, 100) : 0
    const isDone = tgt > 0 && cur >= tgt
    const daysLeft = g.target_date ? Math.ceil((new Date(g.target_date + 'T00:00:00') - new Date()) / 86400000) : null
    const remaining = tgt > cur ? tgt - cur : 0

    // Adaptive frequency based on time horizon
    let timeLabel = null
    let depositLabel = null
    if (daysLeft !== null) {
      if (daysLeft < 0) {
        timeLabel = `פג תוקף לפני ${Math.abs(daysLeft)} ימים`
      } else if (daysLeft <= 30) {
        // ≤30 days → daily
        const months = daysLeft
        timeLabel = `${daysLeft} ימים נותרו`
        if (remaining > 0) depositLabel = `₪${Math.ceil(remaining / daysLeft).toLocaleString()} / יום`
      } else if (daysLeft <= 365) {
        // 1–12 months → monthly
        const monthsLeft = Math.ceil(daysLeft / 30.44)
        timeLabel = `${monthsLeft} חודש${monthsLeft > 1 ? 'ים' : ''} נותר${monthsLeft > 1 ? 'ו' : ''}`
        if (remaining > 0) depositLabel = `₪${Math.ceil(remaining / monthsLeft).toLocaleString()} / חודש`
      } else {
        // >1 year → yearly
        const yearsLeft = Math.ceil(daysLeft / 365.25)
        timeLabel = `${yearsLeft} שנ${yearsLeft > 1 ? 'ים' : 'ה'} נותר${yearsLeft > 1 ? 'ו' : 'ת'}`
        if (remaining > 0) depositLabel = `₪${Math.ceil(remaining / yearsLeft).toLocaleString()} / שנה`
      }
    }

    const wallet = wallets.find(w => w.id === g.wallet_id)
    return (
      <div key={g.id} style={{ background: 'var(--surface)', border: `1px solid ${isDone ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`, borderRadius: '1rem', padding: '0.875rem 0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', position: 'relative' }}>
        {isDone && (
          <div style={{ position: 'absolute', top: 6, right: 6, fontSize: '0.6rem', fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', padding: '2px 5px', borderRadius: 999, border: '1px solid rgba(74,222,128,0.3)' }}>✓ הושלם</div>
        )}

        {/* Clickable jar area → opens deposit */}
        <button onClick={() => !isDone && openDeposit(g)} style={{ background: 'none', border: 'none', cursor: isDone ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', padding: 0, width: '100%' }}>
          <div style={{ fontSize: '1.2rem' }}>{g.icon}</div>
          <JarSvg pct={p} color={g.color} size={60} />
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {tgt > 0 ? `${Math.round(p)}% · ₪${cur.toLocaleString()} / ₪${tgt.toLocaleString()}` : `₪${cur.toLocaleString()}`}
          </div>
          {!isDone && <div style={{ fontSize: '0.6rem', color: g.color, opacity: 0.7 }}>לחץ להפקדה</div>}
        </button>

        {/* Wallet badge */}
        {wallet && (
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}>
            {wallet.icon || '🏦'} {wallet.name}
          </div>
        )}

        {timeLabel && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '100%' }}>
            <div style={{ fontSize: '0.62rem', color: daysLeft < 0 ? '#f87171' : daysLeft <= 30 ? '#fbbf24' : 'var(--text-muted)', textAlign: 'center' }}>
              {timeLabel}
            </div>
            {depositLabel && (
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: g.color, background: `${g.color}18`, border: `1px solid ${g.color}40`, borderRadius: 999, padding: '2px 8px', letterSpacing: '0.01em' }}>
                {depositLabel}
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: '0.3rem', width: '100%', marginTop: 3 }}>
          <button onClick={() => openHistory(g)} style={{ flex: 1, padding: '0.35rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <History size={12} />
          </button>
          <button onClick={() => openEdit(g)} style={{ flex: 1, padding: '0.35rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Edit2 size={12} />
          </button>
          <button onClick={() => handleDelete(g)} style={{ flex: 1, padding: '0.35rem', borderRadius: '0.5rem', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>מרכז החיסכון 🏺</h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>הצנצנות שלכם</div>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={14} />צנצנת חדשה</button>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="page-card" style={{ background: 'linear-gradient(135deg,rgba(108,99,255,0.15),rgba(139,92,246,0.08))', borderColor: 'rgba(108,99,255,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>נחסך סה"כ</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>₪{saved.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>יעד כולל</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--c-primary)' }}>₪{total.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>הושלמו</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#4ade80' }}>{done}/{goals.length}</div>
            </div>
          </div>
          {total > 0 && <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6c63ff,#a78bfa)' }} />
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{pct}% הושלם</div>
          </>}
        </div>
      )}

      {/* Regular goals grid */}
      {regularGoals.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>יעדים פעילים</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {regularGoals.map(renderJarCard)}
          </div>
        </div>
      )}

      {/* Dream board */}
      {dreamGoals.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.75rem' }}>✨ לוח החלומות</div>
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {dreamGoals.map(g => (
              <div key={g.id} style={{ flexShrink: 0, width: 148 }}>{renderJarCard(g)}</div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="page-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏺</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>אין צנצנות עדיין</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>צור את הצנצנת הראשונה שלך</div>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} />צנצנת חדשה</button>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך צנצנת' : 'צנצנת חדשה'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Wallet selector — primary field */}
          <div style={{ background: form.wallet_id ? 'rgba(108,99,255,0.08)' : 'rgba(248,113,113,0.06)', border: `1.5px solid ${form.wallet_id ? 'rgba(108,99,255,0.35)' : 'rgba(248,113,113,0.3)'}`, borderRadius: '0.875rem', padding: '0.875rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: form.wallet_id ? 'var(--c-primary)' : '#f87171', display: 'block', marginBottom: '0.5rem' }}>🏦 הכסף יושב ב... (חובה)</label>
            <select value={form.wallet_id} onChange={e => setForm(f => ({ ...f, wallet_id: e.target.value }))}
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.625rem', padding: '0.5rem 0.75rem', color: form.wallet_id ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', direction: 'rtl' }}>
              <option value="">בחר ארנק...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || '🏦'} {w.name} — ₪{Number(w.balance).toLocaleString()}</option>)}
            </select>
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שם הצנצנת</label>
            <input className="input-field" placeholder="לדוגמה: חיסכון לדירה" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {/* Icon */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.5rem' }}>אייקון</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ width: 36, height: 36, borderRadius: '0.5rem', fontSize: '1.2rem', background: form.icon === ic ? 'rgba(108,99,255,0.2)' : 'var(--surface)', border: `1px solid ${form.icon === ic ? 'rgba(108,99,255,0.5)' : 'var(--border)'}`, cursor: 'pointer' }}>{ic}</button>
              ))}
            </div>
          </div>

          {/* Target + date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>יעד ₪ (אופציונלי)</label>
              <input className="input-field" type="number" placeholder="10000" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תאריך יעד</label>
              <input className="input-field" type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} dir="ltr" />
            </div>
          </div>

          {/* Color */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.5rem' }}>צבע</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`, cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          {/* Dream toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.625rem', background: form.is_dream ? 'rgba(251,191,36,0.08)' : 'transparent', border: `1px solid ${form.is_dream ? 'rgba(251,191,36,0.3)' : 'transparent'}`, transition: 'all 0.15s' }}>
            <input type="checkbox" checked={form.is_dream} onChange={e => setForm(f => ({ ...f, is_dream: e.target.checked }))} />
            <span style={{ fontSize: '0.85rem', color: form.is_dream ? '#fbbf24' : 'var(--text-sub)' }}>✨ יעד חלום (לוח החלומות)</span>
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
          </div>
        </div>
      </Modal>

      {/* Deposit sheet */}
      {depositGoal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setDepositGoal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', width: '100%', maxWidth: 420, paddingBottom: 'calc(1.5rem + 74px + env(safe-area-inset-bottom,0px))' }}>

            {/* Jar header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
              <JarSvg pct={Number(depositGoal.current_amount) / (Number(depositGoal.target_amount) || 1) * 100} color={depositGoal.color} size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1.05rem' }}>{depositGoal.icon} {depositGoal.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {depositGoal.target_amount
                    ? `₪${Number(depositGoal.current_amount).toLocaleString()} / ₪${Number(depositGoal.target_amount).toLocaleString()}`
                    : `₪${Number(depositGoal.current_amount).toLocaleString()} נחסך`}
                </div>
                {wallets.find(w => w.id === depositGoal.wallet_id) && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {wallets.find(w => w.id === depositGoal.wallet_id).icon || '🏦'} {wallets.find(w => w.id === depositGoal.wallet_id).name}
                  </div>
                )}
              </div>
            </div>

            {/* Source wallet selector */}
            {wallets.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginBottom: '0.4rem', fontWeight: 600 }}>מאיזה ארנק?</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setDepositSrc('')}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '1.5rem', fontSize: '0.78rem', fontWeight: 600,
                      background: depositSourceWallet === '' ? 'rgba(108,99,255,0.2)' : 'var(--surface)',
                      border: `1px solid ${depositSourceWallet === '' ? 'rgba(108,99,255,0.5)' : 'var(--border)'}`,
                      color: depositSourceWallet === '' ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer' }}>
                    ללא
                  </button>
                  {wallets.map(w => (
                    <button key={w.id} onClick={() => setDepositSrc(w.id)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '1.5rem', fontSize: '0.78rem', fontWeight: 600,
                        background: depositSourceWallet === w.id ? 'rgba(108,99,255,0.2)' : 'var(--surface)',
                        border: `1px solid ${depositSourceWallet === w.id ? 'rgba(108,99,255,0.5)' : 'var(--border)'}`,
                        color: depositSourceWallet === w.id ? '#a78bfa' : 'var(--text-muted)', cursor: 'pointer' }}>
                      {w.icon || '💳'} {w.name}
                      <span style={{ marginRight: '0.3rem', opacity: 0.7 }}>₪{Number(w.balance).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount input — big, numeric keyboard on mobile */}
            <input
              className="input-field"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="₪ כמה להפקיד?"
              value={depositAmt}
              onChange={e => setDepositAmt(e.target.value)}
              autoFocus
              dir="ltr"
              style={{ marginBottom: '0.75rem', textAlign: 'center', fontSize: '1.75rem', fontWeight: 700, letterSpacing: 1 }}
            />
            <input className="input-field" placeholder="הערה (אופציונלי)" value={depositNote} onChange={e => setDepositNote(e.target.value)} style={{ marginBottom: '1.25rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setDepositGoal(null)} style={{ flex: 1, justifyContent: 'center' }}>ביטול</button>
              <button className="btn-primary" onClick={handleDeposit} disabled={depositing} style={{ flex: 2, justifyContent: 'center', fontSize: '1rem' }}>
                {depositing ? 'מפקיד...' : '🏺 הפקד'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History sheet */}
      {histGoal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setHistGoal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', width: '100%', maxWidth: 420, maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(1.5rem + 74px + env(safe-area-inset-bottom,0px))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>היסטוריית הפקדות — {histGoal.name}</div>
              <button onClick={() => setHistGoal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {histLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>
              ) : deposits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>אין הפקדות עדיין</div>
              ) : deposits.map((d, i) => (
                <div key={d.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#4ade80', fontWeight: 700 }}>+₪{Number(d.amount).toLocaleString()}</div>
                    {d.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.note}</div>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(d.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
