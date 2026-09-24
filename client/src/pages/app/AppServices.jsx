import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, CreditCard, Plane, ShieldCheck, ShoppingBag } from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import NotificationBell from '../../components/NotificationBell.jsx'

const SERVICES = [
  {
    key: 'grocery',
    Icon: ShoppingBag,
    image: '/services/grocery-delivery.webp',
    tag: 'Pre-arrival stocking',
    title: 'Grocery Delivery',
    desc: 'Your rental stocked from Publix before you arrive — pay only once it’s delivered.',
    fromLabel: 'Service from',
    price: '$229',
    priceNote: '+ Publix total',
    cta: 'Order Now',
    to: '/app/grocery',
  },
  {
    key: 'transfer',
    Icon: Plane,
    image: '/image8.png',
    tag: 'ECP · VPS · PNS',
    title: 'Airport Transfer',
    desc: 'Private, vetted drivers between the airport and your 30A door.',
    fromLabel: 'Rides from',
    price: '$85',
    priceNote: 'per trip',
    cta: 'Book Transfer',
    to: '/app/transfer',
  },
]

const PERKS = [
  { Icon: ShieldCheck, label: 'Trusted locals' },
  { Icon: Clock, label: 'Live tracking' },
  { Icon: CreditCard, label: 'Secure payments' },
]

function ServiceCard({ s, index }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <Link
      to={s.to}
      className={`app-service app-service-${s.key} app-press app-rise`}
      style={{ '--i': index + 1 }}
    >
      <span className="app-service-media app-fade-bg">
        <img
          src={s.image}
          alt=""
          width={400}
          height={170}
          decoding="async"
          className={`app-fade-img${loaded ? ' is-loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        <span className="app-service-icon" aria-hidden="true">
          <s.Icon size={20} strokeWidth={1.8} />
        </span>
        <span className="app-service-tag">{s.tag}</span>
      </span>
      <span className="app-service-body">
        <span className="app-service-text">
          <strong className="app-service-title">{s.title}</strong>
          <span className="app-service-desc">{s.desc}</span>
        </span>
        <span className="app-service-foot">
          <span className="app-service-price">
            <small>{s.fromLabel}</small>
            <span>
              <b>{s.price}</b> <em>{s.priceNote}</em>
            </span>
          </span>
          <span className="app-service-cta">
            <span>{s.cta}</span>
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        </span>
      </span>
    </Link>
  )
}

export default function AppServices() {
  const navigate = useNavigate()

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home app-services">
          <div className="app-home-scroll">
            <header className="app-services-top app-enter">
              <button
                type="button"
                className="app-round-btn app-press"
                aria-label="Back"
                onClick={() => navigate('/app/home')}
              >
                <ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <h1 className="app-services-title">Services</h1>
              <NotificationBell className="app-round-btn app-press" />
            </header>

            <main className="app-services-body">
              <div className="app-services-intro app-enter" style={{ animationDelay: '60ms' }}>
                <span className="app-eyebrow">Concierge services</span>
                <h2 className="app-services-h2">What can I help you with?</h2>
                <p>Book trusted local help for your stay in a few taps.</p>
              </div>
              <div className="app-services-cards">
                {SERVICES.map((s, i) => (
                  <ServiceCard key={s.key} s={s} index={i} />
                ))}
              </div>
              <ul className="app-services-perks app-rise" style={{ '--i': 3 }}>
                {PERKS.map(({ Icon, label }) => (
                  <li key={label}>
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </main>
          </div>

          <BottomNav active="services" />
        </div>
      </div>
    </div>
  )
}
