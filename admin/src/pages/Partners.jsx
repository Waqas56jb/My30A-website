import { useMemo, useState } from 'react'
import { Check, ExternalLink, ImagePlus, Inbox, Plus, Search, Store, X } from 'lucide-react'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'
import Pill from '../components/Pill.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { GUEST_APP_URL } from '../lib/config.js'
import { errorMessage, formatShortDate } from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

// Partners: requests from the public form (my30ahost.com/partners/join) and every listing guests
// see in Explore — restaurants, bars, coffee shops and Local Guide vendors. Approving a request
// lists it in the chosen category; listings can be edited, re-photographed, hidden or added here.

const TYPE_LABELS = { restaurant: 'Restaurant', bar: 'Bar & Nightlife', coffee: 'Coffee & Breakfast', vendor: 'Local Guide' }
const DINING = ['restaurant', 'bar', 'coffee']

function typeLabel(row, guides) {
  if (row.listing_type === 'vendor') return guides.find((g) => g.slug === row.guide_slug)?.title || 'Local Guide'
  return TYPE_LABELS[row.listing_type] || row.listing_type
}

function TypeFields({ form, setForm, options }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  return (
    <div className="row2">
      <div className="field">
        <label>Listed under</label>
        <select value={form.listing_type} onChange={set('listing_type')}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {value === 'vendor' ? 'Local Guide category…' : `Dining · ${label}`}
            </option>
          ))}
        </select>
      </div>
      {form.listing_type === 'vendor' ? (
        <div className="field">
          <label>Category</label>
          <select value={form.guide_slug || ''} onChange={set('guide_slug')}>
            <option value="">Choose…</option>
            {(options?.guides || []).map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="field">
          <label>Cuisine / style</label>
          <input value={form.cuisine || ''} onChange={set('cuisine')} placeholder="Seafood · Southern" />
        </div>
      )}
    </div>
  )
}

