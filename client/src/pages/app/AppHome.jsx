import { Link } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Clock,
  MapPin,
  Mountain,
  Star,
  Umbrella,
  UtensilsCrossed,
} from 'lucide-react'
import BottomNav from './BottomNav.jsx'

const ORDERS = [
  {
    key: 'grocery',
    tone: 'grocery',
    icon: '🛍️',
    kind: 'Grocery Orders',
    status: 'Shopping at Publix',
    meta: 'Estimated delivery today, 4:00 - 5:00 PM',
    to: '/app/grocery/track',
  },
  {
    key: 'transfer',
    tone: 'transfer',
    icon: '✈️',
    kind: 'Airport Transfer',
    status: 'Confirmed',
    meta: 'Oct 18, 3:30 PM · ECP Airport',
    to: '/app/transfer/track',
  },
]

const EXPLORE = [
  { key: 'beaches', label: 'Beaches', tone: 'sea', Icon: Umbrella, to: '/app/explore/guide?c=beaches' },
  { key: 'restaurants', label: 'Restaurants', tone: 'sand', Icon: UtensilsCrossed, to: '/app/explore/guide?c=restaurants' },
  { key: 'activities', label: 'Activities', tone: 'leaf', Icon: Mountain, to: '/app/explore/guide?c=all' },
  { key: 'beaches-2', label: 'Beaches', tone: 'sea', Icon: Umbrella, to: '/app/explore/guide?c=beaches' },
]

const PICKS = [
  { key: 'p1', image: '/1.png', title: 'Perfect Sunset Spot Tonight', place: 'Inlet Beach', to: '/app/explore/beach/rosemary' },
  { key: 'p2', image: '/2.png', title: 'Dinner Near Rosemary Beach', place: 'Inlet Beach', to: '/app/explore/restaurant/pescado' },
  { key: 'p3', image: '/3.png', title: 'Perfect Sunset Spot Tonight', place: 'Inlet Beach', to: '/app/explore/beach/rosemary' },
]

function Rating() {
  return (
    <div className="app-home-rating">
      <span className="app-home-stars" aria-label="5 out of 5 stars">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={8} strokeWidth={0} fill="currentColor" aria-hidden="true" />
        ))}
      </span>
      <span className="app-home-rating-num">
        <b>5.0</b> <small>(258)</small>
      </span>
    </div>
  )
}

function OrderCard({ order }) {
  return (
    <Link to={order.to} className={`app-home-order app-home-order-${order.tone}`}>
      <div className="app-home-order-head">
        <div className="app-home-order-main">
          <span className="app-home-order-icon" aria-hidden="true">
            {order.icon}
          </span>
          <span className="app-home-order-text">
            <small>{order.kind}</small>
            <strong>{order.status}</strong>
          </span>
        </div>
        <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="app-home-order-meta">
        <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
        <span>{order.meta}</span>
      </div>
    </Link>
  )
}

export default function AppHome() {
  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home">
          <div className="app-home-scroll">
            <header className="app-home-hero">
              <div className="app-home-hero-top">
                <img
                  className="app-home-logo"
                  src="/home logo.png"
                  alt="M30A"
                  width={78}
                  height={40}
                />
                <button type="button" className="app-home-bell" aria-label="Notifications">
                  <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span className="app-home-bell-dot" aria-hidden="true" />
                </button>
              </div>

              <div className="app-home-greet">
                <div className="app-home-greet-copy">
                  <h1 className="app-home-title">
                    Good Morning, <span>Alex</span>
                  </h1>
                  <p className="app-home-sub">Your 30A stay, handled!</p>
                </div>
                <div className="app-home-chip">
                  <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Rosemary Beach, FL</span>
                </div>
              </div>
            </header>

            <main className="app-home-body">
              <section className="app-home-section">
                <h2 className="app-home-h2">Your Active Orders</h2>
                <div className="app-home-orders">
                  {ORDERS.map((o) => (
                    <OrderCard key={o.key} order={o} />
                  ))}
                </div>
              </section>

              <Link to="/app/vitoria" className="app-home-vitoria" aria-label="Ask Vitoria">
                <img src="/victoria.png" alt="" width={400} height={132} />
              </Link>

              <section className="app-home-section">
                <div className="app-home-section-head">
                  <h2 className="app-home-h2">Explore 30A</h2>
                  <Link to="/app/explore" className="app-home-seeall">
                    See all
                  </Link>
                </div>
                <div className="app-home-explore">
                  {EXPLORE.map(({ key, label, tone, Icon, to }) => (
                    <Link key={key} to={to} className="app-home-explore-chip">
                      <span className={`app-home-explore-icon app-home-explore-icon-${tone}`}>
                        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="app-home-section">
                <div className="app-home-section-head">
                  <h2 className="app-home-h2">Vitoria’s Pick Tonight</h2>
                  <Link to="/app/explore/guide" className="app-home-seeall">
                    See all
                  </Link>
                </div>
                <div className="app-home-picks">
                  {PICKS.map((p) => (
                    <Link key={p.key} to={p.to} className="app-home-pick">
                      <img
                        className="app-home-pick-img"
                        src={p.image}
                        alt=""
                        width={100}
                        height={80}
                      />
                      <span className="app-home-pick-body">
                        <strong className="app-home-pick-title">{p.title}</strong>
                        <span className="app-home-pick-foot">
                          <span className="app-home-pick-place">
                            <MapPin size={12} strokeWidth={1.5} aria-hidden="true" />
                            <span>{p.place}</span>
                          </span>
                          <Rating />
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            </main>
          </div>

          <BottomNav active="home" />
        </div>
      </div>
    </div>
  )
}
