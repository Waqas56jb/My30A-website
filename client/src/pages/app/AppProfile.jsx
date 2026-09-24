import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Headset,
  History,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Settings,
  User,
  Utensils,
} from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import { errorText, guest, initials, useGuestQuery } from '../../lib/guestApi.js'

const SAVED = [
  { Icon: Utensils, label: 'Saved Places', sub: 'Places you’ve hearted', to: '/app/profile/saved', tone: 'sand' },
  { Icon: MapPin, label: 'Favorite Restaurants', sub: 'Dining around 30A', to: '/app/explore/guide?c=restaurants', tone: 'sea' },
  { Icon: History, label: 'Vitoria Memory', sub: 'What your concierge knows', to: '/app/vitoria', tone: 'violet' },
]

const ACCOUNT = [
  { Icon: User, label: 'Personal Information', sub: 'Name, email and phone', to: '#account', tone: 'sea' },
  { Icon: Bell, label: 'Notifications', sub: 'Alerts and updates', to: '#account', tone: 'sand' },
  { Icon: CreditCard, label: 'Payment Methods', sub: 'Saved cards', to: '#account', tone: 'leaf' },
  { Icon: Settings, label: 'Settings', sub: 'Preferences and privacy', to: '#account', tone: 'slate' },
]

const SUPPORT = [
  { Icon: MessageCircle, label: 'Message Vitoria', sub: 'Your 24/7 AI concierge', to: '/app/vitoria', tone: 'sea' },
  { Icon: Headset, label: 'Contact My30A Host', sub: 'my30ahost@gmail.com', to: 'mailto:my30ahost@gmail.com', tone: 'leaf' },
  { Icon: InstagramIcon, label: 'Follow us on Instagram', sub: '@my30a_host', to: 'https://www.instagram.com/my30a_host/', tone: 'pink', external: true },
]

// lucide has no brand icons in this version — same stroke style, drawn inline.
function InstagramIcon({ size = 18, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  )
}

function Row({ Icon, label, sub, to, tone, badge, external }) {
  const inner = (
    <>
      <span className={`app-pf-row-ico is-${tone}`} aria-hidden="true">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span className="app-pf-row-text">
        <strong>{label}</strong>
        {sub ? <small>{sub}</small> : null}
      </span>
      {badge ? <span className="app-pf-row-badge">{badge}</span> : null}
      <ChevronRight size={18} strokeWidth={2} className="app-pf-row-chev" aria-hidden="true" />
    </>
  )
  return to.startsWith('/') ? (
    <Link to={to} className="app-pf-row">
      {inner}
    </Link>
  ) : (
    <a href={to} className="app-pf-row" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {inner}
    </a>
  )
}

function Group({ title, rows, index, badges = {} }) {
  return (
    <section className="app-pf-section app-rise" style={{ '--i': index }}>
      <h2>{title}</h2>
      <div className="app-pf-card">
        {rows.map((r) => (
          <Row key={r.label} {...r} badge={badges[r.label]} />
        ))}
      </div>
    </section>
  )
}

export default function AppProfile() {
  const navigate = useNavigate()
  const { data, loading, error } = useGuestQuery(guest.me, [])
  const [signingOut, setSigningOut] = useState(false)
  const pending = loading && !data
  const profile = data?.profile
  const name = profile?.name || 'Guest'
  const stats = data?.stats

  const signOut = async () => {
    setSigningOut(true)
    try {
      await guest.signOut()
      // GuestRoute redirects to /app/login once AuthContext's session clears — no manual
      // navigate here, matching ProtectedRoute's pattern for the staff panels.
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home app-pf">
          <div className="app-home-scroll">
            <div className="app-pf-hero">
              <img className="app-pf-hero-img" src="/image2.png" alt="" />
              <div className="app-pf-hero-bar app-enter">
                <button
                  type="button"
                  className="app-round-btn is-glass app-press"
                  aria-label="Back"
                  onClick={() => navigate('/app/home')}
                >
                  <ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <span className="app-pf-hero-title">Profile</span>
                <button type="button" className="app-round-btn is-glass app-press" aria-label="Notifications">
                  <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="app-pf-head app-enter" style={{ animationDelay: '60ms' }}>
              <div className="app-pf-avatar-wrap">
                {pending ? (
                  <span className="app-pf-avatar app-skel app-skel-circle" aria-hidden="true" />
                ) : (
                  <span className="app-pf-avatar" role="img" aria-label={name}>
                    {initials(profile?.name, profile?.email)}
                  </span>
                )}
                <button type="button" className="app-pf-edit app-press" aria-label="Edit photo">
                  <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              {pending ? (
                <div className="app-pf-id" aria-hidden="true">
                  <span className="app-skel app-skel-title" style={{ width: 160, height: 24 }} />
                  <span className="app-skel app-skel-line" style={{ width: 200 }} />
                </div>
              ) : (
                <div className="app-pf-id">
                  <h1 className="app-pf-name">{name}</h1>
                  <p className="app-pf-meta">
                    {profile?.email ? <span className="app-pf-email">{profile.email}</span> : null}
                    {data?.stay_label ? (
                      <span className="app-pf-stay">
                        <span className="app-live-dot" aria-hidden="true" />
                        {data.stay_label}
                      </span>
                    ) : null}
                  </p>
                </div>
              )}
              {error ? <p className="app-inline-error" style={{ textAlign: 'center' }}>{errorText(error)}</p> : null}

              <dl className="app-pf-stats">
                {[
                  ['Saved', stats?.saved_places],
                  ['Transfers', stats?.transfers],
                  ['Groceries', stats?.grocery_orders],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {pending ? (
                        <span className="app-skel app-skel-line app-skel-inline" style={{ width: 26, height: 18 }} />
                      ) : (
                        value ?? 0
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="app-pf-body">
              <Group
                title="Saved & Preferences"
                rows={SAVED}
                index={1}
                badges={stats?.saved_places ? { 'Saved Places': stats.saved_places } : {}}
              />
              <Group title="Account" rows={ACCOUNT} index={2} />
              <Group title="Support" rows={SUPPORT} index={3} />

              <button
                type="button"
                className="app-pf-signout app-press app-rise"
                style={{ '--i': 4 }}
                onClick={signOut}
                disabled={signingOut}
              >
                <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>

          <BottomNav active="profile" />
        </div>
      </div>
    </div>
  )
}
