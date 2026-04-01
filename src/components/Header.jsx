import { Bell } from 'lucide-react'
import PresenceIndicator from './PresenceIndicator'

export default function Header() {
  return (
    <header style={{
      padding:'0.875rem 1.5rem',
      borderBottom:'1px solid rgba(255,255,255,0.06)',
      background:'rgba(15,15,26,0.8)',
      backdropFilter:'blur(12px)',
      display:'flex',
      alignItems:'center',
      justifyContent:'space-between',
      position:'sticky',top:0,zIndex:20,
    }}>
      <div />
      <div style={{display:'flex',alignItems:'center',gap:'1.5rem'}}>
        <PresenceIndicator />
        <button style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'0.375rem',borderRadius:'0.5rem',display:'flex'}}>
          <Bell size={18} />
        </button>
      </div>
    </header>
  )
}
