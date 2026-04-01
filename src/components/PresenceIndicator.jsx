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

    // heartbeat – keep current user marked online
    const hb = setInterval(async () => {
      await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id)
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
    const { data } = await supabase.from('profiles').select('*').eq('is_online', true).neq('id', user.id)
    setOthers(data || [])
  }

  if (!profile) return null

  return (
    <div style={{display:'flex',alignItems:'center',gap:'1rem',fontSize:'0.75rem'}}>
      {/* current user */}
      <div style={{display:'flex',alignItems:'center',gap:'0.375rem'}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}} />
        <span style={{color:'#e2e8f0',fontWeight:500}}>{profile.name}</span>
        <span style={{color:'#64748b'}}>מחובר/ת</span>
      </div>
      {/* others online */}
      {others.map(o => (
        <div key={o.id} style={{display:'flex',alignItems:'center',gap:'0.375rem'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}} />
          <span style={{color:'#94a3b8'}}>{o.name}</span>
          <span style={{color:'#475569'}}>מחובר/ת</span>
        </div>
      ))}
    </div>
  )
}
