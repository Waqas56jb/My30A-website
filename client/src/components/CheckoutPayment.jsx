import { useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CheckCircle2, CreditCard, Lock, Plus, ShieldCheck } from 'lucide-react'
import { errorText, guest } from '../lib/guestApi.js'
import { stripeConfigured, stripePromise } from '../lib/stripeClient.js'

// Checkout step shared by airport transfers and grocery orders — the last step before a booking is
// submitted, like any online store: pick a saved card or add a new one (Stripe's own secure fields,
// cardholder + billing details, 3-D Secure when the bank asks). Only when the card is confirmed does
// `onPay(paymentMethodId, { handleAction })` create the booking; `handleAction(clientSecret)` lets
// the caller run a bank check the server asks for (402 requires_action) before retrying.
// Card numbers never touch our code or servers (PCI scope stays with Stripe).
const BRAND_SHORT = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', discover: 'DISC', diners: 'DINERS', jcb: 'JCB', unionpay: 'UPAY' }

function NewCardForm({ busy, setBusy, onConfirmed, setError, submitLabel, profile }) {
  const stripe = useStripe()
  const elements = useElements()
  const [holder, setHolder] = useState(profile?.name || '')
  useEffect(() => {
    if (profile?.name) setHolder((current) => current || profile.name)
  }, [profile?.name])

  const submit = async (event) => {
    event.preventDefault()
    if (!stripe || !elements || busy) return
    if (!holder.trim()) {
      setError('Please enter the name on the card.')
      return
    }
    setBusy(true)
    setError('')
    const { error: invalid } = await elements.submit()
    if (invalid) {
      setBusy(false)
      setError(invalid.message || 'Please check your card details.')
      return
    }
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
        // Cardholder details go to Stripe with the card (receipts, disputes, bank checks).
        payment_method_data: {
          billing_details: {
            name: holder.trim(),
            email: profile?.email || undefined,
            phone: profile?.phone || undefined,
          },
        },
      },
    })
    if (error) {
      setBusy(false)
      setError(error.message || 'Your card could not be verified. Please try another card.')
      return
    }
    await onConfirmed(setupIntent.payment_method)
  }

  return (
    <form onSubmit={submit} className="app-co-newcard">
      <label className="app-co-field">
        <span>Name on card</span>
        <input
          type="text"
          autoComplete="cc-name"
          value={holder}
          onChange={(e) => setHolder(e.target.value)}
          placeholder="Full name as shown on the card"
          disabled={busy}
        />
      </label>
      <PaymentElement
        options={{
          layout: 'tabs',
          fields: { billingDetails: { name: 'never', email: 'auto', phone: 'auto', address: 'auto' } },
          defaultValues: {
            billingDetails: {
              name: profile?.name || '',
              email: profile?.email || '',
              phone: profile?.phone || '',
              address: { country: 'US' },
            },
          },
          // Cards only (transfers are held and captured after the ride): no Link wallet / bank tab.
          wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
        }}
      />
      <button type="submit" className="app-co-pay" disabled={!stripe || busy}>
        <Lock size={16} strokeWidth={2} aria-hidden="true" />
        {busy ? 'Processing…' : submitLabel}
      </button>
    </form>
  )
}

