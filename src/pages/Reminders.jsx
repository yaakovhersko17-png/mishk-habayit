import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Bell, Check, Trash2, Clock, ShoppingCart, Edit2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const emptyForm = { title:'', description:'', due_date:'', is_shopping_list:false, shopping_items:[], assigned_to:'' }

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
  const [tab, setTab]             = useState('active')

  useEffect(() => {
    load()
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch (_) {}
  }, [])

  async function load() {
    const [{ data: rData, error: rErr }, { data: pData }] = await Promise.all([
      supabase.from('reminders').select('*').order('due_date'),
      supabase.from('profiles').select('id,name'),
    ])
    if (rErr) { console.error('Reminders load error:', rErr); toast.error('שגיאה בטעינת תזכורות') }
    setReminders(rData || [])
    setProfiles(pData || [])
    setLoading(false)
    // Schedule notifications
    ;(rData || []).filter(r => !r.is_completed && r.due_date).forEach(r => {
      const diff = new Date(r.due_date) - Date.now()
      if (diff > 0 && diff < 3600000) { // within 1 hour
        setTimeout(() => {
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`תזכורת: ${r.title}`, { body: r.description || '' })
            }
          } catch (_) {}
        }, diff)
      }
    })
  }

  function openAdd()   { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(r) {
    setEditing(r)
    setForm({ title:r.title, description:r.description||'', due_date:r.due_date?r.due_date.slice(0,16):'', is_shopping_list:r.is_shopping_list, shopping_items:r.shopping_items||[], assigned_to:r.assigned_to||'' })
    setModal(true)
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

  const now = Date.now()
  const active    = reminders.filter(r => !r.is_completed && (!r.due_date || new Date(r.due_date) >= now))
  const overdue   = reminders.filter(r => !r.is_completed && r.due_date && new Date(r.due_date) < now)
  const completed = reminders.filter(r => r.is_completed)
  const lists = { active, overdue, completed }
  const labels = { active:'פעילות', overdue:'עברה הזמן', completed:'הושלמו' }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>תזכורות</h1>
        <button className="btn-primary" onClick={openAdd}><Plus size={15}/>תזכורת חדשה</button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'0.5rem',borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:'0'}}>
        {Object.entries(labels).map(([k,v])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:'0.5rem 1rem',background:'none',border:'none',cursor:'pointer',color:tab===k?'#a78bfa':'#64748b',fontWeight:tab===k?600:400,borderBottom:`2px solid ${tab===k?'#6c63ff':'transparent'}`,marginBottom:-1,fontSize:'0.875rem',fontFamily:'inherit'}}>
            {v} <span style={{marginRight:'0.25rem',fontSize:'0.75rem',opacity:0.7}}>({lists[k].length})</span>
          </button>
        ))}
      </div>

      {lists[tab].length === 0
        ? <EmptyState icon="🔔" title={`אין תזכורות ${labels[tab]}`} action={tab==='active'&&<button className="btn-primary" onClick={openAdd}><Plus size={14}/>הוסף</button>}/>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {lists[tab].map(r => (
              <div key={r.id} className="page-card" style={{padding:'1rem',display:'flex',alignItems:'flex-start',gap:'1rem',opacity:r.is_completed?0.6:1}}>
                <button onClick={()=>toggleComplete(r)} style={{marginTop:'0.125rem',width:22,height:22,borderRadius:'50%',border:`2px solid ${r.is_completed?'#4ade80':'rgba(255,255,255,0.2)'}`,background:r.is_completed?'rgba(74,222,128,0.2)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {r.is_completed && <Check size={12} color="#4ade80"/>}
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
                    <span style={{fontWeight:600,color:'#e2e8f0',textDecoration:r.is_completed?'line-through':'none'}}>{r.title}</span>
                    {r.is_shopping_list && <span style={{display:'inline-flex',alignItems:'center',gap:'0.25rem',fontSize:'0.7rem',color:'#60a5fa',background:'rgba(96,165,250,0.15)',padding:'0.125rem 0.5rem',borderRadius:'9999px'}}><ShoppingCart size={10}/>רשימת קניות</span>}
                    {r.due_date && (
                      <span style={{display:'inline-flex',alignItems:'center',gap:'0.25rem',fontSize:'0.75rem',color:tab==='overdue'?'#f87171':'#64748b'}}>
                        <Clock size={11}/>{new Date(r.due_date).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}
                      </span>
                    )}
                  </div>
                  {r.description && <p style={{margin:'0.25rem 0 0',fontSize:'0.8rem',color:'#64748b'}}>{r.description}</p>}
                  {r.is_shopping_list && r.shopping_items?.length > 0 && (
                    <div style={{marginTop:'0.5rem',display:'flex',flexWrap:'wrap',gap:'0.375rem'}}>
                      {r.shopping_items.map((item,i)=>(
                        <span key={i} style={{fontSize:'0.75rem',padding:'0.125rem 0.5rem',borderRadius:'0.375rem',background:'rgba(255,255,255,0.06)',color:'#94a3b8'}}>{item.text}</span>
                      ))}
                    </div>
                  )}
                  {r.assigned_to && <div style={{marginTop:'0.375rem',fontSize:'0.75rem',color:'#475569'}}>מוקצה ל: {profiles.find(p=>p.id===r.assigned_to)?.name || '—'}</div>}
                </div>
                <div style={{display:'flex',gap:'0.25rem',flexShrink:0}}>
                  <button onClick={()=>openEdit(r)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'0.25rem'}}><Edit2 size={13}/></button>
                  <button onClick={()=>handleDelete(r)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem'}}><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'ערוך תזכורת':'תזכורת חדשה'} size="lg">
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>כותרת</label>
            <input className="input-field" placeholder="כותרת..." value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תיאור</label>
            <textarea className="input-field" placeholder="תיאור..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} style={{resize:'vertical'}}/>
          </div>
          <div className="form-2col">
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תאריך ושעה</label>
              <input className="input-field" type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>הקצה למשתמש</label>
              <select className="input-field" value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}>
                <option value="">כולם</option>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',color:'#94a3b8',fontSize:'0.875rem'}}>
            <input type="checkbox" checked={form.is_shopping_list} onChange={e=>setForm({...form,is_shopping_list:e.target.checked})} style={{accentColor:'#6c63ff'}}/>
            רשימת קניות
          </label>
          {form.is_shopping_list && (
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>פריטים</label>
              <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}}>
                <input className="input-field" placeholder="הוסף פריט..." value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addShoppingItem()} style={{flex:1}}/>
                <button className="btn-ghost" onClick={addShoppingItem} style={{flexShrink:0}}>הוסף</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.375rem'}}>
                {form.shopping_items.map((item,i)=>(
                  <span key={i} style={{display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.25rem 0.625rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.06)',fontSize:'0.8rem',color:'#94a3b8'}}>
                    {item.text}
                    <button onClick={()=>setForm(f=>({...f,shopping_items:f.shopping_items.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:0,display:'flex'}}>×</button>
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
