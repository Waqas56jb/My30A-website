import { useEffect, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CreditCard, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { stripeConfigured, stripePromise } from '../../../lib/stripeClient.js'
import { ExploreHead, ExploreShell } from '../explore/ExploreShared.jsx'

const BRAND_SHORT = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', discover: 'DISC', diners: 'DINERS', jcb: 'JCB', unionpay: 'UPAY' }

function AddCardForm({ profile, onSaved, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [holder, setHolder] = useState(profile?.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements || busy) return
    if (!holder.trim()) return setError('Please enter the name on the card.')
    setBusy(true)
    setError('')
    const { error: invalid } = await elements.submit()
    if (invalid) {
      setBusy(false)
      return
    }
    const { error: failed } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: { billing_details: { name: holder.trim(), email: profile?.email || undefined, phone: profile?.phone || undefined } },
      },
    })
    setBusy(false)
    if (failed) {
      // Card-field problems are shown inside Stripe's form; show everything else here.
      if (!['card_error', 'validation_error'].includes(failed.type)) setError(failed.message || 'Your card could not be saved.')
      else setError(failed.message || '')
      return
    }
    onSaved()
  }

  return (
    <form className="app-co-newcard" onSubmit={submit}>
      <label className="app-co-field">
        <span>Name on card</span>
        <input value={holder} onChange={(e) => setHolder(e.target.value)} autoComplete="cc-name" placeholder="Full name as shown on the card" />
      </label>
      <PaymentElement
        options={{
          layout: 'tabs',
          fields: { billingDetails: { name: 'never', email: 'auto', phone: 'auto', address: 'auto' } },
          defaultValues: { billingDetails: { address: { country: 'US' } } },
          wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
        }}
      />
      {error ? <p className="app-inline-error">{error}</p> : null}
      <button type="submit" className="app-co-pay" disabled={!stripe || busy}>
        <Lock size={16} strokeWidth={2} aria-hidden="true" />
        {busy ? 'Saving card…' : 'Save card'}
      </button>
      <button type="button" className="app-pf-link" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  )
}

export default function ProfilePayments() {
  const { data: me } = useGuestQuery(guest.me, [])
  const [cards, setCards] = useState(null)
  const [adding, setAdding] = useState(false)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState('')

  const load = () =>
    guest
      .paymentMethods()
      .then((d) => setCards(d.cards || []))
      .catch((err) => setError(errorText(err)))

  useEffect(() => {
    load()
  }, [])

  const startAdd = async () => {
    setError('')
    setAdding(true)
    setSecret('')
    try {
      const d = await guest.checkoutSetup()
      setSecret(d.client_secret)
    } catch (err) {
      setError(errorText(err))
      setAdding(false)
    }
  }

  const remove = async (card) => {
    if (!window.confirm(`Remove ${card.label}?`)) return
    setRemoving(card.id)
    try {
      const d = await guest.removeCard(card.id)
      setCards(d.cards || [])
    } catch (err) {
      setError(errorText(err))
    } finally {
      setRemoving('')
    }
  }

  return (
    <ExploreShell active="profile">
      <ExploreHead title="Payment Methods" sub="Cards saved for transfers and grocery delivery" back="/app/profile" />
      <div className="app-exp-body app-pf-form">
        <p className="app-pf-note">
          <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
          Cards are stored by Stripe. My30A Host never sees your full card number. You’re only charged for bookings you make.
        </p>

        {cards === null ? (
          <span className="app-skel app-skel-card" style={{ height: 64 }} aria-hidden="true" />
        ) : cards.length ? (
          <div className="app-co-methods">
            {cards.map((c) => (
              <div key={c.id} className="app-co-method is-static">
                <span className={`app-co-brand is-${c.brand}`}>{BRAND_SHORT[c.brand] || 'CARD'}</span>
                <span className="app-co-method-text">
                  <strong>{c.label}</strong>
                  <small>Expires {c.exp}</small>
                </span>
                <button type="button" className="app-pf-remove" onClick={() => remove(c)} disabled={removing === c.id} aria-label={`Remove ${c.label}`}>
                  <Trash2 size={17} strokeWidth={1.9} />
                </button>
              </div>
            ))}
          </div>
        ) : !adding ? (
          <div className="app-nt-empty">
            <span aria-hidden="true">
              <CreditCard size={26} strokeWidth={1.6} />
            </span>
            <strong>No saved cards</strong>
            <p>Add a card now, or save one during your next booking.</p>
          </div>
        ) : null}

        {error ? <p className="app-inline-error">{error}</p> : null}

        {!stripeConfigured ? (
          <p className="app-inline-error">Card payments aren’t available right now.</p>
        ) : adding ? (
          <section className="app-co">
            {secret ? (
              <Elements stripe={stripePromise} options={{ clientSecret: secret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0c3255', borderRadius: '12px' } } }}>
                <AddCardForm
                  profile={me?.profile}
                  onSaved={() => {
                    setAdding(false)
                    load()
                  }}
                  onCancel={() => setAdding(false)}
                />
              </Elements>
            ) : (
              <span className="app-skel app-skel-card" style={{ height: 200 }} aria-hidden="true" />
            )}
          </section>
        ) : (
          <button type="button" className="app-co-pay" onClick={startAdd}>
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" /> Add a card
          </button>
        )}
      </div>
    </ExploreShell>
  )
}
