import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Baby,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Clock,
  ExternalLink,
  Info,
  MapPin,
  Music,
  Navigation,
  Palette,
  PartyPopper,
  Search,
  ShoppingBasket,
  Trophy,
  UtensilsCrossed,
  Waves,
} from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell, FadeImg } from './ExploreShared.jsx'

// Events along 30A from 30a.com (organizer-submitted — the page says so): today / this weekend /
// this month, filter by category and community, grouped by day. Filters live in the URL.
const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'weekend', label: 'This Weekend' },
  { key: 'month', label: 'This Month' },
]
const CATEGORY_ICONS = {
  'Live Music': Music,
  'Food & Drink': UtensilsCrossed,
  Markets: ShoppingBasket,
  'Festivals & Community': PartyPopper,
  'Arts & Culture': Palette,
  'Kids & Family': Baby,
  'Fitness & Outdoors': Waves,
  'Games & Sports': Trophy,
}
const CATEGORY_TONES = {
  'Live Music': 'violet',
  'Food & Drink': 'sand',
  Markets: 'lime',
  'Festivals & Community': 'peach',
  'Arts & Culture': 'pink',
  'Kids & Family': 'sea',
  'Fitness & Outdoors': 'leaf',
  'Games & Sports': 'slate',
}

// Day keys are "YYYY-MM-DD" in 30A time (from the API); do date math at noon UTC to dodge DST.
const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const weekday = (key) => new Date(`${key}T12:00:00Z`).getUTCDay() // 0 Sun … 6 Sat
function rangeDays(range, today) {
  if (range === 'today') return [today]
  if (range === 'weekend') {
    const wd = weekday(today)
    const friday = wd === 0 ? addDays(today, -2) : wd === 6 ? addDays(today, -1) : addDays(today, 5 - wd)
    return [friday, addDays(friday, 1), addDays(friday, 2)].filter((d) => d >= today)
  }
  return Array.from({ length: 30 }, (_, i) => addDays(today, i))
}
function dayLabel(key, today) {
  const d = new Date(`${key}T12:00:00Z`)
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (key === today) return `Today · ${date.split(', ').slice(1).join(', ')}`
  if (key === addDays(today, 1)) return `Tomorrow · ${date.split(', ').slice(1).join(', ')}`
  return date
}

