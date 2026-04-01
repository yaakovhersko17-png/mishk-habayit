import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, cached, withRetry } from '../lib/supabase'
import { Search, Download, FileText, ChevronUp, ChevronDown } from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

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

  useEffect(() => { load() }, [])

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

  // Filter
  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    if (q && !inv.business_name?.toLowerCase().includes(q)) return false
    if (dateFrom && inv.date < dateFrom) return false
    if (dateTo   && inv.date > dateTo)   return false
    if (filterCat    && inv.category_id !== filterCat)    return false
    if (filterWallet && inv.wallet_id   !== filterWallet) return false
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let va, vb
    if (sortBy === 'date')   { va = a.date; vb = b.date }
    if (sortBy === 'total')  { va = Number(a.total); vb = Number(b.total) }
    if (sortBy === 'name')   { va = a.business_name || ''; vb = b.business_name || '' }
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
      <button onClick={() => toggleSort(field)} style={{background:'none',border:'none',cursor:'pointer',color:active?'#a78bfa':'#64748b',fontSize:'0.75rem',display:'flex',alignItems:'center',gap:'0.25rem',padding:'0.25rem 0.5rem',borderRadius:'0.375rem',fontWeight:active?600:400}}>
        {label}
        {active ? (sortDir==='asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>) : null}
      </button>
    )
  }

  async function exportPDF() {
    try {
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
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>ארכיון חשבוניות</h1>
        <div style={{display:'flex',gap:'0.5rem'}}>
          <button className="btn-ghost" onClick={exportPDF} style={{fontSize:'0.8rem',padding:'0.4rem 0.875rem'}}><FileText size={14}/>PDF</button>
          <button className="btn-ghost" onClick={exportExcel} style={{fontSize:'0.8rem',padding:'0.4rem 0.875rem'}}><Download size={14}/>Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="page-card" style={{padding:'1rem'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.625rem'}}>
          <div style={{position:'relative'}}>
            <Search size={13} style={{position:'absolute',right:'0.625rem',top:'50%',transform:'translateY(-50%)',color:'#64748b'}}/>
            <input className="input-field" style={{paddingRight:'2rem',fontSize:'0.8rem'}} placeholder="שם עסק..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div style={{position:'relative'}}>
            <Search size={13} style={{position:'absolute',right:'0.625rem',top:'50%',transform:'translateY(-50%)',color:'#64748b'}}/>
            <input className="input-field" style={{paddingRight:'2rem',fontSize:'0.8rem'}} placeholder="שם מוצר..." value={searchItem} onChange={e=>setSearchItem(e.target.value)}/>
          </div>
          <input className="input-field" type="date" style={{fontSize:'0.8rem'}} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} dir="ltr" placeholder="מתאריך"/>
          <input className="input-field" type="date" style={{fontSize:'0.8rem'}} value={dateTo}   onChange={e=>setDateTo(e.target.value)}   dir="ltr" placeholder="עד תאריך"/>
          <select className="input-field" style={{fontSize:'0.8rem'}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="">כל הקטגוריות</option>
            {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select className="input-field" style={{fontSize:'0.8rem'}} value={filterWallet} onChange={e=>setFilterWallet(e.target.value)}>
            <option value="">כל הארנקים</option>
            {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'0.25rem',marginTop:'0.625rem',flexWrap:'wrap'}}>
          <span style={{fontSize:'0.75rem',color:'#64748b',marginLeft:'0.5rem'}}>מיון:</span>
          <SortBtn field="date"  label="תאריך"/>
          <SortBtn field="total" label="סכום"/>
          <SortBtn field="name"  label="שם עסק"/>
        </div>
      </div>

      <div style={{fontSize:'0.8rem',color:'#64748b'}}>{sorted.length} חשבוניות</div>

      {sorted.length === 0
        ? <EmptyState icon="🧾" title="אין חשבוניות" subtitle="סרוק חשבונית ראשונה בעמוד סריקת חשבונית"/>
        : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'1rem'}}>
            {sorted.map(inv => (
              <div key={inv.id} className="stat-card" style={{cursor:'pointer'}} onClick={()=>openInvoice(inv)}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
                  <div style={{fontSize:'1.5rem'}}>🧾</div>
                  <span style={{fontSize:'0.75rem',color:'#64748b'}}>{inv.date}</span>
                </div>
                <div style={{fontWeight:600,color:'#e2e8f0',marginBottom:'0.25rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.business_name || 'לא ידוע'}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'0.5rem'}}>
                  <span style={{fontSize:'0.75rem',color:'#64748b'}}>{inv.categories ? `${inv.categories.icon||''} ${inv.categories.name}` : ''}</span>
                  <span style={{fontWeight:700,color:'#e2e8f0'}}>{inv.currency||'₪'}{Number(inv.total||0).toLocaleString()}</span>
                </div>
                {inv.wallets && <div style={{fontSize:'0.75rem',color:'#475569',marginTop:'0.25rem'}}>💳 {inv.wallets.name}</div>}
              </div>
            ))}
          </div>
        )
      }

      <Modal open={!!selected} onClose={()=>setSelected(null)} title={selected?.business_name || 'חשבונית'} size="lg">
        {selected && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
              {[['תאריך',selected.date],['סה"כ',`${selected.currency||'₪'}${Number(selected.total||0).toLocaleString()}`],['מע"מ',`${selected.currency||'₪'}${Number(selected.vat||0).toLocaleString()}`],['נסרק ע"י',selected.profiles?.name||'—']].map(([l,v])=>(
                <div key={l} style={{padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(255,255,255,0.04)'}}>
                  <div style={{fontSize:'0.75rem',color:'#64748b',marginBottom:'0.25rem'}}>{l}</div>
                  <div style={{fontWeight:600,color:'#e2e8f0'}}>{v}</div>
                </div>
              ))}
            </div>
            {selected.raw_data?.rawText && (
              <div style={{padding:'0.75rem',borderRadius:'0.75rem',background:'rgba(0,0,0,0.2)',fontSize:'0.75rem',color:'#64748b',whiteSpace:'pre-wrap',direction:'ltr',maxHeight:120,overflowY:'auto',fontFamily:'monospace'}}>
                {selected.raw_data.rawText.slice(0, 400)}{selected.raw_data.rawText.length > 400 ? '...' : ''}
              </div>
            )}
            {items.length > 0 && (
              <div>
                <h3 style={{margin:'0 0 0.75rem',fontSize:'0.875rem',fontWeight:600,color:'#94a3b8'}}>פריטים</h3>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                      {['פריט','כמות','מחיר','סה"כ','קטגוריה'].map(h=><th key={h} style={{padding:'0.5rem',textAlign:'right',fontSize:'0.75rem',color:'#64748b'}}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item=>(
                      <tr key={item.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                        <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',color:'#e2e8f0'}}>{item.name}</td>
                        <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',color:'#94a3b8'}}>×{item.quantity}</td>
                        <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',color:'#94a3b8'}}>₪{Number(item.price).toFixed(2)}</td>
                        <td style={{padding:'0.625rem 0.5rem',fontSize:'0.85rem',fontWeight:600,color:'#e2e8f0'}}>₪{(Number(item.price)*Number(item.quantity)).toFixed(2)}</td>
                        <td style={{padding:'0.625rem 0.5rem',fontSize:'0.8rem',color:'#a78bfa'}}>{item.categories ? `${item.categories.icon||''} ${item.categories.name}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
