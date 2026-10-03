import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, MailCheck } from 'lucide-react'
import AuthLayout from '../app/AuthLayout.jsx'
import { IconMail } from '../app/AuthIcons.jsx'
import { api } from '../../lib/api.js'

// Forgot password for every login (staff, guest app, host, Admin): emails a one-time link to
// /reset-password. ?app= decides where "Back to sign in" goes.
export const SIGN_IN = {
  staff: { to: '/login', label: 'Driver, shopper & partner sign in' },
  guest: { to: '/app/login', label: 'Guest sign in' },
  host: { to: '/host/login', label: 'Host sign in' },
  admin: { href: 'https://my30-a-website-admin.vercel.app/login', label: 'Admin sign in' },
}

export function BackToSignIn({ app }) {
  const target = SIGN_IN[app] || SIGN_IN.staff
  return target.href ? <a href={target.href}>Back to {target.label.toLowerCase()}</a> : <Link to={target.to}>Back to {target.label.toLowerCase()}</Link>
}

export default function ForgotPassword() {
  const [params] = useSearchParams()
  const app = SIGN_IN[params.get('app')] ? params.get('app') : 'staff'
  const [email, setEmail] = useState(params.get('email') || '')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Forgot password · My30A Host'
  }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Please enter the email you sign in with.')
    setBusy(true)
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim(), app } })
      setSent(true)
    } catch (err) {
      setError(err?.data?.error || err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout brandable={false}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">{SIGN_IN[app].label}</p>
        {sent ? (
          <>
            <h1 className="auth-title">
              Check your <em>email.</em>
            </h1>
            <p className="auth-lead">
              <MailCheck size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
              If <b>{email.trim()}</b> has a My30A Host login, a link to choose a new password is on its way (from noreply@my30ahost.com — check spam too). The link works once
              and expires in about an hour.
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-title">
              Forgot your <em>password?</em>
            </h1>
            <p className="auth-lead">Enter the email you sign in with and we’ll send you a link to choose a new password.</p>
            <label className="auth-field">
              <span className="auth-label">Email</span>
              <span className="auth-input">
                <IconMail />
                <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? <span className="auth-spin" aria-hidden="true" /> : null}
              {busy ? 'Sending…' : 'Send reset link'}
              {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
            </button>
          </>
        )}
        <p className="auth-switch">
          <BackToSignIn app={app} />
        </p>
      </form>
    </AuthLayout>
  )
}
