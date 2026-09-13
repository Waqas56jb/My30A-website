import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { BackButton, CATEGORIES, ExploreShell } from './ExploreShared.jsx'

export default function Explore() {
  return (
    <ExploreShell>
      <header className="app-xfer-head">
        <BackButton to="/app/home" />
        <h1 className="app-xfer-title">Explore 30A</h1>
        <span className="app-xfer-spacer" aria-hidden="true" />
      </header>

      <div className="app-exp-body">
        <div className="app-exp-intro">
          <h2>Browse by Category</h2>
          <p>discover dining, beaches, activities, and local essentials</p>
        </div>

        <label className="app-exp-search">
          <Search size={18} strokeWidth={1.5} aria-hidden="true" />
          <input type="search" placeholder="Search places, restaurants, or things to do" />
        </label>

        <div className="app-exp-grid">
          {CATEGORIES.map(({ key, label, tone, Icon, to }) => (
            <Link key={key} to={to} className="app-exp-cat">
              <span className={`app-exp-cat-ico is-${tone}`} aria-hidden="true">
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </ExploreShell>
  )
}
