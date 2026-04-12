import { useEffect, useState } from 'react'
import { supabase, withRetry, canPerform } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Shield, Users, Activity, Database, RefreshCw } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

export default function AdminPanel() {
  const { profile } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [stats, setStats]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [logs, setLogs]         = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: pData }, { data: txData }, { data: wData }, { data: logData }] = await Promise.all([
      withRetry(() => supabase.from('profiles').select('*')),
      withRetry(() => supabase.from('transactions').select('id,amount,type')),
      withRetry(() => supabase.from('wallets').select('id,balance')),
      withRetry(() => supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20)),
    ])
    setProfiles(pData || [])
    setLogs(logData || [])
    const income = (txData||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
    const expense = (txData||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
    setStats({
      users: (pData||[]).length,
      transactions: (txData||[]).length,
      wallets: (wData||[]).length,
      totalBalance: (wData||[]).reduce((s,w)=>s+Number(w.balance),0),
      income, expense,
    })
    setLoading(false)
  }

  async function toggleRole(p) {
    if (!canPerform(profile, 'change_roles')) { toast.error('אין לך הרשאה לשנות תפקידים'); return }
    const newRole = p.role === 'admin' ? 'user' : 'admin'
    await withRetry(() => supabase.from('profiles').update({ role: newRole }).eq('id', p.id))
    toast.success(`${p.name} עודכן ל-${newRole}`)
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
        <div style={{width:36,height:36,borderRadius:'0.75rem',background:'linear-gradient(135deg,#f87171,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center'}}><Shield size={18} color="#fff"/></div>
        <div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>פאנל אדמין</h1>
          <p style={{margin:0,fontSize:'0.8rem',color:'var(--text-muted)'}}>גישה מורשית: {profile?.name}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'1rem'}}>
        {[
          ['משתמשים',stats.users,'#6c63ff','👤'],
          ['טרנזקציות',stats.transactions,'#60a5fa','💳'],
          ['ארנקים',stats.wallets,'#4ade80','🏦'],
          ['יתרה כוללת',`₪${Number(stats.totalBalance||0).toLocaleString()}`,'#fbbf24','💰'],
        ].map(([l,v,c,ic])=>(
          <div key={l} className="stat-card">
            <div style={{fontSize:'1.5rem',marginBottom:'0.5rem'}}>{ic}</div>
            <div style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>{l}</div>
            <div style={{fontSize:'1.4rem',fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Users management */}
      <div className="page-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <h2 style={{margin:0,fontSize:'1rem',fontWeight:600,color:'var(--text)',display:'flex',alignItems:'center',gap:'0.5rem'}}><Users size={16}/>ניהול משתמשים</h2>
          <button className="btn-ghost" onClick={load} style={{fontSize:'0.8rem'}}><RefreshCw size={13}/>רענן</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
          {profiles.map(p => (
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.875rem',borderRadius:'0.875rem',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#fff',flexShrink:0}}>{p.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:'var(--text)'}}>{p.name}</div>
                <div style={{fontSize:'0.75rem',color:'var(--text-dim)'}}>{p.is_online ? '🟢 מחובר/ת' : '⚫ לא מחובר/ת'} · נוצר {new Date(p.created_at).toLocaleDateString('he-IL')}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                <span style={{padding:'0.25rem 0.625rem',borderRadius:'9999px',fontSize:'0.75rem',fontWeight:600,background:p.role==='admin'?'rgba(239,68,68,0.15)':'rgba(108,99,255,0.15)',color:p.role==='admin'?'#f87171':'#a78bfa',border:`1px solid ${p.role==='admin'?'rgba(239,68,68,0.3)':'rgba(108,99,255,0.3)'}`}}>
                  {p.role === 'admin' ? 'אדמין' : 'משתמש'}
                </span>
                <button onClick={()=>toggleRole(p)} className="btn-ghost" style={{fontSize:'0.75rem',padding:'0.25rem 0.625rem'}}>
                  {p.role==='admin'?'הורד לרגיל':'העלה לאדמין'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="page-card">
        <h2 style={{margin:'0 0 1rem',fontSize:'1rem',fontWeight:600,color:'var(--text)',display:'flex',alignItems:'center',gap:'0.5rem'}}><Activity size={16}/>פעילות אחרונה</h2>
        <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
          {logs.map(l=>(
            <div key={l.id} style={{display:'flex',alignItems:'center',gap:'0.875rem',padding:'0.625rem',borderRadius:'0.625rem',background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:'0.9rem'}}>⚡</span>
              <div style={{flex:1}}>
                <span style={{fontSize:'0.8rem',color:'var(--text)'}}>{l.description}</span>
                <span style={{fontSize:'0.75rem',color:'var(--text-dim)',marginRight:'0.5rem'}}> · {l.user_name}</span>
              </div>
              <span style={{fontSize:'0.7rem',color:'#334155',whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}</span>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      <div className="page-card">
        <h2 style={{margin:'0 0 1rem',fontSize:'1rem',fontWeight:600,color:'var(--text)',display:'flex',alignItems:'center',gap:'0.5rem'}}><Database size={16}/>מצב מערכת</h2>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          {[
            ['Database','Supabase PostgreSQL'],
            ['Auth','Supabase Auth (JWT)'],
            ['Realtime','מחובר'],
            ['Frontend','React + Vite + Tailwind'],
          ].map(([l,v])=>(
            <div key={l} style={{padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)'}}>
              <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>{l}</div>
              <div style={{fontSize:'0.85rem',color:'var(--text)',fontWeight:500}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
