import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clock, Coffee, MapPin, Search, Star, UtensilsCrossed, Wine, X } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { BrandArt, ExploreHead, ExploreShell, FadeImg } from './ExploreShared.jsx'

// Dining guide: the client's real list of restaurants, bars and coffee & breakfast spots.
// Guests pick a type (tabs), then narrow by community and by cuisine / vibe — every choice lives in
// the URL, so Back from a restaurant returns to exactly the same filtered list.
const TYPES = [
  { key: 'restaurant', label: 'Restaurants', Icon: UtensilsCrossed },
  { key: 'bar', label: 'Bars', Icon: Wine },
  { key: 'coffee', label: 'Coffee & Breakfast', Icon: Coffee },
]
const PAGE = 24

function countBy(list, pick) {
  const out = new Map()
  for (const item of list) for (const key of [].concat(pick(item) || [])) out.set(key, (out.get(key) || 0) + 1)
  return [...out.entries()].sort((a, b) => b[1] - a[1])
}

function DiningCard({ place, index }) {
  return (
    <Link to={place.to} className="app-dine-card app-rise" style={{ '--i': Math.min(index % PAGE, 11) }}>
      <span className="app-dine-media app-fade-bg">
        {place.image ? (
          <FadeImg src={place.image} alt="" loading={index < 6 ? 'eager' : 'lazy'} width={220} height={220} />
        ) : (
          <BrandArt name={place.name} guideSlug={`dining-${place.type}`} />
        )}
        {place.open_now !== null ? (
          <span className={`app-dine-open${place.open_now ? ' is-open' : ''}`}>
            {place.open_now ? (
              <>
                <span className="app-live-dot" aria-hidden="true" />
                Open now
              </>
            ) : (
              'Closed now'
            )}
          </span>
        ) : null}
        {place.price ? <span className="app-dine-price">{place.price}</span> : null}
      </span>
      <span className="app-dine-body">
        <strong>{place.name}</strong>
        <span className="app-dine-meta">
          <MapPin size={11} strokeWidth={2} aria-hidden="true" />
          <span>{place.community}</span>
        </span>
        <span className="app-dine-sub">
          {place.rating ? (
            <>
              <Star size={11} strokeWidth={0} fill="#f5b50a" aria-hidden="true" />
              <b>{place.rating.toFixed(1)}</b>
              <i aria-hidden="true">·</i>
            </>
          ) : null}
          <span>{place.cuisine || TYPES.find((t) => t.key === place.type)?.label}</span>
        </span>
        {place.today && place.today !== 'Closed today' ? (
          <span className="app-dine-hours">
            <Clock size={11} strokeWidth={2} aria-hidden="true" />
            {place.today}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

function DiningSkeleton() {
  return Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="app-dine-card is-skel" aria-hidden="true">
      <span className="app-dine-media app-skel" />
      <span className="app-dine-body">
        <span className="app-skel app-skel-line" style={{ width: '85%', height: 14 }} />
        <span className="app-skel app-skel-line" style={{ width: '55%' }} />
      </span>
    </span>
  ))
}

export default function Dining() {
  const [params, setParams] = useSearchParams()
  const type = TYPES.some((t) => t.key === params.get('type')) ? params.get('type') : 'restaurant'
  const area = params.get('area') || ''
  const tag = params.get('tag') || ''
  const openOnly = params.get('open') === '1'
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)
  const sentinel = useRef(null)

  const { data, error } = useGuestQuery(guest.dining, [])
  const all = data?.places || null

  const update = (patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setParams(next, { replace: true })
  }

  const ofType = useMemo(() => (all || []).filter((p) => p.type === type), [all, type])
  const typeCounts = useMemo(() => Object.fromEntries(countBy(all || [], (p) => p.type)), [all])
  const areas = useMemo(() => countBy(ofType, (p) => p.community), [ofType])
  const inArea = useMemo(() => (area ? ofType.filter((p) => p.community === area) : ofType), [ofType, area])
  const tags = useMemo(() => countBy(inArea, (p) => p.tags).filter(([, n]) => n >= 2).slice(0, 14), [inArea])
  const openCount = inArea.filter((p) => p.open_now).length

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inArea.filter(
      (p) =>
        (!tag || p.tags.includes(tag)) &&
        (!openOnly || p.open_now) &&
        (!needle || `${p.name} ${p.cuisine || ''} ${p.community} ${p.tags.join(' ')}`.toLowerCase().includes(needle))
    )
  }, [inArea, tag, openOnly, q])

  useEffect(() => setShown(PAGE), [type, area, tag, openOnly, q])

  // Infinite scroll: render 24 cards at a time so a 160-place list stays instant.
  useEffect(() => {
    const el = sentinel.current
    if (!el || shown >= results.length) return undefined
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE)
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown, results.length])

  const filtered = area || tag || openOnly || q.trim()
  const typeLabel = TYPES.find((t) => t.key === type).label

  return (
    <ExploreShell className="app-dine">
      <ExploreHead
        title="Dining on 30A"
        sub={all ? `${all.length} local favorites — restaurants, bars & coffee` : 'Local favorites along 30A'}
        back="/app/explore"
      />

      <div className="app-exp-body app-dine-body-wrap">
        <div className="app-dine-tabs" role="tablist" style={{ '--tab': TYPES.findIndex((t) => t.key === type) }}>
          <span className="app-dine-tab-pill" aria-hidden="true" />
          {TYPES.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={type === key}
              className={`app-dine-tab${type === key ? ' is-on' : ''}`}
              onClick={() => update({ type: key, area: '', tag: '' })}
            >
              <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
              <span>{key === 'coffee' ? 'Coffee' : label}</span>
              {typeCounts[key] ? <small>{typeCounts[key]}</small> : null}
            </button>
          ))}
        </div>

        <label className="app-exp-search">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            placeholder={`Search ${typeLabel.toLowerCase()}, cuisine or area`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? (
            <button type="button" className="app-dine-clear" aria-label="Clear search" onClick={() => setQ('')}>
              <X size={16} strokeWidth={2} />
            </button>
          ) : null}
        </label>

        <section className="app-dine-filter">
          <h2 className="app-dine-h">Community</h2>
          <div className="app-dine-chips" role="listbox" aria-label="Community">
            <button type="button" className={`app-dine-chip${!area ? ' is-on' : ''}`} onClick={() => update({ area: '', tag: '' })}>
              All 30A <small>{ofType.length}</small>
            </button>
            {areas.map(([name, n]) => (
              <button
                key={name}
                type="button"
                className={`app-dine-chip${area === name ? ' is-on' : ''}`}
                onClick={() => update({ area: area === name ? '' : name, tag: '' })}
              >
                {name} <small>{n}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="app-dine-filter">
          <h2 className="app-dine-h">Cuisine &amp; vibe</h2>
          <div className="app-dine-chips">
            {openCount ? (
              <button type="button" className={`app-dine-chip is-green${openOnly ? ' is-on' : ''}`} onClick={() => update({ open: openOnly ? '' : '1' })}>
                <span className="app-live-dot" aria-hidden="true" /> Open now <small>{openCount}</small>
              </button>
            ) : null}
            {tags.map(([name, n]) => (
              <button key={name} type="button" className={`app-dine-chip is-soft${tag === name ? ' is-on' : ''}`} onClick={() => update({ tag: tag === name ? '' : name })}>
                {name} <small>{n}</small>
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        <div className="app-dine-count">
          <strong>
            {all ? `${results.length} ${results.length === 1 ? 'place' : 'places'}` : 'Loading…'}
          </strong>
          {filtered ? (
            <button type="button" onClick={() => (setQ(''), update({ area: '', tag: '', open: '' }))}>
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="app-dine-grid">
          {all ? results.slice(0, shown).map((place, i) => <DiningCard key={place.id} place={place} index={i} />) : <DiningSkeleton />}
        </div>
        {all && shown < results.length ? <span ref={sentinel} className="app-dine-sentinel" aria-hidden="true" /> : null}
        {all && results.length === 0 ? (
          <p className="app-empty">No matches — try another community or clear the filters.</p>
        ) : null}
      </div>
    </ExploreShell>
  )
}
