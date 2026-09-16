import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { errorText, guest } from '../../../lib/guestApi.js'
import {
  Cta,
  DetailRow,
  PriceCard,
  TransferShell,
  pad,
  tripLabel,
  useBooking,
} from './TransferShell.jsx'
import { Picker, fmtDate, fmtTime, toIso, tomorrow } from './TransferBook.jsx'

const POLICY = [
  '48h+ before pickup: Full release - no charge',
  '24-48h before pickup: $50 cancellation fee charged',
  'Same day or no-show: $75 fee- no exceptions',
  'We cancel for any reason: Full release + $25 credit on next booking',
]

export default function TransferReview() {
  const navigate = useNavigate()
  const booking = useBooking()
  const [agree, setAgree] = useState(true)
  const [policyOpen, setPolicyOpen] = useState(true)
  const [roundTrip, setRoundTrip] = useState(false)
  const [returnDate, setReturnDate] = useState(tomorrow())
  const [returnTime, setReturnTime] = useState('11:00')
  const [returnFlight, setReturnFlight] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const quoteBody = {
    trip_type: booking.tripType,
    airport: booking.airport,
    community: booking.community,
    vehicle_type: booking.vehicleType,
    round_trip: roundTrip,
  }

  useEffect(() => {
    let ignore = false
    setQuote(null)
    setQuoteError('')
    guest
      .transferQuote(quoteBody)
      .then((q) => !ignore && setQuote(q))
      .catch((err) => !ignore && setQuoteError(errorText(err)))
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.tripType, booking.airport, booking.community, booking.vehicleType, roundTrip])

  const submit = async () => {
    setError('')
    if (!agree) {
      setError('Please agree to the cancellation policy to continue.')
      return
    }
    setBusy(true)
    try {
      const transfer = await guest.createTransfer({
        ...quoteBody,
        address: booking.address,
        lat: booking.addressLat ?? undefined,
        lon: booking.addressLon ?? undefined,
        scheduled_at: booking.scheduledAt || new Date(Date.now() + 86400 * 1000).toISOString(),
        passengers: booking.passengers,
        bags: booking.bags,
        flight_number: booking.flight || undefined,
        return_trip: roundTrip
          ? { scheduled_at: toIso(returnDate, returnTime), flight_number: returnFlight.trim() || undefined }
          : undefined,
      })
      navigate('/app/transfer/pending', {
        replace: true,
        state: { booking, transfer },
      })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

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
          {error ? <p className="app-inline-error">{error}</p> : null}
          <Cta onClick={submit} disabled={busy || Boolean(quoteError)}>
            {busy ? 'Submitting…' : 'Submit Request'}
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
            <DetailRow icon={Plane} label="Flight number" value={booking.flight || '—'} />
          </div>
        </section>

        <PriceCard quote={quote} loading={!quote && !quoteError} />
        {quoteError ? <p className="app-inline-error">{quoteError}</p> : null}
        {quote?.available_credit > 0 ? (
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>You have a ${quote.available_credit} credit — it’s applied automatically when you submit.</span>
          </div>
        ) : null}

        <button
          type="button"
          className="app-xfer-agree"
          aria-pressed={roundTrip}
          onClick={() => setRoundTrip((r) => !r)}
        >
          <span className={`app-xfer-cb${roundTrip ? ' is-on' : ''}`} aria-hidden="true">
            {roundTrip ? <Check size={12} strokeWidth={3} /> : null}
          </span>
          Book the return trip too — 5% off both legs
        </button>
        {roundTrip ? (
          <section className="app-xfer-section">
            <h2 className="app-xfer-h">Return {booking.tripType === 'departure' ? 'pickup' : 'drop-off'} date &amp; time</h2>
            <div className="app-xfer-row-2 is-gap-10">
              <Picker icon={Calendar} type="date" value={returnDate} min={tomorrow()} display={fmtDate(returnDate)} onChange={setReturnDate} />
              <Picker icon={Clock} type="time" value={returnTime} display={fmtTime(returnTime)} onChange={setReturnTime} />
            </div>
            <label className="app-xfer-box" style={{ marginTop: 10 }}>
              <Plane size={16} strokeWidth={1.5} aria-hidden="true" />
              <input
                type="text"
                placeholder="Return flight number (optional)"
                value={returnFlight}
                onChange={(e) => setReturnFlight(e.target.value)}
              />
            </label>
          </section>
        ) : null}

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
