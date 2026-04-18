import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Wallet, Tag, ArrowLeftRight, ChevronLeft, ChevronDown, ChevronUp,
  ScanLine, Archive, Lightbulb, BarChart2, Plus, Edit2, Trash2,
  RefreshCw, ToggleLeft, ToggleRight, Target, X
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { hapticSuccess } from '../lib/haptic'
import toast from 'react-hot-toast'

const GOAL_ICONS  = ['🎯','🏠','✈️','🚗','💍','📱','🎓','💰','🌴','🏋️','🐕','🎸','💻','👶','🏖️']
const GOAL_COLORS = ['#6c63ff','#4ade80','#f87171','#fbbf24','#22d3ee','#f472b6','#a78bfa','#34d399','#60a5fa','#fb923c']
const EMPTY_GOAL  = { name:'', icon:'🎯', color:'#6c63ff', target_amount:'', current_amount:'', target_date:'' }
const EMPTY_RULE  = { description:'', amount:'', type:'expense', category_id:'', wallet_id:'', day_of_month:1 }

function currentMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
}

function MiniStat({ label, value, color, sub }) {
  return (
    <div style={{padding:'0.875rem',borderRadius:'0.875rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}>
      <div style={{fontSize:'0.72rem',color:'var(--text-muted)',marginBottom:'0.375rem'}}>{label}</div>
      <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--text)'}}>{value}</div>
      {sub && <div style={{fontSize:'0.7rem',color,marginTop:'0.2rem'}}>{sub}</div>}
    </div>
  )
}

function NavRow({ icon, label, sub, color, onClick, isLast }) {
  return (
    <div onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:'0.875rem',
      padding:'0.875rem 1rem',cursor:'pointer',transition:'background 0.15s',
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}
    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      <div style={{width:38,height:38,borderRadius:'0.75rem',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:'0.9rem',fontWeight:600,color:'var(--text)'}}>{label}</div>
        {sub && <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{sub}</div>}
      </div>
      <ChevronLeft size={16} color="var(--text-dim)"/>
    </div>
  )
}

function AccordionRow({ icon, label, sub, color, open, onToggle, hasBorderBottom }) {
  return (
    <div onClick={onToggle} style={{
      display:'flex',alignItems:'center',gap:'0.875rem',
      padding:'0.875rem 1rem',cursor:'pointer',transition:'background 0.15s',
      borderBottom: hasBorderBottom ? '1px solid rgba(255,255,255,0.04)' : 'none',
    }}
    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      <div style={{width:38,height:38,borderRadius:'0.75rem',background:`${color}20`,display:'flex',alignItems:'center',justifyContent:'center',color,flexShrink:0}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:'0.9rem',fontWeight:600,color:'var(--text)'}}>{label}</div>
        {sub && <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{sub}</div>}
      </div>
      {open ? <ChevronUp size={16} color="var(--text-dim)"/> : <ChevronDown size={16} color="var(--text-dim)"/>}
    </div>
  )
}

