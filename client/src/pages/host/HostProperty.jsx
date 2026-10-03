import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy, ExternalLink, ImagePlus, Plus, Printer, QrCode, RefreshCw, Trash2 } from 'lucide-react'
import { homeLink, hostPortal, printPoster, qrDataUrl } from '../../lib/hostPortal.js'

// One property: the My Home info guests see (Figma "Screen 2"), its QR code / poster, and guest
// activity (counts and topics).
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
const TEXT = [
  'host_name', 'host_tagline', 'home_name', 'address', 'area', 'wifi_network', 'wifi_password', 'door_code', 'parking',
  'check_in_time', 'check_out_time', 'pets', 'contact_label', 'contact_phone', 'instagram', 'facebook', 'tiktok',
  'website_url', 'properties_label', 'airbnb_url', 'vrbo_url',
]
const KIND_LABEL = { joined: 'A guest joined through the QR code', opened: 'A guest opened My Home', transfer: 'A guest booked an airport transfer', grocery: 'A guest ordered groceries' }

function toForm(home, companyName) {
  return {
    ...Object.fromEntries(TEXT.map((k) => [k, home?.[k] || ''])),
    host_name: home?.host_name || companyName || '',
    host_tagline: home ? home.host_tagline || '' : '30A Florida Premium Vacation Rentals',
    check_in_time: home ? home.check_in_time || '' : '4:00 PM',
    check_out_time: home ? home.check_out_time || '' : '10:00 AM',
    max_guests: home?.max_guests ? String(home.max_guests) : '',
    instructions: home?.instructions?.length ? home.instructions.map((i) => ({ ...i })) : DEFAULT_INSTRUCTIONS.map((i) => ({ ...i })),
    rules: (home?.rules || []).join('\n'),
    is_active: home ? home.is_active !== false : true,
  }
}

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ImageBox({ label, url, round, disabled, onFile }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="hp-field">
      <span className="hp-label">{label}</span>
      <div className={`hp-image${round ? ' is-round' : ''}`}>
        {url ? <img src={url} alt="" /> : <span className="hp-image-empty"><ImagePlus size={20} /></span>}
        {disabled ? (
          <small className="hp-muted">Save the property first, then upload.</small>
        ) : (
          <label className={`hp-btn${busy ? ' is-busy' : ''}`}>
            {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setBusy(true)
                try {
                  await onFile(file)
                } finally {
                  setBusy(false)
                }
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}

function QrTab({ home, onNewLink }) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    qrDataUrl(home).then(setQr)
  }, [home])
  const link = homeLink(home)
  return (
    <section className="hp-card hp-qr">
      <div className="hp-qr-code">{qr ? <img src={qr} alt={`QR code for ${home.home_name}`} /> : null}</div>
      <div className="hp-qr-side">
        <h2>Your QR code</h2>
        <p className="hp-muted">Print the poster and place it in the house — on the fridge, the entry table or next to the WiFi router. Guests scan it, see your logo and get My Home.</p>
        <code className="hp-code">{link}</code>
        <div className="hp-row">
          <button
            type="button"
            className="hp-btn is-primary"
            onClick={() => {
              const win = window.open('', '_blank')
              if (win) printPoster(home, win)
            }}
          >
            <Printer size={16} /> Print poster
          </button>
          {qr ? (
            <a className="hp-btn" href={qr} download={`${home.slug}-qr.png`}>
              <QrCode size={16} /> Download QR
            </a>
          ) : null}
          <button
            type="button"
            className="hp-btn"
            onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
          >
            <Copy size={16} /> {copied ? 'Copied' : 'Copy link'}
          </button>
          <a className="hp-btn is-ghost" href={link} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Preview
          </a>
        </div>
        <button type="button" className="hp-link-btn" onClick={onNewLink}>
          <RefreshCw size={14} /> Make a new QR code (old printed codes stop working)
        </button>
      </div>
    </section>
  )
}