export default function CheckoutPayment({ title = 'Payment', amountLabel, note, submitLabel = 'Pay & Confirm', onPay, disabled, profile }) {
  const [cards, setCards] = useState(null)
  const [choice, setChoice] = useState('new')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    guest
      .paymentMethods()
      .then((d) => {
        if (!mounted.current) return
        setCards(d.cards || [])
        if (d.cards?.length) setChoice(d.cards[0].id)
      })
      .catch(() => mounted.current && setCards([]))
    return () => {
      mounted.current = false
    }
  }, [])

  // A fresh SetupIntent only when the guest actually adds a new card.
  useEffect(() => {
    if (choice !== 'new' || clientSecret || !stripeConfigured) return
    guest
      .checkoutSetup()
      .then((d) => mounted.current && setClientSecret(d.client_secret))
      .catch((err) => mounted.current && setError(errorText(err)))
  }, [choice, clientSecret])

  const handleAction = async (secret) => {
    const stripe = await stripePromise
    const { error: actionError } = await stripe.handleNextAction({ clientSecret: secret })
    if (actionError) throw new Error(actionError.message || 'Your bank did not approve the payment.')
  }

  const pay = async (paymentMethodId) => {
    setError('')
    setBusy(true)
    try {
      await onPay(paymentMethodId, { handleAction })
      if (mounted.current) setDone(true)
    } catch (err) {
      if (mounted.current) {
        setError(errorText(err))
        setBusy(false)
        // Start the next attempt clean: a new secure card setup (the last one is used up) and a
        // refreshed saved-card list (a declined card is removed from it).
        setClientSecret('')
        guest
          .paymentMethods()
          .then((d) => {
            if (!mounted.current) return
            setCards(d.cards || [])
            if (!d.cards?.some((c) => c.id === choice)) setChoice(d.cards?.[0]?.id || 'new')
          })
          .catch(() => {})
      }
      return
    }
    if (mounted.current) setBusy(false)
  }

  if (!stripeConfigured) {
    return (
      <section className="app-co">
        <p className="app-inline-error">Card payments aren’t available right now. Please contact My30A Host.</p>
      </section>
    )
  }

  return (
    <section className="app-co" aria-label="Payment">
      <header className="app-co-head">
        <h2>
          <CreditCard size={20} strokeWidth={1.8} aria-hidden="true" />
          {title}
        </h2>
        <span className="app-co-secure">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" /> Secure checkout
        </span>
      </header>
      {amountLabel ? (
        <div className="app-co-amount">
          <span>Total</span>
          <strong>{amountLabel}</strong>
        </div>
      ) : null}
      {note ? <p className="app-co-note">{note}</p> : null}

      {cards === null ? (
        <span className="app-skel app-skel-card" style={{ height: 56 }} aria-hidden="true" />
      ) : (
        <div className="app-co-methods" role="radiogroup" aria-label="Payment method">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={choice === c.id}
              className={`app-co-method${choice === c.id ? ' is-on' : ''}`}
              onClick={() => setChoice(c.id)}
              disabled={busy}
            >
              <span className={`app-co-brand is-${c.brand}`}>{BRAND_SHORT[c.brand] || String(c.brand || 'card').slice(0, 4).toUpperCase()}</span>
              <span className="app-co-method-text">
                <strong>{c.label}</strong>
                <small>Expires {c.exp}</small>
              </span>
              {choice === c.id ? <CheckCircle2 size={20} strokeWidth={2} className="app-co-tick" aria-hidden="true" /> : null}
            </button>
          ))}
          {cards.length ? (
            <button
              type="button"
              role="radio"
              aria-checked={choice === 'new'}
              className={`app-co-method is-add${choice === 'new' ? ' is-on' : ''}`}
              onClick={() => setChoice('new')}
              disabled={busy}
            >
              <span className="app-co-brand is-add">
                <Plus size={16} strokeWidth={2.2} />
              </span>
              <span className="app-co-method-text">
                <strong>Use a new card</strong>
                <small>Debit or credit card</small>
              </span>
            </button>
          ) : null}
        </div>
      )}

      {choice === 'new' ? (
        clientSecret ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: { colorPrimary: '#0c3255', borderRadius: '12px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
              },
            }}
          >
            <NewCardForm
              busy={busy || disabled || done}
              setBusy={setBusy}
              setError={setError}
              onConfirmed={pay}
              submitLabel={submitLabel}
              profile={profile}
            />
          </Elements>
        ) : (
          <span className="app-skel app-skel-card" style={{ height: 220 }} aria-hidden="true" />
        )
      ) : (
        <button type="button" className="app-co-pay" disabled={busy || disabled || done} onClick={() => pay(choice)}>
          <Lock size={16} strokeWidth={2} aria-hidden="true" />
          {busy ? 'Processing…' : submitLabel}
        </button>
      )}

      {error ? (
        <p className="app-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="app-co-legal">
        <Lock size={12} strokeWidth={2} aria-hidden="true" /> Payments are processed by Stripe. My30A Host never sees or stores your
        full card number.
      </p>
    </section>
  )
}
