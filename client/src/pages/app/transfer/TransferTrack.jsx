import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Car,
  Check,
  ChevronRight,
  Info,
  Luggage,
  MapPin,
  MessageCircle,
  Plane,
  TreePalm,
  Users,
} from 'lucide-react'
import { errorText, guest } from '../../../lib/guestApi.js'
import { Cta, TransferShell, clock, useTransferId } from './TransferShell.jsx'

const ORDER = ['requested', 'assigned', 'started', 'completed']

function buildSteps(transfer) {
  const logTime = (status) => {
    const rows = (transfer.status_log || []).filter((r) => r.status === status)
    return rows.length ? clock(rows[rows.length - 1].created_at) : null
  }
  const driver = transfer.driver?.name || 'Your driver'
  const from = transfer.trip_type === 'departure' ? transfer.community : `${transfer.airport} airport`
  const defs = [
    { key: 'requested', title: 'Request received', desc: 'Vitoria has your transfer request.' },
    {
      key: 'assigned',
      title: 'Confirmed',
      desc: transfer.driver ? `${driver} is your driver · ${transfer.vehicle_label}` : 'Your transfer has been confirmed.',
    },
    { key: 'started', title: 'Driver on the way', desc: `${driver} is on the way to ${from}.`, pin: true },
    { key: 'completed', title: 'Completed', desc: 'We’ll mark your transfer as completed once you arrive.' },
  ]
  const idx = ORDER.indexOf(transfer.status)
  return defs.map((d, i) => {
    let state = 'pending'
    if (idx >= 0) {
      if (i < idx || transfer.status === 'completed') state = 'done'
      else if (i === idx) state = 'live'
    }
    const time = state === 'pending' ? 'Pending' : logTime(d.key) || (i === 0 ? clock(transfer.created_at) : '—')
    return { ...d, state, time }
  })
}

export default function TransferTrack() {
  const id = useTransferId()
  const [transfer, setTransfer] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        let row = null
        if (id) row = await guest.transfer(id)
        else {
          const active = await guest.transfers({ active: 'true' })
          row = active[0] || (await guest.transfers())[0] || null
        }
        if (ignore) return
        setTransfer(row)
        setError(row ? '' : 'No transfers yet. Book one from the Services tab.')
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
    if (!transfer || !window.confirm('Cancel this transfer request?')) return
    setBusy(true)
    try {
      setTransfer(await guest.cancelTransfer(transfer.id))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!transfer) {
    return (
      <TransferShell title="Track Your Ride" back="/app/home" footer={<Cta to="/app/home">Back to Home</Cta>}>
        <p className="app-empty">{error || 'Loading…'}</p>
      </TransferShell>
    )
  }

  const from = transfer.trip_type === 'departure' ? transfer.community : transfer.airport
  const to = transfer.trip_type === 'departure' ? transfer.airport : transfer.community
  const shortDate = (transfer.date_label || '').replace(/,\s*\d{4}$/, '')
  const steps = buildSteps(transfer)
  const ended = ['cancelled', 'refunded'].includes(transfer.status)

  return (
    <TransferShell
      title="Track Your Ride"
      back="/app/home"
      footer={
        <>
          {transfer.status === 'completed' && !transfer.tip_amount ? (
            <Cta to={`/app/transfer/tip?id=${transfer.id}`}>Leave a Tip for Your Driver</Cta>
          ) : null}
          {['requested', 'assigned'].includes(transfer.status) &&
          !['authorized', 'captured'].includes(transfer.payment_status) ? (
            <Cta to={`/app/transfer/payment?id=${transfer.id}`}>Authorize Payment</Cta>
          ) : null}
          {transfer.status === 'requested' ? (
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
              {ended ? transfer.status_label : <><i /> Live Updates</>}
            </span>
            <h2 className="app-xfer-route">
              {from} <ArrowRight size={20} strokeWidth={2} aria-hidden="true" /> {to}
            </h2>
            <p className="app-xfer-ride-when">
              {shortDate} {transfer.time_label}
            </p>
            <p className="app-xfer-ride-meta">
              <span>
                <Users size={16} strokeWidth={1.5} aria-hidden="true" /> {transfer.passengers} Passengers
              </span>
              <span>
                <Luggage size={16} strokeWidth={1.5} aria-hidden="true" /> {transfer.bags} Bags
              </span>
            </p>
            <strong className="app-xfer-ride-kind">Private Transfer · #{transfer.trip_number}</strong>
          </div>
          <div className="app-xfer-ride-art">
            <img src="/image8.png" alt="" />
            <span className="app-xfer-ride-badge" aria-hidden="true">
              <TreePalm size={20} strokeWidth={1.5} />
            </span>
          </div>
        </section>

        {error ? <p className="app-inline-error">{error}</p> : null}

        <ol className="app-xfer-tl">
          {steps.map((s) => (
            <li key={s.key} className={`app-xfer-tl-item is-${s.state}`}>
              <span className="app-xfer-tl-mark" aria-hidden="true">
                {s.state === 'done' ? <Check size={14} strokeWidth={3} /> : null}
                {s.state === 'live' ? <Car size={16} strokeWidth={1.5} /> : null}
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

        <section className="app-xfer-card is-tight">
          <div className="app-xfer-kv">
            <span className="app-xfer-icobox">
              <Plane size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="app-xfer-kv-text">
              <small>Flight Number</small>
              <strong>{transfer.flight_number || '—'}</strong>
            </span>
            <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="app-xfer-kv-foot">
            <span>Flight Status</span>
            <span className="app-xfer-pill is-green is-sm">
              {transfer.flight_number ? 'tracked by your driver' : 'not provided'}
            </span>
          </div>
        </section>

        <section className="app-xfer-card is-tight">
          <div className="app-xfer-kv">
            <span className="app-xfer-icobox">
              <Car size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="app-xfer-kv-text">
              <small>Driver</small>
              <strong>{transfer.driver?.name || 'Assigning your driver…'}</strong>
            </span>
            <span className="app-xfer-actions">
              <Link to="/app/vitoria" className="app-xfer-action" aria-label="Message about your driver">
                <MessageCircle size={18} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />
              </Link>
            </span>
          </div>
          <div className="app-xfer-kv-foot">
            <span>{transfer.vehicle_label || transfer.vehicle}</span>
            <span className="app-xfer-rating">{transfer.status_label}</span>
          </div>
        </section>

        <section className="app-xfer-card is-tight">
          <p className="app-xfer-instr-h">
            Pickup Instructions <Info size={16} strokeWidth={1.5} aria-hidden="true" />
          </p>
          <p className="app-xfer-instr">
            {transfer.trip_type === 'departure'
              ? `Your driver will meet you at ${transfer.address}.`
              : 'Driver will meet you at Baggage Claim, outside door 3 with a My30A Host sign.'}
          </p>
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
