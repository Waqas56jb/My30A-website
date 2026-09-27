import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { api } from '../lib/api.js'
import { playChime, unlockAudio } from '../lib/notifications.js'

// Driver / shopper / partner apps: a trip or order the admin just assigned shows up within ~10
// seconds — this checks the staff member's notifications, and on a new one tells the open screen to
// reload (event 'my30a-staff-refresh'), shows a banner, chimes and vibrates. Before, the screens only
// re-checked once a minute.
const POLL_MS = 6000

export default function StaffAlerts() {
  const [banner, setBanner] = useState(null)
  const seen = useRef(null)

  const check = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const data = await api('/api/notifications/mine?limit=20&unread=true')
      const list = data.notifications || []
      if (seen.current === null) {
        seen.current = new Set(list.map((n) => n.id))
        return
      }
      const fresh = list.filter((n) => !seen.current.has(n.id))
      list.forEach((n) => seen.current.add(n.id))
      if (!fresh.length) return
      window.dispatchEvent(new CustomEvent('my30a-staff-refresh'))
      setBanner(fresh[0])
      playChime()
      try {
        navigator.vibrate?.([120, 80, 120])
      } catch {
        /* no vibration */
      }
    } catch {
      /* offline — next tick */
    }
  }, [])

  useEffect(() => {
    check()
    const timer = window.setInterval(check, POLL_MS)
    const onVisible = () => check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [check])

  useEffect(() => {
    if (!banner) return undefined
    const t = window.setTimeout(() => setBanner(null), 10000)
    return () => window.clearTimeout(t)
  }, [banner])

  if (!banner) return null
  return (
    <div className="staff-alert" role="status">
      <BellRing size={18} aria-hidden="true" />
      <p>{banner.message}</p>
      <button type="button" aria-label="Dismiss" onClick={() => setBanner(null)}>
        <X size={16} />
      </button>
    </div>
  )
}
