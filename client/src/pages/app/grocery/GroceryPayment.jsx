import { useState } from 'react'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Info,
  Package,
  Refrigerator,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { Cta, DetailRow, TransferShell } from '../transfer/TransferShell.jsx'
import CardForm from '../transfer/CardForm.jsx'
import {
  addonTotal,
  grandTotal,
  pkgOf,
  serviceFee,
  stockingOf,
  useGrocery,
} from './GroceryShared.jsx'

export default function GroceryPayment() {
  const grocery = useGrocery()
  const [open, setOpen] = useState(true)
  const total = grandTotal(grocery)

  return (
    <TransferShell
      title="Order Groceries"
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
          <Cta to="/app/grocery/track" state={{ grocery }}>
            Continue to Proceed
          </Cta>
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            Complete within 24 hours Order auto-cancels otherwise.
          </p>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge" aria-hidden="true">
            <Check size={22} strokeWidth={2} />
          </span>
          <h2 className="app-xfer-hero-title">Your Grocery Order Is Confirmed</h2>
          <p className="app-xfer-hero-sub">Complete payment so we can begin shopping your order.</p>
        </div>

        <section className="app-xfer-card">
          <button
            type="button"
            className="app-xfer-card-h is-toggle"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="app-xfer-card-emoji" aria-hidden="true">
              🛍️
            </span>
            <span>Grocery Details</span>
            {open ? (
              <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
          {open ? (
            <div className="app-xfer-rows">
              <DetailRow icon={Package} label="Package" value={pkgOf(grocery).name} />
              <DetailRow icon={Refrigerator} label="Stocking" value={stockingOf(grocery).name} />
              <DetailRow icon={Calendar} label="Delivery date" value={grocery.date} />
              <DetailRow icon={Clock} label="Delivery time" value={grocery.time} />
            </div>
          ) : null}
        </section>

        <section className="app-xfer-card">
          <h2 className="app-xfer-card-h">
            <Tag size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
            Price
          </h2>
          <div className="app-xfer-price">
            <div className="app-xfer-price-row">
              <span>Exact Publix grocery total</span>
              <span>${serviceFee(grocery)} + Publix</span>
            </div>
            <div className="app-xfer-price-row">
              <span>Add-ons</span>
              <span>+${addonTotal(grocery)}</span>
            </div>
            <div className="app-xfer-price-row is-total">
              <span>Total</span>
              <span>${total} + Publix</span>
            </div>
          </div>
        </section>

        <section className="app-xfer-section">
          <h2 className="app-xfer-h is-icon">
            <CreditCard size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
            Authorize Your Card
          </h2>
          <CardForm />
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>
              Your card is authorized now and will only be charged after your order is completed.
            </span>
          </div>
        </section>
      </div>
    </TransferShell>
  )
}
