import { useEffect, useState } from 'react'
import { supabase, cached, withRetry } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { FileText, Download } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const COLORS = ['#6c63ff','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#a78bfa','#34d399']

const TABS = [
  { id: 'overview',  label: '📊 סקירה כללית' },
  { id: 'trend',     label: '📈 מגמה' },
  { id: 'cashflow',  label: '💰 תזרים מזומנים' },
  { id: 'pnl',       label: '📉 רווח והפסד' },
]

export default function Reports() {
  const { user, profile } = useAuth()
  const [txs, setTxs]         = useState([])
  const [wallets, setWallets] = useState([])
  const [cats, setCats]       = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [dateTo, setDateTo]   = useState(new Date().toISOString().split('T')[0])
  const [filterCat, setFilterCat] = useState('')
  const [filterWallet, setFilterWallet] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => { loadBase() }, [])

  async function loadBase() {
    const [{ data: tData }, { data: wData }, { data: cData }] = await Promise.all([
      withRetry(() => supabase.from('transactions').select('*,categories(name,color),wallets(name),profiles(name)').order('date', { ascending: false })),
      withRetry(() => supabase.from('wallets').select('*')),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
    ])
    setTxs(tData || [])
    setWallets(wData || [])
    setCats(cData || [])
    setLoading(false)
  }

  const filtered = txs.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false
    if (filterCat && t.category_id !== filterCat) return false
    if (filterWallet && t.wallet_id !== filterWallet) return false
    if (filterType && t.type !== filterType) return false
    return true
  })

  const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const net     = income - expense

  // Overview: pie by category
  const catMap = {}
  filtered.filter(t => t.type === 'expense').forEach(t => {
    const name = t.categories?.name || 'אחר'
    catMap[name] = (catMap[name] || 0) + Number(t.amount)
  })
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)

  // Trend: last 6 months
  const now = new Date()
  const trendData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })
    const mTxs = txs.filter(t => { const td = new Date(t.date); return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() })
    trendData.push({
      name: label,
      הכנסות: mTxs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0),
      הוצאות: mTxs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0),
    })
  }

  // P&L: net per month
  const pnlData = trendData.map(m => ({
    name: m.name,
    מאזן: m['הכנסות'] - m['הוצאות'],
  }))

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
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
        head: [['Date','Description','Amount','Category','Wallet','Type']],
        body: filtered.map(t => [
          t.date, t.description,
          `${t.currency}${Number(t.amount).toFixed(2)}`,
          t.categories?.name || '-', t.wallets?.name || '-', t.type,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [108, 99, 255] },
      })
      doc.save(`report-${dateFrom}-${dateTo}.pdf`)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.EXPORT, entityType:ENTITY_TYPES.REPORT, description:`ייצא/ה דוח PDF: ${dateFrom} – ${dateTo}` })
      toast.success('PDF יוצא!')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בייצוא PDF')
    }
  }

  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const rows = filtered.map(t => ({
        תאריך: t.date, תיאור: t.description,
        סכום: Number(t.amount), מטבע: t.currency,
        קטגוריה: t.categories?.name || '', ארנק: t.wallets?.name || '', סוג: t.type,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'דוח')
      XLSX.writeFile(wb, `report-${dateFrom}-${dateTo}.xlsx`)
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.EXPORT, entityType:ENTITY_TYPES.REPORT, description:`ייצא/ה דוח Excel: ${dateFrom} – ${dateTo}` })
      toast.success('Excel יוצא!')
    } catch (err) {
      console.error(err)
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.75rem'}}>
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
            <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>סוג</label>
            <select className="input-field" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="">הכל</option>
              <option value="income">הכנסה</option>
              <option value="expense">הוצאה</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem'}}>
        {[['הכנסות','#4ade80',`₪${income.toLocaleString()}`],['הוצאות','#f87171',`₪${expense.toLocaleString()}`],['מאזן',net>=0?'#4ade80':'#f87171',`₪${Math.abs(net).toLocaleString()} ${net>=0?'חיובי':'שלילי'}`]].map(([l,c,v])=>(
          <div key={l} className="stat-card">
            <div style={{fontSize:'0.8rem',color:'#64748b',marginBottom:'0.5rem'}}>{l}</div>
            <div style={{fontSize:'1.4rem',fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'0.5rem',borderBottom:'1px solid rgba(255,255,255,0.06)',flexWrap:'wrap'}}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding:'0.625rem 1.1rem',
              fontSize:'0.85rem',
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#a78bfa' : '#64748b',
              background:'none',
              border:'none',
              borderBottom: activeTab === tab.id ? '2px solid #a78bfa' : '2px solid transparent',
              cursor:'pointer',
              transition:'all 0.15s',
              marginBottom:'-1px',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tab: סקירה כללית */}
      {activeTab === 'overview' && (
        pieData.length > 0 ? (
          <div className="page-card">
            <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>הוצאות לפי קטגוריה</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',alignItems:'center'}}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" nameKey="name">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#1e1e3a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.75rem',color:'#e2e8f0'}} formatter={v=>`₪${v.toLocaleString()}`}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {pieData.map((d,i) => (
                  <div key={d.name} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8rem'}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>
                    <span style={{color:'#94a3b8',flex:1}}>{d.name}</span>
                    <span style={{color:'#e2e8f0',fontWeight:600}}>₪{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="page-card" style={{textAlign:'center',color:'#475569',padding:'2rem'}}>אין הוצאות בטווח הזמן הנבחר</div>
        )
      )}

      {/* Tab: מגמה */}
      {activeTab === 'trend' && (
        <div className="page-card">
          <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>הכנסות vs הוצאות – 6 חודשים אחרונים</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <XAxis dataKey="name" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} width={55}/>
              <Tooltip contentStyle={{background:'#1e1e3a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.75rem',color:'#e2e8f0'}} formatter={v=>`₪${v.toLocaleString()}`}/>
              <Legend wrapperStyle={{fontSize:'0.8rem',color:'#94a3b8'}}/>
              <Line type="monotone" dataKey="הכנסות" stroke="#4ade80" strokeWidth={2.5} dot={{r:4,fill:'#4ade80'}}/>
              <Line type="monotone" dataKey="הוצאות" stroke="#f87171" strokeWidth={2.5} dot={{r:4,fill:'#f87171'}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tab: תזרים מזומנים */}
      {activeTab === 'cashflow' && (
        <div className="page-card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'1rem',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'0.875rem',color:'#94a3b8',fontWeight:600}}>תזרים מזומנים</span>
            <span style={{fontSize:'0.8rem',color:'#64748b'}}>{filtered.length} רשומות</span>
          </div>
          <div style={{overflowX:'auto',maxHeight:480}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead style={{position:'sticky',top:0,background:'#1a1a2e'}}>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  {['תאריך','תיאור','סכום','קטגוריה','ארנק','סוג'].map(h=>(
                    <th key={h} style={{padding:'0.75rem 1rem',textAlign:'right',fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t=>(
                  <tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#64748b'}}>{t.date}</td>
                    <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#e2e8f0',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                    <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',fontWeight:600,color:t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type.startsWith('loan')?'#fbbf24':'#f87171'}}>
                      {t.type==='income'?'+':t.type==='transfer'?'↔':'-'}{t.currency}{Number(t.amount).toLocaleString()}
                    </td>
                    <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.categories?.name||'—'}</td>
                    <td style={{padding:'0.625rem 1rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.wallets?.name||'—'}</td>
                    <td style={{padding:'0.625rem 1rem'}}>
                      <span style={{fontSize:'0.7rem',padding:'0.2rem 0.5rem',borderRadius:'0.375rem',
                        background:t.type==='income'?'#4ade8020':t.type==='transfer'?'#22d3ee20':t.type.startsWith('loan')?'#fbbf2420':'#f8717120',
                        color:t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type.startsWith('loan')?'#fbbf24':'#f87171'}}>
                        {t.type==='income'?'הכנסה':t.type==='transfer'?'↔ מארנק לארנק':t.type.startsWith('loan')?'הלוואה':'הוצאה'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: רווח והפסד */}
      {activeTab === 'pnl' && (
        <div className="page-card">
          <h3 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>רווח והפסד – 6 חודשים אחרונים</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pnlData}>
              <XAxis dataKey="name" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} width={55}/>
              <Tooltip contentStyle={{background:'#1e1e3a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'0.75rem',color:'#e2e8f0'}} formatter={v=>`₪${v.toLocaleString()}`}/>
              <Bar dataKey="מאזן" radius={[4,4,0,0]}>
                {pnlData.map((d,i) => <Cell key={i} fill={d['מאזן'] >= 0 ? '#4ade80' : '#f87171'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{marginTop:'1rem',display:'flex',gap:'1rem',justifyContent:'center',fontSize:'0.8rem',color:'#64748b'}}>
            <span><span style={{color:'#4ade80'}}>■</span> רווח</span>
            <span><span style={{color:'#f87171'}}>■</span> הפסד</span>
          </div>
        </div>
      )}

      {/* Export */}
      <div style={{display:'flex',gap:'1rem'}}>
        <button className="btn-primary" onClick={exportPDF} style={{flex:1,justifyContent:'center',padding:'0.875rem'}}>
          <FileText size={16}/>ייצוא PDF
        </button>
        <button className="btn-ghost" onClick={exportExcel} style={{flex:1,justifyContent:'center',padding:'0.875rem'}}>
          <Download size={16}/>ייצוא Excel
        </button>
      </div>
    </div>
  )
}
