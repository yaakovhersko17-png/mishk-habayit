import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Wallet, Tag, CreditCard, ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react'
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

function Tile({ icon, label, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      gap:'0.625rem', padding:'1.25rem 0.75rem',
      borderRadius:'1rem', cursor:'pointer',
      background:`${color}12`,
      border:`1px solid ${color}30`,
      transition:'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}60` }}
    onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.borderColor = `${color}30` }}
    >
      <div style={{width:44,height:44,borderRadius:'0.875rem',background:`${color}25`,display:'flex',alignItems:'center',justifyContent:'center',color,fontSize:'1.25rem'}}>
        {icon}
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'0.875rem',fontWeight:600,color:'#e2e8f0'}}>{label}</div>
        {sub && <div style={{fontSize:'0.7rem',color:'#64748b',marginTop:'0.15rem'}}>{sub}</div>}
      </div>
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

      {/* Navigation tiles */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.875rem'}}>
        <Tile
          icon={<Wallet size={22}/>}
          label="ארנקים"
          sub={`${wallets.length} ארנקים`}
          color="#6c63ff"
          onClick={() => navigate('/wallets')}
        />
        <Tile
          icon={<Tag size={22}/>}
          label="קטגוריות"
          sub={`${catCount} קטגוריות`}
          color="#a78bfa"
          onClick={() => navigate('/categories')}
        />
        <Tile
          icon={<CreditCard size={22}/>}
          label="חוב"
          sub={`${openLoans.length} הלוואות פתוחות`}
          color="#fbbf24"
          onClick={() => navigate('/transactions?filter=loan')}
        />
        <Tile
          icon={<ArrowLeftRight size={22}/>}
          label="עסקאות"
          sub="כל הפעולות"
          color="#22d3ee"
          onClick={() => navigate('/transactions')}
        />
      </div>
    </div>
  )
}
