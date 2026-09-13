import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Clock, Info, Mail, Upload } from 'lucide-react'
import { errorText, guest } from '../../../lib/guestApi.js'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { Picker, fmtDate, fmtTime, toIso, tomorrow } from '../transfer/TransferBook.jsx'
import { SummaryFooter, useGrocery } from './GroceryShared.jsx'

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
  const [date, setDate] = useState(tomorrow())
  const [time, setTime] = useState('16:00')
  const [agree, setAgree] = useState(true)
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const grocery = { ...incoming, date: fmtDate(date), time: fmtTime(time), deliveryAt: toIso(date, time) }

  const submit = async () => {
    setError('')
    if (!agree) {
      setError('Please agree to the cancellation policy to continue.')
      return
    }
    setBusy(true)
    try {
      let order = await guest.createGrocery({
        package: grocery.pkg,
        stocking: grocery.stocking,
        addons: Object.keys(grocery.addons || {}).filter((key) => grocery.addons[key]),
        delivery_time: grocery.deliveryAt,
        items: [],
        notes: notes.trim() || undefined,
      })
      if (file) {
        try {
          order = await guest.uploadList(order.id, file)
        } catch (err) {
          // The order exists; the screenshot can be re-sent by email.
          setError(`Order created, but the screenshot upload failed: ${errorText(err)}`)
        }
      }
      navigate('/app/grocery/pending', { replace: true, state: { grocery, order } })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
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
          {error ? <p className="app-inline-error">{error}</p> : null}
          <Cta onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Continue to Proceed'}
          </Cta>
          <p className="app-xfer-warn">
            <Info size={16} strokeWidth={1.5} aria-hidden="true" />
            No payment is taken yet. We’ll confirm your exact total before payment.
          </p>
        </>
      }
    >
      <div className="app-groc-stack">
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
      </div>
    </TransferShell>
  )
}
