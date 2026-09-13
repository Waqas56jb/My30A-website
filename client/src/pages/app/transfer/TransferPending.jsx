import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { guest } from '../../../lib/guestApi.js'
import { Cta, DetailRow, TransferShell, pad, usd, useBooking, useTransferId } from './TransferShell.jsx'

export default function TransferPending() {
  const booking = useBooking()
  const { state } = useLocation()
  const id = useTransferId()
  const [transfer, setTransfer] = useState(state?.transfer || null)

  useEffect(() => {
    if (transfer || !id) return undefined
    let ignore = false
    guest
      .transfer(id)
      .then((t) => !ignore && setTransfer(t))
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [id, transfer])

  const community = transfer?.community || booking.community
  const airport = transfer?.airport || booking.airport
  const isDeparture = transfer ? transfer.trip_type === 'departure' : booking.tripType === 'departure'
  const date = transfer?.date_label || booking.date
  const time = transfer?.time_label || booking.time
  const passengers = transfer?.passengers ?? booking.passengers
  const bags = transfer?.bags ?? booking.bags
  const vehicle = transfer?.vehicle || booking.vehicle
  const price = transfer ? usd(transfer.total) : '—'

  return (
    <TransferShell
      title="Book Airport Transfer"
      back="/app/home"
      step={3}
      footer={
        <>
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>We’ll notify you as soon as it’s confirmed.</span>
          </div>
          {transfer ? (
            <Cta to={`/app/transfer/track?id=${transfer.id}`} ghost>
              Track request #{transfer.trip_number}
            </Cta>
          ) : null}
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
            <DetailRow icon={Home} label="Community" value={community} />
            <DetailRow icon={Plane} label={isDeparture ? 'To' : 'From'} value={airport} />
            <DetailRow icon={Calendar} label="Date" value={date} />
            <DetailRow icon={Clock} label="Time" value={time} />
            <DetailRow icon={Users} label="Passengers" value={pad(passengers)} />
            <DetailRow icon={Luggage} label="Bags" value={pad(bags)} />
            <DetailRow icon={Car} label="Vehicle" value={vehicle} />
            <DetailRow icon={CircleDollarSign} label="Estimated price" value={price} />
          </div>
        </section>
      </div>
    </TransferShell>
  )
}
