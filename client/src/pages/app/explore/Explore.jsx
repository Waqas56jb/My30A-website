import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, Search } from 'lucide-react'
import { guest, useGuestQuery } from '../../../lib/guestApi.js'
import { BackButton, CategoryTile, DINING_KEYS, ExploreShell, TileSkeleton, iconFor, themeOf } from './ExploreShared.jsx'

// Explore = the main places (dining, events, beaches, public info) as big photo tiles, then every
// one of the 20 local-service categories as its own tile, grouped under its family (Golf & Outdoor,
// Family & Kids…). Guests pick "Private Chef" or "Pickleball" right here — no extra level.
function ordered(categories) {
  // Lead with the biggest real category as the wide feature tile; "coming soon" tiles go last.
  const live = categories.filter((c) => !c.coming_soon)
  const soon = categories.filter((c) => c.coming_soon)
  const lead = [...live].sort((a, b) => (b.count || 0) - (a.count || 0))[0]
  return lead ? [lead, ...live.filter((c) => c !== lead), ...soon] : categories
}

const partners = (n) => (n === 1 ? 'local partner' : 'local partners')

export default function Explore() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data } = useGuestQuery(guest.explore, [])
  const services = data?.services || null

  // Families that have service categories become section headings; the rest stay tiles.
  const groups = useMemo(() => {
    const out = []
    for (const s of services || []) {
      let g = out.find((x) => x.key === s.group)
      if (!g) out.push((g = { key: s.group, label: s.group_label, items: [] }))
      g.items.push(s)
    }
    return out
  }, [services])
  const grouped = new Set(groups.map((g) => g.key))
  const categories = data?.categories ? ordered(data.categories.filter((c) => !grouped.has(c.key))) : null
  const byKey = Object.fromEntries((data?.categories || []).map((c) => [c.key, c]))
  const partnerTotal = (services || []).reduce((sum, s) => sum + (s.count || 0), 0)
  // Unique places — a restaurant with a bar is in two tabs but is still one place.
  const dining = data?.categories?.find((c) => DINING_KEYS.has(c.key))?.dining_total ?? 0

  const onSearch = (e) => {
    e.preventDefault()
    const clean = q.trim()
    navigate(clean ? `/app/explore/guide?q=${encodeURIComponent(clean)}` : '/app/explore/guide')
  }

  const jump = (key) => document.getElementById(`svc-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

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
            {services
              ? `${dining ? `${dining} restaurants, bars & cafés · ` : ''}${services.length} local services · ${partnerTotal} vetted partners`
              : 'Dining, beaches, activities and local services'}
          </p>
        </div>

        <form onSubmit={onSearch} className="app-exp-search-form app-enter">
          <label className="app-exp-search">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search places, restaurants, or things to do"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="app-exp-search-go" aria-label="Search" disabled={!q.trim()}>
              <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </label>
        </form>

        {groups.length ? (
          <nav className="app-svc-jump app-enter" aria-label="Jump to local services">
            <span className="app-svc-jump-label">Services</span>
            {groups.map((g) => {
              const Icon = iconFor(byKey[g.key]?.icon)
              return (
                <button key={g.key} type="button" onClick={() => jump(g.key)}>
                  <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                  {g.label}
                  <small>{g.items.length}</small>
                </button>
              )
            })}
          </nav>
        ) : null}

        <div className="app-exp-grid">
          {categories ? (
            categories.map((category, i) => (
              <CategoryTile key={category.key} category={category} featured={i === 0} index={i} />
            ))
          ) : (
            <TileSkeleton />
          )}
        </div>

        {groups.length ? (
          <section className="app-svc" aria-labelledby="svc-title">
            <div className="app-svc-head">
              <h2 id="svc-title">Local Services</h2>
              <p>{services.length} categories · tap one to see every partner</p>
            </div>


            {groups.map((g) => {
              const Icon = iconFor(byKey[g.key]?.icon)
              return (
                <div key={g.key} className="app-svc-group" id={`svc-${g.key}`}>
                  <div className="app-svc-group-head">
                    <span className={`app-svc-group-ico is-${byKey[g.key]?.tone || 'sea'}`} aria-hidden="true">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <h3>{g.label}</h3>
                    {g.items.length > 1 ? (
                      <Link to={`/app/explore/guide?c=${encodeURIComponent(g.key)}`} state={{ label: g.label }} className="app-svc-all">
                        See all <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="app-exp-grid">
                    {g.items.map((s, i) => {
                      const theme = themeOf(s.slug)
                      return (
                        <CategoryTile
                          key={s.slug}
                          className="is-service"
                          Icon={theme.Icon}
                          unit={partners(s.count)}
                          index={i}
                          category={{ key: s.slug, label: s.title, tone: theme.tone, image_url: s.image, count: s.count, to: s.to }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        ) : null}
      </div>
    </ExploreShell>
  )
}
