import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function PresenceIndicator() {
  const { user, profile } = useAuth()
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (!user) return
    fetchOnlineUsers()

    const channel = supabase
      .channel('presence-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchOnlineUsers)
      .subscribe()

    // heartbeat – keep current user marked online + refresh others status
    const hb = setInterval(async () => {
      await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id)
      fetchOnlineUsers()
    }, 30000)

    // mark offline on tab close
    const handleUnload = () => supabase.from('profiles').update({ is_online: false }).eq('id', user.id)
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(hb)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [user])

  async function fetchOnlineUsers() {
    if (!user) return
    // Consider online only if last_seen within 60 seconds (2 missed heartbeats = offline)
    const cutoff = new Date(Date.now() - 60000).toISOString()
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id).gte('last_seen', cutoff)
    setOthers(data || [])
  }

  if (!profile) return null

  return (
    <div style={{display:'flex',alignItems:'center',gap:'1rem',fontSize:'0.75rem'}}>
      {/* current user */}
      <div style={{display:'flex',alignItems:'center',gap:'0.375rem'}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}} />
        <span style={{color:'var(--text)',fontWeight:500}}>{profile.name}</span>
        <span style={{color:'var(--text-muted)'}}>מחובר/ת</span>
      </div>
      {/* others online */}
      {others.map(o => (
        <div key={o.id} style={{display:'flex',alignItems:'center',gap:'0.375rem'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}} />
          <span style={{color:'var(--text-sub)'}}>{o.name}</span>
          <span style={{color:'var(--text-dim)'}}>מחובר/ת</span>
        </div>
      ))}
    </div>
  )
}
