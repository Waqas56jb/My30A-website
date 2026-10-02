import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Plus } from 'lucide-react'
import { hostPortal } from '../../lib/hostPortal.js'

// Stripe Checkout sends the host back here (?session_id=…): confirm the payment and switch the
// plan on, then point them at their first property.
export default function HostCheckoutDone() {
  const [params] = useSearchParams()
  const [state, setState] = useState({ status: 'checking' })

  useEffect(() => {
    const sessionId = params.get('session_id')
    if (!sessionId) {
      setState({ status: 'error', message: 'Missing payment reference.' })
      return
    }
    let tries = 0
    let timer
    const check = () =>
      hostPortal
        .confirm(sessionId)
        .then((r) => {
          // Stripe can take a few seconds to finish the first invoice.
          if (!r.paid && tries++ < 6) timer = window.setTimeout(check, 2000)
          else setState({ status: r.paid ? 'paid' : 'pending', sub: r.subscription })
        })
        .catch((err) => setState({ status: 'error', message: err?.data?.error || err.message }))
    check()
    return () => window.clearTimeout(timer)
  }, [params])

  return (
    <div className="hp-page hp-center">
      <section className="hp-card hp-narrow hp-done">
        {state.status === 'checking' ? (
          <>
            <span className="hp-spin" aria-hidden="true" />
            <h1>Confirming your payment…</h1>
          </>
        ) : state.status === 'paid' ? (
          <>
            <CheckCircle2 size={44} className="hp-done-ico" />
            <h1>You’re all set!</h1>
            <p className="hp-muted">
              Your Host Version plan is active for {state.sub?.quantity} propert{state.sub?.quantity === 1 ? 'y' : 'ies'}. Add your property, print the QR code, and your guests get your branded
              app with My Home and Vitória.
            </p>
            <Link to="/host/homes/new" className="hp-btn is-primary">
              <Plus size={16} /> Add your first property
            </Link>
            <Link to="/host" className="hp-link-btn">
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <h1>{state.status === 'pending' ? 'Payment still processing' : 'We couldn’t confirm the payment'}</h1>
            <p className="hp-muted">{state.message || 'It can take a minute — your dashboard updates automatically.'}</p>
            <Link to="/host" className="hp-btn is-primary">
              Go to dashboard
            </Link>
          </>
        )}
      </section>
    </div>
  )
}
