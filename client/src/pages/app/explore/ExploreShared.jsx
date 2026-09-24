import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Baby,
  BadgeCheck,
  Bike,
  Briefcase,
  Camera,
  Car,
  ChefHat,
  ChevronRight,
  Compass,
  Flag,
  Flame,
  Gem,
  Gift,
  Heart,
  House,
  Info,
  Leaf,
  MapPin,
  Palette,
  PawPrint,
  ShoppingBag,
  Star,
  Stethoscope,
  Tent,
  Trophy,
  Umbrella,
  Users,
  UtensilsCrossed,
  Waves,
  Wine,
  Coffee,
} from 'lucide-react'
import BottomNav from '../BottomNav.jsx'

// Category icons are stored by name in the database (explore_categories.icon).
const ICONS = {
  UtensilsCrossed,
  Umbrella,
  Waves,
  Bike,
  Users,
  Leaf,
  Camera,
  ShoppingBag,
  Palette,
  Briefcase,
  Info,
  Wine,
  Coffee,
}

export function iconFor(name) {
  return ICONS[name] || Compass
}

export function ExploreShell({ active = 'explore', nav = true, className = '', children }) {
  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className={`app-home app-xfer app-exp${className ? ` ${className}` : ''}`}>
          <div className="app-home-scroll">{children}</div>
          {nav ? <BottomNav active={active} /> : null}
        </div>
      </div>
    </div>
  )
}

export function BackButton({ to = '/app/explore', className = 'app-xfer-back' }) {
  const navigate = useNavigate()
  return (
    <button type="button" className={className} aria-label="Back" onClick={() => navigate(to)}>
      <ArrowLeft size={className === 'app-xfer-back' ? 20 : 24} strokeWidth={1.5} aria-hidden="true" />
    </button>
  )
}

export function ExploreHead({ title, sub, back }) {
  return (
    <header className="app-exp-head">
      <BackButton to={back} />
      <div className="app-exp-head-text">
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
    </header>
  )
}

