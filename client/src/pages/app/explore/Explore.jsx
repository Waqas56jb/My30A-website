import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { guest, useGuestQuery } from '../../../lib/guestApi.js'
import { BackButton, CategoryTile, ExploreShell, TileSkeleton } from './ExploreShared.jsx'

// Live categories first; the photo grid only renders once real data (with real photos and
// partner counts) is here — a shimmer grid holds the space on a cold load.
function ordered(categories) {
  // Lead with the biggest real category as the wide feature tile; "coming soon" tiles go last.
  const live = categories.filter((c) => !c.coming_soon)
  const soon = categories.filter((c) => c.coming_soon)
  const lead = [...live].sort((a, b) => (b.count || 0) - (a.count || 0))[0]
  return lead ? [lead, ...live.filter((c) => c !== lead), ...soon] : categories
}

export default function Explore() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data } = useGuestQuery(guest.explore, [])
  const categories = data?.categories ? ordered(data.categories) : null
  const partners = categories?.reduce((sum, c) => sum + (c.coming_soon ? 0 : c.count || 0), 0)

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
        <div className="app-exp-intro app-enter">
          <h2>Browse by Category</h2>
          <p>
            {partners
              ? `${partners} vetted local partners — dining, beaches, activities and essentials`
              : 'Dining, beaches, activities and local essentials'}
          </p>
        </div>

        <form onSubmit={onSearch} className="app-exp-search-form app-enter">
          <label className="app-exp-search">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search places, restaurants, or things to do"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </form>

        <div className="app-exp-grid">
          {categories ? (
            categories.map((category, i) => (
              <CategoryTile key={category.key} category={category} featured={i === 0} index={i} />
            ))
          ) : (
            <TileSkeleton />
          )}
        </div>
      </div>
    </ExploreShell>
  )
}
