import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bike,
  Bot,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronRight,
  CircleParking,
  CircleUserRound,
  CookingPot,
  Copy,
  Flame,
  House,
  Info,
  KeyRound,
  PawPrint,
  Phone,
  QrCode,
  Sun,
  Trash2,
  Tv,
  Umbrella,
  Users,
  WashingMachine,
  WavesLadder,
} from 'lucide-react'
import BottomNav from './BottomNav.jsx'
import NotificationBell from '../../components/NotificationBell.jsx'
import { errorText, useGuestQuery } from '../../lib/guestApi.js'
import { loadMyHome } from '../../lib/hostHome.js'

// Host version "My Home" tab (Figma "Screen 2"): the property the guest scanned in — access,
// stay times, house instructions and rules, the host's contact, socials and their other listings.
// Everything is entered by the admin in Admin → Host homes.

const INSTRUCTION_ICONS = {
  tv: Tv,
  thermostat: Sun,
  kitchen: CookingPot,
  trash: Trash2,
  laundry: WashingMachine,
  pool: WavesLadder,
  grill: Flame,
  beach: Umbrella,
  bike: Bike,
  key: KeyRound,
  info: Info,
}

const TIME_ZONE = 'America/Chicago'

function todayInFlorida() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

// "Checkout Tomorrow at 10:00 AM." — from the stay dates in the guest's profile, when they gave them.
function checkoutLine(date, time) {
  const at = time ? ` at ${time}` : ''
  if (!date) return time ? `Checkout is${at}.` : null
  const days = Math.round((new Date(`${date}T12:00:00Z`) - new Date(`${todayInFlorida()}T12:00:00Z`)) / 86400000)
  if (days < 0) return null
  if (days === 0) return { lead: 'Checkout Today', rest: `${at}.` }
  if (days === 1) return { lead: 'Checkout Tomorrow', rest: `${at}.` }
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return { lead: `Checkout ${day}`, rest: `${at}.` }
}

function socialUrl(kind, value) {
  const v = String(value || '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  const handle = v.replace(/^@/, '')
  if (kind === 'instagram') return `https://instagram.com/${handle}`
  if (kind === 'facebook') return `https://facebook.com/${handle}`
  return `https://www.tiktok.com/@${handle}`
}

function socialHandle(value) {
  const v = String(value || '').trim()
  if (!/^https?:\/\//i.test(v)) return v.startsWith('@') || !v ? v : `@${v}`
  try {
    const path = new URL(v).pathname.split('/').filter(Boolean)[0] || ''
    return path ? (path.startsWith('@') ? path : `@${path}`) : new URL(v).hostname
  } catch {
    return v
  }
}

function siteLabel(url) {
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function hrefFor(url) {
  return /^https?:/i.test(url) ? url : `https://${url}`
}

const IconInstagram = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" />
  </svg>
)
const IconFacebook = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="currentColor" d="M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.3c0-.9.3-1.5 1.6-1.5h1.7V4a22 22 0 0 0-2.5-.1c-2.5 0-4.1 1.5-4.1 4.2v2.2H7.4v3.2h2.8v8z" />
  </svg>
)
const IconTikTok = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="currentColor" d="M16.6 3c.3 2.3 1.6 3.8 3.9 4v3a7 7 0 0 1-3.9-1.2v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.8 2.5V3z" />
  </svg>
)

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setDone(true)
    window.setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" className={`mh-copy${done ? ' is-done' : ''}`} onClick={copy} aria-label={`Copy ${label}`}>
      {done ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={1.8} />}
      <span>{done ? 'Copied' : ''}</span>
    </button>
  )
}

function Row({ icon: Icon, label, value, copy, href }) {
  const body = (
    <>
      {Icon ? (
        <span className="mh-ico" aria-hidden="true">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      ) : null}
      <span className="mh-row-text">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </>
  )
  return (
    <div className="mh-row">
      {href ? (
        <a className="mh-row-main" href={href}>
          {body}
        </a>
      ) : (
        <div className="mh-row-main">{body}</div>
      )}
      {copy ? <CopyButton value={value} label={label} /> : null}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <section className="mh-card app-rise">
      <h2 className="mh-card-title">{title}</h2>
      {children}
    </section>
  )
}

