import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const SIZES = ['גדול', 'בינוני', 'קטן', 'קטן מאוד']
const STRAINS = ['אינדיקה', 'סטיבה', 'היברידי']
const STRAIN_COLOR = { 'אינדיקה': '#a78bfa', 'סטיבה': '#4ade80', 'היברידי': '#fbbf24' }
const LOW_STOCK = 5
const today = () => new Date().toISOString().split('T')[0]
const EMPTY = { name: '', purchase_date: today(), effect: 0, flower_size: '', strain_type: '', dealer: '', initial_weight: '10' }
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const isYaakov = (name) => name?.includes('יעקב') || name?.toLowerCase().includes('yaakov')

function AnimatedNumber({ value, decimals = 1 }) {
  const [disp, setDisp] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef(null)
  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (Math.abs(from - to) < 0.01) { setDisp(to); return }
    const dur = 700
    const start = performance.now()
    cancelAnimationFrame(rafRef.current)
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - (1 - t) ** 3
      setDisp(from + (to - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else { prevRef.current = to; setDisp(to) }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])
  return <>{typeof disp === 'number' ? disp.toFixed(decimals) : disp}</>
}

function Stars({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', direction: 'ltr' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', fontSize: '1.6rem', lineHeight: 1, color: n <= value ? '#facc15' : 'rgba(255,255,255,0.18)' }}>
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

