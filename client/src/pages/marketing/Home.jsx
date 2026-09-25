import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  Check,
  Compass,
  MapPin,
  Menu,
  Mic,
  Phone,
  Sparkles,
  UtensilsCrossed,
  Waves,
  X,
} from 'lucide-react'
import { ExploreGallery, GuideGrid, ServicesShowcase, VitoriaOrb } from './Showcase.jsx'
import VoiceOrb from '../app/vitoria/VoiceOrb.jsx'

/* ------------------------------------------------------------------------ */
/* Content                                                                   */
/* ------------------------------------------------------------------------ */

const NAV = [
  { label: 'Services', href: '#arrive' },
  { label: 'Meet Vitoria', href: '#meet-vitoria' },
  { label: 'How it works', href: '#how' },
  { label: 'Explore 30A', href: '#explore' },
  { label: 'The App', href: '#app' },
]

const M = '/marketing'
const HERO_POSTER = `${M}/hero-poster.webp`
const HERO_VIDEO = '/19VSW352C-Dune-Allen.mp4'
const COASTAL_POSTER = `${M}/coastal-poster.webp`
const COASTAL_VIDEO = '/19VSW352C-Gulf-Place.mp4'

const HERO_WORDS = ['Where', '30A', 'feels']

const COMMUNITIES = [
  'Alys Beach',
  'Blue Mountain Beach',
  'Dune Allen Beach',
  'Grayton Beach',
  'Gulf Place',
  'Inlet Beach',
  'Miramar Beach',
  'Prominence',
  'Rosemary Beach',
  'Santa Rosa Beach',
  'Seacrest Beach',
  'Seagrove Beach',
  'Seaside',
  'Topsail Hill',
  'WaterColor',
  'Watersound',
]

const STATS = [
  { value: 243, label: 'Restaurants, bars & cafés', note: 'by community, cuisine & open now' },
  { value: 160, label: 'Vetted local partners', note: 'charters, carts, chefs, spas & more' },
  { value: 59, label: 'Public beach accesses', note: 'with parking & restrooms noted' },
  { value: 600, prefix: '~', label: 'Events every month', note: 'live music, markets & festivals' },
  { value: 16, label: '30A communities', note: 'from Inlet Beach to Miramar' },
]

const STEPS = [
  {
    n: '01',
    title: 'Open the app',
    body: 'Create your guest account and add the address of your 30A rental. No download needed.',
  },
  {
    n: '02',
    title: 'Book what you need',
    body: 'Airport transfer, a stocked kitchen, or both. Save a card: you are charged only after the ride or the delivery.',
  },
  {
    n: '03',
    title: 'Arrive and enjoy',
    body: 'Your driver tracks your flight, your groceries are put away, and Vitoria is one tap away for everything else.',
  },
]

const CHAT = [
  { from: 'guest', text: 'Dinner for four tonight in Rosemary Beach?' },
  {
    from: 'vitoria',
    text: 'Here are the Rosemary Beach spots open tonight from our list of 243. I marked the ones you can book online.',
    chips: ['Open now', 'Book on Resy / OpenTable'],
  },
  { from: 'guest', text: 'Which beach access near Seaside has parking and restrooms?' },
  {
    from: 'vitoria',
    text: 'I know all 59 public beach accesses. These are the closest to Seaside with parking and restrooms.',
    chips: ['Parking', 'Restrooms', 'Directions'],
  },
  { from: 'guest', text: 'Any live music this weekend?' },
  {
    from: 'vitoria',
    text: 'Plenty. I follow about 600 events a month from 30a.com. Here is what is playing near your rental.',
    chips: ['Live music', 'This weekend'],
  },
]

/* ------------------------------------------------------------------------ */
/* Helpers & hooks                                                           */
/* ------------------------------------------------------------------------ */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const finePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

/* Scroll-reveal: adds .is-in to every [data-reveal] once it enters the viewport. */
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const els = Array.from(root.querySelectorAll('[data-reveal]'))
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'))
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [rootRef])
}

