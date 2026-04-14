import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import { useRealtime } from '../hooks/useRealtime'
import toast from 'react-hot-toast'

const COLORS = ['#4CAF50','#2196F3','#FF9800','#E91E63','#00BCD4','#9C27B0','#FF5722','#607D8B','#8BC34A','#6c63ff','#f87171','#fbbf24','#60a5fa','#f472b6','#34d399']

const emptyForm = { name:'', icon:'', color:'#6c63ff', type:'expense', parent_id:'' }

export default function Categories() {
  const { user, profile } = useAuth()
  const [cats, setCats]       = useState([])
  const [txCounts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(emptyForm)
  const [saving, setSaving]   = useState(false)
  useEffect(() => { load() }, [])
  useRealtime('categories', load)

  async function load() {
    const [{ data: cData }, { data: txData }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('transactions').select('category_id, amount'),
    ])
    setCats(cData || [])
    const counts = {}
    ;(txData || []).forEach(t => {
      if (t.category_id) {
        if (!counts[t.category_id]) counts[t.category_id] = { count: 0, total: 0 }
        counts[t.category_id].count++
        counts[t.category_id].total += Number(t.amount)
      }
    })
    setCounts(counts)
    setLoading(false)
  }

  function openAdd()  { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(c) { setEditing(c); setForm({ name:c.name, icon:c.icon, color:c.color, type:c.type, parent_id:c.parent_id||'' }); setModal(true) }

  async function handleSave() {
    if (!form.name) { toast.error('שם קטגוריה נדרש'); return }
    setSaving(true)
    const saveData = { ...form, parent_id: form.parent_id || null }
    if (editing) {
      await supabase.from('categories').update(saveData).eq('id', editing.id)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:ENTITY_TYPES.CATEGORY, description:`עדכן/ה קטגוריה: ${form.name}`, entityId:editing.id })
      toast.success('עודכן!')
    } else {
      await supabase.from('categories').insert({ ...saveData, created_by: user.id })
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.CREATE, entityType:ENTITY_TYPES.CATEGORY, description:`הוסיף/ה קטגוריה: ${form.name}` })
      toast.success('נוסף!')
    }
    setModal(false); load(); setSaving(false)
  }

  async function handleDelete(c) {
    if (!confirm(`למחוק את "${c.name}"?`)) return
    await supabase.from('categories').delete().eq('id', c.id)
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.DELETE, entityType:ENTITY_TYPES.CATEGORY, description:`מחק/ה קטגוריה: ${c.name}`, entityId:c.id })
    toast.success('נמחק')
    load()
  }

  if (loading) return <LoadingSpinner />

  // Build hierarchy
  const parents = cats.filter(c => !c.parent_id)
  const childrenByParent = {}
  cats.filter(c => c.parent_id).forEach(c => {
    if (!childrenByParent[c.parent_id]) childrenByParent[c.parent_id] = []
    childrenByParent[c.parent_id].push(c)
  })

  function renderCatRow(c, isChild) {
    return (
      <div key={c.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem 1rem',paddingRight:isChild?'2.75rem':'1rem',borderTop:'1px solid rgba(255,255,255,0.04)',background:isChild?'rgba(255,255,255,0.025)':'transparent'}}>
        <div style={{width:32,height:32,borderRadius:'0.625rem',background:`${c.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0,border:`1px solid ${c.color}30`}}>{c.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'0.875rem',fontWeight:500,color:'var(--text)'}}>{c.name}</div>
        </div>
        <div style={{textAlign:'left',flexShrink:0}}>
          <div style={{fontSize:'0.8rem',fontWeight:600,color:c.type==='income'?'#4ade80':'#f87171'}}>₪{(txCounts[c.id]?.total||0).toLocaleString()}</div>
          <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>{txCounts[c.id]?.count||0} טרנ׳</div>
        </div>
        <div style={{display:'flex',gap:'0.125rem',flexShrink:0}}>
          <button onClick={()=>openEdit(c)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.3rem'}}><Edit2 size={13}/></button>
          <button onClick={()=>handleDelete(c)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.3rem'}}><Trash2 size={13}/></button>
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>קטגוריות</h1>
        <button className="btn-primary" onClick={openAdd}><Plus size={15}/>קטגוריה חדשה</button>
      </div>

      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        {parents.map((c, i) => {
          const kids = childrenByParent[c.id] || []
          return (
            <div key={c.id}>
              {/* Parent row */}
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem 1rem',borderTop:i>0?'1px solid rgba(255,255,255,0.04)':'none'}}>
                <div style={{width:18,flexShrink:0}}/>
                <div style={{width:32,height:32,borderRadius:'0.625rem',background:`${c.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0,border:`1px solid ${c.color}30`}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'0.875rem',fontWeight:600,color:'var(--text)'}}>{c.name}</div>
                  {kids.length > 0 && <div style={{fontSize:'0.7rem',color:'var(--text-muted)',marginTop:'0.1rem'}}>{kids.length} תת-קטגוריות</div>}
                </div>
                <div style={{textAlign:'left',flexShrink:0}}>
                  <div style={{fontSize:'0.8rem',fontWeight:600,color:c.type==='income'?'#4ade80':'#f87171'}}>₪{(txCounts[c.id]?.total||0).toLocaleString()}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>{txCounts[c.id]?.count||0} טרנ׳</div>
                </div>
                <div style={{display:'flex',gap:'0.125rem',flexShrink:0}}>
                  <button onClick={()=>openEdit(c)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.3rem'}}><Edit2 size={13}/></button>
                  <button onClick={()=>handleDelete(c)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.3rem'}}><Trash2 size={13}/></button>
                </div>
              </div>
              {/* Always-visible child rows */}
              {kids.map(k => renderCatRow(k, true))}
            </div>
          )
        })}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'ערוך קטגוריה':'קטגוריה חדשה'}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>שם</label>
            <input className="input-field" placeholder="שם הקטגוריה..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>סוג</label>
            <div style={{display:'flex',gap:'0.5rem'}}>
              {[['expense','הוצאה'],['income','הכנסה'],['both','שניהם']].map(([k,v])=>(
                <button key={k} onClick={()=>setForm({...form,type:k})} style={{flex:1,padding:'0.4rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${form.type===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:form.type===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:form.type===k?'#a78bfa':'var(--text-sub)'}}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.375rem'}}>קטגוריית הורה</label>
            <select className="input-field" value={form.parent_id} onChange={e=>setForm({...form,parent_id:e.target.value})}>
              <option value="">ללא הורה</option>
              {cats.filter(c => (!editing || c.id !== editing.id) && !c.parent_id).map(c=>(
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.5rem'}}>אייקון</label>
            <input className="input-field" value={form.icon} onChange={e=>setForm({...form,icon:e.target.value})} placeholder="לחץ להוספת אמוג׳י 😀" style={{fontSize:'1.5rem',textAlign:'center'}}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'var(--text-sub)',display:'block',marginBottom:'0.5rem'}}>צבע</label>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
              {COLORS.map(c=>(
                <button key={c} onClick={()=>setForm({...form,color:c})} style={{width:26,height:26,borderRadius:'50%',background:c,border:`3px solid ${form.color===c?'#fff':'transparent'}`,cursor:'pointer'}}/>
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
