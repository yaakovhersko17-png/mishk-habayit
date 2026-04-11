import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Wallet, Tag, ArrowLeftRight, ChevronLeft } from 'lucide-react'
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

function NavRow({ icon, label, sub, color, onClick, isLast }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:'0.875rem',
      padding:'0.875rem 1rem', cursor:'pointer', transition:'background 0.15s',
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}
    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
    onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <div style={{width:38,height:38,borderRadius:'0.75rem',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>
        {icon}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:'0.9rem',fontWeight:600,color:'#e2e8f0'}}>{label}</div>
        {sub && <div style={{fontSize:'0.75rem',color:'#64748b',marginTop:'0.1rem'}}>{sub}</div>}
      </div>
      <ChevronLeft size={16} color="#475569"/>
    </div>
  )
}

export default function FinancePage() {
  const navigate = useNavigate()
  const [loading, setLoading]   = useState(true)
  const [wallets, setWallets]   = useState([])
  const [monthly, setMonthly]   = useState({ income: 0, expense: 0 })
  const [loans, setLoans]       = useState([])
  const [catCount, setCatCount] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: wData }, { data: cData }, { data: txData }] = await Promise.all([
      supabase.from('wallets').select('*'),
      supabase.from('categories').select('id'),
      supabase.from('transactions').select('type,amount,date,loan_returned'),
    ])
    setWallets(wData || [])
    setCatCount((cData || []).length)

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

  if (loading) return <LoadingSpinner />

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans    = loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>סקירה פיננסית</h1>

      {/* 4 mini stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.75rem'}}>
        <MiniStat label="יתרה כוללת"     value={`₪${totalBalance.toLocaleString()}`}       color="#6c63ff" />
        <MiniStat label="הכנסות החודש"    value={`₪${monthly.income.toLocaleString()}`}     color="#4ade80" />
        <MiniStat label="הוצאות החודש"    value={`₪${monthly.expense.toLocaleString()}`}    color="#f87171" />
        <MiniStat label="הלוואות פתוחות"  value={openLoans.length}                          color="#fbbf24"
          sub={openLoans.length > 0 ? `₪${openLoans.reduce((s,l)=>s+Number(l.amount)-Number(l.loan_returned||0),0).toLocaleString()} סה"כ` : undefined} />
      </div>

      {/* Navigation list */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <NavRow icon={<ArrowLeftRight size={18}/>} label="עסקאות"   sub="כל הפעולות הכספיות"        color="#22d3ee" onClick={() => navigate('/transactions')} />
        <NavRow icon={<Tag size={18}/>}            label="קטגוריות" sub={`${catCount} קטגוריות`}    color="#a78bfa" onClick={() => navigate('/categories')} />
        <NavRow icon={<Wallet size={18}/>}         label="ארנקים"   sub={`${wallets.length} ארנקים`} color="#6c63ff" onClick={() => navigate('/wallets')} isLast />
      </div>
    </div>
  )
}
