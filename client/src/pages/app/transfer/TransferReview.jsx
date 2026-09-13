import { useState } from 'react'
import {
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Home,
  Info,
  Luggage,
  MapPin,
  Plane,
  Users,
} from 'lucide-react'
import {
  Cta,
  DetailRow,
  PriceCard,
  TransferShell,
  pad,
  tripLabel,
  useBooking,
} from './TransferShell.jsx'

const POLICY = [
  '48h+ before pickup: Full release - no charge',
  '24-48h before pickup: $50 cancellation fee charged',
  'Same day or no-show: $75 fee- no exceptions',
  'We cancel for any reason: Full release + $25 credit on next booking',
]

export default function TransferReview() {
  const booking = useBooking()
  const [agree, setAgree] = useState(true)
  const [policyOpen, setPolicyOpen] = useState(true)

  const [street, ...rest] = booking.address.split(', ')
  const addressValue = rest.length ? (
    <>
      {street},<br />
      {rest.join(', ')}
    </>
  ) : (
    booking.address
  )

  return (
    <TransferShell
      title="Book Airport Transfer"
      back="/app/transfer"
      step={2}
      footer={
        <>
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>
              No payment is taken yet. Your card will only be authorized after My30A Host
              confirms availability.
            </span>
          </div>
          <Cta to="/app/transfer/pending" state={{ booking }}>
            Submit Request
          </Cta>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-intro">
          <h2 className="app-xfer-h">Review Your Transfer</h2>
          <p>Please review your details before submitting your request.</p>
        </div>

        <section className="app-xfer-card">
          <h2 className="app-xfer-card-h">
            <span className="app-xfer-card-emoji" aria-hidden="true">
              🚖
            </span>
            Transfer Details
          </h2>
          <div className="app-xfer-rows">
            <DetailRow icon={Home} label="Community" value={booking.community} />
            <DetailRow icon={MapPin} label="Address" value={addressValue} />
            <DetailRow icon={Plane} label="Airport" value={booking.airport} />
            <DetailRow icon={Luggage} label="Trip type" value={tripLabel(booking.tripType)} />
            <DetailRow icon={Calendar} label="Date" value={booking.date} />
            <DetailRow icon={Clock} label="Time" value={booking.time} />
            <DetailRow icon={Car} label="Vehicle" value={booking.vehicle} />
            <DetailRow icon={Users} label="Passengers" value={pad(booking.passengers)} />
            <DetailRow icon={Luggage} label="Bags" value={pad(booking.bags)} />
            <DetailRow icon={Plane} label="Flight number" value={booking.flight} />
          </div>
        </section>

        <PriceCard />

        <section className="app-xfer-card">
          <button
            type="button"
            className="app-xfer-card-h is-toggle"
            aria-expanded={policyOpen}
            onClick={() => setPolicyOpen((o) => !o)}
          >
            <ClipboardList size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
            <span>Cancellation Policy</span>
            {policyOpen ? (
              <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
          {policyOpen ? (
            <ul className="app-xfer-policy">
              {POLICY.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <button
          type="button"
          className="app-xfer-agree"
          aria-pressed={agree}
          onClick={() => setAgree((a) => !a)}
        >
          <span className={`app-xfer-cb${agree ? ' is-on' : ''}`} aria-hidden="true">
            {agree ? <Check size={12} strokeWidth={3} /> : null}
          </span>
          I understand and agree to the cancellation policy.
        </button>
      </div>
    </TransferShell>
  )
}
