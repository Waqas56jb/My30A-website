import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BarChart3, Check, CreditCard, Lock, Minus, Plus, QrCode, Sparkles } from 'lucide-react'
import AuthLayout from '../app/AuthLayout.jsx'
import { hostPortal, money } from '../../lib/hostPortal.js'
import { supabase } from '../../lib/supabase.js'
import { setAccessToken } from '../../lib/api.js'
import '../../styles/partner-join.css'

// Host Version signup (my30ahost.com/hosts/signup): account + plan + number of properties, then
// Stripe Checkout. The account exists right away; the plan switches on once Stripe confirms.
const PERKS = [
  { Icon: QrCode, text: 'Your logo on every guest’s phone' },
  { Icon: Sparkles, text: 'Vitória answers house questions 24/7' },
  { Icon: BarChart3, text: 'See how guests use each property' },
]
const FALLBACK = [
  { key: 'monthly', label: 'Monthly', price: 14.99, per_month: 14.99, months: 1, savings_percent: 0 },
  { key: 'semiannual', label: 'Every 6 months', price: 79.99, per_month: 13.33, months: 6, savings_percent: 11 },
  { key: 'annual', label: 'Annual', price: 149.99, per_month: 12.5, months: 12, savings_percent: 17 },
]

export default function HostSignup() {
  const [params] = useSearchParams()
  const [plans, setPlans] = useState(FALLBACK)
  const [plan, setPlan] = useState(['monthly', 'semiannual', 'annual'].includes(params.get('plan')) ? params.get('plan') : 'annual')
  const [qty, setQty] = useState(Math.min(500, Math.max(1, Number(params.get('qty')) || 1)))
  const [form, setForm] = useState({ name: '', company_name: '', email: '', phone: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Start your Host Version · My30A Host'
    hostPortal
      .plans()
      .then((r) => r.plans?.length && setPlans(r.plans))
      .catch(() => {})
  }, [])

  const chosen = plans.find((p) => p.key === plan) || plans[0]
  const period = { monthly: 'month', semiannual: '6 months', annual: 'year' }[chosen.key]
  const set = (k) => (e) => {
    setError('')
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) return setError('Please add your name.')
    if (form.company_name.trim().length < 2) return setError('Please add your company or brand name — guests see it.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError('Please add a valid email.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (!agreed) return setError('Please accept the terms to continue.')
    setBusy(true)
    try {
      const result = await hostPortal.signup({ ...form, email: form.email.trim(), plan, quantity: qty })
      if (result.session && supabase) {
        setAccessToken(result.session.access_token)
        await supabase.auth.setSession(result.session)
      }
      window.location.href = result.checkout_url
    } catch (err) {
      setError(err?.data?.error || err.message || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout eyebrow="Host Version · for 30A rentals" heading={<>Your brand. <em>Our concierge.</em></>} perks={PERKS} brandable={false}>
      <form className="auth-form pj" onSubmit={submit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">Start your Host Version</p>
        <h1 className="auth-title">
          Create your <em>account.</em>
        </h1>
        <p className="auth-lead">Pick a plan, pay securely with Stripe, then add your property and print its QR code.</p>

        <div className="pj-types hs-plans" role="radiogroup" aria-label="Plan">
          {plans.map((p) => (
            <button key={p.key} type="button" role="radio" aria-checked={p.key === plan} className={`pj-type${p.key === plan ? ' is-on' : ''}`} onClick={() => setPlan(p.key)}>
              <strong>{p.label}</strong>
              <span>
                {money(p.price)}
                <small> /property</small>
              </span>
              {p.savings_percent ? <em>Save {p.savings_percent}%</em> : <em className="is-blank">&nbsp;</em>}
            </button>
          ))}
        </div>

        <div className="hs-qty">
          <span>Properties</span>
          <div className="hs-stepper">
            <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Minus size={16} />
            </button>
            <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} aria-label="Number of properties" />
            <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(500, q + 1))}>
              <Plus size={16} />
            </button>
          </div>
          <b>
            {money(chosen.price * qty)} / {period}
          </b>
        </div>

        <div className="pj-grid">
          <label className="pj-field">
            <span className="auth-label">Your name</span>
            <span className="auth-input">
              <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Nick Smith" />
            </span>
          </label>
          <label className="pj-field">
            <span className="auth-label">Company / brand</span>
            <span className="auth-input">
              <input value={form.company_name} onChange={set('company_name')} autoComplete="organization" placeholder="StayOn30A" />
            </span>
          </label>
          <label className="pj-field">
            <span className="auth-label">Email</span>
            <span className="auth-input">
              <input value={form.email} onChange={set('email')} type="email" inputMode="email" autoComplete="email" placeholder="you@company.com" />
            </span>
          </label>
          <label className="pj-field">
            <span className="auth-label">
              Phone <small>optional</small>
            </span>
            <span className="auth-input">
              <input value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="(850) 555-0123" />
            </span>
          </label>
          <label className="pj-field is-wide">
            <span className="auth-label">Password</span>
            <span className="auth-input">
              <Lock size={18} />
              <input value={form.password} onChange={set('password')} type="password" autoComplete="new-password" placeholder="At least 8 characters" />
            </span>
          </label>
        </div>

        <label className="auth-agree pj-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className="auth-check" aria-hidden="true">
            <Check size={13} strokeWidth={3} />
          </span>
          <span>I agree to the subscription terms: billed every {period} per property until I cancel; I can cancel any time from my dashboard.</span>
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? <span className="auth-spin" aria-hidden="true" /> : <CreditCard size={18} />}
          {busy ? 'Opening secure payment…' : `Continue to payment · ${money(chosen.price * qty)}`}
          {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
        <p className="auth-switch">
          Already a host? <Link to="/host/login">Sign in</Link> · <Link to="/hosts">Back to plans</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
