import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Info,
  Package,
  Refrigerator,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { Cta, DetailRow, TransferShell } from '../transfer/TransferShell.jsx'
import StripePaymentForm from '../transfer/StripePaymentForm.jsx'
import { useOrderId } from './GroceryShared.jsx'

export default function GroceryPayment() {
  const navigate = useNavigate()
  const id = useOrderId()
  const { data: order, loading, error } = useGuestQuery(
    () => (id ? guest.grocery(id) : guest.groceries({ active: 'true' }).then((rows) => rows[0] || null)),
    [id]
  )
  const [open, setOpen] = useState(true)
  const [clientSecret, setClientSecret] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [settling, setSettling] = useState(false)

  const cardSaved = Boolean(order?.card_saved)

  // Create (or reuse) a Stripe SetupIntent — no hold, no charge. We only save the card now; the
  // exact total (service fee + Publix receipt) is charged in one off-session charge once the
  // shopper actually delivers.
  useEffect(() => {
    if (!order || cardSaved || clientSecret) return
    let ignore = false
    setSetupError('')
    guest
      .payGrocery(order.id, 'card_on_file')
      .then((result) => {
        if (ignore) return
        if (result.client_secret) setClientSecret(result.client_secret)
        else if (result.stripe_skipped) setSetupError('Card payments aren’t available right now. Please contact My30A Host.')
      })
      .catch((err) => !ignore && setSetupError(errorText(err)))
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, cardSaved])

  const onSuccess = async () => {
    setSettling(true)
    try {
      await guest.markGroceryCardSaved(order.id)
    } catch {
      /* the track screen still works even if this call fails — worst case it re-prompts */
    } finally {
      navigate(`/app/grocery/track?id=${order.id}`, { replace: true })
    }
  }

  const fee = order ? order.service_fee - order.addons_total : 0
  const estimate = order ? order.service_fee : 0

  return (
    <TransferShell
      title="Order Groceries"
      back="/app/home"
      footer={
        <>
          <div className="app-xfer-auth">
            <div>
              <strong>{cardSaved ? 'Card saved' : 'Save your card'}</strong>
              <em>
                {cardSaved
                  ? 'Nothing is charged until your order is delivered.'
                  : 'No charge now — you only pay once your groceries are delivered.'}
              </em>
            </div>
            <span className="app-xfer-pill is-green">
              <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
              Secure &amp; encrypted
            </span>
          </div>
          {cardSaved ? <Cta to={`/app/grocery/track?id=${order.id}`}>Track Your Order</Cta> : null}
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge" aria-hidden="true">
            <Check size={22} strokeWidth={2} />
          </span>
          <h2 className="app-xfer-hero-title">
            {cardSaved ? 'Your Grocery Order Is Confirmed' : 'Save a Card for Your Grocery Order'}
          </h2>
          <p className="app-xfer-hero-sub">
            {cardSaved
              ? 'We’ll charge the exact total once your shopper delivers.'
              : 'We’ll shop and deliver first — you’re only charged once it arrives.'}
          </p>
        </div>

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
        {!loading && !error && !order ? (
          <p className="app-empty">No grocery order to pay for yet. Order from the Services tab.</p>
        ) : null}

        {order ? (
          <>
            <section className="app-xfer-card">
              <button
                type="button"
                className="app-xfer-card-h is-toggle"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                <span className="app-xfer-card-emoji" aria-hidden="true">
                  🛍️
                </span>
                <span>Grocery Details</span>
                {open ? (
                  <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>
              {open ? (
                <div className="app-xfer-rows">
                  <DetailRow icon={Package} label="Package" value={order.package} />
                  <DetailRow icon={Refrigerator} label="Stocking" value={order.stocking || '—'} />
                  <DetailRow icon={Calendar} label="Delivery date" value={order.date_label} />
                  <DetailRow icon={Clock} label="Delivery time" value={order.time_label} />
                </div>
              ) : null}
            </section>

            <section className="app-xfer-card">
              <h2 className="app-xfer-card-h">
                <Tag size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
                Price
              </h2>
              <div className="app-xfer-price">
                <div className="app-xfer-price-row">
                  <span>Service fee + exact Publix total</span>
                  <span>${fee} + Publix</span>
                </div>
                <div className="app-xfer-price-row">
                  <span>Add-ons</span>
                  <span>+${order.addons_total}</span>
                </div>
                <div className="app-xfer-price-row is-total">
                  <span>Estimated total (charged after delivery)</span>
                  <span>${estimate}+ Publix</span>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {order && !cardSaved ? (
          <section className="app-xfer-section">
            <h2 className="app-xfer-h is-icon">
              <CreditCard size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
              Save Your Card
            </h2>
            {setupError ? <p className="app-inline-error">{setupError}</p> : null}
            {settling ? (
              <p className="app-empty">Saving your card…</p>
            ) : (
              <StripePaymentForm
                mode="setup"
                clientSecret={clientSecret}
                onSuccess={onSuccess}
              />
            )}
            <div className="app-xfer-note is-info">
              <Info size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>
                Nothing is charged today. We’ll charge the ${estimate} service fee plus the exact
                Publix total together, in one charge, once your order is delivered — no markup.
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </TransferShell>
  )
}
