import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, cached, withRetry } from '../lib/supabase'
import { Search, Download, FileText, ChevronUp, ChevronDown, SlidersHorizontal, X, Edit2, Trash2 } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import { useRealtime } from '../hooks/useRealtime'
import toast from 'react-hot-toast'

const CURRENCIES = ['₪', '$', '€', '£']

export default function InvoiceArchive() {
  const { user, profile } = useAuth()
  const [invoices, setInvoices]   = useState([])
  const [wallets, setWallets]     = useState([])
  const [cats, setCats]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [searchItem, setSearchItem] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterWallet, setFilterWallet] = useState('')
  const [sortBy, setSortBy]       = useState('date')
  const [sortDir, setSortDir]     = useState('desc')
  const [selected, setSelected]   = useState(null)
  const [items, setItems]         = useState([])
  const [filterOpen, setFilterOpen] = useState(false)

  // Edit state
  const [editingInv, setEditingInv] = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [saving, setSaving]         = useState(false)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => { load() }, [])
  useRealtime('invoices', load)

  async function load() {
    const [{ data: invData }, { data: wData }, { data: cData }] = await Promise.all([
      withRetry(() => supabase.from('invoices').select('*,wallets(name),categories(name,icon),profiles(name)').order('date', { ascending: false })),
      withRetry(() => supabase.from('wallets').select('*')),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
    ])
    setInvoices(invData || [])
    setWallets(wData || [])
    setCats(cData || [])
    setLoading(false)
  }

  async function openInvoice(inv) {
    const { data } = await supabase.from('invoice_items').select('*,categories(name,icon)').eq('invoice_id', inv.id)
    setItems(data || [])
    setSelected(inv)
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function startEdit(inv) {
    setEditForm({
      business_name: inv.business_name || '',
      date:          inv.date || '',
      total:         inv.total || 0,
      vat:           inv.vat || 0,
      currency:      inv.currency || '₪',
      wallet_id:     inv.wallet_id || '',
      category_id:   inv.category_id || '',
    })
    setEditingInv(inv)
    setSelected(null)
  }

  async function saveEdit() {
    if (!editForm.wallet_id) { toast.error('בחר ארנק'); return }
    setSaving(true)
    const old = editingInv
    const newTotal = Number(editForm.total)
    const oldTotal = Number(old.total)

    // 1. Update invoice row
    const { error } = await supabase.from('invoices').update({
      business_name: editForm.business_name,
      date:          editForm.date,
      total:         newTotal,
      vat:           Number(editForm.vat),
      currency:      editForm.currency,
      wallet_id:     editForm.wallet_id,
      category_id:   editForm.category_id || null,
    }).eq('id', old.id)

    if (error) { toast.error('שגיאה בעדכון'); setSaving(false); return }

    // 2. Adjust wallet balance
    if (old.wallet_id === editForm.wallet_id) {
      // Same wallet — apply the delta
      const delta = oldTotal - newTotal
      if (delta !== 0) {
        const { data: w } = await supabase.from('wallets').select('balance').eq('id', editForm.wallet_id).single()
        if (w) await supabase.from('wallets').update({ balance: w.balance + delta }).eq('id', editForm.wallet_id)
      }
    } else {
      // Wallet changed — restore old, deduct from new
      const [{ data: oldW }, { data: newW }] = await Promise.all([
        supabase.from('wallets').select('balance').eq('id', old.wallet_id).single(),
        supabase.from('wallets').select('balance').eq('id', editForm.wallet_id).single(),
      ])
      if (oldW) await supabase.from('wallets').update({ balance: oldW.balance + oldTotal }).eq('id', old.wallet_id)
      if (newW) await supabase.from('wallets').update({ balance: newW.balance - newTotal }).eq('id', editForm.wallet_id)
    }

    // 3. Update linked transaction (if invoice_id column exists)
    await supabase.from('transactions').update({
      description: editForm.business_name || 'חשבונית סרוקה',
      amount:      newTotal,
      currency:    editForm.currency,
      wallet_id:   editForm.wallet_id,
      date:        editForm.date,
    }).eq('invoice_id', old.id)

    await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.UPDATE, entityType: ENTITY_TYPES.INVOICE, description: `עדכן/ה חשבונית: ${editForm.business_name} – ${editForm.currency}${newTotal}`, entityId: old.id })
    toast.success('חשבונית עודכנה')
    setEditingInv(null)
    setSaving(false)
    load()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteInvoice(inv) {
    setDeleting(true)

    // 1. Restore wallet balance
    if (inv.wallet_id) {
      const { data: w } = await supabase.from('wallets').select('balance').eq('id', inv.wallet_id).single()
      if (w) await supabase.from('wallets').update({ balance: w.balance + Number(inv.total) }).eq('id', inv.wallet_id)
    }

    // 2. Delete linked transaction
    await supabase.from('transactions').delete().eq('invoice_id', inv.id)

    // 3. Delete invoice items
    await supabase.from('invoice_items').delete().eq('invoice_id', inv.id)

    // 4. Delete invoice
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id)
    if (error) { toast.error('שגיאה במחיקה'); setDeleting(false); return }

    await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.DELETE, entityType: ENTITY_TYPES.INVOICE, description: `מחק/ה חשבונית: ${inv.business_name}`, entityId: inv.id })
    toast.success('חשבונית נמחקה')
    setConfirmDelete(null)
    setSelected(null)
    setDeleting(false)
    load()
  }

  // ── Filter / Sort ─────────────────────────────────────────────────────────

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    if (q && !inv.business_name?.toLowerCase().includes(q)) return false
    if (dateFrom && inv.date < dateFrom) return false
    if (dateTo   && inv.date > dateTo)   return false
    if (filterCat    && inv.category_id !== filterCat)    return false
    if (filterWallet && inv.wallet_id   !== filterWallet) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let va, vb
    if (sortBy === 'date')  { va = a.date; vb = b.date }
    if (sortBy === 'total') { va = Number(a.total); vb = Number(b.total) }
    if (sortBy === 'name')  { va = a.business_name || ''; vb = b.business_name || '' }
    if (sortDir === 'asc') return va > vb ? 1 : -1
    return va < vb ? 1 : -1
  })

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
  }

  function SortBtn({ field, label }) {
    const active = sortBy === field
    return (
      <button onClick={() => toggleSort(field)} style={{background:'none',border:'none',cursor:'pointer',color:active?'#a78bfa':'var(--text-muted)',fontSize:'0.75rem',display:'flex',alignItems:'center',gap:'0.25rem',padding:'0.25rem 0.5rem',borderRadius:'0.375rem',fontWeight:active?600:400}}>
        {label}
        {active ? (sortDir==='asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>) : null}
      </button>
    )
  }

  // ── Exports ───────────────────────────────────────────────────────────────

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      doc.setFont('helvetica')
      doc.setFontSize(14)
      doc.text('Invoice Archive', 105, 18, { align: 'center' })
      autoTable(doc, {
        startY: 26,
        head: [['Date', 'Business', 'Total', 'VAT', 'Wallet', 'Category']],
        body: sorted.map(inv => [inv.date, inv.business_name || '', `${inv.currency||'₪'}${Number(inv.total||0).toFixed(2)}`, `${inv.currency||'₪'}${Number(inv.vat||0).toFixed(2)}`, inv.wallets?.name || '-', inv.categories?.name || '-']),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [108, 99, 255] },
      })
      doc.save('invoices.pdf')
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.EXPORT, entityType: ENTITY_TYPES.INVOICE, description: 'ייצא/ה ארכיון חשבוניות PDF' })
      toast.success('PDF יוצא!')
    } catch { toast.error('שגיאה בייצוא PDF') }
  }

  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const rows = sorted.map(inv => ({ תאריך: inv.date, עסק: inv.business_name || '', סכום: Number(inv.total||0), מטבע: inv.currency||'₪', מעמ: Number(inv.vat||0), ארנק: inv.wallets?.name||'', קטגוריה: inv.categories?.name||'' }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'חשבוניות')
      XLSX.writeFile(wb, 'invoices.xlsx')
      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.EXPORT, entityType: ENTITY_TYPES.INVOICE, description: 'ייצא/ה ארכיון חשבוניות Excel' })
      toast.success('Excel יוצא!')
    } catch { toast.error('שגיאה בייצוא Excel') }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'0.75rem'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'var(--text)'}}>ארכיון חשבוניות</h1>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className="btn-ghost" onClick={exportPDF} style={{fontSize:'0.8rem',padding:'0.4rem 0.875rem'}}><FileText size={14}/>PDF</button>
          <button className="btn-ghost" onClick={exportExcel} style={{fontSize:'0.8rem',padding:'0.4rem 0.875rem'}}><Download size={14}/>Excel</button>
        </div>
      </div>

      <div style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>{sorted.length} חשבוניות</div>

      {sorted.length === 0
        ? <EmptyState icon="🧾" title="אין חשבוניות" subtitle="סרוק חשבונית ראשונה בעמוד סריקת חשבונית"/>
        : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'1rem'}}>
            {sorted.map(inv => (
              <div key={inv.id} className="stat-card" style={{cursor:'pointer',position:'relative'}} onClick={() => openInvoice(inv)}>
                {/* Edit / Delete buttons */}
                <div style={{position:'absolute',top:'0.625rem',left:'0.625rem',display:'flex',gap:'0.25rem',zIndex:1}}
                  onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => startEdit(inv)}
                    style={{background:'rgba(108,99,255,0.15)',border:'none',borderRadius:'0.375rem',padding:'0.25rem',cursor:'pointer',color:'#a78bfa',display:'flex',alignItems:'center'}}
                    title="ערוך">
                    <Edit2 size={13}/>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(inv)}
                    style={{background:'rgba(239,68,68,0.12)',border:'none',borderRadius:'0.375rem',padding:'0.25rem',cursor:'pointer',color:'#f87171',display:'flex',alignItems:'center'}}
                    title="מחק">
                    <Trash2 size={13}/>
                  </button>
                </div>

                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
                  <div style={{fontSize:'1.5rem'}}>🧾</div>
                  <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{inv.date}</span>
                </div>
                <div style={{fontWeight:600,color:'var(--text)',marginBottom:'0.25rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.business_name || 'לא ידוע'}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'0.5rem'}}>
                  <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{inv.categories ? `${inv.categories.icon||''} ${inv.categories.name}` : ''}</span>
                  <span style={{fontWeight:700,color:'var(--text)'}}>{inv.currency||'₪'}{Number(inv.total||0).toLocaleString()}</span>
                </div>
                {inv.wallets && <div style={{fontSize:'0.75rem',color:'var(--text-dim)',marginTop:'0.25rem'}}>💳 {inv.wallets.name}</div>}
              </div>
            ))}
          </div>
        )
      }

      {/* Floating filter button */}
      {(() => {
        const active = [search, searchItem, dateFrom, dateTo, filterCat, filterWallet].filter(Boolean).length
        return (
          <button onClick={() => setFilterOpen(true)}
            style={{position:'fixed',bottom:'2rem',left:'2rem',width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#8b5cf6)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(108,99,255,0.4)',zIndex:50,transition:'transform 0.2s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <SlidersHorizontal size={22} color="#fff"/>
            {active > 0 && <span style={{position:'absolute',top:2,right:2,width:18,height:18,borderRadius:'50%',background:'#f87171',fontSize:'0.65rem',fontWeight:700,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>{active}</span>}
          </button>
        )
      })()}

      {/* Filter panel */}
      {filterOpen && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={() => setFilterOpen(false)}>
          <div style={{width:'100%',background:'#1a1a2e',borderRadius:'1.25rem 1.25rem 0 0',padding:'1.5rem',boxShadow:'0 -8px 40px rgba(0,0,0,0.5)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
              <span style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>סינון ומיון</span>
              <button onClick={() => setFilterOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div style={{position:'relative'}}>
                <Search size={14} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
                <input className="input-field" style={{paddingRight:'2.25rem'}} placeholder="שם עסק..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <div style={{position:'relative'}}>
                <Search size={14} style={{position:'absolute',right:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
                <input className="input-field" style={{paddingRight:'2.25rem'}} placeholder="שם מוצר..." value={searchItem} onChange={e=>setSearchItem(e.target.value)}/>
              </div>
              <div style={{display:'flex',gap:'0.625rem'}}>
                <input className="input-field" type="date" style={{flex:1}} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} dir="ltr"/>
                <input className="input-field" type="date" style={{flex:1}} value={dateTo}   onChange={e=>setDateTo(e.target.value)}   dir="ltr"/>
              </div>
              <select className="input-field" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                <option value="">כל הקטגוריות</option>
                {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <select className="input-field" value={filterWallet} onChange={e=>setFilterWallet(e.target.value)}>
                <option value="">כל הארנקים</option>
                {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div>
                <div style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:'0.5rem'}}>מיון לפי</div>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  {[['date','תאריך'],['total','סכום'],['name','שם עסק']].map(([f,l])=>(
                    <button key={f} onClick={() => toggleSort(f)}
                      style={{flex:1,padding:'0.4rem',borderRadius:'0.5rem',fontSize:'0.8rem',cursor:'pointer',border:`1px solid ${sortBy===f?'rgba(108,99,255,0.5)':'rgba(255,255,255,0.08)'}`,background:sortBy===f?'rgba(108,99,255,0.2)':'rgba(255,255,255,0.03)',color:sortBy===f?'#a78bfa':'var(--text-sub)'}}>
                      {l} {sortBy===f?(sortDir==='asc'?'↑':'↓'):''}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => {setSearch('');setSearchItem('');setDateFrom('');setDateTo('');setFilterCat('');setFilterWallet('');setSortBy('date');setSortDir('desc')}}
                style={{width:'100%',padding:'0.6rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'var(--text-sub)',cursor:'pointer',fontSize:'0.85rem'}}>
                נקה סינון
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.business_name || 'חשבונית'} size="lg">
        {selected && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div className="form-2col">
              {[['תאריך',selected.date],['סה"כ',`${selected.currency||'₪'}${Number(selected.total||0).toLocaleString()}`],['מע"מ',`${selected.currency||'₪'}${Number(selected.vat||0).toLocaleString()}`],['נסרק ע"י',selected.profiles?.name||'—']].map(([l,v])=>(
                <div key={l} style={{padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)'}}>
                  <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:'0.25rem'}}>{l}</div>
                  <div style={{fontWeight:600,color:'var(--text)'}}>{v}</div>
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div>
                <h3 style={{margin:'0 0 0.75rem',fontSize:'0.875rem',fontWeight:600,color:'var(--text-sub)'}}>פריטים</h3>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:'400px'}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                        {['פריט','כמות','מחיר','סה"כ','קטגוריה'].map(h=><th key={h} style={{padding:'0.5rem',textAlign:'right',fontSize:'0.75rem',color:'var(--text-muted)'}}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item=>(
                        <tr key={item.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                          <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',color:'var(--text)'}}>{item.name}</td>
                          <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',color:'var(--text-sub)'}}>×{item.quantity}</td>
                          <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',color:'var(--text-sub)'}}>₪{Number(item.price).toFixed(2)}</td>
                          <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',fontWeight:600,color:'var(--text)'}}>₪{(Number(item.price)*Number(item.quantity)).toFixed(2)}</td>
                          <td style={{padding:'0.625rem 0.5rem',fontSize:'0.8rem',color:'#a78bfa'}}>{item.categories ? `${item.categories.icon||''} ${item.categories.name}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Action buttons */}
            <div style={{display:'flex',gap:'0.75rem',paddingTop:'0.5rem',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <button className="btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={() => startEdit(selected)}>
                <Edit2 size={14}/>ערוך
              </button>
              <button className="btn-danger" style={{flex:1,justifyContent:'center'}} onClick={() => { setConfirmDelete(selected); setSelected(null) }}>
                <Trash2 size={14}/>מחק
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingInv} onClose={() => setEditingInv(null)} title="עריכת חשבונית">
        {editingInv && (
          <div style={{display:'flex',flexDirection:'column',gap:'0.875rem'}}>
            <div>
              <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>שם עסק</label>
              <input className="input-field" value={editForm.business_name} onChange={e=>setEditForm({...editForm,business_name:e.target.value})}/>
            </div>
            <div style={{display:'flex',gap:'0.75rem'}}>
              <div style={{flex:1}}>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>תאריך</label>
                <input className="input-field" type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} dir="ltr"/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>מטבע</label>
                <select className="input-field" value={editForm.currency} onChange={e=>setEditForm({...editForm,currency:e.target.value})}>
                  {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:'0.75rem'}}>
              <div style={{flex:1}}>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>סה"כ</label>
                <input className="input-field" type="number" step="0.01" value={editForm.total} onChange={e=>setEditForm({...editForm,total:e.target.value})} dir="ltr"/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>מע"מ</label>
                <input className="input-field" type="number" step="0.01" value={editForm.vat} onChange={e=>setEditForm({...editForm,vat:e.target.value})} dir="ltr"/>
              </div>
            </div>
            <div>
              <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>ארנק <span style={{color:'#f87171'}}>*</span></label>
              <select className="input-field" value={editForm.wallet_id} onChange={e=>setEditForm({...editForm,wallet_id:e.target.value})}>
                <option value="">בחר ארנק</option>
                {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:'0.75rem',color:'var(--text-muted)',display:'block',marginBottom:'0.25rem'}}>קטגוריה</label>
              <select className="input-field" value={editForm.category_id} onChange={e=>setEditForm({...editForm,category_id:e.target.value})}>
                <option value="">— ללא קטגוריה</option>
                {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'0.25rem'}}>
              <button className="btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={() => setEditingInv(null)}>ביטול</button>
              <button className="btn-primary" style={{flex:1,justifyContent:'center'}} onClick={saveEdit} disabled={saving}>
                {saving ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm delete modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="מחיקת חשבונית">
        {confirmDelete && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <p style={{margin:0,color:'var(--text-sub)',fontSize:'0.9rem'}}>
              האם למחוק את החשבונית של <strong style={{color:'var(--text)'}}>{confirmDelete.business_name || 'לא ידוע'}</strong> בסך <strong style={{color:'#f87171'}}>{confirmDelete.currency||'₪'}{Number(confirmDelete.total||0).toLocaleString()}</strong>?
            </p>
            <p style={{margin:0,fontSize:'0.8rem',color:'var(--text-muted)'}}>
              הסכום יוחזר לארנק והטרנזקציה המשויכת תימחק.
            </p>
            <div style={{display:'flex',gap:'0.75rem'}}>
              <button className="btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={() => setConfirmDelete(null)} disabled={deleting}>ביטול</button>
              <button className="btn-danger" style={{flex:1,justifyContent:'center'}} onClick={() => deleteInvoice(confirmDelete)} disabled={deleting}>
                {deleting ? 'מוחק...' : 'כן, מחק'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
