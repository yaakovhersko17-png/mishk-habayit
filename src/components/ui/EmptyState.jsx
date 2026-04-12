export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4rem 2rem',gap:'1rem',textAlign:'center'}}>
      <div style={{fontSize:'3rem'}}>{icon}</div>
      <div>
        <p style={{color:'var(--text)',fontWeight:600,margin:'0 0 0.25rem'}}>{title}</p>
        {subtitle && <p style={{color:'var(--text-muted)',fontSize:'0.875rem',margin:0}}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
