import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function WidgetPage() {
  const [loading, setLoading]   = useState(true)
  const [balance, setBalance]   = useState(0)
  const [income, setIncome]     = useState(0)
  const [expense, setExpense]   = useState(0)
  const [error, setError]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: wallets }, { data: txs }] = await Promise.all([
      supabase.from('wallets').select('balance'),
      supabase.from('transactions').select('type,amount')
        .gte('date', currentMonth() + '-01'),
    ])
    if (!wallets) { setError('לא מחובר'); setLoading(false); return }
    setBalance(wallets.reduce((s, w) => s + Number(w.balance), 0))
    const inc = (txs || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const exp = (txs || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    setIncome(inc); setExpense(exp)
    setLoading(false)
  }

  const openApp = () => window.location.href = '/mishk-habayit/'

  if (error) return (
    <div style={wrapStyle}>
      <div style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
        {error}<br />
        <button onClick={openApp} style={btnStyle}>כניסה לאפליקציה</button>
      </div>
    </div>
  )

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em' }}>מִשְׁק הַבַּיִת</span>
        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
          {new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255,255,255,0.3)' }}>...</div>
      ) : (
        <>
          {/* Main balance */}
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem' }}>יתרה כוללת</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
              ₪{balance.toLocaleString()}
            </div>
          </div>

          {/* Income / Expense row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ background: 'rgba(74,222,128,0.1)', borderRadius: '0.625rem', padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: '#4ade80', marginBottom: '0.15rem' }}>הכנסות</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4ade80' }}>+₪{income.toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(248,113,113,0.1)', borderRadius: '0.625rem', padding: '0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: '#f87171', marginBottom: '0.15rem' }}>הוצאות</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171' }}>-₪{expense.toLocaleString()}</div>
            </div>
          </div>

          {/* Mini bar */}
          {(income + expense) > 0 && (
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '0.875rem' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (income / (income + expense)) * 100)}%`, background: 'linear-gradient(90deg, #4ade80, #6c63ff)', borderRadius: 2 }} />
            </div>
          )}

          {/* Quick action */}
          <button onClick={openApp} style={btnStyle}>
            ➕ הוסף עסקה
          </button>
        </>
      )}
    </div>
  )
}

const wrapStyle = {
  minHeight: '100vh', background: '#0f0f1a',
  display: 'flex', flexDirection: 'column', justifyContent: 'center',
  padding: '1.25rem', maxWidth: 340, margin: '0 auto',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const btnStyle = {
  width: '100%', padding: '0.625rem', borderRadius: '0.75rem',
  background: 'linear-gradient(135deg, #6c63ff, #4ade80)',
  border: 'none', cursor: 'pointer', color: '#fff',
  fontWeight: 700, fontSize: '0.85rem',
}
