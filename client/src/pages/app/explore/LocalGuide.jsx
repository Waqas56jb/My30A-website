import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorText, guest, useGuestQuery } from '../../../lib/guestApi.js'
import { ExploreHead, ExploreShell, FILTERS, GuideCard, VendorCard } from './ExploreShared.jsx'

export default function LocalGuide() {
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const initial = FILTERS.some((f) => f.key === params.get('c')) ? params.get('c') : 'all'
  const [filter, setFilter] = useState(initial)

  const guideQuery = useGuestQuery(() => guest.guide(filter), [filter], { enabled: !q })
  const searchQuery = useGuestQuery(() => guest.search(q), [q], { enabled: Boolean(q) })

  const items = q ? searchQuery.data?.guides || [] : guideQuery.data?.items || []
  const vendors = q ? searchQuery.data?.vendors || [] : []
  const loading = q ? searchQuery.loading : guideQuery.loading
  const error = q ? searchQuery.error : guideQuery.error

  return (
    <ExploreShell>
      <ExploreHead
        title={q ? `Results for “${q}”` : 'Local Guide'}
        sub="30A’s best - curated by Vitoria"
        back="/app/explore"
      />

      <div className="app-exp-body">
        {q ? null : (
          <div className="app-exp-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`app-exp-filter${filter === f.key ? ' is-on' : ''}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {error ? <p className="app-inline-error">{errorText(error)}</p> : null}

        <div className="app-exp-cards">
          {items.map((item) => (
            <GuideCard key={item.key} item={item} />
          ))}
        </div>

        {vendors.length ? (
          <>
            <h2 className="app-exp-count">{vendors.length} Places</h2>
            <div className="app-exp-vendors">
              {vendors.map((v) => (
                <VendorCard key={v.id} vendor={v} />
              ))}
            </div>
          </>
        ) : null}

        {!loading && !error && items.length === 0 && vendors.length === 0 ? (
          <p className="app-empty">Nothing here yet. Try another category.</p>
        ) : null}
      </div>
    </ExploreShell>
  )
}