/* Pointer effects (desktop only): 3D tilt + spotlight on [data-tilt], magnetic pull on [data-magnetic]. */
function usePointerFx(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion() || !finePointer()) return undefined
    const cleanups = []

    root.querySelectorAll('[data-tilt]').forEach((el) => {
      let raf = 0
      const onMove = (e) => {
        const r = el.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--rx', `${((0.5 - y) * 5).toFixed(2)}deg`)
          el.style.setProperty('--ry', `${((x - 0.5) * 6).toFixed(2)}deg`)
          el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
          el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
        })
      }
      const onLeave = () => {
        cancelAnimationFrame(raf)
        el.style.setProperty('--rx', '0deg')
        el.style.setProperty('--ry', '0deg')
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        cancelAnimationFrame(raf)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
      })
    })

    root.querySelectorAll('[data-magnetic]').forEach((el) => {
      const onMove = (e) => {
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        el.style.setProperty('--tx', `${(dx * 0.18).toFixed(1)}px`)
        el.style.setProperty('--ty', `${(dy * 0.28).toFixed(1)}px`)
      }
      const onLeave = () => {
        el.style.setProperty('--tx', '0px')
        el.style.setProperty('--ty', '0px')
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
      })
    })

    return () => cleanups.forEach((fn) => fn())
  }, [rootRef])
}

/* Image with skeleton shimmer + fade-in once decoded. The parent sets the aspect ratio. */
function Img({ src, alt, eager = false, className = '', ...rest }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true)
  }, [src])

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`mkt-img${loaded ? ' is-loaded' : ''}${className ? ` ${className}` : ''}`}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      {...rest}
    />
  )
}

/* Counts up from 0 once visible. */
function CountUp({ to, prefix = '', duration = 1800 }) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setValue(to)
      return undefined
    }
    let raf = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration)
          setValue(Math.round(to * (1 - Math.pow(1 - t, 4))))
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])

  return (
    <span ref={ref} className="mkt-count">
      <span className="mkt-sr">
        {prefix}
        {to}
      </span>
      <span aria-hidden="true">
        {prefix}
        {value}
      </span>
    </span>
  )
}

/* Animated chat preview for Vitoria: plays the example conversation while on screen. */
function ChatDemo() {
  const boxRef = useRef(null)
  const [inView, setInView] = useState(false)
  const [shown, setShown] = useState(0)
  const [typing, setTyping] = useState(false)
  const [fading, setFading] = useState(false)
  const reduce = useRef(false)

  useEffect(() => {
    reduce.current = prefersReducedMotion()
    if (reduce.current || !('IntersectionObserver' in window)) {
      setShown(CHAT.length)
      return undefined
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.35,
    })
    if (boxRef.current) io.observe(boxRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduce.current || !inView) return undefined
    let t
    if (shown >= CHAT.length) {
      t = setTimeout(() => {
        setFading(true)
        t = setTimeout(() => {
          setShown(0)
          setFading(false)
        }, 600)
      }, 4200)
      return () => clearTimeout(t)
    }
    const next = CHAT[shown]
    if (next.from === 'guest') {
      t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 500 : 1100)
    } else {
      setTyping(true)
      t = setTimeout(() => {
        setTyping(false)
        setShown((s) => s + 1)
      }, 1500)
    }
    return () => clearTimeout(t)
  }, [inView, shown])

  return (
    <div className="mkt-chat" ref={boxRef}>
      <div className="mkt-chat-head">
        <img
          src={`${M}/vitoria-avatar.webp`}
          alt=""
          width="44"
          height="44"
          loading="lazy"
          decoding="async"
          className="mkt-chat-avatar"
        />
        <div className="mkt-chat-id">
          <p className="mkt-chat-name">Vitoria</p>
          <p className="mkt-chat-status">
            <span className="mkt-live-dot" aria-hidden="true" /> Your AI concierge
          </p>
        </div>
        <span className="mkt-chat-talk" aria-hidden="true">
          <AudioLines size={15} /> Talk
        </span>
      </div>

      <ol
        className={`mkt-chat-body${fading ? ' is-fading' : ''}`}
        aria-label="Example conversation with Vitoria"
      >
        {CHAT.slice(0, shown).map((m, i) => (
          <li key={i} className={`mkt-bubble mkt-bubble-${m.from}`}>
            <span className="mkt-sr">{m.from === 'guest' ? 'Guest: ' : 'Vitoria: '}</span>
            {m.text}
            {m.chips && (
              <span className="mkt-bubble-chips" aria-hidden="true">
                {m.chips.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </span>
            )}
          </li>
        ))}
        {typing && (
          <li className="mkt-bubble mkt-bubble-vitoria mkt-typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </li>
        )}
      </ol>

      <div className="mkt-chat-input" aria-hidden="true">
        <span>Ask anything about 30A…</span>
        <span className="mkt-chat-mic">
          <Mic size={16} />
        </span>
      </div>
      <p className="mkt-chat-caption">Example conversation</p>
    </div>
  )
}

