import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import EmptyState from '../../components/EmptyState.jsx'
import EarningsStrip, { EarningsStripSkeleton } from '../../components/EarningsStrip.jsx'
import { usePageHeader } from '../../components/Layout.jsx'
import { withQuery } from '../../lib/api.js'
import {
  chicagoMonth,
  chicagoShortDateLine,
  chicagoToday,
  errorMessage,
  formatShortDate,
  monthTitle,
  payoutMethodLabel,
  shiftMonth,
  usd,
  weekdayDate,
} from '../../lib/format.js'
import { useQuery } from '../../lib/useQuery.js'
import { useTitle } from '../../lib/useTitle.js'

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

function groupDays(trips) {
  const groups = new Map()
  for (const trip of trips || []) {
    if (trip.status !== 'completed') continue
    const key = chicagoToday(new Date(trip.completed_at || trip.scheduled_at))
    const current = groups.get(key) || {
      key,
      date: trip.completed_at || trip.scheduled_at,
      trips: 0,
      trip_earnings: 0,
      tips: 0,
    }
    current.trips += 1
    current.trip_earnings += Number(trip.driver_payout || 0)
    current.tips += Number(trip.tip_amount || 0)
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export default function Earnings() {
  useTitle('Earnings · My30A Host')
  usePageHeader('Earnings', chicagoShortDateLine())
  const [range, setRange] = useState('week')
  const [month, setMonth] = useState(chicagoMonth())
  const summaryQuery = useQuery(withQuery('/api/earnings/mine', { range }))
  const historyQuery = useQuery(withQuery('/api/transfers/mine/history', { month }))
  const payoutsQuery = useQuery('/api/payouts/mine')

  const days = useMemo(() => groupDays(historyQuery.data), [historyQuery.data])
  const monthTrips = days.reduce((sum, day) => sum + day.trips, 0)
  const summary = summaryQuery.data
  const payouts = payoutsQuery.data || []

  return (
    <section className="earnings-page">
      <div className="seg" role="tablist" aria-label="Earnings range">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={range === item.id}
            className={range === item.id ? 'on' : ''}
            onClick={() => setRange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {summaryQuery.loading && !summary ? (
        <EarningsStripSkeleton />
      ) : (
        <EarningsStrip
          trip_earnings={summary?.trip_earnings}
          tips={summary?.tips}
          total={summary?.total}
        />
      )}
      {summaryQuery.error ? <p className="page-error">{errorMessage(summaryQuery.error)}</p> : null}

      <div className="note">Tips are 100% yours and always shown separately.</div>

      <div className="earnings-cols">
        <div>
          <div className="month">
            <h2>{monthTitle(month)}</h2>
            <div className="month-tools">
              <span className="muted-inline">
                {monthTrips} trip{monthTrips === 1 ? '' : 's'}
              </span>
              <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          {historyQuery.loading && !historyQuery.data ? (
            <div className="list">
              <div className="row">
                <span className="shimmer shimmer-lg" />
              </div>
            </div>
          ) : days.length === 0 ? (
            <EmptyState icon={Wallet} title="No trips this month" />
          ) : (
            <div className="list">
              {days.map((day) => (
                <div key={day.key} className="row">
                  <span className="t">
                    {weekdayDate(day.date)} · {day.trips} trip{day.trips === 1 ? '' : 's'}
                  </span>
                  <span className="s">
                    Trip earnings {usd(day.trip_earnings)} · Tips {usd(day.tips)}
                  </span>
                  <span className="a">
                    <b>{usd(day.trip_earnings + day.tips)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="month">
            <h2>Payouts</h2>
          </div>
          {payoutsQuery.loading && !payouts.length ? (
            <div className="list">
              <div className="row">
                <span className="shimmer shimmer-lg" />
              </div>
            </div>
          ) : payouts.length === 0 ? (
            <EmptyState icon={Wallet} title="No payouts yet" />
          ) : (
            <div className="list">
              {payouts.map((payout) => {
                const negative = Number(payout.total_amount) < 0
                const cash = Number(payout.cash_owed_to_admin || 0)
                const title =
                  payout.status === 'paid'
                    ? `Paid · ${formatShortDate(payout.paid_at || payout.created_at)}${
                        payout.payment_method ? ` · ${payoutMethodLabel(payout.payment_method)}` : ''
                      }`
                    : 'Pending'
                return (
                  <div key={payout.id} className="row">
                    <span className="t">{title}</span>
                    <span className="s">
                      Trip earnings {usd(payout.trip_earnings)} · Tips {usd(payout.tip_earnings)}
                      {cash !== 0 ? ` · cash owed −${usd(cash)}` : ''}
                    </span>
                    <span className={`a${negative ? ' neg' : ''}`}>
                      <b>{usd(payout.total_amount)}</b>
                      {negative ? <small>you owe Welson</small> : null}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
