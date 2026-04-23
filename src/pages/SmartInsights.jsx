import { useEffect, useState, useMemo } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { TrendingUp, TrendingDown, Award, Plus, Pencil, Trash2, X, Store, Zap, Check } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

/* ── helpers ──────────────────────────────────────────────────── */
const STORE_WORDS = ['רמי לוי','שופרסל','יוחננוף','מחסני השוק','ויקטורי','קשת טעמים','אושר עד','AM:PM','קינג סטור','קופיקס','מינימרקט']
const NOISE = ['בע"מ','בעמ','שב','סניף','חנות','קניה','רכישה','עסק']

const MANUAL_KEY = 'smart_manual_prices'

function loadManual() {
  try { return JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]') } catch { return [] }
}
function saveManual(arr) {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(arr))
}

function normalizeDesc(desc) {
  let s = desc.toLowerCase().trim()
  ;[...STORE_WORDS, ...NOISE].forEach(w => { s = s.replace(new RegExp(w.toLowerCase(), 'g'), '') })
  return s.replace(/[^א-תa-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractStore(desc) {
  for (const w of STORE_WORDS) {
    if (desc.toLowerCase().includes(w.toLowerCase())) return w
  }
  return desc.split(/[\s\-–|,]/)[0].trim() || desc
}

/* ── component ────────────────────────────────────────────────── */
export default function SmartInsights() {
  const [txs, setTxs]           = useState([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('compare')
  const [manual, setManual]     = useState(loadManual)
  const [showAdd, setShowAdd]   = useState(false)
  const [editIdx, setEditIdx]   = useState(null)
  const [form, setForm]         = useState({ product:'', store:'', price:'' })
  const [storesList, setStoresList] = useState([])
  const [storesPeriod, setStoresPeriod] = useState('month') // 'week'|'month'|'all'

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: txData }, { data: sData }] = await Promise.all([
      withRetry(() => supabase.from('transactions').select('*,categories(name,icon)').order('date', { ascending: false })),
      supabase.from('stores').select('id,name'),
    ])
    setTxs(txData || [])
    setStoresList(sData || [])
    setLoading(false)
  }

  const expenses = useMemo(() => txs.filter(t => t.type === 'expense'), [txs])

  /* ── merge auto + manual into unified price groups ── */
  const priceComparison = useMemo(() => {
    const groups = {}

    // from transactions
    expenses.forEach(t => {
      const norm = normalizeDesc(t.description)
      if (norm.length < 2) return
      const store = extractStore(t.description)
      if (!groups[norm]) groups[norm] = { name: norm, original: t.description, stores: {}, source: 'auto' }
      if (!groups[norm].stores[store]) groups[norm].stores[store] = []
      groups[norm].stores[store].push(Number(t.amount))
    })

    // from manual entries
    manual.forEach(m => {
      const norm = m.product.toLowerCase().trim()
      if (!norm) return
      if (!groups[norm]) groups[norm] = { name: norm, original: m.product, stores: {}, source: 'manual' }
      if (!groups[norm].stores[m.store]) groups[norm].stores[m.store] = []
      groups[norm].stores[m.store].push(Number(m.price))
    })

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
      if (savingPct < 1) return
      results.push({ product: g.original, stores: storeAvgs, cheapest: storeAvgs[0].store, saving: expensive - cheapest, savingPct })
    })
    return results.sort((a,b) => b.savingPct - a.savingPct)
  }, [expenses, manual])

  const storeRanking = useMemo(() => {
    const wins = {}
    priceComparison.forEach(p => { wins[p.cheapest] = (wins[p.cheapest]||0)+1 })
    return Object.entries(wins).sort((a,b)=>b[1]-a[1]).map(([store,count])=>({ store, count, pct: Math.round(count/priceComparison.length*100) }))
  }, [priceComparison])

  const priceChanges = useMemo(() => {
    const map = {}
    expenses.forEach(t => {
      const k = t.description.toLowerCase().trim()
      if (!map[k]) map[k] = []
      map[k].push({ amount: Number(t.amount), date: t.date })
    })
    const changes = []
    Object.entries(map).forEach(([name, occ]) => {
      if (occ.length < 2) return
      const sorted = occ.sort((a,b)=>new Date(a.date)-new Date(b.date))
      const first = sorted[0].amount, last = sorted[sorted.length-1].amount
      if (first === 0) return
      const delta = ((last-first)/first)*100
      if (Math.abs(delta) >= 5) changes.push({ name, first, last, delta, count: occ.length })
    })
    return changes.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,8)
  }, [expenses])

  const top5 = useMemo(() => {
    const cnt = {}
    expenses.forEach(t => { const k=t.description.toLowerCase().trim(); cnt[k]=(cnt[k]||0)+1 })
    return Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}))
  }, [expenses])

  const now = new Date()
  const monthlyComp = useMemo(() => {
    const months = []
    for (let i=2;i>=0;i--) {
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

  const weeklyAvg = useMemo(() => {
    if (!expenses.length) return 0
    const oldest = new Date(expenses[expenses.length-1].date)
    const weeks = Math.max(1, Math.ceil((now-oldest)/(7*24*3600*1000)))
    return expenses.reduce((s,t)=>s+Number(t.amount),0)/weeks
  }, [expenses])

  const totalSaving = priceComparison.reduce((s,p)=>s+p.saving,0)

  /* ── manual CRUD ── */
  function openAdd() { setForm({ product:'', store:'', price:'' }); setEditIdx(null); setShowAdd(true) }
  function openEdit(idx) { setForm({ product: manual[idx].product, store: manual[idx].store, price: String(manual[idx].price) }); setEditIdx(idx); setShowAdd(true) }
  function deleteEntry(idx) { const next = manual.filter((_,i)=>i!==idx); setManual(next); saveManual(next); toast.success('נמחק') }
  function saveEntry() {
    if (!form.product || !form.store || !form.price) { toast.error('מלא את כל השדות'); return }
    const entry = { product: form.product.trim(), store: form.store.trim(), price: Number(form.price) }
    let next
    if (editIdx !== null) { next = manual.map((m,i)=>i===editIdx?entry:m) } else { next = [...manual, entry] }
    setManual(next); saveManual(next); setShowAdd(false); toast.success(editIdx!==null?'עודכן':'נוסף')
  }

  const TABS = [
    { id:'compare', label:'🏪 השוואה' },
    { id:'stores',  label:'🏬 חנויות' },
    { id:'trends',  label:'📈 מגמות' },
    { id:'top',     label:'🛒 נרכש הכי הרבה' },
  ]

  // ── stores tab data ──────────────────────────────────────────
  const storesTabData = useMemo(() => {
    const now = new Date()
    let fromDate = null
    if (storesPeriod === 'week') {
      fromDate = new Date(now); fromDate.setDate(fromDate.getDate() - 7)
    } else if (storesPeriod === 'month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    const filtered = expenses.filter(t => {
      if (!fromDate) return true
      return new Date(t.date) >= fromDate
    })
    return storesList.map(s => {
      const lc = s.name.toLowerCase()
      const matched = filtered.filter(t => t.description?.toLowerCase().includes(lc))
      return { id: s.id, name: s.name, total: matched.reduce((sum, t) => sum + Number(t.amount), 0), count: matched.length }
    }).filter(s => s.count > 0).sort((a, b) => b.total - a.total)
  }, [expenses, storesList, storesPeriod])

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem',paddingBottom:'5rem'}}>

      {/* Header */}
      <div>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>דף חכם</h1>
        <p style={{margin:'0.25rem 0 0',color:'var(--text-muted)',fontSize:'0.875rem'}}>ניתוח הוצאות והשוואת מחירים</p>
      </div>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.875rem'}}>
        <div className="stat-card">
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}><TrendingDown size={16} color="#f87171"/><span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>ממוצע שבועי</span></div>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'#f87171'}}>₪{weeklyAvg.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        </div>
        {topCat && (
          <div className="stat-card">
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}><Award size={16} color="#fbbf24"/><span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>קטגוריה מובילה</span></div>
            <div style={{fontSize:'1rem',fontWeight:700,color:'var(--text)'}}>{topCat.name}</div>
            <div style={{fontSize:'0.9rem',color:'#f87171'}}>₪{topCat.total.toLocaleString()}</div>
          </div>
        )}
        {totalSaving > 0 && (
          <div className="stat-card" style={{border:'1px solid rgba(74,222,128,0.2)',background:'rgba(74,222,128,0.05)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}}><Zap size={16} color="#4ade80"/><span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>חיסכון פוטנציאלי</span></div>
            <div style={{fontSize:'1.5rem',fontWeight:700,color:'#4ade80'}}>₪{totalSaving.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>אם תקנה הכל במקום הזול</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'0.375rem',background:'rgba(255,255,255,0.04)',borderRadius:'0.875rem',padding:'0.25rem'}}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{flex:1,padding:'0.5rem 0.25rem',borderRadius:'0.625rem',border:'none',cursor:'pointer',fontSize:'0.78rem',fontWeight:500,transition:'all 0.2s',background:activeTab===tab.id?'rgba(108,99,255,0.3)':'transparent',color:activeTab===tab.id?'#a78bfa':'var(--text-muted)'}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── stores tab ── */}
      {activeTab === 'stores' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {/* Period filter */}
          <div style={{display:'flex',gap:'0.375rem',background:'rgba(255,255,255,0.04)',borderRadius:'0.875rem',padding:'0.25rem'}}>
            {[['week','שבוע אחרון'],['month','החודש'],['all','הכל']].map(([k,v]) => (
              <button key={k} onClick={()=>setStoresPeriod(k)}
                style={{flex:1,padding:'0.45rem 0.25rem',borderRadius:'0.625rem',border:'none',cursor:'pointer',fontSize:'0.78rem',fontWeight:500,transition:'all 0.2s',background:storesPeriod===k?'rgba(108,99,255,0.3)':'transparent',color:storesPeriod===k?'#a78bfa':'var(--text-muted)'}}>
                {v}
              </button>
            ))}
          </div>

          {storesTabData.length === 0 ? (
            <div className="page-card" style={{textAlign:'center',padding:'3rem'}}>
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🏬</div>
              <h3 style={{color:'var(--text-sub)',margin:'0 0 0.5rem'}}>אין נתונים לתקופה זו</h3>
              <p style={{color:'var(--text-dim)',fontSize:'0.85rem',margin:0}}>
                {storesList.length === 0 ? 'הוסף חנויות בסגירה פיננסית ← חנויות' : 'לא נמצאו עסקאות עם שמות חנויות מהרשימה'}
              </p>
            </div>
          ) : (
            <div className="page-card" style={{padding:'0.75rem'}}>
              {storesTabData.map((s, i) => {
                const maxTotal = storesTabData[0].total
                const barW = Math.round((s.total / maxTotal) * 100)
                return (
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.625rem 0.25rem',borderBottom:i<storesTabData.length-1?'1px solid rgba(255,255,255,0.04)':'none'}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:i===0?'linear-gradient(135deg,#6c63ff,#8b5cf6)':'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:'#fff',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.2rem'}}>
                        <span style={{fontWeight:600,fontSize:'0.875rem',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
                        <span style={{fontWeight:700,color:'#f87171',fontSize:'0.9rem',flexShrink:0,marginRight:'0.5rem'}}>₪{s.total.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
                      </div>
                      <div style={{height:4,borderRadius:'9999px',background:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${barW}%`,background:i===0?'linear-gradient(90deg,#6c63ff,#8b5cf6)':'rgba(108,99,255,0.5)',borderRadius:'9999px',transition:'width 0.4s'}}/>
                      </div>
                      <div style={{fontSize:'0.68rem',color:'var(--text-muted)',marginTop:'0.2rem'}}>{s.count} עסקאות</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── compare ── */}
      {activeTab === 'compare' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>

          {storeRanking.length > 0 && (
            <div className="page-card">
              <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text-sub)',display:'flex',alignItems:'center',gap:'0.5rem'}}><Store size={15}/>דירוג חנויות</h2>
              {storeRanking.map((s,i) => (
                <div key={s.store} style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.625rem 0.75rem',borderRadius:'0.75rem',marginBottom:'0.375rem',background:i===0?'rgba(74,222,128,0.08)':'rgba(255,255,255,0.03)',border:i===0?'1px solid rgba(74,222,128,0.2)':'1px solid rgba(255,255,255,0.04)'}}>
                  <div style={{width:26,height:26,borderRadius:'50%',background:i===0?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:i===0?'#4ade80':'var(--text-sub)',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,fontWeight:500,color:'var(--text)',fontSize:'0.875rem'}}>{s.store}</div>
                  <div style={{fontSize:'0.78rem',color:i===0?'#4ade80':'var(--text-muted)'}}>זול ב-{s.count} מוצרים</div>
                  {i===0 && <span style={{fontSize:'0.68rem',padding:'0.15rem 0.4rem',borderRadius:'9999px',background:'rgba(74,222,128,0.15)',color:'#4ade80'}}>✅ מומלץ</span>}
                </div>
              ))}
            </div>
          )}

          {priceComparison.length === 0 ? (
            <div className="page-card" style={{textAlign:'center',padding:'3rem'}}>
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🏪</div>
              <h3 style={{color:'var(--text-sub)',margin:'0 0 0.5rem'}}>אין עדיין נתונים להשוואה</h3>
              <p style={{color:'var(--text-dim)',fontSize:'0.85rem',margin:'0 0 1.5rem'}}>הוסף ידנית מחיר מוצר בחנויות שונות או הוסף טרנזקציות בפורמט:<br/><strong style={{color:'#a78bfa'}}>"שם חנות — שם מוצר"</strong></p>
              <button className="btn-primary" onClick={openAdd} style={{margin:'0 auto',justifyContent:'center'}}><Plus size={15}/>הוסף מחיר ידני</button>
            </div>
          ) : (
            priceComparison.map((p, idx) => (
              <div key={idx} className="page-card" style={{padding:'1rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
                  <div style={{fontWeight:600,color:'var(--text)',fontSize:'0.95rem',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingLeft:'0.5rem'}}>{p.product}</div>
                  <span style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem',borderRadius:'9999px',background:'rgba(74,222,128,0.12)',color:'#4ade80',flexShrink:0,fontWeight:600}}>חיסכון {p.savingPct.toFixed(0)}%</span>
                </div>
                {p.stores.map((s, si) => {
                  const isCheapest = si === 0
                  const diffPct = si === 0 ? 0 : ((s.avg - p.stores[0].avg) / p.stores[0].avg * 100)
                  return (
                    <div key={s.store} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.45rem 0.625rem',borderRadius:'0.5rem',marginBottom:'0.25rem',background:isCheapest?'rgba(74,222,128,0.07)':'rgba(255,255,255,0.03)',border:isCheapest?'1px solid rgba(74,222,128,0.15)':'1px solid transparent'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:isCheapest?'#4ade80':'var(--text-dim)',flexShrink:0}}/>
                      <div style={{flex:1,fontSize:'0.82rem',color:isCheapest?'var(--text)':'var(--text-sub)'}}>{s.store}</div>
                      <div style={{width:55,height:4,borderRadius:'9999px',background:'rgba(255,255,255,0.06)',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${(s.avg/p.stores[p.stores.length-1].avg)*100}%`,background:isCheapest?'#4ade80':'#6c63ff',borderRadius:'9999px'}}/>
                      </div>
                      <div style={{fontSize:'0.85rem',fontWeight:700,color:isCheapest?'#4ade80':'var(--text)',minWidth:52,textAlign:'left',direction:'ltr'}}>₪{s.avg.toFixed(2)}</div>
                      {!isCheapest && <div style={{fontSize:'0.7rem',color:'#f87171',minWidth:30}}>+{diffPct.toFixed(0)}%</div>}
                      {isCheapest  && <div style={{fontSize:'0.7rem',color:'#4ade80',minWidth:30}}>✅</div>}
                    </div>
                  )
                })}
              </div>
            ))
          )}

          {/* Manual entries list */}
          {manual.length > 0 && (
            <div className="page-card">
              <h2 style={{margin:'0 0 0.875rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text-sub)'}}>✏️ ערכים ידניים ({manual.length})</h2>
              {manual.map((m, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem 0.75rem',borderRadius:'0.625rem',background:'rgba(255,255,255,0.03)',marginBottom:'0.375rem'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.85rem',fontWeight:500,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.product}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{m.store} · ₪{Number(m.price).toFixed(2)}</div>
                  </div>
                  <button onClick={()=>openEdit(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#a78bfa',padding:'0.25rem'}}><Pencil size={14}/></button>
                  <button onClick={()=>deleteEntry(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem'}}><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── trends ── */}
      {activeTab === 'trends' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div className="page-card">
            <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text-sub)'}}>📅 השוואה חודשית</h2>
            <div style={{display:'flex',gap:'0.75rem'}}>
              {monthlyComp.map((m, i) => (
                <div key={i} style={{flex:1,padding:'1rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',textAlign:'center'}}>
                  <div style={{fontSize:'0.78rem',color:'var(--text-muted)',marginBottom:'0.4rem'}}>{m.label}</div>
                  <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--text)'}}>₪{m.total.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                  {i>0&&monthlyComp[i-1].total>0&&(
                    <div style={{fontSize:'0.72rem',marginTop:'0.25rem',color:m.total>monthlyComp[i-1].total?'#f87171':'#4ade80'}}>
                      {m.total>monthlyComp[i-1].total?'↑':'↓'} {Math.abs(((m.total-monthlyComp[i-1].total)/monthlyComp[i-1].total)*100).toFixed(1)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {priceChanges.length > 0 && (
            <div className="page-card">
              <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text-sub)'}}>💰 שינויי מחיר</h2>
              {priceChanges.map((p,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)',marginBottom:'0.375rem'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,color:'var(--text)',fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{p.count} רכישות | ₪{p.first.toFixed(2)} → ₪{p.last.toFixed(2)}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'0.25rem',fontWeight:700,color:p.delta>0?'#f87171':'#4ade80',flexShrink:0}}>
                    {p.delta>0?<TrendingUp size={14}/>:<TrendingDown size={14}/>}
                    {Math.abs(p.delta).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── top ── */}
      {activeTab === 'top' && top5.length > 0 && (
        <div className="page-card">
          <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text-sub)'}}>🛒 נרכש הכי הרבה</h2>
          {top5.map((item,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.625rem 0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)',marginBottom:'0.375rem'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:i<3?'linear-gradient(135deg,#6c63ff,#8b5cf6)':'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:'#fff',flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,fontWeight:500,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
              <div style={{fontSize:'0.85rem',color:'#a78bfa',fontWeight:600}}>{item.count}×</div>
            </div>
          ))}
        </div>
      )}

      {/* Floating + button — compare tab only */}
      {activeTab !== 'stores' && (
        <button onClick={openAdd}
          style={{position:'fixed',bottom:'2rem',left:'2rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:50,transition:'transform 0.2s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          <Plus size={24} color="#fff"/>
        </button>
      )}

      {/* Add/Edit panel */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setShowAdd(false)}>
          <div style={{width:'100%',background:'#1a1a2e',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
              <span style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>{editIdx!==null?'ערוך מחיר':'הוסף מחיר ידני'}</span>
              <button onClick={()=>setShowAdd(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
              <div>
                <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.3rem'}}>שם מוצר</label>
                <input className="input-field" placeholder='לדוגמה: חלב 1%' value={form.product} onChange={e=>setForm(f=>({...f,product:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.3rem'}}>שם חנות</label>
                <input className="input-field" placeholder='לדוגמה: רמי לוי' value={form.store} onChange={e=>setForm(f=>({...f,store:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.3rem'}}>מחיר (₪)</label>
                <input className="input-field" type="number" placeholder='0.00' step="0.01" dir="ltr" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
              </div>
              <div style={{display:'flex',gap:'0.75rem',marginTop:'0.25rem'}}>
                <button className="btn-ghost" onClick={()=>setShowAdd(false)} style={{flex:1,justifyContent:'center'}}>ביטול</button>
                <button className="btn-primary" onClick={saveEntry} style={{flex:1,justifyContent:'center'}}><Check size={15}/>{editIdx!==null?'עדכן':'הוסף'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
