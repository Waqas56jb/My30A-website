import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Clock, Info, Mail, MapPin, Upload, X } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import CheckoutPayment from '../../../components/CheckoutPayment.jsx'
import { TransferShell } from '../transfer/TransferShell.jsx'
import { Picker, fmtDate, fmtTime, toIso, tomorrow } from '../transfer/TransferBook.jsx'
import { SummaryFooter, addonTotal, serviceFee, useGrocery } from './GroceryShared.jsx'

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

  // Checkout: the card is verified and saved first; only then is the order placed with it. Nothing
  // is charged now — the service fee + the exact Publix receipt are charged once, after delivery.
  const placeOrder = async (paymentMethodId) => {
    setError('')
    if (!address.trim()) throw new Error('Please enter your delivery address.')
    if (!agree) throw new Error('Please agree to the cancellation policy to continue.')
    let order = await guest.createGrocery({
      delivery_address: address.trim(),
      package: grocery.pkg,
      stocking: grocery.stocking,
      addons: Object.keys(grocery.addons || {}).filter((key) => grocery.addons[key]),
      delivery_time: grocery.deliveryAt,
      items: [],
      notes: notes.trim() || undefined,
      payment_method: 'card_on_file',
      payment_method_id: paymentMethodId,
    })
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

        {error ? <p className="app-inline-error">{error}</p> : null}
        <CheckoutPayment
          title="Payment"
          amountLabel={`$${fee} + Publix receipt`}
          note="Nothing is charged today. Your card is saved securely and charged once — the service fee plus your exact Publix receipt, no markup — after your groceries are delivered."
          submitLabel="Place Order"
          disabled={!address.trim() || !agree}
          onPay={placeOrder}
          profile={me}
        />
      </div>
    </TransferShell>
  )
}
