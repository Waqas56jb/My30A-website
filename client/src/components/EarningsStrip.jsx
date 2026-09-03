import { usd } from '../lib/format.js'

export default function EarningsStrip({
  trip_earnings = 0,
  tips = 0,
  total = 0,
  earningsLabel = 'Trip earnings',
  totalLabel = 'Total',
}) {
  return (
    <div className="summary">
      <div>
        <div className="l">{earningsLabel}</div>
        <div className="v">{usd(trip_earnings)}</div>
      </div>
      <div className="tips">
        <div className="l">Tips</div>
        <div className="v">{usd(tips)}</div>
      </div>
      <div className="total">
        <div className="l">{totalLabel}</div>
        <div className="v">{usd(total)}</div>
      </div>
    </div>
  )
}

export function EarningsStripSkeleton() {
  return (
    <div className="summary skeleton-summary">
      <div>
        <span className="shimmer shimmer-sm" />
        <span className="shimmer shimmer-lg" />
      </div>
      <div>
        <span className="shimmer shimmer-sm" />
        <span className="shimmer shimmer-lg" />
      </div>
      <div className="total">
        <span className="shimmer shimmer-sm" />
        <span className="shimmer shimmer-lg" />
      </div>
    </div>
  )
}
