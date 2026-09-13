import { useLocation } from 'react-router-dom'
import { Calendar, Zap } from 'lucide-react'

export const PACKAGES = [
  { key: 'full', name: 'Full Pack', items: 'Up to 70 items', price: 229, unit: '+ Publix' },
  { key: 'large', name: 'Large Pack', items: '71-120 items', price: 379, unit: '+ Publix' },
  { key: 'xl', name: 'XL Pack', items: 'Over $1,000 in items', price: 229, unit: '+ Publix' },
  { key: 'bulk', name: 'Bulk Order', items: '121-200 items', price: 379, unit: '/ $1k block' },
]

export const ADDONS = [
  { key: 'rush', name: 'Rush', sub: 'Same-day service', price: 50, tone: 'green', Icon: Zap },
  { key: 'holiday', name: 'Holiday', sub: 'Weekend', price: 50, tone: 'blue', Icon: Calendar },
]

export const STOCKING = [
  { key: 'bags', name: 'Leave In Bags', desc: 'Everything left in bags by the kitchen', price: 0 },
  {
    key: 'full',
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

export const DEFAULT_GROCERY = {
  pkg: 'full',
  addons: { rush: false, holiday: false },
  stocking: 'full',
  date: 'Oct 18, 2026',
  time: '4:00 PM - 5:00 PM',
}

export function useGrocery() {
  const { state } = useLocation()
  return { ...DEFAULT_GROCERY, ...(state?.grocery || {}) }
}

export const pkgOf = (g) => PACKAGES.find((p) => p.key === g.pkg) || PACKAGES[0]
export const stockingOf = (g) => STOCKING.find((s) => s.key === g.stocking) || STOCKING[1]
export const addonList = (g) => ADDONS.filter((a) => g.addons?.[a.key])
export const addonTotal = (g) => addonList(g).reduce((sum, a) => sum + a.price, 0)
export const serviceFee = (g) => pkgOf(g).price + stockingOf(g).price
export const grandTotal = (g) => serviceFee(g) + addonTotal(g)
export const money = (n) => `$${n.toFixed(2)}`
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
