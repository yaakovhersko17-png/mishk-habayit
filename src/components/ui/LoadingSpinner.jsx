export default function LoadingSpinner({ text = 'טוען...' }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'3rem',gap:'1rem'}}>
      <div style={{width:36,height:36,borderRadius:'50%',border:'2px solid rgba(139,92,246,0.3)',borderTopColor:'#8b5cf6',animation:'spin 0.8s linear infinite'}} />
      <p style={{color:'var(--text-muted)',fontSize:'0.875rem',margin:0}}>{text}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
