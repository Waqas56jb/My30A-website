import { Car, CheckCircle2, MapPin, MessageCircle, Navigation, Phone, Play } from 'lucide-react'
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

const ACTIVE = ['assigned', 'started', 'arrived', 'picked_up']

function statusPill(trip) {
  if (trip.status === 'started') return { className: 'pill live', label: `On the way ${formatTime(trip.started_at)}` }
  if (trip.status === 'arrived') return { className: 'pill live', label: `Arrived ${formatTime(trip.arrived_at)}` }
  if (trip.status === 'picked_up') return { className: 'pill live', label: `Guest on board ${formatTime(trip.picked_up_at)}` }
  if (trip.status === 'completed') {
    const duration = formatDuration(trip.started_at, trip.completed_at)
    return { className: 'pill done', label: duration ? `Completed · ${duration}` : 'Completed' }
  }
  if (trip.status === 'no_show') return { className: 'pill', label: 'No-show' }
  if (trip.status === 'cancelled') return { className: 'pill', label: 'Cancelled' }
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

function ActionButton({ pending, busyLabel, icon: Icon, label, onClick, ghost }) {
  return (
    <button type="button" className={`btn${ghost ? ' ghost' : ''}`} disabled={pending} onClick={onClick}>
      {pending ? (
        <>
          <Spinner size={16} /> {busyLabel}
        </>
      ) : (
        <>
          {Icon ? <Icon size={16} /> : null} {label}
        </>
      )}
    </button>
  )
}

// Driver flow: Assigned → On the way → Arrived → Guest in vehicle → Complete trip.
export default function TripCard({ trip, pending, onStart, onArrive, onPickup, onComplete, onMessage, style }) {
  const pill = statusPill(trip)
  const done = trip.status === 'completed'
  const active = ACTIVE.includes(trip.status)
  const footer = done ? completedFooter(trip) : null
  const callHref = trip.guest_call_number ? telHref(trip.guest_call_number) : null
  const extras = [
    trip.passengers ? `${trip.passengers} passenger${trip.passengers === 1 ? '' : 's'}` : null,
    trip.bags != null && trip.bags !== '' ? `${trip.bags} bag${Number(trip.bags) === 1 ? '' : 's'}` : null,
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
      {trip.guest_name || active ? (
        <div className="guest">
          <span>{trip.guest_name || 'Guest'}</span>
          {active ? (
            <span className="guest-actions">
              {/* Guest's real number is never shown — calls are routed through the masked number. */}
              {callHref ? (
                <a href={callHref} className="guest-call" title="Masked call via My30A Host">
                  <Phone size={14} strokeWidth={2} />
                  <span className="call-label">Call </span>
                  {formatPhone(trip.guest_call_number)}
                </a>
              ) : null}
              {onMessage ? (
                <button type="button" className="guest-call" onClick={() => onMessage(trip)}>
                  <MessageCircle size={14} strokeWidth={2} />
                  <span className="call-label">Message</span>
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
      {(trip.pickup_address || trip.dropoff_address) && !done ? (
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
        <ActionButton pending={pending} busyLabel="Updating…" icon={Play} label="On the way" onClick={() => onStart?.(trip)} ghost />
      ) : null}
      {trip.status === 'started' ? (
        <div className="btn-row">
          <ActionButton pending={pending} busyLabel="Updating…" icon={MapPin} label="Arrived" onClick={() => onArrive?.(trip)} />
          <ActionButton pending={pending} busyLabel="Updating…" icon={Car} label="Guest in vehicle" onClick={() => onPickup?.(trip)} ghost />
        </div>
      ) : null}
      {trip.status === 'arrived' ? (
        <ActionButton pending={pending} busyLabel="Updating…" icon={Car} label="Guest in vehicle" onClick={() => onPickup?.(trip)} />
      ) : null}
      {trip.status === 'picked_up' ? (
        <ActionButton pending={pending} busyLabel="Saving…" icon={CheckCircle2} label="Complete trip" onClick={() => onComplete?.(trip)} />
      ) : null}
      {trip.status === 'started' || trip.status === 'arrived' ? (
        <p className="meta hint">
          <Navigation size={12} /> Waiting at pickup? Message the guest with your exact spot.
        </p>
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
