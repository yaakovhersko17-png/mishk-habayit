import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

const COLORS = ['#6c63ff','#4ade80','#f87171','#fbbf24','#60a5fa','#f472b6','#a78bfa','#34d399','#fb923c','#94a3b8']
const CURRENCIES = ['₪','$','€','£']

const emptyWallet = { name:'', balance:'', currency:'₪', icon:'', color:'#6c63ff' }

export default function Wallets() {
  const { user, profile } = useAuth()
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(emptyWallet)
  const [saving, setSaving]   = useState(false)
  const [historyWallet, setHistoryWallet] = useState(null)
  const [walletTxs, setWalletTxs] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('wallets').select('*').order('created_at')
    setWallets(data || [])
    setLoading(false)
  }

  async function openHistory(w) {
    setHistoryWallet(w)
    const [{ data: outData }, { data: inData }] = await Promise.all([
      supabase.from('transactions').select('*,categories(name,icon)').eq('wallet_id', w.id).order('date', { ascending: false }).limit(50),
      supabase.from('transactions').select('*,categories(name,icon)').eq('to_wallet_id', w.id).eq('type', 'transfer').order('date', { ascending: false }).limit(25)
    ])
    const merged = [
      ...(outData || []).map(t => ({ ...t, _dir: 'out' })),
      ...(inData || []).map(t => ({ ...t, _dir: 'in' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50)
    setWalletTxs(merged)
  }

  function openAdd()  { setEditing(null); setForm(emptyWallet); setModal(true) }
  function openEdit(w){ setEditing(w); setForm({ name:w.name, balance:w.balance, currency:w.currency, icon:w.icon, color:w.color }); setModal(true) }

  async function handleSave() {
    if (!form.name) { toast.error('שם ארנק נדרש'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('wallets').update({ ...form, balance: Number(form.balance), updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) { toast.error('שגיאה'); setSaving(false); return }
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.UPDATE, entityType:ENTITY_TYPES.WALLET, description:`עדכן/ה ארנק: ${form.name}`, entityId:editing.id })
      toast.success('ארנק עודכן')
    } else {
      const { error } = await supabase.from('wallets').insert({ ...form, balance: Number(form.balance), created_by: user.id })
      if (error) { toast.error('שגיאה'); setSaving(false); return }
      await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.CREATE, entityType:ENTITY_TYPES.WALLET, description:`הוסיף/ה ארנק: ${form.name}` })
      toast.success('ארנק נוסף!')
    }
    setModal(false); load(); setSaving(false)
  }

  async function handleDelete(w) {
    if (!confirm(`למחוק את הארנק "${w.name}"?`)) return
    await supabase.from('wallets').delete().eq('id', w.id)
    await logActivity({ userId:user.id, userName:profile.name, actionType:ACTION_TYPES.DELETE, entityType:ENTITY_TYPES.WALLET, description:`מחק/ה ארנק: ${w.name}`, entityId:w.id })
    toast.success('ארנק נמחק')
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>ארנקים</h1>
          <p style={{margin:'0.25rem 0 0',color:'#64748b',fontSize:'0.875rem'}}>{wallets.length} ארנקים</p>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={15}/>ארנק חדש</button>
      </div>

      {wallets.length === 0
        ? <EmptyState icon="💳" title="אין ארנקים עדיין" subtitle="הוסף ארנק ראשון כדי להתחיל" action={<button className="btn-primary" onClick={openAdd}><Plus size={14}/>הוסף ארנק</button>}/>
        : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'1rem'}}>
            {wallets.map(w => (
              <div key={w.id} className="stat-card" style={{position:'relative',overflow:'hidden',cursor:'pointer'}} onClick={()=>openHistory(w)}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:4,background:w.color}}/>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1rem',paddingTop:'0.5rem'}}>
                  <div style={{fontSize:'2rem'}}>{w.icon}</div>
                  <div style={{display:'flex',gap:'0.375rem'}}>
                    <button onClick={e => { e.stopPropagation(); openEdit(w) }} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'0.25rem',borderRadius:'0.5rem'}}><Edit2 size={14}/></button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(w) }} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem',borderRadius:'0.5rem'}}><Trash2 size={14}/></button>
                  </div>
                </div>
                <div style={{fontSize:'0.85rem',color:'#94a3b8',marginBottom:'0.375rem'}}>{w.name}</div>
                <div style={{fontSize:'1.75rem',fontWeight:700,color:'#e2e8f0'}}>{w.currency}{Number(w.balance).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )
      }

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך ארנק' : 'ארנק חדש'}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>שם הארנק</label>
            <input className="input-field" placeholder="למשל: עוש, מזומן..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>
          <div className="form-2col">
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>יתרה</label>
              <input className="input-field" type="number" placeholder="0.00" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} dir="ltr"/>
            </div>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>מטבע</label>
              <select className="input-field" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.5rem'}}>אייקון</label>
            <input className="input-field" value={form.icon} onChange={e=>setForm({...form,icon:e.target.value})} placeholder="לחץ להוספת אמוג׳י 😀" style={{fontSize:'1.5rem',textAlign:'center'}}/>
          </div>
          <div>
            <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.5rem'}}>צבע</label>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
              {COLORS.map(c => (
                <button key={c} onClick={()=>setForm({...form,color:c})} style={{width:28,height:28,borderRadius:'50%',background:c,border:`3px solid ${form.color===c?'#fff':'transparent'}`,cursor:'pointer',boxShadow:form.color===c?`0 0 8px ${c}`:'none'}}/>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end',marginTop:'0.5rem'}}>
            <button className="btn-ghost" onClick={()=>setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'שומר...':'שמור'}</button>
          </div>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal open={!!historyWallet} onClose={()=>setHistoryWallet(null)} title={historyWallet ? `היסטוריה – ${historyWallet.icon} ${historyWallet.name}` : ''} size="lg">
        {walletTxs.length === 0
          ? <p style={{textAlign:'center',color:'#64748b',padding:'2rem 0'}}>אין עסקאות לארנק זה</p>
          : <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:'400px'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                    {['תאריך','תיאור','סכום','קטגוריה'].map(h=><th key={h} style={{padding:'0.625rem 0.75rem',textAlign:'right',fontSize:'0.75rem',color:'#64748b',fontWeight:500}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {walletTxs.map(t=>(
                    <tr key={`${t.id}_${t._dir}`} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8rem',color:'#64748b',whiteSpace:'nowrap'}}>{new Date(t.date).toLocaleDateString('he-IL')}</td>
                      <td style={{padding:'0.625rem 0.75rem',fontSize:'0.85rem',color:'#e2e8f0'}}>{t.description}</td>
                      <td style={{padding:'0.625rem 0.75rem',fontWeight:600,whiteSpace:'nowrap',color:t.type==='income'?'#4ade80':t.type==='transfer'?'#22d3ee':t.type.startsWith('loan')?'#fbbf24':'#f87171'}}>{t.type==='income'?'+':t.type==='transfer'?(t._dir==='in'?'+↔':'-↔'):t.type.startsWith('loan')?'':'-'}{t.currency}{Number(t.amount).toLocaleString()}</td>
                      <td style={{padding:'0.625rem 0.75rem',fontSize:'0.8rem',color:'#94a3b8'}}>{t.categories ? `${t.categories.icon||''} ${t.categories.name}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Modal>
    </div>
  )
}
