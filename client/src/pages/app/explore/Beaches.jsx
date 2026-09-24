import { useMemo, useState } from 'react'
import { Accessibility, Bike, Car, Dog, Flame, Info, MapPin, Navigation, Search, Toilet, TreePine, Umbrella } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell, FadeImg } from './ExploreShared.jsx'

// Beaches: every Walton County public beach access along 30A, west → east, as real cards —
// filter by community and by what a beach day needs (parking, restrooms, accessible, dogs).
const FLAGS = [
  { tone: 'green', label: 'Low hazard' },
  { tone: 'yellow', label: 'Medium' },
  { tone: 'red', label: 'High hazard' },
  { tone: 'double', label: 'Water closed' },
  { tone: 'purple', label: 'Marine pests' },
]

const FILTERS = [
  { key: 'parking', label: 'Parking', Icon: Car, test: (b) => !b.walk_only && (b.spaces > 0 || b.state_park) },
  { key: 'restroom', label: 'Restrooms', Icon: Toilet, test: (b) => b.restroom },
  { key: 'accessible', label: 'Accessible', Icon: Accessibility, test: (b) => b.accessible },
  { key: 'dogs', label: 'Dog friendly', Icon: Dog, test: (b) => b.dogs },
  { key: 'walk', label: 'Walk-in', Icon: Bike, test: (b) => b.walk_only },
]

function FactChips({ beach }) {
  return (
    <span className="app-beach-facts">
      {beach.facts.map((f) => (
        <span key={f}>{f}</span>
      ))}
    </span>
  )
}

function FeaturedCard({ beach, index }) {
  return (
    <a href={beach.directions} target="_blank" rel="noreferrer" className="app-beach-feature app-rise" style={{ '--i': index }}>
      <span className="app-beach-feature-media app-fade-bg">
        <FadeImg src={beach.image} alt="" loading={index < 2 ? 'eager' : 'lazy'} />
      </span>
      <span className="app-beach-feature-top">
        <span className="app-beach-pill">
          {beach.state_park ? <TreePine size={12} strokeWidth={2} aria-hidden="true" /> : <Umbrella size={12} strokeWidth={2} aria-hidden="true" />}
          {beach.category}
        </span>
      </span>
      <span className="app-beach-feature-foot">
        <strong>{beach.name}</strong>
        <small>
          <MapPin size={12} strokeWidth={2} aria-hidden="true" />
          {beach.area}
        </small>
        <FactChips beach={beach} />
      </span>
    </a>
  )
}

