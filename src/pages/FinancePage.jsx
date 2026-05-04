import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import {
  ChevronLeft, ChevronDown, ChevronUp,
  ScanLine, Archive, BarChart2, Plus, Edit2, Trash2,
  RefreshCw, ToggleLeft, ToggleRight, Store,
} from 'lucide-react'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend,
} from 'recharts'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import AddTransactionSheet from '../components/AddTransactionSheet'
import toast from 'react-hot-toast'
import { useSuccess } from '../context/SuccessContext'

const EMPTY_RULE = { description: '', amount: '', type: 'expense', category_id: '', wallet_id: '', day_of_month: 1 }
const TYPE_LABELS = { loan_given: 'הלויתי', loan_received: 'לקחתי', debt_unpaid: 'חוב' }

function LoanRow({ loan, color, bgColor, borderColor, onRepay }) {
  const remaining = Number(loan.amount) - Number(loan.loan_returned || 0)
  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '0.75rem',
      padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loan.description}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ color, fontWeight: 700 }}>₪{remaining.toLocaleString()}</span>
          {loan.loan_party && <span>· {loan.loan_party}</span>}
          {loan.loan_due_date && <span>· {new Date(loan.loan_due_date).toLocaleDateString('he-IL', { day:'numeric', month:'short' })}</span>}
        </div>
      </div>
      <button onClick={onRepay}
        style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem',
          fontWeight: 700, background: `${color}18`, border: `1px solid ${color}40`,
          color, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
        שולם ✓
      </button>
    </div>
  )
}
const PIE_COLORS = ['#6c63ff','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#a78bfa','#34d399','#fb923c','#22d3ee']
const PIE_W = 360, PIE_H = 300
const PIE_CX = 180, PIE_CY = 150
const PIE_OR = 78, PIE_IR = 50
const PIE_RADIAN = Math.PI / 180
const PIE_MIN_GAP = 22

function currentMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function MiniStat({ label, value, color, sub }) {
  return (
    <div style={{ padding: '0.875rem', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color, marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  )
}

function NavRow({ icon, label, sub, color, onClick, isLast }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '0.875rem',
      padding: '0.875rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 38, height: 38, borderRadius: '0.75rem', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
      </div>
      <ChevronLeft size={16} color="var(--text-dim)" />
    </div>
  )
}

function AccordionRow({ icon, label, sub, color, open, onToggle, hasBorderBottom }) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: '0.875rem',
      padding: '0.875rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
      borderBottom: hasBorderBottom ? '1px solid rgba(255,255,255,0.04)' : 'none',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 38, height: 38, borderRadius: '0.75rem', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
      </div>
      {open ? <ChevronUp size={16} color="var(--text-dim)" /> : <ChevronDown size={16} color="var(--text-dim)" />}
    </div>
  )
}

const tooltipStyle = { background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'var(--text)' }

