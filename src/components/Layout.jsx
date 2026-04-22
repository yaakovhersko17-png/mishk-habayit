import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import Breadcrumbs from './Breadcrumbs'
import FinanceTabBar from './FinanceTabBar'

const FINANCE_PATHS = ['/finance', '/transactions', '/wallets', '/categories', '/goals']

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const isFinance = FINANCE_PATHS.includes(location.pathname)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <div className="mesh-bg" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 40,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header onMenuClick={() => setSidebarOpen(v => !v)} />
        <main
          style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}
          className={`main-content${isFinance ? ' main-content--finance' : ''}`}
        >
          <div key={location.pathname} className="page-enter">
            <Breadcrumbs />
            <Outlet />
            <footer style={{ textAlign: 'center', color: '#334155', fontSize: '0.75rem', marginTop: '3rem', paddingBottom: '1rem' }}>
              ⚡ נבנה ע"י י.הרשקו ⚡
            </footer>
          </div>
        </main>
      </div>

      {isFinance && <FinanceTabBar />}
    </div>
  )
}
