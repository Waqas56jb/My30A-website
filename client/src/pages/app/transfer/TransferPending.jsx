import {
  BadgeCheck,
  Calendar,
  Car,
  CircleDollarSign,
  Clock,
  Home,
  Info,
  Luggage,
  Plane,
  Users,
} from 'lucide-react'
import { Cta, DetailRow, PRICE, TransferShell, pad, useBooking } from './TransferShell.jsx'

export default function TransferPending() {
  const booking = useBooking()

  return (
    <TransferShell
      title="Book Airport Transfer"
      back="/app/transfer/review"
      step={3}
      footer={
        <>
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>We’ll notify you as soon as it’s confirmed.</span>
          </div>
          <Cta to="/app/home">Back to Home</Cta>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero">
          <span className="app-xfer-avatar" role="img" aria-label="Vitoria">
            <BadgeCheck
              size={38}
              strokeWidth={1.5}
              fill="#2B49F5"
              color="#ffffff"
              className="app-xfer-avatar-badge"
              aria-hidden="true"
            />
          </span>
          <h2 className="app-xfer-hero-title">Vitoria Has Your Transfer Request</h2>
          <p className="app-xfer-hero-sub">We’ll confirm driver and vehicle availability shortly.</p>
        </div>

        <section className="app-xfer-card">
          <div className="app-xfer-rows is-flush">
            <DetailRow icon={Home} label="Community" value={booking.community} />
            <DetailRow
              icon={Plane}
              label={booking.tripType === 'departure' ? 'To' : 'From'}
              value={booking.airport}
            />
            <DetailRow icon={Calendar} label="Date" value={booking.date} />
            <DetailRow icon={Clock} label="Time" value={booking.time} />
            <DetailRow icon={Users} label="Passengers" value={pad(booking.passengers)} />
            <DetailRow icon={Luggage} label="Bags" value={pad(booking.bags)} />
            <DetailRow icon={Car} label="Vehicle" value={booking.vehicle} />
            <DetailRow icon={CircleDollarSign} label="Estimated price" value={`$${PRICE.transfer}`} />
          </div>
        </section>
      </div>
    </TransferShell>
  )
}
