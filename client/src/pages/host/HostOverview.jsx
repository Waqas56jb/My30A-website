import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, CreditCard, Eye, Home, MessageCircle, Plus, QrCode, ShoppingBag, Users } from 'lucide-react'
import { hostPortal, money } from '../../lib/hostPortal.js'

const STATUS = {
  active: ['Active', 'is-ok'],
  trialing: ['Trial', 'is-ok'],
  past_due: ['Payment failed — Stripe is retrying', 'is-warn'],
  pending: ['Waiting for payment', 'is-warn'],
  incomplete: ['Payment not finished', 'is-warn'],
  canceled: ['Canceled', 'is-off'],
  unpaid: ['Unpaid', 'is-off'],
  incomplete_expired: ['Payment expired', 'is-off'],
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

function Stat({ Icon, value, label }) {
  return (
    <div className="hp-stat">
      <span className="hp-stat-ico">
        <Icon size={18} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  )
}

function PlanCard({ sub, plans, homesCount, onChanged }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [qty, setQty] = useState(sub?.quantity || 1)
  const [plan, setPlan] = useState(sub?.plan || 'monthly')
  if (!sub) return null
  const [label, tone] = STATUS[sub.status] || [sub.status, 'is-warn']
  const period = { monthly: 'month', semiannual: '6 months', annual: 'year' }[sub.plan]
  const needsPayment = !sub.live
  if (sub.is_demo) {
    return (
      <section className="hp-card hp-plan">
        <div className="hp-plan-head">
          <div>
            <p className="hp-eyebrow">Host Version plan · {sub.company_name}</p>
            <h2>
              {sub.plan_label} · {sub.quantity} properties
            </h2>
            <p className="hp-muted">Demo plan — on a real account your billing, card and invoices are managed here.</p>
          </div>
          <span className="hp-pill is-ok">Demo</span>
        </div>
      </section>
    )
  }

  async function go(kind) {
    setError('')
    setBusy(kind)
    try {
      if (kind === 'pay') window.location.href = (await hostPortal.checkout({ plan, quantity: Number(qty) })).url
      else if (kind === 'portal') window.location.href = (await hostPortal.portal()).url
      else if (kind === 'qty') {
        await hostPortal.quantity(Number(qty))
        await onChanged()
        setBusy('')
      }
    } catch (err) {
      setError(err?.data?.error || err.message)
      setBusy('')
    }
  }

  return (
    <section className="hp-card hp-plan">
      <div className="hp-plan-head">
        <div>
          <p className="hp-eyebrow">Host Version plan · {sub.company_name}</p>
          <h2>
            {sub.plan_label} · {sub.quantity} propert{sub.quantity === 1 ? 'y' : 'ies'}
          </h2>
          <p className="hp-muted">
            {sub.unit_amount ? `${money(sub.unit_amount)} per property every ${period}` : ''}
            {sub.live && sub.current_period_end ? ` · ${sub.cancel_at_period_end ? 'ends' : 'renews'} ${fmtDate(sub.current_period_end)}` : ''}
          </p>
        </div>
        <span className={`hp-pill ${tone}`}>{label}</span>
      </div>

      {needsPayment ? (
        <div className="hp-plan-pay">
          <p>Finish the payment to switch your QR codes on. Guests can’t open your properties until the plan is active.</p>
          <div className="hp-plan-row">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} — {money(p.price)}/property{p.savings_percent ? ` (save ${p.savings_percent}%)` : ''}
                </option>
              ))}
            </select>
            <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Properties" />
            <button type="button" className="hp-btn is-primary" disabled={busy === 'pay'} onClick={() => go('pay')}>
              <CreditCard size={16} /> {busy === 'pay' ? 'Opening Stripe…' : 'Pay securely'}
            </button>
          </div>
        </div>
      ) : (
        <div className="hp-plan-row">
          <label className="hp-inline">
            Properties on plan
            <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          {Number(qty) !== sub.quantity ? (
            <button type="button" className="hp-btn is-primary" disabled={busy === 'qty'} onClick={() => go('qty')}>
              {busy === 'qty' ? 'Updating…' : `Update to ${qty}`}
            </button>
          ) : null}
          {sub.has_billing ? (
            <button type="button" className="hp-btn" disabled={busy === 'portal'} onClick={() => go('portal')}>
              <CreditCard size={16} /> {busy === 'portal' ? 'Opening…' : 'Billing, card & invoices'}
            </button>
          ) : null}
          {homesCount > sub.quantity ? <span className="hp-warn-text">You have {homesCount} properties — only {sub.quantity} are live.</span> : null}
        </div>
      )}
      {error ? <p className="hp-error">{error}</p> : null}
    </section>
  )
}

