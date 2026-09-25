import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { guest } from '../../../lib/guestApi.js'
import { Cta, DetailRow, TransferShell } from '../transfer/TransferShell.jsx'
import { PrepayBreakdown, addonLabel, pkgOf, serviceFee, stockingOf, useGrocery, useOrderId } from './GroceryShared.jsx'

export default function GroceryPending() {
  const grocery = useGrocery()
  const { state } = useLocation()
  const id = useOrderId()
  const [order, setOrder] = useState(state?.order || null)

  useEffect(() => {
    if (order || !id) return undefined
    let ignore = false
    guest
      .grocery(id)
      .then((o) => !ignore && setOrder(o))
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [id, order])

  const addons = order
    ? order.addons?.length
      ? order.addons.map((a) => `${a.name} +$${a.price}`).join(', ')
      : 'None'
    : addonLabel(grocery)

  return (
    <TransferShell
      title="Order Groceries"
      back="/app/home"
      step={4}
      footer={
        <>
          <div className="app-xfer-note is-info">
            <Info size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>We’ll notify you as soon as it’s confirmed.</span>
          </div>
          {order ? (
            <Cta to={`/app/grocery/track?id=${order.id}`} ghost>
              Track order #{order.order_number}
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
          <h2 className="app-xfer-hero-title">Vitoria Has Your Grocery List</h2>
          <p className="app-xfer-hero-sub">
            {order?.prepay_amount > 0
              ? 'Your groceries are paid for — we’ll confirm your shopper shortly.'
              : 'We’ll review your items and confirm the exact total shortly.'}
          </p>
        </div>

        <section className="app-xfer-card">
          <div className="app-xfer-rows is-flush">
            <DetailRow icon={Package} label="Package" value={order?.package || pkgOf(grocery).name} />
            <DetailRow icon={Refrigerator} label="Stocking" value={order?.stocking || stockingOf(grocery).name} />
            <DetailRow icon={Calendar} label="Delivery date" value={order?.date_label || grocery.date} />
            <DetailRow icon={Clock} label="Delivery time" value={order?.time_label || grocery.time} />
            <DetailRow
              icon={CircleDollarSign}
              label="Estimated price"
              value={`$${order ? order.service_fee : serviceFee(grocery)} + Publix`}
            />
            <DetailRow icon={Zap} label="Add-ons" value={addons} />
          </div>
        </section>

        <PrepayBreakdown p={order} serviceFee={order?.service_fee ?? serviceFee(grocery)} />
      </div>
    </TransferShell>
  )
}
