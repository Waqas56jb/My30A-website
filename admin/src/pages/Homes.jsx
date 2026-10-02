import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, ExternalLink, Home as HomeIcon, ImagePlus, Plus, Printer, QrCode, Trash2 } from 'lucide-react'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { GUEST_APP_URL } from '../lib/config.js'
import { chicagoToday, errorMessage, formatShortDate } from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

// Host version (subscription): each property gets a QR code for the house. Guests who scan it see
// the host's logo on the welcome / sign-in screens and a "My Home" tab with this info.

const ICONS = [
  ['tv', 'TV'],
  ['thermostat', 'AC / heating'],
  ['kitchen', 'Kitchen'],
  ['trash', 'Trash'],
  ['laundry', 'Laundry'],
  ['pool', 'Pool'],
  ['grill', 'Grill'],
  ['beach', 'Beach gear'],
  ['bike', 'Bikes'],
  ['key', 'Keys / lock'],
  ['info', 'Other'],
]

const DEFAULT_INSTRUCTIONS = [
  { icon: 'tv', label: 'TV streaming', value: '' },
  { icon: 'thermostat', label: 'AC / Heating', value: '' },
  { icon: 'kitchen', label: 'Kitchen', value: '' },
  { icon: 'trash', label: 'Trash', value: '' },
]

const HOST_FIELDS = [
  'host_name', 'host_tagline', 'logo_url', 'contact_label', 'contact_phone', 'instagram', 'facebook',
  'tiktok', 'website_url', 'properties_label', 'airbnb_url', 'vrbo_url',
]

const TEXT_FIELDS = [
  'host_name', 'host_tagline', 'home_name', 'address', 'area', 'wifi_network', 'wifi_password', 'door_code',
  'parking', 'check_in_time', 'check_out_time', 'pets', 'contact_label', 'contact_phone', 'instagram',
  'facebook', 'tiktok', 'website_url', 'properties_label', 'airbnb_url', 'vrbo_url', 'notes',
]

function emptyForm() {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, ''])),
    host_tagline: '30A Florida Premium Vacation Rentals',
    check_in_time: '4:00 PM',
    check_out_time: '10:00 AM',
    max_guests: '',
    instructions: DEFAULT_INSTRUCTIONS.map((i) => ({ ...i })),
    rules: '',
    plan: 'monthly',
    paid_until: '',
    is_active: true,
  }
}

function formFrom(home) {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, home[f] || ''])),
    max_guests: home.max_guests ? String(home.max_guests) : '',
    instructions: (home.instructions || []).length ? home.instructions.map((i) => ({ ...i })) : DEFAULT_INSTRUCTIONS.map((i) => ({ ...i })),
    rules: (home.rules || []).join('\n'),
    plan: home.plan || 'monthly',
    paid_until: home.paid_until || '',
    is_active: home.is_active !== false,
  }
}

export function homeLink(home) {
  return `${GUEST_APP_URL}/h/${home.slug}`
}

