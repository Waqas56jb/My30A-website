import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Info } from 'lucide-react'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { ADDONS, PACKAGES, addonIcon, grandTotal, useCatalog } from './GroceryShared.jsx'

export default function GroceryPackage() {
  const navigate = useNavigate()
  const catalog = useCatalog()
  const [pkg, setPkg] = useState('full')
  const [addons, setAddons] = useState({})
  const packages = catalog?.packages || PACKAGES
  const addonRows = catalog?.addons || ADDONS
  const total = grandTotal({ pkg, addons, stocking: 'bags', catalog })

  return (
    <TransferShell
      title="Order Groceries"
      back="/app/services"
      step={1}
      className="app-groc"
      footer={
        <>
          <div className="app-groc-foot">
            <div className="app-groc-price">
              <span>Estimated price</span>
              <strong>${total} + Publix</strong>
            </div>
            <div className="app-groc-info">
              <Info size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>
                You pay our flat service fee plus the exact Publix receipt. No grocery markup.
              </span>
            </div>
          </div>
          <Cta
            onClick={() =>
              navigate('/app/grocery/stocking', { state: { grocery: { pkg, addons, catalog } } })
            }
          >
            Continue
          </Cta>
        </>
      }
    >
      <div className="app-groc-stack">
        <section className="app-xfer-section">
          <div className="app-xfer-h-group">
            <h2 className="app-xfer-h">Choose Your Package</h2>
            <p className="app-xfer-hint-addr">Select the grocery package that fits your stay.</p>
          </div>
          <div className="app-groc-list">
            {packages.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`app-groc-pkg${pkg === p.key ? ' is-on' : ''}`}
                aria-pressed={pkg === p.key}
                onClick={() => setPkg(p.key)}
              >
                <span className="app-groc-pkg-top">
                  <span className="app-groc-pkg-l">
                    <span className="app-groc-bag" aria-hidden="true">
                      🛍️
                    </span>
                    <span className="app-groc-pkg-text">
                      <strong>{p.name}</strong>
                      <small>{p.items}</small>
                    </span>
                  </span>
                  <span className={`app-xfer-cb is-lg${pkg === p.key ? ' is-on' : ''}`}>
                    {pkg === p.key ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                </span>
                <span className="app-groc-pkg-price">
                  <b>${p.price}</b> {p.unit}
                </span>
              </button>
            ))}
          </div>
        </section>

        {addonRows.length ? (
          <section className="app-xfer-section is-gap-8">
            <h2 className="app-xfer-h">Add-Ons</h2>
            {addonRows.map((addon) => {
              const Icon = addonIcon(addon)
              const { key, name, sub, price, tone } = addon
              return (
                <div key={key} className="app-groc-addon">
                  <span className="app-groc-addon-l">
                    <span className={`app-groc-addon-ico is-${tone}`} aria-hidden="true">
                      <Icon size={14} strokeWidth={1.5} />
                    </span>
                    <span className="app-groc-addon-text">
                      <strong>{name}</strong>
                      <small>{sub}</small>
                    </span>
                  </span>
                  <span className="app-groc-addon-r">
                    <b>+${price}</b>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(addons[key])}
                      aria-label={`${name} add-on`}
                      className={`app-groc-toggle${addons[key] ? ' is-on' : ''}`}
                      onClick={() => setAddons((a) => ({ ...a, [key]: !a[key] }))}
                    >
                      <i />
                    </button>
                  </span>
                </div>
              )
            })}
          </section>
        ) : null}
      </div>
    </TransferShell>
  )
}
