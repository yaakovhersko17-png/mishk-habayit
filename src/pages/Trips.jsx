import { useEffect, useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, MapPin, Coffee, SlidersHorizontal, X, Search } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const emptyForm = { type: 'trip', name: '', description: '', date_from: '', date_to: '', cost: '' }

const TYPE_LABELS = { trip: 'טיול', outing: 'יציאה' }
const TYPE_ICONS  = { trip: '🏕️', outing: '☕' }
const TYPE_COLORS = { trip: '#6c63ff', outing: '#f59e0b' }

export default function Trips() {
  const { user, profile } = useAuth()
  const [trips, setTrips]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(emptyForm)
  const [saving, setSaving]   = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch]   = useState('')
  const [filterType, setFilterType] = useState('')
  const [sortBy, setSortBy]   = useState('date_desc')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await withRetry(() =>
      supabase.from('trips').select('*,profiles(name)').order('created_at', { ascending: false })
    )
    setTrips(data || [])
    setLoading(false)
  }

  function openAdd()    { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(t)  { setEditing(t); setForm({ type:t.type, name:t.name, description:t.description||'', date_from:t.date_from||'', date_to:t.date_to||'', cost:t.cost||'' }); setModal(true) }

  async function handleSave() {
    if (!form.name) { toast.error('שם נדרש'); return }
    setSaving(true)
    const data = { ...form, cost: form.cost ? Number(form.cost) : null, date_from: form.date_from || null, date_to: form.date_to || null }
    if (editing) {
      await withRetry(() => supabase.from('trips').update(data).eq('id', editing.id))
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:'TRIP', description:`עדכן/ה: ${form.name}`, entityId:editing.id })
      toast.success('עודכן!')
    } else {
      await withRetry(() => supabase.from('trips').insert({ ...data, created_by: user.id }))
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.CREATE, entityType:'TRIP', description:`הוסיף/ה: ${form.name}` })
      toast.success('נוסף!')
    }
    setModal(false); load(); setSaving(false)
  }

  async function handleDelete(t) {
    if (!confirm(`למחוק את "${t.name}"?`)) return
    await withRetry(() => supabase.from('trips').delete().eq('id', t.id))
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.DELETE, entityType:'TRIP', description:`מחק/ה: ${t.name}` })
    toast.success('נמחק')
    load()
  }

  // Filter + Sort
  let display = trips
  if (search)      display = display.filter(t => t.name.includes(search) || (t.description||'').includes(search))
  if (filterType)  display = display.filter(t => t.type === filterType)
  if (sortBy === 'date_desc')  display = [...display].sort((a,b) => (b.date_from||b.created_at).localeCompare(a.date_from||a.created_at))
  if (sortBy === 'date_asc')   display = [...display].sort((a,b) => (a.date_from||a.created_at).localeCompare(b.date_from||b.created_at))
  if (sortBy === 'cost_desc')  display = [...display].sort((a,b) => (b.cost||0) - (a.cost||0))
  if (sortBy === 'name')       display = [...display].sort((a,b) => a.name.localeCompare(b.name, 'he'))

  const totalCost  = trips.reduce((s,t) => s + Number(t.cost||0), 0)
  const tripCount  = trips.filter(t => t.type==='trip').length
  const outingCount = trips.filter(t => t.type==='outing').length

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem',paddingBottom:'5rem'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>טיולים ויציאות</h1>
        <button className="btn-primary" onClick={openAdd}><Plus size={15}/>הוסף</button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem'}}>
        <div className="stat-card" style={{textAlign:'center',padding:'0.875rem'}}>
          <div style={{fontSize:'1.4rem',marginBottom:'0.25rem'}}>🏕️</div>
          <div style={{fontSize:'1.25rem',fontWeight:700,color:'#6c63ff'}}>{tripCount}</div>
          <div style={{fontSize:'0.75rem',color:'#64748b'}}>טיולים</div>
        </div>
        <div className="stat-card" style={{textAlign:'center',padding:'0.875rem'}}>
          <div style={{fontSize:'1.4rem',marginBottom:'0.25rem'}}>☕</div>
          <div style={{fontSize:'1.25rem',fontWeight:700,color:'#f59e0b'}}>{outingCount}</div>
          <div style={{fontSize:'0.75rem',color:'#64748b'}}>יציאות</div>
        </div>
        <div className="stat-card" style={{textAlign:'center',padding:'0.875rem'}}>
          <div style={{fontSize:'1.4rem',marginBottom:'0.25rem'}}>💸</div>
          <div style={{fontSize:'1.25rem',fontWeight:700,color:'#4ade80'}}>₪{totalCost.toLocaleString()}</div>
          <div style={{fontSize:'0.75rem',color:'#64748b'}}>סה״כ</div>
        </div>
      </div>

      {/* List */}
      {display.length === 0 ? (
        <div className="page-card" style={{textAlign:'center',padding:'3rem',color:'#475569'}}>
          {trips.length === 0 ? 'עדיין אין טיולים ויציאות 🗺️' : 'לא נמצאו תוצאות'}
        </div>
      ) : (
        <div className="page-card" style={{padding:0,overflow:'hidden'}}>
          {display.map((t, i) => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',borderBottom: i < display.length-1 ? '1px solid rgba(255,255,255,0.04)':'none'}}>
              <div style={{width:38,height:38,borderRadius:'0.75rem',background:`${TYPE_COLORS[t.type]}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0,border:`1px solid ${TYPE_COLORS[t.type]}30`}}>
                {TYPE_ICONS[t.type]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.875rem',fontWeight:600,color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</div>
                <div style={{display:'flex',gap:'0.5rem',marginTop:'0.15rem',flexWrap:'wrap'}}>
                  <span style={{fontSize:'0.7rem',padding:'0.1rem 0.4rem',borderRadius:'0.3rem',background:`${TYPE_COLORS[t.type]}20`,color:TYPE_COLORS[t.type]}}>{TYPE_LABELS[t.type]}</span>
                  {t.date_from && <span style={{fontSize:'0.7rem',color:'#64748b'}}>{t.date_from}{t.date_to && t.date_to !== t.date_from ? ` — ${t.date_to}` : ''}</span>}
                  {t.description && <span style={{fontSize:'0.7rem',color:'#475569',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:120}}>{t.description}</span>}
                </div>
              </div>
              <div style={{textAlign:'left',flexShrink:0}}>
                {t.cost ? <div style={{fontSize:'0.85rem',fontWeight:700,color:'#f87171'}}>₪{Number(t.cost).toLocaleString()}</div> : null}
              </div>
              <div style={{display:'flex',gap:'0.125rem',flexShrink:0}}>
                <button onClick={()=>openEdit(t)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'0.3rem'}}><Edit2 size={13}/></button>
                <button onClick={()=>handleDelete(t)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.3rem'}}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating filter button */}
      <button onClick={() => setFilterOpen(true)}
        style={{position:'fixed',bottom:'2rem',left:'2rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:50,transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <SlidersHorizontal size={22} color="#fff"/>
      </button>

      {/* Filter panel */}
      {filterOpen && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setFilterOpen(false)}>
          <div style={{width:'100%',background:'#1a1a2e',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
              <span style={{fontWeight:700,fontSize:'1rem',color:'#e2e8f0'}}>סינון ומיון</span>
              <button onClick={()=>setFilterOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}><X size={20}/></button>
            </div>

            {/* Search */}
            <div style={{position:'relative',marginBottom:'1rem'}}>
              <Search size={15} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'#64748b'}}/>
              <input className="input-field" placeholder="חיפוש לפי שם..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:'2.25rem'}}/>
            </div>

            {/* Type filter */}
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontSize:'0.8rem',color:'#64748b',marginBottom:'0.5rem'}}>סוג</div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                {[['','הכל'],['trip','טיולים'],['outing','יציאות']].map(([k,v])=>(
                  <button key={k} onClick={()=>setFilterType(k)}
                    style={{flex:1,padding:'0.4rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${filterType===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:filterType===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:filterType===k?'#a78bfa':'#94a3b8'}}>{v}</button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <div style={{fontSize:'0.8rem',color:'#64748b',marginBottom:'0.5rem'}}>מיון לפי</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                {[['date_desc','תאריך (חדש→ישן)'],['date_asc','תאריך (ישן→חדש)'],['cost_desc','עלות (גבוה→נמוך)'],['name','שם (א-ב)']].map(([k,v])=>(
                  <button key={k} onClick={()=>setSortBy(k)}
                    style={{padding:'0.4rem',borderRadius:'0.5rem',fontSize:'0.75rem',cursor:'pointer',border:`1px solid ${sortBy===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:sortBy===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:sortBy===k?'#a78bfa':'#94a3b8'}}>{v}</button>
                ))}
              </div>
            </div>

            <button className="btn-primary" onClick={()=>setFilterOpen(false)} style={{width:'100%',justifyContent:'center',marginTop:'1.25rem'}}>החל</button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editing ? 'ערוך' : 'הוסף טיול / יציאה'}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>סוג</label>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {[['trip','🏕️ טיול'],['outing','☕ יציאה']].map(([k,v])=>(
                <button key={k} onClick={()=>setForm({...form,type:k})}
                  style={{flex:1,padding:'0.5rem',borderRadius:'0.5rem',fontSize:'0.85rem',cursor:'pointer',border:`1px solid ${form.type===k?`${TYPE_COLORS[k]}60`:'rgba(255,255,255,0.08)'}`,background:form.type===k?`${TYPE_COLORS[k]}20`:'rgba(255,255,255,0.03)',color:form.type===k?TYPE_COLORS[k]:'#94a3b8'}}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>שם</label>
            <input className="input-field" placeholder="שם הטיול / יציאה..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תיאור (לא חובה)</label>
            <input className="input-field" placeholder="לאן הלכנו, מה עשינו..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>מתאריך</label>
              <input className="input-field" type="date" value={form.date_from} onChange={e=>setForm({...form,date_from:e.target.value})} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>עד תאריך</label>
              <input className="input-field" type="date" value={form.date_to} onChange={e=>setForm({...form,date_to:e.target.value})} dir="ltr"/>
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>עלות כוללת ₪ (לא חובה)</label>
            <input className="input-field" type="number" placeholder="0" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} dir="ltr"/>
          </div>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
            <button className="btn-ghost" onClick={()=>setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'שומר...':'שמור'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
