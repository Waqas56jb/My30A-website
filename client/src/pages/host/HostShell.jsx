import { useEffect } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BarChart3, Home, LogOut, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import HostOverview from './HostOverview.jsx'
import HostProperty from './HostProperty.jsx'
import HostCheckoutDone from './HostCheckoutDone.jsx'

// Host dashboard (my30ahost.com/host) for Host Version subscribers: their properties, QR codes,
// guest activity and billing. Sign-in at /host/login.
export default function HostShell() {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()

  useEffect(() => {
    document.title = 'Host dashboard · My30A Host'
  }, [])

  if (loading) {
    return (
      <div className="hp">
        <p className="hp-loading">Loading…</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/host/login" replace state={{ from: location.pathname + location.search }} />
  if (profile && !(profile.roles || []).includes('host')) {
    return (
      <div className="hp hp-center">
        <div className="hp-card hp-narrow">
          <img src="/brand/my30a-logo.webp" alt="My30A Host" className="hp-card-logo" />
          <h1>This isn’t a host account</h1>
          <p className="hp-muted">
            You’re signed in as {profile.email}. The host dashboard is for Host Version subscribers —{' '}
            <Link to="/hosts">see plans</Link>.
          </p>
          <button type="button" className="hp-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="hp">
      <header className="hp-top">
        <Link to="/host" className="hp-brand">
          <img src="/brand/my30a-logo.webp" alt="My30A Host" />
          <span>Host</span>
        </Link>
        <nav className="hp-nav" aria-label="Host">
          <NavLink to="/host" end>
            <Home size={16} /> Properties
          </NavLink>
          <NavLink to="/host/homes/new">
            <Plus size={16} /> Add property
          </NavLink>
        </nav>
        <div className="hp-user">
          <span>{profile?.name || profile?.email}</span>
          <button type="button" className="hp-icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}>
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main className="hp-main">
        <Routes>
          <Route index element={<HostOverview />} />
          <Route path="welcome" element={<HostCheckoutDone />} />
          <Route path="homes/new" element={<HostProperty />} />
          <Route path="homes/:id" element={<HostProperty />} />
          <Route path="*" element={<Navigate to="/host" replace />} />
        </Routes>
      </main>
      <footer className="hp-foot">
        <BarChart3 size={14} /> Guest activity shows counts and topics only — never who a guest is or what they wrote.
      </footer>
    </div>
  )
}
