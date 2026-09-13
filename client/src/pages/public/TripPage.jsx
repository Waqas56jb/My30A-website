import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Car, Check, CheckCircle2, MapPin, Phone } from 'lucide-react'
import { errorText, pub } from '../../lib/guestApi.js'
import { clock } from '../app/transfer/TransferShell.jsx'
import { TripChatBox } from '../app/transfer/TransferTrack.jsx'
import PublicShell from './PublicShell.jsx'

const ORDER = ['requested', 'assigned', 'started', 'arrived', 'picked_up', 'completed']

function steps(trip, log) {
  const at = (status) => {
    const rows = (log || []).filter((r) => r.status === status)
    return rows.length ? clock(rows[rows.length - 1].created_at) : null
  }
  const driver = trip.driver?.first_name || 'Your driver'
  const defs = [
    ['assigned', 'Confirmed', trip.driver ? `${driver} · ${trip.vehicle_label || 'private transfer'}` : 'Your transfer is confirmed.'],
    ['started', 'Driver on the way', `${driver} is heading to the pickup.`],
    ['arrived', 'Driver arrived', 'Waiting at the pickup area — message to meet up.'],
    ['picked_up', 'Guest picked up', 'You’re on your way. Enjoy the ride!'],
    ['completed', 'Completed', 'Thanks for riding with My30A Host.'],
  ]
  const idx = ORDER.indexOf(trip.status)
  return defs.map(([key, title, desc]) => {
    const i = ORDER.indexOf(key)
    let state = 'pending'
    if (idx >= 0 && (i < idx || trip.status === 'completed')) state = 'done'
    else if (i === idx) state = 'live'
    return { key, title, desc, state, time: state === 'pending' ? 'Pending' : at(key) || '—' }
  })
}

// my30ahost.com/trip/<token> — opened from the confirmation SMS; no account needed.
export default function TripPage() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  // Stable loader so the chat box's polling effect doesn't restart on every parent render.
  const loadChat = useCallback(() => pub.trip(token), [token])
  const sendChat = useCallback((body) => pub.sendMessage(token, body), [token])

  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        const next = await pub.trip(token)
        if (!ignore) setData(next)
      } catch (err) {
        if (!ignore) setError(err?.status === 404 ? 'This link is not valid.' : errorText(err))
      }
    }
    load()
    const timer = setInterval(load, 15000)
    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [token])

  if (error) {
    return (
      <PublicShell title="My30A Host">
        <p className="app-empty">{error}</p>
      </PublicShell>
    )
  }
  if (!data) {
    return (
      <PublicShell title="Your transfer">
        <p className="app-empty">Loading…</p>
      </PublicShell>
    )
  }

  const { trip } = data
  const from = trip.trip_type === 'departure' ? trip.community : trip.airport
  const to = trip.trip_type === 'departure' ? trip.airport : trip.community
  const paid = params.get('paid') === '1'

  return (
    <PublicShell
      title={`Trip #${trip.trip_number}`}
      sub={`${trip.date_label} · ${trip.time_label}`}
      footer={
        data.tip_url ? (
          <a className="app-xfer-cta" href={data.tip_url}>
            Leave a tip for {trip.driver?.first_name || 'your driver'}
          </a>
        ) : null
      }
    >
      <div className="app-xfer-stack">
        {paid ? (
          <div className="app-xfer-note is-info">
            <CheckCircle2 size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>Payment received — thank you!</span>
          </div>
        ) : null}

        <section className="app-xfer-ride">
          <div className="app-xfer-ride-body">
            <span className={`app-xfer-pill ${trip.ended ? 'is-green' : 'is-live'}`}>
              {trip.ended ? trip.status_label : <><i /> {trip.status_label}</>}
            </span>
            <h2 className="app-xfer-route">
              {from} <ArrowRight size={20} strokeWidth={2} aria-hidden="true" /> {to}
            </h2>
            <p className="app-xfer-ride-when">
              {trip.passengers} passengers · {trip.bags} bags{trip.flight_number ? ` · ${trip.flight_number}` : ''}
            </p>
            <strong className="app-xfer-ride-kind">Private Transfer · ${trip.total}</strong>
          </div>
        </section>

        <ol className="app-xfer-tl">
          {steps(trip, data.status_log).map((s) => (
            <li key={s.key} className={`app-xfer-tl-item is-${s.state}`}>
              <span className="app-xfer-tl-mark" aria-hidden="true">
                {s.state === 'done' ? <Check size={14} strokeWidth={3} /> : null}
                {s.state === 'live' ? <Car size={16} strokeWidth={1.5} /> : null}
              </span>
              <div className="app-xfer-tl-body">
                <div className="app-xfer-tl-head">
                  <h3>{s.title}</h3>
                  {s.key === 'started' ? <MapPin size={18} strokeWidth={1.5} aria-hidden="true" /> : null}
                </div>
                <span className="app-xfer-tl-time">{s.time}</span>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        {trip.driver ? (
          <section className="app-xfer-card is-tight">
            <div className="app-xfer-kv">
              <span className="app-xfer-icobox">
                <Car size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="app-xfer-kv-text">
                <small>Driver</small>
                <strong>{trip.driver.first_name}</strong>
              </span>
              {trip.call_number ? (
                <a href={`tel:${trip.call_number}`} className="app-xfer-action" aria-label="Call your driver">
                  <Phone size={18} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
                </a>
              ) : null}
            </div>
            <div className="app-xfer-kv-foot">
              <span>{trip.vehicle_label || 'Private transfer'}</span>
              {trip.call_number ? <span className="app-xfer-rating">Calls are routed through My30A Host</span> : null}
            </div>
          </section>
        ) : null}

        <TripChatBox open={data.chat_open} load={loadChat} send={sendChat} />

        <p className="app-xfer-warn">
          Questions? Email my30ahost@gmail.com · Your driver never sees your phone number, and you never see theirs.
        </p>
      </div>
    </PublicShell>
  )
}
