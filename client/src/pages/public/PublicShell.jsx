// Frame for the no-login pages reached from an SMS link (trip chat / tip). Same phone-first
// styling as the guest app, but no bottom nav and no back button into logged-in screens.
export default function PublicShell({ title, sub, footer, children }) {
  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home app-xfer">
          <div className="app-xfer-scroll">
            <header className="app-xfer-head app-public-head">
              <img src="/home logo.png" alt="My30A Host" width={62} height={32} className="app-public-logo" />
              <div className="app-public-title">
                <h1 className="app-xfer-title">{title}</h1>
                {sub ? <p>{sub}</p> : null}
              </div>
            </header>
            <div className="app-xfer-content">{children}</div>
          </div>
          {footer ? <div className="app-xfer-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