export function Pill({ icon: Icon, children, white }) {
  return (
    <span className={`app-exp-pill${white ? ' is-white' : ''}`}>
      {Icon ? <Icon size={14} strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

export function RatingPill({ rating, reviews, white }) {
  // Real partners without a published rating get a neutral badge instead of a made-up score.
  if (rating === null || rating === undefined) {
    return <span className={`app-exp-pill${white ? ' is-white' : ''}`}>Local partner</span>
  }
  return (
    <span className={`app-exp-pill${white ? ' is-white' : ''}`}>
      <Star size={14} strokeWidth={0} fill="#f5b50a" className="app-exp-star" aria-hidden="true" />
      <b>{Number(rating).toFixed(1)}</b> ({reviews ?? 0})
    </span>
  )
}

// Image that fades in once decoded over a shimmer — photos never pop in half-drawn.
export function FadeImg({ className = '', ...props }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      {...props}
      className={`app-fade-img${loaded ? ' is-loaded' : ''}${className ? ` ${className}` : ''}`}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      decoding="async"
    />
  )
}

// Partners without a photo of their own get a designed card in their guide's colour + icon,
// never a borrowed stock photo that could be mistaken for the business.
const GUIDE_THEMES = {
  'on-the-water': ['sea', Waves],
  'golf-cart-rentals': ['leaf', Car],
  'bike-rentals': ['leaf', Bike],
  'golf-courses': ['leaf', Flag],
  pickleball: ['leaf', Trophy],
  'beach-bonfires': ['sand', Flame],
  'wellness-spa': ['olive', Leaf],
  shopping: ['lime', ShoppingBag],
  'welcome-setup': ['lime', Gift],
  family: ['pink', Users],
  'kids-camps': ['pink', Tent],
  babysitting: ['pink', Baby],
  'baby-kids-equipment': ['pink', Baby],
  photography: ['peach', Camera],
  'weddings-events': ['peach', Gem],
  'arts-culture': ['violet', Palette],
  'private-chef': ['slate', ChefHat],
  'pet-services': ['slate', PawPrint],
  medical: ['teal', Stethoscope],
  'real-estate': ['slate', House],
  'dining-restaurant': ['sand', UtensilsCrossed],
  'dining-bar': ['violet', Wine],
  'dining-coffee': ['peach', Coffee],
}

export function themeOf(guideSlug) {
  const [tone, Icon] = GUIDE_THEMES[guideSlug] || ['sea', Compass]
  return { tone, Icon }
}

function monogram(name) {
  return String(name || '')
    .replace(/^(the|30a)\s+/i, '')
    .split(/\s+/)
    .filter((w) => /^[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function BrandArt({ name, guideSlug, className = '', large = false }) {
  const { tone, Icon } = themeOf(guideSlug)
  return (
    <span
      className={`app-exp-art is-${tone}${large ? ' is-large' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <Icon className="app-exp-art-bg" strokeWidth={1} />
      <span className="app-exp-art-mono">{monogram(name)}</span>
      <span className="app-exp-art-ico">
        <Icon size={large ? 18 : 14} strokeWidth={1.8} />
      </span>
    </span>
  )
}

export function DetailHero({ image, name, guideSlug, loading = false, back = '/app/explore', children }) {
  return (
    <>
      <div className={`app-exp-hero${loading ? ' app-fade-bg' : ''}`}>
        {loading ? null : image ? (
          <FadeImg src={image} alt="" className="app-exp-hero-img" fetchpriority="high" />
        ) : (
          <BrandArt name={name} guideSlug={guideSlug} large className="app-exp-hero-img" />
        )}
        <span className="app-exp-hero-shade" aria-hidden="true" />
        <BackButton to={back} className="app-exp-hero-back" />
      </div>
      <div className="app-exp-sheet app-enter">{children}</div>
    </>
  )
}

export function TitleRow({ title, saved, onToggle, busy }) {
  return (
    <div className="app-exp-title-row">
      <h1>{title}</h1>
      <button
        type="button"
        className={`app-exp-heart${saved ? ' is-on' : ''}`}
        aria-label={saved ? 'Remove from saved places' : 'Save'}
        aria-pressed={Boolean(saved)}
        onClick={onToggle}
        disabled={busy}
      >
        <Heart size={30} strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </div>
  )
}

export function MapCard({ name = 'Rosemary Beach', line1 = '30A, FL, 32461', line2 = 'Near the beach access on E. Kingston Rd.' }) {
  return (
    <div className="app-exp-map">
      <div className="app-exp-map-img" aria-hidden="true">
        <MapPin size={34} strokeWidth={0} fill="#f49300" />
      </div>
      <div className="app-exp-map-body">
        <strong>{name}</strong>
        <p>
          {line1}
          <br />
          {line2}
        </p>
      </div>
    </div>
  )
}

export function Actions({ primary, secondary }) {
  const external = (href) => (href && /^https?:/.test(href) ? { target: '_blank', rel: 'noreferrer' } : {})
  return (
    <div className="app-exp-actions">
      <a href={primary.href || '#book'} className="app-exp-btn is-primary" {...external(primary.href)}>
        <primary.Icon size={20} strokeWidth={1.5} aria-hidden="true" />
        {primary.label}
      </a>
      <a href={secondary.href || '#website'} className="app-exp-btn is-ghost" {...external(secondary.href)}>
        <secondary.Icon size={20} strokeWidth={1.5} aria-hidden="true" />
        {secondary.label}
      </a>
    </div>
  )
}

// Dining tiles list local favorites from the client's list, not paid partners.
export const DINING_KEYS = new Set(['restaurants', 'bars', 'coffee'])

export function CategoryTile({ category, featured = false, index = 0 }) {
  const Icon = iconFor(category.icon)
  return (
    <Link
      to={category.to}
      className={`app-exp-tile is-${category.tone}${featured ? ' is-featured' : ''}${category.coming_soon ? ' is-soon' : ''} app-rise`}
      style={{ '--i': index }}
      state={{ label: category.label }}
    >
      <span className="app-exp-tile-media app-fade-bg">
        {category.image_url ? (
          <FadeImg src={category.image_url} alt="" loading={index < 6 ? 'eager' : 'lazy'} />
        ) : null}
      </span>
      {category.coming_soon ? <span className="app-exp-tile-soon">Coming Soon</span> : null}
      <span className="app-exp-tile-ico" aria-hidden="true">
        <Icon size={featured ? 20 : 17} strokeWidth={1.6} />
      </span>
      <span className="app-exp-tile-text">
        <strong>{category.label}</strong>
        <small>
          {category.coming_soon
            ? 'Curated list on the way'
            : category.count
              ? `${category.count} ${DINING_KEYS.has(category.key) ? 'places' : 'local partners'}`
              : 'Explore'}
          {category.coming_soon ? null : <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />}
        </small>
      </span>
    </Link>
  )
}

export function TileSkeleton({ count = 7 }) {
  return Array.from({ length: count }, (_, i) => (
    <span key={i} className={`app-exp-tile app-skel${i === 0 ? ' is-featured' : ''}`} aria-hidden="true" />
  ))
}

export function GuideCard({ item, index = 0 }) {
  return (
    <Link to={item.to} className="app-exp-card app-rise" style={{ '--i': index }}>
      <span className="app-exp-card-media app-fade-bg">
        {item.image ? <FadeImg src={item.image} alt="" loading={index < 4 ? 'eager' : 'lazy'} /> : null}
      </span>
      <span className="app-exp-card-top">
        {item.vendors ? <span className="app-exp-tag">{item.vendors}</span> : <span />}
        <span className="app-exp-card-go" aria-hidden="true">
          <ArrowUpRight size={16} strokeWidth={2} />
        </span>
      </span>
      <span className="app-exp-card-foot">
        <strong>{item.title}</strong>
        {item.from ? <small>{item.from}</small> : null}
      </span>
    </Link>
  )
}

export function GuideSkeleton({ count = 4 }) {
  return Array.from({ length: count }, (_, i) => (
    <span key={i} className="app-exp-card app-skel" aria-hidden="true" />
  ))
}

export function VendorCard({ vendor, index = 0 }) {
  const footLabel = vendor.from ? `From $${vendor.from}` : vendor.kind === 'beach' ? 'Public access' : 'Book direct'
  const rated = vendor.rating !== null && vendor.rating !== undefined
  return (
    <Link to={vendor.to} className="app-exp-vendor app-rise" style={{ '--i': Math.min(index, 11) }}>
      <span className="app-exp-vendor-media app-fade-bg">
        {vendor.image ? (
          <FadeImg src={vendor.image} alt="" loading={index < 4 ? 'eager' : 'lazy'} width={132} height={132} />
        ) : (
          <BrandArt name={vendor.name} guideSlug={vendor.guide_slug} />
        )}
      </span>
      <span className="app-exp-vendor-body">
        <span className="app-exp-vendor-name">
          <strong>{vendor.name}</strong>
          {vendor.kind === 'vendor' ? (
            <BadgeCheck size={15} strokeWidth={2} className="app-exp-verified" aria-label="Local partner" />
          ) : null}
        </span>
        <span className="app-exp-vendor-meta">
          <MapPin size={12} strokeWidth={1.8} aria-hidden="true" />
          <span className="app-exp-vendor-place">{vendor.place}</span>
          {rated ? (
            <>
              <Star size={12} strokeWidth={0} fill="#f5b50a" aria-hidden="true" />
              <b>{Number(vendor.rating).toFixed(1)}</b>
              {vendor.reviews ? <span className="app-exp-vendor-rev">({vendor.reviews})</span> : null}
            </>
          ) : null}
        </span>
        {vendor.desc ? <span className="app-exp-vendor-desc">{vendor.desc}</span> : null}
        <span className="app-exp-vendor-foot">
          <span className="app-exp-vendor-price">{footLabel}</span>
          <span className="app-exp-vendor-cta">
            View
            <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" />
          </span>
        </span>
      </span>
    </Link>
  )
}

export function VendorSkeleton({ count = 5 }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="app-exp-vendor is-skel" aria-hidden="true">
      <span className="app-exp-vendor-media app-skel" />
      <span className="app-exp-vendor-body">
        <span className="app-skel app-skel-title" style={{ width: '70%' }} />
        <span className="app-skel app-skel-line" style={{ width: '45%' }} />
        <span className="app-skel app-skel-line" style={{ width: '95%' }} />
        <span className="app-skel app-skel-line" style={{ width: '60%' }} />
      </span>
    </div>
  ))
}

export function DetailSkeleton() {
  return (
    <div className="app-exp-detail-skel" aria-label="Loading">
      <span className="app-skel app-skel-title" style={{ width: '72%', height: 28 }} />
      <span className="app-exp-detail-skel-row">
        <span className="app-skel app-skel-card" style={{ width: 130, height: 34, borderRadius: 999 }} />
        <span className="app-skel app-skel-card" style={{ width: 100, height: 34, borderRadius: 999 }} />
      </span>
      <span className="app-skel app-skel-line" style={{ width: '100%' }} />
      <span className="app-skel app-skel-line" style={{ width: '92%' }} />
      <span className="app-skel app-skel-line" style={{ width: '64%' }} />
      <span className="app-skel app-skel-card" style={{ width: '100%', height: 96 }} />
    </div>
  )
}
