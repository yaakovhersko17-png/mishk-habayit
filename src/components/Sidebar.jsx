import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Wallet, ArrowLeftRight, ScanLine, Archive,
  Tag, Bell, Calendar, StickyNote, Map, Utensils,
  Shield, LogOut, X
} from 'lucide-react'

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'סקירה כללית' },
  { to: '/wallets',      icon: Wallet,          label: 'ארנקים' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'טרנזקציות' },
  { to: '/scanner',      icon: ScanLine,        label: 'סריקת חשבונית' },
  { to: '/invoices',     icon: Archive,         label: 'ארכיון חשבוניות' },
  { to: '/categories',   icon: Tag,             label: 'קטגוריות' },
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
      {/* Header: logo + close button on mobile */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '0.75rem', background: 'linear-gradient(135deg,#6c63ff,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0' }}>משק הבית</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ניהול פיננסי</div>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button onClick={onClose} className="sidebar-close-btn" aria-label="סגור תפריט">
          <X size={20} />
        </button>
      </div>

      {/* User badge */}
      {profile && (
        <div style={{ padding: '0.75rem 1rem', margin: '0.75rem', borderRadius: '0.75rem', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {profile.name[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{profile.role === 'admin' ? 'אדמין' : 'משתמש'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem', overflowY: 'auto' }}>
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