export default function HostOverview() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [params] = useSearchParams()

  async function load() {
    try {
      setData(await hostPortal.me())
    } catch (err) {
      setError(err?.data?.error || err.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  if (error) return <p className="hp-error">{error}</p>
  if (!data) return <div className="hp-skel" aria-busy="true" />

  const homes = data.homes || []
  const total = homes.reduce(
    (t, h) => ({
      guests: t.guests + (h.stats?.guests || 0),
      opened: t.opened + (h.stats?.opened || 0),
      vitoria: t.vitoria + (h.stats?.vitoria || 0),
      bookings: t.bookings + (h.stats?.transfer || 0) + (h.stats?.grocery || 0),
    }),
    { guests: 0, opened: 0, vitoria: 0, bookings: 0 }
  )

  return (
    <div className="hp-page">
      <div className="hp-head">
        <div>
          <h1>Welcome{data.profile?.name ? `, ${data.profile.name.split(' ')[0]}` : ''}</h1>
          <p className="hp-muted">Your properties, their QR codes and what your guests are doing — last 30 days.</p>
        </div>
        <Link to="/host/homes/new" className="hp-btn is-primary">
          <Plus size={16} /> Add property
        </Link>
      </div>

      {params.get('checkout') === 'canceled' ? <p className="hp-notice">Payment was canceled — you can finish it any time below.</p> : null}
      {data.subscription?.is_demo ? (
        <div className="hp-demo">
          <strong>You’re exploring the demo dashboard.</strong> Look around freely — editing is switched off here. Open a property’s QR code to see the guest app, then{' '}
          <Link to="/hosts/signup">start your own plan</Link>.
        </div>
      ) : null}

      <PlanCard sub={data.subscription} plans={data.plans || []} homesCount={homes.filter((h) => h.is_active).length} onChanged={load} />

      <section className="hp-stats">
        <Stat Icon={Users} value={total.guests} label="Guests" />
        <Stat Icon={Eye} value={total.opened} label="My Home opens" />
        <Stat Icon={MessageCircle} value={total.vitoria} label="Questions to Vitória" />
        <Stat Icon={ShoppingBag} value={total.bookings} label="Transfers & groceries" />
      </section>

      {homes.length === 0 ? (
        <section className="hp-card hp-empty">
          <Home size={30} />
          <h2>Add your first property</h2>
          <p className="hp-muted">Enter the WiFi, door code, check-in/out and house rules once — then print the QR code for the house.</p>
          <Link to="/host/homes/new" className="hp-btn is-primary">
            <Plus size={16} /> Add property
          </Link>
        </section>
      ) : (
        <section className="hp-grid">
          {homes.map((h) => (
            <article key={h.id} className="hp-card hp-home">
              <Link to={`/host/homes/${h.id}`} className="hp-home-cover" style={h.cover_url ? { backgroundImage: `url("${h.cover_url}")` } : undefined}>
                {h.logo_url ? <img src={h.logo_url} alt="" /> : null}
                <span className={`hp-pill ${h.live ? 'is-ok' : h.over_limit ? 'is-warn' : 'is-off'}`}>
                  {h.live ? 'Live' : !h.is_active ? 'Switched off' : h.over_limit ? 'Not on your plan' : 'Waiting for payment'}
                </span>
              </Link>
              <div className="hp-home-body">
                <h3>{h.home_name}</h3>
                <p className="hp-muted">{[h.address, h.area].filter(Boolean).join(' · ') || '—'}</p>
                <p className="hp-home-stats">
                  <span>
                    <Users size={13} /> {h.stats?.guests || 0}
                  </span>
                  <span>
                    <Eye size={13} /> {h.stats?.opened || 0}
                  </span>
                  <span>
                    <MessageCircle size={13} /> {h.stats?.vitoria || 0}
                  </span>
                  <span>
                    <CalendarClock size={13} /> {(h.stats?.transfer || 0) + (h.stats?.grocery || 0)}
                  </span>
                </p>
                <div className="hp-home-actions">
                  <Link to={`/host/homes/${h.id}`} className="hp-btn">
                    Edit
                  </Link>
                  <Link to={`/host/homes/${h.id}?tab=qr`} className="hp-btn">
                    <QrCode size={15} /> QR code
                  </Link>
                  <Link to={`/host/homes/${h.id}?tab=activity`} className="hp-btn is-ghost">
                    Activity
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