export default function FinancePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const showSuccess = useSuccess()

  const [loading, setLoading]   = useState(true)
  const [wallets, setWallets]   = useState([])
  const [monthly, setMonthly]   = useState({ income: 0, expense: 0 })
  const [loans, setLoans]       = useState([])
  const [allTxs, setAllTxs]     = useState([])

  const [openSection, setOpenSection] = useState(null)
  const [addTxOpen, setAddTxOpen]     = useState(false)

  // Debt repayment
  const [debtModal, setDebtModal]     = useState(false)
  const [repayLoan, setRepayLoan]     = useState(null)
  const [repayWallet, setRepayWallet] = useState('')
  const [repaying, setRepaying]       = useState(false)

  // Recurring
  const [rules, setRules]           = useState([])
  const [cats, setCats]             = useState([])
  const [ruleModal, setRuleModal]   = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [ruleForm, setRuleForm]     = useState(EMPTY_RULE)
  const [savingRule, setSavingRule] = useState(false)
  const [running, setRunning]       = useState(false)

  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime(['transactions', 'wallets'], () => loadRef.current())

  async function load() {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 12000)
    try {
      const [
        { data: wData }, { data: txData },
        { data: rData }, { data: catData },
      ] = await Promise.all([
        supabase.from('wallets').select('*').abortSignal(abort.signal),
        supabase.from('transactions').select('id,type,amount,date,loan_returned,description,wallet_id,loan_party,currency,category_id,categories(name,color)').abortSignal(abort.signal),
        supabase.from('recurring_rules').select('*').order('day_of_month').abortSignal(abort.signal),
        supabase.from('categories').select('id,name,icon,color,type').abortSignal(abort.signal),
      ])
      const w = wData || []
      const txs = txData || []
      setWallets(w); setCats(catData || []); setRules(rData || [])
      setAllTxs(txs)
      const now = new Date()
      const monthTxs = txs.filter(t => {
        const d = new Date(t.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      setMonthly({
        income: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        expense: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      })
      setLoans(txs.filter(t => t.type.startsWith('loan') || t.type === 'debt_unpaid'))
      autoRun(true)
    } catch (e) {
      console.error('load error', e)
      if (e?.name === 'AbortError' || String(e).includes('abort')) {
        toast.error('הטעינה נכשלה — בדוק חיבור לאינטרנט')
      }
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }

  async function autoRun(silent) {
    const today = new Date()
    const todayDay = today.getDate()
    const thisMonth = currentMonth()
    const { data: freshRules } = await supabase.from('recurring_rules').select('*').eq('is_active', true)
    if (!freshRules?.length) { if (!silent) toast('אין עסקאות חוזרות לביצוע'); return }
    const due = freshRules.filter(r => r.last_run_month !== thisMonth && !r.pending_approval && r.day_of_month <= todayDay)
    if (!due.length) { if (!silent) toast('אין עסקאות חוזרות לביצוע'); return }
    if (!silent) setRunning(true)
    let queued = 0
    for (const rule of due) {
      const { error } = await supabase.from('recurring_rules').update({ pending_approval: true }).eq('id', rule.id)
      if (!error) queued++
    }
    if (!silent) { setRunning(false); if (queued > 0) { toast(`${queued} עסקאות ממתינות לאישורך 🔔`); load() } }
    else if (queued > 0) { toast(`${queued} עסקאות חוזרות ממתינות לאישורך`, { duration: 5000 }); load() }
  }

  function openAddRule() { setEditingRule(null); setRuleForm(EMPTY_RULE); setRuleModal(true) }
  function openEditRule(r) { setEditingRule(r); setRuleForm({ description: r.description, amount: r.amount, type: r.type, category_id: r.category_id || '', wallet_id: r.wallet_id || '', day_of_month: r.day_of_month }); setRuleModal(true) }

  async function saveRule() {
    if (!ruleForm.description || !ruleForm.amount) { toast.error('תיאור וסכום חובה'); return }
    setSavingRule(true)
    const payload = { ...ruleForm, amount: Number(ruleForm.amount), day_of_month: Number(ruleForm.day_of_month), category_id: ruleForm.category_id || null, wallet_id: ruleForm.wallet_id || null, user_id: user.id, is_active: true }
    if (editingRule) { await supabase.from('recurring_rules').update(payload).eq('id', editingRule.id); toast.success('כלל עודכן!') }
    else { await supabase.from('recurring_rules').insert(payload); toast.success('כלל נוסף!') }
    setRuleModal(false); setSavingRule(false); load()
  }

  async function toggleRule(r) {
    await supabase.from('recurring_rules').update({ is_active: !r.is_active }).eq('id', r.id)
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteRule(r) {
    if (!confirm(`למחוק "${r.description}"?`)) return
    await supabase.from('recurring_rules').delete().eq('id', r.id)
    toast.success('נמחק'); load()
  }

  async function handleRepay() {
    if (!repayWallet) { toast.error('בחר ארנק'); return }
    setRepaying(true)
    const amt = Number(repayLoan.amount) - Number(repayLoan.loan_returned || 0)
    await supabase.from('transactions').update({ loan_returned: Number(repayLoan.amount) }).eq('id', repayLoan.id)
    const newType = repayLoan.type === 'loan_given' ? 'income' : 'expense'
    await supabase.from('transactions').insert({
      type: newType,
      description: `החזר חוב — ${repayLoan.description}`,
      amount: amt,
      currency: repayLoan.currency || '₪',
      wallet_id: repayWallet,
      date: new Date().toISOString().split('T')[0],
      user_id: user.id,
    })
    const sign = newType === 'income' ? 1 : -1
    const { data: w } = await supabase.from('wallets').select('balance').eq('id', repayWallet).single()
    if (w) await supabase.from('wallets').update({ balance: w.balance + sign * amt }).eq('id', repayWallet)
    setRepaying(false); setRepayLoan(null); setDebtModal(false); setRepayWallet('')
    showSuccess('החוב שולם ונסגר בהצלחה! ✓')
    load()
  }

  // ── All-time computations ────────────────────────────────────────────────
  const allIncome  = useMemo(() => allTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), [allTxs])
  const allExpense = useMemo(() => allTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0), [allTxs])
  const allNet     = allIncome - allExpense

  // All-time trend: weekly granularity to show real spikes/dips
  const trendData = useMemo(() => {
    if (!allTxs.length) return []
    const sorted = [...allTxs].sort((a, b) => a.date.localeCompare(b.date))
    // Snap to the Sunday of the first tx's week
    const firstDate = new Date(sorted[0].date + 'T00:00:00')
    firstDate.setDate(firstDate.getDate() - firstDate.getDay())
    const now = new Date()
    const points = []
    const cur = new Date(firstDate)
    while (cur <= now) {
      const wStart = cur.toISOString().split('T')[0]
      const wEndDate = new Date(cur); wEndDate.setDate(wEndDate.getDate() + 6)
      const wEnd = wEndDate.toISOString().split('T')[0]
      const wTxs = allTxs.filter(t => t.date >= wStart && t.date <= wEnd)
      const inc = wTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const exp = wTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      // Only add points that have activity OR are the latest week (always show current)
      if (inc > 0 || exp > 0 || wStart === now.toISOString().split('T')[0].slice(0,10)) {
        points.push({
          name: cur.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }),
          הכנסות: inc,
          הוצאות: exp,
        })
      }
      cur.setDate(cur.getDate() + 7)
    }
    return points
  }, [allTxs])

  // All-time pie: expenses by category
  const pieData = useMemo(() => {
    const map = {}
    allTxs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name || 'אחר'
      map[name] = (map[name] || 0) + Number(t.amount)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [allTxs])

  const pieLabelLayout = useMemo(() => {
    if (!pieData.length) return {}
    const total = pieData.reduce((s, d) => s + d.value, 0)
    let cumAngle = 0
    const entries = []
    pieData.forEach((d, i) => {
      const pct = d.value / total
      const sliceAngle = pct * 360
      const midAngle = cumAngle + sliceAngle / 2
      cumAngle += sliceAngle
      if (pct < 0.04) return
      const rad = -midAngle * PIE_RADIAN
      const arcX = PIE_CX + PIE_OR * Math.cos(rad)
      const arcY = PIE_CY + PIE_OR * Math.sin(rad)
      const elbowX = PIE_CX + (PIE_OR + 14) * Math.cos(rad)
      const elbowY = PIE_CY + (PIE_OR + 14) * Math.sin(rad)
      entries.push({ i, arcX, arcY, elbowX, rawY: elbowY, isLeft: elbowX <= PIE_CX })
    })
    const left  = entries.filter(e => e.isLeft).sort((a, b) => a.rawY - b.rawY)
    const right = entries.filter(e => !e.isLeft).sort((a, b) => a.rawY - b.rawY)
    function resolve(group) {
      for (let pass = 0; pass < 20; pass++) {
        let moved = false
        for (let j = 1; j < group.length; j++) {
          if (group[j].rawY - group[j-1].rawY < PIE_MIN_GAP) {
            const mid = (group[j].rawY + group[j-1].rawY) / 2
            group[j-1].rawY = mid - PIE_MIN_GAP / 2
            group[j].rawY   = mid + PIE_MIN_GAP / 2
            moved = true
          }
        }
        if (!moved) break
      }
      group.forEach(e => { e.rawY = Math.max(10, Math.min(PIE_H - 10, e.rawY)) })
    }
    resolve(left); resolve(right)
    const layout = {}
    ;[...left, ...right].forEach(e => {
      layout[e.i] = { arcX: e.arcX, arcY: e.arcY, elbowX: e.elbowX, finalY: e.rawY, isLeft: e.isLeft }
    })
    return layout
  }, [pieData])

  if (loading) return <LoadingSpinner />

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans    = loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))
  const openLent     = openLoans.filter(l => l.type === 'loan_given')
  const openBorrowed = openLoans.filter(l => l.type === 'loan_received' || l.type === 'debt_unpaid')
  const lentTotal     = openLent.reduce((s, l) => s + Number(l.amount) - Number(l.loan_returned || 0), 0)
  const borrowedTotal = openBorrowed.reduce((s, l) => s + Number(l.amount) - Number(l.loan_returned || 0), 0)
  const thisMonth = currentMonth()
  const activeRules = rules.filter(r => r.is_active).length
  const doneThisMonth = rules.filter(r => r.last_run_month === thisMonth).length
  const trendChartWidth = Math.max(360, trendData.length * 52)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>סקירה פיננסית</h1>
        <button className="btn-primary" onClick={() => setAddTxOpen(true)} style={{ padding: '0.5rem 0.875rem' }}>
          <Plus size={15} />הוסף עסקה
        </button>
      </div>

      {/* ── TOP CARDS ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }}>
        <MiniStat label="יתרה כוללת" value={`₪${totalBalance.toLocaleString()}`} color="#6c63ff" />
        <MiniStat label="הכנסות החודש" value={`₪${monthly.income.toLocaleString()}`} color="#4ade80" />
        <MiniStat label="הוצאות החודש" value={`₪${monthly.expense.toLocaleString()}`} color="#f87171" />

        {/* Loan split card */}
        <div
          onClick={() => openLoans.length > 0 && setDebtModal(true)}
          style={{ cursor: openLoans.length > 0 ? 'pointer' : 'default',
            padding: '0.875rem', borderRadius: '0.875rem',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>חובות והלוואות</div>

          {openLoans.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>אין פתוחות</div>
          ) : (
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Lent — green */}
              {openLent.length > 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
                  paddingLeft: openBorrowed.length > 0 ? '0.5rem' : 0,
                  borderLeft: openBorrowed.length > 0 ? '1px solid rgba(255,255,255,0.09)' : 'none' }}>
                  <div style={{ fontSize: '0.6rem', color: '#4ade80', fontWeight: 700, letterSpacing: '0.04em' }}>💚 הלויתי</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4ade80' }}>₪{lentTotal.toLocaleString()}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{openLent.length} פתוח{openLent.length !== 1 ? 'ות' : ''}</div>
                </div>
              )}
              {/* Borrowed — red */}
              {openBorrowed.length > 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
                  paddingRight: openLent.length > 0 ? '0.5rem' : 0 }}>
                  <div style={{ fontSize: '0.6rem', color: '#f87171', fontWeight: 700, letterSpacing: '0.04em' }}>🔴 חייב</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f87171' }}>₪{borrowedTotal.toLocaleString()}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{openBorrowed.length} פתוח{openBorrowed.length !== 1 ? 'ות' : ''}</div>
                </div>
              )}
            </div>
          )}
          {openLoans.length > 0 && (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: 1 }}>לחץ לניהול ←</div>
          )}
        </div>
      </div>

      {/* ── SEPARATOR ────────────────────────────────────────── */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.12), transparent)' }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>ALL-TIME</span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)' }} />
      </div>

      {/* ── ALL-TIME STATS ───────────────────────────────────── */}
      {/* Income + Expense boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>הכנסות סה"כ</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#4ade80' }}>₪{allIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(248,113,113,0.15)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>הוצאות סה"כ</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f87171' }}>₪{allExpense.toLocaleString()}</div>
        </div>
      </div>

      {/* Balance row */}
      <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: allNet >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)', background: allNet >= 0 ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>מאזן כולל</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: allNet >= 0 ? '#4ade80' : '#f87171' }}>
            {allNet >= 0 ? '+' : '-'}₪{Math.abs(allNet).toLocaleString()}
          </div>
        </div>
        <div style={{ fontSize: '1.5rem' }}>{allNet >= 0 ? '📈' : '📉'}</div>
      </div>

      {/* ── TREND CHART ─────────────────────────────────────── */}
      {trendData.length > 1 && (
        <div className="page-card" style={{ padding: '1rem 0.75rem 0.75rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: '0.75rem', paddingRight: '0.25rem' }}>
            מגמה מצטברת
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', paddingBottom: '0.5rem' }}>
            <LineChart width={trendChartWidth} height={220} data={trendData} style={{ direction: 'ltr' }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `₪${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-sub)', paddingTop: '0.5rem' }} />
              <Line type="monotone" dataKey="הכנסות" stroke="#4ade80" strokeWidth={2.5} dot={{ r: 3, fill: '#4ade80' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="הוצאות" stroke="#f87171" strokeWidth={2.5} dot={{ r: 3, fill: '#f87171' }} activeDot={{ r: 5 }} />
            </LineChart>
          </div>
        </div>
      )}

      {/* ── PIE CHART ───────────────────────────────────────── */}
      {pieData.length > 0 && (
        <div className="page-card" style={{ overflow: 'visible' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-sub)', marginBottom: '0.5rem' }}>הוצאות לפי קטגוריה</div>
          <div style={{ display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
            <PieChart width={PIE_W} height={PIE_H} style={{ overflow: 'visible' }}>
              <Pie
                data={pieData}
                cx={PIE_CX} cy={PIE_CY}
                innerRadius={PIE_IR} outerRadius={PIE_OR}
                dataKey="value" nameKey="name"
                labelLine={false}
                label={({ index, percent }) => {
                  const pos = pieLabelLayout[index]
                  if (!pos) return null
                  const color = PIE_COLORS[index % PIE_COLORS.length]
                  const name = pieData[index].name
                  const pct = (percent * 100).toFixed(0) + '%'
                  const { arcX, arcY, elbowX, finalY, isLeft } = pos
                  const tailX = isLeft ? elbowX - 24 : elbowX + 24
                  const textX = tailX + (isLeft ? -4 : 4)
                  return (
                    <g>
                      <polyline
                        points={`${arcX.toFixed(1)},${arcY.toFixed(1)} ${elbowX.toFixed(1)},${finalY.toFixed(1)} ${tailX},${finalY.toFixed(1)}`}
                        fill="none" stroke={color} strokeWidth={1.2} strokeOpacity={0.6}
                      />
                      <text x={textX} y={finalY - 5} textAnchor={isLeft ? 'end' : 'start'}
                        fill={color} fontSize={10} fontWeight={700}>{name}</text>
                      <text x={textX} y={finalY + 7} textAnchor={isLeft ? 'end' : 'start'}
                        fill="rgba(255,255,255,0.55)" fontSize={9}>{pct}</text>
                    </g>
                  )
                }}
              >
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={v => `₪${v.toLocaleString()}`} />
            </PieChart>
          </div>
        </div>
      )}

      {/* ── NAVIGATION ──────────────────────────────────────── */}
      <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
        <NavRow icon={<Store size={18} />}     label="חנויות"          sub="ניהול חנויות וסיכום הוצאות"      color="#a78bfa" onClick={() => navigate('/stores')} />
        <NavRow icon={<ScanLine size={18} />}  label="סריקת חשבונית"   sub="סרוק חשבונית עם AI"              color="#6c63ff" onClick={() => navigate('/scanner')} />
        <NavRow icon={<Archive size={18} />}   label="ארכיון חשבוניות" sub="כל החשבוניות השמורות"            color="#a78bfa" onClick={() => navigate('/invoices')} />
        <NavRow icon={<BarChart2 size={18} />} label="דוחות"           sub="גרפים, תרשימים וייצוא נתונים"  color="#34d399" onClick={() => navigate('/reports')} />

        {/* Recurring accordion */}
        <AccordionRow
          icon={<RefreshCw size={18} />}
          label="עסקאות חוזרות"
          sub={`${activeRules} פעילות • ${doneThisMonth} בוצעו החודש`}
          color="#34d399"
          open={openSection === 'recurring'}
          onToggle={() => setOpenSection(openSection === 'recurring' ? null : 'recurring')}
          hasBorderBottom={openSection === 'recurring'}
        />
        {openSection === 'recurring' && (
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
            {rules.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '0.875rem' }}>
                {[
                  { label: 'פעילים', value: activeRules, color: 'var(--c-income)' },
                  { label: 'בוצעו החודש', value: doneThisMonth, color: 'var(--c-primary)' },
                  { label: 'סה"כ', value: rules.length, color: 'var(--text-sub)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {rules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔄</div>
                אין כללים חוזרים עדיין
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: '0.875rem', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {rules.map((r, i) => {
                  const cat = cats.find(c => c.id === r.category_id)
                  const wallet = wallets.find(w => w.id === r.wallet_id)
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', opacity: r.is_active ? 1 : 0.5 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '0.5rem', background: r.type === 'income' ? 'var(--c-income-bg)' : 'var(--c-expense-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                        {cat?.icon || (r.type === 'income' ? '💰' : '💸')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem' }}>
                          <span>יום {r.day_of_month}</span>
                          {wallet && <span>• {wallet.name}</span>}
                          {r.pending_approval && <span style={{ color: '#f97316', fontWeight: 700 }}>● ממתין</span>}
                          {!r.pending_approval && r.last_run_month === thisMonth && <span style={{ color: 'var(--c-income)' }}>• ✓</span>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: r.type === 'income' ? 'var(--c-income)' : 'var(--c-expense)', fontSize: '0.875rem', flexShrink: 0 }}>
                        {r.type === 'income' ? '+' : '-'}₪{Number(r.amount).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0 }}>
                        <button onClick={() => toggleRule(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: r.is_active ? 'var(--c-income)' : 'var(--text-dim)' }}>
                          {r.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => openEditRule(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}><Edit2 size={13} /></button>
                        <button onClick={() => deleteRule(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-expense)', padding: '0.2rem' }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" onClick={() => autoRun(false)} disabled={running} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <RefreshCw size={13} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />הפעל עכשיו
              </button>
              <button className="btn-primary" onClick={openAddRule} style={{ flex: 1, justifyContent: 'center' }}>
                <Plus size={14} />כלל חדש
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rule modal */}
      <Modal open={ruleModal} onClose={() => setRuleModal(false)} title={editingRule ? 'ערוך כלל' : 'כלל חוזר חדש'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תיאור</label>
            <input className="input-field" placeholder="לדוגמה: משכורת, שכירות..." value={ruleForm.description} onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סכום ₪</label>
              <input className="input-field" type="number" placeholder="1000" value={ruleForm.amount} onChange={e => setRuleForm(f => ({ ...f, amount: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>יום בחודש</label>
              <select className="input-field" value={ruleForm.day_of_month} onChange={e => setRuleForm(f => ({ ...f, day_of_month: Number(e.target.value) }))} dir="ltr">
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סוג</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[['expense', 'הוצאה'], ['income', 'הכנסה']].map(([k, v]) => (
                <button key={k} onClick={() => setRuleForm(f => ({ ...f, type: k }))} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', border: `1px solid ${ruleForm.type === k ? (k === 'income' ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)') : 'var(--border)'}`, background: ruleForm.type === k ? (k === 'income' ? 'var(--c-income-bg)' : 'var(--c-expense-bg)') : 'var(--surface)', color: ruleForm.type === k ? (k === 'income' ? 'var(--c-income)' : 'var(--c-expense)') : 'var(--text-sub)' }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>קטגוריה</label>
            <select className="input-field" value={ruleForm.category_id} onChange={e => setRuleForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">ללא קטגוריה</option>
              {cats.filter(c => c.type === ruleForm.type || c.type === 'both').map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>ארנק</label>
            <select className="input-field" value={ruleForm.wallet_id} onChange={e => setRuleForm(f => ({ ...f, wallet_id: e.target.value }))}>
              <option value="">ללא ארנק</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setRuleModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={saveRule} disabled={savingRule}>{savingRule ? 'שומר...' : 'שמור'}</button>
          </div>
        </div>
      </Modal>

      <AddTransactionSheet open={addTxOpen} onClose={() => setAddTxOpen(false)} onSaved={load} />

      {/* Debt repayment modal */}
      {debtModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setDebtModal(false); setRepayLoan(null) }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--modal-bg)',
            border: '1px solid var(--border)', borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            paddingBottom: 'calc(1.5rem + 74px + env(safe-area-inset-bottom,0px))' }}>

            {!repayLoan ? (
              <>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '1rem', fontSize: '1rem' }}>
                  חובות והלוואות פעילים
                </div>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                  {/* Lent section */}
                  {openLent.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        💚 הלויתי — ₪{lentTotal.toLocaleString()} מגיע לי
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {openLent.map(loan => (
                          <LoanRow key={loan.id} loan={loan} color="#4ade80" bgColor="rgba(74,222,128,0.07)" borderColor="rgba(74,222,128,0.2)" onRepay={() => { setRepayLoan(loan); setRepayWallet('') }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  {openLent.length > 0 && openBorrowed.length > 0 && (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />
                  )}

                  {/* Borrowed section */}
                  {openBorrowed.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        🔴 חייב — ₪{borrowedTotal.toLocaleString()} צריך להחזיר
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {openBorrowed.map(loan => (
                          <LoanRow key={loan.id} loan={loan} color="#f87171" bgColor="rgba(248,113,113,0.07)" borderColor="rgba(248,113,113,0.2)" onRepay={() => { setRepayLoan(loan); setRepayWallet('') }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
                  {repayLoan.type === 'loan_given' ? '💰 לאיזה חשבון נכנס ההחזר?' : '💸 מאיזה חשבון יצא התשלום?'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {repayLoan.description} — ₪{(Number(repayLoan.amount) - Number(repayLoan.loan_returned || 0)).toLocaleString()}
                  {repayLoan.loan_party && ` · ${repayLoan.loan_party}`}
                </div>
                <select value={repayWallet} onChange={e => setRepayWallet(e.target.value)}
                  className="input-field" style={{ marginBottom: '1.25rem', direction: 'rtl' }}>
                  <option value="">בחר חשבון...</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || '💳'} {w.name} — ₪{Number(w.balance).toLocaleString()}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-ghost" onClick={() => setRepayLoan(null)} style={{ flex: 1, justifyContent: 'center' }}>חזרה</button>
                  <button className="btn-primary" onClick={handleRepay} disabled={repaying || !repayWallet}
                    style={{ flex: 2, justifyContent: 'center' }}>
                    {repaying ? 'מעדכן...' : '✓ אשר תשלום'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