function prepVideo(video) {
  video.defaultMuted = true
  video.muted = true
  video.playsInline = true
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
}

function safePlay(video) {
  const result = video.play()
  if (result?.catch) result.catch(() => {})
}

/* Loads a background video only when it approaches the viewport; pauses it offscreen. */
function useLazyVideo(
  videoRef,
  src,
  { rootMargin = '200px 0px', afterLoad = false, start: from = 0, end = Infinity } = {},
) {
  const [active, setActive] = useState(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || prefersReducedMotion()) return undefined
    if (navigator.connection?.saveData) return undefined
    prepVideo(video)
    // The source clips carry baked-in title cards at the start/end; loop only the clean middle.
    const onMeta = () => {
      if (video.currentTime < from) video.currentTime = from
    }
    const onTime = () => {
      const t = video.currentTime
      if (t >= end || t < from - 0.05) {
        video.currentTime = from
        return
      }
      if (!video.paused) setPlaying(true)
    }
    const onEnded = () => {
      video.currentTime = from
      safePlay(video)
    }
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)

    let io
    let cancelled = false
    const start = () => {
      if (cancelled) return
      if (!('IntersectionObserver' in window)) {
        setActive(src)
        return
      }
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActive((s) => s || src)
            safePlay(video)
          } else {
            video.pause()
          }
        },
        { rootMargin },
      )
      io.observe(video)
    }

    // The hero waits for the page (poster, fonts, above-the-fold images) before fetching video.
    let idle
    const onLoad = () => {
      idle = setTimeout(start, 250)
    }
    if (afterLoad && document.readyState !== 'complete') window.addEventListener('load', onLoad)
    else start()

    const onVis = () => {
      if (document.visibilityState === 'hidden') video.pause()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      clearTimeout(idle)
      window.removeEventListener('load', onLoad)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
    }
  }, [videoRef, src, rootMargin, afterLoad, from, end])

  useEffect(() => {
    const video = videoRef.current
    if (video && active) safePlay(video)
  }, [videoRef, active])

  return { active, playing }
}

/* ------------------------------------------------------------------------ */
/* Page                                                                      */
/* ------------------------------------------------------------------------ */

