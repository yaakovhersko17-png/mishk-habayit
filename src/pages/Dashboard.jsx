import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, cached, invalidate, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Plus, Settings, BarChart2, History, Lightbulb, ScanLine, Archive, ChevronDown } from 'lucide-react'
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
  const [showAddTx, setShowAddTx]       = useState(false)
  const [tx, setTx] = useState({ type:'expense', description:'', amount:'', currency:'₪', wallet_id:'', category_id:'', date: new Date().toISOString().split('T')[0] })
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
    setTx({ type:'expense', description:'', amount:'', currency:'₪', wallet_id:'', category_id:'', date: new Date().toISOString().split('T')[0] })
    loadData()
    setSaving(false)
  }

  const [showFinance, setShowFinance] = useState(false)
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
          <button className="btn-primary" onClick={() => setShowAddTx(true)}><Plus size={15}/>טרנזקציה חדשה</button>
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

      {/* Finance summary — collapsed by default */}
      <div>
        <button
          onClick={() => setShowFinance(v => !v)}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.875rem 1.125rem',borderRadius:'0.875rem',background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.18)',cursor:'pointer',transition:'all 0.2s'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(108,99,255,0.14)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(108,99,255,0.08)'}>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <div style={{width:34,height:34,borderRadius:'0.625rem',background:'rgba(108,99,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Wallet size={16} color="#a78bfa"/>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'0.875rem',fontWeight:600,color:'#e2e8f0'}}>סקירה פיננסית</div>
              <div style={{fontSize:'0.72rem',color:'#64748b',marginTop:'0.1rem'}}>יתרה, הכנסות, הוצאות והלוואות</div>
            </div>
          </div>
          <ChevronDown size={18} color="#64748b" style={{transition:'transform 0.25s',transform: showFinance ? 'rotate(180deg)' : 'rotate(0deg)'}}/>
        </button>

        {showFinance && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'1rem',marginTop:'0.875rem'}}>
            <StatCard icon={<Wallet size={18}/>}       label="יתרה כוללת"    value={`₪${totalBalance.toLocaleString()}`}         color="#6c63ff" />
            <StatCard icon={<TrendingUp size={18}/>}   label="הכנסות החודש"   value={`₪${monthlyData.income.toLocaleString()}`}  color="#4ade80" />
            <StatCard icon={<TrendingDown size={18}/>} label="הוצאות החודש"   value={`₪${monthlyData.expense.toLocaleString()}`} color="#f87171" />
            <StatCard icon={<CreditCard size={18}/>}   label="הלוואות פתוחות" value={openLoans.length} color="#fbbf24"
              sub={openLoans.length > 0 ? `₪${openLoans.reduce((s,l)=>s+Number(l.amount)-Number(l.loan_returned||0),0).toLocaleString()} סה"כ` : 'אין הלוואות פתוחות'} />
          </div>
        )}
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

      {/* Quick links */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'0.875rem 1rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{fontSize:'0.8rem',fontWeight:600,color:'#64748b'}}>כלים</span>
        </div>
        {[
          { icon: <ScanLine size={18}/>, label: 'סריקת חשבונית', sub: 'סרוק חשבונית עם Gemma AI', color: '#6c63ff', route: '/scanner' },
          { icon: <Archive size={18}/>, label: 'ארכיון חשבוניות', sub: 'כל החשבוניות השמורות', color: '#a78bfa', route: '/invoices' },
          { icon: <Lightbulb size={18}/>, label: 'דף חכם', sub: 'השוואת מחירים וניתוח הוצאות', color: '#fbbf24', route: '/insights' },
          { icon: <BarChart2 size={18}/>, label: 'דוחות וייצוא', sub: 'גרפים, תרשימים וייצוא נתונים', color: '#34d399', route: '/reports' },
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
          <div className="form-2col">
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>סכום</label>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <select className="input-field" value={tx.currency} onChange={e => setTx({...tx, currency: e.target.value})} style={{width:70,flexShrink:0}} dir="ltr">
                  <option>₪</option>
                  <option>$</option>
                  <option>€</option>
                  <option>£</option>
                </select>
                <input className="input-field" type="number" placeholder="0.00" value={tx.amount} onChange={e => setTx({...tx, amount: e.target.value})} dir="ltr"/>
              </div>
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
