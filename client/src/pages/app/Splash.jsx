import { Link } from 'react-router-dom'

export default function Splash() {
  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-splash">
          <div className="app-splash-bg" aria-hidden="true" />
          <div className="app-splash-overlay" aria-hidden="true" />

          <div className="app-splash-inner">
            <div className="app-splash-logo-wrap">
              <img
                className="app-splash-logo"
                src="/logoforApp.png"
                alt="M30A"
                width={300}
                height={154}
              />
            </div>

            <div className="app-splash-footer">
              <div className="app-splash-copy">
                <h1 className="app-splash-title">
                  Your Stay. Perfectly
                  <br />
                  Planned.
                </h1>
                <p className="app-splash-body">
                  30A is for people who want to live well. My30A Host is for people who want nothing
                  to get in the way of that.
                </p>
              </div>

              <Link className="app-splash-cta" to="/app/signup">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
