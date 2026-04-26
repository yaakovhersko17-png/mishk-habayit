import { useState, useEffect } from 'react'
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
const today = () => new Date().toISOString().split('T')[0]
const EMPTY = { name: '', purchase_date: today(), effect: 0, flower_size: '', strain_type: '', dealer: '' }
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const isYaakov = (name) => name?.includes('יעקב') || name?.toLowerCase().includes('yaakov')

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

  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [imageFile, setImageFile]     = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving]     = useState(false)

  if (!isYaakov(profile?.name)) return <Navigate to="/" replace />

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data, error } = await supabase
      .from('grass_items').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { toast.error('שגיאה בטעינה'); setLoading(false); return }
    setItems(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null); setForm({ ...EMPTY, purchase_date: today() })
    setImageFile(null); setImagePreview(null); setModal(true)
  }
  function openEdit(it) {
    setEditing(it)
    setForm({ name: it.name, purchase_date: it.purchase_date || today(), effect: it.effect || 0, flower_size: it.flower_size || '', strain_type: it.strain_type || '', dealer: it.dealer || '' })
    setImageFile(null); setImagePreview(it.image_url || null); setModal(true)
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('שם חובה'); return }
    setSaving(true)

    let image_url = editing?.image_url || null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop().toLowerCase()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('grass-images').upload(path, imageFile, { upsert: true })
      if (upErr) { toast.error('שגיאה בהעלאת תמונה'); setSaving(false); return }
      image_url = supabase.storage.from('grass-images').getPublicUrl(path).data.publicUrl
    }

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      purchase_date: form.purchase_date || today(),
      effect: form.effect || null,
      flower_size: form.flower_size || null,
      strain_type: form.strain_type || null,
      dealer: form.dealer.trim() || null,
      image_url,
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

  if (loading) return <LoadingSpinner />

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
            <Plus size={15} /> הוסף חדש
          </button>
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="page-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌿</div>
            אין פריטים עדיין
          </div>
        ) : (
          <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((it, i) => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                {/* Thumbnail */}
                {it.image_url ? (
                  <img src={it.image_url} alt={it.name}
                    style={{ width: 58, height: 58, borderRadius: '0.625rem', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }} />
                ) : (
                  <div style={{ width: 58, height: 58, borderRadius: '0.625rem', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🌿</div>
                )}

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{it.name}</div>
                    {it.purchase_date && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{fmtDate(it.purchase_date)}</div>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                    {it.effect > 0 && (
                      <span style={{ fontSize: '0.8rem', color: '#facc15' }}>{'★'.repeat(it.effect)}{'☆'.repeat(5 - it.effect)}</span>
                    )}
                    {it.strain_type && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: STRAIN_COLOR[it.strain_type], background: `${STRAIN_COLOR[it.strain_type]}18`, borderRadius: '0.375rem', padding: '0.1rem 0.45rem' }}>{it.strain_type}</span>
                    )}
                    {it.flower_size && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', borderRadius: '0.375rem', padding: '0.1rem 0.4rem' }}>{it.flower_size}</span>
                    )}
                    {it.dealer && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>דרך: {it.dealer}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button onClick={() => openEdit(it)} style={{ width: 36, height: 36, borderRadius: '0.625rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(it)} style={{ width: 36, height: 36, borderRadius: '0.625rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'ערוך פריט' : 'פריט חדש'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>שם</label>
            <input className="input-field" placeholder="שם הזן" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תאריך</label>
            <input className="input-field" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} dir="ltr" />
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
                  style={{ flex: 1, padding: '0.45rem 0.25rem', borderRadius: '0.625rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: form.strain_type === s ? 700 : 400, border: `1px solid ${form.strain_type === s ? STRAIN_COLOR[s] + '80' : 'rgba(255,255,255,0.1)'}`, background: form.strain_type === s ? STRAIN_COLOR[s] + '20' : 'transparent', color: form.strain_type === s ? STRAIN_COLOR[s] : 'var(--text-muted)', transition: 'all 0.15s' }}>
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

          {/* Image upload */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-sub)', display: 'block', marginBottom: '0.375rem' }}>תמונה</label>
            {imagePreview && (
              <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: '0.75rem', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 0.875rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
    </div>
  )
}
