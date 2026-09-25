import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Clock, DollarSign, Info, Mail, MapPin, Upload, X, Zap } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import CheckoutPayment from '../../../components/CheckoutPayment.jsx'
import { TransferShell } from '../transfer/TransferShell.jsx'
import { Picker, fmtDate, fmtTime, toIso, tomorrow } from '../transfer/TransferBook.jsx'
import { DEFAULT_POLICY, PrepayBreakdown, SummaryFooter, addonTotal, prepayFor, serviceFee, usd, useGrocery } from './GroceryShared.jsx'

const STEPS = [
  <>Open the Publix app or website</>,
  <>Search Water Sound Town Center</>,
  <>Add items to your cart</>,
  <>Open Cart and Review Order</>,
  <>
    <b>IMPORTANT:</b> Tap <i>“View Details”</i> on each item before taking the screenshot
  </>,
  <>Send your screenshots or list to My30A Host</>,
]

export default function GroceryList() {
  const navigate = useNavigate()
  const incoming = useGrocery()
  const [address, setAddress] = useState('')
  const [addressLoaded, setAddressLoaded] = useState(false)
  const addressTouched = useRef(false)
  const [showSugg, setShowSugg] = useState(false)
  const [liveSuggestions, setLiveSuggestions] = useState([])
  const [suggLoading, setSuggLoading] = useState(false)
  const [date, setDate] = useState(tomorrow())
  const [time, setTime] = useState('16:00')
  const [agree, setAgree] = useState(true)
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [cartTotal, setCartTotal] = useState('')
  const [policy, setPolicy] = useState(DEFAULT_POLICY)
  const checkoutKey = useRef(globalThis.crypto?.randomUUID?.() || String(Date.now()))

  // Prefill from the guest's saved stay, same as the transfer flow — but always editable, since
  // groceries might go to a different address than the one on file.
  useEffect(() => {
    let ignore = false
    guest
      .booking()
      .then((b) => {
        if (!ignore && b?.property_address && !addressTouched.current) setAddress(b.property_address)
      })
      .catch(() => {})
      .finally(() => !ignore && setAddressLoaded(true))
    return () => {
      ignore = true
    }
  }, [])

  // Live "as you type" address suggestions (debounced), same 30A-corridor geocoder as transfers.
  useEffect(() => {
    const q = address.trim()
    if (!showSugg || q.length < 3) {
      setLiveSuggestions([])
      setSuggLoading(false)
      return
    }
    let ignore = false
    setSuggLoading(true)
    const t = setTimeout(() => {
      guest
        .addressAutocomplete(q)
        .then((rows) => {
          if (!ignore) setLiveSuggestions(rows || [])
        })
        .catch(() => {
          if (!ignore) setLiveSuggestions([])
        })
        .finally(() => {
          if (!ignore) setSuggLoading(false)
        })
    }, 350)
    return () => {
      ignore = true
      clearTimeout(t)
    }
  }, [address, showSugg])

  const grocery = { ...incoming, date: fmtDate(date), time: fmtTime(time), deliveryAt: toIso(date, time) }

  const { data: me } = useGuestQuery(guest.me, [])
  const fee = serviceFee(grocery) + addonTotal(grocery)

  // Live buffer / rush / notice settings from Admin → Settings (falls back to 5% · 2% · 72h).
  useEffect(() => {
    guest
      .groceryQuote({ package: grocery.pkg, stocking: grocery.stocking })
      .then((q) => q?.policy && setPolicy(q.policy))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cart = Number(String(cartTotal).replace(/[^0-9.]/g, ''))
  const prepay = prepayFor(cart, grocery.deliveryAt, policy)
  const rushSoon = (new Date(grocery.deliveryAt).getTime() - Date.now()) / 3600000 < policy.min_notice_hours
  const noticeDays = Math.round(policy.min_notice_hours / 24)

  // Checkout: the guest prepays their Publix cart total + buffer (+ rush fee) now, so groceries are
  // bought with their money; the service fee is settled against the real receipt after delivery.
  const placeOrder = async (paymentMethodId, { handleAction } = {}) => {
    setError('')
    if (!address.trim()) throw new Error('Please enter your delivery address.')
    if (!prepay) throw new Error('Please enter your Publix cart total.')
    if (!agree) throw new Error('Please agree to the cancellation policy to continue.')
    const payload = {
      delivery_address: address.trim(),
      package: grocery.pkg,
      stocking: grocery.stocking,
      addons: Object.keys(grocery.addons || {}).filter((key) => grocery.addons[key]),
      delivery_time: grocery.deliveryAt,
      items: [],
      notes: notes.trim() || undefined,
      payment_method: 'card_on_file',
      payment_method_id: paymentMethodId,
      cart_estimate: prepay.cart_estimate,
      checkout_key: checkoutKey.current,
    }
    let order = null
    try {
      order = await guest.createGrocery(payload)
    } catch (err) {
      // The bank wants the guest to approve the charge (3-D Secure): show it, then finish the order.
      if (err.status === 402 && err.data?.requires_action && handleAction) {
        await handleAction(err.data.client_secret)
        order = await guest.createGrocery({ ...payload, payment_intent_id: err.data.client_secret.split('_secret_')[0] })
      } else throw err
    }
    if (file) {
      try {
        order = await guest.uploadList(order.id, file)
      } catch (err) {
        // The order exists; the screenshot can be re-sent by email.
        setError(`Order placed, but the screenshot upload failed: ${errorText(err)}`)
      }
    }
    navigate('/app/grocery/pending', { replace: true, state: { grocery, order } })
  }

  return (
    <TransferShell
      title="Order Groceries"
      back="/app/grocery/stocking"
      step={3}
      className="app-groc app-groc-tall"
      footer={
        <>
          <SummaryFooter grocery={grocery} />
        </>
      }
    >
      <div className="app-groc-stack">
        <section className="app-xfer-section">
          <div className="app-xfer-h-group">
            <h2 className="app-xfer-h">Delivery Address</h2>
            <p className="app-xfer-hint-addr">Where should we deliver and stock your groceries?</p>
          </div>
          <div className="app-xfer-dd">
            <label className="app-xfer-box app-xfer-addr">
              <span className="app-xfer-box-l">
                <MapPin size={16} strokeWidth={1.5} aria-hidden="true" />
                <input
                  type="text"
                  value={address}
                  placeholder={addressLoaded ? 'Enter your delivery address' : 'Loading your address…'}
                  onChange={(e) => {
                    addressTouched.current = true
                    setAddress(e.target.value)
                    setShowSugg(true)
                  }}
                  onFocus={() => setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                />
              </span>
              <button
                type="button"
                className="app-xfer-clear"
                aria-label="Clear address"
                onClick={() => {
                  addressTouched.current = true
                  setAddress('')
                  setShowSugg(true)
                }}
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </label>
            {showSugg && liveSuggestions.length ? (
              <div className="app-xfer-sugg">
                {suggLoading ? <small className="app-xfer-sugg-loading">Searching…</small> : null}
                {liveSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`app-xfer-sugg-item${s.label === address ? ' is-on' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      addressTouched.current = true
                      setAddress(s.label)
                      setShowSugg(false)
                    }}
                  >
                    <strong>
                      {s.address?.house_number && s.address?.road
                        ? `${s.address.house_number} ${s.address.road}`
                        : s.label}
                    </strong>
                    <small>
                      {[s.address?.city || s.address?.town || s.address?.village || s.address?.hamlet, s.address?.state]
                        .filter(Boolean)
                        .join(', ') || '30A, FL'}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="app-xfer-section">
          <div className="app-xfer-intro">
            <h2 className="app-xfer-h is-20">Send Your Grocery List</h2>
            <p>Upload your Publix cart screenshot or email your list to us.</p>
          </div>
          <div className="app-groc-list">
            <label className="app-groc-way">
              <span className="app-groc-way-ico" aria-hidden="true">
                <Upload size={24} strokeWidth={1.5} />
              </span>
              <span className="app-groc-way-text">
                <strong>Upload Publix Screenshot</strong>
                <em>
                  <b>{file ? file.name : 'Preferred'}</b>
                  {file ? '' : ' · fastest way to confirm your order'}
                </em>
              </span>
              <input
                type="file"
                accept="image/*"
                className="app-xfer-native"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <a href="mailto:my30ahost@gmail.com" className="app-groc-way">
              <span className="app-groc-way-ico" aria-hidden="true">
                <Mail size={24} strokeWidth={1.5} />
              </span>
              <span className="app-groc-way-text">
                <strong>Email Grocery List</strong>
                <em>
                  <b>my30ahost@gmail.com</b> If you don’t have screenshots available
                </em>
              </span>
            </a>
          </div>
        </section>

        <section className="app-xfer-card app-groc-howto">
          <h3>Publix At Water Sound Town Center</h3>
          <ol className="app-xfer-policy is-lg">
            {STEPS.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="app-xfer-section">
          <div className="app-xfer-intro">
            <h2 className="app-xfer-h is-20">Publix Cart Total</h2>
            <p>The total at the bottom of your Publix cart (tax included). You prepay it + {policy.buffer_percent}% so we shop with your money, not ours — the unused part comes off your service fee.</p>
          </div>
          <label className="app-xfer-box app-groc-cart">
            <DollarSign size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Publix cart total"
              value={cartTotal}
              onChange={(e) => setCartTotal(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </label>
        </section>

        <section className="app-xfer-section">
          <h2 className="app-xfer-h">Delivery Date &amp; Time</h2>
          <div className="app-xfer-row-2 is-gap-10">
            <Picker
              icon={Calendar}
              type="date"
              value={date}
              min={tomorrow()}
              display={fmtDate(date)}
              onChange={setDate}
            />
            <Picker
              icon={Clock}
              type="time"
              value={time}
              display={fmtTime(time)}
              onChange={setTime}
            />
          </div>
          {rushSoon ? (
            <p className="app-groc-rush" role="note">
              <Zap size={16} strokeWidth={2} aria-hidden="true" />
              <span>
                <b>Rush order</b> — delivery in less than {noticeDays} days. A {policy.rush_fee_percent}% rush fee
                {prepay ? ` (${usd(prepay.rush_fee)})` : ''} applies so we can shop for you right away. Pick a date {noticeDays}+ days
                out to avoid it.
              </span>
            </p>
          ) : null}
          <label className="app-xfer-box" style={{ marginTop: 10 }}>
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            <input
              type="text"
              placeholder="Special instructions (gate code, allergies…)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="app-xfer-agree"
            aria-pressed={agree}
            onClick={() => setAgree((a) => !a)}
          >
            <span className={`app-xfer-cb${agree ? ' is-on' : ''}`} aria-hidden="true">
              {agree ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            I understand and agree to the cancellation policy.
          </button>
        </section>

        <PrepayBreakdown p={prepay} serviceFee={fee} />

        {error ? <p className="app-inline-error">{error}</p> : null}
        <CheckoutPayment
          title="Payment"
          amountLabel={prepay ? `${usd(prepay.prepay_amount)} now` : `$${fee} + Publix`}
          note={
            prepay
              ? `We charge ${usd(prepay.prepay_amount)} now to buy your groceries. After delivery your card is charged the ${usd(fee)} service fee, adjusted to your exact Publix receipt — no grocery markup.`
              : 'Enter your Publix cart total above to see what’s charged today.'
          }
          submitLabel={prepay ? `Pay ${usd(prepay.prepay_amount)} & Place Order` : 'Place Order'}
          disabled={!address.trim() || !agree || !prepay}
          onPay={placeOrder}
          profile={me}
        />
      </div>
    </TransferShell>
  )
}
