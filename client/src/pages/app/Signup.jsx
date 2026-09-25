import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorText, guest } from '../../lib/guestApi.js'
import { IconArrowLeft, IconUser, IconMail, IconLock, IconEyeOff, IconEye } from './AuthIcons.jsx'

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
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-signup">
          <div className="app-signup-bg" aria-hidden="true" />
          <div className="app-signup-overlay" aria-hidden="true" />

          <header className="app-signup-top">
            <button
              type="button"
              className="app-signup-back"
              aria-label="Back"
              onClick={() => navigate('/app')}
            >
              <IconArrowLeft />
            </button>
            <img
              className="app-signup-logo"
              src="/logoforApp.png"
              alt="M30A"
              width={194}
              height={100}
            />
          </header>

          <form className="app-signup-card" onSubmit={onSubmit}>
            <div className="app-signup-head">
              <h1 className="app-signup-title">
                Create an <span>Account</span>
              </h1>
              <p className="app-signup-lead">{LEAD}</p>
            </div>

            <div className="app-signup-fields">
              <label className="app-field">
                <span className="app-field-icon">
                  <IconUser />
                </span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="app-field">
                <span className="app-field-icon">
                  <IconMail />
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="app-field">
                <span className="app-field-icon">
                  <IconLock />
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="app-field-toggle"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? <IconEye /> : <IconEyeOff />}
                </button>
              </label>

              <label className="app-field">
                <span className="app-field-icon">
                  <IconLock />
                </span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Confirm Password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className="app-field-toggle"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <IconEye /> : <IconEyeOff />}
                </button>
              </label>
            </div>

            <label className="app-signup-agree">
              <input
                type="checkbox"
                className="app-cb-input"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span className={`app-cb${agreed ? ' is-on' : ''}`} aria-hidden="true">
                {agreed ? <Check size={12} strokeWidth={2.5} /> : null}
              </span>
              <span>
                I agree with the <a href="#terms">Terms of Service</a>
                {' | '}
                <a href="#privacy">Privacy Policy</a>
              </span>
            </label>

            {error ? (
              <p className="app-form-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="app-signup-continue" disabled={busy}>
              {busy ? 'Creating account…' : 'Continue'}
            </button>

            <p className="app-signup-footer">
              Have an Account? <Link to="/app/login">Login</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