export default function GrassPage() {
  const { user, profile } = useAuth()

  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  const [editing, setEditing]           = useState(null)
  const [form, setForm]                 = useState(EMPTY)
  const [imageFile, setImageFile]       = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving]             = useState(false)

  const [tobaccoBalance, setTobaccoBalance]   = useState(0)
  const [consumptionLogs, setConsumptionLogs] = useState([])
  const [rollModal, setRollModal]             = useState(false)
  const [rollForm, setRollForm]               = useState({ grass: '3', tobacco: '4', selectedBag: '' })
  const [rollSaving, setRollSaving]           = useState(false)
  const [tobaccoModal, setTobaccoModal]       = useState(false)
  const [tobaccoAdd, setTobaccoAdd]           = useState('')

  if (!isYaakov(profile?.name)) return <Navigate to="/" replace />

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [
      { data: itemData, error },
      { data: invData },
      { data: logData },
    ] = await Promise.all([
      supabase.from('grass_items').select('*').eq('user_id', user.id)
        .order('purchase_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('user_inventory').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('consumption_logs').select('*').eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
        .order('created_at', { ascending: false }),
    ])
    if (error) { toast.error('שגיאה בטעינה'); setLoading(false); return }
    setItems(itemData || [])
    setTobaccoBalance(Number(invData?.tobacco_balance) || 0)
    setConsumptionLogs(logData || [])
    setLoading(false)
  }

  // Dashboard calculations
  const totalGrass = items.reduce((s, it) => s + Math.max(0, Number(it.current_weight) || 0), 0)
  const uniqueDays = new Set(consumptionLogs.map(l => l.created_at.split('T')[0])).size
  const totalConsumed = consumptionLogs.reduce((s, l) => s + Number(l.grass_amount), 0)
  const avgPerDay = uniqueDays > 0 ? totalConsumed / uniqueDays : 0
  const daysLeft = avgPerDay > 0 ? Math.round(totalGrass / avgPerDay) : null

  // Item modal
  function openAdd() {
    setEditing(null); setForm({ ...EMPTY, purchase_date: today() })
    setImageFile(null); setImagePreview(null); setModal(true)
  }
  function openEdit(it) {
    setEditing(it)
    setForm({
      name: it.name, purchase_date: it.purchase_date || today(),
      effect: it.effect || 0, flower_size: it.flower_size || '',
      strain_type: it.strain_type || '', dealer: it.dealer || '',
      initial_weight: String(it.initial_weight ?? 10),
      current_weight: String(it.current_weight ?? it.initial_weight ?? 10),
    })
    setImageFile(null); setImagePreview(it.image_url || null); setModal(true)
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('שם חובה'); return }
    setSaving(true)
    let image_url = editing?.image_url || null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop().toLowerCase()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('grass-images').upload(path, imageFile, { upsert: true })
      if (upErr) { toast.error('שגיאה בהעלאת תמונה'); setSaving(false); return }
      image_url = supabase.storage.from('grass-images').getPublicUrl(path).data.publicUrl
    }
    const initW = Number(form.initial_weight) || 10
    const currW = editing
      ? (form.current_weight !== '' && form.current_weight !== undefined ? Number(form.current_weight) : initW)
      : initW
    const payload = {
      user_id: user.id, name: form.name.trim(),
      purchase_date: form.purchase_date || today(),
      effect: form.effect || null, flower_size: form.flower_size || null,
      strain_type: form.strain_type || null, dealer: form.dealer.trim() || null,
      initial_weight: initW, current_weight: currW, image_url,
    }
    const { error } = editing
      ? await supabase.from('grass_items').update(payload).eq('id', editing.id)
      : await supabase.from('grass_items').insert(payload)
    if (error) { toast.error('שגיאת שמירה'); setSaving(false); return }
    toast.success(editing ? 'עודכן!' : 'נוסף!')
    setModal(false); setSaving(false); load()
  }

  async function handleDelete(it) {
    if (!confirm(`למחוק "${it.name}"?`)) return
    const { error } = await supabase.from('grass_items').delete().eq('id', it.id)
    if (error) { toast.error('שגיאת מחיקה'); return }
    toast.success('נמחק'); load()
  }

  const sortedByDate = (arr) => [...arr].sort((a, b) => {
    const da = a.purchase_date ? new Date(a.purchase_date) : new Date(a.created_at)
    const db = b.purchase_date ? new Date(b.purchase_date) : new Date(b.created_at)
    return da - db
  })

  function openRollModal() {
    const oldest = sortedByDate(items.filter(it => (Number(it.current_weight) || 0) > 0))[0]
    setRollForm({ grass: '3', tobacco: '4', selectedBag: oldest?.id || '' })
    setRollModal(true)
  }

  // Roll with manual bag selection (fallback FIFO if none selected)
  async function handleRoll() {
    const grassAmt = parseFloat(rollForm.grass) || 0
    const tobaccoAmt = parseFloat(rollForm.tobacco) || 0
    if (grassAmt <= 0 && tobaccoAmt <= 0) { toast.error('הכנס כמויות'); return }

    let deductions = []
    if (rollForm.selectedBag) {
      const bag = items.find(it => it.id === rollForm.selectedBag)
      if (!bag) { toast.error('שקית לא נמצאה'); return }
      const avail = Number(bag.current_weight) || 0
      if (grassAmt > avail) { toast.error(`אין מספיק! ב${bag.name} יש ${avail.toFixed(1)}ג`); return }
      deductions = [{ bag, dec: grassAmt }]
    } else {
      const bags = sortedByDate(items.filter(it => (Number(it.current_weight) || 0) > 0))
      const totalAvail = bags.reduce((s, b) => s + Number(b.current_weight), 0)
      if (grassAmt > totalAvail) { toast.error(`אין מספיק! יש ${totalAvail.toFixed(1)}ג`); return }
      let rem = grassAmt
      for (const bag of bags) {
        if (rem <= 0) break
        const w = Number(bag.current_weight) || 0
        const dec = Math.min(w, rem)
        deductions.push({ bag, dec })
        rem -= dec
      }
    }

    setRollSaving(true)
    for (const { bag, dec } of deductions) {
      const w = Number(bag.current_weight) || 0
      await supabase.from('grass_items').update({ current_weight: Math.max(0, w - dec) }).eq('id', bag.id)
    }

    const newTobacco = Math.max(0, tobaccoBalance - tobaccoAmt)
    await supabase.from('user_inventory').upsert(
      { user_id: user.id, tobacco_balance: newTobacco, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    await supabase.from('consumption_logs').insert({ user_id: user.id, grass_amount: grassAmt, tobacco_amount: tobaccoAmt })

    setRollModal(false); setRollSaving(false)
    toast.success('גלגול נרשם 🌿')
    await load()
    const newTotal = totalAvail - grassAmt
    if (newTotal < LOW_STOCK && newTotal >= 0) {
      toast(`⚠️ נשאר רק ${newTotal.toFixed(1)}ג גראס!`, { duration: 6000 })
    }
  }

  async function handleAddTobacco() {
    const amt = parseFloat(tobaccoAdd)
    if (!amt || amt <= 0) { toast.error('הכנס כמות'); return }
    const newBal = tobaccoBalance + amt
    await supabase.from('user_inventory').upsert(
      { user_id: user.id, tobacco_balance: newBal, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setTobaccoBalance(newBal); setTobaccoModal(false); setTobaccoAdd('')
    toast.success(`נוסף ${amt}ג טבק`)
  }

  if (loading) return <LoadingSpinner />

  const noStock = totalGrass <= 0
  const lowStock = !noStock && totalGrass < LOW_STOCK
  const grassColor = noStock ? '#f87171' : lowStock ? '#fbbf24' : '#4ade80'
  const grassBg = noStock ? 'rgba(248,113,113,0.1)' : lowStock ? 'rgba(251,191,36,0.08)' : 'rgba(22,163,74,0.1)'
  const grassBorder = noStock ? 'rgba(248,113,113,0.3)' : lowStock ? 'rgba(251,191,36,0.3)' : 'rgba(22,163,74,0.25)'

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Background leaf */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}grass-leaf.svg`} alt=""
          style={{ width: '75vmin', height: '75vmin', opacity: 0.07, objectFit: 'contain', userSelect: 'none' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>🌿 גראס</h1>
          <button className="btn-primary" onClick={openAdd} style={{ padding: '0.5rem 0.875rem' }}>
            <Plus size={15} /> הוסף שקית
          </button>
        </div>

        {/* Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <div style={{ padding: '1rem 0.75rem', borderRadius: '1rem', background: grassBg, border: `1px solid ${grassBorder}`, textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>🌿</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: grassColor, lineHeight: 1 }}>
              <AnimatedNumber value={totalGrass} />
              <span style={{ fontSize: '0.65rem', fontWeight: 400, marginRight: '0.1rem' }}>ג׳</span>
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>גראס נותר</div>
          </div>

          <div onClick={() => setTobaccoModal(true)} style={{ padding: '1rem 0.75rem', borderRadius: '1rem', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>🚬</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a78bfa', lineHeight: 1 }}>
              <AnimatedNumber value={tobaccoBalance} decimals={0} />
              <span style={{ fontSize: '0.65rem', fontWeight: 400, marginRight: '0.1rem' }}>ג׳</span>
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>טבק • הוסף +</div>
          </div>
        </div>

        {/* Roll button */}
        <button onClick={openRollModal}
          style={{ padding: '0.875rem', borderRadius: '1rem', background: 'linear-gradient(135deg, rgba(22,163,74,0.2), rgba(108,99,255,0.2))', border: '1px solid rgba(22,163,74,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', color: '#4ade80', fontWeight: 700, fontSize: '1rem', transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          🌿 גלגול
        </button>

        {/* List */}
        {items.length === 0 ? (
          <div className="page-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌿</div>
            אין שקיות עדיין
          </div>
        ) : (
          <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((it, i) => {
              const initW = Number(it.initial_weight) || 10
              const currW = Math.max(0, Number(it.current_weight) || 0)
              const pct = initW > 0 ? (currW / initW) * 100 : 0
              const barColor = pct > 60 ? '#4ade80' : pct > 25 ? '#fbbf24' : '#f87171'
              return (
                <div key={it.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.name} style={{ width: 52, height: 52, borderRadius: '0.625rem', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: '0.625rem', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🌿</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.15rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{it.name}</div>
                        {it.purchase_date && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{fmtDate(it.purchase_date)}</div>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                        {it.effect > 0 && <span style={{ fontSize: '0.75rem', color: '#facc15' }}>{'★'.repeat(it.effect)}{'☆'.repeat(5 - it.effect)}</span>}
                        {it.strain_type && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: STRAIN_COLOR[it.strain_type], background: `${STRAIN_COLOR[it.strain_type]}18`, borderRadius: '0.375rem', padding: '0.1rem 0.4rem' }}>{it.strain_type}</span>}
                        {it.flower_size && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', borderRadius: '0.375rem', padding: '0.1rem 0.35rem' }}>{it.flower_size}</span>}
                        {it.dealer && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>דרך: {it.dealer}</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: barColor, fontWeight: 600 }}>{currW.toFixed(1)}ג מתוך {initW}ג</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                      <button onClick={() => openEdit(it)} style={{ width: 36, height: 36, borderRadius: '0.625rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(it)} style={{ width: 36, height: 36, borderRadius: '0.625rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: '0.625rem', height: 5, borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך שקית' : 'שקית חדשה'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שם</label>
            <input className="input-field" placeholder="שם הזן" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תאריך רכישה</label>
            <input className="input-field" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} dir="ltr" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>משקל התחלתי (ג׳)</label>
              <input className="input-field" type="number" step="0.5" min="0" value={form.initial_weight} onChange={e => setForm(f => ({ ...f, initial_weight: e.target.value }))} dir="ltr" />
            </div>
            {editing && (
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>נותר כרגע (ג׳)</label>
                <input className="input-field" type="number" step="0.1" min="0" value={form.current_weight} onChange={e => setForm(f => ({ ...f, current_weight: e.target.value }))} dir="ltr" />
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>אפקט</label>
            <Stars value={form.effect} onChange={v => setForm(f => ({ ...f, effect: v }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>סוג</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {STRAINS.map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, strain_type: f.strain_type === s ? '' : s }))}
                  style={{ flex: 1, padding: '0.4rem 0.25rem', borderRadius: '0.625rem', fontSize: '0.78rem', cursor: 'pointer', fontWeight: form.strain_type === s ? 700 : 400, border: `1px solid ${form.strain_type === s ? STRAIN_COLOR[s] + '80' : 'rgba(255,255,255,0.1)'}`, background: form.strain_type === s ? STRAIN_COLOR[s] + '20' : 'transparent', color: form.strain_type === s ? STRAIN_COLOR[s] : 'var(--text-muted)', transition: 'all 0.15s' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>גודל הפרחים</label>
            <select className="input-field" value={form.flower_size} onChange={e => setForm(f => ({ ...f, flower_size: e.target.value }))}>
              <option value="">— בחר —</option>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>דילר</label>
            <input className="input-field" placeholder="שם הספק" value={form.dealer} onChange={e => setForm(f => ({ ...f, dealer: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תמונה</label>
            {imagePreview && (
              <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: '0.75rem', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.55rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              📷 {imagePreview ? 'החלף תמונה' : 'הוסף תמונה'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
          </div>
        </div>
      </Modal>

      {/* Roll Modal */}
      <Modal open={rollModal} onClose={() => setRollModal(false)} title="🌿 גלגול">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>בחר שקית</label>
            <select className="input-field" value={rollForm.selectedBag}
              onChange={e => setRollForm(f => ({ ...f, selectedBag: e.target.value }))}>
              {sortedByDate(items.filter(it => (Number(it.current_weight) || 0) > 0)).map(it => (
                <option key={it.id} value={it.id}>
                  {it.name} — {(Number(it.current_weight) || 0).toFixed(1)}ג׳ נותרו
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>גראס 🌿 (ג׳)</label>
              <input className="input-field" type="number" step="0.1" min="0" value={rollForm.grass}
                onChange={e => setRollForm(f => ({ ...f, grass: e.target.value }))} dir="ltr"
                style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>טבק 🚬 (ג׳)</label>
              <input className="input-field" type="number" step="0.1" min="0" value={rollForm.tobacco}
                onChange={e => setRollForm(f => ({ ...f, tobacco: e.target.value }))} dir="ltr"
                style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }} />
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {(() => {
              const selBag = rollForm.selectedBag ? items.find(it => it.id === rollForm.selectedBag) : null
              const grassAfter = selBag
                ? Math.max(0, (Number(selBag.current_weight) || 0) - (parseFloat(rollForm.grass) || 0))
                : Math.max(0, totalGrass - (parseFloat(rollForm.grass) || 0))
              const label = selBag ? `${selBag.name} אחרי` : 'גראס אחרי (סה"כ)'
              return <span>{label}: <b style={{ color: '#4ade80' }}>{grassAfter.toFixed(1)}ג</b></span>
            })()}
            <span>טבק אחרי: <b style={{ color: '#a78bfa' }}>{Math.max(0, tobaccoBalance - (parseFloat(rollForm.tobacco) || 0)).toFixed(1)}ג</b></span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-ghost" onClick={() => setRollModal(false)} style={{ flex: 0 }}>ביטול</button>
            <button onClick={handleRoll} disabled={rollSaving}
              style={{ flex: 1, padding: '0.8rem', borderRadius: '0.875rem', background: 'linear-gradient(135deg, #15803d, #4ade80)', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
              {rollSaving ? '...' : '✅ אשר גלגול'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Tobacco Modal */}
      <Modal open={tobaccoModal} onClose={() => setTobaccoModal(false)} title="🚬 הוספת טבק">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            יתרה: <b style={{ color: '#a78bfa', fontSize: '1.2rem' }}>{tobaccoBalance.toFixed(0)}ג</b>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>כמה גרם לוסיף?</label>
            <input className="input-field" type="number" step="1" min="0" placeholder="50" value={tobaccoAdd}
              onChange={e => setTobaccoAdd(e.target.value)} dir="ltr"
              style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setTobaccoModal(false)}>ביטול</button>
            <button className="btn-primary" onClick={handleAddTobacco}>הוסף</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
