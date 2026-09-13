import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { guest, useGuestQuery } from '../../../lib/guestApi.js'
import { BackButton, CATEGORIES, ExploreShell, iconFor } from './ExploreShared.jsx'

export default function Explore() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data } = useGuestQuery(guest.explore, [])
  const categories = data?.categories || CATEGORIES

  const onSearch = (e) => {
    e.preventDefault()
    const clean = q.trim()
    navigate(clean ? `/app/explore/guide?q=${encodeURIComponent(clean)}` : '/app/explore/guide')
  }

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

        <form onSubmit={onSearch}>
          <label className="app-exp-search">
            <Search size={18} strokeWidth={1.5} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search places, restaurants, or things to do"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </form>

        <div className="app-exp-grid">
          {categories.map(({ key, label, tone, icon, to }) => {
            const Icon = iconFor(icon)
            return (
              <Link key={key} to={to} className="app-exp-cat">
                <span className={`app-exp-cat-ico is-${tone}`} aria-hidden="true">
                  <Icon size={20} strokeWidth={1.5} />
                </span>
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </ExploreShell>
  )
}