function subscriptionPill(home) {
  if (!home.is_active) return <Pill neutral>Off</Pill>
  if (!home.paid_until) return <Pill sand>No payment date</Pill>
  if (home.paid_until < chicagoToday()) return <Pill warn>Overdue since {formatShortDate(home.paid_until)}</Pill>
  return <Pill>Paid to {formatShortDate(home.paid_until)}</Pill>
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// Printable QR poster for the house (Figma "Screen 1"): host logo, tagline, headline, the QR code.
async function printPoster(home, win) {
  const qr = await QRCode.toDataURL(homeLink(home), { width: 900, margin: 1, errorCorrectionLevel: 'M' })
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(home.home_name)} · QR</title>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
<style>
@page{size:letter;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:Satoshi,Inter,system-ui,sans-serif;color:#0a1628;background:#fff}
.p{width:8.5in;height:11in;margin:0 auto;padding:.7in .8in;display:flex;flex-direction:column;align-items:center;text-align:center;
background:linear-gradient(180deg,#def3f5 0%,#eef9f9 55%,#fff 100%)}
.logo{width:1.7in;height:1.7in;object-fit:contain}
.name{font-size:30px;font-weight:700;margin:.15in 0 0}
.tag{margin:.18in 0 0;font-size:15px;font-weight:500;letter-spacing:.05em;text-transform:uppercase}
h1{margin:.45in 0 0;font-size:34px;line-height:1.2}
.copy{max-width:5.6in;margin:.14in 0 0;font-size:16px;line-height:1.5;color:#6b7785}
.qr{position:relative;margin:.45in 0 0;padding:.22in}
.qr img{display:block;width:3.6in;height:3.6in}
.qr i{position:absolute;width:.62in;height:.62in;border:7px solid #f39200}
.qr i:nth-child(2){top:0;left:0;border-right:0;border-bottom:0}.qr i:nth-child(3){top:0;right:0;border-left:0;border-bottom:0}
.qr i:nth-child(4){bottom:0;left:0;border-right:0;border-top:0}.qr i:nth-child(5){bottom:0;right:0;border-left:0;border-top:0}
.scan{margin:.35in 0 0;padding:.16in .5in;border-radius:999px;background:linear-gradient(180deg,#ffa21f,#ffc560);font-size:17px;font-weight:500;letter-spacing:.05em;text-transform:uppercase}
.home{margin:.22in 0 0;font-size:14px;color:#4a5563}
.by{margin-top:auto;font-size:12px;letter-spacing:.06em;color:#8a94a0}
@media print{.p{background:linear-gradient(180deg,#def3f5 0%,#eef9f9 55%,#fff 100%);-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="p">
${home.logo_url ? `<img class="logo" src="${escapeHtml(home.logo_url)}" alt="">` : `<p class="name">${escapeHtml(home.host_name)}</p>`}
${home.host_tagline ? `<p class="tag">${escapeHtml(home.host_tagline)}</p>` : ''}
<h1>Your Home On 30A, Taken Care Of.</h1>
<p class="copy">Grocery delivery, airport transfers, local partners, and Vitoria — your AI concierge, available 24/7.</p>
<div class="qr"><img src="${qr}" alt="QR code"><i></i><i></i><i></i><i></i></div>
<div class="scan">Scan to start exploring</div>
<p class="home">${escapeHtml(home.home_name)}${home.area ? ` · ${escapeHtml(home.area)}` : ''} · WiFi, door code &amp; house info inside</p>
<p class="by">CONCIERGE POWERED BY MY30A HOST</p>
</div><script>Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>(document.fonts?document.fonts.ready:0)).then(()=>setTimeout(()=>print(),250))</script></body></html>`)
  win.document.close()
}

function QrModal({ home, onClose }) {
  const toast = useToast()
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (!home) return
    QRCode.toDataURL(homeLink(home), { width: 520, margin: 1, errorCorrectionLevel: 'M' }).then(setQr)
  }, [home])

  if (!home) return <Modal open={false} onClose={onClose} />
  const link = homeLink(home)

  return (
    <Modal open onClose={onClose} title={`QR code · ${home.home_name}`} width="440px">
      <div className="home-qr">
        {qr ? <img src={qr} alt={`QR code for ${home.home_name}`} /> : <span className="shimmer" style={{ width: 260, height: 260 }} />}
        <code>{link}</code>
        <p className="muted">Print it and place it in the house. Guests who scan it see {home.host_name}’s logo and the My Home tab.</p>
      </div>
      <div className="actions home-qr-actions">
        <button
          type="button"
          className="btn quiet"
          onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))}
        >
          <Copy size={16} /> Copy link
        </button>
        <a className="btn quiet" href={link} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Open
        </a>
        {qr ? (
          <a className="btn quiet" href={qr} download={`${home.slug}-qr.png`}>
            QR image
          </a>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => {
            const win = window.open('', '_blank')
            if (!win) {
              toast.error('Allow pop-ups to print the poster')
              return
            }
            printPoster(home, win).catch(() => win.close())
          }}
        >
          <Printer size={16} /> Print poster
        </button>
      </div>
    </Modal>
  )
}

function ImageField({ label, url, kind, home, onSaved, round }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function pick(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('image', file, file.name)
      onSaved(await api(`/api/homes/${home.id}/image?kind=${kind}`, { method: 'POST', body: form }))
      toast.success(`${label} updated`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className={`home-image${round ? ' is-round' : ''}`}>
        {url ? <img src={url} alt="" /> : <span className="home-image-empty"><ImagePlus size={20} /></span>}
        {home ? (
          <label className={`btn quiet sm${busy ? ' pending' : ''}`}>
            {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={pick} disabled={busy} />
          </label>
        ) : (
          <small className="muted">Save the property first, then upload.</small>
        )}
      </div>
    </div>
  )
}

export default function Homes() {
  useTitle('Host homes · My30A Admin')
  const toast = useToast()
  const homesQuery = useQuery('/api/homes')
  const hostsQuery = useQuery('/api/homes/hosts')
  const homes = homesQuery.data || []
  const hosts = hostsQuery.data || []

  const [editing, setEditing] = useState(null) // 'new' | home
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrHome, setQrHome] = useState(null)

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  async function refresh() {
    invalidateQuery('/api/homes')
    await homesQuery.refetch()
  }

  function openNew() {
    setForm(emptyForm())
    setFormError('')
    setEditing('new')
  }

  function openEdit(home) {
    setForm(formFrom(home))
    setFormError('')
    setEditing(home)
  }

  function copyHostFrom(id) {
    const source = homes.find((h) => h.id === id)
    if (!source) return
    setForm((f) => ({ ...f, ...Object.fromEntries(HOST_FIELDS.map((k) => [k, source[k] || ''])) }))
  }

  function setInstruction(index, key, value) {
    setForm((f) => ({ ...f, instructions: f.instructions.map((item, i) => (i === index ? { ...item, [key]: value } : item)) }))
  }

  function payload() {
    const body = { ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, form[k]])) }
    body.max_guests = form.max_guests === '' ? null : Number(form.max_guests)
    body.instructions = form.instructions.filter((i) => i.value.trim())
    body.rules = form.rules
    body.plan = form.plan
    body.paid_until = form.paid_until || null
    body.is_active = form.is_active
    if (editing === 'new' && form.logo_url) body.logo_url = form.logo_url
    return body
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')
    if (!form.host_name.trim() || !form.home_name.trim()) {
      setFormError('Host name and property name are required.')
      return
    }
    setSaving(true)
    try {
      if (editing === 'new') {
        const created = await api('/api/homes', { method: 'POST', body: payload() })
        await refresh()
        toast.success('Property added — now upload the logo and photo, then print the QR code')
        setForm(formFrom(created))
        setEditing(created)
      } else {
        await api(`/api/homes/${editing.id}`, { method: 'PATCH', body: payload() })
        await refresh()
        toast.success('Saved')
        setEditing(null)
      }
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${editing.home_name}? Its QR code stops working.`)) return
    try {
      await api(`/api/homes/${editing.id}`, { method: 'DELETE' })
      setEditing(null)
      await refresh()
      toast.success('Property deleted')
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  async function newLink() {
    if (!window.confirm('Make a new QR code? The old printed QR code will stop working.')) return
    try {
      const updated = await api(`/api/homes/${editing.id}/new-link`, { method: 'POST' })
      setEditing(updated)
      await refresh()
      toast.success('New QR code ready — print it again')
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  function onImageSaved(updated) {
    setEditing(updated)
    setForm((f) => ({ ...f, logo_url: updated.logo_url || '', cover_url: updated.cover_url || '' }))
    invalidateQuery('/api/homes')
    homesQuery.refetch()
  }

  const field = (key, label, props = {}) => (
    <div className="field">
      <label>{label}</label>
      <input value={form[key]} onChange={set(key)} {...props} />
    </div>
  )

  const current = editing && editing !== 'new' ? editing : null

  return (
    <section>
      <div className="head">
        <div>
          <h1>Host homes</h1>
          <div className="sub">Host version: each property gets a QR code. Guests who scan it see the host’s logo and a My Home tab.</div>
        </div>
        <Button className="btn" onClick={openNew}>
          <Plus size={18} /> Add property
        </Button>
      </div>

      {homesQuery.error ? <p className="page-error">{errorMessage(homesQuery.error)}</p> : null}

      <div className="card host-subs">
        <div className="host-subs-head">
          <h3>Hosts &amp; subscriptions</h3>
          <a href={`${GUEST_APP_URL}/hosts`} target="_blank" rel="noreferrer" className="btn quiet sm">
            Host signup page
          </a>
        </div>
        {hostsQuery.loading ? (
          <SkeletonTable rows={2} cols={5} />
        ) : hosts.length === 0 ? (
          <p className="muted">No self-serve hosts yet. Hosts sign up and pay at {GUEST_APP_URL.replace(/^https?:\/\//, '')}/hosts, then manage their own properties at /host.</p>
        ) : (
          <div className="host-subs-table">
            <table>
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Plan</th>
                  <th className="num">Properties</th>
                  <th>Status</th>
                  <th>Renews</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => (
                  <tr key={h.id}>
                    <td data-label="Host">
                      <strong>{h.company_name}</strong>
                      <br />
                      <small className="muted">
                        {h.host?.name} · {h.host?.email}
                        {h.host?.phone ? ` · ${h.host.phone}` : ''}
                      </small>
                    </td>
                    <td data-label="Plan">
                      {h.plan_label}
                      {h.unit_amount ? <small className="muted"> · ${Number(h.unit_amount).toFixed(2)}/property</small> : null}
                    </td>
                    <td className="num" data-label="Properties">
                      {h.properties} / {h.quantity}
                    </td>
                    <td data-label="Status">
                      <Pill warn={!['active', 'trialing'].includes(h.status)} neutral={h.status === 'canceled'}>
                        {h.status === 'pending' ? 'Waiting for payment' : h.status.replace(/_/g, ' ')}
                        {h.cancel_at_period_end ? ' · cancels' : ''}
                      </Pill>
                    </td>
                    <td data-label="Renews">{h.current_period_end ? formatShortDate(h.current_period_end) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {homesQuery.loading ? (
        <div className="card">
          <SkeletonTable rows={3} cols={4} />
        </div>
      ) : homes.length === 0 ? (
        <div className="card">
          <EmptyState icon={HomeIcon} title="No host properties yet." detail="Add a property, upload the host’s logo and print its QR code for the house." />
        </div>
      ) : (
        <div className="home-grid">
          {homes.map((home) => (
            <article key={home.id} className="card home-card">
              <div className="home-card-cover" style={home.cover_url ? { backgroundImage: `url("${home.cover_url}")` } : undefined}>
                {home.logo_url ? <img src={home.logo_url} alt="" /> : null}
              </div>
              <div className="home-card-body">
                <h3>{home.home_name}</h3>
                <p className="muted">
                  {home.host_name}
                  {home.area ? ` · ${home.area}` : ''}
                </p>
                {home.owner ? <p className="home-owner">Managed by host · {home.owner.company_name}</p> : null}
                {home.stats ? (
                  <p className="home-stats muted">
                    30 days: {home.stats.guests} guests · {home.stats.opened} My Home opens · {home.stats.vitoria} Vitória questions
                  </p>
                ) : null}
                <div className="home-card-meta">
                  {home.owner ? <Pill neutral={!['active', 'trialing', 'past_due'].includes(home.owner.status)}>Host plan · {home.owner.status}</Pill> : subscriptionPill(home)}
                  <small className="muted">
                    {home.plan === 'annual' ? 'Annual' : 'Monthly'} · {home.guest_count} guest{home.guest_count === 1 ? '' : 's'}
                  </small>
                </div>
                <div className="home-card-actions">
                  <button type="button" className="btn quiet sm" onClick={() => openEdit(home)}>
                    Edit
                  </button>
                  <button type="button" className="btn sm" onClick={() => setQrHome(home)}>
                    <QrCode size={15} /> QR code
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add property' : `Edit · ${editing?.home_name || ''}`} width="760px">
        <form onSubmit={save} className="home-form">
          {editing === 'new' && homes.length ? (
            <div className="field">
              <label>Same host as another property? (copies logo, contact, socials and links)</label>
              <select defaultValue="" onChange={(e) => copyHostFrom(e.target.value)}>
                <option value="">— New host —</option>
                {[...new Map(homes.map((h) => [h.host_name, h])).values()].map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.host_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <h3 className="home-form-h">Host</h3>
          <div className="row2">
            {field('host_name', 'Host / company name', { placeholder: 'StayOn30A' })}
            {field('host_tagline', 'Tagline', { placeholder: '30A Florida Premium Vacation Rentals' })}
          </div>
          <ImageField label="Host logo (shown on the welcome and sign-in screens)" url={current?.logo_url || form.logo_url} kind="logo" home={current} onSaved={onImageSaved} round />

          <h3 className="home-form-h">Property</h3>
          <div className="row2">
            {field('home_name', 'Property name', { placeholder: 'The Blue Heron House' })}
            {field('area', 'Community / area', { placeholder: 'Rosemary Beach' })}
          </div>
          {field('address', 'Address', { placeholder: '47 Rosemary Ave' })}
          <ImageField label="Property photo (top of My Home)" url={current?.cover_url} kind="cover" home={current} onSaved={onImageSaved} />

          <h3 className="home-form-h">Access</h3>
          <div className="row2">
            {field('wifi_network', 'WiFi network', { placeholder: 'BlueHeron_5G' })}
            {field('wifi_password', 'WiFi password')}
          </div>
          <div className="row2">
            {field('door_code', 'Door code', { placeholder: '4821#' })}
            {field('parking', 'Parking', { placeholder: '2 spaces · Driveway · No street parking' })}
          </div>

          <h3 className="home-form-h">Your stay</h3>
          <div className="row2">
            {field('check_in_time', 'Check-in time')}
            {field('check_out_time', 'Check-out time')}
          </div>
          <div className="row2">
            {field('max_guests', 'Max guests', { type: 'number', min: 1, inputMode: 'numeric' })}
            {field('pets', 'Pets', { placeholder: 'Not allowed on this property' })}
          </div>

          <h3 className="home-form-h">House instructions</h3>
          {form.instructions.map((item, index) => (
            <div key={index} className="home-instruction">
              <select value={item.icon} onChange={(e) => setInstruction(index, 'icon', e.target.value)} aria-label="Icon">
                {ICONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input value={item.label} onChange={(e) => setInstruction(index, 'label', e.target.value)} placeholder="Title (TV streaming)" aria-label="Title" />
              <input value={item.value} onChange={(e) => setInstruction(index, 'value', e.target.value)} placeholder="Smart TV · Netflix & Apple TV ready" aria-label="Details" />
              <button
                type="button"
                className="btn quiet sm"
                aria-label="Remove"
                onClick={() => setForm((f) => ({ ...f, instructions: f.instructions.filter((_, i) => i !== index) }))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn quiet sm"
            onClick={() => setForm((f) => ({ ...f, instructions: [...f.instructions, { icon: 'info', label: '', value: '' }] }))}
          >
            <Plus size={15} /> Add instruction
          </button>
          <p className="muted home-hint">Rows with no details are hidden from guests.</p>

          <h3 className="home-form-h">House rules</h3>
          <div className="field">
            <label>One rule per line (emoji welcome)</label>
            <textarea rows={4} value={form.rules} onChange={set('rules')} placeholder={'🚭 No smoking inside\n🎉 No parties without prior approval\n🌙 Quiet hours 10pm – 8am\n🐾 No pets on this property'} />
          </div>

          <h3 className="home-form-h">Contact</h3>
          <div className="row2">
            {field('contact_label', 'Contact name', { placeholder: 'StayOn30A · Nick & Ashley' })}
            {field('contact_phone', 'Phone', { placeholder: '(850) 739-1365', inputMode: 'tel' })}
          </div>

          <h3 className="home-form-h">Follow us &amp; next stay</h3>
          <div className="row2">
            {field('instagram', 'Instagram', { placeholder: '@stayon30a' })}
            {field('facebook', 'Facebook', { placeholder: 'StayOn30A or full link' })}
          </div>
          <div className="row2">
            {field('tiktok', 'TikTok', { placeholder: '@stayon30a' })}
            {field('website_url', 'Website', { placeholder: 'stayon30a.com' })}
          </div>
          {field('properties_label', 'Website button text', { placeholder: 'Explore All 125 Properties' })}
          <div className="row2">
            {field('airbnb_url', 'Airbnb link')}
            {field('vrbo_url', 'VRBO link')}
          </div>

          <h3 className="home-form-h">Subscription</h3>
          <div className="row2">
            <div className="field">
              <label>Plan</label>
              <select value={form.plan} onChange={set('plan')}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            {field('paid_until', 'Paid until', { type: 'date' })}
          </div>
          <div className="field">
            <label>Notes (admin only)</label>
            <textarea rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          <label className="checks">
            <label>
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
              Active — when off, the QR code shows “no longer active” and guests lose the My Home tab
            </label>
          </label>

          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="actions home-form-actions">
            {current ? (
              <>
                <button type="button" className="btn quiet danger" onClick={remove}>
                  Delete
                </button>
                <button type="button" className="btn quiet" onClick={newLink}>
                  New QR code
                </button>
                <button type="button" className="btn quiet" onClick={() => setQrHome(current)}>
                  <QrCode size={15} /> QR code
                </button>
              </>
            ) : null}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn quiet" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <Button type="submit" className="btn" pending={saving}>
              {editing === 'new' ? 'Add property' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>

      <QrModal home={qrHome} onClose={() => setQrHome(null)} />
    </section>
  )
}
