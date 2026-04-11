import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, Wallet, CreditCard, ChevronDown, ChevronLeft } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function MiniStat({ label, value, color, sub }) {
  return (
    <div style={{padding:'0.875rem',borderRadius:'0.875rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}>
      <div style={{fontSize:'0.72rem',color:'#64748b',marginBottom:'0.375rem'}}>{label}</div>
      <div style={{fontSize:'1.2rem',fontWeight:700,color:'#e2e8f0'}}>{value}</div>
      {sub && <div style={{fontSize:'0.7rem',color,marginTop:'0.2rem'}}>{sub}</div>}
    </div>
  )
}

export default function FinancePage() {
  const [loading, setLoading]   = useState(true)
  const [wallets, setWallets]   = useState([])
  const [cats, setCats]         = useState([])
  const [loans, setLoans]       = useState([])
  const [monthly, setMonthly]   = useState({ income: 0, expense: 0 })
  const [expanded, setExpanded] = useState(new Set())
  const [loanTab, setLoanTab]   = useState('given')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: wData }, { data: cData }, { data: txData }] = await Promise.all([
      supabase.from('wallets').select('*').order('created_at'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
    ])
    setWallets(wData || [])
    setCats(cData || [])

    const now = new Date()
    const monthTxs = (txData || []).filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    setMonthly({
      income:  monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    })
    setLoans((txData || []).filter(t => t.type.startsWith('loan')))
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <LoadingSpinner />

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans    = loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))
  const givenLoans   = loans.filter(l => l.type === 'loan_given')
  const recvLoans    = loans.filter(l => l.type === 'loan_received')

  // Category hierarchy
  const parents = cats.filter(c => !c.parent_id)
  const byParent = {}
  cats.filter(c => c.parent_id).forEach(c => {
    if (!byParent[c.parent_id]) byParent[c.parent_id] = []
    byParent[c.parent_id].push(c)
  })

  const activeLoanList = loanTab === 'given' ? givenLoans : recvLoans

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>סקירה פיננסית</h1>

      {/* 4 mini stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.75rem'}}>
        <MiniStat label="יתרה כוללת"      value={`₪${totalBalance.toLocaleString()}`}        color="#6c63ff" />
        <MiniStat label="הכנסות החודש"     value={`₪${monthly.income.toLocaleString()}`}      color="#4ade80" />
        <MiniStat label="הוצאות החודש"     value={`₪${monthly.expense.toLocaleString()}`}     color="#f87171" />
        <MiniStat label="הלוואות פתוחות"   value={openLoans.length}                           color="#fbbf24"
          sub={openLoans.length > 0 ? `₪${openLoans.reduce((s,l)=>s+Number(l.amount)-Number(l.loan_returned||0),0).toLocaleString()} סה"כ` : undefined} />
      </div>

      {/* Wallets */}
      <div className="page-card">
        <h3 style={{margin:'0 0 1rem',fontSize:'0.875rem',fontWeight:600,color:'#94a3b8'}}>💳 ארנקים</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'0.625rem'}}>
          {wallets.map(w => (
            <div key={w.id} style={{padding:'0.75rem',borderRadius:'0.75rem',background:`${w.color||'#6c63ff'}15`,border:`1px solid ${w.color||'#6c63ff'}30`,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:w.color||'#6c63ff'}}/>
              <div style={{fontSize:'1.25rem',marginBottom:'0.375rem'}}>{w.icon}</div>
              <div style={{fontSize:'0.72rem',color:'#94a3b8',marginBottom:'0.2rem'}}>{w.name}</div>
              <div style={{fontSize:'1rem',fontWeight:700,color:'#e2e8f0'}}>{w.currency}{Number(w.balance).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'0.75rem 1rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{fontSize:'0.875rem',fontWeight:600,color:'#94a3b8'}}>🏷️ קטגוריות</span>
        </div>
        {parents.map((c, i) => {
          const kids = byParent[c.id] || []
          const isOpen = expanded.has(c.id)
          return (
            <div key={c.id}>
              <div
                onClick={() => kids.length && toggleExpand(c.id)}
                style={{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.6rem 1rem',borderTop:i>0?'1px solid rgba(255,255,255,0.04)':'none',cursor:kids.length?'pointer':'default'}}
              >
                <span style={{color:kids.length?(isOpen?'#a78bfa':'#64748b'):'transparent',width:14,flexShrink:0,fontSize:'0.8rem'}}>
                  {kids.length > 0 && (isOpen ? <ChevronDown size={14}/> : <ChevronLeft size={14}/>)}
                </span>
                <div style={{width:26,height:26,borderRadius:'0.4rem',background:`${c.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.875rem',flexShrink:0}}>{c.icon}</div>
                <span style={{fontSize:'0.82rem',color:'#e2e8f0',flex:1}}>{c.name}</span>
                {kids.length > 0 && <span style={{fontSize:'0.68rem',color:'#64748b'}}>{kids.length} תת-קטגוריות</span>}
              </div>
              {isOpen && kids.map(k => (
                <div key={k.id} style={{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.5rem 1rem 0.5rem 2.75rem',borderTop:'1px solid rgba(255,255,255,0.04)',background:'rgba(255,255,255,0.02)'}}>
                  <div style={{width:22,height:22,borderRadius:'0.35rem',background:`${k.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',flexShrink:0}}>{k.icon}</div>
                  <span style={{fontSize:'0.8rem',color:'#cbd5e1'}}>{k.name}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Loans (חוב) */}
      <div className="page-card">
        <h3 style={{margin:'0 0 1rem',fontSize:'0.875rem',fontWeight:600,color:'#94a3b8'}}>🏦 חוב</h3>
        <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
          {[
            { key:'given',    label:`הלוואה שנתתי (${givenLoans.length})`,    activeColor:'#fbbf24' },
            { key:'received', label:`הלוואה שקיבלתי (${recvLoans.length})`,   activeColor:'#60a5fa' },
          ].map(({key, label, activeColor}) => (
            <button key={key} onClick={() => setLoanTab(key)} style={{
              flex:1, padding:'0.5rem 0.25rem', borderRadius:'0.625rem', fontSize:'0.78rem', cursor:'pointer',
              border:`1px solid ${loanTab===key?`${activeColor}80`:'rgba(255,255,255,0.08)'}`,
              background: loanTab===key?`${activeColor}20`:'rgba(255,255,255,0.03)',
              color: loanTab===key ? activeColor : '#94a3b8',
            }}>{label}</button>
          ))}
        </div>
        {activeLoanList.length === 0
          ? <p style={{textAlign:'center',color:'#475569',fontSize:'0.85rem',padding:'1rem 0'}}>אין הלוואות</p>
          : activeLoanList.map(l => {
              const returned = Number(l.loan_returned || 0)
              const remaining = Number(l.amount) - returned
              return (
                <div key={l.id} style={{padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',marginBottom:'0.5rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.25rem'}}>
                    <div style={{fontSize:'0.85rem',fontWeight:500,color:'#e2e8f0'}}>{l.description}</div>
                    <div style={{fontSize:'0.85rem',fontWeight:700,color:'#fbbf24',flexShrink:0,paddingRight:'0.5rem'}}>₪{Number(l.amount).toLocaleString()}</div>
                  </div>
                  {l.loan_party && <div style={{fontSize:'0.72rem',color:'#64748b'}}>👤 {l.loan_party}</div>}
                  {l.loan_due_date && <div style={{fontSize:'0.72rem',color:'#64748b'}}>📅 {new Date(l.loan_due_date).toLocaleDateString('he-IL')}</div>}
                  {returned > 0 && (
                    <div style={{display:'flex',gap:'0.75rem',marginTop:'0.375rem'}}>
                      <span style={{fontSize:'0.72rem',color:'#4ade80'}}>הוחזר ₪{returned.toLocaleString()}</span>
                      <span style={{fontSize:'0.72rem',color:'#f87171'}}>נותר ₪{remaining.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
