/**
 * Haptic feedback utility.
 * Works on Android + iOS PWA (iOS 16.4+ as installed PWA).
 * Silently fails on desktop / unsupported.
 */
export function haptic(pattern = 8) {
  try { navigator.vibrate?.(pattern) } catch (_) {}
}

export function hapticSuccess() { haptic([10, 30, 10]) }
export function hapticError()   { haptic([50, 20, 50]) }
export function hapticLight()   { haptic(6) }
