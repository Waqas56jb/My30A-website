import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, Copy, ExternalLink } from 'lucide-react'
import BottomSheet from '../../components/BottomSheet.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import EarningsStrip, { EarningsStripSkeleton } from '../../components/EarningsStrip.jsx'
import { usePageHeader } from '../../components/Layout.jsx'
import Spinner from '../../components/Spinner.jsx'
import TripCard, { TripCardSkeleton } from '../../components/TripCard.jsx'
import TripChat from '../../components/TripChat.jsx'
import { useToast } from '../../components/Toast.jsx'
import { api, withQuery } from '../../lib/api.js'
import {
  chicagoShortDateLine,
  chicagoToday,
  errorMessage,
  formatCountdown,
  transferRoute,
  usd,
} from '../../lib/format.js'
import { invalidateQuery, useQuery } from '../../lib/useQuery.js'
import { useTitle } from '../../lib/useTitle.js'

const PAY_CHOICES = [
  { id: 'card_on_file', label: 'Card on file' },
  { id: 'card', label: 'Card / tap' },
  { id: 'wallet', label: 'Apple / Google Pay' },
  { id: 'cash', label: 'Cash' },
  { id: 'zelle', label: 'Zelle' },
]

const IN_PROGRESS = ['assigned', 'started', 'arrived', 'picked_up']
const PROGRESS_RANK = { picked_up: 0, arrived: 1, started: 2, assigned: 3 }

function visibleTrips(trips) {
  return (trips || []).filter((trip) => !['cancelled', 'refunded', 'no_show'].includes(trip.status))
}

function nextTripLabel(trip, now) {
  if (!trip) return 'No upcoming trips'
  if (trip.status === 'picked_up') return 'Guest on board'
  if (trip.status === 'arrived') return 'Waiting at pickup'
  if (trip.status === 'started') return 'On the way to pickup'
  const wait = formatCountdown(trip.scheduled_at, now)
  if (wait === 'now') return 'Next trip now'
  return `Next trip in ${wait}`
}