function EventCard({ event, index }) {
  const [open, setOpen] = useState(false)
  const Icon = CATEGORY_ICONS[event.category] || CalendarDays
  const tone = CATEGORY_TONES[event.category] || 'sea'
  return (
    <article className={`app-ev-card app-rise${open ? ' is-open' : ''}`} style={{ '--i': Math.min(index, 11) }}>
      <button type="button" className="app-ev-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="app-ev-media app-fade-bg">
          {event.image ? (
            <FadeImg
              src={event.image}
              alt=""
              loading={index < 5 ? 'eager' : 'lazy'}
              width={104}
              height={104}
              fallback={
                <span className={`app-exp-art is-${tone}`}>
                  <Icon size={28} strokeWidth={1.5} />
                </span>
              }
            />
          ) : (
            <span className={`app-exp-art is-${tone}`}>
              <Icon size={28} strokeWidth={1.5} />
            </span>
          )}
        </span>
        <span className="app-ev-body">
          <span className="app-ev-time">
            <Clock size={11} strokeWidth={2.2} aria-hidden="true" />
            {event.time}
          </span>
          <strong>{event.title}</strong>
          <span className="app-ev-meta">
            <MapPin size={11} strokeWidth={2} aria-hidden="true" />
            <span>{[event.venue, event.community].filter(Boolean).join(' · ')}</span>
          </span>
          <span className={`app-ev-cat is-${tone}`}>
            <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
            {event.category}
          </span>
        </span>
        <ChevronDown size={18} strokeWidth={2} className="app-ev-chev" aria-hidden="true" />
      </button>
      {open ? (
        <div className="app-ev-more">
          {event.description ? <p>{event.description}</p> : null}
          {event.address ? (
            <p className="app-ev-addr">
              <MapPin size={12} strokeWidth={2} aria-hidden="true" /> {event.address}
            </p>
          ) : null}
          <div className="app-ev-actions">
            <a href={event.calendar} target="_blank" rel="noreferrer" className="app-vit-card-btn is-primary">
              <CalendarPlus size={13} strokeWidth={1.9} aria-hidden="true" />
              Add to calendar
            </a>
            <a href={event.directions} target="_blank" rel="noreferrer" className="app-vit-card-btn">
              <Navigation size={13} strokeWidth={1.9} aria-hidden="true" />
              Directions
            </a>
            <a href={event.url} target="_blank" rel="noreferrer" className="app-vit-card-btn">
              <ExternalLink size={13} strokeWidth={1.9} aria-hidden="true" />
              Details
            </a>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default function Events() {
  const [params, setParams] = useSearchParams()
  const range = RANGES.some((r) => r.key === params.get('when')) ? params.get('when') : 'today'
  const category = params.get('cat') || ''
  const area = params.get('area') || ''
  const [q, setQ] = useState('')
  const { data, error } = useGuestQuery(guest.events, [])
  const today = data?.today

  const update = (patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setParams(next, { replace: true })
  }

  const inRange = useMemo(() => {
    if (!data) return []
    const days = new Set(rangeDays(range, today))
    return data.events.filter((e) => days.has(e.day))
  }, [data, range, today])

  const count = (list, pick) => {
    const m = new Map()
    for (const e of list) if (pick(e)) m.set(pick(e), (m.get(pick(e)) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const categories = useMemo(() => count(inRange, (e) => e.category), [inRange])
  const areas = useMemo(() => count(inRange, (e) => e.community), [inRange])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inRange.filter(
      (e) =>
        (!category || e.category === category) &&
        (!area || e.community === area) &&
        (!needle || `${e.title} ${e.venue || ''} ${e.community || ''} ${e.category}`.toLowerCase().includes(needle))
    )
  }, [inRange, category, area, q])

  const byDay = useMemo(() => {
    const groups = new Map()
    for (const e of shown) {
      if (!groups.has(e.day)) groups.set(e.day, [])
      groups.get(e.day).push(e)
    }
    return [...groups.entries()]
  }, [shown])

  return (
    <ExploreShell className="app-events">
      <ExploreHead title="Events on 30A" sub="Live music, markets, festivals and family fun" back="/app/explore" />

      <div className="app-exp-body app-dine-body-wrap">
        <div className="app-dine-tabs" role="tablist" style={{ '--tab': RANGES.findIndex((r) => r.key === range) }}>
          <span className="app-dine-tab-pill" aria-hidden="true" />
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              className={`app-dine-tab${range === r.key ? ' is-on' : ''}`}
              onClick={() => update({ when: r.key, cat: '', area: '' })}
            >
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        <label className="app-exp-search">
          <Search size={18} strokeWidth={1.8} aria-hidden="true" />
          <input type="search" placeholder="Search events, venues or bands" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        {categories.length ? (
          <section className="app-dine-filter">
            <h2 className="app-dine-h">What’s on</h2>
            <div className="app-dine-chips">
              <button type="button" className={`app-dine-chip${!category ? ' is-on' : ''}`} onClick={() => update({ cat: '' })}>
                Everything <small>{inRange.length}</small>
              </button>
              {categories.map(([name, n]) => {
                const Icon = CATEGORY_ICONS[name] || CalendarDays
                return (
                  <button key={name} type="button" className={`app-dine-chip is-soft${category === name ? ' is-on' : ''}`} onClick={() => update({ cat: category === name ? '' : name })}>
                    <Icon size={14} strokeWidth={1.9} aria-hidden="true" /> {name} <small>{n}</small>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        {areas.length > 1 ? (
          <section className="app-dine-filter">
            <h2 className="app-dine-h">Where</h2>
            <div className="app-dine-chips">
              <button type="button" className={`app-dine-chip${!area ? ' is-on' : ''}`} onClick={() => update({ area: '' })}>
                All areas
              </button>
              {areas.map(([name, n]) => (
                <button key={name} type="button" className={`app-dine-chip${area === name ? ' is-on' : ''}`} onClick={() => update({ area: area === name ? '' : name })}>
                  {name} <small>{n}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        {!data ? (
          <div className="app-ev-list">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="app-ev-card app-skel" style={{ height: 128 }} aria-hidden="true" />
            ))}
          </div>
        ) : byDay.length ? (
          byDay.map(([day, list]) => (
            <section key={day} className="app-ev-day">
              <h2 className="app-ev-day-head">
                {dayLabel(day, today)} <small>{list.length}</small>
              </h2>
              <div className="app-ev-list">
                {list.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="app-empty">
            {range === 'today' ? 'Nothing else listed for today — try This Weekend.' : 'No events match — try another category or area.'}
          </p>
        )}

        <div className="app-xfer-note is-info is-lg">
          <Info size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            Events are listed by organizers on{' '}
            <a href="https://30a.com/events/" target="_blank" rel="noreferrer">
              30a.com
            </a>
            . Plans can change — check the details link before you head out.
          </span>
        </div>
      </div>
    </ExploreShell>
  )
}
