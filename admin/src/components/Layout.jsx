import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Car,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingBasket,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useQuery } from '../lib/useQuery.js'
import ChangePassword from './ChangePassword.jsx'
import { useToast } from './Toast.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transfers', label: 'Transfers', icon: Car },
  { to: '/grocery', label: 'Grocery', icon: ShoppingBasket },
  { to: '/payouts', label: 'Payouts', icon: Wallet },
  { to: '/people', label: 'People', icon: Users },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const mainRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { data: dashboard } = useQuery('/api/dashboard')
  const flaggedCount = dashboard?.flagged_count || 0

  useEffect(() => {
    const node = mainRef.current
    if (!node) return undefined
    function onScroll() {
      setScrolled(node.scrollTop > 8)
    }
    onScroll()
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Menu size={18} />
        </button>
        <div className="brand">
          My30A Host<small>Admin</small>
        </div>
      </header>
      {menuOpen ? (
        <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside className="side">
        <div className="brand">
          My30A Host<small>Admin</small>
        </div>
        <button type="button" className="icon-btn side-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
          <X size={18} />
        </button>
        <nav className="nav">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-label={item.label}
                aria-label={item.label}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} />
                <span className="nav-label">{item.label}</span>
                {item.to === '/transfers' && flaggedCount > 0 ? (
                  <span className="badge">{flaggedCount}</span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>
        <div className="me">
          <b>{profile?.name || profile?.email}</b>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            data-label="Change password"
            aria-label="Change password"
          >
            <KeyRound size={18} />
            <span className="nav-label">Change password</span>
          </button>
          <button type="button" onClick={signOut} data-label="Sign out" aria-label="Sign out">
            <LogOut size={18} />
            <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>
      <main ref={mainRef} className={scrolled ? 'is-scrolled' : ''}>
        <Outlet />
      </main>
      <ChangePassword
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSuccess={() => toast.success('Password changed')}
      />
    </div>
  )
}
