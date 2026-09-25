import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Camera,
  Car,
  Check,
  Clock,
  Flag,
  Info,
  KeyRound,
  Leaf,
  MessageCircle,
  Music,
  Palette,
  Plane,
  Sailboat,
  ShoppingBag,
  Sparkles,
  Umbrella,
  Users,
  UtensilsCrossed,
  Waves,
} from 'lucide-react'

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------------------------ */
/* Services showcase: one phone, the real app screen for each service.      */
/* ------------------------------------------------------------------------ */

const SERVICES = [
  {
    key: 'grocery',
    anchor: 'grocery',
    Icon: ShoppingBag,
    label: 'Grocery Delivery',
    short: 'Groceries',
    title: 'Your kitchen, stocked before you arrive.',
    copy: 'Send us your list. We shop Publix at Watersound Town Center, deliver to your rental, then unpack and put everything away.',
    ticks: ['Your exact Publix receipt, no markup', 'Unpacked and put away', 'Charged only after delivery'],
    price: '$229',
    priceNote: '+ your Publix receipt',
    cta: 'Arrange Groceries',
    screen: '/marketing/screen-grocery.webp',
    photo: '/services/grocery-stocked-kitchen.webp',
    alt: 'Grocery ordering screen in the My30A Host app with Full, Large and XL packs',
    tone: 'gold',
    floats: [
      { Icon: ShoppingBag, title: 'Shopping at Publix', sub: 'Watersound Town Center' },
      { Icon: Check, title: 'Unpacked & put away', sub: 'Fridge and pantry stocked' },
    ],
  },
  {
    key: 'transfer',
    anchor: 'airport-transfer',
    Icon: Plane,
    label: 'Airport Transfer',
    short: 'Transfers',
    title: 'Your ride is waiting.',
    copy: 'Private, door-to-door rides with flight tracking and vetted drivers, from the airport straight to your rental.',
    ticks: ['ECP · VPS · PNS airports', 'Flight tracking and vetted drivers', 'Free cancellation 48h+ before pickup'],
    price: '$85',
    priceNote: 'per ride',
    cta: 'Arrange Transfer',
    screen: '/marketing/screen-transfer.webp',
    photo: '/marketing/transfer-arrival.webp',
    alt: 'Airport transfer booking screen in the My30A Host app',
    tone: 'sea',
    floats: [
      { Icon: Plane, title: 'Flight tracked', sub: 'Your driver sees any delay' },
      { Icon: Car, title: 'Door to door', sub: 'Straight to your rental' },
    ],
  },
  {
    key: 'vitoria',
    anchor: null,
    Icon: Sparkles,
    label: 'Ask Vitoria',
    short: 'Vitoria',
    title: 'A local who knows everything.',
    copy: 'Tables, beaches, charters and tonight’s live music, answered from our own 30A database first. Type, or just talk to her.',
    ticks: ['Photos, hours and booking links', 'Real-time voice conversation', 'Knows all 16 communities'],
    price: null,
    priceNote: 'Included with your stay',
    cta: 'Ask Vitoria',
    screen: '/marketing/screen-vitoria.webp',
    photo: '/marketing/hd/coast.webp',
    alt: 'Vitoria recommending restaurants with photos and hours in the My30A Host app',
    tone: 'violet',
    floats: [
      { Icon: MessageCircle, title: '“Dinner for four tonight?”', sub: 'Answered in seconds' },
      { Icon: AudioLines, title: 'Real-time voice', sub: 'Hands-free on the beach' },
    ],
  },
  {
    key: 'dining',
    anchor: null,
    Icon: UtensilsCrossed,
    label: 'Dining & Beaches',
    short: 'Dining',
    title: '243 places. Every beach access.',
    copy: 'Restaurants, bars and coffee by community, cuisine and open now, plus all 59 public beach accesses with parking and restrooms.',
    ticks: ['Book online on Resy & OpenTable', 'Opening hours on every place', '59 beach accesses with directions'],
    price: null,
    priceNote: 'Free in the app',
    cta: 'Explore 30A',
    screen: '/marketing/screen-dining.webp',
    photo: '/marketing/hd/eat.webp',
    alt: 'Dining on 30A screen listing restaurants, bars and coffee by community',
    tone: 'coral',
    floats: [
      { Icon: Clock, title: 'Open now', sub: 'Hours on every card' },
      { Icon: Waves, title: '59 beach accesses', sub: 'Parking & restrooms noted' },
    ],
  },
  {
    key: 'events',
    anchor: null,
    Icon: CalendarDays,
    label: 'Events & Live Music',
    short: 'Events',
    title: '~600 events every month.',
    copy: 'Live music, markets, festivals and family fun from 30a.com. See what’s on today, this weekend or this month.',
    ticks: ['Today, this weekend or this month', 'Live music, markets, kids & family', 'Filter by community'],
    price: null,
    priceNote: 'Updated daily',
    cta: 'See what’s on',
    screen: '/marketing/screen-events.webp',
    photo: '/marketing/hd/events.webp',
    alt: 'Events on 30A screen with today’s live music and markets',
    tone: 'teal',
    floats: [
      { Icon: Music, title: 'Live music tonight', sub: 'Near your rental' },
      { Icon: CalendarDays, title: 'This weekend', sub: 'Markets & festivals' },
    ],
  },
]