export default function FinancePage() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  // Base
  const [loading,  setLoading]  = useState(true)
  const [wallets,  setWallets]  = useState([])
  const [monthly,  setMonthly]  = useState({ income:0, expense:0 })
  const [loans,    setLoans]    = useState([])
  const [catCount, setCatCount] = useState(0)

  // Accordion
  const [openSection, setOpenSection] = useState(null)

  // Goals
  const [goals,       setGoals]       = useState([])
  const [goalModal,   setGoalModal]   = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [goalForm,    setGoalForm]    = useState(EMPTY_GOAL)
  const [savingGoal,  setSavingGoal]  = useState(false)
  const [addMoneyModal, setAddMoneyModal] = useState(null)
  const [addAmt,      setAddAmt]      = useState('')

  // Recurring
  const [rules,      setRules]      = useState([])
  const [cats,       setCats]       = useState([])
  const [ruleModal,  setRuleModal]  = useState(false)
  const [editingRule,setEditingRule]= useState(null)
  const [ruleForm,   setRuleForm]   = useState(EMPTY_RULE)
  const [savingRule, setSavingRule] = useState(false)
  const [running,    setRunning]    = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [
      { data: wData }, { data: cData }, { data: txData },
      { data: gData }, { data: rData }, { data: catData },
    ] = await Promise.all([
      supabase.from('wallets').select('*'),
      supabase.from('categories').select('id'),
      supabase.from('transactions').select('type,amount,date,loan_returned'),
      supabase.from('goals').select('*').order('created_at'),
      supabase.from('recurring_rules').select('*').order('day_of_month'),
      supabase.from('categories').select('id,name,icon,color,type'),
    ])
    const w = wData || [], g = gData || [], r = rData || []
    setWallets(w); setCatCount((cData||[]).length); setCats(catData||[])
    setGoals(g); setRules(r)
    const now = new Date()
    const monthTxs = (txData||[]).filter(t => {
      const d = new Date(t.date)
      return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
    })
    setMonthly({
      income:  monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0),
      expense: monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0),
    })
    setLoans((txData||[]).filter(t=>t.type.startsWith('loan')))
    setLoading(false)
    autoRun(true)
  }

  async function autoRun(silent) {
    const today    = new Date()
    const todayDay = today.getDate()
    const thisMonth = currentMonth()
    const { data: freshRules } = await supabase.from('recurring_rules').select('*').eq('is_active', true)
    if (!freshRules?.length) { if (!silent) toast('אין עסקאות חוזרות לביצוע'); return }
    const due = freshRules.filter(r => r.last_run_month !== thisMonth && r.day_of_month <= todayDay)
    if (!due.length) { if (!silent) toast('אין עסקאות חוזרות לביצוע'); return }
    if (!silent) setRunning(true)
    let created = 0
    for (const rule of due) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(rule.day_of_month).padStart(2,'0')}`
      const { error } = await supabase.from('transactions').insert({
        type: rule.type, amount: rule.amount, description: rule.description,
        category_id: rule.category_id||null, wallet_id: rule.wallet_id||null,
        user_id: user.id, date: dateStr,
      })
      if (!error) {
        await supabase.from('recurring_rules').update({ last_run_month: thisMonth }).eq('id', rule.id)
        created++
        if (rule.wallet_id) {
          const { data: wRow } = await supabase.from('wallets').select('balance').eq('id', rule.wallet_id).single()
          if (wRow) {
            const sign = rule.type === 'income' ? 1 : -1
            await supabase.from('wallets').update({ balance: Number(wRow.balance) + sign * Number(rule.amount) }).eq('id', rule.wallet_id)
          }
        }
      }
    }
    if (!silent) { setRunning(false); if (created>0) { toast.success(`${created} עסקאות נוצרו`); load() } }
    else if (created>0) { toast.success(`${created} עסקאות חוזרות הופעלו אוטומטית`,{duration:4000}); load() }
  }

  // ── Goals actions ────────────────────────────────────────────────────────
  function openAddGoal()  { setEditingGoal(null); setGoalForm(EMPTY_GOAL); setGoalModal(true) }
  function openEditGoal(g){ setEditingGoal(g); setGoalForm({ name:g.name, icon:g.icon, color:g.color, target_amount:g.target_amount, current_amount:g.current_amount, target_date:g.target_date||'' }); setGoalModal(true) }

  async function saveGoal() {
    if (!goalForm.name||!goalForm.target_amount) { toast.error('שם וסכום יעד חובה'); return }
    setSavingGoal(true)
    const payload = { name:goalForm.name, icon:goalForm.icon, color:goalForm.color, target_amount:Number(goalForm.target_amount), current_amount:Number(goalForm.current_amount)||0, target_date:goalForm.target_date||null, user_id:user.id }
    if (editingGoal) { await supabase.from('goals').update(payload).eq('id',editingGoal.id); toast.success('יעד עודכן!') }
    else             { await supabase.from('goals').insert(payload); toast.success('יעד נוסף!'); hapticSuccess() }
    setGoalModal(false); setSavingGoal(false); load()
  }

  async function deleteGoal(g) {
    if (!confirm(`למחוק "${g.name}"?`)) return
    await supabase.from('goals').delete().eq('id',g.id)
    toast.success('נמחק'); load()
  }

  async function addMoney() {
    const amt = Number(addAmt)
    if (!amt||amt<=0) { toast.error('סכום לא תקין'); return }
    const newAmt = Math.min(Number(addMoneyModal.current_amount)+amt, Number(addMoneyModal.target_amount))
    await supabase.from('goals').update({ current_amount:newAmt }).eq('id',addMoneyModal.id)
    if (newAmt>=Number(addMoneyModal.target_amount)) { toast.success('🎉 הגעת ליעד!'); hapticSuccess() }
    else toast.success(`נוסף ₪${amt.toLocaleString()}`)
    setAddMoneyModal(null); setAddAmt(''); load()
  }

  // ── Rules actions ────────────────────────────────────────────────────────
  function openAddRule()  { setEditingRule(null); setRuleForm(EMPTY_RULE); setRuleModal(true) }
  function openEditRule(r){ setEditingRule(r); setRuleForm({ description:r.description, amount:r.amount, type:r.type, category_id:r.category_id||'', wallet_id:r.wallet_id||'', day_of_month:r.day_of_month }); setRuleModal(true) }

  async function saveRule() {
    if (!ruleForm.description||!ruleForm.amount) { toast.error('תיאור וסכום חובה'); return }
    setSavingRule(true)
    const payload = { ...ruleForm, amount:Number(ruleForm.amount), day_of_month:Number(ruleForm.day_of_month), category_id:ruleForm.category_id||null, wallet_id:ruleForm.wallet_id||null, user_id:user.id, is_active:true }
    if (editingRule) { await supabase.from('recurring_rules').update(payload).eq('id',editingRule.id); toast.success('כלל עודכן!') }
    else             { await supabase.from('recurring_rules').insert(payload); toast.success('כלל נוסף!') }
    setRuleModal(false); setSavingRule(false); load()
  }

  async function toggleRule(r) {
    await supabase.from('recurring_rules').update({ is_active:!r.is_active }).eq('id',r.id)
    setRules(prev=>prev.map(x=>x.id===r.id?{...x,is_active:!x.is_active}:x))
  }

  async function deleteRule(r) {
    if (!confirm(`למחוק "${r.description}"?`)) return
    await supabase.from('recurring_rules').delete().eq('id',r.id)
    toast.success('נמחק'); load()
  }

  if (loading) return <LoadingSpinner />

  const totalBalance   = wallets.reduce((s,w)=>s+Number(w.balance),0)
  const openLoans      = loans.filter(l=>Number(l.loan_returned||0)<Number(l.amount))
  const thisMonth      = currentMonth()
  const totalGoals     = goals.reduce((s,g)=>s+Number(g.target_amount),0)
  const savedGoals     = goals.reduce((s,g)=>s+Number(g.current_amount),0)
  const doneGoals      = goals.filter(g=>Number(g.current_amount)>=Number(g.target_amount)).length
  const activeRules    = rules.filter(r=>r.is_active).length
  const doneThisMonth  = rules.filter(r=>r.last_run_month===thisMonth).length

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>סקירה פיננסית</h1>

      {/* Stat grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.75rem'}}>
        <MiniStat label="יתרה כוללת"    value={`₪${totalBalance.toLocaleString()}`}    color="#6c63ff" />
        <MiniStat label="הכנסות החודש"   value={`₪${monthly.income.toLocaleString()}`}  color="#4ade80" />
        <MiniStat label="הוצאות החודש"   value={`₪${monthly.expense.toLocaleString()}`} color="#f87171" />
        <MiniStat label="הלוואות פתוחות" value={openLoans.length}                       color="#fbbf24"
          sub={openLoans.length>0?`₪${openLoans.reduce((s,l)=>s+Number(l.amount)-Number(l.loan_returned||0),0).toLocaleString()} סה"כ`:undefined}/>
      </div>

      {/* Accordion nav */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <NavRow icon={<ArrowLeftRight size={18}/>} label="עסקאות"   sub="כל הפעולות הכספיות"         color="#22d3ee" onClick={()=>navigate('/transactions')} />
        <NavRow icon={<Tag size={18}/>}            label="קטגוריות" sub={`${catCount} קטגוריות`}     color="#a78bfa" onClick={()=>navigate('/categories')} />
        <NavRow icon={<Wallet size={18}/>}         label="ארנקים"   sub={`${wallets.length} ארנקים`}  color="#6c63ff" onClick={()=>navigate('/wallets')} />

        {/* Goals accordion */}
        <AccordionRow
          icon={<Target size={18}/>}
          label="יעדי חיסכון"
          sub={`${goals.length} יעדים • ${doneGoals} הושלמו`}
          color="#fbbf24"
          open={openSection==='goals'}
          onToggle={()=>setOpenSection(openSection==='goals'?null:'goals')}
          hasBorderBottom={true}
        />
        {openSection==='goals' && (
          <div style={{padding:'1rem',borderBottom:'1px solid rgba(255,255,255,0.04)',background:'rgba(255,255,255,0.02)'}}>
            {goals.length>0 && (
              <div style={{marginBottom:'0.875rem',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(108,99,255,0.1)',border:'1px solid rgba(108,99,255,0.2)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.8rem',color:'var(--text-sub)',marginBottom:'0.5rem'}}>
                  <span>נחסך: <b style={{color:'var(--text)'}}>₪{savedGoals.toLocaleString()}</b></span>
                  <span>יעד: <b style={{color:'var(--c-primary)'}}>₪{totalGoals.toLocaleString()}</b></span>
                  <span>{doneGoals}/{goals.length} הושלמו</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{width:totalGoals>0?`${Math.round(savedGoals/totalGoals*100)}%`:'0%',background:'linear-gradient(90deg,#6c63ff,#a78bfa)'}}/>
                </div>
              </div>
            )}
            {goals.length===0 ? (
              <div style={{textAlign:'center',padding:'1.5rem 0',color:'var(--text-dim)',fontSize:'0.875rem'}}>
                <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>🎯</div>
                אין יעדים עדיין
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'0.625rem',marginBottom:'0.875rem'}}>
                {goals.map(g=>{
                  const cur=Number(g.current_amount), tgt=Number(g.target_amount)
                  const p=tgt>0?Math.min(cur/tgt*100,100):0
                  const isDone=cur>=tgt
                  const daysLeft=g.target_date?Math.ceil((new Date(g.target_date)-new Date())/86400000):null
                  return (
                    <div key={g.id} style={{padding:'0.75rem',borderRadius:'0.75rem',background:isDone?'var(--c-income-bg)':'var(--surface)',border:`1px solid ${isDone?'var(--c-income-bdr)':'var(--border)'}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.625rem',marginBottom:'0.5rem'}}>
                        <div style={{width:34,height:34,borderRadius:'0.625rem',background:`${g.color}20`,border:`1px solid ${g.color}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0}}>{g.icon}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:'0.875rem',color:'var(--text)'}}>{g.name}</div>
                          <div style={{fontSize:'0.72rem',color:'var(--text-muted)',display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                            <span>₪{cur.toLocaleString()} / ₪{tgt.toLocaleString()}</span>
                            {daysLeft!==null && <span style={{color:daysLeft<0?'var(--c-expense)':daysLeft<30?'var(--c-loan)':'var(--text-dim)'}}>{daysLeft<0?`עבר ב-${Math.abs(daysLeft)} ימים`:`${daysLeft} ימים נותרו`}</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:'0.25rem',alignItems:'center'}}>
                          {!isDone && <button onClick={()=>{setAddMoneyModal(g);setAddAmt('')}} style={{background:`${g.color}20`,border:`1px solid ${g.color}40`,color:g.color,borderRadius:'0.5rem',padding:'0.25rem 0.6rem',cursor:'pointer',fontSize:'0.72rem',fontWeight:600}}>+ הוסף</button>}
                          <button onClick={()=>openEditGoal(g)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.25rem'}}><Edit2 size={13}/></button>
                          <button onClick={()=>deleteGoal(g)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--c-expense)',padding:'0.25rem'}}><Trash2 size={13}/></button>
                        </div>
                      </div>
                      <div className="progress-track" style={{height:6}}>
                        <div className="progress-fill" style={{width:`${p}%`,background:isDone?'var(--c-income)':`linear-gradient(90deg,${g.color},${g.color}cc)`}}/>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:'0.3rem',fontSize:'0.68rem',color:'var(--text-dim)'}}>
                        <span>{Math.round(p)}%</span>
                        <span>נשאר ₪{Math.max(tgt-cur,0).toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button className="btn-primary" onClick={openAddGoal} style={{width:'100%',justifyContent:'center'}}>
              <Plus size={14}/>יעד חדש
            </button>
          </div>
        )}

        {/* Recurring accordion */}
        <AccordionRow
          icon={<RefreshCw size={18}/>}
          label="עסקאות חוזרות"
          sub={`${activeRules} פעילות • ${doneThisMonth} בוצעו החודש`}
          color="#34d399"
          open={openSection==='recurring'}
          onToggle={()=>setOpenSection(openSection==='recurring'?null:'recurring')}
          hasBorderBottom={openSection==='recurring'}
        />
        {openSection==='recurring' && (
          <div style={{padding:'1rem',background:'rgba(255,255,255,0.02)'}}>
            {rules.length>0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.5rem',marginBottom:'0.875rem'}}>
                {[{label:'פעילים',value:activeRules,color:'var(--c-income)'},{label:'בוצעו החודש',value:doneThisMonth,color:'var(--c-primary)'},{label:'סה"כ',value:rules.length,color:'var(--text-sub)'}].map(s=>(
                  <div key={s.label} style={{textAlign:'center',padding:'0.5rem',borderRadius:'0.5rem',background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'1.25rem',fontWeight:700,color:s.color}}>{s.value}</div>
                    <div style={{fontSize:'0.65rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {rules.length===0 ? (
              <div style={{textAlign:'center',padding:'1.5rem 0',color:'var(--text-dim)',fontSize:'0.875rem'}}>
                <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>🔄</div>
                אין כללים חוזרים עדיין
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:0,marginBottom:'0.875rem',borderRadius:'0.75rem',overflow:'hidden',border:'1px solid var(--border)'}}>
                {rules.map((r,i)=>{
                  const cat    = cats.find(c=>c.id===r.category_id)
                  const wallet = wallets.find(w=>w.id===r.wallet_id)
                  return (
                    <div key={r.id} style={{display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.625rem 0.75rem',borderTop:i>0?'1px solid var(--border-subtle)':'none',opacity:r.is_active?1:0.5}}>
                      <div style={{width:32,height:32,borderRadius:'0.5rem',background:r.type==='income'?'var(--c-income-bg)':'var(--c-expense-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>
                        {cat?.icon||(r.type==='income'?'💰':'💸')}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:500,fontSize:'0.8rem',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</div>
                        <div style={{fontSize:'0.68rem',color:'var(--text-muted)',display:'flex',gap:'0.4rem'}}>
                          <span>יום {r.day_of_month}</span>
                          {wallet&&<span>• {wallet.name}</span>}
                          {r.last_run_month===thisMonth&&<span style={{color:'var(--c-income)'}}>• ✓</span>}
                        </div>
                      </div>
                      <div style={{fontWeight:700,color:r.type==='income'?'var(--c-income)':'var(--c-expense)',fontSize:'0.875rem',flexShrink:0}}>
                        {r.type==='income'?'+':'-'}₪{Number(r.amount).toLocaleString()}
                      </div>
                      <div style={{display:'flex',gap:'0.125rem',flexShrink:0}}>
                        <button onClick={()=>toggleRule(r)} style={{background:'none',border:'none',cursor:'pointer',padding:'0.2rem',color:r.is_active?'var(--c-income)':'var(--text-dim)'}}>
                          {r.is_active?<ToggleRight size={18}/>:<ToggleLeft size={18}/>}
                        </button>
                        <button onClick={()=>openEditRule(r)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.2rem'}}><Edit2 size={13}/></button>
                        <button onClick={()=>deleteRule(r)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--c-expense)',padding:'0.2rem'}}><Trash2 size={13}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{display:'flex',gap:'0.5rem'}}>
              <button className="btn-ghost" onClick={()=>autoRun(false)} disabled={running} style={{flex:1,justifyContent:'center',display:'flex',alignItems:'center',gap:'0.375rem'}}>
                <RefreshCw size={13} style={{animation:running?'spin 1s linear infinite':'none'}}/>הפעל עכשיו
              </button>
              <button className="btn-primary" onClick={openAddRule} style={{flex:1,justifyContent:'center'}}>
                <Plus size={14}/>כלל חדש
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'0.625rem 1rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-muted)'}}>כלים</span>
        </div>
        <NavRow icon={<ScanLine size={18}/>}  label="סריקת חשבונית"   sub="סרוק חשבונית עם AI"           color="#6c63ff" onClick={()=>navigate('/scanner')} />
        <NavRow icon={<Archive size={18}/>}   label="ארכיון חשבוניות" sub="כל החשבוניות השמורות"          color="#a78bfa" onClick={()=>navigate('/invoices')} />
        <NavRow icon={<Lightbulb size={18}/>} label="דף חכם"           sub="השוואת מחירים וניתוח הוצאות"  color="#fbbf24" onClick={()=>navigate('/insights')} />
        <NavRow icon={<BarChart2 size={18}/>} label="דוחות וייצוא"     sub="גרפים, תרשימים וייצוא נתונים" color="#34d399" onClick={()=>navigate('/reports')} isLast />
      </div>

      {/* ── Goal add/edit modal ── */}
      <Modal open={goalModal} onClose={()=>setGoalModal(false)} title={editingGoal?'ערוך יעד':'יעד חדש'}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.5rem'}}>אייקון</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.375rem'}}>
              {GOAL_ICONS.map(ic=>(
                <button key={ic} onClick={()=>setGoalForm(f=>({...f,icon:ic}))} style={{width:36,height:36,borderRadius:'0.5rem',fontSize:'1.2rem',background:goalForm.icon===ic?'rgba(108,99,255,0.2)':'var(--surface)',border:`1px solid ${goalForm.icon===ic?'rgba(108,99,255,0.5)':'var(--border)'}`,cursor:'pointer'}}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>שם היעד</label>
            <input className="input-field" placeholder="לדוגמה: חיסכון לחופשה" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>סכום יעד ₪</label>
              <input className="input-field" type="number" placeholder="10000" value={goalForm.target_amount} onChange={e=>setGoalForm(f=>({...f,target_amount:e.target.value}))} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>נחסך כבר ₪</label>
              <input className="input-field" type="number" placeholder="0" value={goalForm.current_amount} onChange={e=>setGoalForm(f=>({...f,current_amount:e.target.value}))} dir="ltr"/>
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>תאריך יעד (אופציונלי)</label>
            <input className="input-field" type="date" value={goalForm.target_date} onChange={e=>setGoalForm(f=>({...f,target_date:e.target.value}))} dir="ltr"/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.5rem'}}>צבע</label>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
              {GOAL_COLORS.map(c=>(
                <button key={c} onClick={()=>setGoalForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:'50%',background:c,border:`3px solid ${goalForm.color===c?'#fff':'transparent'}`,cursor:'pointer'}}/>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
            <button className="btn-ghost" onClick={()=>setGoalModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={saveGoal} disabled={savingGoal}>{savingGoal?'שומר...':'שמור'}</button>
          </div>
        </div>
      </Modal>

      {/* ── Add money modal ── */}
      {addMoneyModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}
          onClick={()=>setAddMoneyModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--modal-bg)',border:'1px solid var(--border)',borderRadius:'1.25rem',padding:'1.5rem',width:'100%',maxWidth:360}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.625rem'}}>
                <span style={{fontSize:'1.5rem'}}>{addMoneyModal.icon}</span>
                <div>
                  <div style={{fontWeight:700,color:'var(--text)'}}>{addMoneyModal.name}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>₪{Number(addMoneyModal.current_amount).toLocaleString()} / ₪{Number(addMoneyModal.target_amount).toLocaleString()}</div>
                </div>
              </div>
              <button onClick={()=>setAddMoneyModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={18}/></button>
            </div>
            <input className="input-field" type="number" placeholder="כמה להוסיף?" value={addAmt} onChange={e=>setAddAmt(e.target.value)} autoFocus dir="ltr" style={{textAlign:'center',fontSize:'1.25rem',fontWeight:600,marginBottom:'1rem'}}/>
            <div style={{display:'flex',gap:'0.75rem'}}>
              <button className="btn-ghost" onClick={()=>setAddMoneyModal(null)} style={{flex:1,justifyContent:'center'}}>ביטול</button>
              <button className="btn-primary" onClick={addMoney} style={{flex:1,justifyContent:'center'}}>הוסף</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rule add/edit modal ── */}
      <Modal open={ruleModal} onClose={()=>setRuleModal(false)} title={editingRule?'ערוך כלל':'כלל חוזר חדש'}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>תיאור</label>
            <input className="input-field" placeholder="לדוגמה: משכורת, שכירות..." value={ruleForm.description} onChange={e=>setRuleForm(f=>({...f,description:e.target.value}))}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>סכום ₪</label>
              <input className="input-field" type="number" placeholder="1000" value={ruleForm.amount} onChange={e=>setRuleForm(f=>({...f,amount:e.target.value}))} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>יום בחודש</label>
              <select className="input-field" value={ruleForm.day_of_month} onChange={e=>setRuleForm(f=>({...f,day_of_month:Number(e.target.value)}))} dir="ltr">
                {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>סוג</label>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {[['expense','הוצאה'],['income','הכנסה']].map(([k,v])=>(
                <button key={k} onClick={()=>setRuleForm(f=>({...f,type:k}))} style={{flex:1,padding:'0.4rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${ruleForm.type===k?(k==='income'?'rgba(74,222,128,0.5)':'rgba(248,113,113,0.5)'):'var(--border)'}`,background:ruleForm.type===k?(k==='income'?'var(--c-income-bg)':'var(--c-expense-bg)'):'var(--surface)',color:ruleForm.type===k?(k==='income'?'var(--c-income)':'var(--c-expense)'):'var(--text-sub)'}}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>קטגוריה</label>
            <select className="input-field" value={ruleForm.category_id} onChange={e=>setRuleForm(f=>({...f,category_id:e.target.value}))}>
              <option value="">ללא קטגוריה</option>
              {cats.filter(c=>c.type===ruleForm.type||c.type==='both').map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>ארנק</label>
            <select className="input-field" value={ruleForm.wallet_id} onChange={e=>setRuleForm(f=>({...f,wallet_id:e.target.value}))}>
              <option value="">ללא ארנק</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
            <button className="btn-ghost" onClick={()=>setRuleModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={saveRule} disabled={savingRule}>{savingRule?'שומר...':'שמור'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
