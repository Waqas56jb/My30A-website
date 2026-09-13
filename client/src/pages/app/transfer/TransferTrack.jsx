import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Car,
  Check,
  ChevronRight,
  Info,
  Luggage,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Star,
  TreePalm,
  Users,
} from 'lucide-react'
import { Cta, TransferShell, useBooking } from './TransferShell.jsx'

const STEPS = [
  {
    key: 'confirmed',
    state: 'done',
    title: 'Confirmed',
    time: '10:04 AM',
    desc: 'Your transfer has been confirmed.',
  },
  {
    key: 'driver',
    state: 'done',
    title: 'Driver on the way',
    time: '2:45 PM',
    desc: 'Michael is on the way to the airport.',
    pin: true,
  },
  {
    key: 'picked',
    state: 'live',
    title: 'Guest picked up',
    time: '3:28 PM',
    desc: 'Your flight has been picked up. Enjoy your ride',
  },
  {
    key: 'completed',
    state: 'pending',
    title: 'Completed',
    time: 'Pending',
    desc: 'We’ll mark your transfer as completed once you arrive.',
  },
]

export default function TransferTrack() {
  const booking = useBooking()
  const from = booking.tripType === 'departure' ? booking.community : booking.airport
  const to = booking.tripType === 'departure' ? booking.airport : booking.community
  const shortDate = booking.date.replace(/,\s*\d{4}$/, '')

  return (
    <TransferShell
      title="Track Your Ride"
      back="/app/home"
      footer={<Cta to="/app/home">Back to Home</Cta>}
    >
      <div className="app-xfer-stack">
        <section className="app-xfer-ride">
          <div className="app-xfer-ride-body">
            <span className="app-xfer-pill is-live">
              <i /> Live Updates
            </span>
            <h2 className="app-xfer-route">
              {from} <ArrowRight size={20} strokeWidth={2} aria-hidden="true" /> {to}
            </h2>
            <p className="app-xfer-ride-when">
              {shortDate} {booking.time}
            </p>
            <p className="app-xfer-ride-meta">
              <span>
                <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Passengers
              </span>
              <span>
                <Luggage size={16} strokeWidth={1.5} aria-hidden="true" /> Bags
              </span>
            </p>
            <strong className="app-xfer-ride-kind">Private Transfer</strong>
          </div>
          <div className="app-xfer-ride-art">
            <img src="/image8.png" alt="" />
            <span className="app-xfer-ride-badge" aria-hidden="true">
              <TreePalm size={20} strokeWidth={1.5} />
            </span>
          </div>
        </section>

        <ol className="app-xfer-tl">
          {STEPS.map((s) => (
            <li key={s.key} className={`app-xfer-tl-item is-${s.state}`}>
              <span className="app-xfer-tl-mark" aria-hidden="true">
                {s.state === 'done' ? <Check size={14} strokeWidth={3} /> : null}
                {s.state === 'live' ? <Car size={16} strokeWidth={1.5} /> : null}
              </span>
              <div className="app-xfer-tl-body">
                <div className="app-xfer-tl-head">
                  <h3>
                    {s.title}
                    {s.state === 'live' ? (
                      <span className="app-xfer-pill is-live is-sm">
                        <i /> Live
                      </span>
                    ) : null}
                  </h3>
                  {s.pin ? <MapPin size={18} strokeWidth={1.5} aria-hidden="true" /> : null}
                </div>
                <span className="app-xfer-tl-time">{s.time}</span>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="app-xfer-card is-tight">
          <div className="app-xfer-kv">
            <span className="app-xfer-icobox">
              <Plane size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="app-xfer-kv-text">
              <small>Flight Number</small>
              <strong>{booking.flight}</strong>
            </span>
            <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="app-xfer-kv-foot">
            <span>Flight Status</span>
            <span className="app-xfer-pill is-green is-sm">on time</span>
          </div>
        </section>

        <section className="app-xfer-card is-tight">
          <div className="app-xfer-kv">
            <span className="app-xfer-icobox">
              <Car size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="app-xfer-kv-text">
              <small>Driver</small>
              <strong>Michael</strong>
            </span>
            <span className="app-xfer-actions">
              <a href="tel:+18505550142" className="app-xfer-action" aria-label="Call driver">
                <Phone size={18} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
              </a>
              <a href="#message" className="app-xfer-action" aria-label="Message driver">
                <MessageCircle size={18} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className="app-xfer-kv-foot">
            <span className="app-xfer-stars" aria-label="Rated 4.9 out of 5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" />
              ))}
            </span>
            <span className="app-xfer-rating">
              <b>4.9</b> (230 trips)
            </span>
          </div>
        </section>

        <section className="app-xfer-card is-tight">
          <p className="app-xfer-instr-h">
            Pickup Instructions <Info size={16} strokeWidth={1.5} aria-hidden="true" />
          </p>
          <p className="app-xfer-instr">
            Driver will meet you at Baggage Claim, outside door 3 with a My30A Host sign.
          </p>
        </section>

        <section className="app-xfer-help">
          <div>
            <strong>Need anything?</strong>
            <em>Message Vitoria for any help during your trip.</em>
          </div>
          <Link to="/app/vitoria" className="app-xfer-help-link">
            Message Vitoria <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </TransferShell>
  )
}
