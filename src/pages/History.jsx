import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const ACTION_ICONS = {
  'הוספה':'➕', 'עריכה':'✏️', 'מחיקה':'🗑️',
  'התחברות':'🔐', 'התנתקות':'🚪', 'סריקה':'📸',
  'ייצוא':'📤', 'השלמה':'✅',
}

export default function History() {
  const [logs, setLogs]         = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState({ user:'', action:'', entity:'' })
  const [sortAsc, setSortAsc]   = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

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

  const allActions  = [...new Set(logs.map(l => l.action_type))]
  const allEntities = [...new Set(logs.map(l => l.entity_type))]

  const filtered = logs
    .filter(l => {
      const q = search.toLowerCase()
      if (q && !l.description?.toLowerCase().includes(q) && !l.user_name?.toLowerCase().includes(q)) return false
      if (filter.user   && l.user_id     !== filter.user)   return false
      if (filter.action && l.action_type !== filter.action) return false
      if (filter.entity && l.entity_type !== filter.entity) return false
      return true
    })
    .sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at)
      return sortAsc ? diff : -diff
    })

  const activeFilters = [filter.user, filter.action, filter.entity, search].filter(Boolean).length

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>היסטוריה</h1>
          <p style={{margin:'0.25rem 0 0',color:'var(--text-muted)',fontSize:'0.875rem'}}>{filtered.length} פעולות</p>
        </div>
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
                      <th key={h} style={{padding:'0.875rem 1rem',textAlign:'right',fontSize:'0.75rem',color:'var(--text-muted)',fontWeight:500}}>{h}</th>
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
                      <td style={{padding:'0.75rem 1rem',color:'var(--text)',fontSize:'0.85rem',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.description}</td>
                      <td style={{padding:'0.75rem 1rem'}}>
                        <span style={{fontSize:'0.75rem',padding:'0.125rem 0.5rem',borderRadius:'9999px',background:'rgba(255,255,255,0.06)',color:'var(--text-sub)'}}>{l.entity_type}</span>
                      </td>
                      <td style={{padding:'0.75rem 1rem',fontSize:'0.8rem',color:'var(--text-muted)'}}>{l.user_name}</td>
                      <td style={{padding:'0.75rem 1rem',fontSize:'0.75rem',color:'var(--text-dim)',whiteSpace:'nowrap'}}>
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

      {/* Floating filter button */}
      <button onClick={() => setFilterOpen(true)}
        style={{position:'fixed',bottom:'2rem',left:'2rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:50,transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <SlidersHorizontal size={22} color="#fff"/>
        {activeFilters > 0 && (
          <span style={{position:'absolute',top:2,right:2,width:18,height:18,borderRadius:'50%',background:'#f87171',fontSize:'0.65rem',fontWeight:700,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>{activeFilters}</span>
        )}
      </button>

      {/* Filter panel */}
      {filterOpen && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setFilterOpen(false)}>
          <div style={{width:'100%',background:'#1a1a2e',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
              <span style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>סינון ומיון</span>
              <button onClick={()=>setFilterOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>

            {/* Search */}
            <div style={{position:'relative',marginBottom:'1rem'}}>
              <Search size={15} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
              <input className="input-field" placeholder="חיפוש..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:'2.25rem'}}/>
            </div>

            {/* User */}
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:'0.5rem'}}>משתמש</div>
              <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                {[['','הכל'],...profiles.map(p=>[p.id,p.name])].map(([k,v])=>(
                  <button key={k} onClick={()=>setFilter(f=>({...f,user:k}))}
                    style={{padding:'0.35rem 0.75rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${filter.user===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:filter.user===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:filter.user===k?'#a78bfa':'var(--text-sub)'}}>{v}</button>
                ))}
              </div>
            </div>

            {/* Action */}
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:'0.5rem'}}>פעולה</div>
              <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                {[['','הכל'],...allActions.map(a=>[a,a])].map(([k,v])=>(
                  <button key={k} onClick={()=>setFilter(f=>({...f,action:k}))}
                    style={{padding:'0.35rem 0.75rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${filter.action===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:filter.action===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:filter.action===k?'#a78bfa':'var(--text-sub)'}}>{v}</button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:'0.5rem'}}>מיון</div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                {[[false,'חדש לישן'],[true,'ישן לחדש']].map(([k,v])=>(
                  <button key={String(k)} onClick={()=>setSortAsc(k)}
                    style={{flex:1,padding:'0.4rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${sortAsc===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:sortAsc===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:sortAsc===k?'#a78bfa':'var(--text-sub)'}}>{v}</button>
                ))}
              </div>
            </div>

            <button onClick={()=>{setFilter({user:'',action:'',entity:''});setSearch('');setSortAsc(false)}}
              style={{width:'100%',padding:'0.6rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'var(--text-sub)',cursor:'pointer',fontSize:'0.85rem'}}>
              נקה סינון
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
