import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import EmptyState from '../../components/EmptyState.jsx'
import { usePageHeader } from '../../components/Layout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { withQuery } from '../../lib/api.js'
import {
  chicagoMonth,
  chicagoToday,
  errorMessage,
  formatPeriodRange,
  formatShortDate,
  monthTitle,
  payoutMethodLabel,
  shiftMonth,
  usd,
  weekdayDate,
} from '../../lib/format.js'
import { useQuery } from '../../lib/useQuery.js'
import { useTitle } from '../../lib/useTitle.js'

function partnerRoute(trip) {
  const community = trip.community || 'Community'
  const airport = trip.airport || 'Airport'
  return `${community} → ${airport}`
}

function feePercent(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Number.isInteger(n) ? String(n) : String(n)
}

function groupVehicles(trips) {
  const groups = new Map()
  const sorted = [...(trips || [])].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
  for (const trip of sorted) {
    const key = trip.vehicle_label || 'Vehicle'
    const current = groups.get(key) || {
      key,
      label: key,
      type: trip.vehicle_type || trip.vehicle?.vehicle_type || null,
      trips: [],
      total: 0,
      percent: null,
    }
    current.trips.push(trip)
    current.total += Number(trip.owner_fee || 0)
    if (current.percent == null && trip.owner_fee_percent_snapshot != null) {
      current.percent = trip.owner_fee_percent_snapshot
    }
    groups.set(key, current)
  }
  return [...groups.values()]
}

function paidInMonth(payouts, month) {
  return (payouts || []).filter((payout) => {
    if (payout.status !== 'paid') return false
    const when = payout.paid_at || payout.created_at
    if (!when) return false
    return chicagoToday(new Date(when)).slice(0, 7) === month
  })
}

function payoutTitle(payout) {
  if (payout.status === 'paid') {
    const method = payout.payment_method ? ` · ${payoutMethodLabel(payout.payment_method)}` : ''
    return `Paid · ${formatShortDate(payout.paid_at || payout.created_at)}${method}`
  }
  return 'Pending'
}

function payoutSubline(payout) {
  const count = Array.isArray(payout.items) ? payout.items.length : 0
  const period = formatPeriodRange(payout.period_start, payout.period_end)
  const parts = [`${count} item${count === 1 ? '' : 's'}`]
  if (period) parts.push(period)
  return parts.join(' · ')
}

function SummaryStrip({ total, trips, paid }) {
  return (
    <div className="owner-summary">
      <div>
        <div className="l">Vehicle fees this month</div>
        <div className="v">{usd(total, { digits: 2 })}</div>
      </div>
      <div className="r">
        {trips} trip{trips === 1 ? '' : 's'}
        <b>Paid so far {usd(paid, { digits: 2 })}</b>
      </div>
    </div>
  )
}

function MineBlock({ trips, earnings, tips }) {
  return (
    <div className="mine">
      <div>
        <div className="l">My own trips</div>
        <div className="v">{trips}</div>
      </div>
      <div>
        <div className="l">Driving earnings</div>
        <div className="v">{usd(earnings)}</div>
      </div>
      <div>
        <div className="l">My tips</div>
        <div className="v">{usd(tips)}</div>
      </div>
    </div>
  )
}

function PayoutsList({ payouts, loading }) {
  return (
    <>
      <div className="month">
        <h2>Payouts</h2>
      </div>
      {loading ? (
        <article className="vehicle">
          <div className="trip">
            <span className="shimmer shimmer-lg" />
          </div>
        </article>
      ) : payouts.length === 0 ? (
        <p className="section-empty">No payouts yet.</p>
      ) : (
        <article className="vehicle">
          {payouts.map((payout) => (
            <div key={payout.id} className="trip">
              <span className="t">{payoutTitle(payout)}</span>
              <span className="s">{payoutSubline(payout)}</span>
              <span className="a">
                <b>{usd(payout.total_amount, { digits: 2 })}</b>
              </span>
            </div>
          ))}
        </article>
      )}
    </>
  )
}

