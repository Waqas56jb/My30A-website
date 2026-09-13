import { useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell } from './ExploreShared.jsx'

export default function PublicInfo() {
  const { data, loading, error } = useGuestQuery(guest.info, [])
  // Text sections (rules/parking/…) plus the free public layer (beach accesses, parks, emergency).
  const sections = [
    ...(data?.sections || []),
    ...(data?.places || []).map((s) => ({ key: s.key, title: s.title, places: s.places, items: [] })),
  ]
  const [open, setOpen] = useState(null)
  const openKey = open === null ? sections[0]?.key || null : open

  return (
    <ExploreShell nav={false}>
      <ExploreHead
        title="Public Information"
        sub="Official resources, helpful local information for your stay"
        back="/app/explore"
      />

      <div className="app-exp-body">
        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}
        {loading ? <p className="app-empty">Loading…</p> : null}
        <div className="app-exp-accs">
          {sections.map((s) => {
            const isOpen = openKey === s.key
            return (
              <section key={s.key} className="app-exp-acc">
                <button
                  type="button"
                  className="app-exp-acc-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? '' : s.key)}
                >
                  <span>{s.title}</span>
                  {isOpen ? (
                    <ChevronUp size={22} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={22} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
                {isOpen ? (
                  <ul className="app-exp-acc-list">
                    {s.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                    {(s.places || []).map((p) => (
                      <li key={p.name}>
                        <strong>{p.name}</strong>
                        {p.community ? ` · ${p.community}` : ''}
                        {p.details ? <br /> : null}
                        {p.details ? <span className="app-exp-acc-detail">{p.details}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )
          })}
        </div>

        <div className="app-xfer-note is-info is-lg">
          <Info size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            Information provided is based on official local resources, including{' '}
            <a href="https://www.visitsouthwalton.com" target="_blank" rel="noreferrer">
              Visit South Walton
            </a>{' '}
            and regional partners.
          </span>
        </div>
      </div>
    </ExploreShell>
  )
}
