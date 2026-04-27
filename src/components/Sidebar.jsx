import { useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Home, BarChart2,
  Bell, Calendar, StickyNote, Map, Utensils,
  Shield, LogOut, X, Lock
} from 'lucide-react'

const navItems = [
  { to: '/finance',      icon: BarChart2,  label: 'סקירה פיננסית' },
  { to: '/dinners',      icon: Utensils,   label: 'ארוחות ערב' },
  { to: '/reminders',    icon: Bell,       label: 'תזכורות' },
  { to: '/calendar',     icon: Calendar,   label: 'לוח שנה' },
  { to: '/notes',        icon: StickyNote, label: 'פתקים' },
  { to: '/trips',        icon: Map,        label: 'טיולים ויציאות' },
]

function haptic(ms = 8) {
  try { navigator.vibrate?.(ms) } catch (_) {}
}

export default function Sidebar({ isOpen, onClose }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const touchStartX = useRef(null)

  async function handleSignOut() {
    haptic(12)
    await signOut()
    navigate('/login')
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    // RTL: swipe right (positive dx) = close
    if (dx > 60) { haptic(6); onClose() }
    touchStartX.current = null
  }

  return (
    <aside
      className={`sidebar${isOpen ? ' sidebar-open' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div style={{
        padding: '1.25rem 1rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '0.75rem',
            background: 'linear-gradient(135deg,#6c63ff,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', flexShrink: 0,
          }}>🏠</div>
          <div>
            <div className="bounce-top" style={{
              fontWeight: 400, fontSize: '1.5rem', fontFamily: '"Pacifico", cursive',
              color: 'rgba(255,255,255,0.2)', lineHeight: 1.1,
            }}>Hersko</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>משק הבית</div>
          </div>
        </div>
        <button onClick={() => { haptic(6); onClose() }} className="sidebar-close-btn" aria-label="סגור תפריט">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem', overflowY: 'auto' }}>
        <NavLink
          to="/" end
          style={{ '--nav-delay': '0s' }}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          onClick={() => haptic(6)}
        >
          <Home size={16} />
          <span>בית</span>
        </NavLink>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.375rem 0' }} />

        {navItems.map(({ to, icon: Icon, label }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={{ '--nav-delay': `${(i + 1) * 0.055}s` }}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={() => haptic(6)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.375rem 0' }} />

        <NavLink
          to="/private"
          style={{ '--nav-delay': `${(navItems.length + 1) * 0.055}s` }}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          onClick={() => haptic(6)}
        >
          <Lock size={16} />
          <span>מסך פרטי</span>
        </NavLink>

        {profile?.role === 'admin' && (
          <NavLink
            to="/admin"
            style={{ '--nav-delay': `${(navItems.length + 2) * 0.055}s` }}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={() => haptic(6)}
          >
            <Shield size={16} />
            <span>פאנל אדמין</span>
          </NavLink>
        )}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '0.75rem' }}>
        <button onClick={handleSignOut} className="btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
          <LogOut size={15} />
          <span>התנתק</span>
        </button>
      </div>
    </aside>
  )
}
