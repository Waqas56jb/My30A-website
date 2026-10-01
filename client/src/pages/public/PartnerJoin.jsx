import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Camera, Check, Coffee, Compass, Megaphone, Sparkles, Utensils, Wine } from 'lucide-react'
import AuthLayout from '../app/AuthLayout.jsx'
import { api } from '../../lib/api.js'
import '../../styles/partner-join.css'

// Partner registration (my30ahost.com/partners/join): a 30A business asks to be listed. The
// admin approves it in Admin → Partners and it appears in the right Explore category.

const TYPES = [
  { value: 'restaurant', label: 'Restaurant', Icon: Utensils },
  { value: 'bar', label: 'Bar & Nightlife', Icon: Wine },
  { value: 'coffee', label: 'Coffee & Breakfast', Icon: Coffee },
  { value: 'vendor', label: 'Local service', Icon: Compass },
]

const PERKS = [
  { Icon: Megaphone, text: 'A free listing in the My30A Host guest app' },
  { Icon: Sparkles, text: 'Recommended by Vitoria, our AI concierge' },
  { Icon: BadgeCheck, text: 'Guests call, book and visit you directly' },
]

const EMPTY = {
  listing_type: '',
  guide_slug: '',
  business_name: '',
  description: '',
  website_url: '',
  phone: '',
  email: '',
  contact_name: '',
  address: '',
  community: '',
  hours: '',
  cuisine: '',
  instagram: '',
  company_site: '',
}

