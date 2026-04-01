import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!open) return null

  const sizes = { sm: '400px', md: '560px', lg: '720px', xl: '900px' }

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',
        alignItems:'flex-end',justifyContent:'center',zIndex:50,padding:'0',
        backdropFilter:'blur(4px)',
      }}
      className="modal-backdrop"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%',maxWidth:sizes[size],maxHeight:'92dvh',overflowY:'auto',
          background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'1rem 1rem 0 0',animation:'cardEnter 0.2s ease',
        }}
        className="modal-box"
      >
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.25rem 1.5rem',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <h3 style={{margin:0,fontSize:'1rem',fontWeight:600,color:'#e2e8f0'}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'0.5rem',borderRadius:'0.5rem',display:'flex',minWidth:36,minHeight:36,alignItems:'center',justifyContent:'center'}}><X size={18}/></button>
        </div>
        <div style={{padding:'1.25rem 1.5rem'}}>{children}</div>
      </div>
    </div>
  )
}
