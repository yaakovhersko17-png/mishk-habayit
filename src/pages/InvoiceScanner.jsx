import { useState } from 'react'
import { supabase, cached, withRetry, rateLimited } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, Camera, ScanLine, Check, X, Plus, Trash2, AlertCircle } from 'lucide-react'
import AddTransactionSheet from '../components/AddTransactionSheet'
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from '../lib/activityLogger'
import toast from 'react-hot-toast'

/* ─── Category suggestion ────────────────────────────────────────── */
const CATEGORY_HINTS = [
  { words: ['לחם','חלב','גבינ','ביצ','בשר','עוף','ירק','פרי','קמח','שמן','סוכר','מלח','אורז','פסטה','שוקולד','קפה','תה','יוגורט','שמנת','חמאה','מיץ'], cat: 'מזון' },
  { words: ['דלק','חנייה','אוטובוס','רכבת','מונית','תחבורה'], cat: 'תחבורה' },
  { words: ['תרופה','רופא','מרפאה','בית מרקחת','ויטמין','בריאות'], cat: 'בריאות' },
  { words: ['חולצה','מכנס','שמלה','נעל','ג׳ינס','ביגוד','אופנה'], cat: 'ביגוד' },
  { words: ['ניקוי','ספוגית','שקית','מגבת','סבון','חומר ניקוי','בית'], cat: 'בית' },
  { words: ['קולנוע','סרט','ספר','משחק','בידור','מסעדה','קפה'], cat: 'בידור' },
  { words: ['ספרים','קורס','לימוד','חינוך'], cat: 'חינוך' },
]