function Field({ label, hint, children, wide }) {
  return (
    <label className={`pj-field${wide ? ' is-wide' : ''}`}>
      <span className="auth-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  )
}

export default function PartnerJoin() {
  const [options, setOptions] = useState({ guides: [], communities: [] })
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef(null)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])

  useEffect(() => {
    document.title = 'Become a partner · My30A Host'
    api('/api/public/partner-form')
      .then(setOptions)
      .catch(() => {})
  }, [])

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const set = (key) => (event) => {
    setError('')
    setForm((f) => ({ ...f, [key]: event.target.value }))
  }
  const dining = ['restaurant', 'bar', 'coffee'].includes(form.listing_type)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!form.listing_type) return setError('Please choose what kind of business you are.')
    if (form.listing_type === 'vendor' && !form.guide_slug) return setError('Please choose your category.')
    if (form.business_name.trim().length < 2) return setError('Please add your business name.')
    if (form.description.trim().length < 20) return setError('Please describe your business in a sentence or two.')
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Please add a phone number guests can call.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError('Please add a valid email so we can reach you.')
    if (!photo) return setError('Please add a photo of your business.')
    if (!agreed) return setError('Please confirm you represent this business.')
    setBusy(true)
    try {
      const body = new FormData()
      for (const [key, value] of Object.entries(form)) body.append(key, value)
      body.append('photo', photo, photo.name)
      await api('/api/public/partner-requests', { method: 'POST', body })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const heading = (
    <>
      Get discovered by <em>30A guests.</em>
    </>
  )

  if (done) {
    return (
      <AuthLayout eyebrow="For 30A businesses" heading={heading} perks={PERKS} brandable={false}>
        <div className="auth-form pj-done">
          <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
          <span className="pj-done-ico" aria-hidden="true">
            <Check size={28} strokeWidth={2.4} />
          </span>
          <h1 className="auth-title">
            Thank you, <em>{form.business_name.trim()}.</em>
          </h1>
          <p className="auth-lead">
            We’ve received your request. Our team reviews every partner personally — we’ll email <b>{form.email.trim()}</b> as soon as you’re
            live in the app, usually within 1–2 business days.
          </p>
          <Link to="/" className="auth-submit pj-home">
            Back to My30A Host <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="For 30A businesses" heading={heading} perks={PERKS} brandable={false}>
      <form className="auth-form pj" onSubmit={submit} noValidate>
        <img className="auth-logo" src="/brand/my30a-logo.webp" alt="My30A Host" width="720" height="319" />
        <p className="auth-kicker">Become a partner</p>
        <h1 className="auth-title">
          List your <em>business.</em>
        </h1>
        <p className="auth-lead">
          Restaurants, bars, coffee shops and local services along 30A. Tell us about you — once approved, guests find you in Explore.
        </p>

        <div className="pj-types" role="radiogroup" aria-label="Type of business">
          {TYPES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.listing_type === value}
              className={`pj-type${form.listing_type === value ? ' is-on' : ''}`}
              onClick={() => {
                setError('')
                setForm((f) => ({ ...f, listing_type: value }))
              }}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="pj-grid">
          {form.listing_type === 'vendor' ? (
            <Field label="Category" wide>
              <span className="auth-input pj-select">
                <select value={form.guide_slug} onChange={set('guide_slug')}>
                  <option value="">Choose your category…</option>
                  {options.guides.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </span>
            </Field>
          ) : null}

          <Field label="Business name" wide>
            <span className="auth-input">
              <input value={form.business_name} onChange={set('business_name')} placeholder="Canopy Road Café" autoComplete="organization" />
            </span>
          </Field>

          <Field label="Description" hint={`${form.description.length}/700`} wide>
            <span className="auth-input pj-area">
              <textarea
                rows={4}
                maxLength={700}
                value={form.description}
                onChange={set('description')}
                placeholder="What you offer, what makes you special, who you’re great for."
              />
            </span>
          </Field>

          {dining ? (
            <Field label="Cuisine / style" hint="optional">
              <span className="auth-input">
                <input value={form.cuisine} onChange={set('cuisine')} placeholder="Seafood · Southern" />
              </span>
            </Field>
          ) : null}

          <Field label="Phone">
            <span className="auth-input">
              <input value={form.phone} onChange={set('phone')} placeholder="(850) 555-0123" inputMode="tel" autoComplete="tel" />
            </span>
          </Field>

          <Field label="Website" hint="optional">
            <span className="auth-input">
              <input value={form.website_url} onChange={set('website_url')} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
            </span>
          </Field>

          <Field label="Instagram" hint="optional">
            <span className="auth-input">
              <input value={form.instagram} onChange={set('instagram')} placeholder="@yourbusiness" />
            </span>
          </Field>

          <Field label="Area">
            <span className="auth-input pj-select">
              <select value={form.community} onChange={set('community')}>
                <option value="">Where are you on 30A?</option>
                {options.communities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="30A">Serves all of 30A</option>
              </select>
            </span>
          </Field>

          <Field label="Address" hint="optional" wide={!dining}>
            <span className="auth-input">
              <input value={form.address} onChange={set('address')} placeholder="3547 E County Hwy 30A" autoComplete="street-address" />
            </span>
          </Field>

          <Field label="Opening hours" hint="optional" wide>
            <span className="auth-input">
              <input value={form.hours} onChange={set('hours')} placeholder="Daily 7am–2pm · Closed Tuesdays" />
            </span>
          </Field>

          <Field label="Photo" hint="a great shot of your place, food or service" wide>
            <button type="button" className={`pj-photo${preview ? ' has-photo' : ''}`} onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="" /> : null}
              <span>
                <Camera size={20} strokeWidth={1.8} aria-hidden="true" />
                {preview ? 'Change photo' : 'Add a photo'}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && file.size > 10 * 1024 * 1024) {
                  setError('That photo is over 10 MB — please choose a smaller one.')
                  return
                }
                if (file) setPhoto(file)
              }}
            />
          </Field>

          <Field label="Your name" hint="optional">
            <span className="auth-input">
              <input value={form.contact_name} onChange={set('contact_name')} placeholder="Jane Smith" autoComplete="name" />
            </span>
          </Field>

          <Field label="Email (for your approval)">
            <span className="auth-input">
              <input value={form.email} onChange={set('email')} placeholder="you@business.com" inputMode="email" autoComplete="email" />
            </span>
          </Field>

          {/* Honeypot: hidden from people, bots fill it in. */}
          <input className="pj-hp" tabIndex={-1} autoComplete="off" value={form.company_site} onChange={set('company_site')} aria-hidden="true" />
        </div>

        <label className="auth-agree pj-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => {
              setError('')
              setAgreed(e.target.checked)
            }} />
          <span className="auth-check" aria-hidden="true">
            <Check size={13} strokeWidth={3} />
          </span>
          <span>I represent this business and the details above are accurate.</span>
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? <span className="auth-spin" aria-hidden="true" /> : null}
          {busy ? 'Sending…' : 'Send my request'}
          {busy ? null : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
        <p className="auth-switch">Free to join · We review every request personally</p>
      </form>
    </AuthLayout>
  )
}
