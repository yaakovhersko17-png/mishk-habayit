import { useEffect, useState, useRef } from 'react'
import { supabase, cached, withRetry, invalidate } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, Mic, MicOff, Edit2, Trash2, SlidersHorizontal, X } from 'lucide-react'
import AddTransactionSheet from '../components/AddTransactionSheet'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import { useRealtime } from '../hooks/useRealtime'
import toast from 'react-hot-toast'

const TYPE_LABELS = { income:'הכנסה', expense:'הוצאה', loan_given:'הלוואה שנתתי', loan_received:'הלוואה שקיבלתי', debt_unpaid:'חוב שלא שולם', transfer:'מארנק לארנק' }
const emptyTx = { type:'expense', description:'', amount:'', currency:'₪', wallet_id:'', to_wallet_id:'', category_id:'', date: new Date().toISOString().split('T')[0], notes:'', loan_party:'', loan_due_date:'', loan_returned: false }

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

export default function Transactions() {
  const { user, profile } = useAuth()
  const [txs, setTxs]           = useState([])
  const [wallets, setWallets]   = useState([])
  const [categories, setCats]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(emptyTx)
  const [sheetInitial, setSheetInitial] = useState(null)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState({ type:'', category:'', wallet:'', user:'', dateFrom:'', dateTo:'' })
  const [listening, setListening] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => { loadAll() }, [])
  useRealtime(['transactions', 'wallets'], loadAll)

  async function loadAll() {
    const [{ data: txData }, { data: wData }, { data: cData }, { data: pData }] = await Promise.all([
      withRetry(() => supabase.from('transactions').select('*,categories(name,color,icon),wallets!wallet_id(name,icon),profiles!user_id(name)').order('date', { ascending: false }).order('created_at', { ascending: false })),
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
  function openEdit(t) { setEditing(t); setForm({ type:t.type, description:t.description, amount:t.amount, currency:t.currency, wallet_id:t.wallet_id||'', to_wallet_id:t.to_wallet_id||'', category_id:t.category_id||'', date:t.date, notes:t.notes||'', loan_party:t.loan_party||'', loan_due_date:t.loan_due_date||'', loan_returned:!!t.loan_returned }); setModal(true) }

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

  async function applyTransferWallets(srcId, dstId, amount, reverse = false) {
    const sign = reverse ? 1 : -1
    if (srcId) {
      const { data: w } = await supabase.from('wallets').select('balance').eq('id', srcId).single()
      if (w) await supabase.from('wallets').update({ balance: w.balance + sign * Number(amount) }).eq('id', srcId)
    }
    if (dstId) {
      const { data: w } = await supabase.from('wallets').select('balance').eq('id', dstId).single()
      if (w) await supabase.from('wallets').update({ balance: w.balance - sign * Number(amount) }).eq('id', dstId)
    }
  }

  async function handleSave() {
    if (!form.description || !form.amount) { toast.error('מלא תיאור וסכום'); return }
    if (form.type === 'transfer' && !form.to_wallet_id) { toast.error('בחר ארנק יעד'); return }
    if (form.type === 'transfer' && form.wallet_id === form.to_wallet_id) { toast.error('ארנק המקור והיעד חייבים להיות שונים'); return }
    setSaving(true)
    const payload = { ...form, amount: Number(form.amount), user_id: user.id }
    if (!payload.wallet_id) delete payload.wallet_id
    if (!payload.to_wallet_id || payload.type !== 'transfer') delete payload.to_wallet_id
    if (!payload.category_id) delete payload.category_id
    if (!payload.loan_party) delete payload.loan_party
    if (!payload.loan_due_date) delete payload.loan_due_date
    if (!payload.type.startsWith('loan')) delete payload.loan_returned

    if (editing) {
      const { error } = await supabase.from('transactions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast.error(error.message || 'שגיאה בשמירה'); setSaving(false); return }
      if (editing.type === 'transfer') {
        // reverse old transfer then apply new
        await applyTransferWallets(editing.wallet_id, editing.to_wallet_id, editing.amount, true)
        await applyTransferWallets(form.wallet_id, form.to_wallet_id, form.amount, false)
      } else if (form.type === 'transfer') {
        // was normal, now transfer: reverse old normal balance change then apply transfer
        if (editing.wallet_id) {
          const { data: w } = await supabase.from('wallets').select('balance').eq('id', editing.wallet_id).single()
          if (w) {
            const rev = editing.type === 'income' ? -Number(editing.amount) : Number(editing.amount)
            await supabase.from('wallets').update({ balance: w.balance + rev }).eq('id', editing.wallet_id)
          }
        }
        await applyTransferWallets(form.wallet_id, form.to_wallet_id, form.amount, false)
      } else {
        if (form.wallet_id || editing.wallet_id) {
          await updateWalletBalance(form.wallet_id, form.amount, form.type, editing.wallet_id, editing.amount, editing.type)
        }
      }
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:ENTITY_TYPES.TRANSACTION, description:`עדכן/ה: ${form.description}`, entityId:editing.id })
      toast.success('עודכן!')
    } else {
      const { error } = await supabase.from('transactions').insert(payload)
      if (error) { toast.error(error.message || 'שגיאה בשמירה'); setSaving(false); return }
      if (form.type === 'transfer') {
        await applyTransferWallets(form.wallet_id, form.to_wallet_id, form.amount, false)
      } else if (form.wallet_id) {
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
    if (t.type === 'transfer') {
      await applyTransferWallets(t.wallet_id, t.to_wallet_id, t.amount, true)
    } else if (t.wallet_id) {
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
      const numMatch = text.match(/\d+/)
      setEditing(null)
      setSheetInitial(numMatch
        ? { amount: numMatch[0], description: text.replace(numMatch[0], '').trim() }
        : { description: text }
      )
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
    if (filter.dateFrom && t.date < filter.dateFrom) return false
    if (filter.dateTo && t.date > filter.dateTo) return false
    return true
  })

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>עסקאות</h1>
          <p style={{margin:'0.25rem 0 0',color:'var(--text-muted)',fontSize:'0.875rem'}}>{filtered.length} רשומות</p>
        </div>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className={`btn-ghost${listening?' active':''}`} onClick={startVoice} style={listening?{background:'rgba(239,68,68,0.15)',borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}:{}}>
            {listening ? <><MicOff size={15}/>מקשיב...</> : <><Mic size={15}/>קולי</>}
          </button>
          <button className={editMode?'btn-primary':'btn-ghost'} onClick={()=>setEditMode(v=>!v)} style={{padding:'0.4rem 0.75rem'}}>
            {editMode?'סיום':'עריכה'}
          </button>
        </div>
      </div>

      {/* Search bar only */}
      <div style={{position:'relative'}}>
        <Search size={14} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
        <input className="input-field" placeholder="חיפוש..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:'2.25rem'}}/>
      </div>

      {/* Table */}
      {filtered.length === 0
        ? <EmptyState icon="📊" title="אין עסקאות" subtitle="הוסף עסקה ראשונה" action={<button className="btn-primary" onClick={openAdd}><Plus size={14}/>הוסף</button>}/>
        : (
          <div className="page-card" style={{padding:0,overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    {['תאריך','תיאור','סכום','קטגוריה','ארנק','משתמש','סוג',...(editMode?['']:[])] .map(h=>(
                      <th key={h} style={{padding:'0.875rem 1rem',textAlign:'right',fontSize:'0.75rem',color:'var(--text-muted)',fontWeight:500,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',transition:'background 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'0.875rem 1rem',color:'var(--text-muted)',fontSize:'0.8rem',whiteSpace:'nowrap'}}>{new Date(t.date).toLocaleDateString('he-IL')}</td>
                      <td style={{padding:'0.875rem 1rem',color:'var(--text)',fontSize:'0.875rem',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                      <td style={{padding:'0.875rem 1rem',fontWeight:600,whiteSpace:'nowrap',color: t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type.startsWith('loan')?'#fbbf24':'#f87171'}}>
                        {t.type==='income'?'+':t.type==='transfer'?'↔':'-'}{t.currency}{Number(t.amount).toLocaleString()}
                      </td>
                      <td style={{padding:'0.875rem 1rem',fontSize:'0.8rem',color:'var(--text-sub)'}}>{t.categories ? `${t.categories.icon||''} ${t.categories.name}` : '—'}</td>
                      <td style={{padding:'0.875rem 1rem',fontSize:'0.8rem',color:'var(--text-sub)'}}>
                        {t.type === 'transfer'
                          ? <>
                              <span>{t.wallets?.icon||''} {t.wallets?.name||'—'}</span>
                              <span style={{color:'#22d3ee',margin:'0 0.25rem'}}>→</span>
                              <span>{wallets.find(w=>w.id===t.to_wallet_id)?.icon||''} {wallets.find(w=>w.id===t.to_wallet_id)?.name||'—'}</span>
                            </>
                          : t.wallets ? `${t.wallets.icon||''} ${t.wallets.name}` : '—'}
                      </td>
                      <td style={{padding:'0.875rem 1rem',fontSize:'0.8rem',color:'var(--text-sub)'}}>{t.profiles?.name || '—'}</td>
                      <td style={{padding:'0.875rem 1rem'}}>
                        <span className={t.type==='income'?'badge-income':t.type==='transfer'?'badge-transfer':t.type.startsWith('loan')?'badge-loan':'badge-expense'}>
                          {TYPE_LABELS[t.type]}
                        </span>
                        {t.type.startsWith('loan') && t.loan_returned && <span style={{marginRight:'0.375rem',fontSize:'0.7rem',color:'#4ade80'}}>✓ הוחזר</span>}
                      </td>
                      {editMode && (
                        <td style={{padding:'0.875rem 1rem'}}>
                          <div style={{display:'flex',gap:'0.25rem'}}>
                            <button onClick={()=>openEdit(t)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'0.25rem',borderRadius:'0.375rem'}}><Edit2 size={13}/></button>
                            <button onClick={()=>handleDelete(t)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem',borderRadius:'0.375rem'}}><Trash2 size={13}/></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* Floating add button */}
      <button onClick={openAdd}
        style={{position:'fixed',bottom:'calc(62px + max(12px, env(safe-area-inset-bottom, 12px)) + 14px)',left:'1.25rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:55,transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <Plus size={24} color="#fff"/>
      </button>
      {/* Floating filter button */}
      <button onClick={() => setFilterOpen(true)}
        style={{position:'fixed',bottom:'calc(62px + max(12px, env(safe-area-inset-bottom, 12px)) + 14px)',left:'calc(1.25rem + 64px)',width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.08)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:55,transition:'transform 0.2s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <SlidersHorizontal size={20} color="var(--text-sub)"/>
      </button>

      {/* Filter panel */}
      {filterOpen && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setFilterOpen(false)}>
          <div style={{width:'100%',background:'#1a1a2e',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
              <span style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>סינון</span>
              <button onClick={()=>setFilterOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>סוג</label>
                <select className="input-field" value={filter.type} onChange={e=>setFilter({...filter,type:e.target.value})}>
                  <option value="">הכל</option>
                  {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>קטגוריה</label>
                <select className="input-field" value={filter.category} onChange={e=>setFilter({...filter,category:e.target.value})}>
                  <option value="">הכל</option>
                  {buildCatOptions(categories)}
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>ארנק</label>
                <select className="input-field" value={filter.wallet} onChange={e=>setFilter({...filter,wallet:e.target.value})}>
                  <option value="">הכל</option>
                  {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>משתמש</label>
                <select className="input-field" value={filter.user} onChange={e=>setFilter({...filter,user:e.target.value})}>
                  <option value="">הכל</option>
                  {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                <div>
                  <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>מתאריך</label>
                  <input className="input-field" type="date" value={filter.dateFrom} onChange={e=>setFilter({...filter,dateFrom:e.target.value})} dir="ltr"/>
                </div>
                <div>
                  <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>עד תאריך</label>
                  <input className="input-field" type="date" value={filter.dateTo} onChange={e=>setFilter({...filter,dateTo:e.target.value})} dir="ltr"/>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'1.25rem'}}>
              <button className="btn-ghost" onClick={()=>{setFilter({type:'',category:'',wallet:'',user:'',dateFrom:'',dateTo:''});setSearch('');}} style={{flex:1,justifyContent:'center'}}>נקה הכל</button>
              <button className="btn-primary" onClick={()=>setFilterOpen(false)} style={{flex:1,justifyContent:'center'}}>החל</button>
            </div>
          </div>
        </div>
      )}

      <AddTransactionSheet
        open={modal}
        onClose={() => { setModal(false); setSheetInitial(null) }}
        onSaved={loadAll}
        editingTx={editing}
        initialData={editing ? null : sheetInitial}
      />
    </div>
  )
}
