// Approximate sunset hours (local Israel time) per calendar month (0 = Jan)
const SUNSET_IL = [17.0, 17.5, 18.0, 18.5, 19.25, 19.75, 19.75, 19.25, 18.5, 17.75, 17.0, 16.75]

/**
 * Returns the current Hebrew date as a formatted Hebrew string.
 * After sunset the Hebrew day has already advanced, so we shift +1 day.
 * Uses the browser-native Intl Hebrew calendar (ca-hebrew) — no library needed.
 */
export function getHebrewDate(now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60
  const isAfterSunset = hour >= SUNSET_IL[now.getMonth()]
  const d = isAfterSunset ? new Date(now.getTime() + 86_400_000) : now
  try {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
    }).format(d)
  } catch {
    return ''
  }
}
