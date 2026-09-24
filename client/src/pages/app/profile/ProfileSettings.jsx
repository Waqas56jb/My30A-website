import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, FileText, LogOut, MessageSquareX, ShieldCheck, Trash2, Volume2 } from 'lucide-react'
import { errorText, guest } from '../../../lib/guestApi.js'
import { playChime, setSoundEnabled, soundEnabled } from '../../../lib/notifications.js'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ExploreHead, ExploreShell } from '../explore/ExploreShared.jsx'

const POLICY = [
  '48h+ before pickup: full release — no charge',
  '24–48h before pickup: $50 cancellation fee',
  'Same day or no-show: $75 fee',
  'If we cancel for any reason: full release + $25 credit on your next booking',
  'Grocery orders can be cancelled free until your shopper starts shopping',
]

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`app-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  )
}

export default function ProfileSettings() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [sound, setSound] = useState(soundEnabled())
  const [openPolicy, setOpenPolicy] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [error, setError] = useState('')

  const toggleSound = (next) => {
    setSound(next)
    setSoundEnabled(next)
    if (next) playChime()
  }

  const clearVitoria = async () => {
    if (!window.confirm('Clear your conversation history with Vitoria?')) return
    try {
      await guest.clearVitoria()
      setCleared(true)
    } catch (err) {
      setError(errorText(err))
    }
  }

  const logout = async () => {
    await guest.signOut().catch(() => {})
    await signOut?.()
    navigate('/app/login', { replace: true })
  }

  return (
    <ExploreShell active="profile">
      <ExploreHead title="Settings" sub="Preferences and privacy" back="/app/profile" />
      <div className="app-exp-body app-pf-form">
        <section className="app-set-card">
          <h2 className="app-dine-h">Notifications</h2>
          <div className="app-set-row">
            <span className="app-pf-row-ico is-sand" aria-hidden="true">
              <Volume2 size={18} strokeWidth={1.8} />
            </span>
            <span className="app-set-text">
              <strong>Notification sound</strong>
              <small>Play a chime when there’s an update</small>
            </span>
            <Toggle on={sound} onChange={toggleSound} label="Notification sound" />
          </div>
          <button type="button" className="app-set-row" onClick={() => navigate('/app/notifications')}>
            <span className="app-pf-row-ico is-sea" aria-hidden="true">
              <Bell size={18} strokeWidth={1.8} />
            </span>
            <span className="app-set-text">
              <strong>All notifications</strong>
              <small>Trip, driver and grocery updates</small>
            </span>
            <ChevronRight size={18} strokeWidth={2} className="app-pf-row-chev" />
          </button>
        </section>

        <section className="app-set-card">
          <h2 className="app-dine-h">Privacy</h2>
          <button type="button" className="app-set-row" onClick={clearVitoria}>
            <span className="app-pf-row-ico is-violet" aria-hidden="true">
              <MessageSquareX size={18} strokeWidth={1.8} />
            </span>
            <span className="app-set-text">
              <strong>Clear Vitoria history</strong>
              <small>{cleared ? 'Cleared ✓' : 'Delete your chat with your concierge'}</small>
            </span>
          </button>
          <div className="app-set-row">
            <span className="app-pf-row-ico is-leaf" aria-hidden="true">
              <ShieldCheck size={18} strokeWidth={1.8} />
            </span>
            <span className="app-set-text">
              <strong>Your data</strong>
              <small>Cards are held by Stripe; we never sell your information.</small>
            </span>
          </div>
          <a className="app-set-row" href="mailto:my30ahost@gmail.com?subject=Delete%20my%20My30A%20Host%20account">
            <span className="app-pf-row-ico is-slate" aria-hidden="true">
              <Trash2 size={18} strokeWidth={1.8} />
            </span>
            <span className="app-set-text">
              <strong>Delete my account</strong>
              <small>Email us and we’ll remove your data</small>
            </span>
            <ChevronRight size={18} strokeWidth={2} className="app-pf-row-chev" />
          </a>
        </section>

        <section className="app-set-card">
          <h2 className="app-dine-h">Policies</h2>
          <button type="button" className="app-set-row" onClick={() => setOpenPolicy(!openPolicy)} aria-expanded={openPolicy}>
            <span className="app-pf-row-ico is-sand" aria-hidden="true">
              <FileText size={18} strokeWidth={1.8} />
            </span>
            <span className="app-set-text">
              <strong>Cancellation policy</strong>
              <small>Transfers and grocery orders</small>
            </span>
            <ChevronRight size={18} strokeWidth={2} className={`app-pf-row-chev${openPolicy ? ' is-open' : ''}`} />
          </button>
          {openPolicy ? (
            <ul className="app-set-policy">
              {POLICY.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {error ? <p className="app-inline-error">{error}</p> : null}
        <button type="button" className="app-set-signout" onClick={logout}>
          <LogOut size={17} strokeWidth={2} /> Sign out
        </button>
        <p className="app-set-version">My30A Host · www.my30ahost.com</p>
      </div>
    </ExploreShell>
  )
}
