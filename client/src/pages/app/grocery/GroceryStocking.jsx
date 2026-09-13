import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Info } from 'lucide-react'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { STOCKING, SummaryFooter, useGrocery } from './GroceryShared.jsx'

export default function GroceryStocking() {
  const navigate = useNavigate()
  const incoming = useGrocery()
  const options = incoming.catalog?.stocking || STOCKING
  const [stocking, setStocking] = useState(incoming.stocking || 'full-kitchen')
  const grocery = { ...incoming, stocking }

  return (
    <TransferShell
      title="Order Groceries"
      back="/app/grocery"
      step={2}
      className="app-groc"
      footer={
        <>
          <SummaryFooter grocery={grocery} />
          <Cta onClick={() => navigate('/app/grocery/list', { state: { grocery } })}>
            Continue
          </Cta>
        </>
      }
    >
      <div className="app-groc-stack">
        <section className="app-xfer-section">
          <div className="app-xfer-intro">
            <h2 className="app-xfer-h is-20">How Would You Like Your Groceries?</h2>
            <p>Choose how you’d like everything delivered and stocked.</p>
          </div>
          <div className="app-groc-list">
            {options.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`app-groc-opt${stocking === s.key ? ' is-on' : ''}`}
                aria-pressed={stocking === s.key}
                onClick={() => setStocking(s.key)}
              >
                <span className="app-groc-opt-text">
                  <strong>{s.name}</strong>
                  <small>{s.desc}</small>
                </span>
                <span className={`app-xfer-cb is-lg${stocking === s.key ? ' is-on' : ''}`}>
                  {stocking === s.key ? (
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="app-groc-info is-lg">
          <Info size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>You can add special instructions and your grocery list on the next step.</span>
        </div>
      </div>
    </TransferShell>
  )
}
