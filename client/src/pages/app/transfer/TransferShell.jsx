import { Fragment } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Tag } from 'lucide-react'

export const DEFAULT_BOOKING = {
  tripType: 'arrival',
  airport: 'ECP',
  community: 'Rosemary Beach',
  address: '21 N Barrett Square, Rosemary Beach, FL 32461',
  date: 'Oct 18, 2026',
  time: '5:50 PM',
  passengers: 2,
  bags: 3,
  flight: 'WN 0987',
  vehicle: '4 Passenger Vehicle',
}

export const PRICE = { transfer: 85, holiday: 40 }

export const pad = (n) => String(n).padStart(2, '0')

export const tripLabel = (t) => (t === 'departure' ? 'Departure Dropoff' : 'Arrival Pickup')

export function useBooking() {
  const { state } = useLocation()
  return { ...DEFAULT_BOOKING, ...(state?.booking || {}) }
}

export function Stepper({ step }) {
  return (
    <div className="app-xfer-steps" role="img" aria-label={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <Fragment key={i}>
          {i > 1 ? (
            <span className={`app-xfer-step-line${i <= step ? ' is-on' : ''}`} />
          ) : null}
          <span className={`app-xfer-step${i <= step ? ' is-on' : ''}`}>
            <Check size={12} strokeWidth={3} aria-hidden="true" />
          </span>
        </Fragment>
      ))}
    </div>
  )
}

export function TransferShell({
  title,
  back = '/app/home',
  step,
  footer,
  className = '',
  children,
}) {
  const navigate = useNavigate()
  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className={`app-home app-xfer${className ? ` ${className}` : ''}`}>
          <div className="app-xfer-scroll">
            <header className="app-xfer-head">
              <button
                type="button"
                className="app-xfer-back"
                aria-label="Back"
                onClick={() => navigate(back)}
              >
                <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
              {title ? <h1 className="app-xfer-title">{title}</h1> : <span />}
              <span className="app-xfer-spacer" aria-hidden="true" />
            </header>
            <div className="app-xfer-content">
              {step ? <Stepper step={step} /> : null}
              {children}
            </div>
          </div>
          {footer ? <div className="app-xfer-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

export function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="app-xfer-row">
      <span className="app-xfer-row-l">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        {label}
      </span>
      <span className="app-xfer-row-v">{value}</span>
    </div>
  )
}

export function PriceCard() {
  return (
    <section className="app-xfer-card">
      <h2 className="app-xfer-card-h">
        <Tag size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
        Price
      </h2>
      <div className="app-xfer-price">
        <div className="app-xfer-price-row">
          <span>Transfer</span>
          <span>${PRICE.transfer}</span>
        </div>
        <div className="app-xfer-price-row">
          <span>Holiday add-on</span>
          <span>+${PRICE.holiday}</span>
        </div>
        <div className="app-xfer-price-row is-total">
          <span>Total</span>
          <span>${PRICE.transfer + PRICE.holiday}</span>
        </div>
      </div>
    </section>
  )
}

export function Cta({ to, state, onClick, ghost, children, type = 'button' }) {
  const cls = `app-xfer-cta${ghost ? ' is-ghost' : ''}`
  if (to) {
    return (
      <Link to={to} state={state} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={cls} onClick={onClick}>
      {children}
    </button>
  )
}
