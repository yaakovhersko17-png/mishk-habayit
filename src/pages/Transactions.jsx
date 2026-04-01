import { useEffect, useState, useRef } from 'react'
import { supabase, cached, withRetry, invalidate } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, Mic, MicOff, Edit2, Trash2, Filter } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const TYPE_LABELS = { income:'הכנסה', expense:'הוצאה', loan_given:'הלוואה נתתי', loan_received:'הלוואה קיבלתי' }
const emptyTx = { type:'expense', description:'', amount:'', currency:'₪', wallet_id:'', category_id:'', date: new Date().toISOString().split('T')[0], notes:'', loan_party:'', loan_due_date:'' }

export default function Transactions() {
  const { user, profile } = useAuth()
  const [txs, setTxs]           = useState([])
  const [wallets, setWallets]   = useState([])
  const [categories, setCats]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(emptyTx)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState({ type:'', category:'', wallet:'', user:'' })
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: txData }, { data: wData }, { data: cData }, { data: pData }] = await Promise.all([
      withRetry(() => supabase.from('transactions').select('*,categories(name,color,icon),wallets(name,icon),profiles(name)').order('date', { ascending: false }).order('created_at', { ascending: false })),
      withRetry(() => supabase.from('wallets').select('*')),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
      cached('profiles', () => supabase.from('profiles').select('*'), 120_000),
    ])
    setTxs(txData || [])
    setWallets(wData || [])
    setCats(cData || [])
    setProfiles(pData || [])
    setLoading(false)
  }

  function openAdd()   { setEditing(null); setForm(emptyTx); setModal(true) }
  function openEdit(t) { setEditing(t); setForm({ type:t.type, description:t.description, amount:t.amount, currency:t.currency, wallet_id:t.wallet_id||'', category_id:t.category_id||'', date:t.date, notes:t.notes||'', loan_party:t.loan_party||'', loan_due_date:t.loan_due_date||'' }); setModal(true) }

  async function updateWalletBalance(walletId, amount, type, oldWalletId, oldAmount, oldType) {
    // For new transaction or wallet change: credit/debit the wallet
    if (oldWalletId && oldWalletId !== walletId) {
      // Reverse old wallet
      const { data: oldWallet } = await supabase.from('wallets').select('balance').eq('id', oldWalletId).single()
      if (oldWallet) {
        const oldDelta = oldType === 'income' ? -Number(oldAmount) : Number(oldAmount)
        await supabase.from('wallets').update({ balance: oldWallet.balance + oldDelta }).eq('id', oldWalletId)
      }
    }
    if (walletId) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', walletId).single()
      if (wallet) {
        // If editing same wallet, reverse old then apply new
        let base = wallet.balance
        if (oldWalletId === walletId && oldAmount !== undefined) {
          const oldDelta = oldType === 'income' ? -Number(oldAmount) : Number(oldAmount)
          base += oldDelta
        }
        const delta = type === 'income' ? Number(amount) : -Number(amount)
        await supabase.from('wallets').update({ balance: base + delta }).eq('id', walletId)
      }
    }
  }

  async function handleSave() {
    if (!form.description || !form.amount) { toast.error('מלא תיאור וסכום'); return }
    setSaving(true)
    const payload = { ...form, amount: Number(form.amount), user_id: user.id }
    if (!payload.wallet_id) delete payload.wallet_id
    if (!payload.category_id) delete payload.category_id
    if (!payload.loan_party) delete payload.loan_party
    if (!payload.loan_due_date) delete payload.loan_due_date

    if (editing) {
      const { error } = await supabase.from('transactions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast.error('שגיאה'); setSaving(false); return }
      // Update wallet balance: reverse old, apply new
      if (form.wallet_id || editing.wallet_id) {
        await updateWalletBalance(form.wallet_id, form.amount, form.type, editing.wallet_id, editing.amount, editing.type)
      }
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:ENTITY_TYPES.TRANSACTION, description:`עדכן/ה: ${form.description}`, entityId:editing.id })
      toast.success('עודכן!')
    } else {
      const { error } = await supabase.from('transactions').insert(payload)
      if (error) { toast.error('שגיאה'); setSaving(false); return }
      // Update wallet balance for new transaction
      if (form.wallet_id) {
        const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', form.wallet_id).single()
        if (wallet) {
          const delta = form.type === 'income' ? Number(form.amount) : -Number(form.amount)
          await supabase.from('wallets').update({ balance: wallet.balance + delta }).eq('id', form.wallet_id)
        }
      }
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.CREATE, entityType:ENTITY_TYPES.TRANSACTION, description:`הוסיף/ה: ${form.description} – ${form.amount}₪` })
      toast.success('נוסף!')
    }
    setModal(false); loadAll(); setSaving(false)
  }

  async function handleDelete(t) {
    if (!confirm(`למחוק "${t.description}"?`)) return
    const { error } = await supabase.from('transactions').delete().eq('id', t.id)
    if (error) { toast.error('שגיאה במחיקה'); return }
    // Reverse wallet balance
    if (t.wallet_id) {
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', t.wallet_id).single()
      if (wallet) {
        const delta = t.type === 'income' ? -Number(t.amount) : Number(t.amount)
        await supabase.from('wallets').update({ balance: wallet.balance + delta }).eq('id', t.wallet_id)
      }
    }
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.DELETE, entityType:ENTITY_TYPES.TRANSACTION, description:`מחק/ה: ${t.description}`, entityId:t.id })
    toast.success('נמחק')
    loadAll()
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('הדפדפן לא תומך בזיהוי קולי'); return }
    const rec = new SR()
    rec.lang = 'he-IL'
    rec.continuous = false
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript
      toast.success(`שמעתי: "${text}"`)
      // simple parse: number → amount, rest → description
      const numMatch = text.match(/\d+/)
      if (numMatch) {
        setForm(f => ({ ...f, amount: numMatch[0], description: text.replace(numMatch[0], '').trim() }))
      } else {
        setForm(f => ({ ...f, description: text }))
      }
      setModal(true)
      setListening(false)
    }
    rec.onerror = () => { setListening(false); toast.error('לא הצלחתי לשמוע') }
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  const filtered = txs.filter(t => {
    const q = search.toLowerCase()
    if (q && !t.description?.toLowerCase().includes(q)) return false
    if (filter.type && t.type !== filter.type) return false
    if (filter.category && t.category_id !== filter.category) return false
    if (filter.wallet && t.wallet_id !== filter.wallet) return false
    if (filter.user && t.user_id !== filter.user) return false
    return true
  })

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>טרנזקציות</h1>
          <p style={{margin:'0.25rem 0 0',color:'#64748b',fontSize:'0.875rem'}}>{filtered.length} רשומות</p>
        </div>
        <div style={{display:'flex',gap:'0.75rem'}}>
          <button className={`btn-ghost${listening?' active':''}`} onClick={startVoice} style={listening?{background:'rgba(239,68,68,0.15)',borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}:{}}>
            {listening ? <><MicOff size={15}/>מקשיב...</> : <><Mic size={15}/>קולי</>}
          </button>
          <button className="btn-primary" onClick={openAdd}><Plus size={15}/>חדשה</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <Search size={14} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'#64748b'}}/>
          <input className="input-field" placeholder="חיפוש..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:'2.25rem'}}/>
        </div>
        <select className="input-field" style={{width:'auto'}} value={filter.type} onChange={e=>setFilter({...filter,type:e.target.value})}>
          <option value="">כל הסוגים</option>
          {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input-field" style={{width:'auto'}} value={filter.category} onChange={e=>setFilter({...filter,category:e.target.value})}>
          <option value="">כל הקטגוריות</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select className="input-field" style={{width:'auto'}} value={filter.user} onChange={e=>setFilter({...filter,user:e.target.value})}>
          <option value="">כל המשתמשים</option>
          {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0
        ? <EmptyState icon="📊" title="אין טרנזקציות" subtitle="הוסף טרנזקציה ראשונה" action={<button className="btn-primary" onClick={openAdd}><Plus size={14}/>הוסף</button>}/>
        : (
          <div className="page-card" style={{padding:0,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    {['תאריך','תיאור','סכום','קטגוריה','ארנק','משתמש','סוג',''].map(h=>(
                      <th key={h} style={{padding:'0.875rem 1rem',textAlign:'right',fontSize:'0.75rem',color:'#64748b',fontWeight:500,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',transition:'background 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'0.875rem 1rem',color:'#64748b',fontSize:'0.8rem',whiteSpace:'nowrap'}}>{new Date(t.date).toLocaleDateString('he-IL')}</td>
                      <td style={{padding:'0.875rem 1rem',color:'#e2e8f0',fontSize:'0.875rem',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                      <td style={{padding:'0.875rem 1rem',fontWeight:600,whiteSpace:'nowrap',color: t.type==='income'?'#4ade80':t.type.startsWith('loan')?'#fbbf24':'#f87171'}}>
                        {t.type==='income'?'+':'-'}{t.currency}{Number(t.amount).toLocaleString()}
                      </td>
                      <td style={{padding:'0.875rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.categories ? `${t.categories.icon||''} ${t.categories.name}` : '—'}</td>
                      <td style={{padding:'0.875rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.wallets ? `${t.wallets.icon||''} ${t.wallets.name}` : '—'}</td>
                      <td style={{padding:'0.875rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.profiles?.name || '—'}</td>
                      <td style={{padding:'0.875rem 1rem'}}>
                        <span className={t.type==='income'?'badge-income':t.type.startsWith('loan')?'badge-loan':'badge-expense'}>
                          {TYPE_LABELS[t.type]}
                        </span>
                      </td>
                      <td style={{padding:'0.875rem 1rem'}}>
                        <div style={{display:'flex',gap:'0.25rem'}}>
                          <button onClick={()=>openEdit(t)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'0.25rem',borderRadius:'0.375rem'}}><Edit2 size={13}/></button>
                          <button onClick={()=>handleDelete(t)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem',borderRadius:'0.375rem'}}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'ערוך טרנזקציה':'טרנזקציה חדשה'} size="lg">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>סוג</label>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
              {Object.entries(TYPE_LABELS).map(([k,v])=>(
                <button key={k} onClick={()=>setForm({...form,type:k})} style={{padding:'0.4rem 0.875rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${form.type===k?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:form.type===k?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:form.type===k?'#a78bfa':'#94a3b8'}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תיאור</label>
            <input className="input-field" placeholder="תיאור..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>סכום</label>
            <input className="input-field" type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} dir="ltr"/>
            <label style={{display:'inline-flex',alignItems:'center',gap:'0.4rem',marginTop:'0.5rem',cursor:'pointer',fontSize:'0.78rem',color:'#64748b',userSelect:'none'}}>
              <input
                type="checkbox"
                checked={form.currency !== '₪'}
                onChange={e => setForm({...form, currency: e.target.checked ? '$' : '₪'})}
                style={{accentColor:'#6c63ff',width:14,height:14,cursor:'pointer'}}
              />
              מטבע זר
            </label>
            {form.currency !== '₪' && (
              <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
                {['$','€','£'].map(c => (
                  <button key={c} onClick={()=>setForm({...form,currency:c})} style={{padding:'0.3rem 0.75rem',borderRadius:'0.5rem',fontSize:'0.9rem',fontWeight:600,cursor:'pointer',border:`1px solid ${form.currency===c?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.1)'}`,background:form.currency===c?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.04)',color:form.currency===c?'#a78bfa':'#94a3b8'}}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תאריך</label>
            <input className="input-field" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} dir="ltr"/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>ארנק</label>
            <select className="input-field" value={form.wallet_id} onChange={e=>setForm({...form,wallet_id:e.target.value})}>
              <option value="">בחר ארנק</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>קטגוריה</label>
            <select className="input-field" value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>
              <option value="">בחר קטגוריה</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          {form.type.startsWith('loan') && (
            <>
              <div>
                <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>גורם הלוואה</label>
                <input className="input-field" placeholder="שם..." value={form.loan_party} onChange={e=>setForm({...form,loan_party:e.target.value})}/>
              </div>
              <div>
                <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>תאריך פירעון</label>
                <input className="input-field" type="date" value={form.loan_due_date} onChange={e=>setForm({...form,loan_due_date:e.target.value})} dir="ltr"/>
              </div>
            </>
          )}
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>הערות</label>
            <textarea className="input-field" placeholder="הערות..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{resize:'vertical'}}/>
          </div>
          <div style={{gridColumn:'1/-1',display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
            <button className="btn-ghost" onClick={()=>setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'שומר...':'שמור'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
