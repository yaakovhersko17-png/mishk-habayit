import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, Settings, BarChart2, Lightbulb, ScanLine, Archive, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SplashScreen from '../components/SplashScreen'
import AddTransactionSheet from '../components/AddTransactionSheet'
import ShoppingCard from '../components/ShoppingCard'
import { useSuccess } from '../context/SuccessContext'
import { getHebrewDate } from '../lib/hebrewDate'

const DAYS_HE   = ['א','ב','ג','ד','ה','ו','ש']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function ds(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function getWeekStart(d) { const s=new Date(d); s.setDate(s.getDate()-s.getDay()); return s }

const COLORS = ['#6c63ff','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#a78bfa','#34d399']

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="stat-card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
        <span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>{label}</span>
        <div style={{width:36,height:36,borderRadius:'0.75rem',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center',color}}>{icon}</div>
      </div>
      <div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--text)',marginBottom:'0.25rem'}}>{value}</div>
      {sub && <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate   = useNavigate()
  const showSuccess = useSuccess()
  const [loading, setLoading]           = useState(true)
  const [wallets, setWallets]           = useState([])
  const [monthlyData, setMonthlyData]   = useState({ income: 0, expense: 0, loans: [] })
  const [showAddTx, setShowAddTx]       = useState(false)
  const [splashFading, setSplashFading] = useState(false)
  const [revealed, setRevealed]         = useState(false)
  const [glowActive, setGlowActive]     = useState(true)

  // Hebrew date — recalculated every minute so it flips at sunset automatically
  const [hebrewDate, setHebrewDate] = useState(() => getHebrewDate())
  useEffect(() => {
    const t = setInterval(() => setHebrewDate(getHebrewDate()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Calendar widget state
  const today = new Date()
  const [calView, setCalView]     = useState('day')   // 'day' | 'week' | 'month'
  const [calDate, setCalDate]     = useState(new Date())
  const [calEvents, setCalEvents] = useState([])       // raw events for current period
  const [calLoading, setCalLoading] = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => { loadCalendar(calView, calDate) }, [calView, calDate]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => setGlowActive(false), 5000)
    return () => clearTimeout(t)
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: walletsData }, { data: txData }] = await Promise.all([
      withRetry(() => supabase.from('wallets').select('*').order('created_at')),
      withRetry(() => supabase.from('transactions').select('*,categories(name,color),profiles(name)').order('date', { ascending: false })),
    ])
    setWallets(walletsData || [])
    const now = new Date()
    const monthTxs = (txData || []).filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const income  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const loans   = (txData || []).filter(t => t.type.startsWith('loan') || t.type === 'debt_unpaid')
    setMonthlyData({ income, expense, loans })
    setLoading(false)
    setSplashFading(true)
    setTimeout(() => setRevealed(true), 550)
  }

  async function loadCalendar(view, date) {
    setCalLoading(true)
    let from, to
    if (view === 'day') {
      from = ds(date); to = ds(date)
    } else if (view === 'week') {
      const s = getWeekStart(date); from = ds(s)
      const e = new Date(s); e.setDate(e.getDate()+6); to = ds(e)
    } else {
      const y=date.getFullYear(), m=date.getMonth()
      from=`${y}-${String(m+1).padStart(2,'0')}-01`
      to=`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    }
    const tom = new Date(new Date(from).getTime()+86400000).toISOString().split('T')[0]
    const [{ data: txData }, { data: calEvData }, { data: remData }] = await Promise.all([
      supabase.from('transactions').select('date,type,amount,description,currency').gte('date',from).lte('date',to),
      supabase.from('calendar_events').select('title,event_date,event_time,description').gte('event_date',from).lte('event_date',to),
      view === 'day'
        ? supabase.from('reminders').select('title,due_date,is_completed').gte('due_date',from+'T00:00:00').lt('due_date',tom+'T00:00:00')
        : supabase.from('reminders').select('title,due_date,is_completed').gte('due_date',from+'T00:00:00').lte('due_date',to+'T23:59:59'),
    ])
    // Build per-date buckets
    const byDate = {}
    const addEv = (dateKey, ev) => { if(!byDate[dateKey]) byDate[dateKey]=[]; byDate[dateKey].push(ev) }
    ;(txData||[]).forEach(t => addEv(t.date, { type:'tx', icon:t.type==='income'?'💰':t.type==='transfer'?'↔️':t.type.startsWith('loan')||t.type==='debt_unpaid'?'🏦':'💸', label:t.description, sub:`${t.type==='income'?'+':'-'}${t.currency||'₪'}${Number(t.amount).toLocaleString()}`, route:'/transactions', color:t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type.startsWith('loan')||t.type==='debt_unpaid'?'#fbbf24':'#f87171', date:t.date }))
    ;(calEvData||[]).forEach(e => addEv(e.event_date, { type:'event', icon:'📅', label:e.title, sub:e.event_time?`🕐 ${e.event_time.slice(0,5)}`:'אירוע', route:'/calendar', color:'#22d3ee', date:e.event_date }))
    ;(remData||[]).forEach(r => { const d=r.due_date?.split('T')[0]; if(d) addEv(d, { type:'reminder', icon:r.is_completed?'✅':new Date(r.due_date)<today?'⚠️':'🔔', label:r.title, sub:r.is_completed?'הושלם':'תזכורת', route:'/reminders', color:r.is_completed?'#4ade80':'#fbbf24', date:d }) })
    setCalEvents(byDate)
    setCalLoading(false)
  }

  function calPrev() {
    setCalDate(d => {
      const n = new Date(d)
      if (calView==='day')   n.setDate(n.getDate()-1)
      else if (calView==='week') n.setDate(n.getDate()-7)
      else n.setMonth(n.getMonth()-1)
      return n
    })
  }
  function calNext() {
    setCalDate(d => {
      const n = new Date(d)
      if (calView==='day')   n.setDate(n.getDate()+1)
      else if (calView==='week') n.setDate(n.getDate()+7)
      else n.setMonth(n.getMonth()+1)
      return n
    })
  }
  function calTitle() {
    if (calView==='day') {
      const isToday = ds(calDate)===ds(today)
      return isToday ? `היום — ${calDate.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'})}` : calDate.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    }
    if (calView==='week') {
      const s=getWeekStart(calDate), e=new Date(s); e.setDate(e.getDate()+6)
      return `${s.getDate()}–${e.getDate()} ${MONTHS_HE[s.getMonth()]}`
    }
    return `${MONTHS_HE[calDate.getMonth()]} ${calDate.getFullYear()}`
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans = monthlyData.loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))

  if (loading) return <LoadingSpinner text="טוען נתונים..." />

  // Calendar render helpers
  const todayStr = ds(today)
  const dayEvents = calEvents[ds(calDate)] || []
  const weekDays  = Array.from({length:7},(_,i)=>{ const d=new Date(getWeekStart(calDate)); d.setDate(d.getDate()+i); return d })
  const monthYear = calDate.getFullYear(), monthM = calDate.getMonth()
  const firstDay  = new Date(monthYear,monthM,1).getDay()
  const daysInMonth = new Date(monthYear,monthM+1,0).getDate()
  const monthCells = []
  for(let i=0;i<firstDay;i++) monthCells.push(null)
  for(let d=1;d<=daysInMonth;d++) monthCells.push(d)

  return (
    <>
      <SplashScreen fading={splashFading} />
      <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      {/* Greeting */}
      <div className={`stagger-item${revealed?' revealed':''}`} style={{display:'flex',alignItems:'center',justifyContent:'flex-end'}}>
        <button className={`btn-primary${glowActive?' btn-glow-active':''}`} onClick={() => setShowAddTx(true)}><Plus size={15}/>הוסף עסקה</button>
      </div>

      {/* ── Calendar widget ───────────────────────────────── */}
      <div className={`page-card stagger-item${revealed?' revealed':''}`} style={{padding:0,overflow:'hidden'}}>
        {/* Widget header */}
        <div style={{padding:'0.875rem 1rem',display:'flex',flexDirection:'column',gap:'0.625rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          {/* Nav row */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <button onClick={calPrev} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'var(--text)',padding:'0.3rem',display:'flex'}}><ChevronRight size={16}/></button>
            <button onClick={()=>{ setCalView('day'); setCalDate(new Date()) }} style={{fontWeight:600,fontSize:'0.875rem',color:'var(--text)',background:'none',border:'none',cursor:'pointer',flex:1,textAlign:'center'}}>
              {calTitle()}
            </button>
            <button onClick={calNext} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'var(--text)',padding:'0.3rem',display:'flex'}}><ChevronLeft size={16}/></button>
          </div>
          {/* Hebrew date */}
          {hebrewDate && (
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              gap:'0.5rem', padding:'0.25rem 0',
            }}>
              <span style={{
                fontSize:'0.72rem', fontWeight:600, color:'#a78bfa',
                letterSpacing:'0.03em', direction:'rtl',
              }}>✡ {hebrewDate}</span>
            </div>
          )}
          {/* View tabs */}
          <div style={{display:'flex',gap:'0.375rem'}}>
            {[['day','יומי'],['week','שבועי'],['month','חודשי']].map(([v,l])=>(
              <button key={v} onClick={()=>setCalView(v)} style={{flex:1,padding:'0.3rem',borderRadius:'0.5rem',fontSize:'0.75rem',cursor:'pointer',
                border:`1px solid ${calView===v?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.07)'}`,
                background:calView===v?'rgba(108,99,255,0.18)':'transparent',
                color:calView===v?'#a78bfa':'var(--text-muted)',fontWeight:calView===v?600:400,transition:'all 0.15s'}}>{l}</button>
            ))}
          </div>
        </div>

        {/* Widget body */}
        <div style={{padding:'0.875rem 1rem',minHeight:120}}>
          {calLoading ? (
            <div style={{textAlign:'center',padding:'1.5rem 0',color:'var(--text-dim)',fontSize:'0.8rem'}}>טוען...</div>
          ) : calView==='day' ? (
            /* ── Day view ── */
            dayEvents.length === 0
              ? <div style={{textAlign:'center',padding:'1.25rem 0',color:'var(--text-dim)',fontSize:'0.85rem'}}>אין אירועים להיום 🎉</div>
              : <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  {dayEvents.map((ev,i)=>(
                    <div key={i} onClick={()=>navigate(ev.route)}
                      style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.6rem 0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',transition:'background 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                      <div style={{width:32,height:32,borderRadius:'0.625rem',background:`${ev.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>{ev.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:500,color:'var(--text)',fontSize:'0.825rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</div>
                        <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginTop:'0.075rem'}}>{ev.sub}</div>
                      </div>
                      <div style={{fontSize:'0.7rem',color:ev.color,fontWeight:600,flexShrink:0}}>›</div>
                    </div>
                  ))}
                </div>

          ) : calView==='week' ? (
            /* ── Week view ── */
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem'}}>
              {weekDays.map((d,i)=>{
                const dKey=ds(d)
                const evs=calEvents[dKey]||[]
                const isToday=dKey===todayStr
                return (
                  <div key={i} onClick={()=>{setCalDate(d);setCalView('day')}} style={{
                    display:'flex',flexDirection:'column',alignItems:'center',gap:'0.25rem',
                    padding:'0.5rem 0.25rem',borderRadius:'0.625rem',cursor:'pointer',transition:'background 0.15s',
                    background:isToday?'rgba(108,99,255,0.15)':'transparent',
                    border:`1px solid ${isToday?'rgba(108,99,255,0.3)':'transparent'}`,
                  }}
                    onMouseEnter={e=>!isToday&&(e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                    onMouseLeave={e=>!isToday&&(e.currentTarget.style.background='transparent')}>
                    <div style={{fontSize:'0.65rem',color:'var(--text-muted)',fontWeight:600}}>{DAYS_HE[i]}</div>
                    <div style={{fontSize:'0.875rem',fontWeight:isToday?700:400,color:isToday?'#a78bfa':'var(--text)'}}>{d.getDate()}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'2px',justifyContent:'center',minHeight:14}}>
                      {evs.slice(0,3).map((ev,j)=>(
                        <div key={j} style={{width:5,height:5,borderRadius:'50%',background:ev.color}}/>
                      ))}
                    </div>
                    {evs.length>0 && <div style={{fontSize:'0.6rem',color:'var(--text-dim)'}}>{evs.length}</div>}
                  </div>
                )
              })}
            </div>

          ) : (
            /* ── Month view ── */
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.125rem',marginBottom:'0.25rem'}}>
                {DAYS_HE.map(d=><div key={d} style={{textAlign:'center',fontSize:'0.6rem',color:'var(--text-muted)',fontWeight:600,padding:'0.125rem'}}>{d}</div>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.125rem'}}>
                {monthCells.map((day,i)=>{
                  if(!day) return <div key={`e${i}`}/>
                  const dKey=`${monthYear}-${String(monthM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const evs=calEvents[dKey]||[]
                  const isToday=dKey===todayStr
                  return (
                    <div key={dKey} onClick={()=>{setCalDate(new Date(monthYear,monthM,day));setCalView('day')}} style={{
                      display:'flex',flexDirection:'column',alignItems:'center',padding:'0.25rem 0.125rem',
                      borderRadius:'0.4rem',cursor:'pointer',position:'relative',
                      background:isToday?'rgba(108,99,255,0.2)':'transparent',
                      border:`1px solid ${isToday?'rgba(108,99,255,0.4)':'transparent'}`,
                      transition:'background 0.1s',
                    }}
                      onMouseEnter={e=>!isToday&&(e.currentTarget.style.background='rgba(255,255,255,0.05)')}
                      onMouseLeave={e=>!isToday&&(e.currentTarget.style.background='transparent')}>
                      <span style={{fontSize:'0.72rem',fontWeight:isToday?700:400,color:isToday?'#a78bfa':'var(--text)'}}>{day}</span>
                      {evs.length>0 && <div style={{display:'flex',gap:'1px',marginTop:'2px'}}>
                        {evs.slice(0,3).map((ev,j)=><div key={j} style={{width:4,height:4,borderRadius:'50%',background:ev.color}}/>)}
                      </div>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — navigate to full calendar */}
        <div style={{padding:'0.5rem 1rem',borderTop:'1px solid rgba(255,255,255,0.04)',display:'flex',justifyContent:'center'}}>
          <button onClick={()=>navigate('/calendar')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--text-dim)',padding:'0.25rem 0.5rem'}}>
            לוח שנה מלא →
          </button>
        </div>
      </div>

      {/* Shopping Card */}
      <div className={`stagger-item${revealed?' revealed':''}`}>
        <ShoppingCard />
      </div>

      {/* Finance button */}
      <div className={`stagger-item${revealed?' revealed':''}`} style={{display:'flex',justifyContent:'center'}}>
        <button className="finance-btn" onClick={() => navigate('/finance')}>
          <strong className="finance-btn__label">סקירה פיננסית</strong>
          <div className="finance-btn__stars-container">
            <div className="finance-btn__stars" />
          </div>
          <div className="finance-btn__glow">
            <div className="finance-btn__circle" />
            <div className="finance-btn__circle" />
          </div>
        </button>
      </div>

      {/* Quick links */}
      <div className={`page-card stagger-item${revealed?' revealed':''}`} style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'0.875rem 1rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{fontSize:'0.8rem',fontWeight:600,color:'var(--text-muted)'}}>כלים</span>
        </div>
        {[
          { icon: <Settings size={18}/>, label: 'הגדרות', sub: 'ניהול משתמשים והעדפות', color: '#60a5fa', route: '/settings' },
        ].map((item, i, arr) => (
          <div key={item.route} onClick={() => navigate(item.route)}
            style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.875rem 1rem',cursor:'pointer',transition:'background 0.15s',borderBottom: i < arr.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{width:38,height:38,borderRadius:'0.75rem',background:`${item.color}20`,display:'flex',alignItems:'center',justifyContent:'center',color:item.color,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'var(--text)'}}>{item.label}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{item.sub}</div>
            </div>
            <div style={{color:'var(--text-dim)',fontSize:'0.8rem'}}>›</div>
          </div>
        ))}
      </div>

      <AddTransactionSheet
        open={showAddTx}
        onClose={() => setShowAddTx(false)}
        onSaved={() => { loadData(); loadCalendar(calView, calDate); showSuccess('העסקה נוספה בהצלחה!') }}
      />
    </div>
    </>
  )
}
