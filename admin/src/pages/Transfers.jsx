import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Car } from 'lucide-react'
import Button from '../components/Button.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import Table, { Clip, RowChevron } from '../components/Table.jsx'
import { useToast } from '../components/Toast.jsx'
import { api, withQuery } from '../lib/api.js'
import {
  chicagoDateTimeToIso,
  chicagoDatetimeLocal,
  chicagoDayIsoRange,
  chicagoToday,
  errorMessage,
  flagLabel,
  formatDateTime,
  paymentLabel,
  splitShares,
  statusLabel,
  statusPill,
  transferRoute,
  usd,
  vehicleTypeLabel,
} from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

const AIRPORTS = [
  { value: 'ECP', label: 'ECP · Panama City' },
  { value: 'VPS', label: 'VPS · Destin' },
  { value: 'PNS', label: 'PNS · Pensacola' },
]

const VEHICLE_TYPES = [
  { value: '4pax', label: 'Car · 4 pax' },
  { value: '6pax', label: 'SUV · 6 pax' },
  { value: '14pax', label: 'Van · 14 pax' },
]

function monthStart() {
  return `${chicagoToday().slice(0, 8)}01`
}

function emptyTripForm(communityId = '') {
  return {
    guest_name: '',
    guest_phone: '',
    community_id: communityId,
    airport: 'ECP',
    direction: 'from_airport',
    vehicle_type: '4pax',
    custom_price: '',
    use_custom: false,
    pickup_address: '',
    dropoff_address: '',
    scheduled_at: chicagoDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
    flight_number: '',
    passengers: '2',
    bags: '2',
    driver_id: '',
    vehicle_id: '',
    payment_method: 'card_on_file',
    notes: '',
  }
}

function SplitBar({ driver, owner, host }) {
  const shares = splitShares(driver, owner, host)
  if (!shares) return <span className="muted">—</span>
  return (
    <div className="split" title="Driver / owner / My30A Host">
      {shares.driver > 0 ? <i className="s-driver" style={{ width: `${shares.driver}%` }} /> : null}
      {shares.owner > 0 ? <i className="s-owner" style={{ width: `${shares.owner}%` }} /> : null}
      {shares.host > 0 ? <i className="s-host" style={{ width: `${shares.host}%` }} /> : null}
    </div>
  )
}

function settled(trip) {
  return trip.status === 'completed' || trip.status === 'refunded'
}

function driverEarningsNote(trip) {
  const snap = trip.comp_snapshot
  if (!snap) return null
  if (snap.driver_is_admin) return 'admin · $0'
  if (snap.driver_is_owner) return 'drives own vehicle'
  const agreement = snap.agreement
  if (!agreement) return null
  if (agreement.type === 'fixed') return `fixed ${usd(agreement.value)}`
  if (agreement.type === 'percentage') return `${agreement.value}% of trip`
  if (agreement.type === 'hourly') return `${usd(agreement.value)} per hour`
  return null
}

