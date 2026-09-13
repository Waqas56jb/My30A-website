import {
  BadgeCheck,
  Calendar,
  CircleDollarSign,
  Clock,
  Info,
  Package,
  Refrigerator,
  Zap,
} from 'lucide-react'
import { Cta, DetailRow, TransferShell } from '../transfer/TransferShell.jsx'
import { addonLabel, pkgOf, serviceFee, stockingOf, useGrocery } from './GroceryShared.jsx'

export default function GroceryPending() {
  const grocery = useGrocery()

  return (
    <TransferShell
      title="Order Groceries"
      back="/app/grocery/list"
      step={4}
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
          <h2 className="app-xfer-hero-title">Vitoria Has Your Grocery List</h2>
          <p className="app-xfer-hero-sub">We’ll review your items and confirm the exact total shortly.</p>
        </div>

        <section className="app-xfer-card">
          <div className="app-xfer-rows is-flush">
            <DetailRow icon={Package} label="Package" value={pkgOf(grocery).name} />
            <DetailRow icon={Refrigerator} label="Stocking" value={stockingOf(grocery).name} />
            <DetailRow icon={Calendar} label="Delivery date" value={grocery.date} />
            <DetailRow icon={Clock} label="Delivery time" value={grocery.time} />
            <DetailRow
              icon={CircleDollarSign}
              label="Estimated price"
              value={`$${serviceFee(grocery)} + Publix`}
            />
            <DetailRow icon={Zap} label="Add-ons" value={addonLabel(grocery)} />
          </div>
        </section>
      </div>
    </TransferShell>
  )
}
