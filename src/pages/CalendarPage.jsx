import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const DAYS_HE = ['א','ב','ג','ד','ה','ו','ש']
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

export default function CalendarPage() {
  const [today] = useState(new Date())
  const [current, setCurrent] = useState(new Date())
  const [txByDate, setTxByDate] = useState({})
  const [remByDate, setRemByDate] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [current])

  async function load() {
    const y = current.getFullYear(), m = current.getMonth()
    const from = `${y}-${String(m+1).padStart(2,'0')}-01`
    const to   = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    const [{ data: txData }, { data: remData }] = await Promise.all([
      supabase.from('transactions').select('date,type,amount,description').gte('date',from).lte('date',to),
      supabase.from('reminders').select('due_date,title,is_completed').gte('due_date',from+'T00:00:00').lte('due_date',to+'T23:59:59'),
    ])
    const tbd = {}, rbd = {}
    ;(txData||[]).forEach(t => { if (!tbd[t.date]) tbd[t.date] = []; tbd[t.date].push(t) })
    ;(remData||[]).forEach(r => { const d = r.due_date?.split('T')[0]; if (d) { if (!rbd[d]) rbd[d]=[]; rbd[d].push(r) } })
    setTxByDate(tbd); setRemByDate(rbd); setLoading(false)
  }

  const year = current.getFullYear(), month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonth = () => setCurrent(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1))

  const selectedDateStr = selected ? `${year}-${String(month+1).padStart(2,'0')}-${String(selected).padStart(2,'0')}` : null
  const selectedTx  = selectedDateStr ? (txByDate[selectedDateStr] || []) : []
  const selectedRem = selectedDateStr ? (remByDate[selectedDateStr] || []) : []

  if (loading) return <LoadingSpinner />

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>לוח שנה</h1>

      <div className="cal-grid">
        <div className="page-card">
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
            <button onClick={prevMonth} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'#e2e8f0',padding:'0.375rem',display:'flex'}}><ChevronRight size={18}/></button>
            <h2 style={{margin:0,fontSize:'1.1rem',fontWeight:600,color:'#e2e8f0'}}>{MONTHS_HE[month]} {year}</h2>
            <button onClick={nextMonth} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'0.5rem',cursor:'pointer',color:'#e2e8f0',padding:'0.375rem',display:'flex'}}><ChevronLeft size={18}/></button>
          </div>

          {/* Day headers */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem',marginBottom:'0.5rem'}}>
            {DAYS_HE.map(d=>(
              <div key={d} style={{textAlign:'center',fontSize:'0.75rem',color:'#64748b',fontWeight:600,padding:'0.25rem'}}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.25rem'}}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`}/>
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const hasTx  = txByDate[dateStr]?.length > 0
              const hasRem = remByDate[dateStr]?.length > 0
              const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear()
              const isSel = selected===day
              return (
                <div key={day} onClick={()=>setSelected(day===selected?null:day)} style={{
                  aspectRatio:'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  borderRadius:'0.625rem',cursor:'pointer',transition:'all 0.15s',position:'relative',
                  background:isSel?'rgba(108,99,255,0.3)':isToday?'rgba(108,99,255,0.15)':'transparent',
                  border:isSel?'1px solid rgba(108,99,255,0.5)':isToday?'1px solid rgba(108,99,255,0.3)':'1px solid transparent',
                  color:isSel?'#a78bfa':isToday?'#c4b5fd':'#e2e8f0',
                  fontSize:'0.875rem',fontWeight:isToday||isSel?700:400,
                }}>
                  {day}
                  {(hasTx || hasRem) && (
                    <div style={{position:'absolute',bottom:3,display:'flex',gap:'2px'}}>
                      {hasTx  && <div style={{width:4,height:4,borderRadius:'50%',background:'#6c63ff'}}/>}
                      {hasRem && <div style={{width:4,height:4,borderRadius:'50%',background:'#fbbf24'}}/>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{marginTop:'1rem',display:'flex',gap:'1rem',justifyContent:'center'}}>
            {[['#6c63ff','טרנזקציות'],['#fbbf24','תזכורות']].map(([c,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:'0.375rem',fontSize:'0.75rem',color:'#64748b'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="page-card">
          {selected ? (
            <>
              <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#e2e8f0'}}>
                {selected} {MONTHS_HE[month]}
              </h3>
              {selectedTx.length === 0 && selectedRem.length === 0
                ? <p style={{color:'#475569',fontSize:'0.85rem',textAlign:'center',marginTop:'2rem'}}>אין אירועים</p>
                : <>
                  {selectedTx.length > 0 && (
                    <div style={{marginBottom:'1rem'}}>
                      <div style={{fontSize:'0.75rem',color:'#6c63ff',fontWeight:600,marginBottom:'0.5rem'}}>💳 טרנזקציות</div>
                      {selectedTx.map((t,i)=>(
                        <div key={i} style={{padding:'0.5rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.04)',marginBottom:'0.375rem'}}>
                          <div style={{fontSize:'0.8rem',color:'#e2e8f0'}}>{t.description}</div>
                          <div style={{fontSize:'0.75rem',color:t.type==='income'?'#4ade80':'#f87171',fontWeight:600}}>₪{Number(t.amount).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedRem.length > 0 && (
                    <div>
                      <div style={{fontSize:'0.75rem',color:'#fbbf24',fontWeight:600,marginBottom:'0.5rem'}}>🔔 תזכורות</div>
                      {selectedRem.map((r,i)=>(
                        <div key={i} style={{padding:'0.5rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.04)',marginBottom:'0.375rem'}}>
                          <div style={{fontSize:'0.8rem',color:'#e2e8f0',textDecoration:r.is_completed?'line-through':'none'}}>{r.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              }
            </>
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#475569',textAlign:'center',gap:'0.5rem'}}>
              <span style={{fontSize:'2rem'}}>📅</span>
              <p style={{margin:0,fontSize:'0.85rem'}}>לחץ על תאריך לצפייה באירועים</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
