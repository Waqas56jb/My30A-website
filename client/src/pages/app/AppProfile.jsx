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

const SAVED = [
  { Icon: Utensils, label: 'Saved Places', to: '#saved' },
  { Icon: MapPin, label: 'Favorite Restaurants', to: '#favorites' },
  { Icon: History, label: 'Vitoria Memory', to: '#memory' },
]

const ACCOUNT = [
  { Icon: User, label: 'Personal Information', sub: 'Manage your profile details' },
  { Icon: Bell, label: 'Notifications', sub: 'Choose what you’d like to hear about' },
  { Icon: CreditCard, label: 'Payment Methods', sub: 'View and manage your payment methods' },
  { Icon: Settings, label: 'Settings', sub: 'App preferences and privacy' },
]

const SUPPORT = [
  { Icon: MessageCircle, label: 'Message Vitoria', to: '/app/vitoria' },
  { Icon: Headset, label: 'Contact My30A Host', to: 'mailto:my30ahost@gmail.com' },
]

function RowLink({ to, children }) {
  const isRoute = to.startsWith('/')
  return isRoute ? (
    <Link to={to} className="app-prof-row">
      {children}
    </Link>
  ) : (
    <a href={to} className="app-prof-row">
      {children}
    </a>
  )
}

export default function AppProfile() {
  const navigate = useNavigate()

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home app-xfer app-exp app-prof">
          <div className="app-home-scroll">
            <div className="app-prof-hero" style={{ backgroundImage: "url('/image2.png')" }}>
              <button
                type="button"
                className="app-exp-hero-back"
                aria-label="Back"
                onClick={() => navigate('/app/home')}
              >
                <ArrowLeft size={24} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button type="button" className="app-home-bell app-prof-bell" aria-label="Notifications">
                <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="app-home-bell-dot" aria-hidden="true" />
              </button>
            </div>

            <div className="app-prof-avatar-wrap">
              <span className="app-prof-avatar" role="img" aria-label="Alex Jessy">
                AJ
              </span>
              <button type="button" className="app-prof-edit" aria-label="Edit photo">
                <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <h1 className="app-prof-name">Alex Jessy</h1>
            <p className="app-prof-meta">
              <span>alexjessi123@gmail.com</span>
              <span className="app-xfer-pill is-green">Upcoming Stay</span>
            </p>

            <div className="app-exp-body app-prof-body">
              <section className="app-prof-section">
                <h2>Saved &amp; Preferences</h2>
                <div className="app-xfer-card app-prof-card">
                  {SAVED.map(({ Icon, label, to }) => (
                    <RowLink key={label} to={to}>
                      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                      <span>{label}</span>
                      <ChevronRight size={20} strokeWidth={1.5} className="is-chev" aria-hidden="true" />
                    </RowLink>
                  ))}
                </div>
              </section>

              <section className="app-prof-section">
                <h2>Account</h2>
                <div className="app-xfer-card app-prof-card">
                  {ACCOUNT.map(({ Icon, label, sub }) => (
                    <a key={label} href="#account" className="app-prof-row">
                      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                      <span>{label}</span>
                      <small>{sub}</small>
                    </a>
                  ))}
                </div>
              </section>

              <section className="app-prof-section">
                <h2>Support</h2>
                <div className="app-xfer-card app-prof-card">
                  {SUPPORT.map(({ Icon, label, to }) => (
                    <RowLink key={label} to={to}>
                      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                      <span>{label}</span>
                      <ChevronRight size={20} strokeWidth={1.5} className="is-chev" aria-hidden="true" />
                    </RowLink>
                  ))}
                </div>
              </section>

              <button
                type="button"
                className="app-exp-btn is-primary app-prof-signout"
                onClick={() => navigate('/app/login')}
              >
                <LogOut size={22} strokeWidth={1.5} aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>

          <BottomNav active="profile" />
        </div>
      </div>
    </div>
  )
}
