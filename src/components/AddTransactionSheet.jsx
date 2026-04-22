import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase, cached, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Check, X, Star } from 'lucide-react'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

function buildCatOptions(cats) {
  const children = cats.filter(c => c.parent_id)
  const parents  = cats.filter(c => !c.parent_id)
  return (
    <>
      {children.length > 0 && (
        <optgroup label="תת-קטגוריות">
          {children.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </optgroup>
      )}
      {parents.length > 0 && (
        <optgroup label="קטגוריות">
          {parents.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </optgroup>
      )}
    </>
  )
}

const mkForm = () => ({
  description: '', amount: '', currency: '₪',
  wallet_id: '', to_wallet_id: '', category_id: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
})

// Returns wallet balance sign for a given db type
const balanceSign = (t) => {
  if (t === 'income' || t === 'loan_received') return 1
  if (t === 'expense' || t === 'loan_given') return -1
  return 0 // debt_unpaid, transfer, unknown
}

export default function AddTransactionSheet({ open, onClose, onSaved, editingTx, initialData }) {
  const { user, profile } = useAuth()
  const [type, setType]                   = useState('expense')
  const [loanSubType, setLoanSubType]     = useState('given') // 'given' | 'received' | 'unpaid'
  const [form, setForm]                   = useState(mkForm)
  const [notes, setNotes]                 = useState('')
  const [wallets, setWallets]             = useState([])
  const [categories, setCats]             = useState([])
  const [profiles, setProfiles]           = useState([])
  const [saving, setSaving]               = useState(false)

  useEffect(() => {
    if (!open) return
    loadData()
    if (editingTx) {
      const t = editingTx.type
      if (t === 'loan_given' || t === 'loan_received' || t === 'debt_unpaid') {
        setType('loan')
        setLoanSubType(t === 'loan_given' ? 'given' : t === 'loan_received' ? 'received' : 'unpaid')
      } else {
        setType(t || 'expense')
        setLoanSubType('given')
      }
      setForm({
        description:  editingTx.description || '',
        amount:       String(editingTx.amount || ''),
        currency:     editingTx.currency || '₪',
        wallet_id:    editingTx.wallet_id || '',
        to_wallet_id: editingTx.to_wallet_id || '',
        category_id:  editingTx.category_id || '',
        date:         editingTx.date || new Date().toISOString().split('T')[0],
        time:         new Date().toTimeString().slice(0, 5),
      })
      setNotes('')
    } else if (initialData) {
      const t = initialData.type || 'expense'
      if (t === 'loan_given' || t === 'loan_received' || t === 'debt_unpaid') {
        setType('loan')
        setLoanSubType(t === 'loan_given' ? 'given' : t === 'loan_received' ? 'received' : 'unpaid')
      } else {
        setType(t)
        setLoanSubType('given')
      }
      setForm({ ...mkForm(), ...initialData })
      setNotes('')
    } else {
      setType('expense'); setLoanSubType('given')
      setForm(mkForm()); setNotes('')
    }
  }, [open])

  async function loadData() {
    const [{ data: w }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('wallets').select('*').order('created_at'),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
      cached('profiles', () => supabase.from('profiles').select('*'), 120_000),
    ])
    setWallets(w || [])
    setCats(c || [])
    setProfiles(p || [])
  }

  async function applyTransfer(srcId, dstId, amount, reverse = false) {
    const sign = reverse ? 1 : -1
    for (const [id, s] of [[srcId, sign], [dstId, -sign]]) {
      if (!id) continue
      const { data: w } = await supabase.from('wallets').select('balance').eq('id', id).single()
      if (w) await supabase.from('wallets').update({ balance: w.balance + s * Number(amount) }).eq('id', id)
    }
  }

  async function handleSave() {
    if (!form.description || !form.amount) { toast.error('מלא תיאור וסכום'); return }
    if (type === 'transfer' && !form.to_wallet_id)              { toast.error('בחר ארנק יעד'); return }
    if (type === 'transfer' && form.wallet_id === form.to_wallet_id) { toast.error('ארנקים חייבים להיות שונים'); return }
    setSaving(true)

    const isUnpaid = type === 'loan' && loanSubType === 'unpaid'
    const dbType = type === 'loan'
      ? (loanSubType === 'given' ? 'loan_given' : loanSubType === 'received' ? 'loan_received' : 'debt_unpaid')
      : type

    const payload = {
      type: dbType, description: form.description,
      amount: Number(form.amount), currency: form.currency || '₪',
      wallet_id: isUnpaid ? null : (form.wallet_id || null),
      to_wallet_id: type === 'transfer' ? (form.to_wallet_id || null) : null,
      category_id: form.category_id || null,
      date: form.date, user_id: user.id,
    }

    if (editingTx) {
      const { error } = await supabase.from('transactions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingTx.id)
      if (error) { toast.error(error.message || 'שגיאה'); setSaving(false); return }

      const wasTransfer = editingTx.type === 'transfer'
      const nowTransfer = type === 'transfer'

      if (wasTransfer) {
        await applyTransfer(editingTx.wallet_id, editingTx.to_wallet_id, editingTx.amount, true)
        if (nowTransfer) {
          await applyTransfer(form.wallet_id, form.to_wallet_id, form.amount)
        } else if (payload.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', payload.wallet_id).single()
          if (w) await supabase.from('wallets').update({ balance: w.balance + balanceSign(dbType) * Number(form.amount) }).eq('id', payload.wallet_id)
        }
      } else if (nowTransfer) {
        if (editingTx.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', editingTx.wallet_id).single()
          if (w) await supabase.from('wallets').update({ balance: w.balance - balanceSign(editingTx.type) * Number(editingTx.amount) }).eq('id', editingTx.wallet_id)
        }
        await applyTransfer(form.wallet_id, form.to_wallet_id, form.amount)
      } else {
        // normal → normal (includes loan types)
        if (editingTx.wallet_id === payload.wallet_id && payload.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', payload.wallet_id).single()
          if (w) {
            const rev   = -balanceSign(editingTx.type) * Number(editingTx.amount)
            const delta = balanceSign(dbType) * Number(form.amount)
            await supabase.from('wallets').update({ balance: w.balance + rev + delta }).eq('id', payload.wallet_id)
          }
        } else {
          if (editingTx.wallet_id) {
            const { data: w } = await supabase.from('wallets').select('balance').eq('id', editingTx.wallet_id).single()
            if (w) await supabase.from('wallets').update({ balance: w.balance - balanceSign(editingTx.type) * Number(editingTx.amount) }).eq('id', editingTx.wallet_id)
          }
          if (payload.wallet_id) {
            const { data: w } = await supabase.from('wallets').select('balance').eq('id', payload.wallet_id).single()
            if (w) await supabase.from('wallets').update({ balance: w.balance + balanceSign(dbType) * Number(form.amount) }).eq('id', payload.wallet_id)
          }
        }
      }
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.UPDATE, entityType: ENTITY_TYPES.TRANSACTION, description: `עדכן/ה: ${form.description}`, entityId: editingTx.id })
      toast.success('עודכן!')
    } else {
      const { error } = await withRetry(() => supabase.from('transactions').insert(payload))
      if (error) { toast.error(error.message || 'שגיאה'); setSaving(false); return }
      if (type === 'transfer') {
        await applyTransfer(form.wallet_id, form.to_wallet_id, form.amount)
      } else if (payload.wallet_id) {
        const { data: w } = await supabase.from('wallets').select('balance').eq('id', payload.wallet_id).single()
        if (w) await supabase.from('wallets').update({ balance: w.balance + balanceSign(dbType) * Number(form.amount) }).eq('id', payload.wallet_id)
      }
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.CREATE, entityType: ENTITY_TYPES.TRANSACTION, description: `הוסיף/ה: ${form.description} – ${form.amount}₪` })
      toast.success('העסקה נשמרה!')
    }
    setSaving(false); onClose(); onSaved?.()
  }

  const selW = wallets.find(w => w.id === form.wallet_id)
  const showWallet = !(type === 'loan' && loanSubType === 'unpaid')
  const activeColor = type === 'income' ? '#4ade80' : type === 'transfer' ? '#22d3ee' : type === 'loan' ? '#fbbf24' : '#f87171'
  const sep = () => <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'0 1rem'}}/>

  if (!open) return null

  return createPortal(
    <div style={{position:'fixed',inset:0,zIndex:200,background:'#0d0d1f',display:'flex',flexDirection:'column',direction:'rtl'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(0.75rem + env(safe-area-inset-top,0px)) 1rem 0.75rem',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.02)',flexShrink:0}}>
        <button onClick={handleSave} disabled={saving} style={{width:38,height:38,borderRadius:'50%',background:'rgba(108,99,255,0.15)',border:'1px solid rgba(108,99,255,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#a78bfa'}}>
          {saving ? <span style={{color:'#a78bfa',fontSize:'0.7rem'}}>...</span> : <Check size={18}/>}
        </button>
        <span style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>{editingTx ? 'ערוך עסקה' : 'עסקה'}</span>
        <button onClick={onClose} style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)'}}>
          <X size={18}/>
        </button>
      </div>

      {/* ── Type tabs ── */}
      <div style={{display:'flex',gap:'0.5rem',padding:'0.625rem 1rem',background:'rgba(255,255,255,0.02)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        {[['expense','הוצאה','#f87171'],['income','הכנסה','#4ade80'],['transfer','העברה','#22d3ee'],['loan','חוב','#fbbf24']].map(([t,lbl,col]) => (
          <button key={t} onClick={() => setType(t)} style={{
            flex:1,padding:'0.5rem',borderRadius:'0.75rem',fontSize:'0.82rem',cursor:'pointer',
            border:`1px solid ${type===t?col+'60':'rgba(255,255,255,0.07)'}`,
            background:type===t?col+'18':'transparent',
            color:type===t?col:'var(--text-muted)',fontWeight:type===t?700:400,transition:'all 0.15s',
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── Loan sub-type selector ── */}
      {type === 'loan' && (
        <div style={{display:'flex',gap:'0.5rem',padding:'0.5rem 1rem',background:'rgba(251,191,36,0.04)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
          {[['given','הלוואה שנתתי'],['received','הלוואה שלקחתי'],['unpaid','חוב שלא שולם']].map(([sub,lbl]) => (
            <button key={sub} onClick={() => setLoanSubType(sub)} style={{
              flex:1,padding:'0.4rem 0.25rem',borderRadius:'0.625rem',fontSize:'0.75rem',cursor:'pointer',
              border:`1px solid ${loanSubType===sub?'rgba(251,191,36,0.5)':'rgba(255,255,255,0.07)'}`,
              background:loanSubType===sub?'rgba(251,191,36,0.12)':'transparent',
              color:loanSubType===sub?'#fbbf24':'var(--text-muted)',fontWeight:loanSubType===sub?600:400,transition:'all 0.15s',
            }}>{lbl}</button>
          ))}
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div style={{flex:1,overflowY:'auto',padding:'0.875rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>

        {/* Description */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'0.75rem',padding:'0 1rem',minHeight:58}}>
          <Star size={17} color="#334155" style={{flexShrink:0}}/>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="תיאור"
            style={{flex:1,background:'none',border:'none',outline:'none',color:'var(--text)',fontSize:'0.95rem',fontFamily:'inherit',textAlign:'right',direction:'rtl'}}/>
          {form.description && <Check size={16} color="#4ade80" style={{flexShrink:0}}/>}
        </div>

        {/* Primary details card */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>

          {/* Wallet (hidden for debt_unpaid) */}
          {showWallet && (<>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
              <span style={{color:'var(--text-sub)',fontSize:'0.875rem',flexShrink:0}}>{type==='transfer'?'מארנק':'חשבון לחיוב'}</span>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                {selW && (
                  <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(239,68,68,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.85rem',fontWeight:700,color:'#f87171',flexShrink:0}}>
                    {selW.icon || selW.name[0]}
                  </div>
                )}
                <select value={form.wallet_id} onChange={e=>setForm(f=>({...f,wallet_id:e.target.value}))}
                  style={{background:'none',border:'none',outline:'none',color:form.wallet_id?'var(--text)':'var(--text-dim)',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:160}}>
                  <option value="">בחר חשבון</option>
                  {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                </select>
              </div>
            </div>
            {sep()}
          </>)}

          {type === 'transfer' && (<>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
              <span style={{color:'#22d3ee',fontSize:'0.875rem',flexShrink:0}}>לארנק</span>
              <select value={form.to_wallet_id} onChange={e=>setForm(f=>({...f,to_wallet_id:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:form.to_wallet_id?'var(--text)':'var(--text-dim)',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:160}}>
                <option value="">בחר ארנק יעד</option>
                {wallets.filter(w=>w.id!==form.wallet_id).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
            {sep()}
          </>)}

          {/* Amount */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
            <span style={{color:'var(--text-sub)',fontSize:'0.875rem',flexShrink:0}}>סכום</span>
            <div style={{display:'flex',alignItems:'center',gap:'0.375rem',direction:'ltr'}}>
              <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"
                style={{background:'none',border:'none',outline:'none',color:form.amount?'var(--text)':'var(--text-dim)',fontSize:'1.1rem',fontWeight:700,width:100,textAlign:'right',fontFamily:'inherit'}} dir="ltr"/>
              <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:'var(--text-muted)',fontSize:'0.875rem',fontFamily:'inherit'}}>
                <option>₪</option><option>$</option><option>€</option>
              </select>
            </div>
          </div>

          {sep()}
          {/* Date + Time */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52,gap:'0.5rem'}}>
            <span style={{color:'var(--text-sub)',fontSize:'0.875rem',flexShrink:0}}>תאריך</span>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.25rem 0.5rem',color:'var(--text)',fontSize:'0.82rem',outline:'none',fontFamily:'inherit'}} dir="ltr"/>
              <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}
                style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.25rem 0.5rem',color:'var(--text)',fontSize:'0.82rem',outline:'none',fontFamily:'inherit'}} dir="ltr"/>
            </div>
          </div>
        </div>

        {/* Secondary details */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>
          {type !== 'transfer' && (<>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
              <span style={{color:'var(--text-sub)',fontSize:'0.875rem',flexShrink:0}}>קטגוריה</span>
              <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:form.category_id?'var(--text)':'var(--text-dim)',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:200}}>
                <option value="">ללא קטגוריה</option>
                {buildCatOptions(categories)}
              </select>
            </div>
            {sep()}
          </>)}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
            <span style={{color:'var(--text-sub)',fontSize:'0.875rem',flexShrink:0}}>בן משפחה</span>
            <select value={form.assigned_to||''} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}
              style={{background:'none',border:'none',outline:'none',color:form.assigned_to?'var(--text)':'var(--text-dim)',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:180}}>
              <option value="">לא נבחר</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="הערה" rows={2}
            style={{width:'100%',background:'none',border:'none',outline:'none',color:notes?'var(--text)':'var(--text-dim)',fontSize:'0.875rem',fontFamily:'inherit',padding:'0.875rem 1rem',resize:'none',direction:'rtl',textAlign:'right',boxSizing:'border-box'}}/>
        </div>
      </div>
    </div>,
    document.body
  )
}
