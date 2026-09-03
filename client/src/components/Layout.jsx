import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { formatUpdatedAgo, initials, roleLabel } from '../lib/format.js'
import AppNav from './AppNav.jsx'
import ChangePassword from './ChangePassword.jsx'
import { useToast } from './Toast.jsx'

const PANEL_ROLES = ['driver', 'partner', 'shopper']
const HeaderContext = createContext(null)

export function usePageHeader(title, sub, meta) {
  const setHeader = useContext(HeaderContext)
  const updatedAt = meta?.updatedAt ?? null
  useEffect(() => {
    if (!setHeader) return undefined
    setHeader({ title, sub, updatedAt })
    return () => setHeader({ title: '', sub: '', updatedAt: null })
  }, [setHeader, title, sub, updatedAt])
}

export default function Layout({ children }) {
  const { profile, activeRole, setActiveRole, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [header, setHeader] = useState({ title: '', sub: '', updatedAt: null })
  const [now, setNow] = useState(() => Date.now())
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const menuRef = useRef(null)
  const switchable = (profile?.roles || []).filter((role) => PANEL_ROLES.includes(role))
  const hasNav = Boolean(activeRole && PANEL_ROLES.includes(activeRole))
  const updatedLabel = header.updatedAt ? formatUpdatedAgo(header.updatedAt, now) : ''

  useEffect(() => {
    if (!header.updatedAt) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [header.updatedAt])

  useEffect(() => {
    if (!menuOpen) return undefined
    function onDoc(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const value = useMemo(() => setHeader, [])

  return (
    <HeaderContext.Provider value={value}>
      <div className={`app${hasNav ? ' has-nav' : ''}`} data-role={activeRole || undefined}>
        {hasNav ? <AppNav /> : null}
        <div className="app-body">
          <header className="top">
            <div>
              <h1>{header.title || 'My30A Host'}</h1>
              {header.sub ? <div className="sub">{header.sub}</div> : null}
              {updatedLabel ? <div className="poll">{updatedLabel}</div> : null}
            </div>
            <div className="top-actions">
              {switchable.length > 1 ? (
                <div className="role-switch">
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
              <div className="avatar-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="avatar"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {initials(profile?.name || profile?.email)}
                </button>
                {menuOpen ? (
                  <div className="avatar-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        setPasswordOpen(true)
                      }}
                    >
                      Change password
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        signOut()
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
        <ChangePassword
          open={passwordOpen}
          onClose={() => setPasswordOpen(false)}
          onSuccess={() => toast.success('Password changed')}
        />
      </div>
    </HeaderContext.Provider>
  )
}
