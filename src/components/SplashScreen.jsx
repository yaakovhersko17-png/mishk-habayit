export default function SplashScreen({ fading }) {
  return (
    <div
      className="hersko-splash"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'all' }}
    >
      <div className="hersko-splash-logo">Hersko</div>
    </div>
  )
}
