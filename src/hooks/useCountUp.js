import { useState, useEffect, useRef } from 'react'

/**
 * Animates a number from 0 to `target` over `duration` ms.
 *
 * Usage:
 *   const displayed = useCountUp(totalBalance, 900)
 *   <span>₪{displayed.toLocaleString()}</span>
 */
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (target === prevTarget.current && value !== 0) return
    prevTarget.current = target

    const start = Date.now()
    const from  = value

    function tick() {
      const elapsed  = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}
