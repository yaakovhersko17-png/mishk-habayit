import { useEffect, useState, useMemo } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { TrendingUp, TrendingDown, Award, ShoppingCart, SlidersHorizontal, X, Lightbulb, Store, Zap } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

/* ── helpers ──────────────────────────────────────────────────── */

// strip store names and common noise to get a "product key"
const STORE_WORDS = ['רמי לוי','שופרסל','יוחננוף','מחסני השוק','ויקטורי','סופר','מרקט','קשת טעמים','אושר עד','AM:PM','קינג סטור','קופיקס','שוק','מינימרקט']
const NOISE = ['בע"מ','בעמ','שב','סניף','חנות','קניה','רכישה','עסק']

function normalizeDesc(desc) {
  let s = desc.toLowerCase().trim()
  ;[...STORE_WORDS, ...NOISE].forEach(w => { s = s.replace(new RegExp(w.toLowerCase(), 'g'), '') })
  return s.replace(/[^א-תa-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractStore(desc) {
  const d = desc.trim()
  for (const w of STORE_WORDS) {
    if (d.toLowerCase().includes(w.toLowerCase())) return w
  }
  // first word as store name if nothing matched
  return d.split(/[\s\-–|,]/)[0].trim() || d
}

function similarity(a, b) {
  if (a === b) return 1
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1
  // simple: how many chars of shorter appear in longer in order
  let j = 0
  for (let i = 0; i < longer.length && j < shorter.length; i++) {
    if (longer[i] === shorter[j]) j++
  }
  return j / longer.length
}

/* ── component ────────────────────────────────────────────────── */
export default function SmartInsights() {
  const [txs, setTxs]         = useState([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [minPurchases, setMinPurchases] = useState(2)
  const [minSaving, setMinSaving]     = useState(5)   // min % diff to show
  const [activeTab, setActiveTab]     = useState('compare') // compare | trends | top

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await withRetry(() =>
      supabase.from('transactions').select('*,categories(name,icon)').order('date', { ascending: false })
    )
    setTxs(data || [])
    setLoading(false)
  }

  const expenses = useMemo(() => txs.filter(t => t.type === 'expense'), [txs])

  /* ── price comparison ── */
  const priceComparison = useMemo(() => {
    // group by normalized product name
    const groups = {}
    expenses.forEach(t => {
      const norm = normalizeDesc(t.description)
      if (norm.length < 2) return
      const store = extractStore(t.description)
      if (!groups[norm]) groups[norm] = { name: norm, original: t.description, stores: {} }
      const g = groups[norm]
      if (!g.stores[store]) g.stores[store] = []
      g.stores[store].push(Number(t.amount))
    })

    // only keep products bought at 2+ stores
    const results = []
    Object.values(groups).forEach(g => {
      const storeList = Object.keys(g.stores)
      if (storeList.length < 2) return
      const storeAvgs = storeList.map(s => ({
        store: s,
        avg: g.stores[s].reduce((a,b)=>a+b,0) / g.stores[s].length,
        count: g.stores[s].length,
      })).sort((a,b) => a.avg - b.avg)
      const cheapest = storeAvgs[0].avg
      const expensive = storeAvgs[storeAvgs.length-1].avg
      const savingPct = ((expensive - cheapest) / expensive) * 100
      if (savingPct < minSaving) return
      results.push({
        product: g.original,
        stores: storeAvgs,
        cheapest: storeAvgs[0].store,
        saving: expensive - cheapest,
        savingPct,
      })
    })
    return results.sort((a,b) => b.savingPct - a.savingPct)
  }, [expenses, minSaving])

  /* ── store ranking ── */
  const storeRanking = useMemo(() => {
    if (priceComparison.length === 0) return []
    const wins = {}
    priceComparison.forEach(p => {
      wins[p.cheapest] = (wins[p.cheapest] || 0) + 1
    })
    return Object.entries(wins).sort((a,b)=>b[1]-a[1]).map(([store, count]) => ({ store, count, pct: Math.round(count/priceComparison.length*100) }))
  }, [priceComparison])

  /* ── price changes ── */
  const priceChanges = useMemo(() => {
    const map = {}
    expenses.forEach(t => {
      const k = t.description.toLowerCase().trim()
      if (!map[k]) map[k] = []
      map[k].push({ amount: Number(t.amount), date: t.date })
    })
    const changes = []
    Object.entries(map).forEach(([name, occ]) => {
      if (occ.length < minPurchases) return
      const sorted = occ.sort((a,b) => new Date(a.date)-new Date(b.date))
      const first = sorted[0].amount, last = sorted[sorted.length-1].amount
      if (first === 0) return
      const delta = ((last-first)/first)*100
      if (Math.abs(delta) >= 5) changes.push({ name, first, last, delta, count: occ.length })
    })
    return changes.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,8)
  }, [expenses, minPurchases])

  /* ── top items ── */
  const top5 = useMemo(() => {
    const cnt = {}
    expenses.forEach(t => { const k = t.description.toLowerCase().trim(); cnt[k] = (cnt[k]||0)+1 })
    return Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}))
  }, [expenses])

  /* ── monthly ── */
  const now = new Date()
  const monthlyComp = useMemo(() => {
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
      const mTxs = expenses.filter(t => { const td=new Date(t.date); return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear() })
      months.push({ label: d.toLocaleDateString('he-IL',{month:'short',year:'2-digit'}), total: mTxs.reduce((s,t)=>s+Number(t.amount),0) })
    }
    return months
  }, [expenses])

  const topCat = useMemo(() => {
    const thisMonth = expenses.filter(t => { const d=new Date(t.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() })
    const ct = {}
    thisMonth.forEach(t => { const k=t.categories?.name||'אחר'; ct[k]=(ct[k]||0)+Number(t.amount) })
    const s = Object.entries(ct).sort((a,b)=>b[1]-a[1])
    return s[0] ? { name:s[0][0], total:s[0][1] } : null
  }, [expenses])

  const totalSavingPotential = priceComparison.reduce((s,p)=>s+p.saving,0)
  const weeklyAvg = useMemo(() => {
    if (!expenses.length) return 0
    const oldest = new Date(expenses[expenses.length-1].date)
    const weeks = Math.max(1, Math.ceil((now-oldest)/(7*24*3600*1000)))
    return expenses.reduce((s,t)=>s+Number(t.amount),0)/weeks
  }, [expenses])

  const TABS = [
    { id:'compare', label:'🏪 השוואת מחירים' },
    { id:'trends',  label:'📈 מגמות' },
    { id:'top',     label:'🛒 נרכש הכי הרבה' },
  ]

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem',paddingBottom:'5rem'}}>

      {/* Header */}
      <div>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>דף חכם</h1>
        <p style={{margin:'0.25rem 0 0',color:'#64748b',fontSize:'0.875rem'}}>ניתוח הוצאות והשוואת מחירים</p>
      </div>

      {/* Summary row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.875rem'}}>
        <div className="stat-card">
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}><TrendingDown size={16} color="#f87171"/><span style={{fontSize:'0.75rem',color:'#64748b'}}>ממוצע שבועי</span></div>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'#f87171'}}>₪{weeklyAvg.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
        {topCat && (
          <div className="stat-card">
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}><Award size={16} color="#fbbf24"/><span style={{fontSize:'0.75rem',color:'#64748b'}}>קטגוריה מובילה</span></div>
            <div style={{fontSize:'1rem',fontWeight:700,color:'#e2e8f0'}}>{topCat.name}</div>
            <div style={{fontSize:'0.9rem',color:'#f87171'}}>₪{topCat.total.toLocaleString()}</div>
          </div>
        )}
        {totalSavingPotential > 0 && (
          <div className="stat-card" style={{border:'1px solid rgba(74,222,128,0.2)',background:'rgba(74,222,128,0.05)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}><Zap size={16} color="#4ade80"/><span style={{fontSize:'0.75rem',color:'#64748b'}}>חיסכון פוטנציאלי</span></div>
            <div style={{fontSize:'1.5rem',fontWeight:700,color:'#4ade80'}}>₪{totalSavingPotential.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
            <div style={{fontSize:'0.7rem',color:'#64748b'}}>אם תקנה הכל במקום הזול</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'0.375rem',background:'rgba(255,255,255,0.04)',borderRadius:'0.875rem',padding:'0.25rem'}}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{flex:1,padding:'0.5rem 0.25rem',borderRadius:'0.625rem',border:'none',cursor:'pointer',fontSize:'0.78rem',fontWeight:500,transition:'all 0.2s',background:activeTab===tab.id?'rgba(108,99,255,0.3)':'transparent',color:activeTab===tab.id?'#a78bfa':'#64748b'}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: price comparison ── */}
      {activeTab === 'compare' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>

          {/* Store ranking */}
          {storeRanking.length > 0 && (
            <div className="page-card">
              <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8',display:'flex',alignItems:'center',gap:'0.5rem'}}><Store size={15}/>דירוג חנויות — הכי זול ביותר</h2>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {storeRanking.map((s,i) => (
                  <div key={s.store} style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.75rem',borderRadius:'0.75rem',background: i===0?'rgba(74,222,128,0.08)':'rgba(255,255,255,0.03)',border: i===0?'1px solid rgba(74,222,128,0.2)':'1px solid rgba(255,255,255,0.05)'}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background: i===0?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.85rem',fontWeight:700,color: i===0?'#4ade80':'#94a3b8',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,fontWeight:500,color:'#e2e8f0'}}>{s.store}</div>
                    <div style={{fontSize:'0.8rem',color: i===0?'#4ade80':'#64748b'}}>זול ב-{s.count} מוצרים ({s.pct}%)</div>
                    {i===0 && <span style={{fontSize:'0.7rem',padding:'0.15rem 0.5rem',borderRadius:'9999px',background:'rgba(74,222,128,0.15)',color:'#4ade80'}}>✅ מומלץ</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product comparison table */}
          {priceComparison.length === 0 ? (
            <div className="page-card" style={{textAlign:'center',padding:'3rem'}}>
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🏪</div>
              <h3 style={{color:'#94a3b8',margin:'0 0 0.5rem'}}>אין עדיין נתונים להשוואה</h3>
              <p style={{color:'#475569',fontSize:'0.85rem',margin:0}}>
                הוסף טרנזקציות עם שם מוצר + שם חנות בתיאור.<br/>
                לדוגמה: "רמי לוי — חלב 1%"
              </p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
              {priceComparison.map((p, idx) => (
                <div key={idx} className="page-card" style={{padding:'1rem'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
                    <div style={{fontWeight:600,color:'#e2e8f0',fontSize:'0.95rem',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingLeft:'0.5rem'}}>{p.product}</div>
                    <span style={{fontSize:'0.75rem',padding:'0.2rem 0.6rem',borderRadius:'9999px',background:'rgba(74,222,128,0.12)',color:'#4ade80',flexShrink:0,fontWeight:600}}>
                      חיסכון {p.savingPct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
                    {p.stores.map((s, si) => {
                      const isCheapest = si === 0
                      const diffPct = si === 0 ? 0 : ((s.avg - p.stores[0].avg) / p.stores[0].avg * 100)
                      const barW = 40 + (s.avg / p.stores[p.stores.length-1].avg) * 60
                      return (
                        <div key={s.store} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.5rem 0.625rem',borderRadius:'0.625rem',background: isCheapest?'rgba(74,222,128,0.07)':'rgba(255,255,255,0.03)',border: isCheapest?'1px solid rgba(74,222,128,0.15)':'1px solid transparent'}}>
                          <div style={{width:6,height:6,borderRadius:'50%',background: isCheapest?'#4ade80':'#475569',flexShrink:0}}/>
                          <div style={{flex:1,fontSize:'0.82rem',color: isCheapest?'#e2e8f0':'#94a3b8'}}>{s.store}</div>
                          <div style={{width:60,height:4,borderRadius:'9999px',background:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${(s.avg/p.stores[p.stores.length-1].avg)*100}%`,background: isCheapest?'#4ade80':'#6c63ff',borderRadius:'9999px'}}/>
                          </div>
                          <div style={{fontSize:'0.85rem',fontWeight:700,color: isCheapest?'#4ade80':'#e2e8f0',minWidth:55,textAlign:'left',direction:'ltr'}}>₪{s.avg.toFixed(2)}</div>
                          {!isCheapest && <div style={{fontSize:'0.7rem',color:'#f87171',minWidth:32}}>+{diffPct.toFixed(0)}%</div>}
                          {isCheapest && <div style={{fontSize:'0.7rem',color:'#4ade80',minWidth:32}}>✅</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: trends ── */}
      {activeTab === 'trends' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {/* Monthly */}
          <div className="page-card">
            <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>📅 השוואה חודשית – 3 חודשים אחרונים</h2>
            <div style={{display:'flex',gap:'0.75rem'}}>
              {monthlyComp.map((m, i) => (
                <div key={i} style={{flex:1,padding:'1rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',textAlign:'center'}}>
                  <div style={{fontSize:'0.78rem',color:'#64748b',marginBottom:'0.4rem'}}>{m.label}</div>
                  <div style={{fontSize:'1.2rem',fontWeight:700,color:'#e2e8f0'}}>₪{m.total.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                  {i > 0 && monthlyComp[i-1].total > 0 && (
                    <div style={{fontSize:'0.72rem',marginTop:'0.25rem',color: m.total>monthlyComp[i-1].total?'#f87171':'#4ade80'}}>
                      {m.total>monthlyComp[i-1].total?'↑':'↓'} {Math.abs(((m.total-monthlyComp[i-1].total)/monthlyComp[i-1].total)*100).toFixed(1)}%
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
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {priceChanges.map((p, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:500,color:'#e2e8f0',fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                      <div style={{fontSize:'0.72rem',color:'#64748b',marginTop:'0.1rem'}}>{p.count} רכישות | ₪{p.first.toFixed(2)} → ₪{p.last.toFixed(2)}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'0.25rem',fontWeight:700,color: p.delta>0?'#f87171':'#4ade80',flexShrink:0}}>
                      {p.delta>0?<TrendingUp size={14}/>:<TrendingDown size={14}/>}
                      {Math.abs(p.delta).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: top items ── */}
      {activeTab === 'top' && top5.length > 0 && (
        <div className="page-card">
          <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>🛒 מוצרים שנרכשו הכי הרבה</h2>
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            {top5.map((item, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)'}}>
                <div style={{width:30,height:30,borderRadius:'50%',background: i<3?'linear-gradient(135deg,#6c63ff,#8b5cf6)':'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:'#fff',flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,fontWeight:500,color:'#e2e8f0',textTransform:'capitalize',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                <div style={{fontSize:'0.85rem',color:'#a78bfa',fontWeight:600,flexShrink:0}}>{item.count}×</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating filter */}
      <button onClick={()=>setFilterOpen(true)}
        style={{position:'fixed',bottom:'2rem',left:'2rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:50,transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <SlidersHorizontal size={22} color="#fff"/>
      </button>

      {/* Filter panel */}
      {filterOpen && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setFilterOpen(false)}>
          <div style={{width:'100%',background:'#1a1a2e',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
              <span style={{fontWeight:700,fontSize:'1rem',color:'#e2e8f0'}}>הגדרות ניתוח</span>
              <button onClick={()=>setFilterOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}><X size={20}/></button>
            </div>

            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:'0.85rem',color:'#94a3b8',marginBottom:'0.75rem'}}>מינימום רכישות לזיהוי מוצר חוזר: <strong style={{color:'#a78bfa'}}>{minPurchases}</strong></div>
              <input type="range" min={2} max={10} value={minPurchases} onChange={e=>setMinPurchases(Number(e.target.value))}
                style={{width:'100%',accentColor:'#6c63ff'}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.72rem',color:'#475569',marginTop:'0.25rem'}}><span>2</span><span>10</span></div>
            </div>

            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'0.85rem',color:'#94a3b8',marginBottom:'0.75rem'}}>הפרש מינימלי להצגת השוואה: <strong style={{color:'#a78bfa'}}>{minSaving}%</strong></div>
              <input type="range" min={1} max={30} value={minSaving} onChange={e=>setMinSaving(Number(e.target.value))}
                style={{width:'100%',accentColor:'#6c63ff'}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.72rem',color:'#475569',marginTop:'0.25rem'}}><span>1%</span><span>30%</span></div>
            </div>

            <button onClick={()=>{setMinPurchases(2);setMinSaving(5)}}
              style={{width:'100%',padding:'0.6rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'#94a3b8',cursor:'pointer',fontSize:'0.85rem'}}>
              איפוס
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
