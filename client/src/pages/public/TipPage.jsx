import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { errorText, pub } from '../../lib/guestApi.js'
import { TipGrid, money, tipAmount } from '../app/transfer/TipBits.jsx'
import PublicShell from './PublicShell.jsx'

// my30ahost.com/tip/<token> — sent by SMS after the trip completes; works without the app.
export default function TipPage() {
  const { token } = useParams()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [pick, setPick] = useState('18')
  const [custom, setCustom] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        // Back from Stripe Checkout? Record the tip first.
        const sessionId = params.get('session_id')
        if (sessionId) {
          const confirmed = await pub.confirmTip(token, sessionId)
          if (!ignore) setDone(confirmed.tip_amount)
          setParams({}, { replace: true })
        }
        const next = await pub.tip(token)
        if (!ignore) {
          setData(next)
          if (next.already_tipped && done === null) setDone(next.trip.tip_amount)
        }
      } catch (err) {
        if (!ignore) setError(err?.status === 404 ? 'This link is not valid.' : errorText(err))
      }
    })()
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const onPick = (key) => {
    if (key === 'custom') {
      const value = Number(window.prompt('Tip amount in USD', custom || '10'))
      if (!Number.isFinite(value) || value < 0) return
      setCustom(Math.round(value * 100) / 100)
    }
    setPick(key)
  }

  const base = data?.trip?.total || 0
  const amount = pick === 'custom' ? custom : tipAmount(base, pick)

  const submit = async (tip) => {
    setBusy(true)
    setError('')
    try {
      const result = await pub.sendTip(token, tip)
      if (result.checkout_url) {
        window.location.assign(result.checkout_url)
        return
      }
      setDone(result.tip_amount)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <PublicShell title="My30A Host">
        <p className="app-empty">{error}</p>
      </PublicShell>
    )
  }
  if (!data) {
    return (
      <PublicShell title="Tip your driver">
        <p className="app-empty">Loading…</p>
      </PublicShell>
    )
  }

  const { trip } = data
  const from = trip.trip_type === 'departure' ? trip.community : trip.airport
  const to = trip.trip_type === 'departure' ? trip.airport : trip.community

  if (done !== null) {
    return (
      <PublicShell title="Thank you!" sub={`Trip #${trip.trip_number}`}>
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge is-lg" aria-hidden="true">
            <Check size={30} strokeWidth={2} />
            <Sparkles size={22} strokeWidth={1.5} className="s1" />
          </span>
          <h2 className="app-xfer-hero-title">{done > 0 ? `${money(done)} tip sent` : 'No tip this time'}</h2>
          <p className="app-xfer-hero-sub">
            {done > 0 ? `100% goes to ${trip.driver?.first_name || 'your driver'}. Thanks for riding with My30A Host!` : 'Thanks for riding with My30A Host!'}
          </p>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell
      title="Hope your ride was smooth!"
      sub={`Trip #${trip.trip_number} · ${trip.date_label}`}
      footer={
        <>
          <div className="app-xfer-tipnote">
            <strong>
              <span aria-hidden="true">💌</span> 100% of your tip goes to {trip.driver?.first_name || 'your driver'}.
            </strong>
            <span>Tips are a great way to show appreciation for excellent service.</span>
          </div>
          <div className="app-xfer-row-2 is-gap-20">
            <button type="button" className="app-xfer-cta is-ghost" disabled={busy} onClick={() => submit(0)}>
              No Thanks
            </button>
            <button type="button" className="app-xfer-cta" disabled={busy || !data.can_tip || !amount} onClick={() => submit(amount)}>
              {busy ? 'Sending…' : amount ? `Leave ${money(amount)} Tip` : 'Leave a Tip'}
            </button>
          </div>
        </>
      }
    >
      <div className="app-xfer-stack">
        {!data.can_tip ? (
          <p className="app-empty">Tips can be added once the trip is completed.</p>
        ) : null}
        <section className="app-xfer-card app-xfer-fare">
          <div>
            <h2 className="app-xfer-route">
              {from} <ArrowRight size={22} strokeWidth={2} aria-hidden="true" /> {to}
            </h2>
            <p className="app-xfer-ride-when">
              {trip.date_label} · {trip.time_label}
            </p>
          </div>
          <div className="app-xfer-fare-price">
            <span>Trip total</span>
            <strong>${trip.total}</strong>
          </div>
        </section>
        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Add a tip for {trip.driver?.first_name || 'your driver'}</h2>
          <TipGrid base={base} pick={pick} onPick={onPick} />
          {!data.saved_card ? (
            <p className="app-xfer-warn">You’ll be taken to a secure Stripe page to pay the tip.</p>
          ) : null}
        </section>
      </div>
    </PublicShell>
  )
}
