import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plane, ShoppingBag, Sparkles } from 'lucide-react'
import { useHostBrand } from '../../lib/hostHome.js'

// Log in / Sign up frame: a cinematic 30A photo panel (slow cross-fading slideshow) beside the
// form on desktop, above it on phones. The form itself is passed in as children.
const SLIDES = [
  { src: '/marketing/hero-poster.webp', caption: 'Dune Allen Beach' },
  { src: '/marketing/coastal-poster.webp', caption: 'Gulf Place' },
  { src: '/marketing/stay-sunset-paddle.webp', caption: 'Sunset on 30A' },
]

const PERKS = [
  { Icon: Plane, text: 'Airport transfers from $85' },
  { Icon: ShoppingBag, text: 'Groceries stocked before you arrive' },
  { Icon: Sparkles, text: 'Vitoria, your AI local, by text or voice' },
]

// The logo above the form: the host's (Host version, guest came in through their QR code) with a
// small "concierge by My30A Host" line, otherwise My30A Host's own.
export function AuthLogo() {
  const hostBrand = useHostBrand()
  if (!hostBrand?.logo_url) {
    return <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
  }
  return (
    <div className="auth-hostlogo">
      <img src={hostBrand.logo_url} alt={hostBrand.host_name} />
      <small>
        {hostBrand.home_name} · concierge by <b>My30A Host</b>
      </small>
    </div>
  )
}

// eyebrow / heading / perks let other pages (the partner sign-up form) reuse this frame.
export default function AuthLayout({ children, eyebrow = 'Scenic Highway 30A · Florida', heading, perks = PERKS, brandable = true }) {
  const [slide, setSlide] = useState(0)
  const storedBrand = useHostBrand()
  const hostBrand = brandable ? storedBrand : null
  const slides = hostBrand?.cover_url ? [{ src: hostBrand.cover_url, caption: hostBrand.home_name }, ...SLIDES] : SLIDES

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 6500)
    return () => clearInterval(t)
  }, [slides.length])

  useEffect(() => {
    document.documentElement.classList.add('auth-open')
    return () => document.documentElement.classList.remove('auth-open')
  }, [])

  return (
    <div className="auth">
      <aside className="auth-media">
        <div className="auth-slides" aria-hidden="true">
          {slides.map((s, i) => (
            <img key={s.src} src={s.src} alt="" className={i === slide % slides.length ? 'is-on' : ''} decoding="async" loading={i ? 'lazy' : 'eager'} />
          ))}
        </div>
        <div className="auth-shade" aria-hidden="true" />

        <div className="auth-media-top">
          <Link to="/" className="auth-home" aria-label="Back to the home page">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link to="/" className="auth-brand">
            <img src="/brand/my30a-logo-light.png" alt="My30A Host" width="720" height="319" />
          </Link>
          {hostBrand?.logo_url ? (
            <span className="auth-brand-host">
              <img src={hostBrand.logo_url} alt={hostBrand.host_name} />
            </span>
          ) : null}
        </div>

        <div className="auth-media-copy">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h2>
            {heading || (
              <>
                Your 30A stay, <em>handled.</em>
              </>
            )}
          </h2>
          <ul className="auth-perks">
            {perks.map(({ Icon, text }, i) => (
              <li key={text} style={{ '--i': i }}>
                <span>
                  <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="auth-dots" aria-hidden="true">
            {slides.map((s, i) => (
              <i key={s.src} className={i === slide % slides.length ? 'is-on' : ''} />
            ))}
            <small>{slides[slide % slides.length].caption}</small>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">{children}</div>
        <p className="auth-legal">© 2026 My30A Host · (850) 955-4577</p>
      </main>
    </div>
  )
}
