import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Save, RefreshCw } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

export default function Settings() {
  const { profile } = useAuth()
  const [rates, setRates]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('exchange_rates').select('*').order('currency')
    setRates(data || [])
    setLoading(false)
  }

  async function saveRates() {
    setSaving(true)
    for (const r of rates) {
      await supabase.from('exchange_rates').update({ rate_to_ils: Number(r.rate_to_ils), updated_at: new Date().toISOString() }).eq('id', r.id)
    }
    toast.success('שערי מטבע עודכנו!')
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem',maxWidth:600}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>הגדרות</h1>

      {/* System info */}
      <div className="page-card">
        <h2 style={{margin:'0 0 1rem',fontSize:'1rem',fontWeight:600,color:'#e2e8f0'}}>מידע מערכת</h2>
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          {[
            ['משתמש מחובר', profile?.name],
            ['תפקיד', profile?.role === 'admin' ? 'אדמין' : 'משתמש'],
            ['מטבע בסיס', '₪ שקל'],
            ['גיבוי', 'Supabase Cloud – אוטומטי'],
          ].map(([label, value]) => (
            <div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:'0.85rem',color:'#64748b'}}>{label}</span>
              <span style={{fontSize:'0.85rem',color:'#e2e8f0',fontWeight:500}}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange rates */}
      <div className="page-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <h2 style={{margin:0,fontSize:'1rem',fontWeight:600,color:'#e2e8f0'}}>שערי מטבע (ל-₪)</h2>
          <button className="btn-ghost" onClick={load} style={{fontSize:'0.8rem'}}><RefreshCw size={13}/>רענן</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
          {rates.map((r, i) => (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:'1rem',padding:'0.875rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <span style={{fontSize:'1.25rem',minWidth:32,textAlign:'center'}}>{r.currency === '$' ? '🇺🇸' : r.currency === '€' ? '🇪🇺' : '🇬🇧'}</span>
              <span style={{flex:1,fontWeight:600,color:'#e2e8f0'}}>{r.currency}</span>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <span style={{color:'#64748b',fontSize:'0.85rem'}}>1 {r.currency} =</span>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  style={{width:90,textAlign:'center'}}
                  value={r.rate_to_ils}
                  onChange={e => setRates(prev => prev.map((x, j) => j===i ? {...x, rate_to_ils: e.target.value} : x))}
                  dir="ltr"
                />
                <span style={{color:'#64748b',fontSize:'0.85rem'}}>₪</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={saveRates} disabled={saving} style={{marginTop:'1rem',width:'100%',justifyContent:'center'}}>
          <Save size={14}/>{saving ? 'שומר...' : 'שמור שערים'}
        </button>
        <p style={{marginTop:'0.5rem',fontSize:'0.75rem',color:'#475569',textAlign:'center'}}>
          עדכון אחרון: {rates[0] ? new Date(rates[0].updated_at).toLocaleString('he-IL') : '—'}
        </p>
      </div>

      {/* Users */}
      <div className="page-card">
        <h2 style={{margin:'0 0 1rem',fontSize:'1rem',fontWeight:600,color:'#e2e8f0'}}>משתמשים</h2>
        <div style={{padding:'0.875rem',borderRadius:'0.75rem',background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.15)'}}>
          <p style={{margin:0,fontSize:'0.85rem',color:'#94a3b8',textAlign:'center'}}>
            המשתמשים הקבועים במערכת הם <strong style={{color:'#a78bfa'}}>יעקב</strong> ו-<strong style={{color:'#a78bfa'}}>יעל</strong>.<br/>
            ניהול משתמשים זמין בפאנל האדמין.
          </p>
        </div>
      </div>
    </div>
  )
}
