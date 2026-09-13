import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { errorText, guest, rememberedName } from '../../lib/guestApi.js'
import {
  IconArrowLeft,
  IconMail,
  IconLock,
  IconEyeOff,
  IconEye,
  IconApple,
  IconGoogle,
} from './AuthIcons.jsx'

const LEAD =
  'Log in to see your stay, track your airport transfer and grocery orders, and chat with Vitoria.'

export default function AppLogin() {
  const navigate = useNavigate()
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
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-signup app-login">
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
                Welcome Back, <span>{name}</span>
              </h1>
              <p className="app-signup-lead">{LEAD}</p>
            </div>

            <div className="app-signup-fields">
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
                  autoComplete="current-password"
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
            </div>

            <div className="app-signup-forgot">
              <a href="mailto:my30ahost@gmail.com?subject=Password%20reset">Forgot Password?</a>
            </div>

            {error ? (
              <p className="app-form-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="app-signup-continue" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>

            <div className="app-signup-or" role="separator">
              <span>OR CONTINUE WITH</span>
            </div>

            <div className="app-signup-social">
              <button type="button" className="app-social app-social-apple">
                <IconApple />
                <span>With Apple</span>
              </button>
              <button type="button" className="app-social app-social-google">
                <IconGoogle />
                <span>With Google</span>
              </button>
            </div>

            <p className="app-signup-footer">
              Don&apos;t have an account? <Link to="/app/signup">Sign up</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
