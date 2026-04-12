import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Bell, Check, Trash2, Clock, ShoppingCart, Edit2, ChevronDown,
         Calendar, LayoutList, CheckCircle, Settings } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const emptyForm = { title:'', description:'', due_date:'', is_shopping_list:false, shopping_items:[], assigned_to:'' }
const emptySched = { freq: 'once', time: '09:00', days: [0], dayOfMonth: 1 }

function computeNextDate(s) {
  if (s.freq === 'once') return ''
  const now = new Date()
  const [h, m] = (s.time || '09:00').split(':').map(Number)
  const d = new Date(now)
  if (s.freq === 'daily') {
    d.setHours(h, m, 0, 0)
    if (d <= now) d.setDate(d.getDate() + 1)
  } else if (s.freq === 'weekly') {
    const targets = (s.days && s.days.length > 0) ? [...s.days].sort() : [0]
    const nowDay = now.getDay()
    let minDiff = 8
    for (const td of targets) {
      let diff = (td - nowDay + 7) % 7
      if (diff === 0) { const check = new Date(now); check.setHours(h,m,0,0); diff = check > now ? 0 : 7 }
      if (diff < minDiff) minDiff = diff
    }
    d.setDate(d.getDate() + minDiff); d.setHours(h, m, 0, 0)
  } else if (s.freq === 'monthly') {
    const day = s.dayOfMonth || 1
    d.setDate(day); d.setHours(h, m, 0, 0)
    if (d <= now) { d.setMonth(d.getMonth() + 1); d.setDate(day) }
  }
  return d.toISOString().slice(0, 16)
}

