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

export const ADDONS = [
  { key: 'rush', name: 'Rush', sub: 'Same-day service', price: 50, tone: 'green', icon: 'Zap' },
  { key: 'holiday', name: 'Holiday', sub: 'Weekend', price: 50, tone: 'blue', icon: 'Calendar' },
]

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
  addons: { rush: false, holiday: false },
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
