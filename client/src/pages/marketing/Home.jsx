import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const NAV = [
  { label: 'Home', href: '#home' },
  { label: 'Experience', href: '#experience' },
  { label: 'Services', href: '#arrive' },
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
  const coastalVideoRef = useRef(null)

  useEffect(() => {
    document.title = 'My30A Host · Where 30A Feels Effortless'
  }, [])

  useEffect(() => {
    const videos = [videoRef.current, coastalVideoRef.current].filter(Boolean)
    if (!videos.length) return undefined

    const cleanups = videos.map((video) => {
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
    })

    return () => cleanups.forEach((fn) => fn())
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
          <div className="mkt-vitoria-card">
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

      <section className="mkt-arrive" id="arrive">
        <header className="mkt-arrive-head">
          <h2 className="mkt-arrive-title">Arrive. Everything&apos;s ready.</h2>
          <p className="mkt-arrive-sub">
            The little things are already handled, so you can get straight to the good part.
          </p>
        </header>

        <div className="mkt-arrive-stage">
          <figure className="mkt-arrive-media">
            <img
              src="/image7.png"
              alt="Modern open kitchen with island seating and ocean view"
              loading="lazy"
            />
          </figure>

          <div className="mkt-arrive-card">
            <h3 className="mkt-arrive-card-title">Grocery Delivery</h3>
            <p className="mkt-arrive-card-lead">Your kitchen, stocked before you arrive.</p>
            <p className="mkt-arrive-card-body">
              Send us your list. We&apos;ll shop at Publix Watersound, deliver everything to your
              rental and stock the kitchen before you walk through the door.
            </p>
            <p className="mkt-arrive-card-price">From $149</p>
            <a className="mkt-arrive-card-btn" href="#grocery">
              Arrange Groceries
            </a>
          </div>
        </div>

        <div className="mkt-transfer-stage" id="airport-transfer">
          <figure className="mkt-transfer-media">
            <span className="mkt-transfer-accent" aria-hidden="true" />
            <img
              src="/image8.png"
              alt="Private jet and luxury SUV on the tarmac"
              loading="lazy"
            />
          </figure>

          <div className="mkt-transfer-card">
            <h3 className="mkt-transfer-card-title">Airport Transfer</h3>
            <p className="mkt-transfer-card-lead">Your ride is waiting.</p>
            <p className="mkt-transfer-card-body">
              Personalized airport pickup and a comfortable drive directly to your rental.
            </p>
            <p className="mkt-transfer-card-price">ECP $150 · VPS $225 · PNS $299</p>
            <a className="mkt-transfer-card-btn" href="#transfer">
              Arrange Transfer
            </a>
          </div>
        </div>
      </section>

      <section className="mkt-need" id="explore">
        <div className="mkt-need-inner">
          <div className="mkt-need-copy">
            <h2 className="mkt-need-title">
              Everything you need.
              <br />
              Nothing you don&apos;t.
            </h2>
            <p className="mkt-need-body">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <a className="mkt-need-btn" href="#explore-more">
              Explore More
            </a>
          </div>

          <div className="mkt-need-cards" aria-label="Lifestyle categories">
            <figure className="mkt-need-card">
              <img src="/image10.png" alt="Eat — Restaurants, private dining, local favorites" loading="lazy" />
            </figure>
            <figure className="mkt-need-card">
              <img src="/image11.png" alt="Move — Airport transfers, golf carts, bikes, boating" loading="lazy" />
            </figure>
            <figure className="mkt-need-card">
              <img src="/image12.png" alt="Coastal evening along 30A" loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      <section className="mkt-coastal" id="coastal">
        <div className="mkt-coastal-stage">
          <div className="mkt-coastal-media" aria-hidden="true">
            <video
              ref={coastalVideoRef}
              className="mkt-coastal-video"
              src="/19VSW352C-Gulf-Place.mp4"
              poster="/cover.png"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          </div>

          <div className="mkt-coastal-card">
            <h2 className="mkt-coastal-title">
              <span className="mkt-coastal-title-lead">Where coastal living became</span>
              <span className="mkt-coastal-title-rest">an art form.</span>
            </h2>
            <a className="mkt-coastal-btn" href="#explore">
              Explore 30A
            </a>
          </div>
        </div>

        <div className="mkt-ask" id="ask">
          <div className="mkt-ask-inner">
            <div className="mkt-ask-copy">
              <h2 className="mkt-ask-title">
                <span className="mkt-ask-title-line">You ask.</span>
                <span className="mkt-ask-title-line">Vitoria knows.</span>
              </h2>
              <p className="mkt-ask-body">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <a className="mkt-ask-btn" href="#ask">
                Ask anything
              </a>
            </div>

            <ul className="mkt-ask-list">
              <li>
                <p className="mkt-ask-q">Where should we have dinner tonight?</p>
                <p className="mkt-ask-a">Vitoria finds the right table.</p>
              </li>
              <li>
                <p className="mkt-ask-q">Can we get a golf cart tomorrow?</p>
                <p className="mkt-ask-a">She points you in the right direction.</p>
              </li>
              <li>
                <p className="mkt-ask-q">What&apos;s the best beach for the kids?</p>
                <p className="mkt-ask-a">She knows exactly where to send you.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="mkt-footer">
        <section className="mkt-brand-cta" id="get-started">
          <div className="mkt-brand-cta-inner">
            <p className="mkt-brand-cta-name">MY30A HOST</p>
            <p className="mkt-brand-cta-tag">The effortless way to experience 30A.</p>
            <Link className="mkt-brand-cta-btn" to="/login">
              Explore 30A
            </Link>
          </div>
        </section>

        <div className="mkt-footer-main">
          <div className="mkt-footer-inner">
            <div className="mkt-footer-brand">
              <a className="mkt-footer-logo" href="#home">
                <img src="/logo-nav.png" alt="My30A Host — Your personal 30A concierge" />
              </a>
              <p className="mkt-footer-about">
                30A is for people who want to live well. My30A Host is for people who want nothing
                to get in the way of that.
              </p>
              <div className="mkt-footer-social" aria-label="Social media">
                <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H6v4h3v9h4v-9h3.2l.8-4H13V9c0-.6.4-1 1-1z"
                    />
                  </svg>
                </a>
                <a href="https://x.com/" target="_blank" rel="noreferrer" aria-label="X">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M18.2 3H21l-6.6 7.5L22 21h-6.2l-4.4-5.7L6 21H3.2l7-8L2 3h6.3l4 5.2L18.2 3zm-1.1 16.2h1.7L7 4.7H5.2l11.9 14.5z"
                    />
                  </svg>
                </a>
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 2.8A4.2 4.2 0 1 1 7.8 12 4.2 4.2 0 0 1 12 7.8zm0 2A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.5a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"
                    />
                  </svg>
                </a>
                <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M23 12.2s0-3.2-.4-4.7c-.2-.9-.9-1.6-1.8-1.8C18.5 5.2 12 5.2 12 5.2s-6.5 0-8.8.5c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8 2.3.5 8.8.5 8.8.5s6.5 0 8.8-.5c.9-.2 1.6-.9 1.8-1.8.4-1.5.4-4.7.4-4.7zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z"
                    />
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
                  <a href="#arrive">Grocery Delivery</a>
                </li>
                <li>
                  <a href="#airport-transfer">Airport Transfer</a>
                </li>
              </ul>
            </div>

            <div className="mkt-footer-col">
              <h3 className="mkt-footer-heading">Contact Info</h3>
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
            </div>
          </div>
        </div>

        <div className="mkt-footer-bar">
          <div className="mkt-footer-bar-inner">
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
