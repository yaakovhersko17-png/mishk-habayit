import { Menu } from 'lucide-react'
import PresenceIndicator from './PresenceIndicator'

export default function Header({ onMenuClick }) {
  return (
    <header style={{
      padding: '0.875rem 1.5rem',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(15,15,26,0.8)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      {/* Hamburger — visible only on mobile */}
      <button
        onClick={onMenuClick}
        className="hamburger-btn"
        aria-label="פתח תפריט"
      >
        <Menu size={22} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <PresenceIndicator />
      </div>
    </header>
  )
}
