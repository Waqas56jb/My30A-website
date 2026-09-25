import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Calendar, Zap } from 'lucide-react'
import { guest } from '../../../lib/guestApi.js'

// Static fallbacks — identical to the seeded service_catalog rows; the live catalog wins when loaded.
export const PACKAGES = [
  { key: 'full', name: 'Full Pack', items: 'Up to 70 items', price: 229, unit: '+ Publix' },
  { key: 'large', name: 'Large Pack', items: '71-120 items', price: 379, unit: '+ Publix' },
  { key: 'xl', name: 'XL Pack', items: 'Over $1,000 in items', price: 229, unit: '+ Publix' },
  { key: 'bulk', name: 'Bulk Order', items: '121-200 items', price: 379, unit: '/ $1k block' },
]

// Rush/Holiday add-ons were removed from grocery (client request) — deactivated in service_catalog,
// so the live catalog now returns none. No static fallback needed.
export const ADDONS = []

export const STOCKING = [
  { key: 'bags', name: 'Leave In Bags', desc: 'Everything left in bags by the kitchen', price: 0 },
  {
    key: 'full-kitchen',
    name: 'Full Kitchen Organization',
    desc: 'Put away in fridge, pantry & cabinets',
    price: 30,
  },
  {
    key: 'cold',
    name: 'Refrigerated Items Only',
    desc: 'Cold items stored, rest left in bags',
    price: 15,
  },
]

const ICONS = { Zap, Calendar }
export const addonIcon = (addon) => ICONS[addon.icon] || Zap

export const DEFAULT_GROCERY = {
  pkg: 'full',
  addons: {},
  stocking: 'full-kitchen',
  date: '',
  time: '',
  deliveryAt: '',
  catalog: null,
}

