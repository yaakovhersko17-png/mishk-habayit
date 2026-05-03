// Approximate sunset hours (local Israel time) per calendar month (0 = Jan)
const SUNSET_IL = [17.0, 17.5, 18.0, 18.5, 19.25, 19.75, 19.75, 19.25, 18.5, 17.75, 17.0, 16.75]

const H_ONES    = ['','א','ב','ג','ד','ה','ו','ז','ח','ט']
const H_TENS    = ['','י','כ','ל','מ','נ','ס','ע','פ','צ']
const H_HUNDREDS = ['','ק','ר','ש','ת','תק','תר','תש','תת','תתק']

// Convert an integer (1–999) to Hebrew letter numerals with geresh / gershayim
function toHebNum(n) {
  if (n === 15) return 'ט"ו'   // avoid divine name יה
  if (n === 16) return 'ט"ז'   // avoid divine name יו
  let letters = ''
  letters += H_HUNDREDS[Math.floor(n / 100)]
  n %= 100
  letters += H_TENS[Math.floor(n / 10)]
  letters += H_ONES[n % 10]
  // Add punctuation: single letter → geresh, multiple → gershayim before last
  if (letters.length === 1) return letters + "'"
  return letters.slice(0, -1) + '"' + letters.slice(-1)
}

/**
 * Returns the current Hebrew date formatted with Hebrew letter-numerals.
 * Example: ט"ז באייר תשפ"ו
 *
 * After sunset the Hebrew day has already advanced (+1 Gregorian day).
 * Uses Intl for the month name; converts day and year to gematria manually.
 */
export function getHebrewDate(now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60
  const isAfterSunset = hour >= SUNSET_IL[now.getMonth()]
  const d = isAfterSunset ? new Date(now.getTime() + 86_400_000) : now

  try {
    const fmt = (opts) =>
      new Intl.DateTimeFormat('he-u-ca-hebrew', opts).formatToParts(d)

    const dayNum   = Number(fmt({ day:   'numeric' }).find(p => p.type === 'day')?.value   ?? 0)
    const yearNum  = Number(fmt({ year:  'numeric' }).find(p => p.type === 'year')?.value  ?? 0)
    const monthStr =        fmt({ month: 'long'    }).find(p => p.type === 'month')?.value ?? ''

    if (!dayNum || !yearNum || !monthStr) return ''
    // Year: drop the thousands (5000) — show last 3 digits as gematria
    return `${toHebNum(dayNum)} ב${monthStr} ${toHebNum(yearNum % 1000)}`
  } catch {
    return ''
  }
}
