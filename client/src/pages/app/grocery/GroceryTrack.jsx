import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, MapPin, MessageSquare, Package, ShieldCheck } from 'lucide-react'
import { errorText, guest } from '../../../lib/guestApi.js'
import { Cta, TransferShell, clock } from '../transfer/TransferShell.jsx'
import { useOrderId } from './GroceryShared.jsx'

const ORDER = ['requested', 'assigned', 'shopping', 'on_the_way', 'delivered']

function buildSteps(order) {
  const logTime = (status) => {
    const rows = (order.status_log || []).filter((r) => r.status === status)
    return rows.length ? clock(rows[rows.length - 1].created_at) : null
  }
  const shopper = order.shopper?.name || 'Your shopper'
  const defs = [
    { key: 'requested', title: 'Request received', desc: 'Vitoria has your grocery list.' },
    { key: 'assigned', title: 'Confirmed', desc: order.shopper ? `${shopper} will shop your order.` : 'Your order has been confirmed.' },
    { key: 'shopping', title: 'Shopping at Publix', desc: `${shopper} is shopping your list at Water Sound Town Center.`, icon: 'package' },
    { key: 'on_the_way', title: 'On the way', desc: `Your order is on the way to ${order.delivery_address}.`, pin: true },
    { key: 'delivered', title: 'Delivered', desc: order.stocking ? `Stocked: ${order.stocking}.` : 'We’ll let you know when your order is delivered.' },
  ]
  const idx = ORDER.indexOf(order.status)
  return defs.map((d, i) => {
    let state = 'pending'
    if (idx >= 0) {
      if (i < idx || order.status === 'delivered') state = 'done'
      else if (i === idx) state = 'live'
    }
    const time = state === 'pending' ? 'Pending' : logTime(d.key) || (i === 0 ? clock(order.created_at) : '—')
    return { ...d, state, time }
  })
}

export default function GroceryTrack() {
  const id = useOrderId()
  const [order, setOrder] = useState(null)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        let row = null
        if (id) row = await guest.grocery(id)
        else {
          const active = await guest.groceries({ active: 'true' })
          row = active[0] || (await guest.groceries())[0] || null
        }
        if (ignore) return
        setOrder(row)
        setError(row ? '' : 'No grocery orders yet. Order from the Services tab.')
        if (row) {
          const inbox = await guest.notifications().catch(() => null)
          if (!ignore && inbox) {
            setMessages(inbox.notifications.filter((n) => n.grocery_order_id === row.id).slice(0, 5))
          }
        }
      } catch (err) {
        if (!ignore) setError(errorText(err))
      }
    }
    load()
    const timer = setInterval(load, 15000)
    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [id])

  const cancel = async () => {
    if (!order || !window.confirm('Cancel this grocery request?')) return
    setBusy(true)
    try {
      setOrder(await guest.cancelGrocery(order.id))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!order) {
    return (
      <TransferShell title="Track Your Order" back="/app/home" footer={<Cta to="/app/home">Back to Home</Cta>}>
        <p className="app-empty">{error || 'Loading…'}</p>
      </TransferShell>
    )
  }

  const steps = buildSteps(order)
  const addons = order.addons || []
  const ended = ['cancelled', 'refunded'].includes(order.status)

  return (
    <TransferShell
      title="Track Your Order"
      back="/app/home"
      className="app-groc-track"
      footer={
        <>
          {order.status === 'delivered' && !order.tip_amount ? (
            <Cta to={`/app/grocery/tip?id=${order.id}`}>Leave a Tip for Your Shopper</Cta>
          ) : null}
          {order.card_label && order.status !== 'cancelled' ? (
            <p className="app-co-onfile">
              <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
              {order.card_label} · {order.payment_status === 'captured' ? 'paid' : 'charged once, after delivery'}
            </p>
          ) : null}
          {['requested', 'assigned'].includes(order.status) &&
          order.payment_method !== 'cash' &&
          !order.card_saved ? (
            <Cta to={`/app/grocery/payment?id=${order.id}`}>Save Card for Delivery</Cta>
          ) : null}
          {order.status === 'requested' ? (
            <Cta onClick={cancel} ghost disabled={busy}>
              {busy ? 'Cancelling…' : 'Cancel Request'}
            </Cta>
          ) : null}
          <Cta to="/app/home">Back to Home</Cta>
        </>
      }
    >
      <div className="app-xfer-stack">
        <section className="app-xfer-ride">
          <div className="app-xfer-ride-body">
            <span className={`app-xfer-pill ${ended ? 'is-green' : 'is-live'}`}>
              {ended ? order.status_label : <><i /> Live Updates</>}
            </span>
            <span className="app-groc-ride-pkg">
              <span className="app-groc-bag" aria-hidden="true">
                🛍️
              </span>
              <span className="app-groc-pkg-text">
                <strong>{order.package}</strong>
                <small>{order.stocking || 'Standard stocking'} · #{order.order_number}</small>
              </span>
            </span>
            <p className="app-xfer-ride-when">
              {order.date_label} · {order.time_label}
            </p>
            <strong className="app-xfer-ride-kind">
              {addons.length ? addons.map((a) => a.name).join(' · ') : 'Standard delivery'}
            </strong>
          </div>
          <div className="app-xfer-ride-art is-groc" aria-hidden="true">
            <span>🛍️</span>
          </div>
        </section>

        {error ? <p className="app-inline-error">{error}</p> : null}

        <ol className="app-xfer-tl">
          {steps.map((s) => (
            <li key={s.key} className={`app-xfer-tl-item is-${s.state}`}>
              <span className="app-xfer-tl-mark" aria-hidden="true">
                {s.state === 'done' ? <Check size={14} strokeWidth={3} /> : null}
                {s.state === 'live' ? <Package size={16} strokeWidth={1.5} /> : null}
              </span>
              <div className="app-xfer-tl-body">
                <div className="app-xfer-tl-head">
                  <h3>
                    {s.title}
                    {s.state === 'live' ? (
                      <span className="app-xfer-pill is-live is-sm">
                        <i /> Live
                      </span>
                    ) : null}
                  </h3>
                  {s.pin ? <MapPin size={18} strokeWidth={1.5} aria-hidden="true" /> : null}
                </div>
                <span className="app-xfer-tl-time">{s.time}</span>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="app-xfer-card is-tight app-groc-msgs">
          <p className="app-xfer-instr-h">
            <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" /> Messages
          </p>
          {messages.length ? (
            messages.map((m) => (
              <div key={m.id}>
                <div className="app-groc-msg">
                  <span className="app-groc-avatar is-lg" aria-hidden="true" />
                  <p>{m.message}</p>
                </div>
                <span className="app-groc-msg-time">{clock(m.created_at)}</span>
              </div>
            ))
          ) : (
            <div className="app-groc-msg">
              <span className="app-groc-avatar is-lg" aria-hidden="true" />
              <p>
                Your order is being prepared with food-safe handling and stacking. We’ll keep you
                updated!
              </p>
            </div>
          )}
        </section>

        <section className="app-xfer-help">
          <div>
            <strong>Need anything?</strong>
            <em>Message Vitoria for any help during your trip.</em>
          </div>
          <Link to="/app/vitoria" className="app-xfer-help-link">
            Message Vitoria <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </TransferShell>
  )
}
