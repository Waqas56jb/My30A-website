import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, Menu, X } from 'lucide-react'

const NAV = [
  { label: 'Home', href: '#home' },
  { label: 'Experience', href: '#experience' },
  { label: 'Services', href: '#arrive' },
  { label: 'Explore 30A', href: '#explore' },
  { label: 'Meet Vitoria', href: '#meet-vitoria' },
]

const M = '/marketing'
const HERO_POSTER = `${M}/hero-poster.webp`
const HERO_VIDEO = '/19VSW352C-Dune-Allen.mp4'
const COASTAL_POSTER = `${M}/coastal-poster.webp`
const COASTAL_VIDEO = '/19VSW352C-Gulf-Place.mp4'

const STAY_IMAGES = [
  { src: `${M}/stay-boardwalk.webp`, alt: 'Boardwalk over the dunes to the beach' },
  { src: `${M}/stay-balcony.webp`, alt: 'Ocean-view balcony seating' },
  { src: `${M}/stay-aerial.webp`, alt: 'Aerial view of white sand and turquoise water' },
  { src: `${M}/stay-sunset-paddle.webp`, alt: 'Paddleboarders heading out at sunset on 30A' },
  { src: `${M}/stay-beach-bike.webp`, alt: 'Beach cruiser parked at a Gulf-front boardwalk' },
]

const EXPLORE = [
  {
    key: 'eat',
    title: 'Eat',
    meta: 'Private chefs · Seafood markets · Live restaurant hours',
    src: `${M}/explore-eat.webp`,
    alt: 'Plated dish from a 30A private chef',
  },
  {
    key: 'move',
    title: 'Move',
    meta: 'Airport transfers · Golf carts · Bikes',
    src: `${M}/explore-move.webp`,
    alt: 'Guests cruising 30A in a rented golf cart',
  },
  {
    key: 'play',
    title: 'Play',
    meta: 'Yacht charters · Fishing · Paddle & surf',
    src: `${M}/explore-play.webp`,
    alt: 'Luxury yacht charter on emerald water',
  },
  {
    key: 'unwind',
    title: 'Unwind',
    meta: 'Beach setups · Bonfires · Wellness',
    src: `${M}/explore-unwind.webp`,
    alt: 'Sunset beach bonfire setup with chairs and tiki torches',
  },
]

const ASK = [
  {
    q: 'Where should we have dinner tonight?',
    a: 'Vitoria checks live restaurant hours and suggests what is open near your rental right now.',
  },
  {
    q: 'Can we get a golf cart tomorrow?',
    a: 'She connects you with vetted local golf cart rentals on 30A.',
  },
  {
    q: 'What is the best beach for the kids?',
    a: 'She knows all 79 public beach accesses and points you to the right one nearby.',
  },
]

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [rootRef])
}

/* Image with skeleton shimmer + fade-in once decoded. The parent sets the aspect ratio. */
function Img({ src, alt, eager = false, className = '', onLoad, ...rest }) {
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
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      onError={() => setLoaded(true)}
      {...rest}
    />
  )
}

/* Counts up from 0 once visible. */
function CountUp({ to, duration = 1400 }) {
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
          setValue(Math.round(to * (1 - Math.pow(1 - t, 3))))
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to, duration])

  return <span ref={ref}>{value}</span>
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

