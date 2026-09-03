import { useNavigate } from 'react-router-dom'
import { Car, Flag, Plus, Wallet } from 'lucide-react'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable, { SkeletonStats } from '../components/Skeleton.jsx'
import StatCard from '../components/StatCard.jsx'
import Table, { Clip, RowChevron } from '../components/Table.jsx'
import {
  chicagoDateLine,
  errorMessage,
  flagLabel,
  formatTime,
  primaryWorkerRole,
  roleLabel,
  transferRoute,
  usd,
} from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { useQuery } from '../lib/useQuery.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, error, loading } = useQuery('/api/dashboard')
  useTitle('Today · My30A Admin')

  const summary = data?.summary
  const owed = data?.owed || []
  const upcoming = data?.upcoming || []
  const waiting = owed.filter((row) => Number(row.summary?.total_amount || 0) !== 0)
  const owedPositive = owed.filter((row) => Number(row.summary?.total_amount || 0) > 0)
  const owedWaitingTotal = owedPositive.reduce(
    (sum, row) => sum + Number(row.summary.total_amount || 0),
    0
  )
  const pendingPayoutTotal = owed.reduce((sum, row) => sum + Number(row.pending_total || 0), 0)
  const pendingPayoutCount = owed.reduce((sum, row) => sum + Number(row.pending_count || 0), 0)
  const owedTotal = owedWaitingTotal + pendingPayoutTotal
  const flaggedRows = [
    ...(data?.flagged_transfers || []).map((trip) => ({
      key: `t-${trip.id}`,
      label: `#${trip.trip_number} · ${transferRoute(trip)}`,
      reason: flagLabel(trip.flag_reason),
      extra:
        trip.flag_reason === 'CASH_MISMATCH'
          ? `Expected ${usd(trip.cash_expected)} · reported ${usd(trip.cash_reported)}`
          : trip.driver_name || '',
      href: `/transfers?open=${trip.id}`,
    })),
    ...(data?.flagged_grocery || []).map((order) => ({
      key: `g-${order.id}`,
      label: `#${order.order_number} · ${order.package || 'Grocery'}`,
      reason: flagLabel(order.flag_reason),
      extra: order.shopper_name || order.delivery_address || '',
      href: `/grocery?open=${order.id}`,
    })),
  ]
  const reviewCount = flaggedRows.length
  const customerCharges =
    Number(summary?.customer_charge || 0) +
    Number(summary?.grocery_service_fee || 0) +
    Number(summary?.grocery_total || 0)

  return (
    <section>
      <div className="head">
        <div>
          <h1>Today</h1>
          <div className="sub">{chicagoDateLine()}</div>
        </div>
        <div className="head-actions">
          <Button className="btn ghost" onClick={() => navigate('/transfers?new=1')}>
            <Plus size={18} /> New transfer
          </Button>
          <Button className="btn ghost" onClick={() => navigate('/grocery?new=1')}>
            <Plus size={18} /> New grocery order
          </Button>
        </div>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      {loading || !summary ? (
        <SkeletonStats />
      ) : (
        <div className="grid stats">
          <StatCard
            style={{ '--i': 0 }}
            label="Customer charges"
            amount={customerCharges}
            detail={`${summary.transfer_count} transfers · ${summary.grocery_count} grocery orders`}
          />
          <StatCard
            style={{ '--i': 1 }}
            label="My30A Host amount"
            amount={summary.my30ahost_amount}
            detail="after driver, owner and shopper shares"
          />
          <StatCard
            style={{ '--i': 2 }}
            label="Owed to staff"
            amount={owedTotal}
            detail={`${owedPositive.length} waiting · ${pendingPayoutCount} pending payouts`}
          />
          <StatCard
            style={{ '--i': 3 }}
            label="Needs review"
            count={reviewCount}
            suffix={reviewCount === 1 ? ' item' : ' items'}
            detail="flagged transfers and grocery orders"
            flagged={reviewCount > 0}
          />
        </div>
      )}

      <div className="grid panels" style={{ marginTop: 16 }}>
        <div className="card rise" style={{ '--i': 4 }}>
          <h3 style={{ marginBottom: 10 }}>Flagged for review</h3>
          {loading ? (
            <SkeletonTable rows={3} cols={3} />
          ) : flaggedRows.length === 0 ? (
            <EmptyState icon={Flag} title="Nothing flagged." />
          ) : (
            <div className="content-in">
              <Table>
                <tbody>
                  {flaggedRows.map((row) => (
                    <tr
                      key={row.key}
                      className="clickable flagged"
                      onClick={() => navigate(row.href)}
                    >
                      <td data-label="Item">
                        <Clip>{row.label}</Clip>
                      </td>
                      <td data-label="Reason">
                        <Pill warn>{row.reason}</Pill>
                      </td>
                      <td className="num" data-label="Detail">
                        <Clip>{row.extra}</Clip>
                      </td>
                      <RowChevron />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>

        <div className="card rise" style={{ '--i': 5 }}>
          <h3 style={{ marginBottom: 10 }}>Waiting for payout</h3>
          {loading ? (
            <SkeletonTable rows={3} cols={3} />
          ) : waiting.length === 0 ? (
            <EmptyState icon={Wallet} title="No balances right now." />
          ) : (
            <div className="content-in">
              <Table>
                <tbody>
                  {waiting.map((row) => {
                    const net = Number(row.summary.total_amount || 0)
                    return (
                      <tr
                        key={row.user.id}
                        className="clickable"
                        onClick={() => navigate(`/payouts?user=${row.user.id}`)}
                      >
                        <td data-label="Person">
                          {row.user.name}{' '}
                          <Pill neutral>{roleLabel(primaryWorkerRole(row.user.roles))}</Pill>
                        </td>
                        <td className="num" data-label="Amount">
                          {net < 0 ? (
                            <span className="flag">
                              {usd(Math.abs(net))} owes you
                            </span>
                          ) : (
                            usd(net)
                          )}
                        </td>
                        <td data-label="">
                          <Button
                            className="btn sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/payouts?user=${row.user.id}`)
                            }}
                          >
                            Pay
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </div>

        <div className="card rise" style={{ '--i': 6 }}>
          <h3 style={{ marginBottom: 10 }}>Upcoming transfers</h3>
          {loading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No transfers scheduled today."
              actionLabel="New transfer"
              onAction={() => navigate('/transfers?new=1')}
            />
          ) : (
            <div className="content-in">
              <Table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Trip</th>
                    <th>Route</th>
                    <th>Driver · Vehicle</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((trip) => {
                    const extras = [
                      trip.passengers ? `${trip.passengers} pax` : null,
                      trip.bags ? `${trip.bags} bags` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <tr
                        key={trip.id}
                        className="clickable"
                        onClick={() => navigate(`/transfers?open=${trip.id}`)}
                      >
                        <td data-label="Time">{formatTime(trip.scheduled_at)}</td>
                        <td data-label="Trip">#{trip.trip_number}</td>
                        <td data-label="Route">
                          <Clip>
                            {transferRoute(trip)}
                            {extras ? ` · ${extras}` : ''}
                          </Clip>
                        </td>
                        <td data-label="Driver">
                          <Clip>
                            {trip.driver_name || 'Unassigned'}
                            {trip.vehicle_label ? ` · ${trip.vehicle_label}` : ''}
                          </Clip>
                        </td>
                        <RowChevron />
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
