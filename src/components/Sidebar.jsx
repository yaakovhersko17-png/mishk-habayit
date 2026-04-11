import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Home, ArrowLeftRight, BarChart2,
  Bell, Calendar, StickyNote, Map, Utensils,
  Shield, LogOut, X
} from 'lucide-react'

const navItems = [
  { to: '/finance',      icon: BarChart2,       label: 'סקירה פיננסית' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'עסקאות' },
  { to: '/dinners',      icon: Utensils,        label: 'ארוחות ערב' },
  { to: '/reminders',    icon: Bell,            label: 'תזכורות' },
  { to: '/calendar',     icon: Calendar,        label: 'לוח שנה' },
  { to: '/notes',        icon: StickyNote,      label: 'פתקים' },
  { to: '/trips',        icon: Map,             label: 'טיולים ויציאות' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '0.75rem', background: 'linear-gradient(135deg,#6c63ff,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏠</div>
          <div>
            <div style={{ fontWeight: 400, fontSize: '1.5rem', fontFamily: '"Pacifico", cursive', color: 'rgba(255,255,255,0.2)', lineHeight: 1.1 }}>Hersko</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>משק הבית</div>
          </div>
        </div>
        <button onClick={onClose} className="sidebar-close-btn" aria-label="סגור תפריט">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem', overflowY: 'auto' }}>
        {/* Home link */}
        <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Home size={16} />
          <span>בית</span>
        </NavLink>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.375rem 0' }} />

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}

        {profile?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
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
