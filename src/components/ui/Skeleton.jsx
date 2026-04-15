/**
 * Skeleton — placeholder shimmer while data loads.
 *
 * Usage:
 *   <Skeleton.Card />               — full card placeholder
 *   <Skeleton.List rows={4} />      — list of rows
 *   <Skeleton.Text width="60%" />   — single text line
 *   <Skeleton.StatGrid />           — 2×2 stat cards
 */
export default function Skeleton() { return null }

Skeleton.Text = function SkText({ width = '100%', height = '0.875rem', style = {} }) {
  return <div className="skeleton" style={{ width, height, borderRadius: '0.375rem', ...style }} />
}

Skeleton.Title = function SkTitle({ width = '55%' }) {
  return <div className="skeleton skeleton-title" style={{ width }} />
}

Skeleton.Avatar = function SkAvatar({ size = 40 }) {
  return <div className="skeleton skeleton-avatar" style={{ width: size, height: size }} />
}

Skeleton.Card = function SkCard() {
  return (
    <div className="page-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Skeleton.Avatar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <Skeleton.Title />
          <Skeleton.Text width="40%" height="0.75rem" />
        </div>
      </div>
      <Skeleton.Text />
      <Skeleton.Text width="80%" />
    </div>
  )
}

Skeleton.List = function SkList({ rows = 4 }) {
  return (
    <div className="page-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Skeleton.Avatar size={36} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <Skeleton.Text width={`${60 + (i % 3) * 12}%`} />
            <Skeleton.Text width="40%" height="0.7rem" />
          </div>
          <Skeleton.Text width="60px" height="0.875rem" style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}

Skeleton.StatGrid = function SkStatGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Skeleton.Text width="50%" height="0.7rem" />
          <Skeleton.Text width="70%" height="1.5rem" />
          <Skeleton.Text width="40%" height="0.65rem" />
        </div>
      ))}
    </div>
  )
}