function BeachRow({ beach, index }) {
  return (
    <article className="app-beach-row app-rise" style={{ '--i': Math.min(index, 11) }}>
      <span className={`app-beach-badge${beach.state_park ? ' is-park' : beach.regional ? ' is-rba' : ''}`} aria-hidden="true">
        {beach.state_park ? <TreePine size={22} strokeWidth={1.6} /> : <Umbrella size={20} strokeWidth={1.6} />}
        {beach.number ? <b>#{beach.number}</b> : null}
      </span>
      <span className="app-beach-body">
        <strong>{beach.name}</strong>
        <span className="app-beach-meta">
          <MapPin size={11} strokeWidth={2} aria-hidden="true" />
          {beach.area} · {beach.category}
        </span>
        <FactChips beach={beach} />
        <span className="app-beach-addr">{beach.why}</span>
        {beach.note ? (
          <span className="app-beach-note">
            <Flame size={11} strokeWidth={2} aria-hidden="true" />
            {beach.note}
          </span>
        ) : null}
      </span>
      <a href={beach.directions} target="_blank" rel="noreferrer" className="app-beach-go" aria-label={`Directions to ${beach.name}`}>
        <Navigation size={16} strokeWidth={2} aria-hidden="true" />
      </a>
    </article>
  )
}

export default function Beaches() {
  const { data, error } = useGuestQuery(guest.beaches, [])
  const [area, setArea] = useState('')
  const [on, setOn] = useState([])
  const [q, setQ] = useState('')
  const all = data?.beaches || null

  // Communities in the order you meet them driving 30A west → east.
  const areas = useMemo(() => {
    const seen = new Map()
    for (const b of all || []) seen.set(b.area, (seen.get(b.area) || 0) + 1)
    return [...seen.entries()]
  }, [all])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (all || []).filter(
      (b) =>
        (!area || b.area === area) &&
        on.every((key) => FILTERS.find((f) => f.key === key).test(b)) &&
        (!needle || `${b.name} ${b.area} ${b.why}`.toLowerCase().includes(needle))
    )
  }, [all, area, on, q])

  const toggle = (key) => setOn((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))

  return (
    <ExploreShell nav={false} className="app-beaches">
      <ExploreHead
        title="Beaches"
        sub={all ? `${all.length} public beach accesses along 30A, straight from Walton County` : 'Every public beach access along 30A'}
        back="/app/explore"
      />

      <div className="app-exp-body app-beach-wrap">
        <section className="app-beach-flags app-enter" aria-label="Beach warning flags">
          <strong>Check the flag before you swim</strong>
          <span className="app-beach-flag-row">
            {FLAGS.map((f) => (
              <span key={f.tone} className={`app-beach-flag is-${f.tone}`}>
                <i aria-hidden="true" />
                {f.label}
              </span>
            ))}
          </span>
        </section>

        {data?.featured?.length ? (
          <section className="app-beach-section">
            <h2 className="app-dine-h">Best-equipped beaches</h2>
            <div className="app-beach-features">
              {data.featured.map((b, i) => (
                <FeaturedCard key={b.name} beach={b} index={i} />
              ))}
            </div>
          </section>
        ) : null}

        <label className="app-exp-search">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input type="search" placeholder="Search an access, street or area" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        <section className="app-dine-filter">
          <h2 className="app-dine-h">Community</h2>
          <div className="app-dine-chips">
            <button type="button" className={`app-dine-chip${!area ? ' is-on' : ''}`} onClick={() => setArea('')}>
              All 30A <small>{all?.length || ''}</small>
            </button>
            {areas.map(([name, n]) => (
              <button key={name} type="button" className={`app-dine-chip${area === name ? ' is-on' : ''}`} onClick={() => setArea(area === name ? '' : name)}>
                {name} <small>{n}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="app-dine-filter">
          <h2 className="app-dine-h">What you need</h2>
          <div className="app-dine-chips">
            {FILTERS.map(({ key, label, Icon }) => (
              <button key={key} type="button" className={`app-dine-chip is-soft${on.includes(key) ? ' is-on' : ''}`} onClick={() => toggle(key)}>
                <Icon size={14} strokeWidth={1.9} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        <div className="app-dine-count">
          <strong>{all ? `${list.length} ${list.length === 1 ? 'access' : 'accesses'}` : 'Loading…'}</strong>
          {area || on.length || q ? (
            <button type="button" onClick={() => (setArea(''), setOn([]), setQ(''))}>
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="app-beach-list">
          {all
            ? list.map((b, i) => <BeachRow key={b.name + b.why} beach={b} index={i} />)
            : Array.from({ length: 5 }, (_, i) => <span key={i} className="app-beach-row app-skel" style={{ height: 118 }} aria-hidden="true" />)}
        </div>
        {all && !list.length ? <p className="app-empty">No accesses match — try another community or fewer filters.</p> : null}

        <div className="app-xfer-note is-info is-lg">
          <Info size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            From Walton County’s official public beach access list and{' '}
            <a href="https://www.visitsouthwalton.com" target="_blank" rel="noreferrer">
              Visit South Walton
            </a>
            . Parking fills early in summer — arrive before 10am.
          </span>
        </div>
      </div>
    </ExploreShell>
  )
}
