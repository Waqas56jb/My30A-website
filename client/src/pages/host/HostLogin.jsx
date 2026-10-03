import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, BarChart3, QrCode, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import AuthLayout from '../app/AuthLayout.jsx'
import { IconEye, IconEyeOff, IconLock, IconMail } from '../app/AuthIcons.jsx'

// Public, read-only demo account (server/scripts/seed-host-demo.js).
const DEMO = { email: 'demo.host@my30ahost.com', password: 'Demo-My30A-2026' }

const PERKS = [
  { Icon: QrCode, text: 'Your brand on every guest’s phone' },
  { Icon: Sparkles, text: 'Vitória answers house questions 24/7' },
  { Icon: BarChart3, text: 'See how guests use your property' },
]

export default function HostLogin() {
  const { session, profile, loading, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [params] = useSearchParams()

  useEffect(() => {
    document.title = 'Host sign in · My30A Host'
  }, [])

  async function tryDemo() {
    setError('')
    setBusy(true)
    const { error: err } = await signIn(DEMO.email, DEMO.password)
    setBusy(false)
    if (err) setError('The demo is unavailable right now — please try again in a minute.')
  }

  useEffect(() => {
    if (params.get('demo') === '1' && !session) tryDemo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loading && session && (profile?.roles || []).includes('host')) {
    const from = location.state?.from
    return <Navigate to={from && from.startsWith('/host') ? from : '/host'} replace />
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Please enter your email and password.')
    setBusy(true)
    const { error: err } = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(/invalid/i.test(err.message) ? 'Invalid email or password.' : err.message)
  }

  return (
    <AuthLayout eyebrow="For hosts & property managers" heading={<>Your guests, <em>taken care of.</em></>} perks={PERKS} brandable={false}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">Host sign in</p>
        <h1 className="auth-title">
          Welcome <em>back.</em>
        </h1>
        <p className="auth-lead">Manage your properties, QR codes, guest activity and billing.</p>
        {session && profile && !(profile.roles || []).includes('host') ? (
          <p className="auth-error">You’re signed in with a non-host account ({profile.email}). Sign in with your host email below.</p>
        ) : null}
        <label className="auth-field">
          <span className="auth-label">Email</span>
          <span className="auth-input">
            <IconMail />
            <input type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </span>
        </label>
        <div className="auth-field">
          <span className="auth-label">
            <label htmlFor="host-password">Password</label>
            <a href="mailto:my30ahost@gmail.com?subject=Host%20password%20reset">Forgot password?</a>
          </span>
          <span className="auth-input">
            <IconLock />
            <input id="host-password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="auth-eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)}>
              {show ? <IconEye /> : <IconEyeOff />}
            </button>
          </span>
        </div>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? <span className="auth-spin" aria-hidden="true" /> : null}
          {busy ? 'Signing in…' : 'Sign in'}
          {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
        <button type="button" className="hp-demo-btn" onClick={tryDemo} disabled={busy}>
          Just looking? <b>Try the demo dashboard</b>
        </button>
        <p className="auth-switch">
          New host? <Link to="/hosts">See plans &amp; sign up</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
