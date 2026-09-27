import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Info } from 'lucide-react'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { PACKAGES, grandTotal, useCatalog } from './GroceryShared.jsx'

export default function GroceryPackage() {
  const navigate = useNavigate()
  const catalog = useCatalog()
  const [pkg, setPkg] = useState('full')
  const addons = {}
  const packages = catalog?.packages || PACKAGES
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

        {/* Rush / Holiday fees are added by My30A Host on an order when they apply — guests don't pick them. */}
      </div>
    </TransferShell>
  )
}
