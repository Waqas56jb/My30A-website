import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleUserRound, Compass, Home, LayoutGrid, Sparkles } from 'lucide-react'

// Grid columns: 0 Home · 1 Services · 2 (Vitoria FAB) · 3 Profile · 4 Explore
const ITEMS = [
  { key: 'home', to: '/app/home', label: 'Home', Icon: Home, col: 0 },
  { key: 'services', to: '/app/services', label: 'Services', Icon: LayoutGrid, col: 1 },
  { key: 'profile', to: '/app/profile', label: 'Profile', Icon: CircleUserRound, col: 3 },
  { key: 'explore', to: '/app/explore', label: 'Explore', Icon: Compass, col: 4 },
]

// Each screen mounts its own nav, so remember the last active column at module level and
// slide the indicator from there to the new tab — it reads like one persistent tab bar.
let lastCol = null

export default function BottomNav({ active }) {
  const target = ITEMS.find((item) => item.key === active)?.col ?? null
  const [col, setCol] = useState(lastCol ?? target)

  useEffect(() => {
    if (target === null) return undefined
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setCol(target))
    })
    lastCol = target
    return () => cancelAnimationFrame(frame)
  }, [target])

  return (
    <nav className="app-home-nav" aria-label="Primary">
      {target !== null && col !== null ? (
        <span className="app-home-nav-indicator" style={{ '--col': col }} aria-hidden="true">
          <i />
        </span>
      ) : null}
      {ITEMS.map(({ key, to, label, Icon, col: c }) => {
        const isActive = active === key
        return (
          <Link
            key={key}
            to={to}
            className={`app-home-nav-item${isActive ? ' is-active' : ''}`}
            style={{ gridColumn: c + 1 }}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="app-home-nav-ico">
              <Icon size={20} strokeWidth={isActive ? 2 : 1.6} aria-hidden="true" />
            </span>
            <span className="app-home-nav-label">{label}</span>
          </Link>
        )
      })}
      <Link
        to="/app/vitoria"
        className={`app-home-nav-fab${active === 'vitoria' ? ' is-active' : ''}`}
        aria-label="Ask Vitoria"
      >
        <span className="app-home-nav-fab-core">
          <Sparkles size={20} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="app-home-nav-label">Vitoria</span>
      </Link>
    </nav>
  )
}
