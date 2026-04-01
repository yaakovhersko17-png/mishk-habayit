import { useEffect, useState } from 'react'
import { supabase, cached, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BarChart2, FileText, Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function Reports() {
  const { user, profile } = useAuth()
  const [txs, setTxs]         = useState([])
  const [wallets, setWallets] = useState([])
  const [cats, setCats]       = useState([])
  const [profiles, setProfs]  = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [dateTo, setDateTo]   = useState(new Date().toISOString().split('T')[0])
  const [filterCat, setFilterCat] = useState('')
  const [filterWallet, setFilterWallet] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => { loadBase() }, [])

  async function loadBase() {
    const [{ data: tData }, { data: wData }, { data: cData }, { data: pData }] = await Promise.all([
      withRetry(() => supabase.from('transactions').select('*,categories(name),wallets(name),profiles(name)').order('date', { ascending: false })),
      withRetry(() => supabase.from('wallets').select('*')),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
      cached('profiles', () => supabase.from('profiles').select('*'), 120_000),
    ])
    setTxs(tData || [])
    setWallets(wData || [])
    setCats(cData || [])
    setProfs(pData || [])
    setLoading(false)
  }

  const filtered = txs.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false
    if (filterCat && t.category_id !== filterCat) return false
    if (filterWallet && t.wallet_id !== filterWallet) return false
    if (filterUser && t.user_id !== filterUser) return false
    if (filterType && t.type !== filterType) return false
    return true
  })

  const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net     = income - expense

  // group by category for chart
  const catMap = {}
  filtered.filter(t => t.type === 'expense').forEach(t => {
    const name = t.categories?.name || 'אחר'
    catMap[name] = (catMap[name] || 0) + Number(t.amount)
  })
  const chartData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8)

  async function exportPDF() {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      doc.setFont('helvetica')
      doc.setFontSize(16)
      doc.text('Mishk HaBayit - Report', 105, 20, { align: 'center' })
      doc.setFontSize(11)
      doc.text(`${dateFrom} - ${dateTo}`, 105, 28, { align: 'center' })
      doc.setFontSize(10)
      doc.text(`Income: ${income.toFixed(2)} | Expenses: ${expense.toFixed(2)} | Net: ${net.toFixed(2)}`, 105, 36, { align: 'center' })
      autoTable(doc, {
        startY: 44,
        head: [['Date','Description','Amount','Category','Wallet','User','Type']],
        body: filtered.map(t => [
          t.date,
          t.description,
          `${t.currency}${Number(t.amount).toFixed(2)}`,
          t.categories?.name || '-',
          t.wallets?.name || '-',
          t.profiles?.name || '-',
          t.type,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [108, 99, 255] },
      })
      doc.text('\u26A1 Built by Y.Hershko \u26A1', 105, doc.internal.pageSize.height - 8, { align: 'center' })
      doc.save(`report-${dateFrom}-${dateTo}.pdf`)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.EXPORT, entityType:ENTITY_TYPES.REPORT, description:`ייצא/ה דוח PDF: ${dateFrom} – ${dateTo}` })
      toast.success('PDF יוצא!')
    } catch (err) {
      console.error('PDF export failed:', err)
      toast.error('שגיאה בייצוא PDF')
    }
  }

  async function exportExcel() {
    try {
      const rows = filtered.map(t => ({
        תאריך: t.date, תיאור: t.description,
        סכום: Number(t.amount), מטבע: t.currency,
        קטגוריה: t.categories?.name || '', ארנק: t.wallets?.name || '',
        משתמש: t.profiles?.name || '', סוג: t.type,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'דוח')
      XLSX.writeFile(wb, `report-${dateFrom}-${dateTo}.xlsx`)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.EXPORT, entityType:ENTITY_TYPES.REPORT, description:`ייצא/ה דוח Excel: ${dateFrom} – ${dateTo}` })
      toast.success('Excel יוצא!')
    } catch (err) {
      console.error('Excel export failed:', err)
      toast.error('שגיאה בייצוא Excel')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>דוחות וייצוא</h1>

      {/* Filters */}
      <div className="page-card">
        <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>סינון</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'0.75rem'}}>
          <div>
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>מתאריך</label>
            <input className="input-field" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} dir="ltr"/>
          </div>
          <div>
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>עד תאריך</label>
            <input className="input-field" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} dir="ltr"/>
          </div>
          <div>
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>קטגוריה</label>
            <select className="input-field" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="">הכל</option>
              {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>ארנק</label>
            <select className="input-field" value={filterWallet} onChange={e=>setFilterWallet(e.target.value)}>
              <option value="">הכל</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>משתמש</label>
            <select className="input-field" value={filterUser} onChange={e=>setFilterUser(e.target.value)}>
              <option value="">הכל</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>סוג</label>
            <select className="input-field" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="">הכל</option>
              <option value="income">הכנסה</option>
              <option value="expense">הוצאה</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem'}}>
        {[['הכנסות','#4ade80',`₪${income.toLocaleString()}`],['הוצאות','#f87171',`₪${expense.toLocaleString()}`],['מאזן',net>=0?'#4ade80':'#f87171',`₪${Math.abs(net).toLocaleString()} ${net>=0?'חיובי':'שלילי'}`]].map(([l,c,v])=>(
          <div key={l} className="stat-card">
            <div style={{fontSize:'0.8rem',color:'#64748b',marginBottom:'0.5rem'}}>{l}</div>
            <div style={{fontSize:'1.5rem',fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="page-card">
          <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>הוצאות לפי קטגוריה</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} width={80}/>
              <Tooltip contentStyle={{background:'#1e1e3a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.75rem',color:'#e2e8f0'}} formatter={v=>`₪${v.toLocaleString()}`}/>
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {chartData.map((_,i)=><Cell key={i} fill={['#6c63ff','#8b5cf6','#4ade80','#60a5fa','#f87171','#fbbf24','#f472b6','#34d399'][i%8]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Export buttons */}
      <div style={{display:'flex',gap:'1rem'}}>
        <button className="btn-primary" onClick={exportPDF} style={{flex:1,justifyContent:'center',padding:'0.875rem'}}>
          <FileText size={16}/>ייצוא PDF
        </button>
        <button className="btn-ghost" onClick={exportExcel} style={{flex:1,justifyContent:'center',padding:'0.875rem'}}>
          <Download size={16}/>ייצוא Excel
        </button>
      </div>

      {/* Table preview */}
      <div className="page-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'1rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{fontSize:'0.875rem',color:'#94a3b8'}}>{filtered.length} רשומות</span>
        </div>
        <div style={{overflowX:'auto',maxHeight:400}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead style={{position:'sticky',top:0,background:'#1a1a2e'}}>
              <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                {['תאריך','תיאור','סכום','קטגוריה','משתמש','סוג'].map(h=>(
                  <th key={h} style={{padding:'0.75rem 1rem',textAlign:'right',fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t=>(
                <tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                  <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#64748b'}}>{t.date}</td>
                  <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#e2e8f0',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                  <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',fontWeight:600,color:t.type==='income'?'#4ade80':'#f87171'}}>{t.currency}{Number(t.amount).toLocaleString()}</td>
                  <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.categories?.name||'—'}</td>
                  <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.profiles?.name||'—'}</td>
                  <td style={{padding:'0.625rem 1rem'}}><span className={t.type==='income'?'badge-income':'badge-expense'} style={{fontSize:'0.7rem'}}>{t.type==='income'?'הכנסה':'הוצאה'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