export default function Home() {
  const rootRef = useRef(null)
  const heroRef = useRef(null)
  const heroVideoRef = useRef(null)
  const coastalVideoRef = useRef(null)
  const stepsRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [heroReady, setHeroReady] = useState(false)

  useReveal(rootRef)
  usePointerFx(rootRef)

  const hero = useLazyVideo(heroVideoRef, HERO_VIDEO, {
    rootMargin: '0px',
    afterLoad: true,
    start: 4.2,
    end: 41.4,
  })
  const coastal = useLazyVideo(coastalVideoRef, COASTAL_VIDEO, {
    rootMargin: '300px 0px',
    start: 3,
    end: 38.8,
  })

  useEffect(() => {
    document.title = 'My30A Host · Where 30A Feels Effortless'
    const html = document.documentElement
    html.classList.add('mkt-smooth')
    return () => html.classList.remove('mkt-smooth')
  }, [])

  // Hero intro starts once the poster is decoded (or after a short cap).
  useEffect(() => {
    const cap = setTimeout(() => setHeroReady(true), 900)
    return () => clearTimeout(cap)
  }, [])

  // One rAF-throttled scroll loop: glass nav, hero parallax, [data-parallax] layers, steps progress.
  useEffect(() => {
    const root = rootRef.current
    const heroEl = heroRef.current
    const steps = stepsRef.current
    const reduce = prefersReducedMotion()
    const layers = reduce ? [] : Array.from(root?.querySelectorAll('[data-parallax]') || [])
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY || 0
      const vh = window.innerHeight || 1
      setScrolled(y > 24)
      if (reduce) return
      if (heroEl && y < vh * 1.3) {
        heroEl.style.setProperty('--hero-shift', `${(y * 0.3).toFixed(1)}px`)
        heroEl.style.setProperty('--hero-fade', `${Math.max(0, 1 - y / (vh * 0.75)).toFixed(3)}`)
      }
      for (const el of layers) {
        const r = el.getBoundingClientRect()
        if (r.bottom < -200 || r.top > vh + 200) continue
        const speed = parseFloat(el.dataset.parallax) || 0.1
        const offset = (r.top + r.height / 2 - vh / 2) * -speed
        el.style.setProperty('--py', `${offset.toFixed(1)}px`)
      }
      if (steps) {
        const r = steps.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height + vh * 0.25)))
        steps.style.setProperty('--p', p.toFixed(3))
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Mobile menu: Escape closes, page scroll locked while open.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  useEffect(() => {
    const close = () => window.innerWidth > 980 && setMenuOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`mkt${heroReady ? ' is-ready' : ''}`} ref={rootRef}>
      <a className="mkt-skip" href="#arrive">
        Skip to content
      </a>

      {/* ------------------------------------------------------------ Nav */}
      <header className={`mkt-nav${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-open' : ''}`}>
        <div className="mkt-nav-inner">
          <a className="mkt-brand" href="#home" onClick={closeMenu}>
            <img src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
          </a>
          <nav className="mkt-nav-links" aria-label="Primary">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mkt-nav-actions">
            <Link className="mkt-nav-signin" to="/app/login">
              Sign in
            </Link>
            <Link className="mkt-btn mkt-btn-gold mkt-btn-sm mkt-nav-cta" to="/app">
              Get Started
            </Link>
            <button
              type="button"
              className="mkt-nav-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mkt-mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? (
                <X size={22} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div
          id="mkt-mobile-menu"
          className={`mkt-menu${menuOpen ? ' is-open' : ''}`}
          aria-hidden={!menuOpen}
          inert={menuOpen ? undefined : ''}
        >
          <nav className="mkt-menu-links" aria-label="Mobile">
            {NAV.map((item, i) => (
              <a key={item.href} href={item.href} onClick={closeMenu} style={{ '--i': i }}>
                <span>{item.label}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            ))}
          </nav>
          <div className="mkt-menu-ctas">
            <Link className="mkt-btn mkt-btn-gold" to="/app" onClick={closeMenu}>
              Get Started <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="mkt-btn mkt-btn-glass" to="/app/login" onClick={closeMenu}>
              Sign in
            </Link>
          </div>
          <a className="mkt-menu-phone" href="tel:+18509554577">
            <Phone size={15} aria-hidden="true" /> (850) 955-4577
          </a>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------------ Hero */}
        <section className="mkt-hero" id="home" ref={heroRef} aria-labelledby="mkt-hero-title">
          <div className="mkt-hero-media" aria-hidden="true">
            <div className="mkt-hero-kb">
              <img
                className="mkt-hero-poster"
                src={HERO_POSTER}
                alt=""
                fetchpriority="high"
                decoding="async"
                onLoad={() => setHeroReady(true)}
                onError={() => setHeroReady(true)}
              />
              <video
                ref={heroVideoRef}
                className={`mkt-hero-video${hero.playing ? ' is-on' : ''}`}
                src={hero.active || undefined}
                poster={HERO_POSTER}
                muted
                playsInline
                preload="none"
                disablePictureInPicture
                tabIndex={-1}
              />
            </div>
            <div className="mkt-hero-overlay" />
            <div className="mkt-hero-vignette" />
          </div>

          <div className="mkt-wrap mkt-hero-grid">
            <div className="mkt-hero-content">
              <p className="mkt-eyebrow mkt-hero-in" style={{ '--d': '0.05s' }}>
                <MapPin size={14} aria-hidden="true" /> Scenic Highway 30A · Florida
              </p>
              <h1 className="mkt-hero-title" id="mkt-hero-title">
                {HERO_WORDS.map((w, i) => (
                  <span key={w}>
                    <span className="mkt-word">
                      <span style={{ '--d': `${0.15 + i * 0.1}s` }}>{w}</span>
                    </span>{' '}
                  </span>
                ))}
                <span className="mkt-word">
                  <em style={{ '--d': `${0.15 + HERO_WORDS.length * 0.1}s` }}>effortless.</em>
                </span>
              </h1>
              <p className="mkt-hero-sub mkt-hero-in" style={{ '--d': '0.65s' }}>
                Private airport transfers, a kitchen stocked from Publix before you arrive, and
                Vitoria, an AI concierge who knows 30A's tables, beaches and events.
              </p>
              <div className="mkt-hero-ctas mkt-hero-in" style={{ '--d': '0.8s' }}>
                <Link className="mkt-btn mkt-btn-gold mkt-btn-lg" to="/app" data-magnetic>
                  Get Started <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a className="mkt-btn mkt-btn-glass mkt-btn-lg" href="#meet-vitoria" data-magnetic>
                  <Sparkles size={16} aria-hidden="true" /> Meet Vitoria
                </a>
              </div>
            </div>

          </div>

          <a className="mkt-scroll-cue" href="#communities" aria-label="Scroll to learn more">
            <span />
          </a>
        </section>

        {/* ------------------------------------------------------------ Communities marquee */}
        <section className="mkt-marquee" id="communities" aria-label="30A communities we serve">
          <ul className="mkt-sr">
            {COMMUNITIES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="mkt-marquee-track" aria-hidden="true">
            {[0, 1].map((k) => (
              <div className="mkt-marquee-group" key={k}>
                {COMMUNITIES.map((c) => (
                  <span key={c} className="mkt-marquee-item">
                    {c}
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ Intro + stats */}
        <section className="mkt-intro" id="experience" aria-labelledby="mkt-intro-title">
          <div className="mkt-wrap">
            <div className="mkt-intro-head">
              <p className="mkt-eyebrow mkt-eyebrow-dark" data-reveal>
                Your 30A concierge
              </p>
              <h2 className="mkt-h2" id="mkt-intro-title" data-reveal style={{ '--d': '0.08s' }}>
                Your stay, already <em>taken care of.</em>
              </h2>
              <p className="mkt-intro-copy" data-reveal style={{ '--d': '0.16s' }}>
                30A is for people who want to live well. My30A Host is for people who want nothing
                to get in the way of that — built on our own local database, not a search engine.
              </p>
            </div>

            <dl className="mkt-stats">
              {STATS.map((s, i) => (
                <div className="mkt-stat" key={s.label} data-reveal style={{ '--d': `${i * 0.08}s` }}>
                  <dt>{s.label}</dt>
                  <dd className="mkt-stat-num">
                    <CountUp to={s.value} prefix={s.prefix} />
                  </dd>
                  <dd className="mkt-stat-note">{s.note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------------------ Services bento */}
        <section className="mkt-services" id="arrive" aria-labelledby="mkt-services-title">
          <div className="mkt-wrap">
            <header className="mkt-section-head">
              <p className="mkt-eyebrow mkt-eyebrow-dark" data-reveal>
                Services
              </p>
              <h2 className="mkt-h2" id="mkt-services-title" data-reveal style={{ '--d': '0.08s' }}>
                Arrive. <em>Everything&apos;s ready.</em>
              </h2>
              <p className="mkt-sub" data-reveal style={{ '--d': '0.16s' }}>
                The little things are handled before you land, so you can get straight to the
                good part.
              </p>
            </header>

            <ServicesShowcase />
          </div>
        </section>

        {/* ------------------------------------------------------------ Meet Vitoria */}
        <section className="mkt-vitoria" id="meet-vitoria" aria-labelledby="mkt-vitoria-title">
          <div className="mkt-aurora" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="mkt-wrap mkt-vitoria-grid">
            <div className="mkt-vitoria-copy">
              <p className="mkt-eyebrow" data-reveal>
                Your AI concierge
              </p>
              <h2 className="mkt-h2 mkt-h2-light" id="mkt-vitoria-title" data-reveal style={{ '--d': '0.08s' }}>
                Meet Vitoria. <em>The local who knows everything.</em>
              </h2>
              <p className="mkt-lead" data-reveal style={{ '--d': '0.16s' }}>
                She answers from our own local database first, then from broader 30A knowledge. Ask
                in plain English and get a real answer, not ten browser tabs.
              </p>
              <ul className="mkt-vfeatures">
                <li data-reveal style={{ '--d': '0.2s' }}>
                  <span className="mkt-vf-icon">
                    <UtensilsCrossed size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>243 restaurants, bars & cafés</strong>
                    By community, cuisine and open now — with online booking via Resy or OpenTable.
                  </span>
                </li>
                <li data-reveal style={{ '--d': '0.26s' }}>
                  <span className="mkt-vf-icon">
                    <Compass size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>160 vetted local partners</strong>
                    Yacht charters, golf carts, private chefs, photographers, spas and more.
                  </span>
                </li>
                <li data-reveal style={{ '--d': '0.32s' }}>
                  <span className="mkt-vf-icon">
                    <Waves size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>All 59 public beach accesses</strong>
                    With parking and restrooms, so you pick the right one.
                  </span>
                </li>
                <li data-reveal style={{ '--d': '0.38s' }}>
                  <span className="mkt-vf-icon">
                    <CalendarDays size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>~600 events a month</strong>
                    Live music, markets and festivals from 30a.com.
                  </span>
                </li>
              </ul>
              <div className="mkt-voice" data-reveal style={{ '--d': '0.44s' }}>
                <span className="mkt-wave" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <i key={i} style={{ '--i': i }} />
                  ))}
                </span>
                <p>
                  <strong>Real-time voice.</strong> Tap Talk and have a conversation — hands free on
                  the beach.
                </p>
              </div>
              <Link className="mkt-btn mkt-btn-gold mkt-btn-lg" to="/app" data-reveal data-magnetic style={{ '--d': '0.5s' }}>
                Ask Vitoria <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>

            <div className="mkt-vitoria-demo" data-reveal="zoom" style={{ '--d': '0.1s' }}>
              <VitoriaOrb OrbComponent={VoiceOrb} />
              <div className="mkt-chat-frame">
                <ChatDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ How it works */}
        <section className="mkt-how" id="how" aria-labelledby="mkt-how-title">
          <div className="mkt-wrap">
            <header className="mkt-section-head">
              <p className="mkt-eyebrow mkt-eyebrow-dark" data-reveal>
                How it works
              </p>
              <h2 className="mkt-h2" id="mkt-how-title" data-reveal style={{ '--d': '0.08s' }}>
                Three steps to <em>effortless.</em>
              </h2>
            </header>
            <ol className="mkt-steps" ref={stepsRef}>
              <span className="mkt-steps-line" aria-hidden="true">
                <span />
              </span>
              {STEPS.map((s, i) => (
                <li className="mkt-step" key={s.n} data-reveal style={{ '--d': `${i * 0.12}s` }}>
                  <span className="mkt-step-n" aria-hidden="true">
                    {s.n}
                  </span>
                  <h3 className="mkt-step-title">{s.title}</h3>
                  <p className="mkt-step-body">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ Explore gallery */}
        <section className="mkt-explore" id="explore" aria-labelledby="mkt-explore-title">
          <div className="mkt-wrap mkt-explore-head">
            <div>
              <p className="mkt-eyebrow" data-reveal>
                Explore 30A
              </p>
              <h2 className="mkt-h2 mkt-h2-light" id="mkt-explore-title" data-reveal style={{ '--d': '0.08s' }}>
                Everything you need. <em>Nothing you don&apos;t.</em>
              </h2>
            </div>
            <div className="mkt-explore-side" data-reveal style={{ '--d': '0.16s' }}>
              <p>
                The places locals actually use — from Inlet Beach to Miramar Beach — in one guide
                inside the app.
              </p>
              <p className="mkt-gal-hint" aria-hidden="true">
                <span /> <b className="is-fine">Hover a guide to open it</b>
                <b className="is-touch">Swipe to explore</b>
              </p>
            </div>
          </div>

          <div className="mkt-wrap">
            <ExploreGallery />
          </div>

          <div className="mkt-wrap">
            <GuideGrid />
          </div>
        </section>

        {/* ------------------------------------------------------------ Coastal band */}
        <section className="mkt-coastal" id="coastal" aria-labelledby="mkt-coastal-title">
          <div className="mkt-coastal-media" aria-hidden="true">
            <div className="mkt-coastal-layer" data-parallax="0.12">
              <video
                ref={coastalVideoRef}
                className={`mkt-coastal-video${coastal.playing ? ' is-on' : ''}`}
                src={coastal.active || undefined}
                poster={COASTAL_POSTER}
                muted
                playsInline
                preload="none"
                tabIndex={-1}
              />
            </div>
            <div className="mkt-coastal-overlay" />
          </div>
          <div className="mkt-wrap mkt-coastal-content">
            <h2 className="mkt-coastal-title" id="mkt-coastal-title" data-reveal>
              Where coastal living
              <br />
              became <em>an art form.</em>
            </h2>
            <a className="mkt-btn mkt-btn-glass" href="#app" data-reveal style={{ '--d': '0.15s' }}>
              See the app <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>

        {/* ------------------------------------------------------------ App mockup */}
        <section className="mkt-app" id="app" aria-labelledby="mkt-app-title">
          <div className="mkt-wrap mkt-app-grid">
            <div className="mkt-app-copy">
              <p className="mkt-eyebrow mkt-eyebrow-dark" data-reveal>
                The My30A Host app
              </p>
              <h2 className="mkt-h2" id="mkt-app-title" data-reveal style={{ '--d': '0.08s' }}>
                Your whole stay, <em>in one app.</em>
              </h2>
              <p className="mkt-sub mkt-sub-left" data-reveal style={{ '--d': '0.16s' }}>
                Book, pay after, track and ask — all from your phone. It runs right in your browser;
                add it to your home screen in two taps.
              </p>
              <ul className="mkt-app-list">
                {[
                  'Book airport transfers and grocery stocking',
                  'Ask Vitoria by text or real-time voice',
                  'Browse the Explore 30A guide and events',
                  'Track your orders with live notifications',
                ].map((t, i) => (
                  <li key={t} data-reveal style={{ '--d': `${0.2 + i * 0.06}s` }}>
                    <Check size={16} aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
              <div className="mkt-app-ctas" data-reveal style={{ '--d': '0.45s' }}>
                <Link className="mkt-btn mkt-btn-navy mkt-btn-lg" to="/app/login" data-magnetic>
                  Open the app <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <Link className="mkt-btn mkt-btn-outline mkt-btn-lg" to="/app/signup" data-magnetic>
                  Create an account
                </Link>
              </div>
            </div>

            <div className="mkt-app-stage" data-reveal="zoom" style={{ '--d': '0.1s' }}>
              <div className="mkt-app-glow" aria-hidden="true" />
              <div className="mkt-phone-pos mkt-phone-pos-left" data-parallax="0.06">
                <figure className="mkt-phone mkt-phone-sm">
                  <Img src={`${M}/app-vitoria.webp`} alt="Vitoria chat in the My30A Host app" width="620" height="1342" />
                </figure>
              </div>
              <div className="mkt-phone-pos mkt-phone-pos-right" data-parallax="0.1">
                <figure className="mkt-phone mkt-phone-sm">
                  <Img src={`${M}/app-explore.webp`} alt="Explore 30A categories in the My30A Host app" width="620" height="1342" />
                </figure>
              </div>
              <div className="mkt-phone-pos mkt-phone-pos-main" data-parallax="-0.04">
                <figure className="mkt-phone">
                  <Img src={`${M}/app-services.webp`} alt="Services screen of the My30A Host app with grocery delivery and airport transfer" width="620" height="1342" />
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ Final CTA */}
        <section className="mkt-final" id="get-started" aria-labelledby="mkt-final-title">
          <div className="mkt-wrap">
            <div className="mkt-final-card" data-reveal="zoom">
              <div className="mkt-final-bg" aria-hidden="true" />
              <img className="mkt-final-logo" src="/brand/my30a-logo-light.png" alt="" width="720" height="319" loading="lazy" decoding="async" />
              <h2 className="mkt-final-title" id="mkt-final-title">
                The effortless way to <em>experience 30A.</em>
              </h2>
              <p className="mkt-final-sub">
                Transfers from $85 · Groceries from $229 · Vitoria included in the app.
              </p>
              <div className="mkt-final-ctas">
                <Link className="mkt-btn mkt-btn-gold mkt-btn-lg" to="/app" data-magnetic>
                  Get Started <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a className="mkt-btn mkt-btn-glass mkt-btn-lg" href="tel:+18509554577">
                  <Phone size={16} aria-hidden="true" /> (850) 955-4577
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="mkt-footer" id="contact">
        <div className="mkt-wrap mkt-footer-inner">
          <div className="mkt-footer-brand">
            <a className="mkt-footer-logo" href="#home">
              <img src="/brand/my30a-logo-light.png" alt="My30A Host — Your personal 30A concierge" width="720" height="319" loading="lazy" decoding="async" />
            </a>
            <p className="mkt-footer-about">
              Concierge for vacation-rental guests on Scenic Highway 30A, Florida. Airport
              transfers, grocery stocking and Vitoria, your AI local.
            </p>
            <div className="mkt-footer-social" aria-label="Social media">
              <a href="https://www.instagram.com/my30a_host/" target="_blank" rel="noreferrer" aria-label="My30A Host on Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 2.8A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 0 1 12 7.8zm0 2A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.5a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
                </svg>
              </a>
              <a href="https://www.facebook.com/share/1KWYNPbK31/" target="_blank" rel="noreferrer" aria-label="My30A Host on Facebook">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H6v4h3v9h4v-9h3.2l.8-4H13V9c0-.6.4-1 1-1z" />
                </svg>
              </a>
              <a href="https://www.tiktok.com/@my30ahost1" target="_blank" rel="noreferrer" aria-label="My30A Host on TikTok">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M16.6 3c.4 2.1 1.7 3.6 3.9 3.9v3.2c-1.4.1-2.7-.3-3.9-1v6.3c0 3.5-2.6 5.8-5.8 5.6-3-.2-5.2-2.9-4.9-5.9.3-2.8 2.8-5 5.6-4.7v3.3c-1.2-.3-2.5.5-2.6 1.8-.2 1.4.9 2.5 2.2 2.4 1.2 0 2.1-1 2.1-2.2V3h3.4z" />
                </svg>
              </a>
            </div>
          </div>

          <nav className="mkt-footer-col" aria-label="Quick links">
            <h3 className="mkt-footer-heading">Quick Links</h3>
            <ul className="mkt-footer-links">
              <li>
                <a href="#experience">Experience</a>
              </li>
              <li>
                <a href="#arrive">Services</a>
              </li>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#explore">Explore 30A</a>
              </li>
              <li>
                <Link to="/app/login">Sign in</Link>
              </li>
            </ul>
          </nav>

          <nav className="mkt-footer-col" aria-label="Services">
            <h3 className="mkt-footer-heading">Services</h3>
            <ul className="mkt-footer-links">
              <li>
                <a href="#grocery">Grocery Delivery</a>
              </li>
              <li>
                <a href="#airport-transfer">Airport Transfer</a>
              </li>
              <li>
                <a href="#meet-vitoria">Vitoria Concierge</a>
              </li>
              <li>
                <a href="#explore">Explore 30A Guide</a>
              </li>
            </ul>
          </nav>

          <div className="mkt-footer-col">
            <h3 className="mkt-footer-heading">Contact</h3>
            <a className="mkt-footer-contact" href="tel:+18509554577">
              <span className="mkt-footer-icon" aria-hidden="true">
                <Phone size={14} />
              </span>
              (850) 955-4577
            </a>
            <a className="mkt-footer-contact" href="mailto:my30ahost@gmail.com">
              <span className="mkt-footer-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" />
                </svg>
              </span>
              my30ahost@gmail.com
            </a>
            <a className="mkt-footer-contact" href="https://www.instagram.com/my30a_host/" target="_blank" rel="noreferrer">
              <span className="mkt-footer-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 2.8A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 0 1 12 7.8zm0 2A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.5a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
                </svg>
              </span>
              @my30a_host
            </a>
            <a className="mkt-footer-contact" href="https://www.my30ahost.com" target="_blank" rel="noreferrer">
              <span className="mkt-footer-icon" aria-hidden="true">
                <Compass size={14} />
              </span>
              www.my30ahost.com
            </a>
          </div>
        </div>

        <div className="mkt-footer-bar">
          <div className="mkt-wrap mkt-footer-bar-inner">
            <p>Copyright © 2026 My30A Host. All rights reserved.</p>
            <p>
              <a href="#privacy">Privacy Policy</a>
              <span aria-hidden="true"> · </span>
              <a href="#terms">Terms of Service</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
