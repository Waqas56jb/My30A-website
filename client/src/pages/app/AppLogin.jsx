import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorText, guest, rememberedName } from '../../lib/guestApi.js'
import { IconMail, IconLock, IconEyeOff, IconEye } from './AuthIcons.jsx'
import AuthLayout from './AuthLayout.jsx'

const LEAD =
  'Log in to see your stay, track your airport transfer and grocery orders, and chat with Vitoria.'

export default function AppLogin() {
  const location = useLocation()
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const name = rememberedName() || 'Guest'

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await guest.login({ email: email.trim(), password })
      // AuthContext picks up the new session asynchronously (onAuthStateChange); the
      // redirect below fires once it does, matching the staff Login.jsx pattern.
    } catch (err) {
      setError(err?.status === 401 ? 'Invalid email or password.' : errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!loading && session) {
    const from = location.state?.from
    return <Navigate to={from && from.startsWith('/app/') ? from : '/app/home'} replace />
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">Guest sign in</p>
        <h1 className="auth-title">
          Welcome back, <em>{name}</em>
        </h1>
        <p className="auth-lead">{LEAD}</p>

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

        <div className="auth-field">
          <span className="auth-label">
            <label htmlFor="auth-password">Password</label>
            <a href="mailto:my30ahost@gmail.com?subject=Password%20reset">Forgot password?</a>
          </span>
          <span className="auth-input">
            <IconLock />
            <input
              id="auth-password"
              type={showPass ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
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
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? <span className="auth-spin" aria-hidden="true" /> : null}
          {busy ? 'Logging in…' : 'Log in'}
          {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>

        <p className="auth-switch">
          New to My30A Host? <Link to="/app/signup">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