function DetailFields({ form, setForm, options, nameKey }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  return (
    <>
      <div className="field">
        <label>Business name</label>
        <input value={form[nameKey] || ''} onChange={set(nameKey)} />
      </div>
      <div className="field">
        <label>Description (guests read this)</label>
        <textarea rows={4} value={form.description || ''} onChange={set('description')} />
      </div>
      <div className="row2">
        <div className="field">
          <label>Phone</label>
          <input value={form.phone || ''} onChange={set('phone')} />
        </div>
        <div className="field">
          <label>Website</label>
          <input value={form.website_url || ''} onChange={set('website_url')} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Area</label>
          <select value={form.community || ''} onChange={set('community')}>
            <option value="">—</option>
            {(options?.communities || []).concat('30A').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Address</label>
          <input value={form.address || ''} onChange={set('address')} />
        </div>
      </div>
      <div className="field">
        <label>Opening hours</label>
        <input value={form.hours || ''} onChange={set('hours')} placeholder="Daily 7am–2pm" />
      </div>
    </>
  )
}

function PhotoPicker({ url, onFile, busy, label = 'Photo' }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="home-image">
        {url ? <img src={url} alt="" /> : <span className="home-image-empty"><ImagePlus size={20} /></span>}
        <label className={`btn quiet sm${busy ? ' pending' : ''}`}>
          {busy ? 'Uploading…' : url ? 'Replace photo' : 'Add photo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onFile(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}

// ---------- Requests ----------

function RequestModal({ request, options, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState(() => ({ ...request }))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const pending = request.status === 'pending'

  const fields = () => ({
    listing_type: form.listing_type,
    guide_slug: form.listing_type === 'vendor' ? form.guide_slug : null,
    business_name: form.business_name,
    description: form.description,
    website_url: form.website_url,
    phone: form.phone,
    address: form.address,
    community: form.community,
    hours: form.hours,
    cuisine: form.cuisine,
  })

  async function approve() {
    setError('')
    setBusy('approve')
    try {
      const result = await api(`/api/partners/requests/${request.id}/approve`, { method: 'POST', body: { ...fields(), notify } })
      toast.success(`${result.listing.name} is live${result.emailed ? ' — partner emailed' : ''}`)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function decline() {
    setError('')
    setBusy('decline')
    try {
      await api(`/api/partners/requests/${request.id}/reject`, { method: 'POST', body: { note, notify } })
      toast.success('Request declined')
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function replacePhoto(file) {
    setBusy('photo')
    try {
      const body = new FormData()
      body.append('photo', file, file.name)
      const updated = await api(`/api/partners/requests/${request.id}/photo`, { method: 'POST', body })
      setForm((f) => ({ ...f, photo_url: updated.photo_url }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <Modal open onClose={onClose} title={pending ? `Review · ${request.business_name}` : request.business_name} width="680px">
      <div className="partner-contact">
        <span>
          <b>{request.contact_name || 'Contact'}</b> · <a href={`mailto:${request.email}`}>{request.email}</a> · {request.phone}
        </span>
        <small className="muted">
          Sent {formatShortDate(request.created_at)}
          {request.instagram ? ` · Instagram ${request.instagram}` : ''}
        </small>
      </div>
      {pending ? (
        <>
          <TypeFields form={form} setForm={setForm} options={options} />
          <DetailFields form={form} setForm={setForm} options={options} nameKey="business_name" />
          <PhotoPicker url={form.photo_url} onFile={replacePhoto} busy={busy === 'photo'} />
          <label className="checks">
            <label>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Email the partner when I approve or decline
            </label>
          </label>
          {declining ? (
            <div className="field">
              <label>Reason (optional, included in the email)</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="partner-summary">
          {request.photo_url ? <img src={request.photo_url} alt="" /> : null}
          <p>{request.description}</p>
          <p className="muted">
            {typeLabel(request, options?.guides || [])} · {request.status === 'approved' ? 'Approved' : 'Declined'} {formatShortDate(request.reviewed_at)}
            {request.admin_note ? ` · “${request.admin_note}”` : ''}
          </p>
        </div>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="actions">
        {pending ? (
          declining ? (
            <>
              <button type="button" className="btn quiet" onClick={() => setDeclining(false)}>
                Back
              </button>
              <Button className="btn danger" pending={busy === 'decline'} onClick={decline}>
                Decline request
              </Button>
            </>
          ) : (
            <>
              <button type="button" className="btn quiet danger" onClick={() => setDeclining(true)}>
                <X size={15} /> Decline
              </button>
              <span style={{ flex: 1 }} />
              <Button className="btn" pending={busy === 'approve'} onClick={approve}>
                <Check size={16} /> Approve & list
              </Button>
            </>
          )
        ) : (
          <button type="button" className="btn quiet" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </Modal>
  )
}

function Requests({ options }) {
  const [status, setStatus] = useState('pending')
  const query = useQuery(`/api/partners/requests?status=${status}`)
  const [open, setOpen] = useState(null)
  const rows = query.data || []

  function done() {
    setOpen(null)
    invalidateQuery('/api/partners')
    query.refetch()
  }

  return (
    <>
      <div className="seg partner-seg" role="tablist">
        {[
          ['pending', 'Waiting'],
          ['approved', 'Approved'],
          ['rejected', 'Declined'],
        ].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={status === value} className={status === value ? 'on' : ''} onClick={() => setStatus(value)}>
            {label}
          </button>
        ))}
      </div>
      {query.error ? <p className="page-error">{errorMessage(query.error)}</p> : null}
      {query.loading ? (
        <div className="card">
          <SkeletonTable rows={3} cols={3} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Inbox}
            title={status === 'pending' ? 'No requests waiting.' : 'Nothing here yet.'}
            detail={`Businesses apply at ${GUEST_APP_URL.replace(/^https?:\/\//, '')}/partners/join — new requests show up here and you get an alert.`}
          />
        </div>
      ) : (
        <div className="partner-grid">
          {rows.map((r) => (
            <button key={r.id} type="button" className="card partner-card" onClick={() => setOpen(r)}>
              <span className="partner-thumb" style={r.photo_url ? { backgroundImage: `url("${r.photo_url}")` } : undefined} />
              <span className="partner-card-body">
                <strong>{r.business_name}</strong>
                <small className="muted">
                  {typeLabel(r, options?.guides || [])}
                  {r.community ? ` · ${r.community}` : ''}
                </small>
                <span className="partner-desc">{r.description}</span>
                <small className="muted">Sent {formatShortDate(r.created_at)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {open ? <RequestModal request={open} options={options} onClose={() => setOpen(null)} onDone={done} /> : null}
    </>
  )
}

// ---------- Listings ----------

function emptyListing() {
  return { listing_type: 'restaurant', guide_slug: '', name: '', description: '', phone: '', website_url: '', community: '', address: '', hours: '', cuisine: '', is_active: true }
}

function ListingModal({ listing, options, onClose, onSaved }) {
  const toast = useToast()
  const creating = !listing.id
  const [form, setForm] = useState(() => ({ ...emptyListing(), ...listing }))
  const [photo, setPhoto] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(listing.image_url || '')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const body = () => ({
    listing_type: form.listing_type,
    guide_slug: form.listing_type === 'vendor' ? form.guide_slug : null,
    name: form.name,
    description: form.description,
    phone: form.phone,
    website_url: form.website_url,
    community: form.community,
    address: form.address,
    hours: form.hours,
    cuisine: form.cuisine,
  })

  async function save() {
    setError('')
    setBusy('save')
    try {
      if (creating) {
        const data = new FormData()
        for (const [k, v] of Object.entries({ ...body(), business_name: form.name })) if (v !== null && v !== undefined) data.append(k, v)
        if (photo) data.append('photo', photo, photo.name)
        const saved = await api('/api/partners/listings', { method: 'POST', body: data })
        toast.success(`${saved.name} added`)
        onSaved(saved)
      } else {
        const changed = Object.fromEntries(Object.entries(body()).filter(([k, v]) => (v || '') !== (listing[k] || '') || k === 'listing_type'))
        if (form.listing_type === listing.listing_type) delete changed.listing_type
        if (form.is_active !== listing.is_active) changed.is_active = form.is_active
        const saved = Object.keys(changed).length ? await api(`/api/partners/listings/${listing.id}`, { method: 'PATCH', body: changed }) : listing
        toast.success('Saved')
        onSaved(saved)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function onFile(file) {
    if (creating) {
      setPhoto(file)
      setPhotoUrl(URL.createObjectURL(file))
      return
    }
    setBusy('photo')
    try {
      const data = new FormData()
      data.append('photo', file, file.name)
      const saved = await api(`/api/partners/listings/${listing.id}/photo`, { method: 'POST', body: data })
      setPhotoUrl(saved.image_url)
      toast.success('Photo updated')
      onSaved(saved, { keepOpen: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <Modal open onClose={onClose} title={creating ? 'Add listing' : `Edit · ${listing.name}`} width="680px">
      <TypeFields form={form} setForm={setForm} options={options} />
      <DetailFields form={form} setForm={setForm} options={options} nameKey="name" />
      <PhotoPicker url={photoUrl} onFile={onFile} busy={busy === 'photo'} />
      {!creating ? (
        <label className="checks">
          <label>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Shown to guests (untick to hide it from Explore and Vitoria)
          </label>
        </label>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="actions">
        {!creating && listing.website_url ? (
          <a className="btn quiet" href={listing.website_url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Website
          </a>
        ) : null}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn quiet" onClick={onClose}>
          Cancel
        </button>
        <Button className="btn" pending={busy === 'save'} onClick={save}>
          {creating ? 'Add listing' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  )
}

function Listings({ options }) {
  const query = useQuery('/api/partners/listings')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const guides = options?.guides || []
  const rows = query.data || []

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === 'nophoto' && r.image_url) return false
      if (filter === 'hidden' && r.is_active) return false
      if (DINING.includes(filter) && !(r.venue_types || [r.listing_type]).includes(filter)) return false
      if (filter.startsWith('guide:') && r.guide_slug !== filter.slice(6)) return false
      if (!needle) return true
      return [r.name, r.community, r.cuisine, r.phone].some((v) => String(v || '').toLowerCase().includes(needle))
    })
  }, [rows, q, filter])

  function saved(listing, { keepOpen = false } = {}) {
    if (!keepOpen) setOpen(null)
    invalidateQuery('/api/partners/listings')
    query.refetch()
  }

  const missing = rows.filter((r) => !r.image_url).length

  return (
    <>
      <div className="partner-toolbar">
        <span className="partner-search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, area, cuisine, phone…" />
        </span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All listings ({rows.length})</option>
          <option value="restaurant">Restaurants</option>
          <option value="bar">Bars & Nightlife</option>
          <option value="coffee">Coffee & Breakfast</option>
          <optgroup label="Local Guide">
            {guides.map((g) => (
              <option key={g.slug} value={`guide:${g.slug}`}>
                {g.title}
              </option>
            ))}
          </optgroup>
          <option value="nophoto">Missing photo ({missing})</option>
          <option value="hidden">Hidden from guests</option>
        </select>
        <Button className="btn" onClick={() => setOpen({})}>
          <Plus size={17} /> Add listing
        </Button>
      </div>
      {query.error ? <p className="page-error">{errorMessage(query.error)}</p> : null}
      {query.loading ? (
        <div className="card">
          <SkeletonTable rows={6} cols={4} />
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <EmptyState icon={Store} title="No listings match." />
        </div>
      ) : (
        <div className="card partner-list">
          {shown.slice(0, 300).map((r) => (
            <button key={r.id} type="button" className="partner-row" onClick={() => setOpen(r)}>
              <span className="partner-row-img" style={r.image_url ? { backgroundImage: `url("${r.image_url.startsWith('/') ? GUEST_APP_URL + r.image_url : r.image_url}")` } : undefined}>
                {r.image_url ? null : <ImagePlus size={16} />}
              </span>
              <span className="partner-row-main">
                <strong>{r.name}</strong>
                <small className="muted">
                  {r.listing_type === 'vendor' ? guides.find((g) => g.slug === r.guide_slug)?.title || 'Local Guide' : (r.venue_types || [r.listing_type]).map((t) => TYPE_LABELS[t]).join(' · ')}
                  {r.community ? ` · ${r.community}` : ''}
                </small>
              </span>
              <span className="partner-row-phone muted">{r.phone || ''}</span>
              {r.is_active ? null : <Pill neutral>Hidden</Pill>}
            </button>
          ))}
          {shown.length > 300 ? <p className="muted" style={{ padding: 12 }}>Showing 300 of {shown.length} — search to narrow down.</p> : null}
        </div>
      )}
      {open ? (
        <ListingModal
          listing={open.id ? { ...open, image_url: open.image_url?.startsWith('/') ? GUEST_APP_URL + open.image_url : open.image_url } : open}
          options={options}
          onClose={() => setOpen(null)}
          onSaved={saved}
        />
      ) : null}
    </>
  )
}

export default function Partners() {
  useTitle('Partners · My30A Admin')
  const options = useQuery('/api/partners/options').data
  const pendingCount = (useQuery('/api/partners/requests?status=pending').data || []).length
  const [tab, setTab] = useState('requests')

  return (
    <section>
      <div className="head">
        <div>
          <h1>Partners</h1>
          <div className="sub">
            Partner requests from{' '}
            <a href={`${GUEST_APP_URL}/partners/join`} target="_blank" rel="noreferrer">
              {GUEST_APP_URL.replace(/^https?:\/\//, '')}/partners/join
            </a>{' '}
            and every restaurant, bar, coffee shop and Local Guide listing guests see.
          </div>
        </div>
      </div>
      <div className="tabs partner-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'requests'} className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>
          Requests {pendingCount ? <span className="partner-badge">{pendingCount}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'listings'} className={tab === 'listings' ? 'on' : ''} onClick={() => setTab('listings')}>
          Listings
        </button>
      </div>
      {tab === 'requests' ? <Requests options={options} /> : <Listings options={options} />}
    </section>
  )
}
