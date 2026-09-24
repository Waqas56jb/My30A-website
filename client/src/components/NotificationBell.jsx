import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import {
  dismissBanner,
  notificationLink,
  startNotificationWatcher,
  useNotificationState,
  useUnreadCount,
} from '../lib/notifications.js'

// Bell used in every guest header: opens the Notifications screen, shows the unread count.
export default function NotificationBell({ className = 'app-home-bell app-press', size = 18 }) {
  const unread = useUnreadCount()
  return (
    <Link to="/app/notifications" className={`${className} app-bell`} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
      <Bell size={size} strokeWidth={1.8} aria-hidden="true" />
      {unread ? <span className="app-bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
    </Link>
  )
}

// Mounted once for the whole guest app: starts the watcher and shows a banner (with a chime)
// whenever a new notification arrives, wherever the guest is.
export function NotificationHost() {
  const { banner } = useNotificationState()
  const navigate = useNavigate()

  useEffect(() => {
    startNotificationWatcher()
  }, [])

  useEffect(() => {
    if (!banner) return undefined
    const t = setTimeout(dismissBanner, 6000)
    return () => clearTimeout(t)
  }, [banner])

  if (!banner) return null
  return (
    <div className="app-notif-toast" role="status" aria-live="polite">
      <button
        type="button"
        className="app-notif-toast-main"
        onClick={() => {
          dismissBanner()
          navigate(notificationLink(banner))
        }}
      >
        <span className="app-notif-toast-ico" aria-hidden="true">
          <Bell size={16} strokeWidth={2} />
        </span>
        <span className="app-notif-toast-text">
          <strong>My30A Host</strong>
          <span>{banner.message}</span>
        </span>
      </button>
      <button type="button" className="app-notif-toast-x" aria-label="Dismiss" onClick={dismissBanner}>
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
