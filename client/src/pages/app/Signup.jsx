import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import {
  IconArrowLeft,
  IconUser,
  IconMail,
  IconLock,
  IconEyeOff,
  IconEye,
  IconApple,
  IconGoogle,
} from './AuthIcons.jsx'

const LOREM =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreed, setAgreed] = useState(true)

  const onSubmit = (e) => {
    e.preventDefault()
    navigate('/app/home')
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
              <p className="app-signup-lead">{LOREM}</p>
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

            <button type="submit" className="app-signup-continue">
              Continue
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
              Have an Account? <Link to="/app/login">Login</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