export default function Home() {
  const rootRef = useRef(null)
  const heroRef = useRef(null)
  const videoRef = useRef(null)
  const coastalVideoRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [heroReady, setHeroReady] = useState(false)
  const [loaderGone, setLoaderGone] = useState(false)
  const [heroVideoOn, setHeroVideoOn] = useState(false)
  const [coastalSrc, setCoastalSrc] = useState(null)

  useReveal(rootRef)

  useEffect(() => {
    document.title = 'My30A Host · Where 30A Feels Effortless'
    document.documentElement.classList.add('mkt-smooth')
    return () => document.documentElement.classList.remove('mkt-smooth')
  }, [])

  // Intro loader: hide once the hero poster is ready (or after a short cap).
  useEffect(() => {
    const cap = setTimeout(() => setHeroReady(true), 1200)
    return () => clearTimeout(cap)
  }, [])

  useEffect(() => {
    if (!heroReady) return undefined
    const t = setTimeout(() => setLoaderGone(true), 700)
    return () => clearTimeout(t)
  }, [heroReady])

  // Sticky nav state + hero parallax, throttled to one rAF per frame.
  useEffect(() => {
    const hero = heroRef.current
    const reduce = prefersReducedMotion()
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY || 0
      setScrolled(y > 24)
      if (hero && !reduce && y < window.innerHeight * 1.2) {
        hero.style.setProperty('--mkt-hero-shift', `${(y * 0.28).toFixed(1)}px`)
        hero.style.setProperty('--mkt-hero-fade', `${Math.max(0, 1 - y / 700).toFixed(3)}`)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Hero video: play when visible, pause when scrolled away (saves CPU/battery).
  useEffect(() => {
    const video = videoRef.current
    if (!video || prefersReducedMotion()) return undefined
    prepVideo(video)
    const onPlaying = () => setHeroVideoOn(true)
    video.addEventListener('playing', onPlaying)
    const onVis = () => {
      if (document.visibilityState === 'visible') safePlay(video)
    }
    document.addEventListener('visibilitychange', onVis)
    let io
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) safePlay(video)
        else video.pause()
      })
      io.observe(video)
    } else {
      safePlay(video)
    }
    return () => {
      video.removeEventListener('playing', onPlaying)
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
    }
  }, [])

  // Coastal video: don't download until it is about to scroll into view.
  useEffect(() => {
    const video = coastalVideoRef.current
    if (!video || prefersReducedMotion()) return undefined
    prepVideo(video)
    if (!('IntersectionObserver' in window)) {
      setCoastalSrc(COASTAL_VIDEO)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCoastalSrc((s) => s || COASTAL_VIDEO)
          safePlay(video)
        } else {
          video.pause()
        }
      },
      { rootMargin: '300px 0px' },
    )
    io.observe(video)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const video = coastalVideoRef.current
    if (video && coastalSrc) safePlay(video)
  }, [coastalSrc])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className={`mkt${heroReady ? ' is-ready' : ''}`} ref={rootRef}>
      {!loaderGone && (
        <div className={`mkt-loader${heroReady ? ' is-done' : ''}`} aria-hidden="true">
          <img src="/logo-nav.png" alt="" className="mkt-loader-logo" />
          <span className="mkt-loader-bar" />
        </div>
      )}

      <header className={`mkt-nav${scrolled || menuOpen ? ' is-scrolled' : ''}`}>
        <div className="mkt-nav-inner">
          <a className="mkt-brand" href="#home" onClick={() => setMenuOpen(false)}>
            <img src="/logo-nav.png" alt="My30A Host — Your personal 30A concierge" />
          </a>
          <nav
            id="mkt-primary-nav"
            className={`mkt-nav-links${menuOpen ? ' is-open' : ''}`}
            aria-label="Primary"
          >
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
          <Link className="mkt-btn mkt-btn-sand mkt-nav-cta" to="/app">
            Get Started
          </Link>
          <button
            type="button"
            className="mkt-nav-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mkt-primary-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <X size={22} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <section className="mkt-hero" id="home" ref={heroRef}>
        <div className="mkt-hero-media" aria-hidden="true">
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
            ref={videoRef}
            className={`mkt-hero-video${heroVideoOn ? ' is-on' : ''}`}
            src={HERO_VIDEO}
            poster={HERO_POSTER}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
          <div className="mkt-hero-overlay" />
        </div>

        <div className="mkt-hero-content">
          <p className="mkt-eyebrow mkt-hero-in" style={{ '--d': '0.1s' }}>
            Scenic Highway 30A · Florida
          </p>
          <h1 className="mkt-hero-title mkt-hero-in" style={{ '--d': '0.22s' }}>
            Where 30A Feels Effortless.
          </h1>
          <div className="mkt-hero-aside mkt-hero-in" style={{ '--d': '0.38s' }}>
            <p>
              Airport pickup, a stocked kitchen and a local concierge who knows every beach —
              My30A Host takes care of your stay before you even arrive.
            </p>
            <div className="mkt-hero-ctas">
              <Link className="mkt-btn mkt-btn-sand" to="/app">
                Get Started <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a className="mkt-btn mkt-btn-ghost" href="#meet-vitoria">
                Meet Vitoria
              </a>
            </div>
          </div>
        </div>

        <a className="mkt-scroll-cue" href="#experience" aria-label="Scroll to learn more">
          <span />
        </a>
      </section>

      <section className="mkt-stay" id="experience">
        <div className="mkt-wrap mkt-stay-intro">
          <p className="mkt-stay-copy" data-reveal>
            30A is for people who want to live well. My30A Host is for people who want nothing to
            get in the way of that.
          </p>
          <h2 className="mkt-h2 mkt-stay-title" data-reveal style={{ '--d': '0.1s' }}>
            Your stay, already <em>taken care of.</em>
          </h2>
        </div>

        <div className="mkt-stay-gallery" aria-label="30A stay moments">
          {STAY_IMAGES.map((image, i) => (
            <figure
              key={image.src}
              className="mkt-stay-shot mkt-frame"
              data-reveal
              style={{ '--d': `${i * 0.08}s` }}
            >
              <Img src={image.src} alt={image.alt} />
            </figure>
          ))}
        </div>
      </section>

      <section className="mkt-vitoria" id="meet-vitoria">
        <div className="mkt-wrap mkt-vitoria-grid">
          <figure className="mkt-vitoria-media mkt-frame" data-reveal="zoom">
            <Img src={`${M}/vitoria-deck.webp`} alt="Wooden deck with beach umbrellas overlooking turquoise water" />
          </figure>
          <div className="mkt-vitoria-card mkt-card" data-reveal style={{ '--d': '0.12s' }}>
            <p className="mkt-eyebrow mkt-eyebrow-dark">Your AI concierge</p>
            <h2 className="mkt-h2 mkt-vitoria-title">
              Meet Vitoria.
              <span>The local who knows everything.</span>
            </h2>
            <p className="mkt-lead">
              She knows the quiet beaches, the best tables, the captains worth calling and the
              places most visitors never find.
            </p>
            <p className="mkt-body">
              Vitoria is built into the My30A Host app and draws on our own directory of vetted
              local partners — yacht charters, golf carts, private chefs, photographers, spas and
              more — plus every public beach access on 30A and live restaurant hours. Ask in plain
              English and get a real answer, not a search result.
            </p>
            <dl className="mkt-stats">
              <div>
                <dt>
                  <CountUp to={160} />
                </dt>
                <dd>Vetted local partners</dd>
              </div>
              <div>
                <dt>
                  <CountUp to={79} />
                </dt>
                <dd>Public beach accesses</dd>
              </div>
              <div>
                <dt>Live</dt>
                <dd>Restaurant hours</dd>
              </div>
            </dl>
            <Link className="mkt-btn mkt-btn-sand" to="/app">
              Ask Vitoria <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-arrive" id="arrive">
        <header className="mkt-wrap mkt-section-head" data-reveal>
          <p className="mkt-eyebrow mkt-eyebrow-dark">Services</p>
          <h2 className="mkt-h2">Arrive. Everything&apos;s ready.</h2>
          <p className="mkt-sub">
            The little things are already handled, so you can get straight to the good part.
          </p>
        </header>

        <div className="mkt-wrap mkt-feature" id="grocery">
          <figure className="mkt-feature-media mkt-frame" data-reveal="zoom">
            <Img src="/services/grocery-stocked-kitchen.webp" alt="Bright kitchen with an open fridge and pantry fully stocked with fresh groceries" />
          </figure>
          <div className="mkt-feature-card mkt-card" data-reveal style={{ '--d': '0.12s' }}>
            <p className="mkt-eyebrow mkt-eyebrow-dark">Grocery Delivery</p>
            <h3 className="mkt-h3">Your kitchen, stocked before you arrive.</h3>
            <p className="mkt-body">
              Send us your list. We shop at Publix, deliver everything to your rental and stock the
              kitchen before you walk through the door.
            </p>
            <ul className="mkt-checks">
              <li>
                <Check size={16} aria-hidden="true" /> Shopped fresh at Publix
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> Unpacked and put away for you
              </li>
              <li>
                <Check size={16} aria-hidden="true" /> Card charged only after delivery
              </li>
            </ul>
            <div className="mkt-price">
              <span className="mkt-price-label">From</span>
              <span className="mkt-price-value">$229</span>
              <span className="mkt-price-note">+ your exact Publix receipt</span>
            </div>
            <Link className="mkt-btn mkt-btn-sand" to="/app">
              Arrange Groceries <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mkt-wrap mkt-feature mkt-feature-flip" id="airport-transfer">
          <figure className="mkt-feature-media mkt-frame" data-reveal="zoom">
            <Img src={`${M}/transfer-arrival.webp`} alt="Private jet and luxury SUV waiting on the tarmac" />
          </figure>
          <div className="mkt-feature-card mkt-card" data-reveal style={{ '--d': '0.12s' }}>
            <p className="mkt-eyebrow mkt-eyebrow-dark">Airport Transfer</p>
            <h3 className="mkt-h3">Your ride is waiting.</h3>
            <p className="mkt-body">
              Personalized airport pickup and a comfortable drive directly to your rental — from
              any of the three airports that serve 30A.
            </p>
            <ul className="mkt-airports" aria-label="Airports served">
              <li>
                <strong>ECP</strong> Panama City Beach
              </li>
              <li>
                <strong>VPS</strong> Destin–Fort Walton
              </li>
              <li>
                <strong>PNS</strong> Pensacola
              </li>
            </ul>
            <div className="mkt-price">
              <span className="mkt-price-label">From</span>
              <span className="mkt-price-value">$85</span>
              <span className="mkt-price-note">varies by airport and community</span>
            </div>
            <Link className="mkt-btn mkt-btn-sand" to="/app">
              Arrange Transfer <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-need" id="explore">
        <div className="mkt-wrap mkt-need-head">
          <div data-reveal>
            <p className="mkt-eyebrow mkt-eyebrow-dark">Explore 30A</p>
            <h2 className="mkt-h2">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
          </div>
          <div className="mkt-need-copy" data-reveal style={{ '--d': '0.12s' }}>
            <p className="mkt-body mkt-body-lg">
              Explore 30A is your local guide in the app: 160 vetted partners, from yacht charters
              and golf carts to private chefs and beach setups, plus all 79 public beach accesses
              from Inlet Beach to Dune Allen. No endless scrolling — just the places locals
              actually use.
            </p>
            <Link className="mkt-btn mkt-btn-navy" to="/app">
              Explore More <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mkt-wrap mkt-need-cards" aria-label="Explore categories">
          {EXPLORE.map((card, i) => (
            <Link
              key={card.key}
              to="/app"
              className="mkt-need-card mkt-frame"
              data-reveal
              style={{ '--d': `${i * 0.09}s` }}
            >
              <Img src={card.src} alt={card.alt} />
              <span className="mkt-need-card-shade" aria-hidden="true" />
              <span className="mkt-need-card-text">
                <span className="mkt-need-card-title">{card.title}</span>
                <span className="mkt-need-card-meta">{card.meta}</span>
              </span>
              <span className="mkt-need-card-arrow" aria-hidden="true">
                <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mkt-coastal" id="coastal">
        <div className="mkt-coastal-media" aria-hidden="true">
          <video
            ref={coastalVideoRef}
            className="mkt-coastal-video"
            src={coastalSrc || undefined}
            poster={COASTAL_POSTER}
            muted
            loop
            playsInline
            preload="none"
          />
          <div className="mkt-coastal-overlay" />
        </div>
        <div className="mkt-wrap mkt-coastal-content">
          <h2 className="mkt-coastal-title" data-reveal>
            Where coastal living
            <br />
            became <em>an art form.</em>
          </h2>
          <a className="mkt-btn mkt-btn-sand" href="#explore" data-reveal style={{ '--d': '0.15s' }}>
            Explore 30A
          </a>
        </div>
      </section>

      <section className="mkt-ask" id="ask">
        <div className="mkt-wrap mkt-ask-inner">
          <div className="mkt-ask-copy" data-reveal>
            <p className="mkt-eyebrow mkt-eyebrow-dark">Ask anything</p>
            <h2 className="mkt-h2 mkt-ask-title">
              You ask.
              <br />
              Vitoria knows.
            </h2>
            <p className="mkt-body mkt-body-lg">
              Skip the ten open browser tabs. Vitoria answers from our own database first — real
              partners, real beach accesses, today&apos;s hours — and your airport ride and
              groceries are booked in the very same app.
            </p>
            <Link className="mkt-btn mkt-btn-sand" to="/app">
              Ask Vitoria <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <ul className="mkt-chat" aria-label="Example questions">
            {ASK.map((item, i) => (
              <li key={item.q} data-reveal style={{ '--d': `${0.1 + i * 0.12}s` }}>
                <p className="mkt-chat-q">{item.q}</p>
                <div className="mkt-chat-a">
                  <span className="mkt-chat-avatar" aria-hidden="true">
                    V
                  </span>
                  <p>{item.a}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-cta-wrap" id="get-started">
        <div className="mkt-brand-cta" data-reveal>
          <p className="mkt-brand-cta-name">MY30A HOST</p>
          <p className="mkt-brand-cta-tag">The effortless way to experience 30A.</p>
          <Link className="mkt-btn mkt-btn-sand" to="/app">
            Get Started <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="mkt-footer">
        <div className="mkt-wrap mkt-footer-inner">
          <div className="mkt-footer-brand">
            <a className="mkt-footer-logo" href="#home">
              <img src="/logo-nav.png" alt="My30A Host — Your personal 30A concierge" loading="lazy" decoding="async" />
            </a>
            <p className="mkt-footer-about">
              30A is for people who want to live well. My30A Host is for people who want nothing
              to get in the way of that.
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

          <div className="mkt-footer-col">
            <h3 className="mkt-footer-heading">Quick Links</h3>
            <ul className="mkt-footer-links">
              <li>
                <a href="#experience">Experience</a>
              </li>
              <li>
                <a href="#arrive">Services</a>
              </li>
              <li>
                <a href="#explore">Explore 30A</a>
              </li>
              <li>
                <a href="#meet-vitoria">Meet Vitoria</a>
              </li>
              <li>
                <a href="#ask">Contact</a>
              </li>
            </ul>
          </div>

          <div className="mkt-footer-col">
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
          </div>

          <div className="mkt-footer-col">
            <h3 className="mkt-footer-heading">Contact Info</h3>
            <a className="mkt-footer-email" href="tel:+18509554577">
              <span className="mkt-footer-email-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
                </svg>
              </span>
              (850) 955-4577
            </a>
            <a className="mkt-footer-email" href="mailto:my30ahost@gmail.com">
              <span className="mkt-footer-email-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
                  />
                </svg>
              </span>
              my30ahost@gmail.com
            </a>
            <a className="mkt-footer-email" href="https://www.instagram.com/my30a_host/" target="_blank" rel="noreferrer">
              <span className="mkt-footer-email-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 2.8A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 0 1 12 7.8zm0 2A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.5a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"
                  />
                </svg>
              </span>
              @my30a_host
            </a>
          </div>
        </div>

        <div className="mkt-footer-bar">
          <div className="mkt-wrap mkt-footer-bar-inner">
            <p>Copyright © 2026 My 30A Host. All rights reserved.</p>
            <p>
              <a href="#privacy">Privacy Policy</a>
              <span aria-hidden="true"> | </span>
              <a href="#terms">Terms of Services</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
