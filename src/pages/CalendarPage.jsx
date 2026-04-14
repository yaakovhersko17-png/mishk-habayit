import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronRight, ChevronLeft, Plus, X } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const DAYS_HE = ['א','ב','ג','ד','ה','ו','ש']
const DAYS_FULL = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }

export default function CalendarPage() {
  const [today] = useState(new Date())
  const [current, setCurrent] = useState(new Date())
  const [txByDate, setTxByDate] = useState({})
  const [remByDate, setRemByDate] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('month') // month | week | day
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', date: '', time: '09:00', description: '' })

  useEffect(() => { load() }, [current, view])

  async function load() {
    let from, to
    if (view === 'month') {
      const y = current.getFullYear(), m = current.getMonth()
      from = `${y}-${String(m+1).padStart(2,'0')}-01`
      to = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    } else if (view === 'week') {
      const start = getWeekStart(current)
      from = dateStr(start)
      const end = new Date(start); end.setDate(end.getDate()+6)
      to = dateStr(end)
    } else {
      from = dateStr(current)
      to = dateStr(current)
    }
    const [{ data: txData }, { data: remData }] = await Promise.all([
      supabase.from('transactions').select('date,type,amount,description,currency').gte('date',from).lte('date',to),
      supabase.from('reminders').select('due_date,title,is_completed').gte('due_date',from+'T00:00:00').lte('due_date',to+'T23:59:59'),
    ])
    const tbd = {}, rbd = {}
    ;(txData||[]).forEach(t => { if (!tbd[t.date]) tbd[t.date] = []; tbd[t.date].push(t) })
    ;(remData||[]).forEach(r => { const d = r.due_date?.split('T')[0]; if (d) { if (!rbd[d]) rbd[d]=[]; rbd[d].push(r) } })
    setTxByDate(tbd); setRemByDate(rbd); setLoading(false)
  }

  function getWeekStart(d) {
    const start = new Date(d)
    start.setDate(start.getDate() - start.getDay())
    return start
  }

  // Navigation
  function prev() {
    if (view === 'month') setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))
    else if (view === 'week') { const d = new Date(current); d.setDate(d.getDate() - 7); setCurrent(d) }
    else { const d = new Date(current); d.setDate(d.getDate() - 1); setCurrent(d) }
  }
  function next() {
    if (view === 'month') setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))
    else if (view === 'week') { const d = new Date(current); d.setDate(d.getDate() + 7); setCurrent(d) }
    else { const d = new Date(current); d.setDate(d.getDate() + 1); setCurrent(d) }
  }

  function headerTitle() {
    if (view === 'month') return `${MONTHS_HE[current.getMonth()]} ${current.getFullYear()}`
    if (view === 'day') return `${DAYS_FULL[current.getDay()]}, ${current.getDate()} ${MONTHS_HE[current.getMonth()]}`
    const start = getWeekStart(current)
    const end = new Date(start); end.setDate(end.getDate()+6)
    return `${start.getDate()}–${end.getDate()} ${MONTHS_HE[current.getMonth()]} ${current.getFullYear()}`
  }

  // Selected day events
  const selectedDateStr2 = selected || (view === 'day' ? dateStr(current) : null)
  const selectedTx  = selectedDateStr2 ? (txByDate[selectedDateStr2] || []) : []
  const selectedRem = selectedDateStr2 ? (remByDate[selectedDateStr2] || []) : []

  if (loading) return <LoadingSpinner />

  function openAdd() {
    const d = selected || dateStr(current)
    setAddForm({ title: '', date: d, time: '09:00', description: '' })
    setShowAdd(true)
  }

  async function saveEvent() {
    if (!addForm.title.trim() || !addForm.date) { toast.error('כותרת ותאריך חובה'); return }
    setSaving(true)
    const due_date = `${addForm.date}T${addForm.time}:00`
    const { error } = await supabase.from('reminders').insert({
      title: addForm.title.trim(),
      description: addForm.description.trim() || null,
      due_date,
      is_completed: false,
    })
    setSaving(false)
    if (error) { toast.error('שגיאה בשמירה'); return }
    toast.success('אירוע נוסף!')
    setShowAdd(false)
    load()
  }

  // Month view cells
  const year = current.getFullYear(), month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthCells = []
  for (let i = 0; i < firstDay; i++) monthCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) monthCells.push(d)

  // Week view days
  const weekStart = getWeekStart(current)
  const weekDays = Array.from({length:7}, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d })

  function renderDayCell(day, ds, compact) {
    const hasTx  = txByDate[ds]?.length > 0
    const hasRem = remByDate[ds]?.length > 0
    const isToday = sameDay(day instanceof Date ? day : new Date(year, month, day), today)
    const isSel = selected === ds
    return (
      <div key={ds} onClick={()=>setSelected(ds===selected?null:ds)} style={{
        aspectRatio: compact ? '1' : undefined,
        minHeight: compact ? undefined : 60,
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        borderRadius:'0.625rem',cursor:'pointer',transition:'all 0.15s',position:'relative',
        background:isSel?'rgba(108,99,255,0.3)':isToday?'rgba(108,99,255,0.15)':'transparent',
        border:isSel?'1px solid rgba(108,99,255,0.5)':isToday?'1px solid rgba(108,99,255,0.3)':'1px solid transparent',
        color:isSel?'#a78bfa':isToday?'#c4b5fd':'var(--text)',
        fontSize:'0.875rem',fontWeight:isToday||isSel?700:400,
        padding: compact ? 0 : '0.5rem',
      }}>
        {typeof day === 'number' ? day : day.getDate()}
        {(hasTx || hasRem) && (
          <div style={{position:'absolute',bottom:3,display:'flex',gap:'2px'}}>
            {hasTx  && <div style={{width:4,height:4,borderRadius:'50%',background:'#6c63ff'}}/>}
            {hasRem && <div style={{width:4,height:4,borderRadius:'50%',background:'#fbbf24'}}/>}
          </div>
        )}
      </div>
    )
  }

  function renderEvents(ds) {
    const tx = txByDate[ds] || []
    const rem = remByDate[ds] || []
    if (!tx.length && !rem.length) return <p style={{color:'var(--text-dim)',fontSize:'0.85rem',textAlign:'center',marginTop:'1rem'}}>אין אירועים</p>
    return <>
      {tx.length > 0 && (
        <div style={{marginBottom:'1rem'}}>
          <div style={{fontSize:'0.75rem',color:'#6c63ff',fontWeight:600,marginBottom:'0.5rem'}}>💳 טרנזקציות</div>
          {tx.map((t,i)=>(
            <div key={i} style={{padding:'0.5rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.04)',marginBottom:'0.375rem'}}>
              <div style={{fontSize:'0.8rem',color:'var(--text)'}}>{t.description}</div>
              <div style={{fontSize:'0.75rem',fontWeight:600,color:t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type.startsWith('loan')?'#fbbf24':'#f87171'}}>
                {t.type==='income'?'+':t.type==='transfer'?'↔':'-'}{t.currency||'₪'}{Number(t.amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      {rem.length > 0 && (
        <div>
          <div style={{fontSize:'0.75rem',color:'#fbbf24',fontWeight:600,marginBottom:'0.5rem'}}>🔔 תזכורות</div>
          {rem.map((r,i)=>(
            <div key={i} style={{padding:'0.5rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.04)',marginBottom:'0.375rem'}}>
              <div style={{fontSize:'0.8rem',color:'var(--text)',textDecoration:r.is_completed?'line-through':'none'}}>{r.title}</div>
            </div>
          ))}
        </div>
      )}
    </>
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'0.75rem'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>לוח שנה</h1>
        <div style={{display:'flex',gap:'0.375rem'}}>
          {[['month','חודש'],['week','שבוע'],['day','יום']].map(([v,label])=>(
            <button key={v} onClick={()=>{setView(v);setSelected(null)}} style={{
              padding:'0.375rem 0.875rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',
              border:`1px solid ${view===v?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,
              background:view===v?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',
              color:view===v?'#a78bfa':'var(--text-sub)',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="cal-grid">
        <div className="page-card">
          {/* Navigation */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
            <button onClick={prev} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'var(--text)',padding:'0.375rem',display:'flex'}}><ChevronRight size={18}/></button>
            <h2 style={{margin:0,fontSize:'1.1rem',fontWeight:600,color:'var(--text)'}}>{headerTitle()}</h2>
            <button onClick={next} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'var(--text)',padding:'0.375rem',display:'flex'}}><ChevronLeft size={18}/></button>
          </div>

          {/* MONTH VIEW */}
          {view === 'month' && <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem',marginBottom:'0.5rem'}}>
              {DAYS_HE.map(d=>(
                <div key={d} style={{textAlign:'center',fontSize:'0.75rem',color:'var(--text-muted)',fontWeight:600,padding:'0.25rem'}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem'}}>
              {monthCells.map((day, i) => {
                if (!day) return <div key={`e${i}`}/>
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                return renderDayCell(day, ds, true)
              })}
            </div>
          </>}

          {/* WEEK VIEW */}
          {view === 'week' && <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem',marginBottom:'0.5rem'}}>
              {weekDays.map((d,i)=>(
                <div key={i} style={{textAlign:'center',fontSize:'0.7rem',color:'var(--text-muted)',fontWeight:600}}>{DAYS_HE[i]}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem'}}>
              {weekDays.map(d => {
                const ds = dateStr(d)
                return renderDayCell(d, ds, true)
              })}
            </div>
            {/* Show events for all week days below */}
            <div style={{marginTop:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
              {weekDays.map(d => {
                const ds = dateStr(d)
                const tx = txByDate[ds] || []
                const rem = remByDate[ds] || []
                if (!tx.length && !rem.length) return null
                return (
                  <div key={ds}>
                    <div style={{fontSize:'0.8rem',fontWeight:600,color:'#a78bfa',marginBottom:'0.5rem'}}>{DAYS_FULL[d.getDay()]} {d.getDate()}/{d.getMonth()+1}</div>
                    {renderEvents(ds)}
                  </div>
                )
              })}
            </div>
          </>}

          {/* DAY VIEW */}
          {view === 'day' && (
            <div>
              <div style={{fontSize:'0.85rem',color:'var(--text-sub)',marginBottom:'1rem',textAlign:'center'}}>
                {current.getDate()} {MONTHS_HE[current.getMonth()]} {current.getFullYear()}
              </div>
              {renderEvents(dateStr(current))}
            </div>
          )}

          {/* Legend */}
          <div style={{marginTop:'1rem',display:'flex',gap:'1rem',justifyContent:'center'}}>
            {[['#6c63ff','טרנזקציות'],['#fbbf24','תזכורות']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.75rem',color:'var(--text-muted)'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="page-card">
          {selectedDateStr2 ? (
            <>
              <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'var(--text)'}}>
                {(() => { const d = new Date(selectedDateStr2+'T00:00:00'); return `${d.getDate()} ${MONTHS_HE[d.getMonth()]}` })()}
              </h3>
              {renderEvents(selectedDateStr2)}
            </>
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-dim)',textAlign:'center',gap:'0.5rem'}}>
              <span style={{fontSize:'2rem'}}>📅</span>
              <p style={{margin:0,fontSize:'0.85rem'}}>לחץ על תאריך לצפייה באירועים</p>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button onClick={openAdd} style={{
        position:'fixed', bottom:'5rem', left:'1.25rem', zIndex:50,
        width:52, height:52, borderRadius:'50%',
        background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',
        border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(108,99,255,0.5)', transition:'transform 0.15s',
      }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      >
        <Plus size={24} color="#fff"/>
      </button>

      {/* Add event modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowAdd(false)}}>
          <div style={{width:'100%',maxWidth:480,background:'var(--bg2)',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{margin:0,fontSize:'1rem',fontWeight:700,color:'var(--text)'}}>➕ אירוע חדש</h3>
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
            <div style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:'0.375rem'}}>
              🔔 התראה תישלח אוטומטית בשעת האירוע (עד 7 ימים מראש)
            </div>
            <button className="btn-primary" onClick={saveEvent} disabled={saving} style={{justifyContent:'center'}}>
              {saving ? 'שומר...' : 'שמור אירוע'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
