import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, Settings, BarChart2, History, Lightbulb, ScanLine, Archive, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import AddTransactionSheet from '../components/AddTransactionSheet'
import toast from 'react-hot-toast'

const COLORS = ['#6c63ff','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#a78bfa','#34d399']

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="stat-card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
        <span style={{fontSize:'0.8rem',color:'#64748b'}}>{label}</span>
        <div style={{width:36,height:36,borderRadius:'0.75rem',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center',color}}>{icon}</div>
      </div>
      <div style={{fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0',marginBottom:'0.25rem'}}>{value}</div>
      {sub && <div style={{fontSize:'0.75rem',color:'#64748b'}}>{sub}</div>}
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
    const events = []
    ;(txData || []).filter(t => t.date === todayStr).forEach(t => {
      events.push({ type: 'transaction', icon: t.type === 'income' ? '💰' : t.type === 'transfer' ? '↔️' : t.type.startsWith('loan') ? '🏦' : '💸', label: t.description, sub: `${t.type === 'income' ? '+' : t.type === 'transfer' ? '↔' : '-'}₪${Number(t.amount).toLocaleString()}`, route: '/transactions', color: t.type === 'income' ? '#4ade80' : t.type === 'transfer' ? '#22d3ee' : t.type.startsWith('loan') ? '#fbbf24' : '#f87171' })
    })
    const { data: remData } = await supabase.from('reminders').select('*').eq('due_date', todayStr)
    ;(remData || []).forEach(r => {
      events.push({ type: 'reminder', icon: r.completed ? '✅' : new Date(r.due_date) < now ? '⚠️' : '🔔', label: r.title, sub: r.completed ? 'הושלם' : 'תזכורת', route: '/reminders', color: r.completed ? '#4ade80' : '#fbbf24' })
    })
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
          <h1 style={{margin:0,fontSize:'3.5rem',fontWeight:400,fontFamily:'"Pacifico", cursive',color:'rgba(255,255,255,0.18)',lineHeight:1.1}}>
            Hersko
          </h1>
          <p style={{margin:'0.25rem 0 0',color:'#64748b',fontSize:'0.875rem'}}>
            {today.toLocaleDateString('he-IL', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <div>
          <button className="btn-primary" onClick={() => setShowAddTx(true)}><Plus size={15}/>הוסף עסקה</button>
        </div>
      </div>

      {/* Daily widget */}
      <div className="page-card">
        <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>
          📅 אירועי היום — {today.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })}
        </h3>
        {todayEvents.length === 0
          ? <div style={{padding:'1rem 0',textAlign:'center',color:'#475569',fontSize:'0.875rem'}}>אין אירועים להיום 🎉</div>
          : <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {todayEvents.map((ev, i) => (
                <div key={i} onClick={() => navigate(ev.route)}
                  style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',transition:'all 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                  <div style={{width:36,height:36,borderRadius:'0.75rem',background:`${ev.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0}}>{ev.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,color:'#e2e8f0',fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</div>
                    <div style={{fontSize:'0.75rem',color:'#64748b',marginTop:'0.1rem'}}>{ev.sub}</div>
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
          <span style={{fontSize:'0.8rem',fontWeight:600,color:'#64748b'}}>כלים</span>
        </div>
        {[
          { icon: <History size={18}/>, label: 'היסטוריה', sub: 'יומן פעילות ושינויים', color: '#4ade80', route: '/history' },
          { icon: <Settings size={18}/>, label: 'הגדרות', sub: 'ניהול משתמשים והעדפות', color: '#60a5fa', route: '/settings' },
        ].map((item, i, arr) => (
          <div key={item.route} onClick={() => navigate(item.route)}
            style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.875rem 1rem',cursor:'pointer',transition:'background 0.15s',borderBottom: i < arr.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{width:38,height:38,borderRadius:'0.75rem',background:`${item.color}20`,display:'flex',alignItems:'center',justifyContent:'center',color:item.color,flexShrink:0}}>{item.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'#e2e8f0'}}>{item.label}</div>
              <div style={{fontSize:'0.75rem',color:'#64748b',marginTop:'0.1rem'}}>{item.sub}</div>
            </div>
            <div style={{color:'#475569',fontSize:'0.8rem'}}>›</div>
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
