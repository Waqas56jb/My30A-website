import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Info, Sparkles } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { TipGrid, money, tipAmount } from '../transfer/TipBits.jsx'
import { useOrderId } from './GroceryShared.jsx'

export default function GroceryTip() {
  const navigate = useNavigate()
  const id = useOrderId()
  const { data: order, error } = useGuestQuery(
    () => (id ? guest.grocery(id) : guest.groceries({ status: 'delivered' }).then((rows) => rows[0] || null)),
    [id]
  )
  const [pick, setPick] = useState('18')
  const [custom, setCustom] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tipError, setTipError] = useState('')

  const fee = order ? order.service_fee : 0
  const extras = order ? order.addons_total : 0
  const publix = order ? order.grocery_total : 0
  const total = order ? order.total : 0
  const tip = pick === 'custom' ? custom : tipAmount(fee, pick)
  const addons = order?.addons?.length ? order.addons.map((a) => `${a.name} +$${a.price}`).join(', ') : 'None'
  const deliveredAt = order?.delivered_at
    ? new Date(order.delivered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  const onPick = (key) => {
    if (key === 'custom') {
      const value = Number(window.prompt('Tip amount in USD', custom || '10'))
      if (!Number.isFinite(value) || value < 0) return
      setCustom(Math.round(value * 100) / 100)
    }
    setPick(key)
  }

  const leaveTip = async () => {
    if (!order) return
    setBusy(true)
    setTipError('')
    try {
      await guest.tipGrocery(order.id, Math.round(tip * 100) / 100)
      navigate('/app/home', { replace: true })
    } catch (err) {
      setTipError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <TransferShell
      back="/app/home"
      className="app-groc-tip"
      footer={
        <>
          <div className="app-xfer-tipnote">
            <strong>
              <span aria-hidden="true">💌</span> 100% of your tip goes to your Shopper
            </strong>
            <span>Tips are a great way to show appreciation for excellent service.</span>
          </div>
          {tipError ? <p className="app-inline-error">{tipError}</p> : null}
          <div className="app-xfer-row-2 is-gap-20">
            <Cta to="/app/home" ghost>
              No Thanks
            </Cta>
            <Cta onClick={leaveTip} disabled={busy || !order || order.status !== 'delivered' || !tip}>
              {busy ? 'Sending…' : tip ? `Leave ${money(tip)} Tip` : 'Leave a Tip'}
            </Cta>
          </div>
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            {order && order.status !== 'delivered'
              ? 'You can tip once your order is delivered.'
              : 'Thank you for choosing Vitoria.'}
          </p>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge is-lg" aria-hidden="true">
            <Check size={30} strokeWidth={2} />
            <Sparkles size={22} strokeWidth={1.5} className="s1" />
            <Sparkles size={16} strokeWidth={1.5} className="s2" />
            <Sparkles size={14} strokeWidth={1.5} className="s3" />
          </span>
          <h2 className="app-xfer-hero-title">Your Kitchen Is Ready</h2>
          <p className="app-xfer-hero-sub">
            We’ve delivered and stocked everything for you.
            <br />
            Thank you for Choosing Vitoria!
          </p>
        </div>

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        {order ? (
          <section className="app-xfer-card app-groc-sum">
            <h3>Order Summary</h3>
            <div className="app-groc-sum-row">
              <span>
                <strong>Publix Grocery Total</strong>
                <small>Charged now</small>
              </span>
              <b>{money(publix)}</b>
            </div>
            <div className="app-groc-sum-row">
              <span>
                <strong>Service Fee</strong>
                <small>Authorized until delivery</small>
              </span>
              <b>{money(fee - extras)}</b>
            </div>
            <div className="app-groc-sum-row">
              <span>
                <strong>Add-Ons</strong>
                <small>{addons}</small>
              </span>
              <b>{money(extras)}</b>
            </div>
            <div className="app-groc-sum-row is-total">
              <span>
                <strong>Total</strong>
              </span>
              <b>{money(total)}</b>
            </div>
            <div className="app-groc-info is-lg is-done">
              <Info size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>{order.status === 'delivered' ? 'Service completed' : order.status_label}</strong>
                <small>{deliveredAt ? `Delivered on ${deliveredAt}` : `Delivery ${order.date_label} · ${order.time_label}`}</small>
              </span>
            </div>
          </section>
        ) : (
          <p className="app-empty">No delivered orders yet.</p>
        )}

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Add A Tip For Your Shopper</h2>
          <TipGrid base={fee} pick={pick} onPick={onPick} />
        </section>
      </div>
    </TransferShell>
  )
}
