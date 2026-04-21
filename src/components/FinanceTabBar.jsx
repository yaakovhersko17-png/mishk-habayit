import { NavLink } from 'react-router-dom'
import { BarChart2, ArrowLeftRight, Wallet, Tag, Target } from 'lucide-react'

const TABS = [
  { to: '/goals',        icon: Target,         label: 'יעדים'    },
  { to: '/categories',   icon: Tag,            label: 'קטגוריות' },
  { to: '/wallets',      icon: Wallet,         label: 'ארנקים'   },
  { to: '/transactions', icon: ArrowLeftRight, label: 'עסקאות'   },
  { to: '/finance',      icon: BarChart2,      label: 'סקירה'    },
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
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