function ActivityTab({ home }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  useEffect(() => {
    setData(null)
    hostPortal.activity(home.id, days).then(setData).catch(() => setData({ error: true }))
  }, [home.id, days])
  if (!data) return <div className="hp-skel" />
  if (data.error) return <p className="hp-error">Couldn’t load activity.</p>
  return (
    <section className="hp-card">
      <div className="hp-row hp-between">
        <h2>Guest activity</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>
      <div className="hp-stats is-compact">
        <div className="hp-stat"><strong>{data.guests}</strong><small>Guests</small></div>
        <div className="hp-stat"><strong>{data.joined}</strong><small>Joined via QR</small></div>
        <div className="hp-stat"><strong>{data.opened}</strong><small>My Home opens</small></div>
        <div className="hp-stat"><strong>{data.vitoria}</strong><small>Vitória questions</small></div>
        <div className="hp-stat"><strong>{data.transfer + data.grocery}</strong><small>Bookings</small></div>
      </div>
      <TopicBars topics={data.vitoria_topics || {}} labels={data.topic_labels || {}} />
      <h3 className="hp-sub">Latest</h3>
      {data.recent?.length ? (
        <ul className="hp-feed">
          {data.recent.map((e, i) => (
            <li key={i}>
              <span>{e.kind === 'vitoria' ? `A guest asked Vitória about ${data.topic_labels?.[e.topic] || 'something else'}` : KIND_LABEL[e.kind] || e.kind}</span>
              <small>{ago(e.at)}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hp-muted">No guest activity yet — it appears here once guests scan the QR code.</p>
      )}
    </section>
  )
}

function TopicBars({ topics, labels }) {
  const rows = Object.entries(topics).sort((a, b) => b[1] - a[1])
  if (!rows.length) return null
  const max = rows[0][1]
  return (
    <>
      <h3 className="hp-sub">What guests ask Vitória</h3>
      <ul className="hp-bars">
        {rows.map(([key, n]) => (
          <li key={key}>
            <span>{labels[key] || key}</span>
            <i style={{ '--w': `${Math.max(6, (n / max) * 100)}%` }} />
            <b>{n}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function HostProperty() {
  const { id } = useParams()
  const creating = !id
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = creating ? 'details' : params.get('tab') || 'details'
  const [home, setHome] = useState(null)
  const [company, setCompany] = useState('')
  const [form, setForm] = useState(() => toForm(null, ''))
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let ignore = false
    // A new id (e.g. right after "Create property") reloads from scratch.
    setLoaded(false)
    setError('')
    setSaved(false)
    hostPortal
      .me()
      .then((me) => {
        if (ignore) return
        const companyName = me.subscription?.company_name || ''
        setCompany(companyName)
        const found = creating ? null : (me.homes || []).find((h) => h.id === id)
        if (!creating && !found) {
          setError('Property not found')
          return
        }
        // A new property starts from the host's previous one (logo, contact, socials, links).
        const template = creating ? (me.homes || [])[0] : null
        setHome(found)
        setForm(
          toForm(
            found ||
              (template
                ? { ...Object.fromEntries(['host_name', 'host_tagline', 'contact_label', 'contact_phone', 'instagram', 'facebook', 'tiktok', 'website_url', 'properties_label', 'airbnb_url', 'vrbo_url', 'check_in_time', 'check_out_time'].map((k) => [k, template[k]])), home_name: '', is_active: true, instructions: null, rules: [] }
                : null),
            companyName
          )
        )
        setLoaded(true)
      })
      .catch((err) => setError(err?.data?.error || err.message))
    return () => {
      ignore = true
    }
  }, [id, creating])

  const set = (key) => (e) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }
  const setInstruction = (index, key, value) =>
    setForm((f) => ({ ...f, instructions: f.instructions.map((it, i) => (i === index ? { ...it, [key]: value } : it)) }))

  async function save(event) {
    event.preventDefault()
    setError('')
    if (!form.home_name.trim()) return setError('Please add the property name.')
    setSaving(true)
    try {
      const body = {
        ...Object.fromEntries(TEXT.map((k) => [k, form[k]])),
        max_guests: form.max_guests === '' ? null : Number(form.max_guests),
        instructions: form.instructions.filter((i) => String(i.value).trim()),
        rules: form.rules,
        is_active: form.is_active,
      }
      if (creating) {
        const created = await hostPortal.createHome(body)
        navigate(`/host/homes/${created.id}`, { replace: true })
      } else {
        const updated = await hostPortal.updateHome(home.id, body)
        setHome((h) => ({ ...h, ...updated }))
        setSaved(true)
      }
    } catch (err) {
      setError(err?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function upload(kind, file) {
    try {
      const updated = await hostPortal.uploadImage(home.id, kind, file)
      setHome((h) => ({ ...h, ...updated }))
    } catch (err) {
      setError(err?.data?.error || err.message)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${home.home_name}? Its QR code stops working.`)) return
    await hostPortal.deleteHome(home.id)
    navigate('/host', { replace: true })
  }

  async function newLink() {
    if (!window.confirm('Make a new QR code? The old printed code will stop working.')) return
    const updated = await hostPortal.newLink(home.id)
    setHome((h) => ({ ...h, ...updated }))
  }

  const field = (key, label, props = {}) => (
    <label className="hp-field">
      <span className="hp-label">{label}</span>
      <input value={form[key]} onChange={set(key)} {...props} />
    </label>
  )

  if (error && !loaded) return <p className="hp-error">{error}</p>
  if (!loaded || (!creating && !home)) return <div className="hp-skel" />

  return (
    <div className="hp-page">
      <Link to="/host" className="hp-back">
        <ArrowLeft size={16} /> All properties
      </Link>
      <div className="hp-head">
        <div>
          <h1>{creating ? 'Add a property' : home.home_name}</h1>
          {!creating ? (
            <p className="hp-muted">
              {home.live ? 'Live — guests can scan the QR code.' : 'Not live yet — check your plan on the dashboard.'}
            </p>
          ) : (
            <p className="hp-muted">This is what guests see in the My Home tab. You can change it any time.</p>
          )}
        </div>
      </div>

      {!creating ? (
        <div className="hp-tabs" role="tablist">
          {[
            ['details', 'Details'],
            ['qr', 'QR code'],
            ['activity', 'Guest activity'],
          ].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setParams(key === 'details' ? {} : { tab: key })}>
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'qr' && home ? <QrTab home={home} onNewLink={newLink} /> : null}
      {tab === 'activity' && home ? <ActivityTab home={home} /> : null}

      {tab === 'details' ? (
        <form className="hp-form" onSubmit={save}>
          <section className="hp-card">
            <h2>Your brand</h2>
            <div className="hp-two">
              {field('host_name', 'Brand name guests see', { placeholder: company || 'Your Rentals Co.' })}
              {field('host_tagline', 'Tagline', { placeholder: '30A Florida Premium Vacation Rentals' })}
            </div>
            <ImageBox label="Logo (welcome and sign-in screens)" url={home?.logo_url} round disabled={creating} onFile={(f) => upload('logo', f)} />
          </section>

          <section className="hp-card">
            <h2>The property</h2>
            <div className="hp-two">
              {field('home_name', 'Property name', { placeholder: 'Your Beach House' })}
              {field('area', 'Community', { placeholder: 'Rosemary Beach' })}
            </div>
            {field('address', 'Address', { placeholder: '47 Rosemary Ave' })}
            <ImageBox label="Photo (top of My Home)" url={home?.cover_url} disabled={creating} onFile={(f) => upload('cover', f)} />
          </section>

          <section className="hp-card">
            <h2>Access</h2>
            <div className="hp-two">
              {field('wifi_network', 'WiFi network')}
              {field('wifi_password', 'WiFi password')}
              {field('door_code', 'Door code')}
              {field('parking', 'Parking', { placeholder: '2 spaces · Driveway · No street parking' })}
            </div>
          </section>

          <section className="hp-card">
            <h2>Your stay</h2>
            <div className="hp-two">
              {field('check_in_time', 'Check-in time')}
              {field('check_out_time', 'Check-out time')}
              {field('max_guests', 'Max guests', { type: 'number', min: 1, inputMode: 'numeric' })}
              {field('pets', 'Pets', { placeholder: 'Not allowed on this property' })}
            </div>
          </section>

          <section className="hp-card">
            <h2>House instructions</h2>
            {form.instructions.map((item, index) => (
              <div key={index} className="hp-instruction">
                <select value={item.icon} onChange={(e) => setInstruction(index, 'icon', e.target.value)} aria-label="Icon">
                  {ICONS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input value={item.label} onChange={(e) => setInstruction(index, 'label', e.target.value)} placeholder="Title" aria-label="Title" />
                <input value={item.value} onChange={(e) => setInstruction(index, 'value', e.target.value)} placeholder="Details guests see" aria-label="Details" />
                <button type="button" className="hp-icon-btn" aria-label="Remove" onClick={() => setForm((f) => ({ ...f, instructions: f.instructions.filter((_, i) => i !== index) }))}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="hp-btn is-ghost" onClick={() => setForm((f) => ({ ...f, instructions: [...f.instructions, { icon: 'info', label: '', value: '' }] }))}>
              <Plus size={15} /> Add instruction
            </button>
            <p className="hp-muted hp-small">Rows left without details are hidden from guests.</p>
          </section>

          <section className="hp-card">
            <h2>House rules</h2>
            <label className="hp-field">
              <span className="hp-label">One rule per line (emoji welcome)</span>
              <textarea rows={4} value={form.rules} onChange={set('rules')} placeholder={'🚭 No smoking inside\n🎉 No parties without prior approval\n🌙 Quiet hours 10pm – 8am'} />
            </label>
          </section>

          <section className="hp-card">
            <h2>Contact, social &amp; your other listings</h2>
            <div className="hp-two">
              {field('contact_label', 'Contact name', { placeholder: 'Your Rentals Co. · Guest services' })}
              {field('contact_phone', 'Phone', { inputMode: 'tel' })}
              {field('instagram', 'Instagram', { placeholder: '@yourbrand' })}
              {field('facebook', 'Facebook')}
              {field('tiktok', 'TikTok')}
              {field('website_url', 'Website')}
              {field('airbnb_url', 'Airbnb link')}
              {field('vrbo_url', 'VRBO link')}
            </div>
            {field('properties_label', 'Website button text', { placeholder: 'Explore All 125 Properties' })}
          </section>

          {!creating ? (
            <label className="hp-check">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
              Property switched on (untick to switch its QR code off)
            </label>
          ) : null}

          {error ? <p className="hp-error">{error}</p> : null}
          <div className="hp-save">
            {!creating ? (
              <button type="button" className="hp-btn is-danger" onClick={remove}>
                <Trash2 size={15} /> Delete
              </button>
            ) : null}
            <span className="hp-flex" />
            {saved ? <span className="hp-ok-text">Saved — guests see it now</span> : null}
            <button type="submit" className="hp-btn is-primary" disabled={saving}>
              {saving ? 'Saving…' : creating ? 'Create property' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
