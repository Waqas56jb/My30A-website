import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorText, guest } from '../../lib/guestApi.js'
import { IconUser, IconMail, IconLock, IconEyeOff, IconEye } from './AuthIcons.jsx'
import AuthLayout from './AuthLayout.jsx'

const LEAD =
  'Create your My30A Host account to book airport transfers, order groceries, and get Vitoria’s local picks for your stay.'

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreed, setAgreed] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in your name, email and password.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy.')
      return
    }
    setBusy(true)
    try {
      const result = await guest.signup({ name: name.trim(), email: email.trim(), password })
      if (!result.session) {
        // Account created but no session came back (rare) — send them to log in instead of
        // waiting forever for a redirect that will never fire.
        navigate('/app/login', { replace: true })
        return
      }
      // AuthContext picks up the new session asynchronously (onAuthStateChange); the
      // redirect below fires once it does, matching the staff Login.jsx pattern.
    } catch (err) {
      setError(err?.status === 409 ? 'An account with this email already exists. Please log in.' : errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!loading && session) {
    return <Navigate to="/app/home" replace />
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">Create your guest account</p>
        <h1 className="auth-title">
          Start your <em>30A stay.</em>
        </h1>
        <p className="auth-lead">{LEAD}</p>

        <label className="auth-field">
          <span className="auth-label">Full name</span>
          <span className="auth-input">
            <IconUser />
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </span>
        </label>

        <label className="auth-field">
          <span className="auth-label">Email</span>
          <span className="auth-input">
            <IconMail />
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </span>
        </label>

        <div className="auth-row">
          <label className="auth-field">
            <span className="auth-label">Password</span>
            <span className="auth-input">
              <IconLock />
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-eye"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? <IconEye /> : <IconEyeOff />}
              </button>
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-label">Confirm password</span>
            <span className="auth-input">
              <IconLock />
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat it"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                className="auth-eye"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <IconEye /> : <IconEyeOff />}
              </button>
            </span>
          </label>
        </div>

        <label className="auth-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className="auth-check" aria-hidden="true">
            <Check size={13} strokeWidth={3} />
          </span>
          <span>
            I agree to the <a href="/#terms">Terms of Service</a> and <a href="/#privacy">Privacy Policy</a>
          </span>
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? <span className="auth-spin" aria-hidden="true" /> : null}
          {busy ? 'Creating account…' : 'Create account'}
          {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/app/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
