import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, Car, CheckCheck, ShoppingBag, Volume2, VolumeX } from 'lucide-react'
import { errorText, guest } from '../../../lib/guestApi.js'
import { notificationLink, playChime, refreshNotifications, setSoundEnabled, setUnread, soundEnabled } from '../../../lib/notifications.js'
import { ExploreHead, ExploreShell } from '../explore/ExploreShared.jsx'

const dayKey = (iso) => new Date(iso).toDateString()
function groupLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export default function AppNotifications() {
  const navigate = useNavigate()
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [sound, setSound] = useState(soundEnabled())

  const load = () =>
    guest
      .notifications()
      .then((d) => {
        setList(d.notifications || [])
        setUnread(d.unread_count || 0)
      })
      .catch((err) => setError(errorText(err)))

  useEffect(() => {
    load()
  }, [])

  const open = async (n) => {
    if (!n.is_read) {
      setList((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      await guest.readNotification(n.id).catch(() => {})
      refreshNotifications()
    }
    const to = notificationLink(n)
    if (to !== '/app/notifications') navigate(to)
  }

  const readAll = async () => {
    setList((cur) => cur.map((x) => ({ ...x, is_read: true })))
    await guest.readAllNotifications().catch(() => {})
    setUnread(0)
  }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    setSoundEnabled(next)
    if (next) playChime()
  }

  const unread = (list || []).filter((n) => !n.is_read).length
  const groups = []
  for (const n of list || []) {
    const last = groups[groups.length - 1]
    if (last && last.key === dayKey(n.created_at)) last.items.push(n)
    else groups.push({ key: dayKey(n.created_at), label: groupLabel(n.created_at), items: [n] })
  }

  return (
    <ExploreShell active="profile">
      <ExploreHead title="Notifications" sub={unread ? `${unread} unread` : 'You’re all caught up'} back="/app/profile" />
      <div className="app-exp-body app-nt">
        <div className="app-nt-actions">
          <button type="button" className="app-nt-chip" onClick={toggleSound} aria-pressed={sound}>
            {sound ? <Volume2 size={15} strokeWidth={2} /> : <VolumeX size={15} strokeWidth={2} />}
            Sound {sound ? 'on' : 'off'}
          </button>
          {unread ? (
            <button type="button" className="app-nt-chip is-primary" onClick={readAll}>
              <CheckCheck size={15} strokeWidth={2} /> Mark all read
            </button>
          ) : null}
        </div>

        {error ? <p className="app-inline-error">{error}</p> : null}
        {list === null ? (
          Array.from({ length: 4 }, (_, i) => <span key={i} className="app-skel app-skel-card" style={{ height: 76 }} aria-hidden="true" />)
        ) : list.length === 0 ? (
          <div className="app-nt-empty">
            <span aria-hidden="true">
              <BellOff size={26} strokeWidth={1.6} />
            </span>
            <strong>No notifications yet</strong>
            <p>Updates about your airport transfers, grocery orders and drivers will appear here.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="app-nt-group">
              <h2 className="app-dine-h">{g.label}</h2>
              <div className="app-nt-list">
                {g.items.map((n) => {
                  const Icon = n.transfer_id ? Car : n.grocery_order_id ? ShoppingBag : Bell
                  return (
                    <button key={n.id} type="button" className={`app-nt-item${n.is_read ? '' : ' is-unread'}`} onClick={() => open(n)}>
                      <span className={`app-nt-ico ${n.transfer_id ? 'is-trip' : n.grocery_order_id ? 'is-grocery' : ''}`} aria-hidden="true">
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="app-nt-text">
                        <span>{n.message}</span>
                        <small>{timeLabel(n.created_at)}</small>
                      </span>
                      {n.is_read ? null : <span className="app-nt-dot" aria-label="Unread" />}
                    </button>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </ExploreShell>
  )
}
