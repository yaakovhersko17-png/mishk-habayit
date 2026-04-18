import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ChevronRight, ChevronLeft, Plus, X } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const DAYS_HE   = ['א','ב','ג','ד','ה','ו','ש']
const DAYS_FULL = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [today]   = useState(new Date())
  const [current, setCurrent]     = useState(new Date())
  const [txByDate, setTxByDate]   = useState({})
  const [remByDate, setRemByDate] = useState({})
  const [evByDate, setEvByDate]   = useState({})
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('month')
  const [activeTab, setActiveTab] = useState(null) // 'reminders'|'events'|'transactions'

  // Add event modal
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [addForm, setAddForm] = useState({ title:'', date:'', time:'09:00', description:'' })

  useEffect(() => { load() }, [current, view]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    let from, to
    if (view === 'month') {
      const y=current.getFullYear(), m=current.getMonth()
      from=`${y}-${String(m+1).padStart(2,'0')}-01`
      to=`${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    } else if (view === 'week') {
      const s=getWeekStart(current); from=dateStr(s)
      const e=new Date(s); e.setDate(e.getDate()+6); to=dateStr(e)
    } else {
      from=dateStr(current); to=dateStr(current)
    }
    const [{ data: txData }, { data: remData }, { data: evData }] = await Promise.all([
      supabase.from('transactions').select('date,type,amount,description,currency').gte('date',from).lte('date',to),
      supabase.from('reminders').select('due_date,title,is_completed').gte('due_date',from+'T00:00:00').lte('due_date',to+'T23:59:59'),
      supabase.from('calendar_events').select('id,title,description,event_date,event_time,color').gte('event_date',from).lte('event_date',to),
    ])
    const tbd={}, rbd={}, ebd={}
    ;(txData||[]).forEach(t  => { if(!tbd[t.date])       tbd[t.date]=[]; tbd[t.date].push(t) })
    ;(remData||[]).forEach(r => { const d=r.due_date?.split('T')[0]; if(d){if(!rbd[d])rbd[d]=[]; rbd[d].push(r)} })
    ;(evData||[]).forEach(e  => { if(!ebd[e.event_date]) ebd[e.event_date]=[]; ebd[e.event_date].push(e) })
    setTxByDate(tbd); setRemByDate(rbd); setEvByDate(ebd); setLoading(false)
  }

  async function deleteEvent(id) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    toast.success('אירוע נמחק')
    await load()
  }

  function getWeekStart(d) { const s=new Date(d); s.setDate(s.getDate()-s.getDay()); return s }
  function prev() {
    if (view==='month') setCurrent(new Date(current.getFullYear(),current.getMonth()-1,1))
    else if (view==='week') { const d=new Date(current); d.setDate(d.getDate()-7); setCurrent(d) }
    else { const d=new Date(current); d.setDate(d.getDate()-1); setCurrent(d) }
  }
  function next() {
    if (view==='month') setCurrent(new Date(current.getFullYear(),current.getMonth()+1,1))
    else if (view==='week') { const d=new Date(current); d.setDate(d.getDate()+7); setCurrent(d) }
    else { const d=new Date(current); d.setDate(d.getDate()+1); setCurrent(d) }
  }
  function headerTitle() {
    if (view==='month') return `${MONTHS_HE[current.getMonth()]} ${current.getFullYear()}`
    if (view==='day')   return `${DAYS_FULL[current.getDay()]}, ${current.getDate()} ${MONTHS_HE[current.getMonth()]}`
    const s=getWeekStart(current), e=new Date(s); e.setDate(e.getDate()+6)
    return `${s.getDate()}–${e.getDate()} ${MONTHS_HE[current.getMonth()]} ${current.getFullYear()}`
  }

  const todayStr = dateStr(today)
  const selDs = selected || (view==='day' ? dateStr(current) : null)

  function openAdd() {
    setAddForm({ title:'', date: selected || dateStr(current), time:'09:00', description:'' })
    setShowAdd(true)
  }
  async function saveEvent() {
    if (!addForm.title.trim() || !addForm.date) { toast.error('כותרת ותאריך חובה'); return }
    if (!user?.id) { toast.error('משתמש לא מחובר'); return }
    setSaving(true)
    const { error } = await supabase.from('calendar_events').insert({
      title: addForm.title.trim(),
      description: addForm.description.trim() || null,
      event_date: addForm.date,
      event_time: addForm.time || null,
      created_by: user.id,
    })
    setSaving(false)
    if (error) { toast.error(`שגיאה בשמירה: ${error.message}`); return }
    toast.success('אירוע נוסף!')
    setShowAdd(false)
    await load()
  }

  if (loading) return <LoadingSpinner />

  const year=current.getFullYear(), month=current.getMonth()
  const firstDay=new Date(year,month,1).getDay()
  const daysInMonth=new Date(year,month+1,0).getDate()
  const monthCells=[]
  for(let i=0;i<firstDay;i++) monthCells.push(null)
  for(let d=1;d<=daysInMonth;d++) monthCells.push(d)
  const weekStart=getWeekStart(current)
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d})

  function renderDayCell(day, ds, compact) {
    const hasTx  = txByDate[ds]?.length  > 0
    const hasRem = remByDate[ds]?.length > 0
    const hasEv  = evByDate[ds]?.length  > 0
    const isToday= sameDay(day instanceof Date ? day : new Date(year,month,day), today)
    const isSel  = selected===ds
    return (
      <div key={ds} onClick={()=>setSelected(ds===selected?null:ds)} style={{
        aspectRatio:compact?'1':undefined, minHeight:compact?undefined:60,
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        borderRadius:'0.625rem',cursor:'pointer',transition:'all 0.15s',position:'relative',
        background:isSel?'rgba(108,99,255,0.3)':isToday?'rgba(108,99,255,0.15)':'transparent',
        border:isSel?'1px solid rgba(108,99,255,0.5)':isToday?'1px solid rgba(108,99,255,0.3)':'1px solid transparent',
        color:isSel?'#a78bfa':isToday?'#c4b5fd':'var(--text)',
        fontSize:'0.875rem',fontWeight:isToday||isSel?700:400,padding:compact?0:'0.5rem',
      }}>
        {typeof day==='number' ? day : day.getDate()}
        {(hasTx||hasRem||hasEv) && (
          <div style={{position:'absolute',bottom:3,display:'flex',gap:'2px'}}>
            {hasTx  && <div style={{width:4,height:4,borderRadius:'50%',background:'#6c63ff'}}/>}
            {hasRem && <div style={{width:4,height:4,borderRadius:'50%',background:'#fbbf24'}}/>}
            {hasEv  && <div style={{width:4,height:4,borderRadius:'50%',background:'#22d3ee'}}/>}
          </div>
        )}
      </div>
    )
  }

  // Compute lists for the current view/selection
  const isDay   = !!selDs
  const evList  = isDay ? (evByDate[selDs]||[])  : Object.values(evByDate).flat().sort((a,b)=>a.event_date.localeCompare(b.event_date)||(a.event_time||'').localeCompare(b.event_time||''))
  const remList = isDay ? (remByDate[selDs]||[]) : Object.values(remByDate).flat()
  const txList  = isDay ? (txByDate[selDs]||[])  : Object.values(txByDate).flat().sort((a,b)=>a.date?.localeCompare(b.date??'')||0)

  const TABS = [
    { key:'reminders',    label:'תזכורות', icon:'🔔', color:'#fbbf24', bg:'rgba(251,191,36,0.12)',  bdr:'rgba(251,191,36,0.3)',  list: remList },
    { key:'events',       label:'אירועים',  icon:'📅', color:'#22d3ee', bg:'rgba(34,211,238,0.12)', bdr:'rgba(34,211,238,0.3)',  list: evList  },
    { key:'transactions', label:'עסקאות',   icon:'💰', color:'#a78bfa', bg:'rgba(167,139,250,0.12)',bdr:'rgba(167,139,250,0.3)', list: txList  },
  ]

  const activeTabData = TABS.find(t=>t.key===activeTab)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>לוח שנה</h1>
        <button className="btn-primary" onClick={openAdd}><Plus size={14}/>אירוע חדש</button>
      </div>

      {/* Calendar card */}
      <div className="page-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
          <button onClick={prev} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'var(--text)',padding:'0.375rem',display:'flex'}}><ChevronRight size={18}/></button>
          <h2 style={{margin:0,fontSize:'1.1rem',fontWeight:600,color:'var(--text)'}}>{headerTitle()}</h2>
          <button onClick={next} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'var(--text)',padding:'0.375rem',display:'flex'}}><ChevronLeft size={18}/></button>
        </div>

        {/* View tabs */}
        <div style={{display:'flex',gap:'0.375rem',justifyContent:'center',marginBottom:'1rem'}}>
          {[['month','חודש'],['week','שבוע'],['day','יום']].map(([v,label])=>(
            <button key={v} onClick={()=>{setView(v);setSelected(null)}} style={{
              padding:'0.3rem 0.875rem',borderRadius:'0.5rem',fontSize:'0.78rem',cursor:'pointer',
              border:`1px solid ${view===v?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,
              background:view===v?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',
              color:view===v?'#a78bfa':'var(--text-sub)',
            }}>{label}</button>
          ))}
        </div>

        {view==='month' && <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem',marginBottom:'0.5rem'}}>
            {DAYS_HE.map(d=><div key={d} style={{textAlign:'center',fontSize:'0.75rem',color:'var(--text-muted)',fontWeight:600,padding:'0.25rem'}}>{d}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem'}}>
            {monthCells.map((day,i)=>{
              if(!day) return <div key={`e${i}`}/>
              const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              return renderDayCell(day,ds,true)
            })}
          </div>
        </>}

        {view==='week' && <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem',marginBottom:'0.5rem'}}>
            {weekDays.map((_,i)=><div key={i} style={{textAlign:'center',fontSize:'0.7rem',color:'var(--text-muted)',fontWeight:600}}>{DAYS_HE[i]}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem'}}>
            {weekDays.map(d=>{const ds=dateStr(d);return renderDayCell(d,ds,true)})}
          </div>
        </>}

        {view==='day' && (
          <div style={{fontSize:'0.85rem',color:'var(--text-sub)',textAlign:'center'}}>
            {current.getDate()} {MONTHS_HE[current.getMonth()]} {current.getFullYear()}
          </div>
        )}

        {/* Legend */}
        <div style={{marginTop:'1rem',display:'flex',gap:'1rem',justifyContent:'center',flexWrap:'wrap'}}>
          {[['#22d3ee','אירועים'],['#fbbf24','תזכורות'],['#6c63ff','עסקאות']].map(([c,l])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.75rem',color:'var(--text-muted)'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>{l}
            </div>
          ))}
        </div>

        {/* 3 category tab cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.625rem',marginTop:'1.25rem'}}>
          {TABS.map(tab=>(
            <button key={tab.key} onClick={()=>setActiveTab(activeTab===tab.key?null:tab.key)} style={{
              padding:'0.75rem 0.25rem',borderRadius:'0.875rem',cursor:'pointer',textAlign:'center',
              border:`1px solid ${activeTab===tab.key?tab.bdr:'rgba(255,255,255,0.08)'}`,
              background:activeTab===tab.key?tab.bg:'rgba(255,255,255,0.03)',
              transition:'all 0.15s',
            }}>
              <div style={{fontSize:'1.25rem'}}>{tab.icon}</div>
              <div style={{fontSize:'0.72rem',fontWeight:600,color:activeTab===tab.key?tab.color:'var(--text-sub)',marginTop:'0.25rem'}}>{tab.label}</div>
              <div style={{fontSize:'0.7rem',color:'var(--text-dim)',marginTop:'0.1rem'}}>{tab.list.length}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Filtered list */}
      {activeTab && activeTabData && (
        <div className="page-card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <span style={{fontSize:'1rem'}}>{activeTabData.icon}</span>
              <span style={{fontSize:'0.9rem',fontWeight:700,color:activeTabData.color}}>{activeTabData.label}</span>
              {selDs && <span style={{fontSize:'0.72rem',color:'var(--text-dim)',background:'rgba(255,255,255,0.05)',padding:'0.1rem 0.45rem',borderRadius:'0.375rem'}}>
                {(()=>{const d=new Date(selDs+'T00:00:00');return `${d.getDate()} ${MONTHS_HE[d.getMonth()]}`})()}
              </span>}
            </div>
            <button onClick={()=>setActiveTab(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:2}}><X size={15}/></button>
          </div>

          {activeTabData.list.length===0 ? (
            <div style={{textAlign:'center',color:'var(--text-dim)',padding:'1.5rem 0',fontSize:'0.875rem'}}>אין נתונים לתקופה זו</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
              {activeTab==='reminders' && remList.map((r,i)=>(
                <div key={i} style={{padding:'0.55rem 0.75rem',borderRadius:'0.625rem',background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.12)'}}>
                  <div style={{fontSize:'0.825rem',fontWeight:600,color:'var(--text)',textDecoration:r.is_completed?'line-through':'none'}}>{r.title}</div>
                  {r.due_date && (
                    <div style={{fontSize:'0.7rem',color:'#fbbf24',marginTop:'0.15rem',display:'flex',gap:'0.5rem'}}>
                      <span>{r.due_date.slice(0,10)}</span>
                      {r.due_date.length>10 && <span>🕐 {r.due_date.slice(11,16)}</span>}
                    </div>
                  )}
                </div>
              ))}

              {activeTab==='events' && evList.map((e,i)=>(
                <div key={e.id??i} style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',padding:'0.55rem 0.75rem',borderRadius:'0.625rem',background:'rgba(34,211,238,0.07)',border:'1px solid rgba(34,211,238,0.12)'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.825rem',fontWeight:600,color:'var(--text)'}}>{e.title}</div>
                    <div style={{fontSize:'0.7rem',color:'#22d3ee',marginTop:'0.15rem',display:'flex',gap:'0.5rem'}}>
                      <span>{e.event_date}</span>
                      {e.event_time && <span>🕐 {e.event_time.slice(0,5)}</span>}
                    </div>
                    {e.description && <div style={{fontSize:'0.7rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{e.description}</div>}
                  </div>
                  <button onClick={()=>deleteEvent(e.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',display:'flex',padding:'0.125rem',flexShrink:0}}><X size={13}/></button>
                </div>
              ))}

              {activeTab==='transactions' && txList.map((t,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.55rem 0.75rem',borderRadius:'0.625rem',background:'rgba(108,99,255,0.06)',border:'1px solid rgba(108,99,255,0.12)'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'0.825rem',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</div>
                    <div style={{fontSize:'0.7rem',color:'var(--text-muted)',marginTop:'0.15rem'}}>{t.date}</div>
                  </div>
                  <div style={{fontSize:'0.8rem',fontWeight:700,flexShrink:0,marginRight:'0.5rem',color:t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type?.startsWith('loan')?'#fbbf24':'#f87171'}}>
                    {t.type==='income'?'+':t.type==='transfer'?'↔':'-'}{t.currency||'₪'}{Number(t.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add event sheet */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowAdd(false)}}>
          <div style={{width:'100%',maxWidth:480,background:'var(--bg2)',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{margin:0,fontSize:'1rem',fontWeight:700,color:'var(--text)'}}>📅 אירוע חדש</h3>
              <button onClick={()=>setShowAdd(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}><X size={20}/></button>
            </div>
            <input className="input-field" placeholder="כותרת האירוע *" value={addForm.title}
              onChange={e=>setAddForm(f=>({...f,title:e.target.value}))} autoFocus/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
              <div>
                <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>תאריך</div>
                <input type="date" className="input-field" value={addForm.date}
                  onChange={e=>setAddForm(f=>({...f,date:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>שעה</div>
                <input type="time" className="input-field" value={addForm.time}
                  onChange={e=>setAddForm(f=>({...f,time:e.target.value}))}/>
              </div>
            </div>
            <input className="input-field" placeholder="תיאור (אופציונלי)" value={addForm.description}
              onChange={e=>setAddForm(f=>({...f,description:e.target.value}))}/>
            <button className="btn-primary" onClick={saveEvent} disabled={saving} style={{justifyContent:'center'}}>
              {saving ? 'שומר...' : 'שמור אירוע'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
