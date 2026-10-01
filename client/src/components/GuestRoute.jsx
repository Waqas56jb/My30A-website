import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { syncHostHome } from '../lib/hostHome.js'
import { NotificationHost } from './NotificationBell.jsx'

function Frame({ children }) {
  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home">
          <div className="app-home-scroll">{children}</div>
        </div>
      </div>
    </div>
  )
}

// Guards the guest mobile app: requires a signed-in account with the guest role.
export default function GuestRoute({ children }) {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()
  const isGuest = Boolean(session && (profile?.roles || []).includes('guest'))
  const userId = session?.user?.id

  // Host version: link the property from a scanned QR code / refresh the host's branding.
  useEffect(() => {
    if (isGuest && userId) syncHostHome(userId)
  }, [isGuest, userId])

  if (loading) {
    return (
      <Frame>
        <p className="app-empty">Loading…</p>
      </Frame>
    )
  }

  if (!session) {
    return <Navigate to="/app/login" replace state={{ from: location.pathname }} />
  }

  if (profile && !(profile.roles || []).includes('guest')) {
    return (
      <Frame>
        <div className="app-empty">
          <p>This is a staff account. The guest app is for guests only.</p>
          <p style={{ marginTop: 12 }}>
            <Link to="/login">Go to staff login</Link>
            {' · '}
            <button type="button" onClick={signOut} style={{ font: 'inherit', color: 'inherit', background: 'none', border: 0, textDecoration: 'underline' }}>
              Sign out
            </button>
          </p>
        </div>
      </Frame>
    )
  }

  return (
    <>
      {children}
      <NotificationHost />
    </>
  )
}
