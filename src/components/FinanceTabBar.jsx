import { NavLink } from 'react-router-dom'
import { BarChart2, ArrowLeftRight, Wallet, Tag, Target } from 'lucide-react'

const TABS = [
  { to: '/finance',      icon: BarChart2,      label: 'סקירה'    },
  { to: '/transactions', icon: ArrowLeftRight, label: 'עסקאות'   },
  { to: '/wallets',      icon: Wallet,         label: 'ארנקים'   },
  { to: '/categories',   icon: Tag,            label: 'קטגוריות' },
  { to: '/goals',        icon: Target,         label: 'יעדים'    },
]

export default function FinanceTabBar() {
  return (
    <nav className="finance-tab-bar">
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) => `ftab${isActive ? ' ftab--active' : ''}`}
        >
          <span className="ftab-bubble" aria-hidden="true" />
          <Icon size={20} />
          <span className="ftab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
