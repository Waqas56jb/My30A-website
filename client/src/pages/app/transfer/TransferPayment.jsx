import { useState } from 'react'
import {
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Home,
  Info,
  Luggage,
  Plane,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  Cta,
  DetailRow,
  PRICE,
  PriceCard,
  TransferShell,
  pad,
  tripLabel,
  useBooking,
} from './TransferShell.jsx'
import CardForm from './CardForm.jsx'

export default function TransferPayment() {
  const booking = useBooking()
  const [open, setOpen] = useState(true)
  const total = PRICE.transfer + PRICE.holiday

  return (
    <TransferShell
      back="/app/home"
      footer={
        <>
          <div className="app-xfer-auth">
            <div>
              <strong>Authorize ${total}</strong>
              <em>This is an authorization hold, not a charge.</em>
            </div>
            <span className="app-xfer-pill is-green">
              <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
              Secure &amp; encrypted
            </span>
          </div>
          <Cta to="/app/transfer/track" state={{ booking }}>
            Continue to Proceed
          </Cta>
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            Complete within 24 hours Booking auto-cancels otherwise.
          </p>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge" aria-hidden="true">
            <Check size={22} strokeWidth={2} />
          </span>
          <h2 className="app-xfer-hero-title">Your Transfer Is Confirmed</h2>
          <p className="app-xfer-hero-sub">
            Complete your card authentication to secure your booking.
          </p>
        </div>

        <section className="app-xfer-card">
          <button
            type="button"
            className="app-xfer-card-h is-toggle"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="app-xfer-card-emoji" aria-hidden="true">
              🚖
            </span>
            <span>Transfer Details</span>
            {open ? (
              <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
          {open ? (
            <div className="app-xfer-rows">
              <DetailRow icon={Home} label="Community" value={booking.community} />
              <DetailRow icon={Plane} label="Airport" value={booking.airport} />
              <DetailRow icon={Luggage} label="Trip type" value={tripLabel(booking.tripType)} />
              <DetailRow icon={Calendar} label="Date" value={booking.date} />
              <DetailRow icon={Clock} label="Time" value={booking.time} />
              <DetailRow icon={Car} label="Vehicle" value={booking.vehicle} />
              <DetailRow icon={Users} label="Passengers" value={pad(booking.passengers)} />
              <DetailRow icon={Luggage} label="Bags" value={pad(booking.bags)} />
              <DetailRow icon={Plane} label="Flight number" value={booking.flight} />
            </div>
          ) : null}
        </section>

        <PriceCard />

        <section className="app-xfer-section">
          <h2 className="app-xfer-h is-icon">
            <CreditCard size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
            Authorize Your Card
          </h2>
          <CardForm />
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>
              Your card is authorized now and will only be charged after your transfer is
              completed.
            </span>
          </div>
        </section>
      </div>
    </TransferShell>
  )
}