export default function Vehicles() {
  useTitle('Partner · My30A Host')
  const { profile } = useAuth()
  const isDriver = (profile?.roles || []).includes('driver')
  const [month, setMonth] = useState(chicagoMonth())
  const summaryQuery = useQuery(withQuery('/api/earnings/vehicle-owner', { month }))
  const tripsQuery = useQuery(withQuery('/api/transfers/vehicle-owner', { month }))
  const payoutsQuery = useQuery('/api/payouts/mine')

  const trips = tripsQuery.data?.trips || []
  const groups = useMemo(() => groupVehicles(trips), [trips])
  const summary = summaryQuery.data
  const payouts = payoutsQuery.data || []
  const paidThisMonth = paidInMonth(payouts, month)
  const paidTotal = paidThisMonth.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
  const tripCount = summary?.vehicles?.reduce((sum, row) => sum + Number(row.trips_count || 0), 0) ?? trips.length
  const feeTotal = summary?.month_total ?? tripsQuery.data?.total_owner_fee ?? 0

  usePageHeader('My vehicles', `${monthTitle(month)} · ${groups.length} vehicle${groups.length === 1 ? '' : 's'}`)

  const loading = tripsQuery.loading && !tripsQuery.data
  const empty = !loading && groups.length === 0
  const showMine = isDriver && summary
  const showSummarySkeleton = summaryQuery.loading && !summary && loading
  const showPayoutSkeleton = payoutsQuery.loading && !payouts.length

  return (
    <section className="partner-page">
      <div className="partner-hero">
        {showSummarySkeleton ? (
          <div className="owner-summary skeleton-summary">
            <span className="shimmer shimmer-lg" />
          </div>
        ) : (
          <SummaryStrip total={feeTotal} trips={tripCount} paid={paidTotal} />
        )}
        {showMine ? (
          <MineBlock
            trips={summary.driver_trips_count}
            earnings={summary.driver_earnings}
            tips={summary.driver_tips}
          />
        ) : null}
      </div>

      <div className="partner-main">
        <div className="month">
          <h2>Trips using my vehicles</h2>
          <div className="month-tools">
            <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {tripsQuery.error ? <p className="page-error">{errorMessage(tripsQuery.error)}</p> : null}

        {loading ? (
          <article className="vehicle">
            <div className="hd">
              <span className="shimmer shimmer-lg" />
            </div>
            <div className="trip">
              <span className="shimmer shimmer-sm" />
            </div>
          </article>
        ) : empty ? (
          <EmptyState icon={Truck} title="No trips with your vehicles this month" />
        ) : (
          groups.map((group) => (
            <article key={group.key} className="vehicle">
              <div className="hd">
                <div className="name">
                  {group.label}
                  {group.type ? ` · ${group.type}` : ''}
                  {feePercent(group.percent) ? <small>Owner fee {feePercent(group.percent)}%</small> : null}
                </div>
                <div className="tot">
                  {group.trips.length} trip{group.trips.length === 1 ? '' : 's'}
                  <b>{usd(group.total, { digits: 2 })}</b>
                </div>
              </div>
              {group.trips.map((trip) => (
                <div key={`${trip.trip_number}-${trip.scheduled_at}`} className="trip">
                  <span className="t">
                    {weekdayDate(trip.scheduled_at)} · Trip #{trip.trip_number}
                  </span>
                  <span className="s">
                    {partnerRoute(trip)}
                    {trip.you_drove === true ? ' · you drove' : ''}
                  </span>
                  <span className="a">
                    <b>{usd(trip.owner_fee, { digits: 2 })}</b>
                    {trip.customer_charge != null ? <small>of {usd(trip.customer_charge)}</small> : null}
                  </span>
                </div>
              ))}
            </article>
          ))
        )}

        <div className="note sand">
          Your fee is a percentage of the trip price, set by Welson per vehicle. Tips go to the driver and are not
          shown here.
        </div>

        <div className="partner-payouts-mobile">
          <PayoutsList payouts={payouts} loading={showPayoutSkeleton} />
        </div>
      </div>

      <aside className="partner-aside">
        {showSummarySkeleton ? (
          <div className="owner-summary skeleton-summary">
            <span className="shimmer shimmer-lg" />
          </div>
        ) : (
          <SummaryStrip total={feeTotal} trips={tripCount} paid={paidTotal} />
        )}
        {showMine ? (
          <MineBlock
            trips={summary.driver_trips_count}
            earnings={summary.driver_earnings}
            tips={summary.driver_tips}
          />
        ) : null}
        <PayoutsList payouts={payouts} loading={showPayoutSkeleton} />
      </aside>
    </section>
  )
}
