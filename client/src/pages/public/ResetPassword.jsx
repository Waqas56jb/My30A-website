import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import AuthLayout from '../app/AuthLayout.jsx'
import { IconEye, IconEyeOff, IconLock } from '../app/AuthIcons.jsx'
import { supabase } from '../../lib/supabase.js'
import { setAccessToken } from '../../lib/api.js'
import { BackToSignIn, SIGN_IN } from './ForgotPassword.jsx'

// Opened from the reset email (?token=…&app=…): pick a new password. The one-time token is only
// used when the form is submitted, so an email scanner opening the link doesn't burn it.
export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const app = SIGN_IN[params.get('app')] ? params.get('app') : 'staff'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = 'Choose a new password · My30A Host'
  }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    if (!supabase) return setError('The app isn’t configured.')
    setBusy(true)
    try {
      const { data, error: otpError } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' })
      if (otpError || !data?.session) throw new Error('This reset link has expired or was already used. Please ask for a new one.')
      setAccessToken(data.session.access_token)
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)
      setDone(true)
      // Admin lives on its own site: sign out here and send them there to sign in.
      if (app === 'admin') await supabase.auth.signOut()
      else window.setTimeout(() => navigate(app === 'guest' ? '/app/home' : app === 'host' ? '/host' : '/login', { replace: true }), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout brandable={false}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">{SIGN_IN[app].label}</p>
        {done ? (
          <>
            <h1 className="auth-title">
              Password <em>updated.</em>
            </h1>
            <p className="auth-lead">
              <CheckCircle2 size={18} style={{ verticalAlign: '-3px', marginRight: 6, color: '#0f8a62' }} />
              {app === 'admin' ? 'Sign in to Admin with your new password.' : 'You’re signed in — taking you to the app…'}
            </p>
            {app === 'admin' ? (
              <a className="auth-submit" href={SIGN_IN.admin.href} style={{ textDecoration: 'none' }}>
                Go to Admin <ArrowRight size={18} />
              </a>
            ) : null}
          </>
        ) : !token ? (
          <>
            <h1 className="auth-title">
              Link not <em>valid.</em>
            </h1>
            <p className="auth-lead">This page needs the link from your reset email.</p>
            <Link className="auth-submit" to={`/forgot-password?app=${app}`} style={{ textDecoration: 'none' }}>
              Send a new link <ArrowRight size={18} />
            </Link>
          </>
        ) : (
          <>
            <h1 className="auth-title">
              Choose a new <em>password.</em>
            </h1>
            <p className="auth-lead">At least 8 characters. You’ll use it to sign in from now on.</p>
            <div className="auth-field">
              <span className="auth-label">
                <label htmlFor="reset-new">New password</label>
              </span>
              <span className="auth-input">
                <IconLock />
                <input id="reset-new" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
                <button type="button" className="auth-eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)}>
                  {show ? <IconEye /> : <IconEyeOff />}
                </button>
              </span>
            </div>
            <div className="auth-field">
              <span className="auth-label">
                <label htmlFor="reset-confirm">Repeat it</label>
              </span>
              <span className="auth-input">
                <IconLock />
                <input id="reset-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" />
              </span>
            </div>
            {error ? (
              <p className="auth-error" role="alert">
                {error}{' '}
                {/expired|used/.test(error) ? <Link to={`/forgot-password?app=${app}`}>Send a new link</Link> : null}
              </p>
            ) : null}
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? <span className="auth-spin" aria-hidden="true" /> : null}
              {busy ? 'Saving…' : 'Save new password'}
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
