import { Phone, Play } from 'lucide-react'
import Spinner from './Spinner.jsx'
import {
  formatDuration,
  formatPhone,
  formatTime,
  paymentLabel,
  telHref,
  transferRoute,
  usd,
} from '../lib/format.js'

function statusPill(trip) {
  if (trip.status === 'started') {
    return { className: 'pill live', label: `Started ${formatTime(trip.started_at)}` }
  }
  if (trip.status === 'completed') {
    const duration = formatDuration(trip.started_at, trip.completed_at)
    return { className: 'pill done', label: duration ? `Completed · ${duration}` : 'Completed' }
  }
  return { className: 'pill', label: 'Assigned' }
}

function moneyBlock(trip) {
  const tripPay = usd(trip.driver_payout)
  const tip = Number(trip.tip_amount || 0)
  if (trip.status === 'completed') {
    return (
      <div className="money">
        <div>
          <div className="l">Trip earnings</div>
          <div className="v">{tripPay}</div>
        </div>
        <div className="tip">
          <div className="l">Tip received</div>
          <div className="v">{usd(tip)}</div>
        </div>
        <div>
          <div className="l">Total</div>
          <div className="v">{usd(trip.total)}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="money">
      <div>
        <div className="l">Trip earnings</div>
        <div className="v">{tripPay}</div>
      </div>
      <div className="tip">
        <div className="l">Tip</div>
        <div className="v">{tip > 0 ? usd(tip) : '—'}</div>
      </div>
    </div>
  )
}

function completedFooter(trip) {
  if (trip.payment_method === 'cash') {
    const keep = usd(trip.total)
    if (trip.cash_reported != null && trip.cash_reported !== '') {
      return `Cash · you collected ${usd(trip.cash_reported)} · you keep ${keep}`
    }
    return `Cash · you keep ${keep}`
  }
  if (trip.payment_method) return paymentLabel(trip.payment_method)
  return null
}

export default function TripCard({ trip, pending, onStart, onComplete, style }) {
  const pill = statusPill(trip)
  const phone = telHref(trip.guest_phone)
  const done = trip.status === 'completed'
  const footer = done ? completedFooter(trip) : null
  const extras = [
    trip.passengers ? `${trip.passengers} passenger${trip.passengers === 1 ? '' : 's'}` : null,
    trip.bags != null && trip.bags !== ''
      ? `${trip.bags} bag${Number(trip.bags) === 1 ? '' : 's'}`
      : null,
    trip.flight_number ? `Flight ${trip.flight_number}` : null,
    trip.vehicle_label || null,
  ].filter(Boolean)

  return (
    <article className={`trip${done ? ' trip-done' : ''}`} style={style}>
      <div className="hd">
        <div>
          <span className="time">{formatTime(trip.scheduled_at)}</span>{' '}
          <span className="num">· Trip #{trip.trip_number}</span>
        </div>
        <span className={pill.className}>{pill.label}</span>
      </div>
      <div className="route">{transferRoute(trip)}</div>
      {extras.length ? (
        <div className="meta">
          {extras[0] ? <b>{extras[0]}</b> : null}
          {extras.length > 1 ? ` · ${extras.slice(1).join(' · ')}` : ''}
        </div>
      ) : null}
      {trip.guest_name || phone ? (
        <div className="guest">
          <span>{trip.guest_name || 'Guest'}</span>
          {phone ? (
            <a href={phone} className="guest-call">
              <Phone size={14} strokeWidth={2} />
              <span className="call-label">Call </span>
              {formatPhone(trip.guest_phone)}
            </a>
          ) : null}
        </div>
      ) : null}
      {(trip.pickup_address || trip.dropoff_address) && trip.status !== 'completed' ? (
        <div className="meta">
          {trip.pickup_address ? (
            <>
              Pickup: {trip.pickup_address}
              {trip.dropoff_address ? <br /> : null}
            </>
          ) : null}
          {trip.dropoff_address ? `Drop-off: ${trip.dropoff_address}` : null}
        </div>
      ) : null}
      {moneyBlock(trip)}
      {footer ? <div className="meta">{footer}</div> : null}
      {trip.status === 'assigned' ? (
        <button type="button" className="btn ghost" disabled={pending} onClick={() => onStart?.(trip)}>
          {pending ? (
            <>
              <Spinner size={16} /> Starting…
            </>
          ) : (
            <>
              <Play size={16} /> Start trip
            </>
          )}
        </button>
      ) : null}
      {trip.status === 'started' ? (
        <button type="button" className="btn" disabled={pending} onClick={() => onComplete?.(trip)}>
          {pending ? (
            <>
              <Spinner size={16} /> Saving…
            </>
          ) : (
            'Complete trip'
          )}
        </button>
      ) : null}
    </article>
  )
}

export function TripCardSkeleton() {
  return (
    <article className="trip trip-skel">
      <span className="shimmer shimmer-sm" />
      <span className="shimmer shimmer-lg" />
      <span className="shimmer" />
      <span className="shimmer shimmer-lg" />
    </article>
  )
}
