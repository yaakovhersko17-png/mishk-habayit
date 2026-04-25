import { useAuth } from '../context/AuthContext'

const isYaakov = (name) => name?.includes('יעקב') || name?.toLowerCase().includes('yaakov')

export default function PrivateScreen() {
  const { profile } = useAuth()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
        מסך פרטי — {profile?.name || ''}
      </h1>

      {isYaakov(profile?.name) && (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>גראס</p>
      )}
    </div>
  )
}
