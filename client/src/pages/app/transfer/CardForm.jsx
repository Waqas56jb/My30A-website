import { useState } from 'react'
import { Calendar, CircleHelp, CreditCard, Lock, User } from 'lucide-react'

export default function CardForm() {
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' })
  const set = (k) => (e) => setCard((c) => ({ ...c, [k]: e.target.value }))

  return (
    <div className="app-xfer-cardform">
      <label className="app-xfer-box">
        <User size={16} strokeWidth={1.5} aria-hidden="true" />
        <input
          type="text"
          placeholder="Cardholder name"
          autoComplete="cc-name"
          value={card.name}
          onChange={set('name')}
        />
      </label>
      <label className="app-xfer-box">
        <CreditCard size={16} strokeWidth={1.5} aria-hidden="true" />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Card number"
          autoComplete="cc-number"
          value={card.number}
          onChange={set('number')}
        />
        <span className="app-xfer-brands" aria-hidden="true">
          <i className="is-visa">VISA</i>
          <i className="is-mc">
            <b />
            <b />
          </i>
          <i className="is-amex">AMEX</i>
          <i className="is-disc">DISC●VER</i>
        </span>
      </label>
      <div className="app-xfer-row-2 is-gap-20">
        <label className="app-xfer-box">
          <Calendar size={16} strokeWidth={1.5} aria-hidden="true" />
          <input
            type="text"
            placeholder="Expiry (MM/YY)"
            autoComplete="cc-exp"
            value={card.expiry}
            onChange={set('expiry')}
          />
        </label>
        <label className="app-xfer-box">
          <Lock size={16} strokeWidth={1.5} aria-hidden="true" />
          <input
            type="text"
            inputMode="numeric"
            placeholder="CVC"
            autoComplete="cc-csc"
            value={card.cvc}
            onChange={set('cvc')}
          />
          <CircleHelp size={16} strokeWidth={1.5} aria-hidden="true" />
        </label>
      </div>
    </div>
  )
}
