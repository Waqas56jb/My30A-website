import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const NAV = [
  { label: 'Home', href: '#home' },
  { label: 'Experience', href: '#experience' },
  { label: 'Services', href: '#services' },
  { label: 'Explore 30A', href: '#explore' },
  { label: 'Meet Vitoria', href: '#meet-vitoria' },
]

const POSTER = '/Rectangle%201.png'
const VIDEO = '/19VSW352C-Dune-Allen.mp4'

const STAY_IMAGES = [
  { src: '/image1.png', alt: 'Boardwalk to the beach' },
  { src: '/image2.png', alt: 'Ocean-view balcony seating' },
  { src: '/image3.png', alt: 'Aerial view of white sand and turquoise water' },
  { src: '/image4.png', alt: 'Aerial coastline along 30A' },
  { src: '/image5.png', alt: 'Sunset over the water' },
]

export default function Home() {
  const videoRef = useRef(null)

  useEffect(() => {
    document.title = 'My30A Host · Where 30A Feels Effortless'
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    video.defaultMuted = true
    video.muted = true
    video.playsInline = true
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    const tryPlay = () => {
      const result = video.play()
      if (result?.catch) result.catch(() => {})
    }

    tryPlay()
    video.addEventListener('canplay', tryPlay)
    document.addEventListener('visibilitychange', tryPlay)
    return () => {
      video.removeEventListener('canplay', tryPlay)
      document.removeEventListener('visibilitychange', tryPlay)
    }
  }, [])

  return (
    <div className="mkt">
      <section className="mkt-hero" id="home">
        <div className="mkt-hero-media" aria-hidden="true">
          <img className="mkt-hero-poster" src={POSTER} alt="" />
          <video
            ref={videoRef}
            className="mkt-hero-video"
            src={VIDEO}
            poster={POSTER}
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

        <header className="mkt-nav">
          <div className="mkt-nav-inner">
            <a className="mkt-brand" href="#home">
              <img src="/logo-nav.png" alt="My30A Host — Your personal 30A concierge" />
            </a>
            <nav className="mkt-nav-links" aria-label="Primary">
              {NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
            <Link className="mkt-btn mkt-btn-navy" to="/login">
              Get Started
            </Link>
          </div>
        </header>

        <div className="mkt-hero-bottom">
          <h1 className="mkt-hero-title">Where 30A Feels Effortless.</h1>
          <div className="mkt-hero-aside">
            <p>My30A Host makes everything before, during, and around your stay effortless.</p>
            <a className="mkt-btn mkt-btn-sand" href="#meet-vitoria">
              Meet Vitoria
            </a>
          </div>
        </div>
      </section>

      <section className="mkt-stay" id="experience">
        <div className="mkt-stay-intro">
          <p className="mkt-stay-copy">
            30A is for people who want to live well. My30A Host is for people who want
            nothing to get in the way of that.
          </p>
          <h2 className="mkt-stay-title">
            Your stay, already
            <br />
            taken care of.
          </h2>
        </div>

        <div className="mkt-stay-gallery" aria-label="30A stay moments">
          {STAY_IMAGES.map((image) => (
            <figure key={image.src} className="mkt-stay-shot">
              <img src={image.src} alt={image.alt} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      <section className="mkt-vitoria" id="meet-vitoria">
        <div className="mkt-vitoria-inner">
          <figure className="mkt-vitoria-media">
            <span className="mkt-vitoria-accent" aria-hidden="true" />
            <img
              src="/image6.png"
              alt="Wooden deck with beach umbrellas overlooking turquoise water"
              loading="lazy"
            />
          </figure>
          <div className="mkt-vitoria-card" aria-hidden="true" />
          <div className="mkt-vitoria-copy">
            <h2 className="mkt-vitoria-title">
              <span className="mkt-vitoria-name">Meet Vitoria.</span>
              <span className="mkt-vitoria-tag">Your local knows everything.</span>
            </h2>
            <p className="mkt-vitoria-lead">
              She knows the quiet beaches, the best tables, the captains worth calling and the
              places most visitors never find.
            </p>
            <p className="mkt-vitoria-body">
              Vitoria is your personal 30A concierge, here to make every part of your stay feel
              effortless. From hidden beaches and unforgettable dining to golf carts, wellness,
              local experiences, and everything in between, she knows where to go, who to call, and
              what&apos;s worth discovering. Just ask, and she&apos;ll help you experience 30A like
              a local.
            </p>
            <a className="mkt-vitoria-btn" href="#ask">
              Ask anything
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
