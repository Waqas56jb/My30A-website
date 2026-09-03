import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingBasket } from 'lucide-react'
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
  statusLabel,
  statusPill,
  usd,
} from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

const PACKAGES = [
  { value: 'Essentials', fee: 149, label: 'Essentials · $149' },
  { value: 'Full pack', fee: 229, label: 'Full pack · $229' },
  { value: 'Custom', fee: 0, label: 'Custom' },
]

function monthStart() {
  return `${chicagoToday().slice(0, 8)}01`
}

function emptyOrderForm(shopperId = '') {
  return {
    guest_name: '',
    guest_phone: '',
    delivery_address: '',
    package: 'Essentials',
    service_fee: '149',
    items: '',
    delivery_time: chicagoDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
    shopper_id: shopperId,
    payment_method: 'card_on_file',
  }
}

function parseItems(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s*[x×]\s*(.+)$/i)
      if (match) return { qty: Number(match[1]), name: match[2].trim() }
      return { qty: 1, name: line }
    })
}

function settled(order) {
  return order.status === 'delivered' || order.status === 'refunded'
}

export default function Grocery() {
  useTitle('Grocery · My30A Admin')
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  const creating = params.get('new') === '1'

  const [status, setStatus] = useState('')
  const [shopperId, setShopperId] = useState('')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(chicagoToday())

  const listPath = useMemo(() => {
    const rangeFrom = dateFrom ? chicagoDayIsoRange(dateFrom) : null
    const rangeTo = dateTo ? chicagoDayIsoRange(dateTo) : null
    return withQuery('/api/grocery', {
      status,
      shopper_id: shopperId,
      date_from: rangeFrom?.date_from,
      date_to: rangeTo?.date_to,
    })
  }, [status, shopperId, dateFrom, dateTo])

  const listQuery = useQuery(listPath)
  const usersQuery = useQuery('/api/users')
  const detailQuery = useQuery(openId ? `/api/grocery/${openId}` : null, { enabled: Boolean(openId) })

  const orders = listQuery.data || []
  const shoppers = (usersQuery.data || [])
    .filter((user) => user.is_active && (user.roles || []).includes('shopper'))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const listRow = orders.find((order) => order.id === openId)
  const order = [detailQuery.data, listRow].find((row) => row?.id === openId)

  const [form, setForm] = useState(emptyOrderForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState('')

  useEffect(() => {
    if (creating && shoppers[0]?.id && !form.shopper_id) {
      setForm((current) => ({ ...current, shopper_id: shoppers[0].id }))
    }
  }, [creating, shoppers, form.shopper_id])

  function setParam(updates) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  async function refreshAll() {
    invalidateQuery('/api/grocery')
    invalidateQuery('/api/dashboard')
    await listQuery.refetch()
    if (openId) await detailQuery.refetch()
  }

  async function createOrder(event) {
    event.preventDefault()
    setFormError('')
    const items = parseItems(form.items)
    if (!items.length) {
      setFormError('Add at least one item')
      return
    }
    setSaving(true)
    try {
      const created = await api('/api/grocery', {
        method: 'POST',
        body: {
          guest_name: form.guest_name,
          guest_phone: form.guest_phone,
          delivery_address: form.delivery_address,
          package: form.package,
          items,
          delivery_time: chicagoDateTimeToIso(form.delivery_time),
          shopper_id: form.shopper_id,
          service_fee: Number(form.service_fee),
          payment_method: form.payment_method,
        },
      })
      toast.success(`Order #${created.order_number} created`)
      setForm(emptyOrderForm(shoppers[0]?.id))
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

  return (
    <section>
      <div className="head">
        <div>
          <h1>Grocery orders</h1>
          <div className="sub">Shopper fee is calculated on the service fee only. Publix total is passed through.</div>
        </div>
        <Button className="btn" onClick={() => setParam({ new: '1' })}>
          New grocery order
        </Button>
      </div>

      <div className="filters">
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="assigned">Assigned</option>
          <option value="shopping">Shopping</option>
          <option value="on_the_way">On the way</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={shopperId} onChange={(event) => setShopperId(event.target.value)}>
          <option value="">All shoppers</option>
          {shoppers.map((shopper) => (
            <option key={shopper.id} value={shopper.id}>
              {shopper.name}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      <div className="card rise" style={{ '--i': 0 }}>
        {loading ? (
          <SkeletonTable rows={5} cols={10} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBasket}
            title="No grocery orders in this range."
            actionLabel="New grocery order"
            onAction={() => setParam({ new: '1' })}
          />
        ) : (
          <div className="content-in">
            <Table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Delivery</th>
                  <th>Shopper</th>
                  <th className="num">Service fee</th>
                  <th className="num">Publix</th>
                  <th className="num">Shopper</th>
                  <th className="num">Tip</th>
                  <th className="num">My30A</th>
                  <th>Photos</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => {
                  const done = settled(row)
                  return (
                    <tr
                      key={row.id}
                      className={`clickable${row.is_flagged ? ' flagged' : ''}`}
                      onClick={() => setParam({ open: row.id })}
                    >
                      <td data-label="Order">
                        #{row.order_number}
                        <br />
                        <small className="muted">{formatDateTime(row.delivery_time)}</small>
                      </td>
                      <td data-label="Delivery">
                        <Clip>
                          {row.package || 'Grocery'} · {row.delivery_address}
                        </Clip>
                      </td>
                      <td data-label="Shopper">{row.shopper_name || row.shopper?.name || '—'}</td>
                      <td className="num" data-label="Service fee">
                        {usd(row.service_fee)}
                      </td>
                      {done ? (
                        <>
                          <td className="num" data-label="Publix">
                            {usd(row.grocery_total, { empty: '—' })}
                          </td>
                          <td className="num" data-label="Shopper">
                            {usd(row.shopper_payout, { empty: '—' })}
                          </td>
                          <td className="num" data-label="Tip">
                            {usd(row.tip_amount)}
                          </td>
                          <td className="num" data-label="My30A">
                            {usd(row.my30ahost_amount, { empty: '—' })}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="num" data-label="Publix">
                            —
                          </td>
                          <td className="num muted" data-label="Share" colSpan={3}>
                            calculated on delivery
                          </td>
                        </>
                      )}
                      <td data-label="Photos" className="photo-links" onClick={(event) => event.stopPropagation()}>
                        {row.receipt_signed_url ? (
                          <a href={row.receipt_signed_url} target="_blank" rel="noreferrer">
                            Receipt
                          </a>
                        ) : (
                          '—'
                        )}
                        {row.kitchen_signed_url ? (
                          <>
                            {' · '}
                            <a href={row.kitchen_signed_url} target="_blank" rel="noreferrer">
                              Kitchen
                            </a>
                          </>
                        ) : null}
                      </td>
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
          </div>
        )}
      </div>

      <Drawer open={Boolean(openId)} onClose={() => setParam({ open: null })}>
        {order ? (
          <>
            <Button className="btn quiet sm" onClick={() => setParam({ open: null })} style={{ float: 'right' }}>
              Close
            </Button>
            <h2>Order #{order.order_number}</h2>
            <div className="sub">
              {order.package || 'Grocery'} · {formatDateTime(order.delivery_time)} ·{' '}
              <Pill {...statusPill(order.status)}>{statusLabel(order.status)}</Pill>
            </div>
            <div className="kv" style={{ marginTop: 14 }}>
              <span>Guest</span>
              <span>
                {order.guest_name} · {order.guest_phone}
              </span>
              <span>Delivery</span>
              <span>{order.delivery_address}</span>
              <span>Shopper</span>
              <span>{order.shopper_name || order.shopper?.name || '—'}</span>
              <span>Payment</span>
              <span>{paymentLabel(order.payment_method)}</span>
              <span>Items</span>
              <span>
                {(order.items || [])
                  .map((item) => (item.qty ? `${item.qty} × ${item.name}` : item.name || item))
                  .join(', ') || '—'}
              </span>
            </div>
            <div className="kv">
              <span>Service fee</span>
              <span className="num">{usd(order.service_fee)}</span>
              <span>Publix total</span>
              <span className="num">{usd(order.grocery_total, { empty: '—' })}</span>
              <span>Shopper payout</span>
              <span className="num">{usd(order.shopper_payout, { empty: '—' })}</span>
              <span>Tip</span>
              <span className="num">{usd(order.tip_amount)}</span>
              <span>My30A Host amount</span>
              <span className="num total">{usd(order.my30ahost_amount, { empty: '—' })}</span>
            </div>
            {order.receipt_signed_url || order.kitchen_signed_url ? (
              <div className="drawer-photos">
                {order.receipt_signed_url ? (
                  <a href={order.receipt_signed_url} target="_blank" rel="noreferrer">
                    <img src={order.receipt_signed_url} alt="Receipt" />
                  </a>
                ) : null}
                {order.kitchen_signed_url ? (
                  <a href={order.kitchen_signed_url} target="_blank" rel="noreferrer">
                    <img src={order.kitchen_signed_url} alt="Kitchen" />
                  </a>
                ) : null}
              </div>
            ) : null}
            <ul className="timeline">
              {(order.status_log || []).map((entry) => (
                <li key={entry.id || `${entry.status}-${entry.created_at}`}>
                  <b>{statusLabel(entry.status)}</b> · {formatDateTime(entry.created_at)}
                </li>
              ))}
            </ul>
            <div className="actions" style={{ marginTop: 18 }}>
              {order.is_flagged ? (
                <Button
                  className="btn quiet"
                  pending={working === `/api/grocery/${order.id}/unflag`}
                  onClick={() => act(`/api/grocery/${order.id}/unflag`, undefined, 'Unflagged')}
                >
                  Unflag
                </Button>
              ) : (
                <Button
                  className="btn quiet"
                  pending={working === `/api/grocery/${order.id}/flag`}
                  onClick={() =>
                    act(`/api/grocery/${order.id}/flag`, { reason: 'MANUAL' }, 'Flagged for review')
                  }
                >
                  Flag
                </Button>
              )}
              {['assigned', 'shopping', 'on_the_way'].includes(order.status) ? (
                <Button
                  className="btn quiet"
                  pending={working === `/api/grocery/${order.id}/cancel`}
                  onClick={() => act(`/api/grocery/${order.id}/cancel`, undefined, 'Cancelled')}
                >
                  Cancel
                </Button>
              ) : null}
              {order.status === 'delivered' ? (
                <Button
                  className="btn danger"
                  pending={working === `/api/grocery/${order.id}/refund`}
                  onClick={() => {
                    if (window.confirm('Refund this order?')) {
                      act(`/api/grocery/${order.id}/refund`, undefined, 'Refunded')
                    }
                  }}
                >
                  Refund
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">Loading order…</p>
        )}
      </Drawer>

      <Modal open={creating} onClose={() => setParam({ new: null })} title="New grocery order">
        <form onSubmit={createOrder}>
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
          <div className="field">
            <label>Delivery address</label>
            <input
              value={form.delivery_address}
              onChange={(event) => setForm({ ...form, delivery_address: event.target.value })}
              required
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Package</label>
              <select
                value={form.package}
                onChange={(event) => {
                  const pack = PACKAGES.find((row) => row.value === event.target.value)
                  setForm({
                    ...form,
                    package: event.target.value,
                    service_fee: pack?.fee ? String(pack.fee) : form.service_fee,
                  })
                }}
              >
                {PACKAGES.map((pack) => (
                  <option key={pack.value} value={pack.value}>
                    {pack.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Service fee</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.service_fee}
                onChange={(event) => setForm({ ...form, service_fee: event.target.value })}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>Items (one per line, "qty × item")</label>
            <textarea
              rows="4"
              placeholder={'2 × oat milk\n1 × dozen eggs'}
              value={form.items}
              onChange={(event) => setForm({ ...form, items: event.target.value })}
              required
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Delivery time</label>
              <input
                type="datetime-local"
                value={form.delivery_time}
                onChange={(event) => setForm({ ...form, delivery_time: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Shopper</label>
              <select
                value={form.shopper_id}
                onChange={(event) => setForm({ ...form, shopper_id: event.target.value })}
                required
              >
                <option value="">Select</option>
                {shoppers.map((shopper) => (
                  <option key={shopper.id} value={shopper.id}>
                    {shopper.name}
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
              <option value="card">Card on the spot</option>
            </select>
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
