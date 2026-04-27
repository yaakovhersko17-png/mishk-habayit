import { Menu } from 'lucide-react'
import NotificationBell from './NotificationBell'

export default function Header({ onMenuClick }) {
  return (
    <header style={{
      padding: '0.875rem 1.5rem',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(15,15,26,0.6)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <button
        onClick={onMenuClick}
        className="hamburger-btn"
        aria-label="פתח תפריט"
      >
        <Menu size={22} />
      </button>

      <NotificationBell />
    </header>
  )
}
