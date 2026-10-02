import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, PauseCircle, Sparkles } from 'lucide-react'
import { api } from '../lib/api.js'
import BottomNav from '../pages/app/BottomNav.jsx'

// Service availability (Admin → Settings): when Transfer or Grocery is paused, its request screens
// show the admin's message and back-online time instead of the form. Checked fresh on every open,
// so a toggle in Admin takes effect immediately. The server refuses requests too.
const TITLES = { transfer: 'Airport transfers are paused', grocery: 'Grocery delivery is paused' }

export function useServiceStatus() {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    let ignore = false
    api('/api/guest/service-status')
      .then((data) => {
        if (!ignore) setStatus(data)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])
  return status
}

export default function ServiceGate({ kind, children }) {
  const status = useServiceStatus()
  const st = status?.[kind]
  if (!st?.paused) return children

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home">
          <div className="app-home-scroll">
            <div className="svc-paused app-enter">
              <span className="svc-paused-ico" aria-hidden="true">
                <PauseCircle size={34} strokeWidth={1.6} />
              </span>
              <h1>{TITLES[kind]}</h1>
              <p>{st.message}</p>
              {st.resume_label ? (
                <span className="svc-paused-when">
                  <CalendarClock size={16} strokeWidth={1.8} aria-hidden="true" />
                  Back online {st.resume_label}
                </span>
              ) : null}
              <div className="svc-paused-actions">
                <Link to="/app/vitoria" className="svc-paused-btn is-primary">
                  <Sparkles size={17} strokeWidth={1.8} aria-hidden="true" /> Ask Vitoria
                </Link>
                <Link to="/app/services" className="svc-paused-btn">
                  Back to Services
                </Link>
              </div>
            </div>
          </div>
          <BottomNav active="services" />
        </div>
      </div>
    </div>
  )
}
