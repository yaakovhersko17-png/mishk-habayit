import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Edit2, Search } from 'lucide-react'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const NOTE_COLORS = ['#FFF9C4','#C8E6C9','#BBDEFB','#F8BBD9','#E1BEE7','#FFCCBC','#B2EBF2','#D7CCC8']
const emptyNote = { title:'', content:'', color:'#FFF9C4' }

export default function Notes() {
  const { user, profile } = useAuth()
  const [notes, setNotes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]     = useState(emptyNote)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('notes').select('*,profiles(name)').order('created_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  function openAdd()   { setEditing(null); setForm(emptyNote); setModal(true) }
  function openEdit(n) { setEditing(n); setForm({ title:n.title||'', content:n.content||'', color:n.color }); setModal(true) }

  async function handleSave() {
    if (!form.content && !form.title) { toast.error('הוסף תוכן לפתק'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('notes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:ENTITY_TYPES.NOTE, description:`עדכן/ה פתק: ${form.title||'ללא כותרת'}`, entityId:editing.id })
      toast.success('עודכן!')
    } else {
      await supabase.from('notes').insert({ ...form, created_by: user.id })
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.CREATE, entityType:ENTITY_TYPES.NOTE, description:`הוסיף/ה פתק: ${form.title||'ללא כותרת'}` })
      toast.success('פתק נוסף!')
    }
    setModal(false); load(); setSaving(false)
  }

  async function handleDelete(n) {
    if (!confirm('למחוק פתק זה?')) return
    await supabase.from('notes').delete().eq('id', n.id)
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.DELETE, entityType:ENTITY_TYPES.NOTE, description:`מחק/ה פתק: ${n.title||'ללא כותרת'}`, entityId:n.id })
    toast.success('נמחק')
    load()
  }

  const filtered = notes.filter(n => {
    const q = search.toLowerCase()
    return !q || n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
  })

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>פתקים</h1>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <div style={{position:'relative'}}>
            <Search size={14} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
            <input className="input-field" style={{paddingRight:'2.25rem',width:200}} placeholder="חיפוש..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button className="btn-primary" onClick={openAdd} style={{padding:'0.4rem 0.875rem',minHeight:'unset',fontSize:'0.875rem'}}><Plus size={14}/>פתק חדש</button>
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="📝" title="אין פתקים עדיין" subtitle="הוסף פתק ראשון" action={<button className="btn-primary" onClick={openAdd}><Plus size={14}/>הוסף פתק</button>}/>
        : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'1rem',alignItems:'start'}}>
            {filtered.map(n => (
              <div key={n.id} style={{borderRadius:'0.875rem',padding:'1rem',background:n.color,color:'#1a1a2e',position:'relative',animation:'cardEnter 0.3s ease',boxShadow:'0 4px 15px rgba(0,0,0,0.2)'}}>
                <div style={{position:'absolute',top:'0.625rem',left:'0.625rem',display:'flex',gap:'0.25rem'}}>
                  <button onClick={()=>openEdit(n)} style={{background:'rgba(0,0,0,0.1)',border:'none',cursor:'pointer',padding:'0.25rem',borderRadius:'0.375rem',color:'#1a1a2e',display:'flex'}}><Edit2 size={12}/></button>
                  <button onClick={()=>handleDelete(n)} style={{background:'rgba(0,0,0,0.1)',border:'none',cursor:'pointer',padding:'0.25rem',borderRadius:'0.375rem',color:'#ef4444',display:'flex'}}><Trash2 size={12}/></button>
                </div>
                {n.title && <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:'0.5rem',paddingTop:'0.25rem'}}>{n.title}</div>}
                <div style={{fontSize:'0.85rem',lineHeight:1.5,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{n.content}</div>
                <div style={{marginTop:'0.75rem',fontSize:'0.7rem',color:'rgba(0,0,0,0.4)',display:'flex',justifyContent:'space-between'}}>
                  <span>{n.profiles?.name}</span>
                  <span>{new Date(n.created_at).toLocaleDateString('he-IL')}</span>
                </div>
              </div>
            ))}
          </div>
        )
      }

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'ערוך פתק':'פתק חדש'}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>כותרת (אופציונלי)</label>
            <input className="input-field" placeholder="כותרת..." value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>תוכן</label>
            <textarea className="input-field" placeholder="תוכן הפתק..." value={form.content} onChange={e=>setForm({...form,content:e.target.value})} rows={5} style={{resize:'vertical'}}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.5rem'}}>צבע</label>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
              {NOTE_COLORS.map(c=>(
                <button key={c} onClick={()=>setForm({...form,color:c})} style={{width:32,height:32,borderRadius:'0.5rem',background:c,border:`3px solid ${form.color===c?'#6c63ff':'transparent'}`,cursor:'pointer'}}/>
              ))}
            </div>
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
