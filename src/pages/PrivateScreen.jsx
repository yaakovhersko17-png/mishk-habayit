import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const isYaakov = (name) => name?.includes('יעקב') || name?.toLowerCase().includes('yaakov')

export default function PrivateScreen() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
        מסך פרטי — {profile?.name || ''}
      </h1>

      {isYaakov(profile?.name) && (
        <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div onClick={() => navigate('/grass')} style={{
            display: 'flex', alignItems: 'center', gap: '0.875rem',
            padding: '0.875rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 38, height: 38, borderRadius: '0.75rem', background: 'rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🌿</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>גראס</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>ניהול, דירוג ומעקב</div>
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>›</span>
          </div>
        </div>
      )}
    </div>
  )
}
