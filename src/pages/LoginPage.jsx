import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  function handleEnter() {
    if (user) {
      navigate('/', { replace: true })
    } else {
      setShowForm(true)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { toast.error('מלא אימייל וסיסמה'); return }
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch {
      toast.error('אימייל או סיסמה שגויים')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mesh-bg" style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', direction: 'rtl',
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>

        {/* Big red X */}
        <div
          onClick={handleEnter}
          style={{
            width: 130, height: 130,
            margin: '0 auto 2rem',
            cursor: 'pointer',
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(0 0 28px rgba(239,68,68,0.7)) drop-shadow(0 0 60px rgba(239,68,68,0.35))',
            transition: 'transform 0.15s, filter 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="130" height="130" viewBox="0 0 130 130" fill="none">
            {/* Outer glow circle */}
            <circle cx="65" cy="65" r="60" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.25)" strokeWidth="1.5"/>
            {/* X lines */}
            <line x1="32" y1="32" x2="98" y2="98" stroke="#ef4444" strokeWidth="14" strokeLinecap="round"/>
            <line x1="98" y1="32" x2="32" y2="98" stroke="#ef4444" strokeWidth="14" strokeLinecap="round"/>
            {/* Inner bright X */}
            <line x1="32" y1="32" x2="98" y2="98" stroke="#fca5a5" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
            <line x1="98" y1="32" x2="32" y2="98" stroke="#fca5a5" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 0.3rem', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>
          משק הבית
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 2.5rem' }}>
          ניהול פיננסי משותף
        </p>

        {/* Enter button */}
        {!showForm && (
          <button
            onClick={handleEnter}
            className="btn-primary"
            style={{
              width: '100%', justifyContent: 'center',
              padding: '0.9rem', fontSize: '1.05rem',
              fontWeight: 700, letterSpacing: '0.04em',
              borderRadius: '1rem',
            }}
          >
            כניסה
          </button>
        )}

        {/* Hidden auth form — only shown when no active session */}
        {showForm && (
          <form onSubmit={handleLogin} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1.25rem', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              החיבור פג תוקף — יש להתחבר מחדש
            </p>
            <input
              type="email" className="input-field"
              placeholder="אימייל"
              value={email} onChange={e => setEmail(e.target.value)}
              dir="ltr" style={{ textAlign: 'left' }}
            />
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="input-field" placeholder="סיסמה"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
              {loading ? 'נכנס...' : 'כניסה'}
            </button>
          </form>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.7rem', marginTop: '2rem' }}>
          ⚡ נבנה ע"י י.הרשקו ⚡
        </p>
      </div>
    </div>
  )
}