const DURATION = 6500

function Detail({ s }) {
  return (
    <>
      <p className="mkt-sx-copy">{s.copy}</p>
      <ul className="mkt-sx-ticks">
        {s.ticks.map((t) => (
          <li key={t}>
            <Check size={14} strokeWidth={2.4} aria-hidden="true" /> {t}
          </li>
        ))}
      </ul>
      <div className="mkt-sx-foot">
        <p className="mkt-sx-price">
          {s.price ? (
            <>
              <small>From</small> <strong>{s.price}</strong>
            </>
          ) : null}
          <span>{s.priceNote}</span>
        </p>
        <Link className="mkt-btn mkt-btn-gold" to="/app">
          {s.cta} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </>
  )
}

export function ServicesShowcase() {
  const rootRef = useRef(null)
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const [inView, setInView] = useState(false)
  const [hover, setHover] = useState(false)
  const running = auto && inView && !hover && !reduced()

  useEffect(() => {
    const el = rootRef.current
    if (!el || !('IntersectionObserver' in window)) return undefined
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!running) return undefined
    const t = setTimeout(() => setActive((a) => (a + 1) % SERVICES.length), DURATION)
    return () => clearTimeout(t)
  }, [running, active])

  // Hero / footer links (#grocery, #airport-transfer) open the matching service.
  useEffect(() => {
    const sync = () => {
      const i = SERVICES.findIndex((s) => s.anchor && `#${s.anchor}` === window.location.hash)
      if (i >= 0) {
        setActive(i)
        setAuto(false)
      }
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const pick = (i) => {
    setActive(i)
    setAuto(false)
  }
  const s = SERVICES[active]

  return (
    <div
      className={`mkt-sx is-${s.tone}`}
      ref={rootRef}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {SERVICES.filter((x) => x.anchor).map((x) => (
        <span key={x.anchor} id={x.anchor} className="mkt-sx-anchor" aria-hidden="true" />
      ))}

      {/* Phone-width: segmented pills */}
      <div className="mkt-sx-tabs" role="tablist" aria-label="Services" data-reveal>
        {SERVICES.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'is-on' : ''}
            onClick={() => pick(i)}
          >
            <x.Icon size={16} strokeWidth={1.9} aria-hidden="true" />
            {x.short}
            {i === active ? <i key={`${active}-${running}`} className={running ? 'is-running' : ''} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>

      {/* Desktop: accordion list */}
      <ol className="mkt-sx-list">
        {SERVICES.map((x, i) => (
          <li
            key={x.key}
            // Active state lives in data-on: the scroll-reveal adds a class React must not overwrite.
            className="mkt-sx-item"
            data-on={i === active ? '' : undefined}
            data-reveal
            style={{ '--d': `${i * 0.07}s` }}
          >
            <button type="button" className="mkt-sx-head" onClick={() => pick(i)} aria-expanded={i === active}>
              <span className="mkt-sx-ico">
                <x.Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="mkt-sx-label">
                <small>{x.label}</small>
                <strong>{x.title}</strong>
              </span>
              <span className="mkt-sx-num" aria-hidden="true">
                0{i + 1}
              </span>
            </button>
            <div className="mkt-sx-body" aria-hidden={i !== active}>
              <div>
                <Detail s={x} />
              </div>
            </div>
            <span className="mkt-sx-bar" aria-hidden="true">
              {i === active ? <i key={`${active}-${running}`} className={running ? 'is-running' : ''} /> : null}
            </span>
          </li>
        ))}
      </ol>

      {/* The phone */}
      <div className="mkt-sx-stage" data-reveal="zoom" style={{ '--d': '0.1s' }}>
        <div className="mkt-sx-glow" aria-hidden="true" />
        <div className="mkt-sx-portal" aria-hidden="true">
          {SERVICES.map((x, i) => (
            <img key={x.key} src={x.photo} alt="" loading="lazy" decoding="async" className={i === active ? 'is-on' : ''} />
          ))}
        </div>
        <div className="mkt-sx-rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="mkt-sx-phone">
          <figure className="mkt-phone">
            <div className="mkt-sx-screens">
              {SERVICES.map((x, i) => (
                <img
                  key={x.key}
                  src={x.screen}
                  alt={i === active ? x.alt : ''}
                  aria-hidden={i !== active}
                  loading="lazy"
                  decoding="async"
                  width="780"
                  height="1688"
                  className={i === active ? 'is-on' : i === (active + SERVICES.length - 1) % SERVICES.length ? 'is-out' : ''}
                />
              ))}
            </div>
          </figure>
        </div>
        {SERVICES.map((x, i) => (
          <div key={x.key} className={`mkt-sx-floats${i === active ? ' is-on' : ''}`} aria-hidden="true">
            {x.floats.map((f, j) => (
              <span key={f.title} className={`mkt-sx-float is-${j ? 'b' : 'a'}`}>
                <b>
                  <f.Icon size={16} strokeWidth={2} />
                </b>
                <span>
                  <strong>{f.title}</strong>
                  <small>{f.sub}</small>
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Phone-width: the active service's details under the phone */}
      <div className="mkt-sx-detail" key={s.key} aria-live="polite">
        <p className="mkt-sx-kicker">
          <s.Icon size={14} strokeWidth={2} aria-hidden="true" /> {s.label}
        </p>
        <h3>{s.title}</h3>
        <Detail s={s} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Explore guide categories: icon tiles with a cursor spotlight.            */
/* ------------------------------------------------------------------------ */

const GUIDE = [
  { Icon: UtensilsCrossed, name: 'Dining', sub: 'Restaurants, bars & coffee' },
  { Icon: Umbrella, name: 'Beaches', sub: 'All 59 public accesses' },
  { Icon: Music, name: 'Events & live music', sub: '~600 every month' },
  { Icon: Sailboat, name: 'On the water', sub: 'Charters, paddle & fishing' },
  { Icon: Flag, name: 'Golf & outdoor', sub: 'Carts, bikes & courses' },
  { Icon: Users, name: 'Family & kids', sub: 'Camps & babysitting' },
  { Icon: Leaf, name: 'Wellness & spa', sub: 'Massage, yoga & spas' },
  { Icon: Camera, name: 'Weddings & photos', sub: 'Planners & photographers' },
  { Icon: ShoppingBag, name: 'Shopping', sub: 'Boutiques & local shops' },
  { Icon: Palette, name: 'Arts & culture', sub: 'Galleries & local artists' },
  { Icon: KeyRound, name: 'Local essentials', sub: 'Private chefs & home help' },
]

export function GuideGrid() {
  const ref = useRef(null)

  // Spotlight follows the cursor across the whole grid (desktop only).
  useEffect(() => {
    const grid = ref.current
    if (!grid || reduced() || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined
    let raf = 0
    const onMove = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        for (const card of grid.children) {
          const r = card.getBoundingClientRect()
          card.style.setProperty('--gx', `${e.clientX - r.left}px`)
          card.style.setProperty('--gy', `${e.clientY - r.top}px`)
        }
      })
    }
    grid.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      grid.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div className="mkt-guide" ref={ref} aria-label="Explore 30A guide categories" role="list">
      {GUIDE.map((g, i) => (
        <Link key={g.name} to="/app" className="mkt-guide-card" role="listitem" data-reveal style={{ '--d': `${(i % 4) * 0.06 + Math.floor(i / 4) * 0.08}s` }}>
          <span className="mkt-guide-ico">
            <g.Icon size={20} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="mkt-guide-text">
            <strong>{g.name}</strong>
            <small>{g.sub}</small>
          </span>
          <ArrowUpRight className="mkt-guide-go" size={17} aria-hidden="true" />
        </Link>
      ))}
      <Link to="/app" className="mkt-guide-card is-cta" role="listitem" data-reveal style={{ '--d': '0.3s' }}>
        <span className="mkt-guide-ico">
          <Info size={20} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className="mkt-guide-text">
          <strong>Open the full guide</strong>
          <small>160 vetted local partners</small>
        </span>
        <ArrowRight className="mkt-guide-go" size={17} aria-hidden="true" />
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Explore 30A: cinematic expanding panels (desktop), snap cards (phone).   */
/* HD frames from the client's own 30A films.                                */
/* ------------------------------------------------------------------------ */

const GALLERY = [
  {
    key: 'eat',
    title: 'Eat',
    meta: '243 restaurants, bars & cafés',
    chips: ['Open now', 'By community', 'Book online'],
    src: '/marketing/hd/eat.webp',
    pos: '42% 55%',
    alt: 'Snow crab and a seafood bowl with white wine at a 30A restaurant',
  },
  {
    key: 'move',
    title: 'Move',
    meta: 'Golf carts · Bikes · Airport transfers',
    chips: ['Golf carts', 'Bike rentals', 'Transfers'],
    src: '/marketing/hd/move.webp',
    pos: '34% 40%',
    alt: 'Riding a bike across a boardwalk through the coastal forest',
  },
  {
    key: 'play',
    title: 'Play',
    meta: 'Charters · Paddle · Fishing',
    chips: ['Yacht charters', 'Paddleboards', 'Fishing'],
    src: '/marketing/hd/play.webp',
    pos: '80% 50%',
    alt: 'A girl riding a boogie board through the Gulf surf',
  },
  {
    key: 'unwind',
    title: 'Unwind',
    meta: 'Spas · Beach setups · Bonfires',
    chips: ['Spas', 'Beach setups', 'Bonfires'],
    src: '/marketing/hd/unwind.webp',
    pos: '48% 60%',
    alt: 'A couple relaxing in an infinity pool framed by tall pines',
  },
  {
    key: 'events',
    title: 'Events',
    meta: '~600 a month · Live music · Markets',
    chips: ['Live music', 'Markets', 'Festivals'],
    src: '/marketing/hd/events.webp',
    pos: '40% 50%',
    alt: 'A guitarist playing live music',
  },
  {
    key: 'beaches',
    title: 'Beaches',
    meta: 'All 59 public beach accesses',
    chips: ['Parking', 'Restrooms', 'Directions'],
    src: '/marketing/hd/beaches.webp',
    pos: '30% 50%',
    alt: 'Aerial view of emerald water and white sand along 30A',
  },
]

export function ExploreGallery() {
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState(false)
  const [inView, setInView] = useState(false)
  const [wide, setWide] = useState(false)
  const running = wide && inView && !hover && !reduced()

  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 901px)')
    const sync = () => setWide(Boolean(mq?.matches))
    sync()
    mq?.addEventListener?.('change', sync)
    const el = ref.current
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 }) : null
    if (el && io) io.observe(el)
    return () => {
      mq?.removeEventListener?.('change', sync)
      io?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!running) return undefined
    const t = setTimeout(() => setActive((a) => (a + 1) % GALLERY.length), 5200)
    return () => clearTimeout(t)
  }, [running, active])

  return (
    <div
      className="mkt-gal"
      ref={ref}
      data-reveal
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {GALLERY.map((g, i) => (
        <Link
          key={g.key}
          to="/app"
          className="mkt-gal-item"
          data-on={i === active ? '' : undefined}
          style={{ '--i': i }}
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
        >
          <img className="mkt-gal-img" src={g.src} alt={g.alt} loading="lazy" decoding="async" width="1280" height="720" style={{ objectPosition: g.pos }} />
          <span className="mkt-gal-shade" aria-hidden="true" />
          <span className="mkt-gal-num" aria-hidden="true">
            0{i + 1}
          </span>
          <span className="mkt-gal-vert" aria-hidden="true">
            {g.title}
          </span>
          <span className="mkt-gal-body">
            <span className="mkt-gal-title">{g.title}</span>
            <span className="mkt-gal-meta">{g.meta}</span>
            <span className="mkt-gal-chips" aria-hidden="true">
              {g.chips.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </span>
            <span className="mkt-gal-cta">
              Explore in the app <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </span>
          <span className="mkt-gal-bar" aria-hidden="true">
            {i === active ? <i key={`${active}-${running}`} className={running ? 'is-running' : ''} /> : null}
          </span>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Vitoria: the app's real 3D voice orb, acting out a conversation.          */
/* ------------------------------------------------------------------------ */

const ORB_SCRIPT = [
  ['listening', 3400, 'Listening'],
  ['thinking', 1700, 'Thinking'],
  ['speaking', 4600, 'Speaking'],
]

export function VitoriaOrb({ OrbComponent }) {
  const ref = useRef(null)
  const levelRef = useRef(0)
  const stateRef = useRef('listening')
  const [step, setStep] = useState(0)
  const [inView, setInView] = useState(false)
  const [size, setSize] = useState(620)

  useEffect(() => {
    setSize(window.innerWidth < 640 ? 440 : window.innerWidth < 1024 ? 600 : 760)
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setInView(true)
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '200px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Walk through listening → thinking → speaking while visible.
  useEffect(() => {
    if (!inView) return undefined
    stateRef.current = ORB_SCRIPT[step][0]
    const t = setTimeout(() => setStep((s) => (s + 1) % ORB_SCRIPT.length), ORB_SCRIPT[step][1])
    return () => clearTimeout(t)
  }, [step, inView])

  // A voice-like level: syllable bursts while speaking, softer while listening.
  useEffect(() => {
    if (!inView) return undefined
    let raf = 0
    const tick = (now) => {
      const state = stateRef.current
      const t = now / 1000
      const syllables = Math.max(0, Math.sin(t * 9.3) * 0.55 + Math.sin(t * 3.1) * 0.35 + Math.sin(t * 17) * 0.15)
      levelRef.current = state === 'speaking' ? 0.25 + syllables * 0.75 : state === 'listening' ? 0.08 + syllables * 0.35 : 0.05
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView])

  const [state, , label] = ORB_SCRIPT[step]
  return (
    <div className="mkt-vorb" ref={ref} aria-hidden="true">
      {inView ? <OrbComponent levelRef={levelRef} stateRef={stateRef} size={size} /> : null}
      <span className={`mkt-vstate is-${state}`}>
        <i /> Vitoria is {label.toLowerCase()}
      </span>
    </div>
  )
}
