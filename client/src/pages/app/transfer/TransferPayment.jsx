import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Home,
  Info,
  Luggage,
  Plane,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import {
  Cta,
  DetailRow,
  PriceCard,
  TransferShell,
  pad,
  tripLabel,
  usd,
  useTransferId,
} from './TransferShell.jsx'
import StripePaymentForm from './StripePaymentForm.jsx'

const PAID_STATUSES = ['authorized', 'captured']

export default function TransferPayment() {
  const navigate = useNavigate()
  const id = useTransferId()
  const { data: transfer, loading, error } = useGuestQuery(
    () => (id ? guest.transfer(id) : guest.transfers({ active: 'true' }).then((rows) => rows[0] || null)),
    [id]
  )
  const [open, setOpen] = useState(true)
  const [clientSecret, setClientSecret] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [settling, setSettling] = useState(false)

  const alreadyPaid = transfer && PAID_STATUSES.includes(transfer.payment_status)

  // Create (or reuse) the Stripe PaymentIntent as soon as we know the transfer and it isn't
  // already paid — the Payment Element needs the client_secret before it can render.
  useEffect(() => {
    if (!transfer || alreadyPaid || clientSecret) return
    let ignore = false
    setSetupError('')
    guest
      .payTransfer(transfer.id, 'card_on_file')
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
  }, [transfer?.id, alreadyPaid])

  const onSuccess = async () => {
    setSettling(true)
    try {
      await guest.syncTransferPayment(transfer.id)
    } catch {
      /* the track screen polls anyway; a failed sync here isn't fatal */
    } finally {
      navigate(`/app/transfer/track?id=${transfer.id}`, { replace: true })
    }
  }

  return (
    <TransferShell
      back="/app/home"
      footer={
        <>
          <div className="app-xfer-auth">
            <div>
              <strong>{alreadyPaid ? 'Payment authorized' : `Authorize ${transfer ? usd(transfer.total) : '…'}`}</strong>
              <em>{alreadyPaid ? 'Your card is on hold until the trip is completed.' : 'This is an authorization hold, not a charge.'}</em>
            </div>
            <span className="app-xfer-pill is-green">
              <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
              Secure &amp; encrypted
            </span>
          </div>
          {alreadyPaid ? (
            <Cta to={`/app/transfer/track?id=${transfer.id}`}>Track Your Ride</Cta>
          ) : null}
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            Complete within 24 hours. Booking auto-cancels otherwise.
          </p>
        </>
      }
    >
      <div className="app-xfer-stack">
        <div className="app-xfer-hero is-compact">
          <span className="app-xfer-check-badge" aria-hidden="true">
            <Check size={22} strokeWidth={2} />
          </span>
          <h2 className="app-xfer-hero-title">
            {alreadyPaid ? 'Your Transfer Is Confirmed' : 'Secure Your Transfer'}
          </h2>
          <p className="app-xfer-hero-sub">
            {alreadyPaid
              ? 'We’ll charge your card once your driver completes the trip.'
              : 'Complete your card authentication to secure your booking.'}
          </p>
        </div>

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
        {!loading && !error && !transfer ? (
          <p className="app-empty">No transfer to pay for yet. Book one from the Services tab.</p>
        ) : null}

        {transfer ? (
          <>
            <section className="app-xfer-card">
              <button
                type="button"
                className="app-xfer-card-h is-toggle"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                <span className="app-xfer-card-emoji" aria-hidden="true">
                  🚖
                </span>
                <span>Transfer Details</span>
                {open ? (
                  <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>
              {open ? (
                <div className="app-xfer-rows">
                  <DetailRow icon={Home} label="Community" value={transfer.community || '—'} />
                  <DetailRow icon={Plane} label="Airport" value={transfer.airport} />
                  <DetailRow icon={Luggage} label="Trip type" value={tripLabel(transfer.trip_type)} />
                  <DetailRow icon={Calendar} label="Date" value={transfer.date_label} />
                  <DetailRow icon={Clock} label="Time" value={transfer.time_label} />
                  <DetailRow icon={Car} label="Vehicle" value={transfer.vehicle_label || transfer.vehicle} />
                  <DetailRow icon={Users} label="Passengers" value={pad(transfer.passengers)} />
                  <DetailRow icon={Luggage} label="Bags" value={pad(transfer.bags)} />
                  <DetailRow icon={Plane} label="Flight number" value={transfer.flight_number || '—'} />
                </div>
              ) : null}
            </section>

            <PriceCard quote={transfer} />
          </>
        ) : null}

        {transfer && !alreadyPaid ? (
          <section className="app-xfer-section">
            <h2 className="app-xfer-h is-icon">
              <CreditCard size={22} strokeWidth={1.5} className="is-orange" aria-hidden="true" />
              Authorize Your Card
            </h2>
            {setupError ? <p className="app-inline-error">{setupError}</p> : null}
            {settling ? (
              <p className="app-empty">Confirming your payment…</p>
            ) : (
              <StripePaymentForm
                clientSecret={clientSecret}
                amountLabel={usd(transfer.total)}
                onSuccess={onSuccess}
              />
            )}
            <div className="app-xfer-note is-info">
              <Info size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>
                Your card is authorized now and will only be charged after your transfer is
                completed.
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </TransferShell>
  )
}
