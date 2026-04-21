import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Wallet, Tag, ArrowLeftRight, ChevronLeft, ChevronDown, ChevronUp,
  ScanLine, Archive, Lightbulb, BarChart2, Plus, Edit2, Trash2,
  RefreshCw, ToggleLeft, ToggleRight,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import AddTransactionSheet from '../components/AddTransactionSheet'
import toast from 'react-hot-toast'

const EMPTY_RULE = { description: '', amount: '', type: 'expense', category_id: '', wallet_id: '', day_of_month: 1 }

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

export default function FinancePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [wallets, setWallets] = useState([])
  const [monthly, setMonthly] = useState({ income: 0, expense: 0 })
  const [loans, setLoans] = useState([])
  const [catCount, setCatCount] = useState(0)

  const [openSection, setOpenSection] = useState(null)
  const [addTxOpen, setAddTxOpen] = useState(false)

  // Recurring
  const [rules, setRules] = useState([])
  const [cats, setCats] = useState([])
  const [ruleModal, setRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE)
  const [savingRule, setSavingRule] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [
      { data: wData }, { data: cData }, { data: txData },
      { data: rData }, { data: catData },
    ] = await Promise.all([
      supabase.from('wallets').select('*'),
      supabase.from('categories').select('id'),
      supabase.from('transactions').select('type,amount,date,loan_returned'),
      supabase.from('recurring_rules').select('*').order('day_of_month'),
      supabase.from('categories').select('id,name,icon,color,type'),
    ])
    const w = wData || []
    setWallets(w); setCatCount((cData || []).length); setCats(catData || []); setRules(rData || [])
    const now = new Date()
    const monthTxs = (txData || []).filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    setMonthly({
      income: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    })
    setLoans((txData || []).filter(t => t.type.startsWith('loan')))
    setLoading(false)
    autoRun(true)
  }

  async function autoRun(silent) {
    const today = new Date()
    const todayDay = today.getDate()
    const thisMonth = currentMonth()
    const { data: freshRules } = await supabase.from('recurring_rules').select('*').eq('is_active', true)
    if (!freshRules?.length) { if (!silent) toast('אין עסקאות חוזרות לביצוע'); return }
    const due = freshRules.filter(r => r.last_run_month !== thisMonth && r.day_of_month <= todayDay)
    if (!due.length) { if (!silent) toast('אין עסקאות חוזרות לביצוע'); return }
    if (!silent) setRunning(true)
    let created = 0
    for (const rule of due) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(rule.day_of_month).padStart(2, '0')}`
      const { error } = await supabase.from('transactions').insert({
        type: rule.type, amount: rule.amount, description: rule.description,
        category_id: rule.category_id || null, wallet_id: rule.wallet_id || null,
        user_id: user.id, date: dateStr,
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
    if (!silent) { setRunning(false); if (created > 0) { toast.success(`${created} עסקאות נוצרו`); load() } }
    else if (created > 0) { toast.success(`${created} עסקאות חוזרות הופעלו אוטומטית`, { duration: 4000 }); load() }
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

  if (loading) return <LoadingSpinner />

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans = loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))
  const thisMonth = currentMonth()
  const activeRules = rules.filter(r => r.is_active).length
  const doneThisMonth = rules.filter(r => r.last_run_month === thisMonth).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>סקירה פיננסית</h1>
        <button className="btn-primary" onClick={() => setAddTxOpen(true)} style={{ padding: '0.5rem 0.875rem' }}>
          <Plus size={15} />הוסף עסקה
        </button>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }}>
        <MiniStat label="יתרה כוללת" value={`₪${totalBalance.toLocaleString()}`} color="#6c63ff" />
        <MiniStat label="הכנסות החודש" value={`₪${monthly.income.toLocaleString()}`} color="#4ade80" />
        <MiniStat label="הוצאות החודש" value={`₪${monthly.expense.toLocaleString()}`} color="#f87171" />
        <MiniStat label="הלוואות פתוחות" value={openLoans.length} color="#fbbf24"
          sub={openLoans.length > 0 ? `₪${openLoans.reduce((s, l) => s + Number(l.amount) - Number(l.loan_returned || 0), 0).toLocaleString()} סה"כ` : undefined} />
      </div>

      {/* Nav + Recurring accordion */}
      <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
        <NavRow icon={<ArrowLeftRight size={18} />} label="עסקאות"          sub="כל הפעולות הכספיות"              color="#22d3ee" onClick={() => navigate('/transactions')} />
        <NavRow icon={<Wallet size={18} />}         label="ארנקים"           sub={`${wallets.length} ארנקים`}       color="#6c63ff" onClick={() => navigate('/wallets')} />
        <NavRow icon={<Tag size={18} />}            label="קטגוריות"         sub={`${catCount} קטגוריות`}           color="#a78bfa" onClick={() => navigate('/categories')} />
        <NavRow icon={<ScanLine size={18} />}       label="סריקת חשבונית"    sub="סרוק חשבונית עם AI"               color="#6c63ff" onClick={() => navigate('/scanner')} />
        <NavRow icon={<Archive size={18} />}        label="ארכיון חשבוניות"  sub="כל החשבוניות השמורות"             color="#a78bfa" onClick={() => navigate('/invoices')} />
        <NavRow icon={<Lightbulb size={18} />}      label="דף חכם"           sub="השוואת מחירים וניתוח הוצאות"     color="#fbbf24" onClick={() => navigate('/insights')} />
        <NavRow icon={<BarChart2 size={18} />}      label="דוחות וייצוא"     sub="גרפים, תרשימים וייצוא נתונים"   color="#34d399" onClick={() => navigate('/reports')} />

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
                          {r.last_run_month === thisMonth && <span style={{ color: 'var(--c-income)' }}>• ✓</span>}
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
    </div>
  )
}
