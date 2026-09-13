import { useState } from 'react'
import { Check, Info, Sparkles } from 'lucide-react'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { TipGrid, money, tipAmount } from '../transfer/TipBits.jsx'
import { addonLabel, addonTotal, serviceFee, useGrocery } from './GroceryShared.jsx'

const PUBLIX_TOTAL = 286.83

export default function GroceryTip() {
  const grocery = useGrocery()
  const [pick, setPick] = useState('18')
  const fee = serviceFee(grocery)
  const extras = addonTotal(grocery)
  const total = PUBLIX_TOTAL + fee + extras
  const tip = tipAmount(fee, pick)

  return (
    <TransferShell
      back="/app/home"
      className="app-groc-tip"
      footer={
        <>
          <div className="app-xfer-tipnote">
            <strong>
              <span aria-hidden="true">💌</span> 100% of your tip goes to your Shopper
            </strong>
            <span>Tips are a great way to show appreciation for excellent service.</span>
          </div>
          <div className="app-xfer-row-2 is-gap-20">
            <Cta to="/app/home" ghost>
              No Thanks
            </Cta>
            <Cta to="/app/home">{tip ? `Leave ${money(tip)} Tip` : 'Leave a Tip'}</Cta>
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
          <h2 className="app-xfer-hero-title">Your Kitchen Is Ready</h2>
          <p className="app-xfer-hero-sub">
            We’ve delivered and stocked everything for you.
            <br />
            Thank you for Choosing Vitoria!
          </p>
        </div>

        <section className="app-xfer-card app-groc-sum">
          <h3>Order Summary</h3>
          <div className="app-groc-sum-row">
            <span>
              <strong>Publix Grocery Total</strong>
              <small>Charged now</small>
            </span>
            <b>{money(PUBLIX_TOTAL)}</b>
          </div>
          <div className="app-groc-sum-row">
            <span>
              <strong>Service Fee</strong>
              <small>Authorized until delivery</small>
            </span>
            <b>{money(fee)}</b>
          </div>
          <div className="app-groc-sum-row">
            <span>
              <strong>Add-Ons</strong>
              <small>{addonLabel(grocery)}</small>
            </span>
            <b>{money(extras)}</b>
          </div>
          <div className="app-groc-sum-row is-total">
            <span>
              <strong>Total</strong>
            </span>
            <b>{money(total)}</b>
          </div>
          <div className="app-groc-info is-lg is-done">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong>Service completed</strong>
              <small>Delivered on {grocery.date} at 4:38 PM</small>
            </span>
          </div>
        </section>

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Add A Tip For Your Shopper</h2>
          <TipGrid base={fee} pick={pick} onPick={setPick} />
        </section>
      </div>
    </TransferShell>
  )
}
