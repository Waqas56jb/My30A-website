import { useEffect, useRef, useState } from 'react'
import { Phone, User } from 'lucide-react'

export const phoneOk = (phone) => String(phone || '').replace(/\D/g, '').length >= 10

// Guest name + mobile on every booking, so admin, the driver and the shopper can reach them.
// Pre-filled from the guest's profile (never overwriting what they typed); the server saves the
// number to their profile so it's there next time.
export function useContact(profile) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const touched = useRef({})
  useEffect(() => {
    if (!profile) return
    if (!touched.current.name) setName(profile.name || '')
    if (!touched.current.phone) setPhone(profile.phone || '')
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    name,
    phone,
    setName: (v) => ((touched.current.name = true), setName(v)),
    setPhone: (v) => ((touched.current.phone = true), setPhone(v)),
    valid: name.trim().length > 1 && phoneOk(phone),
  }
}

export default function ContactFields({ contact }) {
  return (
    <section className="app-xfer-section">
      <div className="app-xfer-h-group">
        <h2 className="app-xfer-h">Your Contact Details</h2>
        <p className="app-xfer-hint-addr">So your driver, shopper and My30A Host can reach you.</p>
      </div>
      <label className="app-co-field">
        <span>Full name</span>
        <span className="app-contact-in">
          <User size={16} strokeWidth={1.6} aria-hidden="true" />
          <input value={contact.name} onChange={(e) => contact.setName(e.target.value)} autoComplete="name" placeholder="Your full name" />
        </span>
      </label>
      <label className="app-co-field">
        <span>Mobile number</span>
        <span className="app-contact-in">
          <Phone size={16} strokeWidth={1.6} aria-hidden="true" />
          <input
            value={contact.phone}
            onChange={(e) => contact.setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="(850) 555-0123"
          />
        </span>
        {contact.phone && !phoneOk(contact.phone) ? <small className="app-contact-err">Please enter a full phone number.</small> : null}
      </label>
    </section>
  )
}
