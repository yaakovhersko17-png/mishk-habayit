import { useEffect, useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { TrendingUp, TrendingDown, Award, ShoppingBag, ArrowUpRight } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function SmartInsights() {
  const [txs, setTxs]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [top5, setTop5]         = useState([])
  const [topCat, setTopCat]     = useState(null)
  const [monthlyComp, setMonthlyComp] = useState([])
  const [priceChanges, setPriceChanges] = useState([])
  const [weeklyAvg, setWeeklyAvg] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await withRetry(() => supabase.from('transactions').select('*,categories(name,icon)').order('date', { ascending: false }))
    setTxs(data || [])
    compute(data || [])
    setLoading(false)
  }

  function compute(data) {
    const now = new Date()

    // Top 5 purchased items (by description frequency)
    const descCount = {}
    data.filter(t => t.type === 'expense').forEach(t => {
      const k = t.description.toLowerCase().trim()
      descCount[k] = (descCount[k] || 0) + 1
    })
    const t5 = Object.entries(descCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count])=>({ name, count }))
    setTop5(t5)

    // Top spending category this month
    const thisMonth = data.filter(t => {
      const d = new Date(t.date)
      return t.type==='expense' && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
    })
    const catTotals = {}
    thisMonth.forEach(t => {
      const k = t.categories?.name || 'אחר'
      catTotals[k] = (catTotals[k] || 0) + Number(t.amount)
    })
    const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])
    setTopCat(sorted[0] ? { name: sorted[0][0], total: sorted[0][1] } : null)

    // Monthly comparison last 3 months
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
      const mTxs = data.filter(t => { const td=new Date(t.date); return t.type==='expense' && td.getMonth()===d.getMonth() && td.getFullYear()===d.getFullYear() })
      months.push({ label: `${d.getMonth()+1}/${d.getFullYear()}`, total: mTxs.reduce((s,t)=>s+Number(t.amount),0) })
    }
    setMonthlyComp(months)

    // Weekly average
    const expenses = data.filter(t => t.type === 'expense')
    if (expenses.length > 0) {
      const oldest = new Date(expenses[expenses.length-1].date)
      const weeks = Math.max(1, Math.ceil((now - oldest) / (7*24*3600*1000)))
      setWeeklyAvg(expenses.reduce((s,t)=>s+Number(t.amount),0) / weeks)
    }

    // Price changes (same description, compare first and last occurrence)
    const priceMap = {}
    expenses.forEach(t => {
      const k = t.description.toLowerCase().trim()
      if (!priceMap[k]) priceMap[k] = []
      priceMap[k].push({ amount: Number(t.amount), date: t.date })
    })
    const changes = []
    Object.entries(priceMap).forEach(([name, occurrences]) => {
      if (occurrences.length < 2) return
      const sorted2 = occurrences.sort((a,b)=>new Date(a.date)-new Date(b.date))
      const first = sorted2[0].amount, last = sorted2[sorted2.length-1].amount
      if (first === 0) return
      const delta = ((last - first) / first) * 100
      if (Math.abs(delta) >= 5) changes.push({ name, first, last, delta, count: occurrences.length })
    })
    setPriceChanges(changes.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>דף חכם – Smart Insights</h1>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:'1rem'}}>
        {/* Weekly avg */}
        <div className="stat-card">
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem'}}>
            <TrendingDown size={18} color="#f87171"/>
            <span style={{fontSize:'0.85rem',color:'#64748b'}}>ממוצע הוצאה שבועי</span>
          </div>
          <div style={{fontSize:'2rem',fontWeight:700,color:'#f87171'}}>₪{weeklyAvg.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>

        {/* Top category */}
        {topCat && (
          <div className="stat-card">
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem'}}>
              <Award size={18} color="#fbbf24"/>
              <span style={{fontSize:'0.85rem',color:'#64748b'}}>קטגוריה עם הוצאה גבוהה ביותר החודש</span>
            </div>
            <div style={{fontSize:'1.3rem',fontWeight:700,color:'#e2e8f0'}}>{topCat.name}</div>
            <div style={{fontSize:'1rem',color:'#f87171',marginTop:'0.25rem'}}>₪{topCat.total.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Monthly comparison */}
      <div className="page-card">
        <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>📅 השוואה חודשית – 3 חודשים אחרונים</h2>
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
          {monthlyComp.map((m, i) => (
            <div key={i} style={{flex:1,minWidth:120,padding:'1rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',textAlign:'center'}}>
              <div style={{fontSize:'0.8rem',color:'#64748b',marginBottom:'0.5rem'}}>{m.label}</div>
              <div style={{fontSize:'1.25rem',fontWeight:700,color:'#e2e8f0'}}>₪{m.total.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
              {i > 0 && monthlyComp[i-1].total > 0 && (
                <div style={{fontSize:'0.75rem',marginTop:'0.25rem',color: m.total>monthlyComp[i-1].total?'#f87171':'#4ade80'}}>
                  {m.total > monthlyComp[i-1].total ? '↑' : '↓'} {Math.abs(((m.total-monthlyComp[i-1].total)/monthlyComp[i-1].total)*100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Price changes */}
      {priceChanges.length > 0 && (
        <div className="page-card">
          <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>💰 שינויי מחיר למוצרים חוזרים</h2>
          <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
            {priceChanges.map((p, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.875rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,color:'#e2e8f0',marginBottom:'0.125rem'}}>{p.name}</div>
                  <div style={{fontSize:'0.75rem',color:'#64748b'}}>{p.count} רכישות | ₪{p.first.toFixed(2)} → ₪{p.last.toFixed(2)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'0.25rem',fontWeight:700,color: p.delta>0?'#f87171':'#4ade80'}}>
                  {p.delta > 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                  {Math.abs(p.delta).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 items */}
      {top5.length > 0 && (
        <div className="page-card">
          <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>🛒 Top 5 – מוצרים שנרכשו הכי הרבה</h2>
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            {top5.map((item, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)'}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:'#fff',flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,fontWeight:500,color:'#e2e8f0',textTransform:'capitalize'}}>{item.name}</div>
                <div style={{fontSize:'0.85rem',color:'#a78bfa',fontWeight:600}}>{item.count} פעמים</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
