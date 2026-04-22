import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const ROUTES = {
  '/':           { label: 'בית',              parent: null },
  '/finance':    { label: 'סקירה פיננסית',    parent: '/' },
  '/wallets':    { label: 'ארנקים',           parent: '/finance' },
  '/transactions':{ label: 'עסקאות',          parent: '/finance' },
  '/categories': { label: 'קטגוריות',         parent: '/finance' },
  '/scanner':    { label: 'סריקת חשבונית',    parent: '/finance' },
  '/invoices':   { label: 'ארכיון חשבוניות',  parent: '/finance' },
  '/insights':   { label: 'דף חכם',           parent: '/finance' },
  '/reports':    { label: 'דוחות',            parent: '/finance' },
  '/goals':      { label: 'יעדי חיסכון',      parent: '/finance' },
  '/recurring':  { label: 'עסקאות חוזרות',    parent: '/finance' },
  '/history':    { label: 'היסטוריה',         parent: '/' },
  '/reminders':  { label: 'תזכורות',          parent: '/' },
  '/calendar':   { label: 'לוח שנה',          parent: '/' },
  '/notes':      { label: 'פתקים',            parent: '/' },
  '/trips':      { label: 'טיולים ויציאות',   parent: '/' },
  '/dinners':    { label: 'ארוחות ערב',        parent: '/' },
  '/settings':   { label: 'הגדרות',           parent: '/' },
  '/admin':      { label: 'פאנל אדמין',        parent: '/' },
}

function buildTrail(path) {
  const trail = []
  let current = path
  while (current) {
    const cfg = ROUTES[current]
    if (!cfg) break
    trail.unshift({ path: current, label: cfg.label })
    current = cfg.parent
  }
  return trail
}

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const trail = buildTrail(pathname)

  // Don't show on home or unknown routes, or single-item trail
  if (trail.length <= 1) return null

  return (
    <nav aria-label="breadcrumb" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.125rem',
      flexWrap: 'wrap',
      marginBottom: '0.25rem',
      minHeight: '1.5rem',
    }}>
      {trail.map((item, i) => {
        const isLast = i === trail.length - 1
        return (
          <span key={item.path} style={{ display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
            {isLast ? (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--c-primary)',
              }}>
                {item.label}
              </span>
            ) : (
              <Link to={item.path} style={{
                fontSize: '0.8rem',
                fontWeight: 400,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-sub)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                {item.label}
              </Link>
            )}
            {!isLast && (
              <ChevronLeft size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />
            )}
          </span>
        )
      })}
    </nav>
  )
}
