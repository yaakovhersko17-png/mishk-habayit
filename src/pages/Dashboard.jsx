import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, cached, invalidate, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, Mic, Bell, Receipt, CreditCard as LoanIcon } from 'lucide-react'
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
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
  const [chartData, setChartData]       = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [showAddTx, setShowAddTx]       = useState(false)
  const [tx, setTx] = useState({ type:'expense', description:'', amount:'', wallet_id:'', category_id:'', date: new Date().toISOString().split('T')[0] })
  const [categories, setCategories]     = useState([])
  const [saving, setSaving]             = useState(false)
  const [todayEvents, setTodayEvents]   = useState([])
  const today = new Date()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: walletsData }, { data: txData }, { data: cats }] = await Promise.all([
      withRetry(() => supabase.from('wallets').select('*').order('created_at')),
      withRetry(() => supabase.from('transactions').select('*,categories(name,color),profiles(name)').order('date', { ascending: false })),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
    ])
    setWallets(walletsData || [])
    setCategories(cats || [])

    const now = new Date()
    const monthTxs = (txData || []).filter(t => {
      const d = new Date(t.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const income  = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const loans   = (txData || []).filter(t => t.type.startsWith('loan'))
    setMonthlyData({ income, expense, loans })

    // last 6 months line chart
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('he-IL', { month: 'short' })
      const mTxs = (txData || []).filter(t => { const td = new Date(t.date); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() })
      months.push({ name: label, הכנסות: mTxs.filter(t => t.type==='income').reduce((s,t)=>s+Number(t.amount),0), הוצאות: mTxs.filter(t => t.type==='expense').reduce((s,t)=>s+Number(t.amount),0) })
    }
    setChartData(months)

    // category pie
    const catMap = {}
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      const name = t.categories?.name || 'אחר'
      catMap[name] = (catMap[name] || 0) + Number(t.amount)
    })
    setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })))

    // Today's events for daily widget
    const todayStr = now.toISOString().split('T')[0]
    const events = []
    ;(txData || []).filter(t => t.date === todayStr).forEach(t => {
      events.push({ type: 'transaction', icon: t.type === 'income' ? '💰' : t.type.startsWith('loan') ? '🏦' : '💸', label: t.description, sub: `${t.type === 'income' ? '+' : '-'}₪${Number(t.amount).toLocaleString()}`, route: '/transactions', color: t.type === 'income' ? '#4ade80' : t.type.startsWith('loan') ? '#fbbf24' : '#f87171' })
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

  async function handleAddTx() {
    if (!tx.description || !tx.amount) { toast.error('מלא תיאור וסכום'); return }
    setSaving(true)
    const { error } = await withRetry(() => supabase.from('transactions').insert({ ...tx, amount: Number(tx.amount), user_id: user.id }))
    if (error) { toast.error('שגיאה בשמירה'); setSaving(false); return }
    // update wallet balance
    if (tx.wallet_id) {
      const wallet = wallets.find(w => w.id === tx.wallet_id)
      if (wallet) {
        const delta = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
        await supabase.from('wallets').update({ balance: wallet.balance + delta }).eq('id', wallet.id)
      }
    }
    await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.CREATE, entityType: ENTITY_TYPES.TRANSACTION, description: `הוסיף/ה טרנזקציה: ${tx.description} – ${tx.amount}₪` })
    toast.success('טרנזקציה נוספה!')
    setShowAddTx(false)
    setTx({ type:'expense', description:'', amount:'', wallet_id:'', category_id:'', date: new Date().toISOString().split('T')[0] })
    loadData()
    setSaving(false)
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const openLoans = monthlyData.loans.filter(l => Number(l.loan_returned || 0) < Number(l.amount))

  if (loading) return <LoadingSpinner text="טוען נתונים..." />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      {/* Greeting */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0,fontSize:'2rem',fontWeight:900,letterSpacing:'0.12em',background:'linear-gradient(135deg,#a78bfa,#6c63ff,#60a5fa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
            HERSKO
          </h1>
          <p style={{margin:'0.25rem 0 0',color:'#64748b',fontSize:'0.875rem'}}>
            {today.toLocaleDateString('he-IL', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <div>
          <button className="btn-primary" onClick={() => setShowAddTx(true)}><Plus size={15}/>טרנזקציה חדשה</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'1rem'}}>
        <StatCard icon={<Wallet size={18}/>}      label="יתרה כוללת"         value={`₪${totalBalance.toLocaleString()}`}          color="#6c63ff" />
        <StatCard icon={<TrendingUp size={18}/>}  label="הכנסות החודש"        value={`₪${monthlyData.income.toLocaleString()}`}   color="#4ade80" />
        <StatCard icon={<TrendingDown size={18}/>} label="הוצאות החודש"       value={`₪${monthlyData.expense.toLocaleString()}`}  color="#f87171" />
        <StatCard icon={<CreditCard size={18}/>}  label="הלוואות פתוחות"      value={openLoans.length} color="#fbbf24"
          sub={openLoans.length > 0 ? `₪${openLoans.reduce((s,l)=>s+Number(l.amount)-Number(l.loan_returned||0),0).toLocaleString()} סה"כ` : 'אין הלוואות פתוחות'} />
      </div>

      {/* Charts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
        <div className="page-card">
          <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>הכנסות vs הוצאות – 6 חודשים</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="name" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} width={50}/>
              <Tooltip contentStyle={{background:'#1e1e3a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.75rem',color:'#e2e8f0'}}/>
              <Line type="monotone" dataKey="הכנסות" stroke="#4ade80" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="הוצאות" stroke="#f87171" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="page-card">
          <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>הוצאות לפי קטגוריה</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{background:'#1e1e3a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.75rem',color:'#e2e8f0'}} formatter={(v) => `₪${v.toLocaleString()}`}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontSize:'0.875rem'}}>אין הוצאות החודש</div>}
        </div>
      </div>

      {/* Wallets quick view */}
      {wallets.length > 0 && (
        <div className="page-card">
          <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>ארנקים</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'0.75rem'}}>
            {wallets.map(w => (
              <div key={w.id} onClick={() => navigate('/wallets')} style={{cursor:'pointer',padding:'1rem',borderRadius:'0.75rem',background:`${w.color || '#6c63ff'}15`,border:`1px solid ${w.color || '#6c63ff'}30`,transition:'all 0.2s'}}>
                <div style={{fontSize:'1.25rem',marginBottom:'0.5rem'}}>{w.icon}</div>
                <div style={{fontSize:'0.8rem',color:'#94a3b8',marginBottom:'0.25rem'}}>{w.name}</div>
                <div style={{fontWeight:700,color:'#e2e8f0'}}>{w.currency}{Number(w.balance).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Add Transaction Modal */}
      <Modal open={showAddTx} onClose={() => setShowAddTx(false)} title="טרנזקציה חדשה">
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>סוג</label>
            <select className="input-field" value={tx.type} onChange={e => setTx({...tx, type: e.target.value})}>
              <option value="income">הכנסה</option>
              <option value="expense">הוצאה</option>
              <option value="loan_given">הלוואה שנתתי</option>
              <option value="loan_received">הלוואה שקיבלתי</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תיאור</label>
            <input className="input-field" placeholder="תיאור הטרנזקציה" value={tx.description} onChange={e => setTx({...tx, description: e.target.value})}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>סכום</label>
              <input className="input-field" type="number" placeholder="0.00" value={tx.amount} onChange={e => setTx({...tx, amount: e.target.value})} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תאריך</label>
              <input className="input-field" type="date" value={tx.date} onChange={e => setTx({...tx, date: e.target.value})} dir="ltr"/>
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>ארנק</label>
            <select className="input-field" value={tx.wallet_id} onChange={e => setTx({...tx, wallet_id: e.target.value})}>
              <option value="">בחר ארנק</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>קטגוריה</label>
            <select className="input-field" value={tx.category_id} onChange={e => setTx({...tx, category_id: e.target.value})}>
              <option value="">בחר קטגוריה</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end',marginTop:'0.5rem'}}>
            <button className="btn-ghost" onClick={() => setShowAddTx(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleAddTx} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
