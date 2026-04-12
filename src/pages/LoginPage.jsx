import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const { signIn }  = useAuth()
  const navigate    = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { toast.error('מלא אימייל וסיסמה'); return }
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      toast.error('אימייל או סיסמה שגויים')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mesh-bg" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}}>
      <div style={{width:'100%',maxWidth:420}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{width:64,height:64,borderRadius:'1.25rem',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',margin:'0 auto 1rem'}}>🏠</div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>משק הבית</h1>
          <p style={{color:'var(--text-muted)',fontSize:'0.875rem',marginTop:'0.25rem'}}>ניהול פיננסי משותף</p>
        </div>

        {/* Card */}
        <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'1.25rem',padding:'2rem'}}>
          <h2 style={{margin:'0 0 1.5rem',fontSize:'1.1rem',fontWeight:600,color:'var(--text)',textAlign:'center'}}>כניסה למערכת</h2>

          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div>
              <label style={{display:'block',fontSize:'0.8rem',color:'var(--text-sub)',marginBottom:'0.375rem'}}>אימייל</label>
              <input
                type="email"
                className="input-field"
                placeholder="yaakov@mishk.local"
                value={email}
                onChange={e => setEmail(e.target.value)}
                dir="ltr"
                style={{textAlign:'left'}}
              />
            </div>

            <div>
              <label style={{display:'block',fontSize:'0.8rem',color:'var(--text-sub)',marginBottom:'0.375rem'}}>סיסמה</label>
              <div style={{position:'relative'}}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{paddingLeft:'2.5rem'}}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{position:'absolute',left:'0.75rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex'}}
                >
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{width:'100%',justifyContent:'center',marginTop:'0.5rem',padding:'0.75rem'}}>
              {loading ? 'נכנס...' : <><LogIn size={16}/>התחבר</>}
            </button>
          </form>

          <div style={{marginTop:'1.5rem',padding:'1rem',background:'rgba(108,99,255,0.08)',borderRadius:'0.75rem',border:'1px solid rgba(108,99,255,0.15)'}}>
            <p style={{margin:0,fontSize:'0.75rem',color:'var(--text-muted)',textAlign:'center'}}>
              המשתמשים במערכת: <strong style={{color:'#a78bfa'}}>יעקב</strong> ו-<strong style={{color:'#a78bfa'}}>יעל</strong>
            </p>
          </div>
        </div>

        <p style={{textAlign:'center',color:'#334155',fontSize:'0.7rem',marginTop:'1.5rem'}}>⚡ נבנה ע"י י.הרשקו ⚡</p>
      </div>
    </div>
  )
}
