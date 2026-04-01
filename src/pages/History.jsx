import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Filter } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const ACTION_ICONS = {
  'הוספה':'➕', 'עריכה':'✏️', 'מחיקה':'🗑️',
  'התחברות':'🔐', 'התנתקות':'🚪', 'סריקה':'📸',
  'ייצוא':'📤', 'השלמה':'✅',
}

export default function History() {
  const [logs, setLogs]       = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState({ user:'', action:'', entity:'' })
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: logData }, { data: pData }] = await Promise.all([
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('*'),
    ])
    setLogs(logData || [])
    setProfiles(pData || [])
    setLoading(false)
  }

  const allActions = [...new Set(logs.map(l => l.action_type))]
  const allEntities = [...new Set(logs.map(l => l.entity_type))]

  const filtered = logs
    .filter(l => {
      const q = search.toLowerCase()
      if (q && !l.description?.toLowerCase().includes(q) && !l.user_name?.toLowerCase().includes(q)) return false
      if (filter.user && l.user_id !== filter.user) return false
      if (filter.action && l.action_type !== filter.action) return false
      if (filter.entity && l.entity_type !== filter.entity) return false
      return true
    })
    .sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at)
      return sortAsc ? diff : -diff
    })

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>היסטוריה</h1>
          <p style={{margin:'0.25rem 0 0',color:'#64748b',fontSize:'0.875rem'}}>{filtered.length} פעולות</p>
        </div>
        <button className="btn-ghost" onClick={() => setSortAsc(!sortAsc)} style={{fontSize:'0.8rem'}}>
          {sortAsc ? '↑ ישן לחדש' : '↓ חדש לישן'}
        </button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:180}}>
          <Search size={14} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'#64748b'}}/>
          <input className="input-field" placeholder="חיפוש..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:'2.25rem'}}/>
        </div>
        <select className="input-field" style={{width:'auto'}} value={filter.user} onChange={e=>setFilter({...filter,user:e.target.value})}>
          <option value="">כל המשתמשים</option>
          {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input-field" style={{width:'auto'}} value={filter.action} onChange={e=>setFilter({...filter,action:e.target.value})}>
          <option value="">כל הפעולות</option>
          {allActions.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input-field" style={{width:'auto'}} value={filter.entity} onChange={e=>setFilter({...filter,entity:e.target.value})}>
          <option value="">כל הסוגים</option>
          {allEntities.map(e=><option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="📋" title="אין פעילות" subtitle="הפעולות יופיעו כאן"/>
        : (
          <div className="page-card" style={{padding:0,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    {['פעולה','תיאור','סוג','משתמש','תאריך ושעה'].map(h=>(
                      <th key={h} style={{padding:'0.875rem 1rem',textAlign:'right',fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'0.75rem 1rem',whiteSpace:'nowrap'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                          <span style={{fontSize:'1rem'}}>{ACTION_ICONS[l.action_type]||'⚡'}</span>
                          <span style={{fontSize:'0.8rem',fontWeight:500,color:'#a78bfa'}}>{l.action_type}</span>
                        </div>
                      </td>
                      <td style={{padding:'0.75rem 1rem',color:'#e2e8f0',fontSize:'0.85rem',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.description}</td>
                      <td style={{padding:'0.75rem 1rem'}}>
                        <span style={{fontSize:'0.75rem',padding:'0.125rem 0.5rem',borderRadius:'9999px',background:'rgba(255,255,255,0.06)',color:'#94a3b8'}}>{l.entity_type}</span>
                      </td>
                      <td style={{padding:'0.75rem 1rem',fontSize:'0.8rem',color:'#64748b'}}>{l.user_name}</td>
                      <td style={{padding:'0.75rem 1rem',fontSize:'0.75rem',color:'#475569',whiteSpace:'nowrap'}}>
                        {new Date(l.created_at).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div>
  )
}
