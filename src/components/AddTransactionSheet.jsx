import { useState, useEffect } from 'react'
import { supabase, cached, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Check, X, Star, ChevronLeft, FileText, Lock, Settings } from 'lucide-react'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

function buildCatOptions(cats) {
  const parents = cats.filter(c => !c.parent_id)
  const byParent = {}
  cats.filter(c => c.parent_id).forEach(c => {
    if (!byParent[c.parent_id]) byParent[c.parent_id] = []
    byParent[c.parent_id].push(c)
  })
  return parents.map(p => {
    const kids = byParent[p.id] || []
    if (kids.length === 0) return <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
    return (
      <optgroup key={`g-${p.id}`} label={`${p.icon} ${p.name}`}>
        {kids.map(k => <option key={k.id} value={k.id}>{k.icon} {k.name}</option>)}
      </optgroup>
    )
  })
}

const mkForm = () => ({
  description: '', amount: '', currency: '₪',
  wallet_id: '', to_wallet_id: '', category_id: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
})

export default function AddTransactionSheet({ open, onClose, onSaved, editingTx, initialData }) {
  const { user, profile } = useAuth()
  const [type, setType]       = useState('expense')
  const [isLoan, setIsLoan]   = useState(false)
  const [loanDir, setLoanDir] = useState('given')
  const [form, setForm]       = useState(mkForm)
  const [notes, setNotes]     = useState('')
  const [wallets, setWallets]     = useState([])
  const [categories, setCats]     = useState([])
  const [profiles, setProfiles]   = useState([])
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (!open) return
    loadData()
    if (editingTx) {
      const isLoanT = editingTx.type?.startsWith('loan')
      setType(isLoanT ? 'expense' : (editingTx.type || 'expense'))
      setIsLoan(isLoanT)
      setLoanDir(editingTx.type === 'loan_received' ? 'received' : 'given')
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
      setType(initialData.type || 'expense')
      setIsLoan(false); setLoanDir('given')
      setForm({ ...mkForm(), ...initialData })
      setNotes('')
    } else {
      setType('expense'); setIsLoan(false); setLoanDir('given')
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

    const dbType = isLoan ? (loanDir === 'given' ? 'loan_given' : 'loan_received') : type
    const payload = {
      type: dbType, description: form.description,
      amount: Number(form.amount), currency: form.currency || '₪',
      wallet_id: form.wallet_id || null,
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
        if (nowTransfer) await applyTransfer(form.wallet_id, form.to_wallet_id, form.amount)
        else if (form.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', form.wallet_id).single()
          if (w) await supabase.from('wallets').update({ balance: w.balance + (type === 'income' ? 1 : -1) * Number(form.amount) }).eq('id', form.wallet_id)
        }
      } else if (nowTransfer) {
        if (editingTx.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', editingTx.wallet_id).single()
          if (w) await supabase.from('wallets').update({ balance: w.balance + (editingTx.type === 'income' ? -1 : 1) * Number(editingTx.amount) }).eq('id', editingTx.wallet_id)
        }
        await applyTransfer(form.wallet_id, form.to_wallet_id, form.amount)
      } else {
        // normal → normal: reverse old, apply new
        if (editingTx.wallet_id === form.wallet_id && form.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', form.wallet_id).single()
          if (w) {
            const rev   = (editingTx.type === 'income' ? -1 : 1) * Number(editingTx.amount)
            const delta = (type === 'income' ? 1 : -1) * Number(form.amount)
            await supabase.from('wallets').update({ balance: w.balance + rev + delta }).eq('id', form.wallet_id)
          }
        } else {
          if (editingTx.wallet_id) {
            const { data: w } = await supabase.from('wallets').select('balance').eq('id', editingTx.wallet_id).single()
            if (w) await supabase.from('wallets').update({ balance: w.balance + (editingTx.type === 'income' ? -1 : 1) * Number(editingTx.amount) }).eq('id', editingTx.wallet_id)
          }
          if (form.wallet_id) {
            const { data: w } = await supabase.from('wallets').select('balance').eq('id', form.wallet_id).single()
            if (w) await supabase.from('wallets').update({ balance: w.balance + (type === 'income' ? 1 : -1) * Number(form.amount) }).eq('id', form.wallet_id)
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
      } else if (form.wallet_id) {
        const { data: w } = await supabase.from('wallets').select('balance').eq('id', form.wallet_id).single()
        if (w) await supabase.from('wallets').update({ balance: w.balance + (type === 'income' ? 1 : -1) * Number(form.amount) }).eq('id', form.wallet_id)
      }
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.CREATE, entityType: ENTITY_TYPES.TRANSACTION, description: `הוסיף/ה: ${form.description} – ${form.amount}₪` })
      toast.success('העסקה נשמרה!')
    }
    setSaving(false); onClose(); onSaved?.()
  }

  const selW = wallets.find(w => w.id === form.wallet_id)
  const activeColor = type === 'income' ? '#4ade80' : type === 'transfer' ? '#22d3ee' : '#f87171'
  const sep = () => <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'0 1rem'}}/>

  if (!open) return null

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,background:'#0d0d1f',display:'flex',flexDirection:'column',direction:'rtl'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(0.75rem + env(safe-area-inset-top,0px)) 1rem 0.75rem',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.02)',flexShrink:0}}>
        <button onClick={handleSave} disabled={saving} style={{width:38,height:38,borderRadius:'50%',background:'rgba(108,99,255,0.15)',border:'1px solid rgba(108,99,255,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#a78bfa'}}>
          <Check size={18}/>
        </button>
        <span style={{fontWeight:700,fontSize:'1rem',color:'#e2e8f0'}}>{editingTx ? 'ערוך עסקה' : 'עסקה'}</span>
        <button onClick={onClose} style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b'}}>
          <X size={18}/>
        </button>
      </div>

      {/* ── Type tabs ── */}
      <div style={{display:'flex',gap:'0.5rem',padding:'0.625rem 1rem',background:'rgba(255,255,255,0.02)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        {[['expense','הוצאה','#f87171'],['income','הכנסה','#4ade80'],['transfer','העברה','#22d3ee']].map(([t,lbl,col]) => (
          <button key={t} onClick={() => setType(t)} style={{
            flex:1,padding:'0.5rem',borderRadius:'0.75rem',fontSize:'0.85rem',cursor:'pointer',
            border:`1px solid ${type===t?col+'60':'rgba(255,255,255,0.07)'}`,
            background:type===t?col+'18':'transparent',
            color:type===t?col:'#64748b',fontWeight:type===t?700:400,transition:'all 0.15s',
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{flex:1,overflowY:'auto',padding:'0.875rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>

        {/* Description */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'0.75rem',padding:'0 1rem',minHeight:58}}>
          <Star size={17} color="#334155" style={{flexShrink:0}}/>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="תיאור"
            style={{flex:1,background:'none',border:'none',outline:'none',color:'#e2e8f0',fontSize:'0.95rem',fontFamily:'inherit',textAlign:'right',direction:'rtl'}}/>
          {form.description && <Check size={16} color="#4ade80" style={{flexShrink:0}}/>}
        </div>

        {/* Primary details card */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>

          {/* Wallet */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              {selW && (
                <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(239,68,68,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.85rem',fontWeight:700,color:'#f87171',flexShrink:0}}>
                  {selW.icon || selW.name[0]}
                </div>
              )}
              <select value={form.wallet_id} onChange={e=>setForm(f=>({...f,wallet_id:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:form.wallet_id?'#e2e8f0':'#475569',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:160}}>
                <option value="">בחר חשבון</option>
                {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
            <span style={{color:'#94a3b8',fontSize:'0.875rem',flexShrink:0}}>{type==='transfer'?'מארנק':'חשבון לחיוב'}</span>
          </div>

          {type === 'transfer' && (<>
            {sep()}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
              <select value={form.to_wallet_id} onChange={e=>setForm(f=>({...f,to_wallet_id:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:form.to_wallet_id?'#e2e8f0':'#475569',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:160}}>
                <option value="">בחר ארנק יעד</option>
                {wallets.filter(w=>w.id!==form.wallet_id).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
              <span style={{color:'#22d3ee',fontSize:'0.875rem',flexShrink:0}}>לארנק</span>
            </div>
          </>)}

          {sep()}
          {/* Amount */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.375rem',direction:'ltr'}}>
              <ChevronLeft size={16} color={activeColor}/>
              <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:'#64748b',fontSize:'0.875rem',fontFamily:'inherit'}}>
                <option>₪</option><option>$</option><option>€</option>
              </select>
              <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"
                style={{background:'none',border:'none',outline:'none',color:form.amount?'#e2e8f0':'#475569',fontSize:'1.1rem',fontWeight:700,width:100,textAlign:'left',fontFamily:'inherit'}} dir="ltr"/>
            </div>
            <span style={{color:'#94a3b8',fontSize:'0.875rem',flexShrink:0}}>סכום</span>
          </div>

          {sep()}
          {/* Date + Time */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52,gap:'0.5rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}
                style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.25rem 0.5rem',color:'#e2e8f0',fontSize:'0.82rem',outline:'none',fontFamily:'inherit'}} dir="ltr"/>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.5rem',padding:'0.25rem 0.5rem',color:'#e2e8f0',fontSize:'0.82rem',outline:'none',fontFamily:'inherit'}} dir="ltr"/>
            </div>
            <span style={{color:'#94a3b8',fontSize:'0.875rem',flexShrink:0}}>תאריך</span>
          </div>
        </div>

        {/* Secondary details */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>
          {type !== 'transfer' && (<>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
              <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}
                style={{background:'none',border:'none',outline:'none',color:form.category_id?'#e2e8f0':'#475569',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:200}}>
                <option value="">ללא קטגוריה</option>
                {buildCatOptions(categories)}
              </select>
              <span style={{color:'#94a3b8',fontSize:'0.875rem',flexShrink:0}}>קטגוריה</span>
            </div>
            {sep()}
          </>)}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
            <select value={form.assigned_to||''} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}
              style={{background:'none',border:'none',outline:'none',color:form.assigned_to?'#e2e8f0':'#475569',fontSize:'0.875rem',cursor:'pointer',fontFamily:'inherit',direction:'rtl',maxWidth:180}}>
              <option value="">לא נבחר</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span style={{color:'#94a3b8',fontSize:'0.875rem',flexShrink:0}}>בן משפחה</span>
          </div>
        </div>

        {/* Loan / Debt */}
        {type !== 'transfer' && (
          <div onClick={()=>setIsLoan(l=>!l)} style={{
            background:isLoan?'rgba(251,191,36,0.06)':'rgba(255,255,255,0.04)',
            borderRadius:'1rem',border:`1px solid ${isLoan?'rgba(251,191,36,0.25)':'rgba(255,255,255,0.08)'}`,
            overflow:'hidden',cursor:'pointer',transition:'all 0.2s',
          }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1rem',minHeight:52}}>
              {isLoan ? (
                <div onClick={e=>e.stopPropagation()} style={{display:'flex',gap:'0.375rem'}}>
                  {[['given','שנתתי'],['received','שקיבלתי']].map(([dir,lbl]) => (
                    <button key={dir} type="button" onClick={()=>setLoanDir(dir)} style={{
                      padding:'0.3rem 0.75rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',
                      border:`1px solid ${loanDir===dir?'rgba(251,191,36,0.5)':'rgba(255,255,255,0.1)'}`,
                      background:loanDir===dir?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.03)',
                      color:loanDir===dir?'#fbbf24':'#64748b',
                    }}>{lbl}</button>
                  ))}
                </div>
              ) : <ChevronLeft size={14} color="#475569"/>}
              <span style={{color:isLoan?'#fbbf24':'#94a3b8',fontSize:'0.875rem',fontWeight:isLoan?600:400}}>חוב</span>
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'1rem',border:'1px solid rgba(255,255,255,0.08)',overflow:'hidden'}}>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="הערה" rows={2}
            style={{width:'100%',background:'none',border:'none',outline:'none',color:notes?'#e2e8f0':'#475569',fontSize:'0.875rem',fontFamily:'inherit',padding:'0.875rem 1rem',resize:'none',direction:'rtl',textAlign:'right',boxSizing:'border-box'}}/>
        </div>

        <div style={{height:80}}/>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,
        background:'rgba(13,13,31,0.97)',backdropFilter:'blur(12px)',
        borderTop:'1px solid rgba(255,255,255,0.08)',
        padding:'0.75rem 1.5rem calc(0.75rem + env(safe-area-inset-bottom,0px))',
        display:'flex',alignItems:'center',justifyContent:'space-between',
      }}>
        <button onClick={handleSave} disabled={saving} style={{
          width:50,height:50,borderRadius:'50%',
          background:saving?'rgba(108,99,255,0.3)':'linear-gradient(135deg,#6c63ff,#8b5cf6)',
          border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:'0 4px 15px rgba(108,99,255,0.4)',transition:'all 0.15s',
        }}>
          {saving ? <span style={{color:'#fff',fontSize:'0.7rem'}}>...</span> : <Check size={22} color="#fff"/>}
        </button>
        <div style={{display:'flex',gap:'1.25rem'}}>
          <button style={{background:'none',border:'none',color:'#253347',padding:4,cursor:'default'}}><Settings size={22}/></button>
          <button style={{background:'none',border:'none',color:'#253347',padding:4,cursor:'default'}}><FileText size={22}/></button>
          <button style={{background:'none',border:'none',color:'#253347',padding:4,cursor:'default'}}><Lock size={22}/></button>
        </div>
      </div>
    </div>
  )
}
