import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Check, Phone, ShoppingBasket } from 'lucide-react'
import BottomSheet from '../../components/BottomSheet.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import EarningsStrip, { EarningsStripSkeleton } from '../../components/EarningsStrip.jsx'
import { usePageHeader } from '../../components/Layout.jsx'
import Spinner from '../../components/Spinner.jsx'
import { useToast } from '../../components/Toast.jsx'
import { api, apiUpload, withQuery } from '../../lib/api.js'
import {
  addChicagoDays,
  chicagoShortDateLine,
  chicagoToday,
  errorMessage,
  formatDuration,
  formatPhone,
  formatTime,
  telHref,
  usd,
} from '../../lib/format.js'
import { invalidateQuery, useQuery } from '../../lib/useQuery.js'
import { useTitle } from '../../lib/useTitle.js'

const STEPS = [
  { id: 'shopping', label: 'Shopping' },
  { id: 'on_the_way', label: 'On the way' },
  { id: 'delivered', label: 'Delivered' },
]

const STEP_INDEX = { shopping: 0, on_the_way: 1, delivered: 2 }

function visibleOrders(orders) {
  return (orders || []).filter((order) => order.status !== 'cancelled' && order.status !== 'refunded')
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  return items.map((item, index) => {
    if (typeof item === 'string') return { key: index, name: item, qty: 1 }
    return {
      key: index,
      name: item.name || item.item || item.title || 'Item',
      qty: Number(item.qty ?? item.quantity ?? 1) || 1,
    }
  })
}

function packageLabel(order) {
  const raw = order.package || 'Package'
  const named = /pack/i.test(raw) ? raw : `${raw} pack`
  const count = normalizeItems(order.items).length
  if (!count) return named
  return `${named} · ${count} item${count === 1 ? '' : 's'}`
}

function photoUrls(order) {
  return [order.receipt_signed_url, order.kitchen_signed_url].filter(
    (url) => typeof url === 'string' && /^https?:\/\//i.test(url)
  )
}

function statusLabel(order) {
  if (order.status === 'assigned') return 'Assigned'
  if (order.status === 'shopping') return 'Shopping'
  if (order.status === 'on_the_way') return 'On the way'
  if (order.status === 'delivered') {
    const duration = formatDuration(order.started_at, order.delivered_at)
    return duration ? `Delivered · ${duration}` : 'Delivered'
  }
  return order.status || '—'
}

function pillClass(status) {
  if (status === 'shopping' || status === 'on_the_way') return 'pill live'
  if (status === 'delivered') return 'pill done'
  return 'pill'
}

function nextOrderLabel(order) {
  if (!order) return 'No upcoming orders'
  if (order.status === 'shopping') return 'Order in progress'
  if (order.status === 'on_the_way') return 'On the way now'
  return `Next ${formatTime(order.delivery_time)}`
}

function FilePick({ id, label, file, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <label className={`upload${file ? ' ok' : ''}`}>
        <input
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
        />
        {file ? (
          <>
            <Check size={16} strokeWidth={2.2} /> {file.name}
          </>
        ) : (
          <>
            <Camera size={16} strokeWidth={1.85} /> Take photo
          </>
        )}
      </label>
    </div>
  )
}

