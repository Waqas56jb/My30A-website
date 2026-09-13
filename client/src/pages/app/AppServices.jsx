import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell } from 'lucide-react'
import BottomNav from './BottomNav.jsx'

const SERVICES = [
  {
    key: 'grocery',
    tone: 'grocery',
    icon: '🛍️',
    title: 'Grocery Delivery',
    desc: 'Pre-arrival stocking & delivery from Publix',
    from: '$229 + Publix',
    cta: 'Order Now',
    to: '/app/grocery',
  },
  {
    key: 'transfer',
    tone: 'transfer',
    icon: '✈️',
    title: 'Airport Transfer',
    desc: 'Private rides to ECP, VPS or PNS airports',
    from: '$85',
    cta: 'Book Transfer',
    to: '/app/transfer',
  },
]

export default function AppServices() {
  const navigate = useNavigate()

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home app-services">
          <div className="app-home-scroll">
            <header className="app-services-top">
              <button
                type="button"
                className="app-services-back"
                aria-label="Back"
                onClick={() => navigate('/app/home')}
              >
                <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <h1 className="app-services-title">Services</h1>
              <button type="button" className="app-home-bell" aria-label="Notifications">
                <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="app-home-bell-dot" aria-hidden="true" />
              </button>
            </header>

            <main className="app-services-body">
              <h2 className="app-home-h2">What Can I Help You With?</h2>
              <div className="app-services-cards">
                {SERVICES.map((s) => (
                  <article key={s.key} className={`app-service app-service-${s.tone}`}>
                    <div className="app-service-info">
                      <span className="app-service-icon" aria-hidden="true">
                        {s.icon}
                      </span>
                      <div className="app-service-text">
                        <h3>{s.title}</h3>
                        <p>{s.desc}</p>
                      </div>
                    </div>
                    <p className="app-service-price">
                      From <b>{s.from}</b>
                    </p>
                    <button
                      type="button"
                      className="app-service-cta"
                      onClick={() => s.to && navigate(s.to)}
                    >
                      <span>{s.cta}</span>
                      <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            </main>
          </div>

          <BottomNav active="services" />
        </div>
      </div>
    </div>
  )
}