export default function Transfers() {
  useTitle('Transfers · My30A Admin')
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  const creating = params.get('new') === '1'

  const [status, setStatus] = useState('')
  const [driverId, setDriverId] = useState('')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(chicagoToday())
  const [flaggedOnly, setFlaggedOnly] = useState(false)

  const listPath = useMemo(() => {
    const rangeFrom = dateFrom ? chicagoDayIsoRange(dateFrom) : null
    const rangeTo = dateTo ? chicagoDayIsoRange(dateTo) : null
    return withQuery('/api/transfers', {
      status,
      driver_id: driverId,
      is_flagged: flaggedOnly ? 'true' : '',
      date_from: rangeFrom?.date_from,
      date_to: rangeTo?.date_to,
    })
  }, [status, driverId, dateFrom, dateTo, flaggedOnly])

  const listQuery = useQuery(listPath)
  const usersQuery = useQuery('/api/users')
  const vehiclesQuery = useQuery('/api/vehicles')
  const communitiesQuery = useQuery('/api/communities')
  const detailQuery = useQuery(openId ? `/api/transfers/${openId}` : null, { enabled: Boolean(openId) })

  const trips = listQuery.data || []
  const drivers = (usersQuery.data || [])
    .filter((user) => user.is_active && (user.roles || []).some((role) => ['driver', 'partner', 'admin'].includes(role)))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const vehicles = (vehiclesQuery.data || []).filter((vehicle) => vehicle.status !== 'inactive')
  const communities = communitiesQuery.data || []
  const listRow = trips.find((trip) => trip.id === openId)
  const trip = [detailQuery.data, listRow].find((row) => row?.id === openId)

  const [form, setForm] = useState(emptyTripForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState('')
  const [tablePrice, setTablePrice] = useState(null)
  const lastCommunityId = useRef('')

  function setParam(updates) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (creating && communities[0]?.id && !form.community_id) {
      const first = communities[0]
      setForm((current) => ({
        ...current,
        community_id: first.id,
        airport: first.default_airport || current.airport,
      }))
    }
  }, [creating, communities, form.community_id])

  useEffect(() => {
    if (!creating) {
      lastCommunityId.current = ''
      return undefined
    }
    if (!form.community_id) return undefined
    if (lastCommunityId.current === form.community_id) return undefined
    lastCommunityId.current = form.community_id
    const community = communities.find((row) => row.id === form.community_id)
    if (community?.default_airport) {
      setForm((current) => ({ ...current, airport: community.default_airport }))
    }
    return undefined
  }, [creating, form.community_id, communities])

  useEffect(() => {
    if (!creating) return undefined
    const community = communities.find((row) => row.id === form.community_id)?.name || ''
    setForm((current) => {
      const next = { ...current }
      if (current.direction === 'from_airport') {
        if (!current.pickup_address) next.pickup_address = current.airport
        if (!current.dropoff_address && community) next.dropoff_address = community
      } else {
        if (!current.pickup_address && community) next.pickup_address = community
        if (!current.dropoff_address) next.dropoff_address = current.airport
      }
      return next
    })
  }, [creating, form.community_id, form.airport, form.direction, communities])

  useEffect(() => {
    if (!creating || !form.community_id || !form.airport || !form.vehicle_type) return undefined
    let cancelled = false
    api(
      withQuery('/api/communities/pricing', {
        community_id: form.community_id,
        airport: form.airport,
        vehicle_type: form.vehicle_type,
      })
    )
      .then((row) => {
        if (!cancelled) setTablePrice(row)
      })
      .catch(() => {
        if (!cancelled) setTablePrice(null)
      })
    return () => {
      cancelled = true
    }
  }, [creating, form.community_id, form.airport, form.vehicle_type])

  function fillAddresses(next) {
    const community = communities.find((row) => row.id === next.community_id)
    const airport = next.airport
    const place = community?.name || ''
    if (next.direction === 'from_airport') {
      return {
        ...next,
        pickup_address: next.pickup_address || airport,
        dropoff_address: next.dropoff_address || place,
      }
    }
    return {
      ...next,
      pickup_address: next.pickup_address || place,
      dropoff_address: next.dropoff_address || airport,
    }
  }

  async function refreshAll() {
    invalidateQuery('/api/transfers')
    invalidateQuery('/api/dashboard')
    await listQuery.refetch()
    if (openId) await detailQuery.refetch()
  }

  async function createTrip(event) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const filled = fillAddresses(form)
      const created = await api('/api/transfers', {
        method: 'POST',
        body: {
          guest_name: filled.guest_name,
          guest_phone: filled.guest_phone,
          pickup_address: filled.pickup_address,
          dropoff_address: filled.dropoff_address,
          community_id: filled.community_id,
          airport: filled.airport,
          direction: filled.direction,
          vehicle_type: filled.vehicle_type,
          passengers: Number(filled.passengers),
          bags: Number(filled.bags),
          scheduled_at: chicagoDateTimeToIso(filled.scheduled_at),
          driver_id: filled.driver_id,
          vehicle_id: filled.vehicle_id,
          payment_method: filled.payment_method,
          flight_number: filled.flight_number || undefined,
          notes: filled.notes || undefined,
          custom_price: filled.use_custom ? filled.custom_price : undefined,
        },
      })
      toast.success(`Trip #${created.trip_number} created`)
      setForm(emptyTripForm(communities[0]?.id))
      await refreshAll()
      setParam({ new: null, open: created.id })
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function act(path, body, ok) {
    setWorking(path)
    try {
      await api(path, { method: 'POST', body })
      toast.success(ok)
      await refreshAll()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setWorking('')
    }
  }

  const loading = listQuery.loading
  const error = listQuery.error
  const matchingVehicles = vehicles.filter((vehicle) => vehicle.vehicle_type === form.vehicle_type)
  const communityName = communities.find((row) => row.id === form.community_id)?.name || 'Community'

  return (
    <section>
      <div className="head">
        <div>
          <h1>Transfers</h1>
          <div className="sub">Every trip with its full money breakdown</div>
        </div>
        <Button className="btn" onClick={() => setParam({ new: '1' })}>
          New transfer
        </Button>
      </div>

      <div className="filters">
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="assigned">Assigned</option>
          <option value="started">Started</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={driverId} onChange={(event) => setDriverId(event.target.value)}>
          <option value="">All drivers</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <label className="checks" style={{ margin: 0 }}>
          <label>
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(event) => setFlaggedOnly(event.target.checked)}
            />
            Flagged only
          </label>
        </label>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      <div className="card rise" style={{ '--i': 0 }}>
        {loading ? (
          <SkeletonTable rows={6} cols={10} />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No transfers in this range."
            actionLabel="New transfer"
            onAction={() => setParam({ new: '1' })}
          />
        ) : (
          <div className="content-in">
            <Table>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Route</th>
                  <th>Driver · Vehicle</th>
                  <th className="num">Customer</th>
                  <th className="num">Driver</th>
                  <th className="num">Tip</th>
                  <th className="num">Owner</th>
                  <th className="num">My30A</th>
                  <th>Split</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trips.map((row) => {
                  const done = settled(row)
                  return (
                    <tr
                      key={row.id}
                      className={`clickable${row.is_flagged ? ' flagged' : ''}`}
                      onClick={() => setParam({ open: row.id })}
                    >
                      <td data-label="Trip">
                        #{row.trip_number}
                        {row.is_custom_price ? (
                          <>
                            {' '}
                            <Pill sand>Custom price</Pill>
                          </>
                        ) : null}
                        <br />
                        <small className="muted">{formatDateTime(row.scheduled_at)}</small>
                      </td>
                      <td data-label="Route">
                        <Clip>{transferRoute(row)}</Clip>
                      </td>
                      <td data-label="Driver">
                        {row.driver_name || 'Unassigned'}
                        <br />
                        <small className="muted">{row.vehicle_label || '—'}</small>
                      </td>
                      <td className="num" data-label="Customer">
                        {usd(row.customer_charge)}
                      </td>
                      {done ? (
                        <>
                          <td className="num" data-label="Driver">
                            {usd(row.driver_payout, { empty: '—' })}
                          </td>
                          <td className="num" data-label="Tip">
                            {usd(row.tip_amount)}
                          </td>
                          <td className="num" data-label="Owner">
                            {usd(row.owner_fee, { empty: '—' })}
                          </td>
                          <td className="num" data-label="My30A">
                            {usd(row.my30ahost_amount, { empty: '—' })}
                          </td>
                          <td data-label="Split">
                            <SplitBar
                              driver={row.driver_payout}
                              owner={row.owner_fee}
                              host={row.my30ahost_amount}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="num muted" data-label="Share" colSpan={4}>
                            calculated on completion
                          </td>
                          <td data-label="Split">—</td>
                        </>
                      )}
                      <td data-label="Status">
                        {row.is_flagged ? (
                          <Pill warn>{flagLabel(row.flag_reason)}</Pill>
                        ) : (
                          <Pill {...statusPill(row.status)}>{statusLabel(row.status)}</Pill>
                        )}
                      </td>
                      <RowChevron />
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <div className="legend">
              <span>
                <i className="s-driver" />
                Driver
              </span>
              <span>
                <i className="s-owner" />
                Vehicle owner
              </span>
              <span>
                <i className="s-host" />
                My30A Host
              </span>
              <span style={{ marginLeft: 'auto' }}>Tips are never part of the split — 100% to the driver</span>
            </div>
          </div>
        )}
      </div>

      <Drawer open={Boolean(openId)} onClose={() => setParam({ open: null })}>
        {trip ? (
          <>
            <Button className="btn quiet sm" onClick={() => setParam({ open: null })} style={{ float: 'right' }}>
              Close
            </Button>
            <h2>Trip #{trip.trip_number}</h2>
            <div className="sub">
              {transferRoute(trip)} · {formatDateTime(trip.scheduled_at)} ·{' '}
              <Pill {...statusPill(trip.status)}>{statusLabel(trip.status)}</Pill>
            </div>
            <div className="kv" style={{ marginTop: 14 }}>
              <span>Guest</span>
              <span>
                {trip.guest_name} · {trip.guest_phone}
              </span>
              <span>Pickup</span>
              <span>{trip.pickup_address}</span>
              <span>Drop-off</span>
              <span>{trip.dropoff_address}</span>
              <span>Passengers</span>
              <span>
                {trip.passengers || 0}
                {trip.bags ? ` · ${trip.bags} bags` : ''}
                {trip.flight_number ? ` · ${trip.flight_number}` : ''}
              </span>
              <span>Driver</span>
              <span>{trip.driver_name || trip.driver?.name || '—'}</span>
              <span>Vehicle</span>
              <span>
                {trip.vehicle_label || '—'}
                {trip.vehicle_owner?.name ? ` · owner ${trip.vehicle_owner.name}` : ''}
              </span>
              <span>Payment</span>
              <span>
                {paymentLabel(trip.payment_method)}
                {trip.cash_reported != null ? ` · reported ${usd(trip.cash_reported)}` : ''}
              </span>
            </div>
            <div className="kv">
              <span>Customer charge</span>
              <span className="num">
                {usd(trip.customer_charge)}
                {trip.is_custom_price ? (
                  <>
                    {' '}
                    <Pill sand>Custom price</Pill>
                  </>
                ) : null}
              </span>
              <span>
                Driver trip earnings
                {(() => {
                  const note = driverEarningsNote(trip)
                  return note ? <small> ({note})</small> : null
                })()}
              </span>
              <span className="num">{settled(trip) ? usd(trip.driver_payout) : '—'}</span>
              <span>Driver tip</span>
              <span className="num">{settled(trip) ? usd(trip.tip_amount) : '—'}</span>
              <span>
                Vehicle owner fee
                {trip.owner_fee_percent_snapshot != null ? (
                  <small> ({trip.owner_fee_percent_snapshot}%)</small>
                ) : null}
              </span>
              <span className="num">{settled(trip) ? usd(trip.owner_fee) : '—'}</span>
              <span>My30A Host amount</span>
              <span className="num total">{settled(trip) ? usd(trip.my30ahost_amount) : '—'}</span>
            </div>
            {trip.payment_method === 'cash' && trip.status === 'completed' ? (
              <div className="kv">
                <span>Cash reconciliation</span>
                <span></span>
                <span>Driver keeps</span>
                <span className="num">
                  {usd((Number(trip.driver_payout) || 0) + (Number(trip.tip_amount) || 0))}
                </span>
                <span>Driver owes you</span>
                <span className="num">
                  {usd((Number(trip.cash_reported) || 0) - ((Number(trip.driver_payout) || 0) + (Number(trip.tip_amount) || 0)))}
                </span>
              </div>
            ) : null}
            <ul className="timeline">
              {(trip.status_log || []).length === 0 && detailQuery.loading ? (
                <li>Loading timeline…</li>
              ) : (
                (trip.status_log || []).map((entry) => (
                  <li key={entry.id || `${entry.status}-${entry.created_at}`}>
                    <b>{statusLabel(entry.status)}</b> · {formatDateTime(entry.created_at)}
                  </li>
                ))
              )}
            </ul>
            <div className="actions" style={{ marginTop: 18 }}>
              {trip.is_flagged ? (
                <Button
                  className="btn quiet"
                  pending={working === `/api/transfers/${trip.id}/unflag`}
                  onClick={() => act(`/api/transfers/${trip.id}/unflag`, undefined, 'Unflagged')}
                >
                  Unflag
                </Button>
              ) : (
                <Button
                  className="btn quiet"
                  pending={working === `/api/transfers/${trip.id}/flag`}
                  onClick={() =>
                    act(`/api/transfers/${trip.id}/flag`, { reason: 'MANUAL' }, 'Flagged for review')
                  }
                >
                  Flag
                </Button>
              )}
              {['assigned', 'started'].includes(trip.status) ? (
                <Button
                  className="btn quiet"
                  pending={working === `/api/transfers/${trip.id}/cancel`}
                  onClick={() => act(`/api/transfers/${trip.id}/cancel`, undefined, 'Cancelled')}
                >
                  Cancel
                </Button>
              ) : null}
              {trip.status === 'completed' ? (
                <Button
                  className="btn danger"
                  pending={working === `/api/transfers/${trip.id}/refund`}
                  onClick={() => {
                    if (window.confirm('Refund this trip?')) {
                      act(`/api/transfers/${trip.id}/refund`, undefined, 'Refunded')
                    }
                  }}
                >
                  Refund
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">Loading trip…</p>
        )}
      </Drawer>

      <Modal
        open={creating}
        onClose={() => setParam({ new: null })}
        title="New transfer"
      >
        <form onSubmit={createTrip}>
          <div className="row2">
            <div className="field">
              <label>Guest name</label>
              <input
                value={form.guest_name}
                onChange={(event) => setForm({ ...form, guest_name: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Guest phone</label>
              <input
                value={form.guest_phone}
                onChange={(event) => setForm({ ...form, guest_phone: event.target.value })}
                required
              />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Community</label>
              <select
                value={form.community_id}
                onChange={(event) => {
                  const communityId = event.target.value
                  const community = communities.find((row) => row.id === communityId)
                  lastCommunityId.current = communityId
                  setForm({
                    ...form,
                    community_id: communityId,
                    airport: community?.default_airport || form.airport,
                  })
                }}
                required
              >
                <option value="">Select</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Airport</label>
              <select
                value={form.airport}
                onChange={(event) => setForm({ ...form, airport: event.target.value })}
              >
                {AIRPORTS.map((airport) => (
                  <option key={airport.value} value={airport.value}>
                    {airport.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Direction</label>
              <select
                value={form.direction}
                onChange={(event) => setForm({ ...form, direction: event.target.value })}
              >
                <option value="from_airport">Airport → community</option>
                <option value="to_airport">Community → airport</option>
              </select>
            </div>
            <div className="field">
              <label>Vehicle type</label>
              <select
                value={form.vehicle_type}
                onChange={(event) => setForm({ ...form, vehicle_type: event.target.value, vehicle_id: '' })}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="price-box">
            <span>
              Price from table
              <br />
              <small>
                {communityName} · {form.airport} · {vehicleTypeLabel(form.vehicle_type)}
              </small>
            </span>
            <b>{tablePrice?.base_price != null ? usd(tablePrice.base_price) : '—'}</b>
            <Button
              className="btn quiet sm"
              onClick={() => setForm({ ...form, use_custom: !form.use_custom })}
            >
              {form.use_custom ? 'Use table price' : 'Use custom price'}
            </Button>
          </div>
          {form.use_custom ? (
            <div className="field">
              <label>Custom price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.custom_price}
                onChange={(event) => setForm({ ...form, custom_price: event.target.value })}
                required
              />
            </div>
          ) : null}
          <div className="field">
            <label>Pickup address</label>
            <input
              value={form.pickup_address}
              onChange={(event) => setForm({ ...form, pickup_address: event.target.value })}
              placeholder={form.direction === 'from_airport' ? form.airport : communityName}
              required
            />
          </div>
          <div className="field">
            <label>Drop-off address</label>
            <input
              value={form.dropoff_address}
              onChange={(event) => setForm({ ...form, dropoff_address: event.target.value })}
              placeholder={form.direction === 'from_airport' ? communityName : form.airport}
              required
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Date & time</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Flight number</label>
              <input
                value={form.flight_number}
                onChange={(event) => setForm({ ...form, flight_number: event.target.value })}
              />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Passengers</label>
              <input
                type="number"
                min="1"
                value={form.passengers}
                onChange={(event) => setForm({ ...form, passengers: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Bags</label>
              <input
                type="number"
                min="0"
                value={form.bags}
                onChange={(event) => setForm({ ...form, bags: event.target.value })}
                required
              />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Driver</label>
              <select
                value={form.driver_id}
                onChange={(event) => setForm({ ...form, driver_id: event.target.value })}
                required
              >
                <option value="">Select</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vehicle</label>
              <select
                value={form.vehicle_id}
                onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
                required
              >
                <option value="">Select</option>
                {matchingVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.make} {vehicle.model} · {vehicleTypeLabel(vehicle.vehicle_type, vehicle.capacity)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Payment</label>
            <select
              value={form.payment_method}
              onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
            >
              <option value="card_on_file">Card on file</option>
              <option value="cash">Cash on the spot</option>
              <option value="card">Card on the spot</option>
            </select>
          </div>
          <div className="field">
            <label>Notes for driver</label>
            <textarea
              rows="2"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="actions">
            <Button className="btn quiet" onClick={() => setParam({ new: null })}>
              Cancel
            </Button>
            <Button type="submit" className="btn" pending={saving}>
              Create and assign
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