function NoHome() {
  return (
    <div className="mh-empty">
      <span className="mh-empty-ico" aria-hidden="true">
        <QrCode size={30} strokeWidth={1.6} />
      </span>
      <h1>Your home on 30A</h1>
      <p>Scan the QR code inside your rental and your home’s WiFi, door code, check-out time and house rules will appear here.</p>
      <Link to="/app/home" className="mh-empty-btn">
        Back to Home
      </Link>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mh-body" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="mh-card">
          <span className="app-skel app-skel-line" style={{ width: 90 }} />
          <span className="app-skel app-skel-line" style={{ width: '70%', height: 18, marginTop: 18 }} />
          <span className="app-skel app-skel-line" style={{ width: '55%', height: 18, marginTop: 18 }} />
        </div>
      ))}
    </div>
  )
}

export default function MyHome() {
  const { data, loading, error } = useGuestQuery(loadMyHome, [])
  const home = data?.home
  const checkout = home ? checkoutLine(data.check_out_date, home.check_out_time) : null
  const socials = home
    ? [
        { kind: 'instagram', name: 'Instagram', value: home.instagram, Icon: IconInstagram },
        { kind: 'facebook', name: 'Facebook', value: home.facebook, Icon: IconFacebook },
        { kind: 'tiktok', name: 'TikTok', value: home.tiktok, Icon: IconTikTok },
      ].filter((s) => s.value)
    : []
  const stayRows = home
    ? [
        home.check_in_time && { icon: CalendarCheck, label: 'Check in', value: home.check_in_time },
        home.check_out_time && { icon: CalendarClock, label: 'Check-out', value: home.check_out_time },
        home.max_guests && { icon: Users, label: 'Max guests', value: `Up to ${home.max_guests} guests` },
        home.pets && { icon: PawPrint, label: 'Pets', value: home.pets },
      ].filter(Boolean)
    : []
  const hasAccess = home && (home.wifi_network || home.wifi_password || home.door_code || home.parking)
  const hasNextStay = home && (home.website_url || home.airbnb_url || home.vrbo_url)

  return (
    <div className="app-guest">
      <div className="app-phone">
        <div className="app-home mh">
          <div className="app-home-scroll">
            {loading && !data ? (
              <>
                <header className="mh-hero">
                  <div className="mh-hero-text">
                    <span className="app-skel app-skel-line" style={{ width: 200, height: 24 }} />
                  </div>
                </header>
                <Skeleton />
              </>
            ) : error ? (
              <p className="app-inline-error" style={{ margin: 24 }}>
                {errorText(error)}
              </p>
            ) : !home ? (
              <NoHome />
            ) : (
              <>
                <header className="mh-hero">
                  {home.cover_url ? <img className="mh-hero-img" src={home.cover_url} alt="" /> : <div className="mh-hero-img is-plain" />}
                  <div className="mh-hero-fade" aria-hidden="true" />
                  <div className="mh-hero-top">
                    {home.logo_url ? <img className="mh-hero-logo" src={home.logo_url} alt={home.host_name} /> : <span />}
                    <span className="mh-hero-actions">
                      <NotificationBell className="app-round-btn is-glass app-press" />
                      <Link to="/app/profile" className="app-round-btn is-glass app-press" aria-label="Profile">
                        <CircleUserRound size={20} strokeWidth={1.8} />
                      </Link>
                    </span>
                  </div>
                  <div className="mh-hero-text app-enter">
                    <h1>{home.home_name}</h1>
                    <p>
                      {[home.address, home.area, home.host_name].filter(Boolean).map((part, i) => (
                        <span key={part + i}>{part}</span>
                      ))}
                    </p>
                  </div>
                </header>

                <main className="mh-body">
                  <Link to="/app/vitoria" className="mh-banner app-rise">
                    <span>
                      {checkout && typeof checkout === 'object' ? (
                        <>
                          <b>{checkout.lead}</b>
                          {checkout.rest}
                        </>
                      ) : (
                        checkout || `Welcome to ${home.home_name}.`
                      )}
                      <br />
                      Need an airport transfer?
                    </span>
                    <em>
                      Message Vitoria <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                    </em>
                  </Link>

                  {hasAccess ? (
                    <Card title="Access">
                      {home.wifi_network ? <Row label="WiFi network" value={home.wifi_network} copy /> : null}
                      {home.wifi_password ? <Row label="WiFi password" value={home.wifi_password} copy /> : null}
                      {home.door_code ? <Row label="Door code" value={home.door_code} copy /> : null}
                      {home.parking ? <Row icon={CircleParking} label="Parking" value={home.parking} /> : null}
                    </Card>
                  ) : null}

                  {stayRows.length ? (
                    <Card title="Your stay">
                      {stayRows.map((row) => (
                        <Row key={row.label} {...row} />
                      ))}
                    </Card>
                  ) : null}

                  {(home.instructions || []).length ? (
                    <Card title="House instructions">
                      {home.instructions.map((item, i) => (
                        <Row key={i} icon={INSTRUCTION_ICONS[item.icon] || Info} label={item.label} value={item.value} />
                      ))}
                    </Card>
                  ) : null}

                  {(home.rules || []).length ? (
                    <Card title="House rules">
                      <ul className="mh-rules">
                        {home.rules.map((rule, i) => (
                          <li key={i}>{rule}</li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}

                  <Card title="Contacts">
                    {home.contact_phone ? (
                      <Row
                        icon={Phone}
                        label={home.contact_label || home.host_name}
                        value={home.contact_phone}
                        href={`tel:${home.contact_phone.replace(/[^\d+]/g, '')}`}
                      />
                    ) : null}
                    <Link to="/app/vitoria" className="mh-row mh-row-link">
                      <span className="mh-row-main">
                        <span className="mh-ico" aria-hidden="true">
                          <Bot size={16} strokeWidth={1.8} />
                        </span>
                        <span className="mh-row-text">
                          <small>AI concierge · available 24/7</small>
                          <strong>Vitoria · Powered by My30A Host</strong>
                        </span>
                      </span>
                      <ChevronRight size={16} strokeWidth={2} className="mh-chev" aria-hidden="true" />
                    </Link>
                  </Card>

                  {socials.length ? (
                    <Card title="Follow us">
                      <p className="mh-lead">Stay connected with {home.host_name} for new properties, local tips, and 30A inspiration.</p>
                      <div className="mh-socials">
                        {socials.map(({ kind, name, value, Icon }) => (
                          <a key={kind} className={`mh-social is-${kind}`} href={socialUrl(kind, value)} target="_blank" rel="noreferrer">
                            <Icon />
                            <strong>{name}</strong>
                            <small>{socialHandle(value)}</small>
                          </a>
                        ))}
                      </div>
                    </Card>
                  ) : null}

                  {hasNextStay ? (
                    <Card title="Plan your next 30A stay">
                      <p className="mh-lead">Loved your stay? Explore more {home.host_name} properties or share with friends planning a trip to 30A.</p>
                      {home.website_url ? (
                        <a className="mh-site" href={hrefFor(home.website_url)} target="_blank" rel="noreferrer">
                          <img src="/marketing/coastal-poster.webp" alt="" />
                          <span>
                            <strong>{home.properties_label || `Explore all ${home.host_name} properties`}</strong>
                            <small>{siteLabel(home.website_url)} · 30A Florida</small>
                          </span>
                        </a>
                      ) : null}
                      {home.airbnb_url || home.vrbo_url ? (
                        <div className="mh-listings">
                          {home.airbnb_url ? (
                            <a className="mh-listing is-airbnb" href={hrefFor(home.airbnb_url)} target="_blank" rel="noreferrer">
                              <strong>Airbnb</strong>
                              <small>Book again</small>
                            </a>
                          ) : null}
                          {home.vrbo_url ? (
                            <a className="mh-listing is-vrbo" href={hrefFor(home.vrbo_url)} target="_blank" rel="noreferrer">
                              <strong>VRBO</strong>
                              <small>All listings</small>
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </Card>
                  ) : null}

                  <p className="mh-foot">
                    <House size={13} strokeWidth={1.8} aria-hidden="true" /> Home info from {home.host_name}
                  </p>
                </main>
              </>
            )}
          </div>

          <BottomNav active="myhome" />
        </div>
      </div>
    </div>
  )
}