export default function Trips() {
  useTitle('Driver · My30A Host')
  const toast = useToast()
  const today = chicagoToday()
  const tripsPath = withQuery('/api/transfers/mine', { date: today })
  const earningsPath = withQuery('/api/earnings/mine', { range: 'today' })
  const tripsQuery = useQuery(tripsPath)
  const earningsQuery = useQuery(earningsPath)

  const [workingId, setWorkingId] = useState('')
  const [completing, setCompleting] = useState(null)
  const [chatTrip, setChatTrip] = useState(null)
  const [payMethod, setPayMethod] = useState('card_on_file')
  const [wallet, setWallet] = useState('apple_pay')
  const [cashReported, setCashReported] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [payLink, setPayLink] = useState(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [revealed, setRevealed] = useState(false)

  const trips = useMemo(() => visibleTrips(tripsQuery.data), [tripsQuery.data])
  const upNext = useMemo(() => {
    return trips
      .filter((trip) => IN_PROGRESS.includes(trip.status))
      .sort((a, b) => {
        const rank = PROGRESS_RANK[a.status] - PROGRESS_RANK[b.status]
        if (rank) return rank
        return new Date(a.scheduled_at) - new Date(b.scheduled_at)
      })
  }, [trips])
  const done = useMemo(
    () =>
      trips
        .filter((trip) => trip.status === 'completed')
        .sort((a, b) => new Date(b.completed_at || b.scheduled_at) - new Date(a.completed_at || a.scheduled_at)),
    [trips]
  )

  usePageHeader(
    'Today',
    `${chicagoShortDateLine()} · ${trips.length} trip${trips.length === 1 ? '' : 's'}`,
    { updatedAt }
  )

  const tripsRefetch = useRef(tripsQuery.refetch)
  const earningsRefetch = useRef(earningsQuery.refetch)
  tripsRefetch.current = tripsQuery.refetch
  earningsRefetch.current = earningsQuery.refetch

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible') return
      Promise.all([tripsRefetch.current(), earningsRefetch.current()])
        .then(() => setUpdatedAt(Date.now()))
        .catch(() => {})
    }
    const timer = window.setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (!tripsQuery.loading && tripsQuery.data) setUpdatedAt(Date.now())
  }, [tripsQuery.loading, tripsQuery.data])

  useEffect(() => {
    if (!tripsQuery.loading && tripsQuery.data && !revealed) setRevealed(true)
  }, [tripsQuery.loading, tripsQuery.data, revealed])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  async function refreshTrips() {
    invalidateQuery('/api/transfers/mine')
    await tripsQuery.refetch()
    setUpdatedAt(Date.now())
  }

  // One handler for On the way → Arrived → Guest in vehicle (each sends the guest an update).
  async function advance(trip, action, okMessage) {
    setWorkingId(trip.id)
    try {
      await api(`/api/transfers/${trip.id}/${action}`, { method: 'POST' })
      toast.success(okMessage)
      await refreshTrips()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setWorkingId('')
    }
  }

  function closeSheet() {
    if (confirming) return
    setCompleting(null)
    setSheetError('')
    setCashReported('')
    setTipAmount('')
    setPayMethod('card_on_file')
    setWallet('apple_pay')
    setPayLink(null)
  }

  function openComplete(trip) {
    setCompleting(trip)
    setPayMethod(trip.payment_status === 'authorized' || trip.payment_status === 'captured' ? 'card_on_file' : 'card')
    setWallet('apple_pay')
    setCashReported('')
    setTipAmount('')
    setSheetError('')
    setPayLink(trip.pay_link_url ? { url: trip.pay_link_url, paid: false } : null)
  }

  async function generatePayLink() {
    if (!completing) return
    setLinkBusy(true)
    setSheetError('')
    try {
      const link = await api(`/api/transfers/${completing.id}/pay-link`, { method: 'POST' })
      setPayLink(link)
      if (link.paid) toast.success('Guest already paid the link')
    } catch (error) {
      setSheetError(errorMessage(error))
    } finally {
      setLinkBusy(false)
    }
  }

  async function copyLink() {
    if (!payLink?.url) return
    try {
      await navigator.clipboard.writeText(payLink.url)
      toast.success('Link copied — show it to the guest or send it from the chat')
    } catch {
      toast.error('Could not copy; long-press the link instead')
    }
  }

  async function confirmComplete(event) {
    event.preventDefault()
    if (!completing) return
    const method = payMethod === 'wallet' ? wallet : payMethod
    if (method === 'cash') {
      if (cashReported === '' || Number(cashReported) < 0 || Number.isNaN(Number(cashReported))) {
        setSheetError('Enter the cash received from the guest.')
        return
      }
    }
    setConfirming(true)
    setSheetError('')
    try {
      const body = { payment_method: method }
      if (method === 'cash') body.cash_reported = Number(cashReported)
      if (tipAmount !== '') body.tip_amount = Number(tipAmount)
      await api(`/api/transfers/${completing.id}/complete`, { method: 'POST', body })
      toast.success('Trip completed ✔ · Payment recorded · Tip request sent to guest.')
      setCompleting(null)
      setPayLink(null)
      invalidateQuery('/api/transfers/mine')
      invalidateQuery('/api/earnings/mine')
      await Promise.all([tripsQuery.refetch(), earningsQuery.refetch()])
      setUpdatedAt(Date.now())
    } catch (error) {
      setSheetError(errorMessage(error))
    } finally {
      setConfirming(false)
    }
  }

  const loading = tripsQuery.loading
  const summary = earningsQuery.data
  const next = upNext[0]
  const cardOnFile = completing && (completing.payment_status === 'authorized' || completing.payment_status === 'captured')
  const needsLink = payMethod === 'card' || payMethod === 'wallet'

  return (
    <section className="trips-page">
      <div className="trips-main">
        {earningsQuery.loading && !summary ? (
          <EarningsStripSkeleton />
        ) : (
          <EarningsStrip
            trip_earnings={summary?.trip_earnings}
            tips={summary?.tips}
            total={summary?.total}
            totalLabel="Total today"
          />
        )}

        {tripsQuery.error ? <p className="page-error">{errorMessage(tripsQuery.error)}</p> : null}

        {loading ? (
          <>
            <h2>Up next</h2>
            <div className="trip-grid">
              <TripCardSkeleton />
              <TripCardSkeleton />
            </div>
          </>
        ) : (
          <>
            <h2>Up next</h2>
            {upNext.length === 0 ? (
              <EmptyState
                icon={Car}
                title="Nothing upcoming"
                detail="New trips assigned by Welson appear here automatically."
              />
            ) : (
              <div className={`trip-grid${revealed ? ' is-ready' : ''}`}>
                {upNext.map((trip, index) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    pending={workingId === trip.id}
                    onStart={(t) => advance(t, 'start', 'Guest notified: driver on the way')}
                    onArrive={(t) => advance(t, 'arrive', 'Guest notified: you have arrived')}
                    onPickup={(t) => advance(t, 'pickup', 'Guest on board — enjoy the ride')}
                    onComplete={openComplete}
                    onMessage={setChatTrip}
                    style={{ '--stagger': `${index * 40}ms` }}
                  />
                ))}
              </div>
            )}
            <h2>Done today</h2>
            {done.length === 0 ? (
              <p className="section-empty">No completed trips yet.</p>
            ) : (
              <div className={`trip-grid${revealed ? ' is-ready' : ''}`}>
                {done.map((trip, index) => (
                  <TripCard key={trip.id} trip={trip} style={{ '--stagger': `${index * 40}ms` }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <aside className="glance">
        <h2>Today at a glance</h2>
        <div className="glance-stat">
          <div className="l">Trip earnings</div>
          <div className="v">{usd(summary?.trip_earnings)}</div>
        </div>
        <div className="glance-stat tips">
          <div className="l">Tips</div>
          <div className="v">{usd(summary?.tips)}</div>
        </div>
        <div className="glance-stat">
          <div className="l">Total today</div>
          <div className="v">{usd(summary?.total)}</div>
        </div>
        <p className="glance-next">{nextTripLabel(next, now)}</p>
        <Link to="/driver/earnings" className="glance-link">
          View earnings
        </Link>
      </aside>

      <BottomSheet
        open={Boolean(chatTrip)}
        onClose={() => setChatTrip(null)}
        title={chatTrip ? `Trip #${chatTrip.trip_number} · ${chatTrip.guest_name || 'Guest'}` : ''}
        sub={chatTrip ? transferRoute(chatTrip) : ''}
      >
        {chatTrip ? <TripChat trip={chatTrip} /> : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(completing)}
        onClose={closeSheet}
        title={completing ? `Complete trip #${completing.trip_number}` : ''}
        sub={
          completing
            ? `${transferRoute(completing)}${completing.guest_name ? ` · ${completing.guest_name}` : ''}`
            : ''
        }
      >
        <form onSubmit={confirmComplete}>
          {cardOnFile ? (
            <div className="note">
              Card on file is authorized — it is charged automatically when you confirm. Nothing
              else to do.
            </div>
          ) : (
            <div className="field">
              <label>How did the guest pay?</label>
              <div className="choices">
                {PAY_CHOICES.filter((choice) => choice.id !== 'card_on_file').map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`choice${payMethod === choice.id ? ' on' : ''}`}
                    onClick={() => setPayMethod(choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              {payMethod === 'wallet' ? (
                <div className="pay-toggle">
                  <button type="button" className={wallet === 'apple_pay' ? 'on' : ''} onClick={() => setWallet('apple_pay')}>
                    Apple Pay
                  </button>
                  <button type="button" className={wallet === 'google_pay' ? 'on' : ''} onClick={() => setWallet('google_pay')}>
                    Google Pay
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {!cardOnFile && needsLink ? (
            <div className="field">
              <label>Stripe payment link for the guest</label>
              {payLink?.url ? (
                <div className="paylink">
                  <a href={payLink.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Open payment page ({usd(completing?.customer_charge ?? payLink.amount)})
                  </a>
                  <button type="button" className="btn ghost sm" onClick={copyLink}>
                    <Copy size={14} /> Copy link
                  </button>
                </div>
              ) : (
                <button type="button" className="btn ghost" disabled={linkBusy} onClick={generatePayLink}>
                  {linkBusy ? <Spinner size={16} /> : 'Generate payment link'}
                </button>
              )}
              <div className="note">
                Show the page to the guest (or copy the link into the chat). Once they pay, confirm below.
                If they tapped a card on your own reader, just confirm.
              </div>
            </div>
          ) : null}

          {payMethod === 'cash' && !cardOnFile ? (
            <div className="field">
              <label htmlFor="cash-received">Cash received from guest</label>
              <input
                id="cash-received"
                inputMode="decimal"
                placeholder="0.00"
                value={cashReported}
                onChange={(event) => setCashReported(event.target.value)}
                required
              />
            </div>
          ) : null}
          {payMethod === 'zelle' && !cardOnFile ? (
            <div className="note">Confirm only once you’ve seen the Zelle payment land. Welson will verify it.</div>
          ) : null}

          <div className="field">
            <label htmlFor="tip-received">Tip received in person (optional)</label>
            <input
              id="tip-received"
              inputMode="decimal"
              placeholder="0.00"
              value={tipAmount}
              onChange={(event) => setTipAmount(event.target.value)}
            />
          </div>
          <div className="note tip">
            Tips are 100% yours. The guest also gets a tip link automatically after you confirm.
            For cash trips you keep your earnings + tip and hand the rest to Welson at payout.
          </div>
          {sheetError ? <p className="sheet-error">{sheetError}</p> : null}
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={closeSheet} disabled={confirming}>
              Not yet
            </button>
            <button type="submit" className="btn" disabled={confirming}>
              {confirming ? (
                <>
                  <Spinner size={16} /> Saving…
                </>
              ) : (
                'Confirm completed'
              )}
            </button>
          </div>
        </form>
      </BottomSheet>
    </section>
  )
}