// Live catalog from the API, mapped to the shapes the screens already use.
export function useCatalog() {
  const [catalog, setCatalog] = useState(null)
  useEffect(() => {
    let ignore = false
    guest
      .catalog()
      .then((c) => {
        if (ignore) return
        setCatalog({
          packages: c.grocery.packages.map((p) => ({ key: p.key, name: p.name, items: p.sub, price: p.price, unit: p.unit })),
          addons: c.grocery.addons.map((a) => ({ key: a.key, name: a.name, sub: a.sub, price: a.price, tone: a.tone || 'green', icon: a.icon || 'Zap' })),
          stocking: c.grocery.stocking.map((s) => ({ key: s.key, name: s.name, desc: s.sub, price: s.price })),
        })
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])
  return catalog
}

export function useGrocery() {
  const { state } = useLocation()
  return { ...DEFAULT_GROCERY, ...(state?.grocery || {}) }
}

// Reads the order id from router state or the ?id= query (so links from Home work).
export function useOrderId() {
  const { state, search } = useLocation()
  return state?.order?.id || new URLSearchParams(search).get('id') || ''
}

const packagesOf = (g) => g.catalog?.packages || PACKAGES
const addonsOf = (g) => g.catalog?.addons || ADDONS
const stockingsOf = (g) => g.catalog?.stocking || STOCKING

export const pkgOf = (g) => packagesOf(g).find((p) => p.key === g.pkg) || packagesOf(g)[0]
export const stockingOf = (g) =>
  stockingsOf(g).find((s) => s.key === g.stocking) || stockingsOf(g)[1] || stockingsOf(g)[0]
export const addonList = (g) => addonsOf(g).filter((a) => g.addons?.[a.key])
export const addonTotal = (g) => addonList(g).reduce((sum, a) => sum + a.price, 0)
export const serviceFee = (g) => pkgOf(g).price + stockingOf(g).price
export const grandTotal = (g) => serviceFee(g) + addonTotal(g)
export const money = (n) => `$${Number(n || 0).toFixed(2)}`
export const addonLabel = (g) =>
  addonList(g).length ? addonList(g).map((a) => `${a.name} +$${a.price}`).join(', ') : 'None'

export function SummaryFooter({ grocery }) {
  return (
    <div className="app-groc-summary">
      <div className="app-groc-summary-row">
        <span className="app-groc-kv">
          <small>Selected package</small>
          <strong>{pkgOf(grocery).name}</strong>
        </span>
        <span className="app-groc-kv is-right">
          <small>Stocking</small>
          <strong>{stockingOf(grocery).name}</strong>
        </span>
      </div>
      <hr className="app-groc-hr" />
      <div className="app-groc-price">
        <span>Estimated price</span>
        <strong>${serviceFee(grocery) + addonTotal(grocery)} + Publix</strong>
      </div>
    </div>
  )
}

// ---------- prepayment (mirrors server/src/services/groceryPay.js) ----------
export const DEFAULT_POLICY = { buffer_percent: 5, rush_fee_percent: 2, min_notice_hours: 72 }
const cents = (n) => Math.round(Number(n) * 100) / 100
export const usd = (n) => `$${Number(n || 0).toFixed(2)}`

export function prepayFor(cart, deliveryAt, policy = DEFAULT_POLICY) {
  const total = cents(cart)
  if (!(total > 0)) return null
  const hours = (new Date(deliveryAt).getTime() - Date.now()) / 3600000
  const is_rush = Number.isFinite(hours) && hours < policy.min_notice_hours
  const buffer_amount = cents((total * policy.buffer_percent) / 100)
  const grocery_prepaid = cents(total + buffer_amount)
  const rush_fee = is_rush ? cents((total * policy.rush_fee_percent) / 100) : 0
  return {
    cart_estimate: total,
    buffer_percent: policy.buffer_percent,
    buffer_amount,
    grocery_prepaid,
    is_rush,
    rush_fee_percent: policy.rush_fee_percent,
    rush_fee,
    prepay_amount: cents(grocery_prepaid + rush_fee),
  }
}

// The money story of a grocery order, from checkout to delivery. `p` is prepayFor(...) at checkout
// or the order itself afterwards (same field names).
export function PrepayBreakdown({ p, serviceFee: fee, receipt = null, settled = null, title = 'Your payment' }) {
  if (!p || !(Number(p.prepay_amount) > 0)) return null
  const bufferAmount = p.buffer_amount ?? cents(Number(p.grocery_prepaid) - Number(p.cart_estimate))
  return (
    <section className="app-xfer-card app-groc-bill" aria-label={title}>
      <h3>{title}</h3>
      <div className="app-groc-bill-row">
        <span>Publix cart total</span>
        <b>{usd(p.cart_estimate)}</b>
      </div>
      <div className="app-groc-bill-row">
        <span>Price buffer ({Number(p.buffer_percent)}%) · weighed items &amp; swaps</span>
        <b>{usd(bufferAmount)}</b>
      </div>
      {Number(p.rush_fee) > 0 ? (
        <div className="app-groc-bill-row">
          <span>Rush order fee ({Number(p.rush_fee_percent ?? 2)}%)</span>
          <b>{usd(p.rush_fee)}</b>
        </div>
      ) : null}
      <div className="app-groc-bill-row is-total">
        <span>{receipt != null ? 'Prepaid at checkout' : p.prepaid_at ? 'Paid at checkout' : 'Charged now'}</span>
        <b>{usd(p.prepay_amount)}</b>
      </div>
      <hr className="app-groc-hr" />
      {receipt == null ? (
        <p className="app-groc-bill-note">
          After delivery: the <b>{usd(fee)}</b> service fee, adjusted to your exact Publix receipt — any unused buffer comes
          off your service fee.
        </p>
      ) : (
        <>
          <div className="app-groc-bill-row">
            <span>Publix receipt</span>
            <b>{usd(receipt)}</b>
          </div>
          <div className="app-groc-bill-row">
            <span>Service fee</span>
            <b>{usd(fee)}</b>
          </div>
          {settled != null ? (
            <div className="app-groc-bill-row is-total">
              <span>{settled >= 0 ? 'Charged at delivery' : 'Refunded at delivery'}</span>
              <b>{usd(Math.abs(settled))}</b>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
