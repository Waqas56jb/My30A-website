import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bike,
  Briefcase,
  Camera,
  Compass,
  Heart,
  Info,
  Leaf,
  MapPin,
  Palette,
  ShoppingBag,
  Star,
  Umbrella,
  Users,
  UtensilsCrossed,
  Waves,
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
}

export function iconFor(name) {
  return ICONS[name] || Compass
}

// Static fallback (mirrors the seeded database) used only while /api/guest/explore is loading.
export const CATEGORIES = [
  { key: 'restaurants', label: 'Restaurants', tone: 'sand', icon: 'UtensilsCrossed', image_url: '/image7.png', coming_soon: true, to: '/app/explore/guide?c=restaurants' },
  { key: 'beaches', label: 'Beaches', tone: 'sea', icon: 'Umbrella', image_url: '/image1.png', to: '/app/explore/info?focus=beach-access' },
  { key: 'on-the-water', label: 'On The Water', tone: 'cyan', icon: 'Waves', image_url: '/image3.png', to: '/app/explore/guide?c=on-the-water' },
  { key: 'golf-outdoor', label: 'Golf & Outdoor Rentals', tone: 'leaf', icon: 'Bike', image_url: '/image6.png', to: '/app/explore/guide?c=golf-outdoor' },
  { key: 'family-kids', label: 'Family & Kids', tone: 'pink', icon: 'Users', image_url: '/cover.png', to: '/app/explore/guide?c=family-kids' },
  { key: 'wellness-spa', label: 'Wellness & Spa', tone: 'olive', icon: 'Leaf', image_url: '/image5.png', to: '/app/explore/guide?c=wellness-spa' },
  { key: 'weddings-photography', label: 'Weddings & Photography', tone: 'peach', icon: 'Camera', image_url: '/image2.png', to: '/app/explore/guide?c=weddings-photography' },
  { key: 'shopping', label: 'Shopping', tone: 'lime', icon: 'ShoppingBag', image_url: '/homecover.png', to: '/app/explore/guide?c=shopping' },
  { key: 'arts-culture', label: 'Arts & Culture', tone: 'violet', icon: 'Palette', image_url: '/image12.png', to: '/app/explore/guide?c=arts-culture' },
  { key: 'local-essentials', label: 'Local Essentials', tone: 'slate', icon: 'Briefcase', image_url: '/image7.png', to: '/app/explore/guide?c=local-essentials' },
  { key: 'info', label: 'Public Information', tone: 'teal', icon: 'Info', image_url: '/homecover.png', to: '/app/explore/info' },
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

export function CategoryTile({ category }) {
  const Icon = iconFor(category.icon)
  return (
    <Link
      to={category.to}
      className={`app-exp-tile is-${category.tone}`}
      style={{ backgroundImage: `url('${category.image_url}')` }}
      state={{ label: category.label }}
    >
      {category.coming_soon ? <span className="app-exp-tile-soon">Coming Soon</span> : null}
      <span className="app-exp-tile-ico" aria-hidden="true">
        <Icon size={18} strokeWidth={1.5} />
      </span>
      <span className="app-exp-tile-text">
        <strong>{category.label}</strong>
        {!category.coming_soon && category.count ? <small>{category.count} places</small> : null}
      </span>
    </Link>
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
