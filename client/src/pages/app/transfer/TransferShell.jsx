import { Fragment } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Tag } from 'lucide-react'

export const DEFAULT_BOOKING = {
  tripType: 'arrival',
  airport: 'ECP',
  community: 'Rosemary Beach',
  address: '21 N Barrett Square, Rosemary Beach, FL 32461',
  date: '',
  time: '',
  scheduledAt: '',
  passengers: 2,
  bags: 3,
  flight: '',
  vehicle: '4 Passenger Vehicle',
  vehicleType: '4pax',
  holiday: false,
}

export const PRICE = { transfer: 85, holiday: 40 }

export const VEHICLE_TYPES = {
  '4 Passenger Vehicle': '4pax',
  '6 Passenger Vehicle': '6pax',
  '14 Passenger Vehicle': '14pax',
}

export const pad = (n) => String(n).padStart(2, '0')

export const tripLabel = (t) => (t === 'departure' ? 'Departure Dropoff' : 'Arrival Pickup')

export const usd = (n) => {
  const value = Number(n || 0)
  return `$${value % 1 === 0 ? value : value.toFixed(2)}`
}

export const clock = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

export function useBooking() {
  const { state } = useLocation()
  return { ...DEFAULT_BOOKING, ...(state?.booking || {}) }
}

// Reads the transfer id from router state or the ?id= query (so links from Home work).
export function useTransferId() {
  const { state, search } = useLocation()
  return state?.transfer?.id || new URLSearchParams(search).get('id') || ''
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

// quote: { base_price, addons: [{name, price}], total } from the API (or a transfer row).
export function PriceCard({ quote, loading }) {
  const base = quote?.base_price ?? PRICE.transfer
  const addons = quote?.addons ?? []
  const total = quote?.total ?? base + addons.reduce((s, a) => s + Number(a.price || 0), 0)
  return (
    <section className="app-xfer-card">
      <h2 className="app-xfer-card-h">
        <Tag size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
        Price
      </h2>
      <div className="app-xfer-price">
        <div className="app-xfer-price-row">
          <span>Transfer</span>
          <span>{loading ? '…' : usd(base)}</span>
        </div>
        {addons.map((a) => (
          <div key={a.key || a.name} className="app-xfer-price-row">
            <span>{a.name}</span>
            <span>+{usd(a.price)}</span>
          </div>
        ))}
        {quote?.discount_amount > 0 ? (
          <div className="app-xfer-price-row">
            <span>Round trip −{quote.discount_percent}%</span>
            <span>−{usd(quote.discount_amount)}</span>
          </div>
        ) : null}
        {quote?.credit_applied > 0 ? (
          <div className="app-xfer-price-row">
            <span>Credit applied</span>
            <span>−{usd(quote.credit_applied)}</span>
          </div>
        ) : null}
        <div className="app-xfer-price-row is-total">
          <span>{quote?.round_trip ? 'Per leg' : 'Total'}</span>
          <span>{loading ? '…' : usd(total)}</span>
        </div>
        {quote?.round_trip ? (
          <div className="app-xfer-price-row is-total">
            <span>Both legs</span>
            <span>{usd(quote.round_trip_total)}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function Cta({ to, state, onClick, ghost, disabled, children, type = 'button' }) {
  const cls = `app-xfer-cta${ghost ? ' is-ghost' : ''}`
  if (to) {
    return (
      <Link to={to} state={state} className={cls} aria-disabled={disabled ? 'true' : undefined}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
