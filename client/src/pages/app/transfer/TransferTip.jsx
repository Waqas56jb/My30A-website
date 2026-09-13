import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Info, Luggage, Sparkles, Users } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { Cta, TransferShell, usd, useTransferId } from './TransferShell.jsx'
import { TipGrid, money, tipAmount } from './TipBits.jsx'

export default function TransferTip() {
  const navigate = useNavigate()
  const id = useTransferId()
  const { data: transfer, error } = useGuestQuery(
    () => (id ? guest.transfer(id) : guest.transfers({ status: 'completed' }).then((rows) => rows[0] || null)),
    [id]
  )
  const [pick, setPick] = useState('18')
  const [custom, setCustom] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tipError, setTipError] = useState('')

  const base = transfer?.total || 0
  const amount = pick === 'custom' ? custom : tipAmount(base, pick)
  const from = transfer?.trip_type === 'departure' ? transfer?.community : transfer?.airport
  const to = transfer?.trip_type === 'departure' ? transfer?.airport : transfer?.community
  const shortDate = (transfer?.date_label || '').replace(/,\s*\d{4}$/, '')

  const onPick = (key) => {
    if (key === 'custom') {
      const value = Number(window.prompt('Tip amount in USD', custom || '10'))
      if (!Number.isFinite(value) || value < 0) return
      setCustom(Math.round(value * 100) / 100)
    }
    setPick(key)
  }

  const leaveTip = async () => {
    if (!transfer) return
    setBusy(true)
    setTipError('')
    try {
      await guest.tipTransfer(transfer.id, Math.round(amount * 100) / 100)
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
      footer={
        <>
          <div className="app-xfer-tipnote">
            <strong>
              <span aria-hidden="true">💌</span> 100% of your tip goes to your driver.
            </strong>
            <span>Tips are a great way to show appreciation for excellent service.</span>
          </div>
          {tipError ? <p className="app-inline-error">{tipError}</p> : null}
          <div className="app-xfer-row-2 is-gap-20">
            <Cta to="/app/home" ghost>
              No Thanks
            </Cta>
            <Cta onClick={leaveTip} disabled={busy || !transfer || transfer.status !== 'completed' || !amount}>
              {busy ? 'Sending…' : amount ? `Leave ${money(amount)} Tip` : 'Leave a Tip'}
            </Cta>
          </div>
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            {transfer && transfer.status !== 'completed'
              ? 'You can tip once your ride is completed.'
              : 'Thank you for riding with My30A Host.'}
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
          <h2 className="app-xfer-hero-title">Hope Your Ride Was Smooth!</h2>
          <p className="app-xfer-hero-sub">
            If you’d like to thank your driver,
            <br />
            you can leave a tip below.
          </p>
        </div>

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        {transfer ? (
          <section className="app-xfer-card app-xfer-fare">
            <div>
              <h2 className="app-xfer-route">
                {from} <ArrowRight size={22} strokeWidth={2} aria-hidden="true" /> {to}
              </h2>
              <p className="app-xfer-ride-when">
                {shortDate} -- {transfer.time_label}
              </p>
              <p className="app-xfer-ride-meta">
                <span>
                  <Users size={16} strokeWidth={1.5} aria-hidden="true" /> {transfer.passengers} Passengers
                </span>
                <span>
                  <Luggage size={16} strokeWidth={1.5} aria-hidden="true" /> {transfer.bags} Bags
                </span>
              </p>
            </div>
            <div className="app-xfer-fare-price">
              <span>Trip total</span>
              <strong>{usd(transfer.total)}</strong>
            </div>
          </section>
        ) : (
          <p className="app-empty">No completed rides yet.</p>
        )}

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Add A Tip For Your Driver</h2>
          <TipGrid base={base} pick={pick} onPick={onPick} />
        </section>
      </div>
    </TransferShell>
  )
}
