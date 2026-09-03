import { useEffect, useRef, useState } from 'react'
import { usd } from '../lib/format.js'

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function useCountUp(target, enabled) {
  const [value, setValue] = useState(enabled ? 0 : target)
  const played = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return undefined
    }
    if (played.current || prefersReducedMotion()) {
      setValue(target)
      played.current = true
      return undefined
    }

    played.current = true
    const start = performance.now()
    let frame

    function tick(now) {
      const t = Math.min(1, (now - start) / 350)
      const eased = 1 - (1 - t) * (1 - t)
      setValue(target * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled, target])

  return value
}

export default function StatCard({ label, amount, count, suffix = '', detail, flagged, style }) {
  const isMoney = amount != null
  const target = isMoney ? Number(amount) || 0 : Number(count) || 0
  const counted = useCountUp(target, isMoney || count != null)
  const display = isMoney ? usd(counted) : `${Math.round(counted)}${suffix}`

  return (
    <div className={`card stat${flagged ? ' accent' : ''} rise`} style={style}>
      <div className="l">{label}</div>
      <div className={`v${flagged ? ' flag' : ''}`}>{display}</div>
      <div className="d">{detail}</div>
    </div>
  )
}
