import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, Settings, BarChart2, Lightbulb, ScanLine, Archive, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import AddTransactionSheet from '../components/AddTransactionSheet'
import toast from 'react-hot-toast'

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
  const navigate = useNavigate()
  const [loading, setLoading]           = useState(true)
  const [wallets, setWallets]           = useState([])
  const [monthlyData, setMonthlyData]   = useState({ income: 0, expense: 0, loans: [] })
  const [showAddTx, setShowAddTx]       = useState(false)
  const [todayEvents, setTodayEvents]   = useState([])
  const today = new Date()

  useEffect(() => { loadData() }, [])

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
    const loans   = (txData || []).filter(t => t.type.startsWith('loan'))
    setMonthlyData({ income, expense, loans })

    // Today's events for daily widget
    const todayStr = now.toISOString().split('T')[0]
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0]
    const events = []
    ;(txData || []).filter(t => t.date === todayStr).forEach(t => {
      events.push({ type: 'transaction', icon: t.type === 'income' ? '💰' : t.type === 'transfer' ? '↔️' : t.type.startsWith('loan') ? '🏦' : '💸', label: t.description, sub: `${t.type === 'income' ? '+' : t.type === 'transfer' ? '↔' : '-'}₪${Number(t.amount).toLocaleString()}`, route: '/transactions', color: t.type === 'income' ? '#4ade80' : t.type === 'transfer' ? '#22d3ee' : t.type.startsWith('loan') ? '#fbbf24' : '#f87171' })
    })

    // Calendar events today
    const { data: calEvData } = await supabase.from('calendar_events').select('title,description,event_time').eq('event_date', todayStr)
    ;(calEvData || []).forEach(e => {
      const timeSub = e.event_time ? `🕐 ${e.event_time.slice(0,5)}` : 'אירוע'
      events.push({ type: 'calendar_event', icon: '📅', label: e.title, sub: timeSub, route: '/calendar', color: '#22d3ee' })
    })

    // Reminders due today (fix: use date range to handle datetime values, fix field name is_completed)
    const { data: remData } = await supabase.from('reminders').select('*').gte('due_date', todayStr).lt('due_date', tomorrowStr)
    ;(remData || []).forEach(r => {
      events.push({ type: 'reminder', icon: r.is_completed ? '✅' : new Date(r.due_date) < now ? '⚠️' : '🔔', label: r.title, sub: r.is_completed ? 'הושלם' : 'תזכורת', route: '/reminders', color: r.is_completed ? '#4ade80' : '#fbbf24' })
    })

    // Dinner reminder — show only after configured time AND only if not yet logged/skipped today
    try {
      const dinnerDays = JSON.parse(localStorage.getItem('dinner_active_days') || '[0,1,2,3,4,5]')
      const rawTime    = JSON.parse(localStorage.getItem('dinner_default_time') || '"19:00"')
      // Strict parse: must match HH:MM format
      const m = String(rawTime).match(/^(\d{1,2}):(\d{2})$/)
      if (!m) throw new Error('invalid time')
      const dh = parseInt(m[1], 10)
      const dm = parseInt(m[2], 10)
      const dinnerMins = dh * 60 + dm
      const nowH = now.getHours()
      const nowM = now.getMinutes()
      const nowMins = nowH * 60 + nowM
      const todayDow = now.getDay()
      const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      // Guard: valid day + time not midnight + current time has passed dinner time
      if (!Array.isArray(dinnerDays) || !dinnerDays.includes(todayDow)) throw new Error('not dinner day')
      if (dinnerMins === 0) throw new Error('midnight not valid dinner time')
      if (nowMins < dinnerMins) throw new Error('too early')
      const { data: dinnerData } = await supabase.from('dinner_meals').select('id').eq('meal_date', localToday).limit(1)
      if (!dinnerData || dinnerData.length === 0) {
        events.push({ type: 'dinner', icon: '🍽️', label: 'ארוחת ערב', sub: `הוגדרה ל-${rawTime}`, route: '/dinners', color: '#f97316' })
      }
    } catch (_) {}
    const { data: invData } = await supabase.from('invoices').select('business_name,total,currency').eq('date', todayStr)
    ;(invData || []).forEach(inv => {
      events.push({ type: 'invoice', icon: '🧾', label: inv.business_name, sub: `${inv.currency}${Number(inv.total).toLocaleString()}`, route: '/invoices', color: '#a78bfa' })
    })
    setTodayEvents(events)
    setLoading(false)
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans = monthlyData.loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))

  if (loading) return <LoadingSpinner text="טוען נתונים..." />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      {/* Greeting */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 className="hersko-shine" style={{margin:0,fontSize:'3.5rem',fontWeight:400,fontFamily:'"Pacifico", cursive',lineHeight:1.1}}>
            Hersko
          </h1>
          <p style={{margin:'0.25rem 0 0',color:'var(--text-muted)',fontSize:'0.875rem'}}>
            {today.toLocaleDateString('he-IL', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <div>
          <button className="btn-primary" onClick={() => setShowAddTx(true)}><Plus size={15}/>הוסף עסקה</button>
        </div>
      </div>

      {/* Daily widget */}
      <div className="page-card">
        <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text-sub)'}}>
          📅 אירועי היום — {today.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })}
        </h3>
        {todayEvents.length === 0
          ? <div style={{padding:'1rem 0',textAlign:'center',color:'var(--text-dim)',fontSize:'0.875rem'}}>אין אירועים להיום 🎉</div>
          : <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {todayEvents.map((ev, i) => (
                <div key={i} onClick={() => navigate(ev.route)}
                  style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',transition:'all 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{width:36,height:36,borderRadius:'0.75rem',background:`${ev.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0}}>{ev.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,color:'var(--text)',fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{ev.sub}</div>
                  </div>
                  <div style={{fontSize:'0.7rem',color:ev.color,fontWeight:600,flexShrink:0,paddingRight:'0.25rem'}}>›</div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Finance button */}
      <div style={{display:'flex',justifyContent:'center'}}>
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
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
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
        onSaved={loadData}
      />
    </div>
  )
}
