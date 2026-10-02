import { useState } from 'react'
import Button from '../components/Button.jsx'
import SkeletonTable from '../components/Skeleton.jsx'
import Table from '../components/Table.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { chicagoDateTimeToIso, chicagoDatetimeLocal, errorMessage } from '../lib/format.js'
import { useTitle } from '../lib/useTitle.js'
import { invalidateQuery, useQuery } from '../lib/useQuery.js'

const AIRPORTS = ['ECP', 'VPS', 'PNS']

function groupPricing(rows) {
  const byCommunity = new Map()
  for (const row of rows || []) {
    const id = row.community_id
    if (!byCommunity.has(id)) {
      byCommunity.set(id, {
        id,
        name: row.community?.name || 'Community',
        zone: row.community?.zone || '',
        defaultAirport: row.community?.default_airport || '',
        prices: {},
      })
    }
    byCommunity.get(id).prices[`${row.airport}:${row.vehicle_type}`] = row.base_price
  }
  return [...byCommunity.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function priceCell(community, airport) {
  const car = community.prices[`${airport}:4pax`]
  const suv = community.prices[`${airport}:6pax`]
  const van = community.prices[`${airport}:14pax`]
  if (car == null && suv == null && van == null) return '—'
  return `$${Number(car).toFixed(0)} / ${Number(suv).toFixed(0)} / ${Number(van).toFixed(0)}`
}

const SERVICES = [
  { kind: 'transfer', title: 'Airport transfers', fallback: 'Airport transfers are paused for the moment. We’ll be back soon — thank you for your patience.' },
  { kind: 'grocery', title: 'Grocery delivery', fallback: 'Grocery delivery is paused for the moment. We’ll be back soon — thank you for your patience.' },
]

// Service availability: pause Transfer and/or Grocery. Guests then see the message (and the
// back-online time) instead of the form, can't submit, and Vitoria tells them the same. Takes
// effect immediately; at the back-online time the service reopens by itself.
function ServicePanel({ service, settings, onSaved }) {
  const toast = useToast()
  const { kind } = service
  const live = {
    paused: Boolean(settings?.[`${kind}_paused`]),
    message: settings?.[`${kind}_pause_message`] || service.fallback,
    resume: settings?.[`${kind}_resume_at`] ? chicagoDatetimeLocal(new Date(settings[`${kind}_resume_at`])) : '',
  }
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = draft || live
  const expired = live.paused && settings?.[`${kind}_resume_at`] && new Date(settings[`${kind}_resume_at`]) <= new Date()
  const pausedNow = live.paused && !expired

  async function save(next) {
    setBusy(true)
    try {
      const body = {
        [`${kind}_paused`]: next.paused,
        [`${kind}_pause_message`]: next.message.trim() || service.fallback,
        [`${kind}_resume_at`]: next.resume ? chicagoDateTimeToIso(next.resume) : null,
      }
      const saved = await api('/api/settings', { method: 'PATCH', body })
      setDraft(null)
      onSaved(saved)
      toast.success(next.paused ? `${service.title} paused — guests see your message now` : `${service.title} back on`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`svc-panel${pausedNow ? ' is-paused' : ''}`}>
      <div className="svc-head">
        <div>
          <strong>{service.title}</strong>
          <small>{pausedNow ? 'Paused — guests can’t request' : 'Open — guests can request'}</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!pausedNow}
          aria-label={`${service.title} accepting requests`}
          className={`svc-switch${pausedNow ? '' : ' on'}`}
          disabled={busy}
          onClick={() => save({ ...form, paused: !pausedNow })}
        >
          <i />
        </button>
      </div>
      <div className="field">
        <label>Message guests see while paused</label>
        <textarea rows={2} value={form.message} onChange={(e) => setDraft({ ...form, message: e.target.value })} />
      </div>
      <div className="field">
        <label>Back online (optional, Florida time)</label>
        <div className="svc-when">
          <input type="datetime-local" value={form.resume} onChange={(e) => setDraft({ ...form, resume: e.target.value })} />
          {form.resume ? (
            <button type="button" className="btn quiet sm" onClick={() => setDraft({ ...form, resume: '' })}>
              Clear
            </button>
          ) : null}
        </div>
        <small className="muted">At this time the service turns back on by itself. Leave empty if there’s no return time yet.</small>
      </div>
      {draft ? (
        <Button className="btn sm" pending={busy} onClick={() => save({ ...form, paused: pausedNow })}>
          Save message
        </Button>
      ) : null}
    </div>
  )
}

export default function Settings() {
  useTitle('Settings · My30A Admin')
  const toast = useToast()
  const settingsQuery = useQuery('/api/settings')
  const pricingQuery = useQuery('/api/communities/pricing/all')
  const [draft, setDraft] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const settings = draft || {
    platform_fee_percent: String(settingsQuery.data?.platform_fee_percent ?? ''),
    default_owner_fee_percent: String(settingsQuery.data?.default_owner_fee_percent ?? ''),
    grocery_buffer_percent: String(settingsQuery.data?.grocery_buffer_percent ?? ''),
    grocery_rush_fee_percent: String(settingsQuery.data?.grocery_rush_fee_percent ?? ''),
    grocery_min_notice_days: String(settingsQuery.data?.grocery_min_notice_hours != null ? settingsQuery.data.grocery_min_notice_hours / 24 : ''),
    grocery_instant_payouts: settingsQuery.data?.grocery_instant_payouts ?? true,
    alert_emails: settingsQuery.data?.alert_emails ?? '',
    host_price_monthly: String(settingsQuery.data?.host_price_monthly ?? ''),
    host_price_semiannual: String(settingsQuery.data?.host_price_semiannual ?? ''),
    host_price_annual: String(settingsQuery.data?.host_price_annual ?? ''),
  }
  const communities = groupPricing(pricingQuery.data)
  const loading = settingsQuery.loading || pricingQuery.loading
  const error = settingsQuery.error || pricingQuery.error

  async function save(event) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const saved = await api('/api/settings', {
        method: 'PATCH',
        body: {
          platform_fee_percent: Number(settings.platform_fee_percent),
          default_owner_fee_percent: Number(settings.default_owner_fee_percent),
          grocery_buffer_percent: Number(settings.grocery_buffer_percent),
          grocery_rush_fee_percent: Number(settings.grocery_rush_fee_percent),
          grocery_min_notice_hours: Math.round(Number(settings.grocery_min_notice_days) * 24),
          grocery_instant_payouts: Boolean(settings.grocery_instant_payouts),
          alert_emails: settings.alert_emails,
          host_price_monthly: Number(settings.host_price_monthly),
          host_price_semiannual: Number(settings.host_price_semiannual),
          host_price_annual: Number(settings.host_price_annual),
        },
      })
      setDraft({
        platform_fee_percent: String(saved.platform_fee_percent),
        default_owner_fee_percent: String(saved.default_owner_fee_percent),
        grocery_buffer_percent: String(saved.grocery_buffer_percent),
        grocery_rush_fee_percent: String(saved.grocery_rush_fee_percent),
        grocery_min_notice_days: String(saved.grocery_min_notice_hours / 24),
        grocery_instant_payouts: saved.grocery_instant_payouts,
        alert_emails: saved.alert_emails || '',
        host_price_monthly: String(saved.host_price_monthly),
        host_price_semiannual: String(saved.host_price_semiannual),
        host_price_annual: String(saved.host_price_annual),
      })
      invalidateQuery('/api/settings')
      await settingsQuery.refetch()
      toast.success('Saved')
    } catch (err) {
      const message = errorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Rates apply to future trips only. Completed trips never change.</div>
        </div>
      </div>

      {error ? <p className="page-error">{errorMessage(error)}</p> : null}

      {settingsQuery.data ? (
        <div className="card svc-card">
          <h3>Service availability</h3>
          <p className="muted">Pause a service for a holiday, no driver or shopper, or a system issue. Guests see your message right away instead of the request form.</p>
          <div className="svc-grid">
            {SERVICES.map((service) => (
              <ServicePanel
                key={service.kind}
                service={service}
                settings={settingsQuery.data}
                onSaved={() => {
                  invalidateQuery('/api/settings')
                  settingsQuery.refetch()
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid g2">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Platform fee</h3>
            <span className="shimmer shimmer-sm" />
            <span className="shimmer shimmer-lg" />
            <span className="shimmer shimmer-sm" />
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Transfer price table</h3>
            <SkeletonTable rows={4} cols={4} />
          </div>
        </div>
      ) : (
        <div className="grid g2">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Platform fee</h3>
            <form onSubmit={save}>
              <div className="field">
                <label>My30A Host fee when a partner drives their own vehicle</label>
                <input
                  value={settings.platform_fee_percent}
                  onChange={(event) =>
                    setDraft({ ...settings, platform_fee_percent: event.target.value })
                  }
                  style={{ maxWidth: 120 }}
                />
                <small className="muted">percent of the customer charge, before tips</small>
              </div>
              <div className="field">
                <label>Default owner fee for new vehicles</label>
                <input
                  value={settings.default_owner_fee_percent}
                  onChange={(event) =>
                    setDraft({ ...settings, default_owner_fee_percent: event.target.value })
                  }
                  style={{ maxWidth: 120 }}
                />
              </div>
              <h3 style={{ margin: '18px 0 12px' }}>Alerts</h3>
              <div className="field">
                <label>Email me new orders at</label>
                <input
                  type="text"
                  value={settings.alert_emails}
                  placeholder="you@example.com, partner@example.com"
                  onChange={(event) => setDraft({ ...settings, alert_emails: event.target.value })}
                />
                <small className="muted">
                  New transfers, new grocery orders and guest cancellations are emailed here (separate several with commas).
                  They also pop up in this panel with a sound.
                </small>
              </div>
              <h3 style={{ margin: '18px 0 12px' }}>Grocery prepayment</h3>
              <div className="field">
                <label>Price buffer charged on top of the Publix cart</label>
                <input
                  value={settings.grocery_buffer_percent}
                  onChange={(event) => setDraft({ ...settings, grocery_buffer_percent: event.target.value })}
                  style={{ maxWidth: 120 }}
                />
                <small className="muted">percent · covers weighed items and substitutions; the unused part comes off the service fee</small>
              </div>
              <div className="field">
                <label>Standard notice (days before delivery)</label>
                <input
                  value={settings.grocery_min_notice_days}
                  onChange={(event) => setDraft({ ...settings, grocery_min_notice_days: event.target.value })}
                  style={{ maxWidth: 120 }}
                />
                <small className="muted">orders with less notice pay the short-notice fee</small>
              </div>
              <div className="field">
                <label>Short-notice fee</label>
                <input
                  value={settings.grocery_rush_fee_percent}
                  onChange={(event) => setDraft({ ...settings, grocery_rush_fee_percent: event.target.value })}
                  style={{ maxWidth: 120 }}
                />
                <small className="muted">percent of the Publix cart, shown to the guest · covers the Instant Payout fee</small>
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.grocery_instant_payouts)}
                    onChange={(event) => setDraft({ ...settings, grocery_instant_payouts: event.target.checked })}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Send short-notice prepayments to my bank instantly (Stripe Instant Payouts)
                </label>
                <small className="muted">needs a debit card added in Stripe → Settings → Payouts</small>
              </div>
              <h3 style={{ margin: '18px 0 12px' }}>Host Version plans</h3>
              <div className="row2">
                {[
                  ['host_price_monthly', 'Monthly'],
                  ['host_price_semiannual', 'Every 6 months'],
                  ['host_price_annual', 'Annual'],
                ].map(([key, label]) => (
                  <div className="field" key={key}>
                    <label>{label} — $ per property</label>
                    <input value={settings[key]} onChange={(event) => setDraft({ ...settings, [key]: event.target.value })} style={{ maxWidth: 120 }} />
                  </div>
                ))}
              </div>
              <small className="muted">Shown on my30ahost.com/hosts. New signups pay these prices; existing hosts keep the price they signed up with.</small>
              {formError ? <p className="form-error">{formError}</p> : null}
              <Button type="submit" className="btn" pending={saving}>
                Save changes
              </Button>
            </form>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Transfer price table</h3>
            <p className="muted" style={{ marginBottom: 10 }}>
              {communities.length} communities × 3 airports × 3 vehicle types. Prices are one-way.
            </p>
            <Table>
              <thead>
                <tr>
                  <th>Community</th>
                  {AIRPORTS.map((airport) => (
                    <th key={airport} className="num">
                      {airport}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {communities.map((community) => (
                  <tr key={community.id}>
                    <td data-label="Community">
                      {community.name}{' '}
                      <small className="muted">
                        {community.zone}
                        {community.defaultAirport && community.defaultAirport !== 'ECP'
                          ? ` · defaults to ${community.defaultAirport}`
                          : ''}
                      </small>
                    </td>
                    {AIRPORTS.map((airport) => (
                      <td key={airport} className="num" data-label={airport}>
                        {priceCell(community, airport)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="muted" style={{ marginTop: 10 }}>
              4 pax / 6 pax / 14 pax
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
