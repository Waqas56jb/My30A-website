import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Compass,
  Heart,
  Info,
  Leaf,
  MapPin,
  Mountain,
  Paintbrush,
  ShoppingBag,
  Star,
  Umbrella,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import BottomNav from '../BottomNav.jsx'

// Category icons are stored by name in the database (explore_categories.icon).
const ICONS = {
  UtensilsCrossed,
  Umbrella,
  Mountain,
  Leaf,
  ShoppingBag,
  Users,
  Paintbrush,
  Info,
}

export function iconFor(name) {
  return ICONS[name] || Compass
}

// Static fallbacks (same values as the seeded database) used while the API loads.
export const CATEGORIES = [
  { key: 'restaurants', label: 'Restaurants', tone: 'sand', icon: 'UtensilsCrossed', to: '/app/explore/guide?c=restaurants' },
  { key: 'beaches', label: 'Beaches', tone: 'sea', icon: 'Umbrella', to: '/app/explore/guide?c=beaches' },
  { key: 'activities', label: 'Activities', tone: 'leaf', icon: 'Mountain', to: '/app/explore/guide?c=all' },
  { key: 'wellness', label: 'Wellness', tone: 'olive', icon: 'Leaf', to: '/app/explore/guide?c=all' },
  { key: 'shopping', label: 'Shopping', tone: 'pink', icon: 'ShoppingBag', to: '/app/explore/guide?c=shopping' },
  { key: 'family', label: 'Family & Kids', tone: 'cyan', icon: 'Users', to: '/app/explore/guide?c=family' },
  { key: 'essentials', label: 'Local Essentials', tone: 'lime', icon: 'Paintbrush', to: '/app/explore/guide?c=all' },
  { key: 'info', label: 'Public Information', tone: 'peach', icon: 'Info', to: '/app/explore/info' },
]

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'beaches', label: 'Beaches' },
  { key: 'bikes', label: 'Bikes' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'family', label: 'Family & Kids' },
]

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

export function DetailHero({ image, back = '/app/explore', children }) {
  return (
    <>
      <div className="app-exp-hero" style={{ backgroundImage: `url('${image}')` }}>
        <BackButton to={back} className="app-exp-hero-back" />
      </div>
      <div className="app-exp-sheet">{children}</div>
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

export function GuideCard({ item }) {
  return (
    <Link to={item.to} className="app-exp-card" style={{ backgroundImage: `url('${item.image}')` }}>
      <strong>{item.title}</strong>
      <span className="app-exp-tags">
        <span className="app-exp-tag">{item.from}</span>
        <span className="app-exp-tag">{item.vendors}</span>
      </span>
    </Link>
  )
}

export function VendorCard({ vendor }) {
  return (
    <article className="app-exp-vendor">
      <img src={vendor.image} alt="" />
      <div className="app-exp-vendor-body">
        <h3>{vendor.name}</h3>
        <div className="app-exp-pills">
          <Pill icon={MapPin}>{vendor.place}</Pill>
          <RatingPill rating={vendor.rating} reviews={vendor.reviews} />
        </div>
        <p>{vendor.desc}</p>
        <div className="app-exp-vendor-foot">
          <strong>{vendor.from ? `From $${vendor.from}` : vendor.kind === 'beach' ? 'Public access' : 'Book direct'}</strong>
          <Link to={vendor.to}>{vendor.kind === 'vendor' ? 'View Vendor' : 'View'}</Link>
        </div>
      </div>
    </article>
  )
}
