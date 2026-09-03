import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, Car, ShoppingBasket, Truck, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { initials, roleLabel } from '../lib/format.js'
import { useNotifications } from '../lib/useNotifications.js'

const PANEL_ROLES = ['driver', 'partner', 'shopper']

const NAV = {
  driver: [
    { to: '/driver', end: true, icon: Car, label: 'Trips' },
    { to: '/driver/earnings', icon: Wallet, label: 'Earnings' },
  ],
  partner: [
    { to: '/partner', end: true, icon: Truck, label: 'Vehicles' },
    { to: '/partner/notifications', icon: Bell, label: 'Notifications', badge: true },
  ],
  shopper: [
    { to: '/shopper', end: true, icon: ShoppingBasket, label: 'Orders' },
    { to: '/shopper/earnings', icon: Wallet, label: 'Earnings' },
  ],
}

export default function AppNav() {
  const { profile, activeRole, setActiveRole, signOut } = useAuth()
  const navigate = useNavigate()
  const { unread } = useNotifications({ poll: true })
  const items = NAV[activeRole] || NAV.driver
  const switchable = (profile?.roles || []).filter((role) => PANEL_ROLES.includes(role))

  return (
    <nav className="nav" aria-label="App">
      <div className="nav-links">
        {items.map((item) => {
          const Icon = item.icon
          const count = item.badge ? unread : 0
          return (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon size={22} strokeWidth={1.85} />
              {item.label}
              {count > 0 ? <span className="nav-badge">{count > 99 ? '99+' : count}</span> : null}
            </NavLink>
          )
        })}
      </div>
      <div className="nav-user">
        <div className="nav-user-row">
          <div className="avatar" aria-hidden="true">
            {initials(profile?.name || profile?.email)}
          </div>
          <div className="nav-user-meta">
            <div className="nav-user-name">{profile?.name || profile?.email || 'Account'}</div>
            <div className="nav-user-role">{roleLabel(activeRole)}</div>
          </div>
        </div>
        {switchable.length > 1 ? (
          <div className="role-switch role-switch-stack">
            {switchable.map((role) => (
              <button
                key={role}
                type="button"
                className={activeRole === role ? 'on' : ''}
                onClick={() => {
                  setActiveRole(role)
                  navigate(`/${role}`)
                }}
              >
                {roleLabel(role)}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="btn ghost nav-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  )
}
