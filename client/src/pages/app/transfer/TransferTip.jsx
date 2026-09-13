import { useState } from 'react'
import { ArrowRight, Check, Info, Luggage, Sparkles, Users } from 'lucide-react'
import { Cta, PRICE, TransferShell, useBooking } from './TransferShell.jsx'
import { TipGrid, money, tipAmount } from './TipBits.jsx'

export default function TransferTip() {
  const booking = useBooking()
  const [pick, setPick] = useState('18')
  const from = booking.tripType === 'departure' ? booking.community : booking.airport
  const to = booking.tripType === 'departure' ? booking.airport : booking.community
  const shortDate = booking.date.replace(/,\s*\d{4}$/, '')
  const amount = tipAmount(PRICE.transfer, pick)

  return (
    <TransferShell
      back="/app/home"
      footer={
        <>
          <div className="app-xfer-tipnote">
            <strong>
              <span aria-hidden="true">💌</span> 100% of your tip goes to your driver.
            </strong>
            <span>Tips are a great way to show appreciation for excellent service.</span>
          </div>
          <div className="app-xfer-row-2 is-gap-20">
            <Cta to="/app/home" ghost>
              No Thanks
            </Cta>
            <Cta to="/app/home">{amount ? `Leave ${money(amount)} Tip` : 'Leave a Tip'}</Cta>
          </div>
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            Complete within 24 hours Booking auto-cancels otherwise.
          </p>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge is-lg" aria-hidden="true">
            <Check size={30} strokeWidth={2} />
            <Sparkles size={22} strokeWidth={1.5} className="s1" />
            <Sparkles size={16} strokeWidth={1.5} className="s2" />
            <Sparkles size={14} strokeWidth={1.5} className="s3" />
          </span>
          <h2 className="app-xfer-hero-title">Hope Your Ride Was Smooth!</h2>
          <p className="app-xfer-hero-sub">
            If you’d like to thank your driver,
            <br />
            you can leave a tip below.
          </p>
        </div>

        <section className="app-xfer-card app-xfer-fare">
          <div>
            <h2 className="app-xfer-route">
              {from} <ArrowRight size={22} strokeWidth={2} aria-hidden="true" /> {to}
            </h2>
            <p className="app-xfer-ride-when">
              {shortDate} -- {booking.time}
            </p>
            <p className="app-xfer-ride-meta">
              <span>
                <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Passengers
              </span>
              <span>
                <Luggage size={16} strokeWidth={1.5} aria-hidden="true" /> Bags
              </span>
            </p>
          </div>
          <div className="app-xfer-fare-price">
            <span>Estimated price</span>
            <strong>${PRICE.transfer}</strong>
          </div>
        </section>

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Add A Tip For Your Driver</h2>
          <TipGrid base={PRICE.transfer} pick={pick} onPick={setPick} />
        </section>
      </div>
    </TransferShell>
  )
}
