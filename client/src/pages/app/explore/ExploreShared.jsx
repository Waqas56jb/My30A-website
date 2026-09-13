import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
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

export const CATEGORIES = [
  { key: 'restaurants', label: 'Restaurants', tone: 'sand', Icon: UtensilsCrossed, to: '/app/explore/guide?c=restaurants' },
  { key: 'beaches', label: 'Beaches', tone: 'sea', Icon: Umbrella, to: '/app/explore/guide?c=beaches' },
  { key: 'activities', label: 'Activities', tone: 'leaf', Icon: Mountain, to: '/app/explore/guide?c=all' },
  { key: 'wellness', label: 'Wellness', tone: 'olive', Icon: Leaf, to: '/app/explore/guide?c=all' },
  { key: 'shopping', label: 'Shopping', tone: 'pink', Icon: ShoppingBag, to: '/app/explore/guide?c=shopping' },
  { key: 'family', label: 'Family & Kids', tone: 'cyan', Icon: Users, to: '/app/explore/guide?c=family' },
  { key: 'essentials', label: 'Local Essentials', tone: 'lime', Icon: Paintbrush, to: '/app/explore/guide?c=all' },
  { key: 'info', label: 'Public Information', tone: 'peach', Icon: Info, to: '/app/explore/info' },
]

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'beaches', label: 'Beaches' },
  { key: 'bikes', label: 'Bikes' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'family', label: 'Family & Kids' },
]

export const GUIDE = [
  { key: 'golf', title: 'Golf Cart Rentals', image: '/image11.png', from: 'From $120/day', vendors: '3 vendors', cats: ['all', 'family'], to: '/app/explore/vendors/golf-cart-rentals' },
  { key: 'water', title: 'On The Water', image: '/image3.png', from: 'From $400/day', vendors: '3 vendors', cats: ['all', 'family'], to: '/app/explore/vendors/on-the-water' },
  { key: 'photo', title: 'Photography', image: '/image12.png', from: 'From $120/day', vendors: '3 vendors', cats: ['all'], to: '/app/explore/vendors/photography' },
  { key: 'bonfire', title: 'Beach Bonfire', image: '/image6.png', from: 'From $120/day', vendors: '3 vendors', cats: ['all', 'beaches', 'family'], to: '/app/explore/vendors/beach-bonfires' },
  { key: 'bikes', title: 'Bike Rentals', image: '/image1.png', from: 'From $35/day', vendors: '3 vendors', cats: ['all', 'bikes'], to: '/app/explore/vendors/bike-rentals' },
  { key: 'spa', title: 'Wellness & Spa', image: '/image7.png', from: 'From $120/day', vendors: '3 vendors', cats: ['all'], to: '/app/explore/vendors/wellness-spa' },
  { key: 'pescado', title: 'Pescado Rooftop Bar', image: '/image10.png', from: 'Seafood · Rooftop', vendors: 'Rosemary Beach', cats: ['restaurants'], to: '/app/explore/restaurant/pescado' },
  { key: 'dinner', title: 'Dinner Near Rosemary Beach', image: '/2.png', from: 'Coastal dining', vendors: 'Inlet Beach', cats: ['restaurants'], to: '/app/explore/restaurant/pescado' },
  { key: 'rb-access', title: 'Rosemary Beach Access', image: '/image1.png', from: 'Public access', vendors: 'Rosemary Beach', cats: ['beaches'], to: '/app/explore/beach/rosemary' },
  { key: 'inlet', title: 'Inlet Beach', image: '/cover.png', from: 'Public access', vendors: 'Inlet Beach', cats: ['beaches'], to: '/app/explore/beach/rosemary' },
  { key: 'boutiques', title: 'Boutiques & Markets', image: '/image2.png', from: 'Open daily', vendors: '6 shops', cats: ['shopping'], to: '/app/explore/vendors/shopping' },
  { key: 'kids', title: 'Family Activities', image: '/homecover.png', from: 'From $25', vendors: '4 vendors', cats: ['family'], to: '/app/explore/vendors/family' },
]

export const VENDOR_LISTS = {
  'beach-bonfires': 'Beach Bonfires',
  'golf-cart-rentals': 'Golf Cart Rentals',
  'on-the-water': 'On The Water',
  photography: 'Photography',
  'bike-rentals': 'Bike Rentals',
  'wellness-spa': 'Wellness & Spa',
  shopping: 'Shopping',
  family: 'Family Activities',
}

export const VENDORS = [
  { id: 'bonfire-co', name: '30A Bonfire Co.', place: 'Rosemary Beach, FL', rating: '5.0', reviews: '258', desc: 'Private Beach Bonfire Setups For Families And Groups.', from: 120, image: '/image6.png' },
  { id: 'emerald-fire', name: 'Emerald Coast Bonfires', place: 'Seaside, FL', rating: '4.9', reviews: '142', desc: 'Sunset Bonfires With Chairs, Blankets And S’mores Kits.', from: 150, image: '/image12.png' },
  { id: 'seaside-fire', name: 'Seaside Fire & S’mores', place: 'Alys Beach, FL', rating: '5.0', reviews: '96', desc: 'Full-Service Bonfire Experiences Right On The Sand.', from: 120, image: '/image5.png' },
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
  return (
    <span className={`app-exp-pill${white ? ' is-white' : ''}`}>
      <Star size={14} strokeWidth={0} fill="#f5b50a" className="app-exp-star" aria-hidden="true" />
      <b>{rating}</b> ({reviews})
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

export function TitleRow({ title }) {
  return (
    <div className="app-exp-title-row">
      <h1>{title}</h1>
      <button type="button" className="app-exp-heart" aria-label="Save">
        <Heart size={30} strokeWidth={1.5} aria-hidden="true" />
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
  return (
    <div className="app-exp-actions">
      <a href={primary.href || '#book'} className="app-exp-btn is-primary">
        <primary.Icon size={20} strokeWidth={1.5} aria-hidden="true" />
        {primary.label}
      </a>
      <a href={secondary.href || '#website'} className="app-exp-btn is-ghost">
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
