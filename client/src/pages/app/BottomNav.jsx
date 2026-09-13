import { Link } from 'react-router-dom'
import { CircleUserRound, Compass, Home, LayoutGrid, Sparkles } from 'lucide-react'

function itemClass(key, active, plain) {
  return `app-home-nav-item${active === key ? ' is-active' : ''}${plain ? ' is-plain' : ''}`
}

export default function BottomNav({ active }) {
  return (
    <nav className="app-home-nav" aria-label="Primary">
      <Link
        to="/app/home"
        className={itemClass('home', active)}
        aria-current={active === 'home' ? 'page' : undefined}
      >
        <Home size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Home</span>
      </Link>
      <Link
        to="/app/services"
        className={itemClass('services', active, true)}
        aria-current={active === 'services' ? 'page' : undefined}
      >
        <LayoutGrid size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Services</span>
      </Link>
      <span className="app-home-nav-spacer" aria-hidden="true" />
      <Link
        to="/app/profile"
        className={itemClass('profile', active)}
        aria-current={active === 'profile' ? 'page' : undefined}
      >
        <CircleUserRound size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Profile</span>
      </Link>
      <Link
        to="/app/explore"
        className={itemClass('explore', active)}
        aria-current={active === 'explore' ? 'page' : undefined}
      >
        <Compass size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Explore</span>
      </Link>
      <Link to="/app/vitoria" className="app-home-nav-fab" aria-label="Vitoria">
        <Sparkles size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>Vitoria</span>
      </Link>
    </nav>
  )
}
