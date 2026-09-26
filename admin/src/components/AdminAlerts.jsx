import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, Check, Volume2, VolumeX, X } from 'lucide-react'
import { api } from '../lib/api.js'
import { invalidateQuery } from '../lib/useQuery.js'
import { formatDateTime } from '../lib/format.js'

// Admin alerts: new guest transfers / grocery orders (and other admin notifications) arrive here
// without reloading — a bell with the unread count, a banner + chime for each new one, the count
// in the browser tab title, and the lists refresh themselves. Checks every 15 seconds.
const POLL_MS = 15000
const SOUND_KEY = 'my30a-admin-alert-sound'

let audioCtx = null
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    /* no audio */
  }
}
function chime() {
  try {
    unlockAudio()
    if (!audioCtx) return
    const t = audioCtx.currentTime
    // Two soft rising notes.
    ;[
      [880, 0],
      [1318.5, 0.16],
    ].forEach(([freq, at]) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + at)
      gain.gain.exponentialRampToValueAtTime(0.25, t + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.45)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(t + at)
      osc.stop(t + at + 0.5)
    })
  } catch {
    /* no audio */
  }
}
const soundOn = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

function linkFor(n) {
  if (n.transfer_id) return `/transfers?open=${n.transfer_id}`
  if (n.grocery_order_id) return `/grocery?open=${n.grocery_order_id}`
  return null
}

export default function AdminAlerts() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [banner, setBanner] = useState(null)
  const [sound, setSound] = useState(soundOn)
  const seen = useRef(null) // ids already shown; null until the first load
  const baseTitle = useRef(document.title)

  const load = useCallback(async () => {
    try {
      const data = await api('/api/notifications/mine?limit=40')
      const list = data.notifications || []
      setItems(list)
      setUnread(data.unread_count || 0)
      if (seen.current === null) {
        seen.current = new Set(list.map((n) => n.id))
        return
      }
      const fresh = list.filter((n) => !seen.current.has(n.id) && !n.is_read)
      list.forEach((n) => seen.current.add(n.id))
      if (fresh.length) {
        setBanner(fresh[0])
        if (soundOn()) chime()
        // The new order should already be in the lists the admin is looking at.
        invalidateQuery('/api/transfers')
        invalidateQuery('/api/grocery')
        invalidateQuery('/api/dashboard')
        window.dispatchEvent(new CustomEvent('my30a-admin-refresh'))
      }
    } catch {
      /* offline / signed out — try again next tick */
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    // Browsers only allow sound after the page has been clicked once.
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  useEffect(() => {
    const clean = baseTitle.current.replace(/^\(\d+\)\s*/, '')
    document.title = unread ? `(${unread}) ${clean}` : clean
  }, [unread])

  useEffect(() => {
    if (!banner) return undefined
    const t = window.setTimeout(() => setBanner(null), 12000)
    return () => window.clearTimeout(t)
  }, [banner])

  const openItem = async (n) => {
    setOpen(false)
    setBanner(null)
    if (!n.is_read) {
      api(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
    }
    const to = linkFor(n)
    if (to) navigate(to)
  }

  const readAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {})
    setItems((list) => list.map((x) => ({ ...x, is_read: true })))
    setUnread(0)
  }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
    } catch {
      /* ignore */
    }
    if (next) chime()
  }

  return (
    <>
      <button
        type="button"
        className={`alerts-btn${unread ? ' has-unread' : ''}`}
        onClick={() => {
          unlockAudio()
          setOpen((o) => !o)
        }}
        aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`}
      >
        {unread ? <BellRing size={18} /> : <Bell size={18} />}
        {unread ? <span className="alerts-count">{unread > 99 ? '99+' : unread}</span> : null}
      </button>

      {open ? (
        <>
          <button type="button" className="alerts-backdrop" aria-label="Close notifications" onClick={() => setOpen(false)} />
          <section className="alerts-panel" aria-label="Notifications">
            <header>
              <b>Notifications</b>
              <span className="alerts-tools">
                <button type="button" onClick={toggleSound} aria-label={sound ? 'Turn alert sound off' : 'Turn alert sound on'} title={sound ? 'Sound on' : 'Sound off'}>
                  {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                {unread ? (
                  <button type="button" onClick={readAll}>
                    <Check size={14} /> Mark all read
                  </button>
                ) : null}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </span>
            </header>
            <div className="alerts-list">
              {items.length === 0 ? <p className="alerts-empty">No notifications yet. New transfers and grocery orders will appear here.</p> : null}
              {items.map((n) => (
                <button type="button" key={n.id} className={`alerts-item${n.is_read ? '' : ' is-unread'}`} onClick={() => openItem(n)}>
                  <span>{n.message}</span>
                  <small>{formatDateTime(n.created_at)}</small>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {banner ? (
        <div className="alerts-banner" role="status">
          <BellRing size={18} />
          <button type="button" className="alerts-banner-body" onClick={() => openItem(banner)}>
            <b>New</b>
            <span>{banner.message}</span>
          </button>
          <button type="button" className="alerts-banner-x" aria-label="Dismiss" onClick={() => setBanner(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </>
  )
}