function OrderCard({
  order,
  tomorrow,
  checks,
  pending,
  onToggleItem,
  onStart,
  onWay,
  onDeliver,
}) {
  const items = normalizeItems(order.items)
  const checked = items.filter((_, index) => checks[order.id]?.[index]).length
  const showSteps = order.status === 'shopping' || order.status === 'on_the_way'
  const showList = items.length > 0 && order.status !== 'delivered'
  const currentStep = STEP_INDEX[order.status]
  const call = telHref(order.guest_phone)
  const photos = photoUrls(order)
  const tipValue = order.status === 'delivered' ? usd(order.tip_amount) : order.tip_amount ? usd(order.tip_amount) : '—'
  const timeLabel = tomorrow ? `Tomorrow ${formatTime(order.delivery_time)}` : formatTime(order.delivery_time)

  return (
    <article className={`order${order.status === 'delivered' ? ' done' : ''}`}>
      <div className="hd">
        <div>
          <span className="time">{timeLabel}</span>{' '}
          <span className="num">· Order #{order.order_number}</span>
        </div>
        <span className={pillClass(order.status)}>{statusLabel(order)}</span>
      </div>
      <div className="pkg">{packageLabel(order)}</div>
      <div className="meta">
        Deliver to <b>{order.delivery_address || 'Address'}</b>
        {order.door_code ? ` · door code ${order.door_code}` : ''}
      </div>
      {order.guest_name || call ? (
        <div className="guest">
          <span>{order.guest_name || 'Guest'}</span>
          {call ? (
            <a className="guest-call" href={call}>
              <Phone size={16} strokeWidth={1.85} /> Call {formatPhone(order.guest_phone)}
            </a>
          ) : null}
        </div>
      ) : null}

      {showSteps ? (
        <>
          <div className="steps">
            {STEPS.map((step, index) => (
              <span key={step.id} className={`step${currentStep >= index ? ' on' : ''}`} />
            ))}
          </div>
          <div className="steps-l">
            {STEPS.map((step, index) => (
              <span key={step.id} className={currentStep === index ? 'on' : ''}>
                {step.label}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {showList ? (
        <details open={order.status === 'shopping'}>
          <summary>
            Shopping list · {checked} of {items.length} checked
          </summary>
          <div className="items">
            {items.map((item, index) => (
              <label key={`${order.id}-${item.key}`}>
                <input
                  type="checkbox"
                  checked={Boolean(checks[order.id]?.[index])}
                  onChange={() => onToggleItem(order.id, index)}
                />
                <span className="q">{item.qty} ×</span>
                {item.name}
              </label>
            ))}
          </div>
        </details>
      ) : null}

      <div className="money">
        <div>
          <div className="l">Service earnings</div>
          <div className="v">{usd(order.shopper_payout, { digits: 2 })}</div>
        </div>
        <div className="tip">
          <div className="l">{order.status === 'delivered' ? 'Tip received' : 'Tip'}</div>
          <div className="v">{tipValue}</div>
        </div>
        {order.status === 'delivered' ? (
          <div>
            <div className="l">Total</div>
            <div className="v">{usd(order.total, { digits: 2 })}</div>
          </div>
        ) : null}
      </div>

      {order.status === 'assigned' ? (
        <button type="button" className="btn ghost" disabled={pending} onClick={() => onStart(order)}>
          {pending ? <Spinner size={16} /> : null}
          Start shopping
        </button>
      ) : null}
      {order.status === 'shopping' ? (
        <button type="button" className="btn" disabled={pending} onClick={() => onWay(order)}>
          {pending ? <Spinner size={16} /> : null}
          On the way
        </button>
      ) : null}
      {order.status === 'on_the_way' ? (
        <button type="button" className="btn" disabled={pending} onClick={() => onDeliver(order)}>
          Mark delivered
        </button>
      ) : null}

      {order.status === 'delivered' ? (
        photos.length ? (
          <div className="photos">
            {photos.map((url) => (
              <img key={url} src={url} alt="" />
            ))}
          </div>
        ) : (
          <div className="photos-fallback">Photos uploaded</div>
        )
      ) : null}
    </article>
  )
}

export default function Orders() {
  useTitle('Shopper · My30A Host')
  const toast = useToast()
  const today = chicagoToday()
  const tomorrow = addChicagoDays(today, 1)
  const todayPath = withQuery('/api/grocery/mine', { date: today })
  const tomorrowPath = withQuery('/api/grocery/mine', { date: tomorrow })
  const earningsPath = withQuery('/api/earnings/mine', { range: 'today', role: 'shopper', activeRole: 'shopper' })
  const todayQuery = useQuery(todayPath)
  const tomorrowQuery = useQuery(tomorrowPath)
  const earningsQuery = useQuery(earningsPath)

  const [checks, setChecks] = useState({})
  const [workingId, setWorkingId] = useState('')
  const [delivering, setDelivering] = useState(null)
  const [groceryTotal, setGroceryTotal] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [kitchen, setKitchen] = useState(null)
  const [sheetError, setSheetError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [updatedAt, setUpdatedAt] = useState(null)

  const todayOrders = useMemo(() => visibleOrders(todayQuery.data), [todayQuery.data])
  const tomorrowAssigned = useMemo(
    () => visibleOrders(tomorrowQuery.data).filter((order) => order.status === 'assigned'),
    [tomorrowQuery.data]
  )

  const inProgress = todayOrders.filter((order) => order.status === 'shopping' || order.status === 'on_the_way')
  const upNext = [
    ...todayOrders.filter((order) => order.status === 'assigned'),
    ...tomorrowAssigned,
  ]
  const done = todayOrders
    .filter((order) => order.status === 'delivered')
    .sort((a, b) => new Date(b.delivered_at || b.delivery_time) - new Date(a.delivered_at || a.delivery_time))

  const allToday = todayOrders
  usePageHeader(
    'Today',
    `${chicagoShortDateLine()} · ${allToday.length} order${allToday.length === 1 ? '' : 's'}`,
    { updatedAt }
  )

  const todayRefetch = useRef(todayQuery.refetch)
  const tomorrowRefetch = useRef(tomorrowQuery.refetch)
  const earningsRefetch = useRef(earningsQuery.refetch)
  todayRefetch.current = todayQuery.refetch
  tomorrowRefetch.current = tomorrowQuery.refetch
  earningsRefetch.current = earningsQuery.refetch

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return
      Promise.all([todayRefetch.current(), tomorrowRefetch.current(), earningsRefetch.current()])
        .then(() => setUpdatedAt(Date.now()))
        .catch(() => {})
    }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (!todayQuery.loading && todayQuery.data) setUpdatedAt(Date.now())
  }, [todayQuery.loading, todayQuery.data])

  function toggleItem(orderId, index) {
    setChecks((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [index]: !prev[orderId]?.[index] },
    }))
  }

  async function refreshLists() {
    invalidateQuery('/api/grocery/mine')
    invalidateQuery('/api/earnings/mine')
    await Promise.all([todayQuery.refetch(), tomorrowQuery.refetch(), earningsQuery.refetch()])
    setUpdatedAt(Date.now())
  }

  async function startShopping(order) {
    setWorkingId(order.id)
    try {
      await api(`/api/grocery/${order.id}/shopping`, { method: 'POST' })
      toast.success('Shopping started')
      await refreshLists()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setWorkingId('')
    }
  }

  async function markOnTheWay(order) {
    setWorkingId(order.id)
    try {
      await api(`/api/grocery/${order.id}/on-the-way`, { method: 'POST' })
      toast.success('On the way')
      await refreshLists()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setWorkingId('')
    }
  }

  function openDeliver(order) {
    setDelivering(order)
    setGroceryTotal('')
    setTipAmount('')
    setReceipt(null)
    setKitchen(null)
    setSheetError('')
    setUploadPct(0)
  }

  function closeSheet() {
    if (confirming) return
    setDelivering(null)
    setSheetError('')
    setReceipt(null)
    setKitchen(null)
    setGroceryTotal('')
    setTipAmount('')
  }

  async function confirmDeliver(event) {
    event.preventDefault()
    if (!delivering) return
    const total = Number(groceryTotal)
    if (groceryTotal === '' || !Number.isFinite(total) || total < 0) {
      setSheetError('Enter the Publix receipt total.')
      return
    }
    if (!receipt) {
      setSheetError('Receipt photo is required.')
      return
    }
    if (!kitchen) {
      setSheetError('Kitchen photo is required.')
      return
    }
    setConfirming(true)
    setSheetError('')
    setUploadPct(0)
    try {
      const body = new FormData()
      body.append('grocery_total', String(total))
      body.append('payment_method', 'card_on_file')
      if (tipAmount !== '') body.append('tip_amount', String(Number(tipAmount) || 0))
      body.append('receipt', receipt)
      body.append('kitchen_photo', kitchen)
      await apiUpload(`/api/grocery/${delivering.id}/deliver`, body, { onProgress: setUploadPct })
      toast.success('Order delivered')
      setDelivering(null)
      await refreshLists()
    } catch (error) {
      setSheetError(errorMessage(error))
    } finally {
      setConfirming(false)
    }
  }

  const loading = todayQuery.loading && !todayQuery.data
  const summary = earningsQuery.data
  const empty = !loading && inProgress.length === 0 && upNext.length === 0 && done.length === 0
  const next = inProgress[0] || upNext[0]

  return (
    <section className="shopper-page">
      <div className="shopper-main">
        {earningsQuery.loading && !summary ? (
          <EarningsStripSkeleton />
        ) : (
          <EarningsStrip
            trip_earnings={summary?.trip_earnings}
            tips={summary?.tips}
            total={summary?.total}
            earningsLabel="Service earnings"
            totalLabel="Total today"
          />
        )}

        {todayQuery.error ? <p className="page-error">{errorMessage(todayQuery.error)}</p> : null}

        {loading ? (
          <>
            <h2>In progress</h2>
            <article className="order">
              <span className="shimmer shimmer-lg" />
            </article>
          </>
        ) : empty ? (
          <EmptyState
            icon={ShoppingBasket}
            title="No orders today"
            detail="Orders assigned by Welson appear here automatically."
          />
        ) : (
          <>
            {inProgress.length ? (
              <>
                <h2>In progress</h2>
                <div className="order-grid">
                  {inProgress.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      checks={checks}
                      pending={workingId === order.id}
                      onToggleItem={toggleItem}
                      onStart={startShopping}
                      onWay={markOnTheWay}
                      onDeliver={openDeliver}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>In progress</h2>
                <p className="section-empty">No orders in progress.</p>
              </>
            )}

            <h2>Up next</h2>
            {upNext.length === 0 ? (
              <p className="section-empty">Nothing upcoming.</p>
            ) : (
              <div className="order-grid">
                {upNext.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tomorrow={chicagoToday(new Date(order.delivery_time)) === tomorrow}
                    checks={checks}
                    pending={workingId === order.id}
                    onToggleItem={toggleItem}
                    onStart={startShopping}
                    onWay={markOnTheWay}
                    onDeliver={openDeliver}
                  />
                ))}
              </div>
            )}

            <h2>Done today</h2>
            {done.length === 0 ? (
              <p className="section-empty">No delivered orders yet.</p>
            ) : (
              <div className="order-grid">
                {done.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    checks={checks}
                    pending={false}
                    onToggleItem={toggleItem}
                    onStart={startShopping}
                    onWay={markOnTheWay}
                    onDeliver={openDeliver}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <aside className="glance">
        <h2>Today at a glance</h2>
        <div className="glance-stat">
          <div className="l">Service earnings</div>
          <div className="v">{usd(summary?.trip_earnings)}</div>
        </div>
        <div className="glance-stat tips">
          <div className="l">Tips</div>
          <div className="v">{usd(summary?.tips)}</div>
        </div>
        <div className="glance-stat">
          <div className="l">Total today</div>
          <div className="v">{usd(summary?.total)}</div>
        </div>
        <p className="glance-next">{nextOrderLabel(next)}</p>
        <Link to="/shopper/earnings" className="glance-link">
          View earnings
        </Link>
      </aside>

      <BottomSheet
        open={Boolean(delivering)}
        onClose={closeSheet}
        title={delivering ? `Mark delivered · #${delivering.order_number}` : ''}
        sub={delivering ? `${packageLabel(delivering)} · ${delivering.delivery_address || ''}` : ''}
      >
        <form onSubmit={confirmDeliver}>
          <div className="field">
            <label htmlFor="grocery-total">Publix receipt total</label>
            <input
              id="grocery-total"
              inputMode="decimal"
              placeholder="0.00"
              value={groceryTotal}
              onChange={(event) => setGroceryTotal(event.target.value)}
              required
            />
          </div>
          <div className="grid2">
            <FilePick id="receipt-photo" label="Receipt photo" file={receipt} onChange={setReceipt} />
            <FilePick id="kitchen-photo" label="Kitchen photo" file={kitchen} onChange={setKitchen} />
          </div>
          <div className="field">
            <label htmlFor="shopper-tip">Tip received (optional)</label>
            <input
              id="shopper-tip"
              inputMode="decimal"
              placeholder="0.00"
              value={tipAmount}
              onChange={(event) => setTipAmount(event.target.value)}
            />
          </div>
          <div className="note tip">
            Tips are 100% yours. Your service earnings are based on the package fee, not the receipt.
          </div>
          {sheetError ? <p className="sheet-error">{sheetError}</p> : null}
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={closeSheet} disabled={confirming}>
              Not yet
            </button>
            <button type="submit" className="btn" disabled={confirming}>
              {confirming ? (
                <>
                  <Spinner size={16} /> {uploadPct > 0 ? `Uploading ${uploadPct}%` : 'Uploading…'}
                </>
              ) : (
                'Confirm delivered'
              )}
            </button>
          </div>
        </form>
      </BottomSheet>
    </section>
  )
}
