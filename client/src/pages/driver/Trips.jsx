import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Car } from 'lucide-react'
import BottomSheet from '../../components/BottomSheet.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import EarningsStrip, { EarningsStripSkeleton } from '../../components/EarningsStrip.jsx'
import { usePageHeader } from '../../components/Layout.jsx'
import Spinner from '../../components/Spinner.jsx'
import TripCard, { TripCardSkeleton } from '../../components/TripCard.jsx'
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
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card / tap' },
  { id: 'wallet', label: 'Apple / Google Pay' },
]

function visibleTrips(trips) {
  return (trips || []).filter((trip) => trip.status !== 'cancelled' && trip.status !== 'refunded')
}

function nextTripLabel(trip, now) {
  if (!trip) return 'No upcoming trips'
  if (trip.status === 'started') return 'Trip in progress'
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
  const [payMethod, setPayMethod] = useState('card_on_file')
  const [wallet, setWallet] = useState('apple_pay')
  const [cashReported, setCashReported] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [revealed, setRevealed] = useState(false)

  const trips = useMemo(() => visibleTrips(tripsQuery.data), [tripsQuery.data])
  const upNext = useMemo(() => {
    return trips
      .filter((trip) => trip.status === 'assigned' || trip.status === 'started')
      .sort((a, b) => {
        if (a.status === 'started' && b.status !== 'started') return -1
        if (b.status === 'started' && a.status !== 'started') return 1
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

  function closeSheet() {
    if (confirming) return
    setCompleting(null)
    setSheetError('')
    setCashReported('')
    setTipAmount('')
    setPayMethod('card_on_file')
    setWallet('apple_pay')
  }

  async function startTrip(trip) {
    setWorkingId(trip.id)
    try {
      await api(`/api/transfers/${trip.id}/start`, { method: 'POST' })
      toast.success('Trip started')
      invalidateQuery('/api/transfers/mine')
      await tripsQuery.refetch()
      setUpdatedAt(Date.now())
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setWorkingId('')
    }
  }

  function openComplete(trip) {
    setCompleting(trip)
    setPayMethod('card_on_file')
    setWallet('apple_pay')
    setCashReported('')
    setTipAmount('')
    setSheetError('')
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
      toast.success('Trip completed')
      setCompleting(null)
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
                    onStart={startTrip}
                    onComplete={openComplete}
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
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    style={{ '--stagger': `${index * 40}ms` }}
                  />
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
          <div className="field">
            <label>How did the guest pay?</label>
            <div className="choices">
              {PAY_CHOICES.map((choice) => {
                const on =
                  choice.id === 'wallet'
                    ? payMethod === 'wallet'
                    : payMethod === choice.id
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={`choice${on ? ' on' : ''}`}
                    onClick={() => setPayMethod(choice.id)}
                  >
                    {choice.label}
                  </button>
                )
              })}
            </div>
            {payMethod === 'wallet' ? (
              <div className="pay-toggle">
                <button
                  type="button"
                  className={wallet === 'apple_pay' ? 'on' : ''}
                  onClick={() => setWallet('apple_pay')}
                >
                  Apple Pay
                </button>
                <button
                  type="button"
                  className={wallet === 'google_pay' ? 'on' : ''}
                  onClick={() => setWallet('google_pay')}
                >
                  Google Pay
                </button>
              </div>
            ) : null}
          </div>
          {payMethod === 'cash' ? (
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
          <div className="field">
            <label htmlFor="tip-received">Tip received (optional)</label>
            <input
              id="tip-received"
              inputMode="decimal"
              placeholder="0.00"
              value={tipAmount}
              onChange={(event) => setTipAmount(event.target.value)}
            />
          </div>
          <div className="note tip">
            Tips are 100% yours. For cash trips you keep your earnings + tip and hand the rest to
            Welson at payout.
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
