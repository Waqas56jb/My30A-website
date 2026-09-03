import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { setPersistSession } from '../lib/supabase.js'

export default function Login() {
  const { session, activeRole, loading, signIn } = useAuth()
  const emailRef = useRef(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Sign in · My30A Host'
    return () => {
      document.title = 'My30A Ops'
    }
  }, [])

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  if (session) {
    return <Navigate to={activeRole ? `/${activeRole}` : '/'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    setPersistSession(remember)
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError('Email or password is incorrect.')
    }
  }

  return (
    <div className="login">
      <section className="scene">
        <div className="brand">
          My30A Host<small>Operations</small>
        </div>
        <div>
          <h1>Every trip, every order, every dollar in its place.</h1>
          <p>
            Drivers, shoppers and vehicle partners each see only what belongs to them. You see
            everything.
          </p>
        </div>
        <div className="foot">30A, Florida · Central time</div>
        <div className="sun" />
        <div className="wave w1" />
        <div className="wave w2" />
        <div className="wave w3" />
      </section>

      <section className="panel">
        <form className="card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <div className="sub">Driver, partner and shopper access</div>
          <div className={`error${error ? ' show' : ''}`} role="alert">
            {error || 'Email or password is incorrect.'}
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="in">
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="in">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="eye"
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((open) => !open)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="row">
            <label htmlFor="remember">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Keep me signed in
            </label>
          </div>
          <button className="btn" type="submit" disabled={submitting || loading}>
            {submitting ? <span className="spinner" aria-hidden="true" /> : null}
            <span>Sign in</span>
          </button>
          <div className="help">Accounts are created by the admin. There is no self-signup.</div>
        </form>
      </section>
    </div>
  )
}
