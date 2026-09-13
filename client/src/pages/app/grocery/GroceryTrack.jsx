import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Package,
  X,
} from 'lucide-react'
import { Cta, TransferShell } from '../transfer/TransferShell.jsx'
import { addonList, pkgOf, stockingOf, useGrocery } from './GroceryShared.jsx'

export default function GroceryTrack() {
  const grocery = useGrocery()
  const [decision, setDecision] = useState(null)
  const addons = addonList(grocery)

  return (
    <TransferShell
      title="Track Your Order"
      back="/app/home"
      className="app-groc-track"
      footer={<Cta to="/app/home">Back to Home</Cta>}
    >
      <div className="app-xfer-stack">
        <section className="app-xfer-ride">
          <div className="app-xfer-ride-body">
            <span className="app-xfer-pill is-live">
              <i /> Live Updates
            </span>
            <span className="app-groc-ride-pkg">
              <span className="app-groc-bag" aria-hidden="true">
                🛍️
              </span>
              <span className="app-groc-pkg-text">
                <strong>{pkgOf(grocery).name}</strong>
                <small>
                  {pkgOf(grocery).items}, {stockingOf(grocery).name}
                </small>
              </span>
            </span>
            <p className="app-xfer-ride-when">
              {grocery.date} · {grocery.time}
            </p>
            <strong className="app-xfer-ride-kind">
              {addons.length ? addons.map((a) => a.name).join(' · ') : 'Standard delivery'}
            </strong>
          </div>
          <div className="app-xfer-ride-art is-groc" aria-hidden="true">
            <span>🛍️</span>
          </div>
        </section>

        <ol className="app-xfer-tl">
          <li className="app-xfer-tl-item is-done">
            <span className="app-xfer-tl-mark" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            <div className="app-xfer-tl-body">
              <div className="app-xfer-tl-head">
                <h3>Confirmed</h3>
              </div>
              <span className="app-xfer-tl-time">10:04 AM</span>
              <p>Your order has been confirmed.</p>
            </div>
          </li>
          <li className="app-xfer-tl-item is-done">
            <span className="app-xfer-tl-mark" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            <div className="app-xfer-tl-body">
              <div className="app-xfer-tl-head">
                <h3>Driver on the way</h3>
                <MapPin size={18} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <span className="app-xfer-tl-time">2:45 PM</span>
              <p>Michael is on the way to your home.</p>
            </div>
          </li>
          <li className="app-xfer-tl-item is-live">
            <span className="app-xfer-tl-mark" aria-hidden="true">
              <Package size={16} strokeWidth={1.5} />
            </span>
            <div className="app-xfer-tl-body">
              <div className="app-xfer-tl-head">
                <h3>
                  Substitution needed
                  <span className="app-xfer-pill is-live is-sm">
                    <i /> Live
                  </span>
                </h3>
              </div>
              <span className="app-xfer-tl-time">3:28 PM</span>
              <div className="app-groc-sub">
                <div className="app-groc-sub-msg">
                  <span className="app-groc-avatar" aria-hidden="true" />
                  <p>
                    Publix is out of the 12-pack sparkling water you requested. Would you like us
                    to substitute with the 8-pack sparkling water for $1.50 less?
                  </p>
                </div>
                {decision ? (
                  <p className="app-groc-sub-done">
                    {decision === 'approve'
                      ? 'Substitution approved — we’ll swap it for you.'
                      : 'Substitution declined — we’ll skip and refund this item.'}
                  </p>
                ) : (
                  <div className="app-groc-sub-actions">
                    <button type="button" onClick={() => setDecision('approve')}>
                      Approve <Check size={16} strokeWidth={2} className="is-ok" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDecision('decline')}>
                      Decline <X size={16} strokeWidth={2} className="is-no" aria-hidden="true" />
                    </button>
                  </div>
                )}
                {decision ? null : (
                  <p className="app-groc-sub-warn">
                    <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
                    Please respond within 30 minutes or we’ll skip the item and refund it
                    automatically
                  </p>
                )}
              </div>
            </div>
          </li>
          <li className="app-xfer-tl-item is-pending">
            <span className="app-xfer-tl-mark" aria-hidden="true" />
            <div className="app-xfer-tl-body">
              <div className="app-xfer-tl-head">
                <h3>On the way</h3>
              </div>
              <span className="app-xfer-tl-time">Pending</span>
              <p>Your order is on the way to your home.</p>
            </div>
          </li>
          <li className="app-xfer-tl-item is-pending">
            <span className="app-xfer-tl-mark" aria-hidden="true" />
            <div className="app-xfer-tl-body">
              <div className="app-xfer-tl-head">
                <h3>Delivered</h3>
              </div>
              <span className="app-xfer-tl-time">Pending</span>
              <p>We’ll let you know when your order is delivered.</p>
            </div>
          </li>
        </ol>

        <section className="app-xfer-card is-tight app-groc-msgs">
          <p className="app-xfer-instr-h">
            <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" /> Messages
          </p>
          <div className="app-groc-msg">
            <span className="app-groc-avatar is-lg" aria-hidden="true" />
            <p>
              Your order is being prepared with food-safe handling and stacking. We’ll keep you
              updated!
            </p>
          </div>
          <span className="app-groc-msg-time">2:15 PM</span>
        </section>

        <section className="app-xfer-help">
          <div>
            <strong>Need anything?</strong>
            <em>Message Vitoria for any help during your trip.</em>
          </div>
          <Link to="/app/vitoria" className="app-xfer-help-link">
            Message Vitoria <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </TransferShell>
  )
}
