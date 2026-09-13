import { useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { ShieldCheck } from 'lucide-react'
import { stripePromise, stripeConfigured } from '../../../lib/stripeClient.js'

function InnerForm({ amountLabel, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!stripe || !elements || busy) return
    setBusy(true)
    setError('')
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    setBusy(false)
    if (confirmError) {
      setError(confirmError.message || 'Payment could not be authorized. Please try again.')
      onError?.(confirmError)
      return
    }
    onSuccess?.(paymentIntent)
  }

  return (
    <form className="app-xfer-cardform" onSubmit={submit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? (
        <p className="app-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="app-xfer-cta"
        disabled={!stripe || busy}
        style={{ marginTop: 16, width: '100%' }}
      >
        {busy ? 'Authorizing…' : `Authorize ${amountLabel || 'Card'}`}
      </button>
      <p className="app-xfer-warn" style={{ marginTop: 10 }}>
        <ShieldCheck size={16} strokeWidth={1.5} aria-hidden="true" />
        Payments are processed securely by Stripe. My30A Host never sees your card details.
      </p>
    </form>
  )
}

// clientSecret comes from the guest.payTransfer()/guest.payGrocery() response (a manual-capture
// PaymentIntent). This form only ever handles a Stripe-hosted Payment Element — raw card fields
// are never entered into our own code, by design (PCI scope).
export default function StripePaymentForm({ clientSecret, amountLabel, onSuccess, onError }) {
  if (!stripeConfigured) {
    return (
      <p className="app-empty">
        Card payments aren’t configured yet. Please choose “Pay with cash” or contact My30A Host.
      </p>
    )
  }
  if (!clientSecret) {
    return <p className="app-empty">Preparing secure payment…</p>
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <InnerForm amountLabel={amountLabel} onSuccess={onSuccess} onError={onError} />
    </Elements>
  )
}