function suggestCategory(itemName, categories) {
  const lower = (itemName || '').toLowerCase()
  for (const { words, cat } of CATEGORY_HINTS) {
    if (words.some(w => lower.includes(w))) {
      const found = categories.find(c => c.name.includes(cat))
      if (found) return found.id
    }
  }
  return ''
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function InvoiceScanner() {
  const { user, profile } = useAuth()
  const [step, setStep]               = useState('upload') // upload | analyzing | not_invoice | review | done
  const [file, setFile]               = useState(null)
  const [preview, setPreview]         = useState(null)
  const [result, setResult]           = useState(null)
  const [saving, setSaving]           = useState(false)
  const [wallets, setWallets]         = useState([])
  const [categories, setCats]         = useState([])
  const [selectedWallet, setSelectedWallet] = useState('')
  const [scanProgress, setScanProgress] = useState(0)
  const [txSheet, setTxSheet]         = useState(false)

  function onFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  async function analyzeInvoice() {
    if (!file) { toast.error('בחר קובץ קודם'); return }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('הקובץ גדול מדי — מקסימום 10MB')
      return
    }

    setStep('analyzing')
    setScanProgress(0)

    // Rate limit: max 5 scans per minute
    const rlCheck = await rateLimited('invoice-scan', async () => ({ data: true, error: null }), 5, 60_000)
    if (rlCheck.error) { toast.error(rlCheck.error.message); setStep('upload'); return }

    const [{ data: wData }, { data: cData }] = await Promise.all([
      withRetry(() => supabase.from('wallets').select('*')),
      cached('categories', () => supabase.from('categories').select('*'), 120_000),
    ])
    setWallets(wData || [])
    setCats(cData || [])

    try {
      setScanProgress(15)

      // Convert file to base64 for Gemini
      const base64 = await fileToBase64(file)
      setScanProgress(35)

      // Call Gemini via Supabase Edge Function (API key stays server-side)
      const { data, error: fnError } = await supabase.functions.invoke('scan-invoice', {
        body: { image: base64, mimeType: file.type || 'image/jpeg' },
      })
      setScanProgress(90)

      if (fnError) throw new Error('שגיאה בקריאה לפונקציה: ' + fnError.message)

      if (data?.error === 'not_invoice') {
        await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.SCAN, entityType: ENTITY_TYPES.INVOICE, description: `ניסיון סריקה (לא חשבונית): ${file.name}` })
        setStep('not_invoice')
        return
      }

      if (data?.error === 'not_configured') throw new Error('מפתח Gemini לא מוגדר בשרת')
      if (data?.error === 'gemini_api_error') throw new Error(`Gemini API שגיאה ${data.status}: ${data.message?.slice(0,120)}`)
      if (data?.error) throw new Error('שגיאה: ' + (data.message || data.error))

      const parsed = {
        business_name:  String(data.business_name || ''),
        date:           data.date || new Date().toISOString().split('T')[0],
        invoice_number: data.invoice_number || null,
        total:          Number(data.total)  || 0,
        vat:            Number(data.vat)    || 0,
        currency:       String(data.currency || '₪'),
        items: (data.items || []).map(item => ({
          name:        String(item.name || ''),
          quantity:    Number(item.quantity) || 1,
          price:       Number(item.price)    || 0,
          category_id: suggestCategory(item.name, cData || []),
        })).slice(0, 30),
      }

      await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.SCAN, entityType: ENTITY_TYPES.INVOICE, description: `סרק/ה חשבונית: ${file.name}` })

      setResult(parsed)
      setStep('review')
      setScanProgress(100)
      if (parsed.total === 0) toast('לא זוהה סכום — בדוק ידנית', { icon: '⚠️' })
    } catch (err) {
      console.error('Gemini scan failed:', err)
      toast.error('שגיאה בניתוח: ' + (err.message || 'נסה שוב'))
      setStep('not_invoice')
    }
  }

  function enterManual() {
    setResult({ business_name: '', date: new Date().toISOString().split('T')[0], total: 0, vat: 0, currency: '₪', items: [] })
    setStep('review')
  }

  function updateItem(i, field, value) {
    setResult(r => ({ ...r, items: r.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) }))
  }
  function removeItem(i) {
    setResult(r => ({ ...r, items: r.items.filter((_, idx) => idx !== i) }))
  }
  function addItem() {
    setResult(r => ({ ...r, items: [...r.items, { name: '', quantity: 1, price: 0, category_id: '' }] }))
  }

  async function saveInvoice() {
    if (!result) return
    if (!selectedWallet) { toast.error('חובה לבחור ארנק'); return }
    setSaving(true)

    let imageUrl = null
    if (file) {
      const ext  = file.name.split('.').pop()
      const path = `invoices/${user.id}/${Date.now()}.${ext}`
      const { data: storageData } = await supabase.storage.from('invoices').upload(path, file, { upsert: true })
      if (storageData) {
        const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(path)
        imageUrl = publicUrl
      }
    }

    const { data: invoice, error } = await withRetry(() => supabase.from('invoices').insert({
      business_name: result.business_name,
      date:          result.date,
      total:         result.total,
      vat:           result.vat,
      currency:      result.currency,
      wallet_id:     selectedWallet,
      scanned_by:    user.id,
      image_url:     imageUrl,
      raw_data:      result,
    }).select().single())

    if (error) { toast.error('שגיאה בשמירה'); setSaving(false); return }

    const validItems = result.items.filter(it => it.name && Number(it.price) > 0)
    if (validItems.length > 0) {
      await supabase.from('invoice_items').insert(validItems.map(item => ({
        invoice_id:  invoice.id,
        name:        item.name,
        quantity:    Number(item.quantity) || 1,
        price:       Number(item.price),
        category_id: item.category_id || null,
      })))
    }

    const { data: wallet } = await supabase.from('wallets').select('balance').eq('id', selectedWallet).single()
    await supabase.from('transactions').insert({
      type:        'expense',
      description: result.business_name || 'חשבונית סרוקה',
      amount:      result.total,
      currency:    result.currency,
      wallet_id:   selectedWallet,
      user_id:     user.id,
      date:        result.date,
      notes:       'חשבונית סרוקה',
      invoice_id:  invoice.id,
    })
    if (wallet) {
      await supabase.from('wallets').update({ balance: wallet.balance - result.total }).eq('id', selectedWallet)
    }

    await logActivity({ userId: user.id, userName: profile.name, actionType: ACTION_TYPES.CREATE, entityType: ENTITY_TYPES.INVOICE, description: `שמר/ה חשבונית: ${result.business_name} – ₪${result.total}`, entityId: invoice.id })
    toast.success('חשבונית נשמרה!')
    setStep('done')
    setSaving(false)
  }

  function reset() { setStep('upload'); setFile(null); setPreview(null); setResult(null); setScanProgress(0); setSelectedWallet('') }

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'1.5rem',maxWidth:720}}>
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
        <h1 style={{margin:0,fontSize:'1.5rem',fontWeight:700,color:'#e2e8f0'}}>סריקת חשבונית</h1>
        <span style={{fontSize:'0.7rem',padding:'0.2rem 0.6rem',borderRadius:'999px',background:'rgba(108,99,255,0.15)',color:'#a78bfa',border:'1px solid rgba(108,99,255,0.25)',fontWeight:600}}>Gemini AI</span>
      </div>

      {/* STEP: upload */}
      {step === 'upload' && (
        <div className="page-card" style={{textAlign:'center'}}>
          <div style={{fontSize:'3rem',marginBottom:'1rem'}}>✨</div>
          <h2 style={{margin:'0 0 0.5rem',color:'#e2e8f0',fontSize:'1.1rem'}}>העלה חשבונית לניתוח חכם</h2>
          <p style={{color:'#64748b',fontSize:'0.875rem',marginBottom:'2rem'}}>Gemini AI יזהה מוצרים, מחירים ופרטי עסק אוטומטית (JPG, PNG, PDF)</p>

          <div style={{border:'2px dashed rgba(108,99,255,0.3)',borderRadius:'1rem',padding:'2rem',marginBottom:'1.5rem',transition:'all 0.2s',background:'rgba(108,99,255,0.05)'}}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='rgba(108,99,255,0.6)'}}
            onDragLeave={e=>e.currentTarget.style.borderColor='rgba(108,99,255,0.3)'}
            onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f){setFile(f);const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f)}}}>
            {preview
              ? <img src={preview} alt="preview" style={{maxWidth:'100%',maxHeight:220,borderRadius:'0.5rem',objectFit:'contain'}}/>
              : <><Upload size={32} style={{color:'#6c63ff',margin:'0 auto 0.75rem'}}/><p style={{margin:0,color:'#94a3b8',fontSize:'0.875rem'}}>גרור קובץ לכאן</p></>
            }
          </div>

          <div style={{display:'flex',gap:'0.75rem',justifyContent:'center',flexWrap:'wrap'}}>
            <label style={{cursor:'pointer'}}>
              <input type="file" accept="image/*,.pdf" onChange={onFileChange} style={{display:'none'}}/>
              <span className="btn-ghost"><Upload size={15}/>העלה קובץ</span>
            </label>
            <label style={{cursor:'pointer'}}>
              <input type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{display:'none'}}/>
              <span className="btn-ghost"><Camera size={15}/>צלם עכשיו</span>
            </label>
          </div>

          {file && (
            <div style={{marginTop:'1.5rem'}}>
              <div style={{fontSize:'0.85rem',color:'#94a3b8',marginBottom:'0.75rem'}}>✅ {file.name} ({(file.size/1024/1024).toFixed(1)}MB)</div>
              <button className="btn-primary" onClick={analyzeInvoice} style={{width:'100%',justifyContent:'center',padding:'0.875rem',fontSize:'1rem'}}>
                <ScanLine size={16}/>נתח עם Gemini AI
              </button>
            </div>
          )}

          <div style={{marginTop:'1.5rem',paddingTop:'1.25rem',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            <button className="btn-ghost" onClick={enterManual} style={{fontSize:'0.8rem'}}>
              <Plus size={14}/>הזן נתונים ידנית
            </button>
          </div>
        </div>
      )}

      {/* STEP: analyzing */}
      {step === 'analyzing' && (
        <div className="page-card" style={{textAlign:'center',padding:'3rem'}}>
          <div style={{width:56,height:56,borderRadius:'50%',border:'3px solid rgba(108,99,255,0.3)',borderTopColor:'#6c63ff',animation:'spin 1s linear infinite',margin:'0 auto 1.5rem'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <h2 style={{color:'#e2e8f0',margin:'0 0 0.5rem'}}>Gemini AI מנתח את החשבונית...</h2>
          <p style={{color:'#64748b',margin:'0 0 1.5rem',fontSize:'0.875rem'}}>מזהה מוצרים, מחירים ופרטי עסק</p>
          {scanProgress > 0 && (
            <div style={{width:'100%',maxWidth:240,margin:'0 auto'}}>
              <div style={{background:'rgba(255,255,255,0.06)',borderRadius:'999px',height:6,overflow:'hidden'}}>
                <div style={{width:`${scanProgress}%`,height:'100%',background:'linear-gradient(90deg,#6c63ff,#8b5cf6)',transition:'width 0.4s',borderRadius:'999px'}}/>
              </div>
              <div style={{marginTop:'0.5rem',fontSize:'0.8rem',color:'#64748b'}}>{scanProgress}%</div>
            </div>
          )}
        </div>
      )}

      {/* STEP: not_invoice */}
      {step === 'not_invoice' && (
        <div className="page-card" style={{textAlign:'center',padding:'2.5rem',border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.05)'}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.25rem'}}>
            <AlertCircle size={28} color="#f87171"/>
          </div>
          <h2 style={{color:'#f87171',margin:'0 0 0.625rem',fontSize:'1.1rem'}}>לא ניתן לזהות חשבונית</h2>
          <p style={{color:'#94a3b8',fontSize:'0.875rem',margin:'0 0 0.25rem'}}>לא מצאנו נתוני רכישה בתמונה.</p>
          <p style={{color:'#64748b',fontSize:'0.8rem',margin:'0 0 2rem'}}>וודא שהתמונה ברורה ומכילה פרטי עסק וסכומים.</p>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'center',flexWrap:'wrap'}}>
            <button className="btn-ghost" onClick={reset}><ScanLine size={14}/>נסה שוב</button>
            <button className="btn-primary" onClick={enterManual}><Plus size={14}/>הזן נתונים ידנית</button>
          </div>
        </div>
      )}

      {/* STEP: review */}
      {step === 'review' && result && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>

          <div className="page-card">
            <h2 style={{margin:'0 0 1rem',fontSize:'1rem',fontWeight:600,color:'#e2e8f0'}}>✅ בדוק ואשר את הנתונים שזוהו</h2>

            <div style={{marginBottom:'0.75rem'}}>
              <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>שם עסק</label>
              <input className="input-field" value={result.business_name} onChange={e=>setResult({...result,business_name:e.target.value})} placeholder="שם העסק..."/>
            </div>

            {result.invoice_number && (
              <div style={{marginBottom:'0.75rem'}}>
                <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>מספר חשבונית</label>
                <input className="input-field" value={result.invoice_number} onChange={e=>setResult({...result,invoice_number:e.target.value})} dir="ltr"/>
              </div>
            )}

            <div style={{display:'flex',gap:'0.75rem',marginBottom:'0.75rem',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:120}}>
                <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>תאריך</label>
                <input className="input-field" type="date" value={result.date} onChange={e=>setResult({...result,date:e.target.value})} dir="ltr" style={{width:'100%'}}/>
              </div>
              <div style={{flex:1,minWidth:100}}>
                <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>סה"כ לתשלום (₪)</label>
                <input className="input-field" type="number" value={result.total} onChange={e=>setResult({...result,total:Number(e.target.value)})} dir="ltr" style={{width:'100%',border:'1px solid rgba(108,99,255,0.4)'}}/>
              </div>
              <div style={{flex:1,minWidth:80}}>
                <label style={{fontSize:'0.75rem',color:'#64748b',display:'block',marginBottom:'0.25rem'}}>מע"מ (₪)</label>
                <input className="input-field" type="number" value={result.vat} onChange={e=>setResult({...result,vat:Number(e.target.value)})} dir="ltr" style={{width:'100%'}}/>
              </div>
            </div>
          </div>

          <div className="page-card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
              <h2 style={{margin:0,fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>פירוט מוצרים ({result.items.length})</h2>
              <button className="btn-ghost" onClick={addItem} style={{fontSize:'0.8rem',padding:'0.3rem 0.75rem'}}><Plus size={13}/>הוסף שורה</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:580}}>
                <thead>
                  <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                    {['שם מוצר','כמות','מחיר','סה"כ','קטגוריה',''].map(h=>(
                      <th key={h} style={{padding:'0.5rem',textAlign:'right',fontSize:'0.73rem',color:'#64748b',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.length === 0 && (
                    <tr><td colSpan={6} style={{padding:'1.5rem',textAlign:'center',color:'#475569',fontSize:'0.85rem'}}>אין פריטים — לחץ "הוסף שורה"</td></tr>
                  )}
                  {result.items.map((item, i) => (
                    <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                      <td style={{padding:'0.375rem 0.5rem'}}>
                        <input className="input-field" style={{fontSize:'0.8rem',padding:'0.3rem 0.5rem'}} value={item.name} onChange={e=>updateItem(i,'name',e.target.value)} placeholder="שם מוצר"/>
                      </td>
                      <td style={{padding:'0.375rem 0.5rem',width:60}}>
                        <input className="input-field" type="number" style={{fontSize:'0.8rem',padding:'0.3rem 0.5rem',width:'100%'}} value={item.quantity} onChange={e=>updateItem(i,'quantity',Number(e.target.value))} min={1} dir="ltr"/>
                      </td>
                      <td style={{padding:'0.375rem 0.5rem',width:80}}>
                        <input className="input-field" type="number" style={{fontSize:'0.8rem',padding:'0.3rem 0.5rem',width:'100%'}} value={item.price} onChange={e=>updateItem(i,'price',Number(e.target.value))} min={0} step="0.01" dir="ltr"/>
                      </td>
                      <td style={{padding:'0.375rem 0.5rem',width:80}}>
                        <input className="input-field" type="number" style={{fontSize:'0.8rem',padding:'0.3rem 0.5rem',width:'100%'}}
                          value={+(Number(item.price)*Number(item.quantity)).toFixed(2)}
                          onChange={e=>{const total=Number(e.target.value);const qty=Number(item.quantity)||1;updateItem(i,'price',+(total/qty).toFixed(4))}}
                          min={0} step="0.01" dir="ltr"/>
                      </td>
                      <td style={{padding:'0.375rem 0.5rem'}}>
                        <select className="input-field" style={{fontSize:'0.75rem',padding:'0.3rem 0.5rem',minWidth:110}} value={item.category_id||''} onChange={e=>updateItem(i,'category_id',e.target.value)}>
                          <option value="">— קטגוריה</option>
                          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                        {!item.category_id && suggestCategory(item.name, categories) && (
                          <div style={{fontSize:'0.65rem',color:'#a78bfa',marginTop:'0.125rem',cursor:'pointer'}} onClick={()=>updateItem(i,'category_id',suggestCategory(item.name,categories))}>
                            💡 {categories.find(c=>c.id===suggestCategory(item.name,categories))?.name}
                          </div>
                        )}
                      </td>
                      <td style={{padding:'0.375rem 0.5rem'}}>
                        <button onClick={()=>removeItem(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0.25rem',borderRadius:'0.375rem'}}><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-card">
            <h2 style={{margin:'0 0 1rem',fontSize:'0.9rem',fontWeight:600,color:'#94a3b8'}}>שיוך לארנק ושמירה</h2>
            <div>
              <label style={{fontSize:'0.8rem',color:'#94a3b8',display:'block',marginBottom:'0.375rem'}}>ארנק לחיוב <span style={{color:'#f87171'}}>*</span></label>
              <select className="input-field" value={selectedWallet} onChange={e=>setSelectedWallet(e.target.value)}>
                <option value="">בחר ארנק</option>
                {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:'0.75rem',marginTop:'1.25rem'}}>
              <button className="btn-ghost" onClick={reset}><X size={14}/>ביטול</button>
              <button className="btn-ghost" onClick={() => setTxSheet(true)} style={{flexShrink:0}}>
                <Plus size={14}/>הוסף עסקה
              </button>
              <button className="btn-primary" onClick={saveInvoice} disabled={saving||!selectedWallet} style={{flex:1,justifyContent:'center'}}>
                <Check size={14}/>{saving?'שומר...':'שמור חשבונית'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: done */}
      {step === 'done' && (
        <div className="page-card" style={{textAlign:'center',padding:'3rem'}}>
          <div style={{fontSize:'4rem',marginBottom:'1rem'}}>✅</div>
          <h2 style={{color:'#4ade80',margin:'0 0 0.5rem'}}>חשבונית נשמרה בהצלחה!</h2>
          <p style={{color:'#64748b',fontSize:'0.875rem',marginBottom:'2rem'}}>הנתונים נוספו לארכיון, לטרנזקציות ולאחסון</p>
          <div style={{display:'flex',gap:'0.75rem',justifyContent:'center',flexWrap:'wrap'}}>
            <button className="btn-ghost" onClick={() => setTxSheet(true)}>
              <Plus size={14}/>הוסף גם כעסקה
            </button>
            <button className="btn-primary" onClick={reset} style={{justifyContent:'center'}}>
              <ScanLine size={14}/>סרוק חשבונית נוספת
            </button>
          </div>
        </div>
      )}

      <AddTransactionSheet
        open={txSheet}
        onClose={() => setTxSheet(false)}
        initialData={result ? {
          type: 'expense',
          description: result.business_name || '',
          amount: String(result.total || ''),
          currency: result.currency || '₪',
          date: result.date || new Date().toISOString().split('T')[0],
          wallet_id: selectedWallet || '',
        } : null}
      />
    </div>
  )
}
