import { Link } from 'react-router-dom'
import { Bell, ChevronRight, Clock, MapPin, Star } from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import { errorText, guest, useGuestQuery } from '../../lib/guestApi.js'
import { iconFor } from './explore/ExploreShared.jsx'

function Rating({ rating, reviews }) {
  return (
    <div className="app-home-rating">
      <span className="app-home-stars" aria-label={`${rating} out of 5 stars`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={8} strokeWidth={0} fill="currentColor" aria-hidden="true" />
        ))}
      </span>
      <span className="app-home-rating-num">
        <b>{Number(rating || 5).toFixed(1)}</b> <small>({reviews ?? 0})</small>
      </span>
    </div>
  )
}

function OrderCard({ order }) {
  return (
    <Link to={order.to} className={`app-home-order app-home-order-${order.kind}`}>
      <div className="app-home-order-head">
        <div className="app-home-order-main">
          <span className="app-home-order-icon" aria-hidden="true">
            {order.kind === 'grocery' ? '🛍️' : '✈️'}
          </span>
          <span className="app-home-order-text">
            <small>{order.title}</small>
            <strong>{order.status_label}</strong>
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
  const { data, loading, error } = useGuestQuery(guest.home, [])
  const firstName = data?.profile?.first_name || ''
  const orders = data?.orders || []
  const explore = (data?.explore || []).slice(0, 4)
  const picks = data?.picks || []

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
                <Link to="/app/profile" className="app-home-bell" aria-label="Notifications">
                  <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                  {data?.unread_count ? <span className="app-home-bell-dot" aria-hidden="true" /> : null}
                </Link>
              </div>

              <div className="app-home-greet">
                <div className="app-home-greet-copy">
                  <h1 className="app-home-title">
                    {data?.greeting || 'Good Morning'}
                    {firstName ? (
                      <>
                        , <span>{firstName}</span>
                      </>
                    ) : null}
                  </h1>
                  <p className="app-home-sub">Your 30A stay, handled!</p>
                </div>
                <Link to="/app/profile" className="app-home-chip">
                  <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>{data?.location_label || '30A, FL'}</span>
                </Link>
              </div>
            </header>

            <main className="app-home-body">
              <section className="app-home-section">
                <h2 className="app-home-h2">Your Active Orders</h2>
                {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
                <div className="app-home-orders">
                  {orders.map((o) => (
                    <OrderCard key={o.key} order={o} />
                  ))}
                  {!loading && !error && orders.length === 0 ? (
                    <Link to="/app/services" className="app-home-order app-home-order-transfer">
                      <div className="app-home-order-head">
                        <div className="app-home-order-main">
                          <span className="app-home-order-icon" aria-hidden="true">
                            ✨
                          </span>
                          <span className="app-home-order-text">
                            <small>No active orders</small>
                            <strong>Book a transfer or order groceries</strong>
                          </span>
                        </div>
                        <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <div className="app-home-order-meta">
                        <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
                        <span>Everything you request shows up here</span>
                      </div>
                    </Link>
                  ) : null}
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
                  {explore.map(({ key, label, tone, icon, to }) => {
                    const Icon = iconFor(icon)
                    return (
                      <Link key={key} to={to} className="app-home-explore-chip">
                        <span className={`app-home-explore-icon app-home-explore-icon-${tone}`}>
                          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                        </span>
                        <span>{label}</span>
                      </Link>
                    )
                  })}
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
                  {picks.map((p) => (
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
                          <Rating rating={p.rating} reviews={p.reviews} />
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
