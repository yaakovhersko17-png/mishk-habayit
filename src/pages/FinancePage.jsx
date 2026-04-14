import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Wallet, Tag, ArrowLeftRight, ChevronLeft, ScanLine, Archive, Lightbulb, BarChart2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'


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
        <div style={{fontSize:'0.9rem',fontWeight:600,color:'var(--text)'}}>{label}</div>
        {sub && <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{sub}</div>}
      </div>
      <ChevronLeft size={16} color="var(--text-dim)"/>
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
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>סקירה פיננסית</h1>

      {/* 3D Carousel */}
      <div className="carousel-scene">
        <div className="carousel-inner">
          {[
            { index:0, icon:'💰', color:'#6c63ff', bg:'rgba(108,99,255,0.22)',  label:'יתרה כוללת',     value:`₪${totalBalance.toLocaleString()}` },
            { index:1, icon:'📈', color:'#4ade80', bg:'rgba(74,222,128,0.22)',  label:'הכנסות החודש',   value:`₪${monthly.income.toLocaleString()}` },
            { index:2, icon:'📉', color:'#f87171', bg:'rgba(248,113,113,0.22)', label:'הוצאות החודש',   value:`₪${monthly.expense.toLocaleString()}` },
            { index:3, icon:'🏦', color:'#fbbf24', bg:'rgba(251,191,36,0.22)',  label:'הלוואות פתוחות', value: openLoans.length },
          ].map(c => (
            <div key={c.index} className="carousel-card"
              style={{'--index':c.index, background:`linear-gradient(135deg, ${c.bg}, rgba(255,255,255,0.04))`}}>
              <div className="carousel-card__icon" style={{background:c.bg, color:c.color}}>{c.icon}</div>
              <div className="carousel-card__value">{c.value}</div>
              <div className="carousel-card__label">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation list */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <NavRow icon={<ArrowLeftRight size={18}/>} label="עסקאות"   sub="כל הפעולות הכספיות"        color="#22d3ee" onClick={() => navigate('/transactions')} />
        <NavRow icon={<Tag size={18}/>}            label="קטגוריות" sub={`${catCount} קטגוריות`}    color="#a78bfa" onClick={() => navigate('/categories')} />
        <NavRow icon={<Wallet size={18}/>}         label="ארנקים"   sub={`${wallets.length} ארנקים`} color="#6c63ff" onClick={() => navigate('/wallets')} isLast />
      </div>

      {/* Tools list */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'0.625rem 1rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)'}}>כלים</span>
        </div>
        <NavRow icon={<ScanLine size={18}/>}  label="סריקת חשבונית"  sub="סרוק חשבונית עם AI"           color="#6c63ff" onClick={() => navigate('/scanner')} />
        <NavRow icon={<Archive size={18}/>}   label="ארכיון חשבוניות" sub="כל החשבוניות השמורות"         color="#a78bfa" onClick={() => navigate('/invoices')} />
        <NavRow icon={<Lightbulb size={18}/>} label="דף חכם"          sub="השוואת מחירים וניתוח הוצאות"  color="#fbbf24" onClick={() => navigate('/insights')} />
        <NavRow icon={<BarChart2 size={18}/>} label="דוחות וייצוא"    sub="גרפים, תרשימים וייצוא נתונים" color="#34d399" onClick={() => navigate('/reports')} isLast />
      </div>
    </div>
  )
}
