import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Clock,
  MapPin,
  Plane,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import { errorText, guest, rememberedName, useGuestQuery } from '../../lib/guestApi.js'
import { iconFor } from './explore/ExploreShared.jsx'

function localGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// Image that fades in once decoded, over a shimmering placeholder.
function FadeImg({ className = '', ...props }) {
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

function SectionHead({ title, to, label = 'See all' }) {
  return (
    <div className="app-home-section-head">
      <h2 className="app-home-h2">{title}</h2>
      {to ? (
        <Link to={to} className="app-home-seeall">
          {label}
          <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

function OrderCard({ order, index }) {
  const grocery = order.kind === 'grocery'
  const Icon = grocery ? ShoppingBag : Plane
  return (
    <Link
      to={order.to}
      className={`app-home-order app-home-order-${order.kind} app-press app-rise`}
      style={{ '--i': index }}
    >
      <span className="app-home-order-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.7} />
      </span>
      <span className="app-home-order-text">
        <small>{order.title}</small>
        <strong>{order.status_label}</strong>
        <span className="app-home-order-meta">
          <Clock size={13} strokeWidth={1.8} aria-hidden="true" />
          <span>{order.meta}</span>
        </span>
      </span>
      <span className="app-home-order-go" aria-hidden="true">
        <ChevronRight size={18} strokeWidth={2} />
      </span>
    </Link>
  )
}

function EmptyOrders() {
  return (
    <div className="app-home-empty app-rise">
      <div className="app-home-empty-top">
        <span className="app-home-empty-ico" aria-hidden="true">
          <Sparkles size={20} strokeWidth={1.7} />
        </span>
        <span className="app-home-order-text">
          <small>No active orders</small>
          <strong>Your requests will appear here</strong>
        </span>
      </div>
      <div className="app-home-empty-actions">
        <Link to="/app/transfer" className="app-home-quick app-press">
          <Plane size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Airport ride</span>
        </Link>
        <Link to="/app/grocery" className="app-home-quick app-press">
          <ShoppingBag size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Groceries</span>
        </Link>
      </div>
    </div>
  )
}

function ExploreTile({ cat, index }) {
  const Icon = iconFor(cat.icon)
  return (
    <Link
      to={cat.to}
      state={{ label: cat.label }}
      className={`app-home-tile is-${cat.tone} app-rise`}
      style={{ '--i': index }}
    >
      <span className="app-home-tile-media app-fade-bg">
        <FadeImg src={cat.image_url} alt="" width={140} height={176} loading="lazy" />
      </span>
      <span className="app-home-tile-ico" aria-hidden="true">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      {cat.coming_soon ? <span className="app-home-tile-soon">Soon</span> : null}
      <span className="app-home-tile-text">
        <strong>{cat.label}</strong>
        <small>{cat.coming_soon ? 'Coming soon' : cat.count ? `${cat.count} places` : 'Explore'}</small>
      </span>
    </Link>
  )
}

function PickCard({ pick, index }) {
  const hasRating = pick.rating !== null && pick.rating !== undefined
  return (
    <Link to={pick.to} className="app-home-pick app-press app-rise" style={{ '--i': index }}>
      <span className="app-home-pick-media app-fade-bg">
        <FadeImg src={pick.image} alt="" width={92} height={92} loading="lazy" />
        {index === 0 ? <span className="app-home-pick-badge">Top pick</span> : null}
      </span>
      <span className="app-home-pick-body">
        <strong className="app-home-pick-title">{pick.title}</strong>
        <span className="app-home-pick-place">
          <MapPin size={12} strokeWidth={1.8} aria-hidden="true" />
          <span>{pick.place}</span>
        </span>
        {hasRating ? (
          <span className="app-home-rating">
            <Star size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" />
            <b>{Number(pick.rating).toFixed(1)}</b>
            <small>({pick.reviews ?? 0} reviews)</small>
          </span>
        ) : (
          <span className="app-home-rating is-plain">Local partner</span>
        )}
      </span>
      <span className="app-home-pick-go" aria-hidden="true">
        <ArrowUpRight size={16} strokeWidth={2} />
      </span>
    </Link>
  )
}

function OrdersSkeleton() {
  return (
    <div className="app-home-order app-home-order-skel" aria-hidden="true">
      <span className="app-skel app-skel-circle" style={{ width: 44, height: 44, flexShrink: 0 }} />
      <span className="app-home-order-text" style={{ flex: 1, gap: 8 }}>
        <span className="app-skel app-skel-line" style={{ width: '38%' }} />
        <span className="app-skel app-skel-title" style={{ width: '78%', height: 16 }} />
        <span className="app-skel app-skel-line" style={{ width: '55%', height: 10 }} />
      </span>
    </div>
  )
}

function ExploreSkeleton() {
  return (
    <div className="app-home-explore" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="app-home-tile is-skel app-skel app-skel-card" />
      ))}
    </div>
  )
}

function PicksSkeleton() {
  return (
    <div className="app-home-picks" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="app-home-pick is-skel">
          <span className="app-skel" style={{ width: 92, height: 92, borderRadius: 14, flexShrink: 0 }} />
          <span className="app-home-pick-body" style={{ gap: 10 }}>
            <span className="app-skel app-skel-title" style={{ width: '80%', height: 16 }} />
            <span className="app-skel app-skel-line" style={{ width: '52%' }} />
            <span className="app-skel app-skel-line" style={{ width: '40%' }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AppHome() {
  const { data, loading, error } = useGuestQuery(guest.home, [])
  const pending = loading && !data
  const firstName = data?.profile?.first_name || (pending ? rememberedName() : '')
  const orders = data?.orders || []
  const explore = (data?.explore || []).slice(0, 8)
  const picks = data?.picks || []

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home">
          <div className="app-home-scroll">
            <header className="app-home-hero">
              <div className="app-home-hero-top app-enter">
                <img className="app-home-logo" src="/home logo.png" alt="M30A" width={78} height={40} />
                <Link to="/app/profile" className="app-home-bell app-press" aria-label="Notifications">
                  <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                  {data?.unread_count ? <span className="app-home-bell-dot" aria-hidden="true" /> : null}
                </Link>
              </div>

              <div className="app-home-greet app-enter" style={{ animationDelay: '60ms' }}>
                <div className="app-home-greet-copy">
                  <h1 className="app-home-title">
                    {data?.greeting || localGreeting()}
                    {firstName ? (
                      <>
                        , <span>{firstName}</span>
                      </>
                    ) : pending ? (
                      <span
                        className="app-skel app-skel-inline app-skel-on-photo"
                        style={{ width: 88, height: 26, marginLeft: 8, borderRadius: 8 }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </h1>
                  <p className="app-home-sub">Your 30A stay, handled!</p>
                </div>
                <Link to="/app/profile" className="app-home-chip app-press">
                  <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
                  {pending ? (
                    <span className="app-skel app-skel-line" style={{ width: 110 }} aria-hidden="true" />
                  ) : (
                    <span>{data?.location_label || '30A, FL'}</span>
                  )}
                </Link>
              </div>
            </header>

            <main className="app-home-body">
              <section className="app-home-section app-enter" style={{ animationDelay: '90ms' }}>
                <SectionHead title="Your Active Orders" />
                {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
                <div className="app-home-orders" aria-busy={pending}>
                  {pending ? <OrdersSkeleton /> : null}
                  {orders.map((o, i) => (
                    <OrderCard key={o.key} order={o} index={i} />
                  ))}
                  {!pending && !error && orders.length === 0 ? <EmptyOrders /> : null}
                </div>
              </section>

              <Link
                to="/app/vitoria"
                className="app-home-vitoria app-press app-enter"
                style={{ animationDelay: '140ms' }}
                aria-label="Ask Vitoria"
              >
                <img src="/victoria.png" alt="" width={400} height={132} />
              </Link>

              <section className="app-home-section app-enter" style={{ animationDelay: '180ms' }}>
                <SectionHead title="Explore 30A" to="/app/explore" />
                {pending ? (
                  <ExploreSkeleton />
                ) : (
                  <div className="app-home-explore">
                    {explore.map((cat, i) => (
                      <ExploreTile key={cat.key} cat={cat} index={i} />
                    ))}
                    {explore.length ? (
                      <Link to="/app/explore" className="app-home-tile is-more app-rise" style={{ '--i': explore.length }}>
                        <span className="app-home-more-ico" aria-hidden="true">
                          <ArrowRight size={20} strokeWidth={1.8} />
                        </span>
                        <span className="app-home-tile-text">
                          <strong>View all</strong>
                          <small>Every category</small>
                        </span>
                      </Link>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="app-home-section app-enter" style={{ animationDelay: '220ms' }}>
                <SectionHead title="Vitoria’s Pick Tonight" to="/app/explore/guide" />
                {pending ? (
                  <PicksSkeleton />
                ) : (
                  <div className="app-home-picks">
                    {picks.map((p, i) => (
                      <PickCard key={p.key} pick={p} index={i} />
                    ))}
                    {!error && picks.length === 0 ? (
                      <p className="app-inline-muted">Vitoria is lining up tonight’s picks — check back soon.</p>
                    ) : null}
                  </div>
                )}
              </section>
            </main>
          </div>

          <BottomNav active="home" />
        </div>
      </div>
    </div>
  )
}
