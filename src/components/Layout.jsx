import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import Breadcrumbs from './Breadcrumbs'
import FinanceTabBar from './FinanceTabBar'

const QUOTES = [
  'חוסכים יחד, חיים טוב יותר 💜',
  'כל שקל שנחסך — שקל שמשרת אתכם 🌱',
  'ביחד בונים עתיד פיננסי חזק ✨',
  'שקיפות בכסף = שלום בבית 🏠',
  'צעד קטן של חיסכון היום — חופש גדול מחר 🚀',
  'שניים שמנהלים יחד — מנצחים יחד 💰',
  'הכסף הוא כלי, האהבה היא המטרה ❤️',
  'מודעות פיננסית היא מתנה לזוגיות 🎁',
]

const FINANCE_PATHS = ['/finance', '/transactions', '/wallets', '/categories', '/goals']

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

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
            <footer style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.375rem', fontStyle: 'italic' }}>
                {quote}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#334155' }}>⚡ נבנה ע"י י.הרשקו ⚡</div>
            </footer>
          </div>
        </main>
      </div>

      {isFinance && <FinanceTabBar />}
    </div>
  )
}