export default function Reminders() {
  const { user, profile } = useAuth()
  const [reminders, setReminders] = useState([])
  const [profiles, setProfiles]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(emptyForm)
  const [saving, setSaving]       = useState(false)
  const [newItem, setNewItem]     = useState('')
  const [selectedFilter, setSelectedFilter] = useState(null)
  const [schedOpen, setSchedOpen] = useState(false)
  const [sched, setSched]         = useState(emptySched)

  useEffect(() => {
    load()
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    } catch (_) {}
  }, [])

  async function load() {
    const [{ data: rData, error: rErr }, { data: pData }] = await Promise.all([
      supabase.from('reminders').select('*').order('due_date'),
      supabase.from('profiles').select('id,name'),
    ])
    if (rErr) toast.error('שגיאה בטעינת תזכורות')
    setReminders(rData || [])
    setProfiles(pData || [])
    setLoading(false)
    ;(rData || []).filter(r => !r.is_completed && r.due_date).forEach(r => {
      const diff = new Date(r.due_date) - Date.now()
      if (diff > 0 && diff < 3600000) {
        setTimeout(() => {
          try { if ('Notification' in window && Notification.permission === 'granted') new Notification(`תזכורת: ${r.title}`, { body: r.description || '' }) } catch (_) {}
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const osc = ctx.createOscillator(); const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6)
          } catch (_) {}
        }, diff)
      }
    })
  }

  function openAdd()   { setEditing(null); setForm(emptyForm); setSchedOpen(false); setSched(emptySched); setModal(true) }
  function openEdit(r) {
    setEditing(r)
    setForm({ title:r.title, description:r.description||'', due_date:r.due_date?r.due_date.slice(0,16):'', is_shopping_list:r.is_shopping_list, shopping_items:r.shopping_items||[], assigned_to:r.assigned_to||'' })
    setSchedOpen(false); setSched(emptySched); setModal(true)
  }

  async function handleSave() {
    if (!form.title) { toast.error('כותרת נדרשת'); return }
    setSaving(true)
    const payload = { ...form, created_by: user.id }
    if (!payload.assigned_to) delete payload.assigned_to
    if (!payload.due_date) delete payload.due_date
    if (editing) {
      await supabase.from('reminders').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:ENTITY_TYPES.REMINDER, description:`עדכן/ה תזכורת: ${form.title}`, entityId:editing.id })
      toast.success('עודכן!')
    } else {
      await supabase.from('reminders').insert(payload)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.CREATE, entityType:ENTITY_TYPES.REMINDER, description:`הוסיף/ה תזכורת: ${form.title}` })
      toast.success('תזכורת נוספה!')
    }
    setModal(false); load(); setSaving(false)
  }

  async function toggleComplete(r) {
    await supabase.from('reminders').update({ is_completed: !r.is_completed }).eq('id', r.id)
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.COMPLETE, entityType:ENTITY_TYPES.REMINDER, description:`${r.is_completed?'בטל':'סימן'} תזכורת: ${r.title}`, entityId:r.id })
    if (!r.is_completed) toast.success('✅ הושלם!')
    load()
  }

  async function handleDelete(r) {
    if (!confirm(`למחוק "${r.title}"?`)) return
    await supabase.from('reminders').delete().eq('id', r.id)
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.DELETE, entityType:ENTITY_TYPES.REMINDER, description:`מחק/ה תזכורת: ${r.title}`, entityId:r.id })
    toast.success('נמחק'); load()
  }

  function addShoppingItem() {
    if (!newItem.trim()) return
    setForm(f => ({ ...f, shopping_items: [...f.shopping_items, { text: newItem.trim(), done: false }] }))
    setNewItem('')
  }

  // ── Computed filter buckets ──
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999)
  const in48h  = new Date(now.getTime() + 48 * 3600000)
  const in7d   = new Date(now.getTime() + 7  * 86400000)

  const completedList = reminders.filter(r => r.is_completed)
  const allActiveList = reminders.filter(r => !r.is_completed)
  const todayList     = reminders.filter(r => !r.is_completed && r.due_date && new Date(r.due_date) >= todayStart && new Date(r.due_date) <= todayEnd)
  const weeklyList    = reminders.filter(r => !r.is_completed && r.due_date && new Date(r.due_date) >= now && new Date(r.due_date) <= in7d)

  const statCards = [
    { key:'completed', label:'הושלמו',        count: completedList.length,  bg:'linear-gradient(135deg,#4b5563,#6b7280)', icon:<CheckCircle size={22} color="rgba(255,255,255,0.85)"/>, gear:false },
    { key:'all',       label:'כל המשימות',     count: allActiveList.length,  bg:'linear-gradient(135deg,#2563eb,#60a5fa)', icon:<LayoutList  size={22} color="rgba(255,255,255,0.85)"/>, gear:false },
    { key:'today',     label:'צריך לבצע היום', count: todayList.length,      bg:'linear-gradient(135deg,#92400e,#d97706)', icon:<Clock       size={22} color="rgba(255,255,255,0.85)"/>, gear:true  },
    { key:'weekly',    label:'מתוזמן השבוע',   count: weeklyList.length,     bg:'linear-gradient(135deg,#b45309,#fbbf24)', icon:<Calendar    size={22} color="rgba(255,255,255,0.85)"/>, gear:true  },
  ]

  const filteredList = selectedFilter === 'completed' ? completedList
    : selectedFilter === 'today'  ? todayList
    : selectedFilter === 'weekly' ? weeklyList
    : allActiveList

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1rem',paddingBottom:'6rem'}}>

      {/* Header */}
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>תזכורות</h1>

      {/* ── Stat cards 2×3 grid ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
        {statCards.map(card => {
          const active = selectedFilter === card.key
          return (
            <div key={card.key} onClick={() => setSelectedFilter(f => f === card.key ? null : card.key)}
              style={{
                background: card.bg, borderRadius:'1.25rem', padding:'0.875rem',
                cursor:'pointer', minHeight:100, display:'flex', flexDirection:'column',
                justifyContent:'space-between',
                outline: active ? '2.5px solid rgba(255,255,255,0.7)' : '2.5px solid transparent',
                transition:'outline 0.15s, transform 0.1s',
                transform: active ? 'scale(0.97)' : 'scale(1)',
              }}>
              {/* Top row: count + icon */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <span style={{fontSize:'1.75rem',fontWeight:700,color:'#fff',lineHeight:1}}>{card.count}</span>
                {card.icon}
              </div>
              {/* Bottom row: label (+ gear) */}
              <div style={{display:'flex',alignItems:'center',gap:'0.3rem',justifyContent:'flex-end'}}>
                {card.gear && <Settings size={11} color="rgba(255,255,255,0.6)"/>}
                <span style={{fontSize:'0.78rem',fontWeight:600,color:'rgba(255,255,255,0.92)',textAlign:'right'}}>{card.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active filter label */}
      {selectedFilter && (
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>מסנן:</span>
          <span style={{fontSize:'0.8rem',fontWeight:600,color:'#a78bfa'}}>{statCards.find(c=>c.key===selectedFilter)?.label}</span>
          <button onClick={() => setSelectedFilter(null)} style={{background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:'0.8rem',padding:'0 0.25rem'}}>✕</button>
        </div>
      )}

      {/* ── Task list ── */}
      {filteredList.length === 0 ? (
        <div style={{textAlign:'center',padding:'2rem 0',color:'var(--text-dim)',fontSize:'0.875rem'}}>אין משימות להצגה 🎉</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
          {filteredList.map(r => {
            const isOverdue = r.due_date && new Date(r.due_date) < now && !r.is_completed
            return (
              <div key={r.id} style={{
                display:'flex',alignItems:'flex-start',gap:'0.75rem',
                padding:'0.75rem 1rem',borderRadius:'0.875rem',
                background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',
                opacity: r.is_completed ? 0.6 : 1, transition:'opacity 0.15s',
              }}>
                {/* Completion toggle */}
                <button onClick={() => toggleComplete(r)} style={{
                  marginTop:'0.125rem',width:22,height:22,borderRadius:'50%',flexShrink:0,
                  border:`2px solid ${r.is_completed?'#4ade80':isOverdue?'#f87171':'rgba(255,255,255,0.25)'}`,
                  background:r.is_completed?'rgba(74,222,128,0.2)':isOverdue?'rgba(248,113,113,0.1)':'transparent',
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  {r.is_completed && <Check size={11} color="#4ade80"/>}
                </button>

                {/* Content */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,color:'var(--text)',fontSize:'0.875rem',textDecoration:r.is_completed?'line-through':'none',marginBottom:r.due_date||r.description?'0.2rem':0}}>
                    {r.title}
                    {r.is_shopping_list && <span style={{marginRight:'0.5rem',fontSize:'0.7rem',color:'#60a5fa',background:'rgba(96,165,250,0.15)',padding:'0.1rem 0.4rem',borderRadius:'9999px',verticalAlign:'middle'}}><ShoppingCart size={9} style={{display:'inline',marginLeft:2}}/>קניות</span>}
                  </div>
                  {r.due_date && (
                    <div style={{display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.72rem',color:isOverdue?'#f87171':'var(--text-muted)'}}>
                      <Clock size={10}/>
                      {new Date(r.due_date).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}
                      {isOverdue && <span style={{color:'#f87171',fontWeight:600}}>— עברה הזמן</span>}
                    </div>
                  )}
                  {r.description && <p style={{margin:'0.25rem 0 0',fontSize:'0.78rem',color:'var(--text-muted)'}}>{r.description}</p>}
                  {r.assigned_to && <div style={{marginTop:'0.25rem',fontSize:'0.7rem',color:'var(--text-dim)'}}>👤 {profiles.find(p=>p.id===r.assigned_to)?.name}</div>}
                </div>

                {/* Actions */}
                <div style={{display:'flex',gap:'0.125rem',flexShrink:0,marginTop:'0.1rem'}}>
                  <button onClick={() => openEdit(r)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.25rem',borderRadius:'0.375rem'}}>
                    <Edit2 size={13}/>
                  </button>
                  <button onClick={() => handleDelete(r)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem',borderRadius:'0.375rem'}}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={openAdd} style={{
        position:'fixed',bottom:'1.5rem',left:'1.5rem',zIndex:50,
        width:52,height:52,borderRadius:'50%',
        background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',
        border:'none',cursor:'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow:'0 4px 20px rgba(108,99,255,0.5)',
        transition:'transform 0.15s',
      }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <Plus size={22} color="#fff"/>
      </button>

      {/* ── Modal ── */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'ערוך תזכורת':'תזכורת חדשה'} size="lg">
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>כותרת</label>
            <input className="input-field" placeholder="כותרת..." value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>תיאור</label>
            <textarea className="input-field" placeholder="תיאור..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} style={{resize:'vertical'}}/>
          </div>

          {/* Scheduling panel */}
          <div style={{borderRadius:'0.75rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>
            <button type="button" onClick={() => setSchedOpen(o=>!o)} style={{width:'100%',display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.75rem',background:'rgba(255,255,255,0.03)',border:'none',cursor:'pointer',color:'var(--text-sub)',fontSize:'0.85rem',fontFamily:'inherit',textAlign:'right'}}>
              <Clock size={14} color="#6c63ff"/>
              <span style={{flex:1}}>תזמון תזכורת</span>
              <ChevronDown size={14} style={{transform:schedOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </button>
            {schedOpen && (
              <div style={{padding:'1rem',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',flexDirection:'column',gap:'0.875rem'}}>
                <div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.4rem'}}>תדירות</div>
                  <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                    {[['once','חד פעמי'],['daily','יומי'],['weekly','שבועי'],['monthly','חודשי']].map(([val,lbl]) => (
                      <button key={val} type="button" onClick={() => setSched(s=>({...s,freq:val}))} style={{padding:'0.35rem 0.75rem',borderRadius:'0.5rem',fontSize:'0.78rem',cursor:'pointer',border:`1px solid ${sched.freq===val?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:sched.freq===val?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:sched.freq===val?'#a78bfa':'var(--text-muted)',fontWeight:sched.freq===val?600:400}}>{lbl}</button>
                    ))}
                  </div>
                </div>
                {sched.freq !== 'once' && (
                  <div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.4rem'}}>שעה</div>
                    <input className="input-field" type="time" value={sched.time} onChange={e=>setSched(s=>({...s,time:e.target.value}))} dir="ltr" style={{maxWidth:130}}/>
                  </div>
                )}
                {sched.freq === 'weekly' && (
                  <div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.4rem'}}>ימים בשבוע</div>
                    <div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>
                      {DAYS_HE.map((d,i) => (
                        <button key={i} type="button" onClick={() => setSched(s=>({...s,days:s.days.includes(i)?s.days.filter(x=>x!==i):[...s.days,i].sort()}))} style={{padding:'0.35rem 0.625rem',borderRadius:'0.5rem',fontSize:'0.78rem',cursor:'pointer',border:`1px solid ${sched.days.includes(i)?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:sched.days.includes(i)?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:sched.days.includes(i)?'#a78bfa':'var(--text-muted)',fontWeight:sched.days.includes(i)?600:400}}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                {sched.freq === 'monthly' && (
                  <div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.4rem'}}>יום בחודש</div>
                    <select className="input-field" value={sched.dayOfMonth} onChange={e=>setSched(s=>({...s,dayOfMonth:Number(e.target.value)}))} style={{maxWidth:110}} dir="ltr">
                      {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                {sched.freq !== 'once' && (() => {
                  const next = computeNextDate(sched)
                  return next ? (
                    <div style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem 0.75rem',borderRadius:'0.625rem',background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.15)'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'0.7rem',color:'var(--text-muted)',marginBottom:'0.125rem'}}>הפעם הבאה</div>
                        <div style={{fontSize:'0.82rem',color:'#a78bfa',fontWeight:600}}>{new Date(next).toLocaleString('he-IL',{dateStyle:'medium',timeStyle:'short'})}</div>
                      </div>
                      <button type="button" onClick={() => setForm(f=>({...f,due_date:next}))} style={{padding:'0.4rem 0.875rem',borderRadius:'0.5rem',fontSize:'0.78rem',cursor:'pointer',border:'1px solid rgba(108,99,255,0.4)',background:'rgba(108,99,255,0.2)',color:'#a78bfa',fontWeight:600}}>קבע</button>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>

          <div className="form-2col">
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>תאריך ושעה</label>
              <input className="input-field" type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>הקצה למשתמש</label>
              <select className="input-field" value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
                <option value="">כולם</option>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',color:'var(--text-sub)',fontSize:'0.875rem'}}>
            <input type="checkbox" checked={form.is_shopping_list} onChange={e=>setForm({...form,is_shopping_list:e.target.checked})} style={{accentColor:'#6c63ff'}}/>
            רשימת קניות
          </label>
          {form.is_shopping_list && (
            <div>
              <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>פריטים</label>
              <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}}>
                <input className="input-field" placeholder="הוסף פריט..." value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addShoppingItem()} style={{flex:1}}/>
                <button className="btn-ghost" onClick={addShoppingItem}>הוסף</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.375rem'}}>
                {form.shopping_items.map((item,i)=>(
                  <span key={i} style={{display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.25rem 0.625rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.06)',fontSize:'0.8rem',color:'var(--text-sub)'}}>
                    {item.text}
                    <button onClick={()=>setForm(f=>({...f,shopping_items:f.shopping_items.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:0}}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
            <button className="btn-ghost" onClick={()=>setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'שומר...':'שמור'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
